import ExpoModulesCore
import Foundation

/// Bridges the main-app App Intents (plugins/withAppIntents/SleepSmoothIntents.swift) to JS, and sets the backup-exclusion
/// flag on the clips folder. Nothing here records audio. No App Group: intents run in this app's own process.
///
/// The two strings below MUST match SleepSmoothIntents.swift (checked by a unit test).
public class SleepSmoothAutomationModule: Module {
  private static let pendingKey = "sleepsmooth.automation.pending"
  private static let notificationName = Notification.Name("com.sleepsmooth.automation.command")
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("SleepSmoothAutomation")
    Events("onCommand")

    OnStartObserving {
      self.observer = NotificationCenter.default.addObserver(forName: Self.notificationName, object: nil, queue: .main) { [weak self] note in
        guard let payload = note.userInfo?["payload"] as? String else { return }
        // JS is alive and listening: hand the command over now and clear the stored copy so it is not replayed.
        UserDefaults.standard.removeObject(forKey: Self.pendingKey)
        self?.sendEvent("onCommand", ["payload": payload])
      }
    }
    OnStopObserving {
      if let o = self.observer { NotificationCenter.default.removeObserver(o) }
      self.observer = nil
    }

    /// Returns and clears a command stored by an intent while JS was not listening (cold launch, or app suspended).
    Function("consumePendingCommand") { () -> String? in
      let d = UserDefaults.standard
      guard let s = d.string(forKey: Self.pendingKey) else { return nil }
      d.removeObject(forKey: Self.pendingKey)
      return s
    }

    /// Sets NSURLIsExcludedFromBackupKey on a directory or file. NOT VERIFIED on device.
    Function("setExcludedFromBackup") { (path: String) -> Bool in
      var url = URL(fileURLWithPath: path)
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      do {
        try url.setResourceValues(values)
        return true
      } catch {
        return false
      }
    }
  }
}
