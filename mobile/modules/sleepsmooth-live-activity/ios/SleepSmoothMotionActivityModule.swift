import CoreMotion
import ExpoModulesCore
import Foundation

/// Reads the phone's own motion-activity history (CMMotionActivityManager, up to 7 days) so JS can find long overnight
/// stationary stretches (src/mobileLogic/routine.ts). Asking triggers the Motion & Fitness permission prompt, so JS only
/// calls `queryActivities` after the user taps "Find my routine". Requires NSMotionUsageDescription (plugins/withMotionUsage).
/// Returns activity CHANGE events; JS turns them into intervals. Not available in the simulator or Expo Go.
/// NOT VERIFIED on a device.
public class SleepSmoothMotionActivityModule: Module {
  private let manager = CMMotionActivityManager()

  public func definition() -> ModuleDefinition {
    Name("SleepSmoothMotionActivity")

    Function("isAvailable") { () -> Bool in
      CMMotionActivityManager.isActivityAvailable()
    }

    /// "notDetermined" | "restricted" | "denied" | "authorized"
    Function("authorizationStatus") { () -> String in
      switch CMMotionActivityManager.authorizationStatus() {
      case .notDetermined: return "notDetermined"
      case .restricted: return "restricted"
      case .denied: return "denied"
      case .authorized: return "authorized"
      @unknown default: return "notDetermined"
      }
    }

    /// Activity events from `days` days ago until now: [{ startMs, stationary }]. Consecutive events with the same
    /// stationary flag are collapsed. A low-confidence "unknown" event is not treated as stationary.
    AsyncFunction("queryActivities") { (days: Int) async throws -> [[String: Any]] in
      guard CMMotionActivityManager.isActivityAvailable() else { return [] }
      let to = Date()
      let from = to.addingTimeInterval(-Double(max(1, min(days, 7))) * 86_400)
      let activities: [CMMotionActivity] = try await withCheckedThrowingContinuation { cont in
        self.manager.queryActivityStarting(from: from, to: to, to: OperationQueue()) { result, error in
          if let error { cont.resume(throwing: error) } else { cont.resume(returning: result ?? []) }
        }
      }
      var out: [[String: Any]] = []
      var last: Bool?
      for a in activities {
        let still = a.stationary && !a.walking && !a.running && !a.cycling && !a.automotive && a.confidence != .low
        if still == last { continue }
        last = still
        out.append(["startMs": a.startDate.timeIntervalSince1970 * 1000, "stationary": still])
      }
      return out
    }
  }
}
