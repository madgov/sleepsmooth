import ExpoModulesCore
import Foundation
import HealthKit

/// Read-only Apple Health access: sleep analysis (asleep versus in bed, never stages) and step-count edges around a night.
/// Nothing here writes to Health. The module is always linked, but it only works when the build carries the HealthKit
/// entitlement (plugins/withHealthKit, flag `healthkit` in app.json). With the flag off, `isAvailable()` is false.
///
/// Read authorization quirk: HealthKit never says whether the user allowed a READ type (privacy). `requestAuthorization`
/// completing means the sheet was shown and dismissed, not that data will be returned. JS therefore treats "connected" as
/// "the request completed", and shows "no records" when a read returns nothing.
/// NOT VERIFIED on a device: everything in this file (the iOS 26.1 platform needed to build is not installed here).
public class SleepSmoothHealthModule: Module {
  private let store = HKHealthStore()
  private var sleepType: HKCategoryType? { HKObjectType.categoryType(forIdentifier: .sleepAnalysis) }
  private var stepType: HKQuantityType? { HKObjectType.quantityType(forIdentifier: .stepCount) }

  public func definition() -> ModuleDefinition {
    Name("SleepSmoothHealth")

    Function("isAvailable") { () -> Bool in
      HKHealthStore.isHealthDataAvailable()
    }

    /// Shows the Health permission sheet for READ access to sleep and steps. Returns true when the request completed.
    AsyncFunction("requestReadAuthorization") { () async throws -> Bool in
      guard HKHealthStore.isHealthDataAvailable(), let sleep = self.sleepType, let steps = self.stepType else { return false }
      return try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Bool, Error>) in
        self.store.requestAuthorization(toShare: [], read: [sleep, steps]) { ok, error in
          if let error { cont.resume(throwing: error) } else { cont.resume(returning: ok) }
        }
      }
    }

    /// Sleep samples of the last `days` days, reduced to { startMs, endMs, kind: "asleep" | "inBed", source, userEntered }.
    /// "awake" samples are skipped. Stages (core, deep, REM) are all reported as "asleep".
    AsyncFunction("readSleepSamples") { (days: Int) async throws -> [[String: Any]] in
      guard HKHealthStore.isHealthDataAvailable(), let type = self.sleepType else { return [] }
      let from = Date().addingTimeInterval(-Double(max(1, min(days, 30))) * 86_400)
      let predicate = HKQuery.predicateForSamples(withStart: from, end: Date(), options: [])
      let samples: [HKSample] = try await self.run(type: type, predicate: predicate, limit: HKObjectQueryNoLimit, ascending: true)
      return samples.compactMap { s -> [String: Any]? in
        guard let c = s as? HKCategorySample, let kind = Self.kind(c.value) else { return nil }
        let userEntered = (c.metadata?[HKMetadataKeyWasUserEntered] as? Bool) ?? false
        return [
          "startMs": c.startDate.timeIntervalSince1970 * 1000,
          "endMs": c.endDate.timeIntervalSince1970 * 1000,
          "kind": kind,
          "source": Self.sourceName(c),
          "userEntered": userEntered,
        ]
      }
    }

    /// For each [startMs, endMs] night: the end of the last step record up to 4 h before the start, and the start of the
    /// first step record up to 4 h after the end. null when there is none.
    AsyncFunction("readStepEdges") { (nights: [[Double]]) async throws -> [[String: Any]] in
      guard HKHealthStore.isHealthDataAvailable(), let type = self.stepType else { return [] }
      var out: [[String: Any]] = []
      for n in nights where n.count == 2 {
        let start = Date(timeIntervalSince1970: n[0] / 1000)
        let end = Date(timeIntervalSince1970: n[1] / 1000)
        let before = HKQuery.predicateForSamples(withStart: start.addingTimeInterval(-4 * 3600), end: start, options: [])
        let after = HKQuery.predicateForSamples(withStart: end, end: end.addingTimeInterval(4 * 3600), options: [])
        let b = try await self.run(type: type, predicate: before, limit: 1, ascending: false).first
        let a = try await self.run(type: type, predicate: after, limit: 1, ascending: true).first
        out.append([
          "lastStepBeforeMs": b.map { $0.endDate.timeIntervalSince1970 * 1000 } as Any,
          "firstStepAfterMs": a.map { $0.startDate.timeIntervalSince1970 * 1000 } as Any,
        ])
      }
      return out
    }
  }

  private func run(type: HKSampleType, predicate: NSPredicate, limit: Int, ascending: Bool) async throws -> [HKSample] {
    try await withCheckedThrowingContinuation { (cont: CheckedContinuation<[HKSample], Error>) in
      let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: ascending)
      let q = HKSampleQuery(sampleType: type, predicate: predicate, limit: limit, sortDescriptors: [sort]) { _, results, error in
        if let error { cont.resume(throwing: error) } else { cont.resume(returning: results ?? []) }
      }
      self.store.execute(q)
    }
  }

  /// Aggregates every asleep value to "asleep" and in-bed to "inBed". Awake is dropped.
  private static func kind(_ value: Int) -> String? {
    if value == HKCategoryValueSleepAnalysis.inBed.rawValue { return "inBed" }
    if value == HKCategoryValueSleepAnalysis.awake.rawValue { return nil }
    return "asleep" // asleepUnspecified, asleepCore, asleepDeep, asleepREM
  }

  /// A device name such as "Apple Watch" when HealthKit has one, otherwise the app that wrote the record.
  private static func sourceName(_ s: HKSample) -> String {
    if let d = s.device?.name, !d.isEmpty { return d }
    return s.sourceRevision.source.name
  }
}
