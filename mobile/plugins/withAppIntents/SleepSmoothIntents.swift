// SleepSmooth App Intents (main app target). Lets the USER's own Shortcuts Personal Automation start the overnight check.
//
// What this is NOT: an app cannot create a Personal Automation. These intents only appear as Shortcuts actions once the
// user builds the automation (see the in-app guide). Nothing here records audio. It hands a command to the JS side:
//   1. enqueue() stores a small JSON command in UserDefaults.standard (survives until JS consumes it), and
//   2. posts a NotificationCenter event that the SleepSmoothAutomation Expo module forwards to JS if JS is already alive.
// No App Group is needed: intents run in the app's own process. Whether JS is alive when an intent runs in the
// background, and whether iOS lets the microphone start from there, is NOT VERIFIED on a device.
//
// The bridge constants live in SleepSmoothLiveActivityIntents.swift and MUST match SleepSmoothAutomationModule.swift (unit test).
import AppIntents
import Foundation

// `SleepSmoothAutomation` (the UserDefaults + NotificationCenter bridge) is defined in SleepSmoothLiveActivityIntents.swift,
// which is compiled into this target and into the Live Activity extension.

/// iOS 18 and later: an AudioRecordingIntent is allowed to begin recording from the background when the user's automation runs it.
@available(iOS 18.0, *)
struct StartOvernightCheckIntent: AudioRecordingIntent {
  static let title: LocalizedStringResource = "Start SleepSmooth overnight check"
  static let description = IntentDescription("Starts listening for snore-like sounds on this iPhone until your morning end time.")

  func perform() async throws -> some IntentResult {
    SleepSmoothAutomation.enqueue(kind: "start")
    return .result()
  }
}

/// iOS 16.4 to 17: no background-recording intent exists, so the app opens and starts from the foreground.
struct StartOvernightCheckOpenAppIntent: AppIntent {
  static let title: LocalizedStringResource = "Start SleepSmooth overnight check"
  static let description = IntentDescription("Opens SleepSmooth and starts listening for snore-like sounds on this iPhone.")
  static let openAppWhenRun: Bool = true
  /// On iOS 18 and later the AudioRecordingIntent above is the one to use, so this one is hidden from the action list.
  static var isDiscoverable: Bool {
    if #available(iOS 18.0, *) { return false }
    return true
  }

  func perform() async throws -> some IntentResult {
    SleepSmoothAutomation.enqueue(kind: "start")
    return .result()
  }
}

struct StopOvernightCheckIntent: AppIntent {
  static let title: LocalizedStringResource = "Stop SleepSmooth overnight check"
  static let description = IntentDescription("Stops the overnight check and saves the night.")

  func perform() async throws -> some IntentResult {
    SleepSmoothAutomation.enqueue(kind: "stop")
    return .result()
  }
}

struct SleepSmoothShortcuts: AppShortcutsProvider {
  /// Built imperatively because AppShortcutsBuilder cannot branch on availability.
  static var appShortcuts: [AppShortcut] {
    var list: [AppShortcut] = []
    if #available(iOS 18.0, *) {
      list.append(
        AppShortcut(
          intent: StartOvernightCheckIntent(),
          phrases: ["Start my \(.applicationName) overnight check", "Start \(.applicationName)"],
          shortTitle: "Start overnight check",
          systemImageName: "moon.stars"
        ))
    } else {
      list.append(
        AppShortcut(
          intent: StartOvernightCheckOpenAppIntent(),
          phrases: ["Start my \(.applicationName) overnight check", "Start \(.applicationName)"],
          shortTitle: "Start overnight check",
          systemImageName: "moon.stars"
        ))
    }
    list.append(
      AppShortcut(
        intent: StopOvernightCheckIntent(),
        phrases: ["Stop my \(.applicationName) overnight check", "Stop \(.applicationName)"],
        shortTitle: "Stop overnight check",
        systemImageName: "stop.circle"
      ))
    return list
  }
}
