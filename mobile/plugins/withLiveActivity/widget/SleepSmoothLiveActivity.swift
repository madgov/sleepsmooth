import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

// "Listening tonight" and the morning prompt. v3 look: indigo surface, cyan accent (#34C8E8), calm. No green, even though
// the system call pill is green.
// Copy rules: says that the phone is listening or that recording stopped. Never says sleeping, never describes sleep or its
// quality, never says the morning signal is a measurement.
//
// Phases (SleepSmoothRecordingAttributes.Phase):
//   listening    elapsed timer, window end, Stop link
//   morning      sunrise glyph, "Good morning. Stop recording?", time, Stop and Open buttons
//   autoStopped  sunrise glyph, "Auto-stopped at 7:12 am", Open button
// Buttons are LiveActivityIntents on iOS 17+ (SleepSmoothLiveActivityIntents.swift, compiled into both targets). Below 17
// the Stop control is the sleepsmooth://stop link, which opens the app to its normal confirmation.
// NOT VERIFIED on a device or simulator in this environment (the iOS 26.1 platform is not installed here).

private let accent = Color(red: 0.204, green: 0.784, blue: 0.910)        // #34C8E8
private let surface = Color(red: 0.110, green: 0.106, blue: 0.200)       // #1C1B33
private let secondary = Color(red: 0.725, green: 0.729, blue: 0.816)     // #B9BAD0
private let stopURL = URL(string: "sleepsmooth://stop")!
private let summaryURL = URL(string: "sleepsmooth://night/latest")!

private typealias Phase = SleepSmoothRecordingAttributes.Phase

private struct Glyph: View {
  let phase: Phase
  var size: CGFloat = 20
  var body: some View {
    Image(systemName: phase == .listening ? "waveform" : "sunrise.fill")
      .font(.system(size: size, weight: .semibold))
      .foregroundStyle(accent)
      .accessibilityLabel(phase == .listening ? "Listening" : "Morning")
  }
}

private struct Elapsed: View {
  let startedAt: Date
  var body: some View {
    Text(startedAt, style: .timer)
      .monospacedDigit()
      .multilineTextAlignment(.trailing)
      .accessibilityLabel("Elapsed time")
  }
}

/// A wall-clock time with tabular digits.
private struct Clock: View {
  let date: Date
  var body: some View {
    Text(date, style: .time).monospacedDigit()
  }
}

private struct Headline: View {
  let state: SleepSmoothRecordingAttributes.ContentState
  var body: some View {
    switch state.phase {
    case .listening:
      Text("Listening tonight")
    case .morning:
      Text("Good morning. Stop recording?")
    case .autoStopped:
      if let stoppedAt = state.stoppedAt {
        Text("Auto-stopped at \(stoppedAt, style: .time)")
      } else {
        Text("Auto-stopped")
      }
    }
  }
}

private struct Subline: View {
  let state: SleepSmoothRecordingAttributes.ContentState
  var body: some View {
    switch state.phase {
    case .listening:
      if let endsAt = state.windowEndsAt {
        Text("Estimated window ends \(endsAt, style: .time)")
      } else {
        Text("Listening on this iPhone")
      }
    case .morning:
      Text("Still listening. Recorded on this iPhone.")
    case .autoStopped:
      Text("The night is saved on this iPhone.")
    }
  }
}

private struct ButtonLabel: View {
  let title: String
  var prominent = false
  var body: some View {
    Text(title)
      .font(.subheadline.weight(.semibold))
      .foregroundStyle(prominent ? surface : accent)
      .padding(.horizontal, 14)
      .frame(minHeight: 44)
      .background(Capsule().fill(prominent ? accent : accent.opacity(0.16)))
  }
}

/// Stop: an interactive intent on iOS 17+, the app link below that.
private struct StopControl: View {
  var body: some View {
    if #available(iOS 17.0, *) {
      Button(intent: MorningStopIntent()) { ButtonLabel(title: "Stop", prominent: true) }
        .buttonStyle(.plain)
        .accessibilityLabel("Stop recording")
    } else {
      Link(destination: stopURL) { ButtonLabel(title: "Stop", prominent: true) }
        .accessibilityLabel("Stop recording")
        .accessibilityHint("Opens SleepSmooth to confirm")
    }
  }
}

private struct OpenControl: View {
  var body: some View {
    if #available(iOS 17.0, *) {
      Button(intent: MorningOpenIntent()) { ButtonLabel(title: "Open") }
        .buttonStyle(.plain)
        .accessibilityLabel("Open SleepSmooth")
    } else {
      Link(destination: summaryURL) { ButtonLabel(title: "Open") }
        .accessibilityLabel("Open SleepSmooth")
    }
  }
}

private struct Controls: View {
  let phase: Phase
  var body: some View {
    switch phase {
    case .listening:
      Link(destination: stopURL) { ButtonLabel(title: "Stop") }
        .accessibilityLabel("Stop recording")
        .accessibilityHint("Opens SleepSmooth to confirm")
    case .morning:
      HStack(spacing: 8) {
        OpenControl()
        StopControl()
      }
    case .autoStopped:
      OpenControl()
    }
  }
}

/// The trailing time: elapsed while listening, the wall-clock time in the morning phases.
private struct TrailingTime: View {
  let state: SleepSmoothRecordingAttributes.ContentState
  var body: some View {
    switch state.phase {
    case .listening: Elapsed(startedAt: state.startedAt)
    case .morning: Clock(date: state.morningAt ?? state.startedAt)
    case .autoStopped: Clock(date: state.stoppedAt ?? state.startedAt)
    }
  }
}

private struct LockScreen: View {
  let state: SleepSmoothRecordingAttributes.ContentState
  // The system dims the Lock Screen (Always-On, low power). Follow it instead of forcing full-brightness colours.
  @Environment(\.isLuminanceReduced) private var dimmed

  var body: some View {
    HStack(spacing: 12) {
      ZStack {
        Circle().fill(accent.opacity(dimmed ? 0.10 : 0.16))
        Glyph(phase: state.phase, size: 18)
      }
      .frame(width: 40, height: 40)
      VStack(alignment: .leading, spacing: 2) {
        Headline(state: state).font(.headline).foregroundStyle(.white.opacity(dimmed ? 0.8 : 1)).lineLimit(2).minimumScaleFactor(0.85)
        Subline(state: state).font(.subheadline).foregroundStyle(secondary)
      }
      Spacer(minLength: 8)
      VStack(alignment: .trailing, spacing: 4) {
        TrailingTime(state: state)
          .font(.title3.weight(.semibold))
          .foregroundStyle(.white.opacity(dimmed ? 0.8 : 1))
          .frame(maxWidth: 110, alignment: .trailing)
        Controls(phase: state.phase)
      }
    }
    .padding(16)
  }
}

struct SleepSmoothLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: SleepSmoothRecordingAttributes.self) { context in
      LockScreen(state: context.state)
        .activityBackgroundTint(surface)
        .activitySystemActionForegroundColor(accent)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          HStack(spacing: 8) {
            Glyph(phase: context.state.phase, size: 18)
            if context.state.phase == .listening { Text("Listening tonight").font(.headline).foregroundStyle(.white) }
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          TrailingTime(state: context.state)
            .font(.title3.weight(.semibold))
            .foregroundStyle(.white)
            .frame(maxWidth: 96, alignment: .trailing)
        }
        DynamicIslandExpandedRegion(.center) {
          if context.state.phase != .listening {
            Headline(state: context.state).font(.headline).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.8)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          HStack {
            if context.state.phase == .listening {
              Subline(state: context.state).font(.subheadline).foregroundStyle(secondary)
              Spacer(minLength: 8)
            } else {
              Spacer(minLength: 0)
            }
            Controls(phase: context.state.phase)
          }
        }
      } compactLeading: {
        Glyph(phase: context.state.phase, size: 14)
      } compactTrailing: {
        // Morning compact view: the time. The sentence is in the expanded view the system opens with the alert.
        TrailingTime(state: context.state)
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(accent)
          .frame(maxWidth: 56)
          .minimumScaleFactor(0.8)
      } minimal: {
        Glyph(phase: context.state.phase, size: 14)
      }
      .keylineTint(accent)
    }
  }
}
