import ActivityKit
import Foundation

/// Shared by the app module and the widget extension (the plugin copies this file into the extension target).
/// State is passed through ActivityKit content state only. There is no App Group and no push token.
/// Wording rule: this describes that the phone is listening. It never describes sleep or sleep quality.
struct SleepSmoothRecordingAttributes: ActivityAttributes {
  /// What the island and Lock Screen show. Raw values are the strings JS sends; keep in sync with src/liveActivity/index.ts.
  enum Phase: String, Codable, Hashable {
    /// "Listening tonight", elapsed timer.
    case listening
    /// Morning prompt: "Good morning. Stop recording?" with Stop and Open.
    case morning
    /// Automatic stop happened: "Auto-stopped at 7:12 am", with Open.
    case autoStopped
  }

  struct ContentState: Codable, Hashable {
    /// Wall-clock start of the recording. The system timer counts up from this; no per-second updates are sent.
    var startedAt: Date
    /// The estimated end of the user's chosen window (their wake time). Optional.
    var windowEndsAt: Date?
    /// Defaults to `.listening` when an older activity without this field is decoded.
    var phase: Phase = .listening
    /// When the morning signal fired (morning phase). A heuristic, not a measurement.
    var morningAt: Date?
    /// When recording stopped by itself (autoStopped phase).
    var stoppedAt: Date?

    init(startedAt: Date, windowEndsAt: Date? = nil, phase: Phase = .listening, morningAt: Date? = nil, stoppedAt: Date? = nil) {
      self.startedAt = startedAt
      self.windowEndsAt = windowEndsAt
      self.phase = phase
      self.morningAt = morningAt
      self.stoppedAt = stoppedAt
    }

    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      startedAt = try c.decode(Date.self, forKey: .startedAt)
      windowEndsAt = try c.decodeIfPresent(Date.self, forKey: .windowEndsAt)
      phase = try c.decodeIfPresent(Phase.self, forKey: .phase) ?? .listening
      morningAt = try c.decodeIfPresent(Date.self, forKey: .morningAt)
      stoppedAt = try c.decodeIfPresent(Date.self, forKey: .stoppedAt)
    }
  }

  var name: String
}
