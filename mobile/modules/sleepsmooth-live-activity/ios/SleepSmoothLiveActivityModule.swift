import ActivityKit
import ExpoModulesCore
import Foundation

/// Starts, updates and ends the "Listening tonight" Live Activity. Local only: no push, no App Group.
/// Starting must happen while the app is in the foreground (ActivityKit rule); the JS side starts it right after capture starts.
/// Updating and ending work from the background while the app is alive (it is, through the audio background mode).
/// NOT VERIFIED on a device: the morning alert expanding the island, and updates arriving while the screen is locked.
public class SleepSmoothLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SleepSmoothLiveActivity")

    Function("isSupported") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    AsyncFunction("start") { (startedAtMs: Double, windowEndsAtMs: Double?) async -> String? in
      guard #available(iOS 16.2, *), ActivityAuthorizationInfo().areActivitiesEnabled else { return nil }
      for existing in Activity<SleepSmoothRecordingAttributes>.activities {
        await existing.end(nil, dismissalPolicy: .immediate)
      }
      let state = SleepSmoothRecordingAttributes.ContentState(
        startedAt: Self.date(startedAtMs),
        windowEndsAt: windowEndsAtMs.map { Self.date($0) }
      )
      do {
        let activity = try Activity.request(
          attributes: SleepSmoothRecordingAttributes(name: "overnight-listening"),
          content: ActivityContent(state: state, staleDate: nil),
          pushType: nil
        )
        return activity.id
      } catch {
        return nil
      }
    }

    /// phase: "listening" | "morning" | "autoStopped". When `alert` is true an AlertConfiguration is attached, which is what
    /// makes iOS expand the Dynamic Island briefly and light the Lock Screen.
    AsyncFunction("update") { (phase: String, morningAtMs: Double?, stoppedAtMs: Double?, alert: Bool) async -> Bool in
      guard #available(iOS 16.2, *), let activity = Activity<SleepSmoothRecordingAttributes>.activities.first,
        let p = SleepSmoothRecordingAttributes.Phase(rawValue: phase)
      else { return false }
      var state = activity.content.state
      state.phase = p
      state.morningAt = morningAtMs.map { Self.date($0) }
      state.stoppedAt = stoppedAtMs.map { Self.date($0) }
      let content = ActivityContent(state: state, staleDate: nil)
      if alert {
        let config = AlertConfiguration(title: "Good morning", body: "Stop recording?", sound: .default)
        await activity.update(content, alertConfiguration: config)
      } else {
        await activity.update(content)
      }
      return true
    }

    /// Ends the activity. With `finalPhase` set, the last state is shown for `lingerSec` seconds first (used for
    /// "Auto-stopped at 7:12 am"), then the system removes it.
    AsyncFunction("end") { (finalPhase: String?, stoppedAtMs: Double?, lingerSec: Double?) async in
      guard #available(iOS 16.2, *) else { return }
      for activity in Activity<SleepSmoothRecordingAttributes>.activities {
        if let fp = finalPhase, let p = SleepSmoothRecordingAttributes.Phase(rawValue: fp) {
          var state = activity.content.state
          state.phase = p
          state.stoppedAt = stoppedAtMs.map { Self.date($0) }
          let policy: ActivityUIDismissalPolicy = .after(Date().addingTimeInterval(max(1, lingerSec ?? 300)))
          await activity.end(ActivityContent(state: state, staleDate: nil), dismissalPolicy: policy)
        } else {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
    }
  }

  private static func date(_ ms: Double) -> Date { Date(timeIntervalSince1970: ms / 1000) }
}
