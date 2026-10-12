# SleepSmooth iPhone App: Visual Direction v2

Status: IMPLEMENTED with exact Figma values (device checks pending). Date: 2026-10-11. Amends `docs/IOS_DESIGN.md`. Where the two disagree, this file wins for the items listed in section 0.
Binding companions unchanged: `CLAUDE.md`, `docs/OVERNIGHT_PLAN.md`, `src/content/claims.ts`.

## 0. What changes, and what does not

| Area | v1 (IOS_DESIGN.md) | v2 (this file) |
|---|---|---|
| Tab bar | `NativeTabs`, two plain tabs (D1) | JS `Tabs` + custom SVG `GlassTabBar`: curved centre hump, raised 64pt Record button, Audio and Results side tabs (section 2). D1 is superseded. |
| Live status while recording | none | "Listening tonight" Live Activity in the Dynamic Island and on the Lock Screen (section 3) |
| Backgrounds | flat `bg`, soft blobs on Audio | three-stop indigo gradient `#2E335A` to `#1C1B33` (weather file) on every tab screen (static), angled panel and halo on Audio and onboarding only (section 5) |
| Chrome surfaces | `Surface` only | adds frosted `GlassCard`, 1pt gradient border, 164x164 `GlassTile`, neumorphic `NeuSegmented`, 60x146 `HourCapsule`, gradient primary button (sections 5 and 7) |
| Result and evidence surfaces | `Surface` with source-coded borders | UNCHANGED. No glass, no glow, no gradient border, no new motion on results. |
| Recording screen | night tokens (D7) | UNCHANGED, and the new tab bar follows it (night bar while recording on Audio). |

Not touched: `src/night`, the evidence engine, `claims.ts`, the model, all copy keys.

## 1. Reference extraction (and its honest limits)

### 1.1 Figma access

Both community files were read by the orchestrator through the Figma connector (read-only) and recorded in `docs/design-refs/FIGMA_VALUES.md` plus `figma-*.png`. Every value below is taken from that file. An earlier draft of this document used approximations; they are gone. Style only: no bike photos, 3D weather icons or illustrations are copied. Poppins (bike file) is not adopted; we keep SF Pro.
- Bike file `bKv0gxo3MXt6kwLrHR0ver` node `1:2`; weather file `GyRptKc8Ww1AQMO1ofCcX7` node `2:4`.
- Reference images: `docs/design-refs/tabbar-reference.png`, `statusbar-reference.png`.

### 1.2 Read from the attached images (exact, structural)

Tab bar sheet (`tabbar-reference.png`), three themes (Light, Dark Theme 1 blue accent, Dark Theme 2 white accent), each with 9 variants:
1. Five icons, active icon + label in accent.
2. Active shown inside a filled circle (icon only) or a horizontal pill (icon + label), accent at about 15 percent fill.
3. Active shown by a short top indicator bar above the item.
4. Raised circular centre action (accent fill, white glyph), with two labelled tabs on each side; active tab accent.
- Bar: rounded rectangle (about 20pt radius in the sheet), 1 row of icons with 11pt labels, home indicator inside the bar. Light: white bar. Dark: near-black `#1B1C20`-like bar, inactive grey, labels below icons.
- Dark Theme 1 = blue accent (`#5B9BF0`-like). Dark Theme 2 = white accent. **We adopt Dark Theme 1 (blue)** and map it to our existing accent token, but the final accent comes from the bike file (`#34C8E8`, section 1.3), not the sheet's blue.

Status bar sheet (`statusbar-reference.png`): the iOS status bar in black-on-light and white-on-dark, "back to app" variant (small `< AppName` under the time), and the green call pill / green call bar. The system owns all of it (section 4).

### 1.3 Exact values and how we map them

| Source (exact) | Value | Used for |
|---|---|---|
| Weather app background | `#2E335A` to `#1C1B33` | `bgGradient` (dark); `bg` = `#1C1B33` |
| Weather cards | `#5936B4` to `#362A84` | glass tint (28 to 34 percent alpha), capsule fill |
| Weather hump | 258 wide curved cut-out, 64pt raised centre button, side items 44pt, inset 32 | `GlassTabBar` |
| Weather hourly capsule | 60x146 | `HourCapsule` |
| Weather detail tile | 164x164 | `GlassTile` |
| Bike primary button | `linear-gradient(171.9deg, #34C8E8, #4E4AF2)` | centre button, active tab tile; primary CTAs use the clamped `#3068E3` to `#4E4AF2` so white text passes |
| Bike segmented active | `#323B4F`, shadows `-4 -4 10 #38445A` / `4 4 10 #252B39`, radius 10 | `NeuSegmented` active pill (indigo equivalents in 5.1) |
| Bike segmented track | `#28303F`, inset `-4 -4 8 #364055` / `4 4 8 #202633` | `NeuSegmented` track |
| Bike active text | gradient `#3CA4EB` to `#4286EE` | NOT used as gradient text (3.1 to 4.1:1); solid `#34C8E8` instead |
| Bike text tracking | -0.3 | on 13 to 17pt text only |
| iOS semantic labels | label 100%, secondary 60%, tertiary 30%, separator | flattened to solid tokens (5.1); see deviations |

Deviations, each forced by the 4.5:1 rule or by the safety brief:
1. iOS 60 percent secondary white measures 4.2:1 over glass and the light-mode `#3C3C43` at 60 percent about 3.4:1, so secondary and tertiary are solid darker or lighter values.
2. Light accent is `#4339D8` (white on it 7.46); `#34C8E8` is only for dark.
3. The weather file's `#C427FB` accent is not used for anything that signals a finding.
4. The capsule fill is purple, near the "sample" tone family; the row sits inside the existing `Surface`, which keeps the sample badge and dashed border for sample nights.
5. No Results filter control exists in the app, so none was invented; `NeuSegmented` is used for the questionnaire units choice.

## 2. Tab bar

### 2.1 Decision

Expo Router `Tabs` from `expo-router/js-tabs` with a custom `tabBar`: `src/ui/GlassTabBar.tsx`, drawn with `react-native-svg`. The weather file's curved hump cannot be a native `UITabBarController`. The bar is edge to edge and in flow.

```
        Audio         .-'''-.        Results
      [raised tile]  /  ( o ) \       (idle)
  ____              /  64pt    \              ____
 /    `-.__________/  258 hump  \___________.-'    \
 |   side items 44pt, inset 32 from each edge       |
 +--------------------------------------------------+
   Audio              Record / Stop           Results
   (home indicator area is part of the bar fill)
```

### 2.2 Dimensions (points), constants in `TAB_BAR`

| Item | Value |
|---|---|
| Body height | 64, plus bottom safe-area inset (the fill extends under the home indicator) |
| Lift | 36 above the body for the hump and button; total = lift + body + inset |
| Hump | 258 wide, 86 deep (`humpTop`), cubic-curve shoulders; top corners radius 24 |
| Centre button | 64 (reuses `HeroRecordButton`), 92 slot, top -6 |
| Side items | 76 x 56 Pressable (44 minimum target), centred 32 in from each edge |
| Active side tab | raised, skewed (-6 degrees) 52pt `accentGradient` tile lifted 14, white SF Symbol (bike file's raised selected tile) |
| Fills | path 1 `colors.card`; path 2 `glassGradient` fill with `glassBorder` gradient stroke |
| Labels | 11pt, `maxFontSizeMultiplier` 1.3 |

While recording on Audio the whole bar switches to night tokens (`ThemedNight`), same as the screen (D7).

### 2.3 Centre button behaviour

| App state | Glyph | Label under it | Press |
|---|---|---|---|
| Idle | white `moon.zzz` on the `accentGradient` fill | Record | opens `/consent` (if consent not given) or `/start-sheet`. Recording never starts from this tap alone |
| Idle, microphone denied | same | Record | switches to the Audio tab, which explains it and links to Settings |
| Starting / stopping | as current state, disabled | | none |
| Recording | `stop.fill` in accent on a `card` fill, breathing ring | Stop | the existing stop confirmation (`useRecordAction`) |

### 2.4 Springs and motion

- Active tile: `springSnappy` (damping ratio 1, 250 ms, no overshoot) on lift and opacity. Content switches stay non-animated.
- Reduce Motion: 120 ms opacity fade only, no travel; centre ring static. Reduce Transparency: the glass overlay is dropped and the bar is solid `card`; the gradient stroke becomes solid `separatorOpaque` (also under Increase Contrast).

### 2.5 Accessibility

- Row `accessibilityRole="tablist"`; each tab `tab` with selected state and label "Audio" / "Results".
- Centre button: "Start tonight's recording" or "Stop recording" with hints; the visible caption is hidden from VoiceOver.
- Targets at least 44pt. Labels capped at 1.3x so the fixed bar never clips; page content is uncapped.

## 3. Dynamic Island and Live Activity

### 3.1 What is shown (wording rules)

Says "Listening". Never "sleeping", never anything about sleep or its quality. No green; accent cyan `#34C8E8` on `#1C1B33` only, even though the system call pill is green (`statusbar-reference.png`).

| Presentation | Content |
|---|---|
| Compact leading | `waveform` SF Symbol, accent. Accessibility label "Listening" |
| Compact trailing | elapsed time, `Text(startedAt, style: .timer)` (system timer, counts up, no per-second updates sent) |
| Minimal | `waveform` icon only |
| Expanded | leading: waveform + "Listening tonight". trailing: elapsed timer. bottom: "Estimated window ends HH:MM" (system time style, follows the user's 12 or 24 hour setting) and a Stop control |
| Lock Screen / banner | same information in one row: waveform badge, "Listening tonight", "Estimated window ends HH:MM", timer, Stop |

If the user set no window end, the second line reads "Listening on this iPhone".

```
Compact:   [ ))) ]  (camera)  [ 3:07:12 ]
Minimal:   [ ))) ]
Expanded:
 +----------------------------------------------+
 | ))) Listening tonight              3:07:12   |
 | Estimated window ends 7:00 AM       [ Stop ] |
 +----------------------------------------------+
```

### 3.2 Stop control: a deep link now, an App Intent later

The Stop control is a `Link` to `sleepsmooth://stop`. The app route `app/stop.tsx` opens the Audio tab and shows the normal "Stop recording?" confirmation. This is deliberate: a `LiveActivityIntent` button would have to be compiled into the app target as well as the extension, and its `perform()` would have to reach the JS capture controller from a background launch. That cannot be built or tested on this Mac yet, and a wrong stop would silently end a night. Revisit after the first successful device run (section 3.6).

### 3.3 Implementation options researched

| Option | Verdict |
|---|---|
| `expo-widgets` 57.0.23 (official, SwiftUI via Expo UI) | Rejected for this device setup. Its config plugin unconditionally writes the `com.apple.security.application-groups` entitlement (`withAppGroupEntitlements`) and `aps-environment` (`withPushNotifications`), even when push is off. I read the plugin source in the published package. Both are the capabilities most likely to block free provisioning. Could be neutralised with extra plugins, but that is fighting the library |
| `expo-live-activity` 0.4.2 (Software Mansion) | Closest. No App Group (the code is commented out), push is opt-in and off by default, widget extension target generated. But its UI is a fixed title/subtitle/countdown layout with a countdown-to-date timer; we need count-up elapsed time, "Estimated window ends", a Stop link. Customising means forking its Swift views anyway |
| `@bacons/apple-targets` 5.0.0 | A good way to build a widget target from a `targets/` folder, but it adds a prebuild-time dependency and still needs our own ActivityKit module |
| **Chosen: small local module + own config plugin** | `modules/sleepsmooth-live-activity` (Expo local module, ~60 lines of Swift: `isSupported`, `start`, `end`) and `plugins/withLiveActivity` (adds the widget extension target; Xcode helper functions vendored from expo-live-activity 0.4.2 under MIT, licence file included). One shared `SleepSmoothRecordingAttributes.swift` is the source for both the module and the extension |

### 3.4 Free Apple ID (Personal Team) analysis

| Question | Finding |
|---|---|
| Does a Live Activity need a capability? | No capability toggle. `NSSupportsLiveActivities = YES` in the app Info.plist is the only app-side requirement for local activities. Push Notifications is required only for remote updates / push-to-start, which we do not use. Not listed in Apple's supported-capabilities table (the page lists App groups, Background modes, Push notifications, and not Live Activities) |
| App Groups? | **Avoided.** Apple's table (https://developer.apple.com/help/account/reference/supported-capabilities-ios/) has an "App groups" row, but the page text I could fetch lost the per-account-type check marks, so I could not confirm whether a free account gets it. State goes through ActivityKit content state instead, so the question never arises |
| `aps-environment`? | Not present. Verified by prebuild: main entitlements are an empty dict; the extension's entitlements are an empty dict |
| Can a free team sign a widget extension target? | **Unverified here.** Each extension is its own app id (`com.sleepsmooth.overnight.dev.LiveActivity`); Xcode automatic signing must register it, and free accounts have a weekly app-id limit. Device check D1 below. If it fails, set `"enabled": false` for the plugin and the app builds exactly as before |
| Stale profile trap | A forum report describes a Live Activity rendering blank after upgrading from a free to a paid team because the extension kept a cached 7-day profile. If the Island is blank on a signed build, delete the extension's profile from `~/Library/Developer/Xcode/UserData/Provisioning Profiles` and rebuild |
| Team id | Set `expo.ios.appleTeamId` in `app.json` (already in DEVICE_TEST.md); the plugin passes it to the extension target. Otherwise select the team on the extension target in Xcode once |

### 3.5 Interaction with `AudioRecordingIntent` (OVERNIGHT_PLAN I4)

OVERNIGHT_PLAN I4 says `AudioRecordingIntent` (iOS 18+) lets an intent start or stop recording but requires a Live Activity for the whole recording or the recording stops, and that starting it from the background was reported failing ("Target is not foreground"). Consequences:
- We still do not build on `AudioRecordingIntent` (unchanged decision).
- This Live Activity is nonetheless the prerequisite for ever adopting it, so building it now removes that dependency.
- Our recording does not depend on the Live Activity: capture runs under `UIBackgroundModes: audio` as before. If ActivityKit refuses, is disabled by the user, or the extension is missing, recording and the in-app UI are unaffected (every JS call is a no-op or caught).

### 3.6 Constraints and honest limits

- A Live Activity can be started only while the app is in the foreground. `useLiveActivitySync` starts it when capture reports `recording` (the user just tapped Start) and ends it when capture leaves the recording state.
- Apple documents a maximum of 8 hours for a Live Activity (then it ends, and may stay on the Lock Screen a few hours more). An overnight window longer than 8 hours will lose the Island part before the end. The app does not restart it silently. Recording itself continues.
- A user who has turned Live Activities off for the app gets none; `isSupported()` returns false and nothing else changes.
- The activity shows nothing derived from audio: only start time and the user's chosen window end.

Sources:
- Apple, ActivityKit: Displaying live data with Live Activities https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities (page body did not render to my fetcher; the 8-hour limit, foreground-start rule, and `NSSupportsLiveActivities` requirement are from my knowledge of that guide and must be confirmed on device)
- Apple, AudioRecordingIntent https://developer.apple.com/tutorials/data/documentation/appintents/audiorecordingintent.md and forum thread https://developer.apple.com/forums/thread/815725 (both as already cited in OVERNIGHT_PLAN I4)
- Apple, Supported capabilities (iOS) https://developer.apple.com/help/account/reference/supported-capabilities-ios/
- `expo-widgets@57.0.23` and `expo-live-activity@0.4.2` package sources, read from the npm tarballs (plugin files `withAppGroupEntitlements.js`, `withPushNotifications.js`, `withAppInfoPlist.js`; `ios-files/LiveActivityWidget.swift`)
- https://www.npmjs.com/package/@bacons/apple-targets (5.0.0)
- Apple Developer Forums report of a stale free-team provisioning profile on a widget extension (found by search, not independently reproduced)

### 3.7 Feature flag and failure isolation

- One flag: `{ "enabled": true }` on `./plugins/withLiveActivity` in `app.json`.
- `false` or removing the entry: no extension target, no `NSSupportsLiveActivities`, `extra.liveActivity = false`, JS calls are no-ops. The local module still autolinks but is inert.
- If the extension fails to build or sign, set the flag to false and re-run `npx expo prebuild -p ios`. Nothing else in the app depends on it.

## 4. Status bar

- `expo-status-bar` at the root is `style="auto"` (follows system appearance: light content on dark screens, dark content on light). The Audio screen overrides to `light` while recording (night surface). The status bar follows the focused screen, not the tab bar: the night tab bar on Audio and the light Results screen can coexist and the status bar is correct on each.
- The app cannot draw a custom pill into the system status bar. While the mic is in use, iOS shows the orange microphone indicator in the status bar and Dynamic Island by itself; we never imitate it, and the start sheet explains the orange dot (`N10_ORANGE_DOT`).
- The supported equivalent of "show the app is in use in the Dynamic Island" is the Live Activity in section 3. The green call pill and green status bar in `statusbar-reference.png` are system-only call UI. We do not copy their green.

## 5. Palette, surfaces, borders

### 5.1 Tokens (`mobile/src/theme/tokens.ts`)

| Token | Light | Dark | Night (recording) |
|---|---|---|---|
| `bg` | `#F2F1FA` | `#1C1B33` | `#05080D` |
| `bgGradient` (ends on `bg`) | `#E4E2F6`, `#F2F1FA`, `#F2F1FA` | `#2E335A`, `#252746`, `#1C1B33` | `#0A0D1E`, `#070A16`, `#05080D` |
| `card` / `cardRaised` | `#FFFFFF` / light raised | `#25264A` / `#2D2E58` | `#12131F` |
| `label` / `labelSecondary` / `labelTertiary` | `#000000` / `#4A4A55` / `#5E5E69` | `#FFFFFF` / `#B9BAD0` / `#ADAFC8` | night values |
| `accent` / `accentFg` / `focus` | `#4339D8` / `#FFFFFF` / `#3D35CC` | `#34C8E8` / `#10213D` / `#7FD9F0` | as dark |
| `accentGradient` (non-text) | cyan to indigo | `#34C8E8` to `#4E4AF2` | as dark |
| `accentGradientText` (CTA with text) | `#3068E3` to `#4E4AF2` | same | same |
| `glassGradient` | tinted white | `rgba(89,54,180,.34)` to `rgba(54,42,132,.34)` | night glass |
| `glassFill` / `glow` | white 72% | `rgba(89,54,180,.28)` / `.30` | night |
| `glassBorder` | white to accent | `rgba(255,255,255,.28)` to `.05` | as dark |
| `neu` track / trackLight / trackDark | light track | `#232447` / `#33356A` / `#18182F` | night |
| `neu` active / activeLight / activeDark | | `#2F3160` / `#3A3D72` / `#1B1C38` | night |
| `capsule` fill / fillEnd / outline | `#48319D` / dark end / outline | `#5936B4` / `#362A84` / `rgba(235,235,245,.32)` | night |
| `separator` / `separatorOpaque` | | `rgba(235,235,245,.18)` / `#3C3D66` | |

Tone colours (info, discuss, missing, sample, model, error), radii and spacing are unchanged.

### 5.2 Surfaces and components

| Component | Use | Not allowed on |
|---|---|---|
| `ScreenBackdrop` plain / audio | vertical gradient (+ one angled slab and halo on audio and onboarding); solid under Reduce Transparency | glow or panel on results |
| `GradientBorder`, `GlassCard` | chrome only | results, evidence, summary |
| `GlassTabBar` | tab chrome (section 2) | |
| `PrimaryButton` filled | primary CTAs only: `accentGradientText` gradient, white text | result and evidence cards |
| `NeuSegmented` | questionnaire units; 44pt segments, radiogroup semantics, inset track and raised pill via `boxShadow`, active text solid accent, static | |
| `HourCapsule` / `HourCapsuleRow` | 60x146, inside the night detail "Estimated sleep window" card under the Timeline. Fill height = estimated-asleep minutes in that hour; paler band = uncertain minutes; outline = glass. Minutes also printed under each capsule. No glow, no animation | any claim wording |
| `GlassTile` | 164x164 "Estimated window" and "Window length", plain facts, no gauge, no score; solid card under Reduce Transparency | |
| `Surface` (unchanged) | all result, evidence and night-detail cards, source-coded borders | |

### 5.3 Hard rules checklist

- No green anywhere: accent is cyan/indigo, Live Activity is cyan.
- No neon or glow on results; no celebration; no count-up. The static halo on Audio and the recording breathing ring are the only glows.
- Recording screen stays dark (`ThemedNight`).
- Backdrops, capsules, tiles and the segmented control are static; the tab tile and ring respect Reduce Motion; Reduce Transparency makes glass solid.

## 6. Contrast (WCAG 2.x relative luminance, computed with node)

Text 4.5:1 minimum. Non-text graphics 3:1. Glass over card = `#342A68`; glass over bg = `#2D2357`.

| Pair | Ratio |
|---|---|
| Dark label `#FFFFFF` on glass-on-card `#342A68` | 12.52 (higher on bg, card, raised) |
| Dark secondary `#B9BAD0` on glass-on-bg / glass-on-card | 7.38 / 6.56 |
| Dark tertiary `#ADAFC8` on glass-on-bg / glass-on-card | 6.54 / 5.81 |
| Dark accent `#34C8E8` on bg / card | 8.43 / 7.27 |
| Focus `#7FD9F0` on bg | 10.44 |
| Segmented: accent on active `#2F3160` / on track `#232447` | 6.11 / 7.47 |
| Segmented: secondary `#B9BAD0` on track / on active | 7.77 / 6.36 |
| Primary CTA: white on `#3068E3` / on `#4E4AF2` | 4.98 / 5.86 |
| Accent button fg `#10213D` on `#34C8E8` | 8.09 |
| Centre button glyph: white at gradient mid-point (graphic, 3:1) | 3.48 (cyan end 1.99 is outside the glyph) |
| Active tab tile glyph: white on the `#4E4AF2` side | 5.86 |
| Light label `#000000` on `#F2F1FA` | 18.74 |
| Light secondary `#4A4A55` on bg / card | 7.80 / 8.74 |
| Light tertiary `#5E5E69` on bg | 5.71 |
| Light accent `#4339D8` on bg / card; white on accent | 6.66 / 7.46 / 7.46 |
| Night label on `#05080D` | 20.06 |
| Capsule outline over bg (graphic) | 2.64; fill vs bg 2.08 and 1.45 |
| Live Activity: accent `#34C8E8` on `#1C1B33` | 8.43 |

Known limits, stated plainly: the bike file's gradient text and the iOS 60 percent secondary were not adopted because they fail 4.5:1. The capsule outline and fill are below 3:1 as graphics against the page; this is acceptable only because the minutes are printed as text under each capsule and the VoiceOver label carries the numbers, so colour is never the only signal. The centre glyph sits near the middle of the gradient (about 3.0 to 4.0 across its extent) with the "Record" caption as text. Increase Contrast keeps the border strengthening.

## 7. Screen deltas

### 7.1 Onboarding
Gradient backdrop with the angled slab and halo (static). Page content unchanged. No tab bar (it lives only under `(tabs)`).

```
+--------------------------+
|   (halo)                 |
|  ~~~ angled slab ~~~     |
|        moon.zzz          |
|   Welcome title          |
|   Not a diagnosis        |
|  [ Continue ]  o o o o   |
+--------------------------+
```

### 7.2 Audio tab (idle)
```
Tonight                      [gear]
+------------------------------+
| (GlassCard, 28 radius)       |
|        ( moon.zzz )          |
|        Start tonight         |
|   idle subcopy               |
+------------------------------+
 Sleep hours   10:30 PM to 7:00 AM >
 Bedtime reminder                  >
 Look at a sample night            >
 disclaimer
 +--------------------------------+
 | Audio   (  Record  )   Results |
 +--------------------------------+
```
Recording: no card, night tokens, tab bar night, centre button shows Stop with the breathing ring, label "Stop".

### 7.3 Results tab and night detail
Gradient backdrop only. All cards remain `Surface` with source borders. Night detail adds, inside the existing "Estimated sleep window" card and under the Timeline: the hourly capsule row (scrolls horizontally), a plain-language footnote ("an estimate from the recording, not a measurement"), and two 164x164 glass tiles (window, length), both captioned "Estimated". No glow, no gauge, no count-up.

### 7.5 Questionnaire units
`NeuSegmented` replaces the native segmented control. Same values, same tick haptic.

### 7.4 Sheets and settings
Unchanged (native form sheets).

## 8. Files

New: `docs/IOS_DESIGN_V2.md`, `docs/design-refs/*`, `mobile/src/ui/{GlassTabBar,GlassCard,GradientBorder,NeuSegmented,HourCapsule,GlassTile}.tsx`, `mobile/src/ui/hourBuckets.ts`, `mobile/src/hooks/{useRecordAction,useLiveActivitySync}.ts`, `mobile/src/liveActivity/index.ts`, `mobile/app/stop.tsx`, `mobile/modules/sleepsmooth-live-activity/**`, `mobile/plugins/withLiveActivity/**`.
Changed: `mobile/app/(tabs)/_layout.tsx`, `mobile/app/(tabs)/audio/index.tsx`, `mobile/app/(tabs)/results/night/[id].tsx`, `mobile/app/questionnaire.tsx`, `mobile/app/_layout.tsx`, `mobile/app.json`, `mobile/src/theme/tokens.ts`, `mobile/src/ui/{ScreenBackdrop,HeroRecordButton,PrimaryButton}.tsx`.

## 9. Device-only checks

- D1. Xcode signs the `SleepSmoothLiveActivity` extension with the free Personal Team (or note the exact error).
- D2. Island and Lock Screen render, the system timer counts up, the window-end time is correct, the Stop link opens the confirmation, and the activity ends on stop.
- D3. `SleepSmoothLiveActivityModule.swift` compiles against ExpoModulesCore (not compiled on this Mac; the widget Swift and the shared attributes file were type-checked against the iOS 26.1 SDK).
- D4. Tab bar: SVG hump renders and is not clipped, raised button and ring are not clipped, safe-area spacing on devices with and without a home indicator, Dynamic Type at 1.3x, VoiceOver reads tabs with selected state, Reduce Motion and Reduce Transparency.
- D5. Capture still records with the screen locked, and recording is unaffected if the Live Activity is off.
- D6. Behaviour at the 8-hour Live Activity limit during a long overnight window.
- D7. `boxShadow` inset on `NeuSegmented` renders on device (New Architecture); capsules and tiles at Dynamic Type 1.3x and under Reduce Transparency.
