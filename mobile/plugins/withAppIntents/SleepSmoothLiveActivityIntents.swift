// Shared by the MAIN APP target and the LIVE ACTIVITY WIDGET EXTENSION target. Apple requires a LiveActivityIntent that
// a Live Activity button uses to be compiled into both: the extension references the type, and the system runs perform()
// in the app's process. Both plugins copy THIS file (plugins/withAppIntents and plugins/withLiveActivity); it is the only
// definition of `SleepSmoothAutomation`, which SleepSmoothIntents.swift (app target only) also uses.
//
// Bridge: the same UserDefaults.standard + NotificationCenter pattern as the automation module. No App Group, so nothing is
// shared between the two processes: the intent runs in the app process, where SleepSmoothAutomationModule listens.
// The two strings below MUST match SleepSmoothAutomationModule.swift. A unit test checks this.
//
// NOT VERIFIED on a device: that iOS runs perform() in the app process while the phone is locked and the app is only
// alive through its background audio session, and that the JS runtime is awake to receive the notification.
import AppIntents
import Foundation

enum SleepSmoothAutomation {
  static let pendingKey = "sleepsmooth.automation.pending"
  static let notificationName = Notification.Name("com.sleepsmooth.automation.command")

  static func enqueue(kind: String) {
    let at = Int(Date().timeIntervalSince1970 * 1000)
    let payload = "{\"kind\":\"\(kind)\",\"at\":\(at)}"
    UserDefaults.standard.set(payload, forKey: pendingKey)
    NotificationCenter.default.post(name: notificationName, object: nil, userInfo: ["payload": payload])
  }
}

/// Live Activity button "Stop": stops the recording in the app process without opening the app.
@available(iOS 17.0, *)
struct MorningStopIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "Stop recording"
  static let description = IntentDescription("Stops the overnight check and saves the night.")
  static let isDiscoverable: Bool = false
  static let openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    SleepSmoothAutomation.enqueue(kind: "morning-stop")
    return .result()
  }
}

/// Live Activity button "Open": opens the app at the night summary (JS routes it).
@available(iOS 17.0, *)
struct MorningOpenIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "Open SleepSmooth"
  static let description = IntentDescription("Opens SleepSmooth at last night's summary.")
  static let isDiscoverable: Bool = false
  static let openAppWhenRun: Bool = true

  func perform() async throws -> some IntentResult {
    SleepSmoothAutomation.enqueue(kind: "morning-open")
    return .result()
  }
}
