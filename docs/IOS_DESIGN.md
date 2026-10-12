# SleepSmooth iPhone App: Design Specification

Status: DESIGN SPEC (no app code written). Date: 2026-10-11. Audience: the implementation agent that builds `mobile/` next.
Binding companions: `CLAUDE.md` (absolute health-safety rules), `docs/OVERNIGHT_PLAN.md` (overnight mode, M0-M6, ER-1..ER-8), `src/content/claims.ts` (all approved copy).
Skills applied: apple-design, animate-expo (most specific), mobile-native (only its "feels installed" principles; its CSS items are web-only), emil-design-eng (frequency gate, press feel, no `scale(0)`, strong ease-out curves).

User request, verbatim intent: "make it premium with animations and different borders, change the entire UI to fit an app. go through an easy onboarding, then have an audio tab and results tab. FORMAT LIKE IOS APP".

---

## 0. Read this first

### 0.1 Non-negotiables inherited from CLAUDE.md (they constrain every section below)

1. Never say "diagnosis made / detected / apnea detected". Say "snore-like pattern observed".
2. No green anywhere on results. No checkmark-in-circle "all good" styling on any evidence or night state. Blue (info), amber ("worth discussing"), neutral grey (missing / not assessed), purple (sample) only.
3. No celebratory motion or haptics on results: no confetti, no bounce, no spring overshoot, no count-up, no success haptic.
4. A quiet, normal-looking, "few observations" or "not assessed" night must read as non-reassuring ("cannot rule out") in text, in colour and in motion.
5. Sample data is unmistakable: a purple "Sample" badge plus dashed-purple border on every sample element, plus `SAMPLE_AUDIO_NOT_USED` text.
6. No "probability", "confidence", "score" (except the published NoSAS score via claims.ts), "severity", "risk", "quality/efficiency/stages" of sleep.
7. A feature "works" only when exercised. Anything fed by mocked data in the UI (for example a simulated level source for the meter in the simulator) carries a visible label and is `__DEV__` only.

### 0.2 The 8 headline decisions

| # | Decision | Why (one line) |
|---|---|---|
| D1 | Expo Router with `NativeTabs` (real `UITabBarController`) for the two tabs, `animation: 'none'` between them | Free Liquid Glass on iOS 26, free blur earlier, correct behaviour; tab switches are 100+/day so no animation. `GlassTabBar` (JS + `expo-blur`) is a fallback component only. |
| D2 | Native stack + native large titles + native `formSheet` for every sheet | UIKit does the transitions, materials, detents and interruptible gestures better than anything in JS. |
| D3 | Settings / "Delete my data" in a header gear button that opens a `formSheet`; no third tab | Two tabs match the brief; settings is a low-frequency tool (see 1.4). |
| D4 | Onboarding is ONE route containing a horizontal native-paging `ScrollView` (6 pages), not 6 routes | Finger-driven, interruptible paging for free, and the scroll offset drives parallax and dots. |
| D5 | NoSAS is NOT inside the onboarding pager. Onboarding page 5 is an optional entry point that opens the same questionnaire modal the Results tab uses | Keeps onboarding to ~90 seconds; asks for height/weight/age/sex only when the user opts in; one implementation, two entry points. |
| D6 | NO number count-up on any result | Counts are findings, not a score being built. A mid-count frame can show a false "0" (false reassurance). See 3.4. |
| D7 | Recording state uses the dark colour tokens regardless of system appearance ("night surface") | A bright white screen in a dark bedroom is hostile; this is the one deliberate override of system appearance, scoped to the recording state only. |
| D8 | Haptics are sequenced around the iOS audio session: start haptic BEFORE capture starts, stop haptic AFTER capture has stopped and the session is released | iOS suppresses haptics and system sounds while an audio session is recording unless `allowHapticsAndSystemSoundsDuringRecording` is set. Device test required (see 3.5). |

---

## 1. Information architecture

### 1.1 Overview

```
App launch
 |-- onboarding not complete?  -->  /onboarding  (6 pages, one route, no tab bar)
 `-- complete                  -->  (tabs)
                                     |-- Audio   (Tonight)     large title "Tonight"
                                     `-- Results (Results)     large title "Results"
Header gear (both roots) --> /settings   (formSheet)
Audio "Start tonight"    --> /start-sheet (formSheet, fit to content)
Questionnaire            --> /questionnaire (modal stack; opened from onboarding p5, Results, Settings)
```

### 1.2 Onboarding (6 pages; ~90 s; progress dots; Back and Skip)

| Page | Title (key) | Purpose | Permission / data | Skip? |
|---|---|---|---|---|
| 1 Welcome | `WELCOME_TITLE` | What it is, what it cannot do, "Not a diagnosis" | none | No |
| 2 Privacy and consent | NEW N-03 | What stays on the phone; granular consent for the one purpose (overnight local capture) | writes `OvernightConsent` (purpose `overnight-local-capture`, version `mobile-consent-1`) | No (the consent button is the page's primary; "Not now" proceeds with `granted:false`, see 4.2) |
| 3 Microphone | NEW N-09 | Explain before the system prompt; the orange dot | mic permission asked HERE on button tap, after the explanation | Yes ("Not now") |
| 4 Sleep hours | NEW N-12 | Bedtime and wake time; optional bedtime reminder | notification permission asked when the user switches "Remind me at bedtime" ON | Yes |
| 5 About you (optional) | NEW N-17 | Entry to the NoSAS + symptom checklist | none yet | Yes ("Later") |
| 6 Before your first night / You're set | NEW N-20 | Bystander notice (distinct from consent) and a setup recap | records `bystanderNoticeAckAt` if ticked | n/a (final) |

Rules: Back is available on pages 2-6 (top-left chevron). Skip (top-right text button) appears on pages 3-5 and jumps to page 6, never past it. Pages 1-2 have no Skip because they are the safety floor and take two taps. Progress dots are 6 and are not tappable (they are a status, `accessibilityRole="progressbar"`). Re-entering onboarding later is not supported; the same steps live in Settings.

Why this order and these moments:
- Mic permission is requested on page 3 after the privacy explanation, so the system prompt (whose text is `NSMicrophoneUsageDescription` in `app.json`) is never a surprise and is never first seen at 11 pm. A denied prompt cannot be re-asked on iOS, so the primer must do the persuading and the fallback is "Open Settings" (see 4.3 and 4.6).
- Notification permission is requested when the user flips the reminder switch on page 4, the moment it is obviously about the bedtime time they just chose.
- NoSAS stays out of the pager (D5).

### 1.3 Tabs (native bottom tab bar, exactly two)

| Tab | Label | SF Symbol (default / selected) | Contents |
|---|---|---|---|
| Audio | "Audio" | `waveform` / `waveform` (selected uses `.fill`-style weight via `tintColor`) | Tonight: start/stop, live status, schedule, sample-night entry, interruption / permission / "night ended" states |
| Results | "Results" | `list.bullet.rectangle` / `list.bullet.rectangle.fill` | Overview, nights list, night detail, evidence cards, clinician summary, next steps |

Badges: Results shows the tab bar's plain dot badge (no number) only while a new night summary is unreviewed; it clears when the night is opened. Audio shows no badge (recording status is shown in-screen; the OS already shows the orange mic indicator).

### 1.4 Why settings is a header-button sheet, not a third tab

Tab bars are for peers used daily. Settings (sleep hours, reminder, answers, consent, delete) is touched rarely. A third tab would add a permanent target for a rare task, and "Delete my data" must be findable but must not be one accidental tap away. A gear (`gearshape`) in the header of both root screens opens a sheet; this is also the iOS convention for app-level settings in single-purpose apps. Justification to revisit: none needed for the hackathon.

### 1.5 Expo Router file tree (inside `mobile/app/`)

```
mobile/app/
  _layout.tsx                    Root <Stack>: GestureHandlerRootView, ThemeProvider, fonts; Stack.Protected gate
  index.tsx                      <Redirect> to /onboarding or /(tabs)/audio
  onboarding.tsx                 PagedOnboarding (headerShown:false, gestureEnabled:false, animation:'fade')
  (tabs)/
    _layout.tsx                  <NativeTabs> triggers: audio, results   (fallback: <Tabs tabBar={GlassTabBar}>)
    audio/
      _layout.tsx                <Stack> screenOptions: large title, transparent header, blur
      index.tsx                  Audio tab root ("Tonight")
    results/
      _layout.tsx                <Stack>
      index.tsx                  Overview + nights list ("Results")
      night/[id].tsx             Night detail (push; title = date; large title OFF)
      summary.tsx                Clinician summary (push)
      next-steps.tsx             Checklist (push)
      model-card.tsx             About the snore-pattern model (push)
      sources.tsx                Sources and claims (push)
  start-sheet.tsx                presentation:'formSheet', sheetAllowedDetents:'fitToContents', sheetGrabberVisible
  settings.tsx                   formSheet, detents [0.75, 1]
  consent.tsx                    formSheet, fitToContents (re-ask consent when skipped in onboarding)
  summary-edit.tsx               formSheet [0.6, 1] (edit one summary section)
  questionnaire/
    _layout.tsx                  presentation:'modal' (own <Stack>, no tab bar)
    index.tsx                    step router; params: step, from
  (dev)/lab.tsx                  EXISTING spike screens (ModelCheckScreen, CaptureScreen), __DEV__ only, reachable from Settings > Developer
```

Navigation notes:
- Tabs persist their own stacks (default `NativeTabs` behaviour). Tapping the active tab pops to root (system behaviour; do not override).
- Sheets are root-level routes so they can be presented from either tab and never inherit a tab's stack.
- Deep link target for the bedtime notification: `sleepsmooth://start` -> route `/start-sheet?source=notification` (shows the 3 s countdown variant, section 4.4 state C2). Cold start uses the "last notification response" API plus the listener (OVERNIGHT_PLAN ER-5.2); start capture only when `AppState === 'active'`.
- Persisted flags (`onboardingCompletedAt`, consent, sleep hours, ticks) live in the existing local settings file via `expo-file-system` (no database; ER-7). The router gate reads them once at launch behind a splash (`expo-splash-screen` hold) to avoid a flash of the wrong route.

### 1.6 Where the questionnaire lives

`/questionnaire` is a modal stack, one question per page, entered from: onboarding p5 "Answer now", Results ("Add your answers" row / empty state) and Settings ("Your answers"). Pages: (1) units + height + weight, (2) neck (optional, with "I don't know my neck measurement"), (3) snoring, (4) age, (5) sex assigned at birth (+ `NOSAS_QUESTIONS.sexNote`), (6) symptom checklist (6 rows), (7) driving question (`RED_FLAG_QUESTION`, with `RED_FLAG_NOTE`), (8) review (answers recap + citation, "Done"). NoSAS wording is taken only from `NOSAS_QUESTIONS` (keys: `units, height, weight, neck, neckUnknown, snoring, age, sex, sexNote`) and items from `noSas.ts`; never reworded. Validation reuses `FIELD_ERROR_POSITIVE`, `FORM_ERROR_SUMMARY` and the instrument's own range logic (`bmiFrom`, `neckCmFrom`; do not re-implement scoring). The score itself is NOT shown on the questionnaire pages (it appears on Results with `nosasScoreStatement` / `nosasCompleteExplanation`).

---

## 2. Visual system for React Native

Principles: iOS-native first (UIKit materials, large titles, grouped lists), a calm brand layer second (the existing blue accent and warm-paper identity), premium through restraint and precision of borders, not through decoration.

### 2.1 Colour tokens

Single source: `mobile/src/theme/tokens.ts` exporting `lightColors` and `darkColors` and a `useTheme()` hook that reads `useColorScheme()` (and the forced-dark override in the recording state). Tokens are resolved hex/rgba strings (NOT `PlatformColor`) because animated colour interpolation needs concrete values and because the brand values are deliberately slightly different from stock iOS. Each token names the iOS semantic colour it stands in for. Where the OS itself draws chrome (native tab bar, native header, formSheet backgrounds, `Switch`, `ActionSheetIOS`, `DateTimePicker`), iOS semantic colours apply automatically; set sheet `contentStyle.backgroundColor` to `bg` so the sheet body matches.

| Token | iOS semantic it stands in for | Light | Dark |
|---|---|---|---|
| `bg` | systemGroupedBackground | `#F4F3EF` (warm paper, from `--bg #f7f6f2`, deepened so white cards separate) | `#0B0F17` (navy-black, from `--bg #11161f`) |
| `card` | secondarySystemGroupedBackground | `#FFFFFF` | `#151B26` |
| `cardRaised` | tertiarySystemGroupedBackground | `#F8F7F3` | `#1D2532` |
| `fill` | systemFill (row highlight) | `rgba(60,60,67,0.12)` | `rgba(120,130,150,0.24)` |
| `label` | label | `#1A2230` | `#E8ECF2` |
| `labelSecondary` | secondaryLabel | `#4D586A` (7.0:1 on card; brand `--muted`) | `#B0BACB` |
| `labelTertiary` | tertiaryLabel (non-essential text only, never for required info) | `#6B768A` (4.6:1) | `#8592A8` |
| `separator` | separator | `rgba(60,60,67,0.29)` | `rgba(176,186,203,0.22)` |
| `separatorOpaque` | opaqueSeparator (borders on cards) | `#D9DEE6` | `#2E3748` |
| `accent` | tintColor | `#2A5798` (brand `--accent`) | `#8FB6F2` |
| `accentFg` | text on accent fill | `#FFFFFF` | `#10213D` |
| `accentFill` | accent at 12% for tinted buttons | `rgba(42,87,152,0.12)` | `rgba(143,182,242,0.16)` |
| `focus` | focus ring (hardware keyboard / Switch Control) | `#1B4FD1` | `#9CC0FF` |
| `info` bg / fg / border | informational blue | `#E8F0FB` / `#17396B` / `#9DB8E0` | `#1B2A44` / `#CFE0FB` / `#46639A` |
| `discuss` bg / fg / border | amber "worth discussing" | `#FFF3D4` / `#5A3D00` / `#D9A520` | `#3A2C0C` / `#FFE3A3` / `#B48414` |
| `missing` bg / fg / border | neutral grey, absent information | `#EEF1F5` / `#3E4859` / `#8C97A8` | `#232C3B` / `#C9D1DE` / `#66738A` |
| `sample` bg / fg / border | purple, synthetic | `#F1E9FB` / `#47246F` / `#A98BD0` | `#2C2040` / `#E3D3FA` / `#7E5FB0` |
| `model` bg / fg / border | teal, audio observation | `#E3F3F6` / `#0F4553` / `#7FBAC6` | `#123640` / `#C5EBF2` / `#3F8797` |
| `error` bg / fg / border | red, only for real errors and the delete action | `#FDE8E8` / `#7A1D1D` / `#D98A8A` | `#46191C` / `#FFD2D2` / `#A54F55` |
| `destructive` | systemRed text for Delete rows | `#B3261E` | `#FF8A80` |

Rules:
- There is NO success/green token. Do not add one. The checklist tick and onboarding recap use `accent`, not green.
- Text on tinted fills uses the paired `fg` (all pairs derived from `tokens.css`, which already targets 4.5:1).
- Night surface (recording state only, D7): force `darkColors` and `StatusBar style="light"` for the Audio tab content, with `bg` swapped to `#05080D` (near-black, OLED friendly). The native tab bar stays system-controlled.
- Reduced transparency / increased contrast: see 2.5.

### 2.2 Typography (system font, iOS text styles, Dynamic Type)

Font: San Francisco via the default `fontFamily` (omit it). Do not set `letterSpacing` on system-font text: UIKit applies size-specific tracking and optical sizing automatically. Numerals that change (elapsed time, clock times, hours) use `fontVariant: ['tabular-nums']`.

One display exception, used sparingly (carries the existing brand identity, whose headings are serif): `fontFamily: 'ui-serif'` (New York) for ONLY: onboarding page titles, the Results overview headline card, and the clinician summary document title. Verify `ui-serif` resolves on the target RN version; fallback `'Georgia'`. At 28pt and above apply `letterSpacing: -0.3` to the serif only.

| Variant (`<AppText variant>`) | iOS text style | Size / line height (default) | Weight | Use |
|---|---|---|---|---|
| `largeTitle` | Large Title | 34 / 41 | Bold | Native large titles (set by the header, not by us); onboarding hero |
| `title1` | Title 1 | 28 / 34 | Bold | Onboarding page titles (serif), overview headline |
| `title2` | Title 2 | 22 / 28 | Bold | Section hero, sheet titles |
| `title3` | Title 3 | 20 / 25 | Semibold | Card titles in night detail |
| `headline` | Headline | 17 / 22 | Semibold | Row primary text when emphasised, button labels |
| `body` | Body | 17 / 22 | Regular | All paragraph copy |
| `callout` | Callout | 16 / 21 | Regular | Secondary paragraphs |
| `subheadline` | Subheadline | 15 / 20 | Regular | Row secondary text, state lines |
| `footnote` | Footnote | 13 / 18 | Regular | Group footers, citations, limits |
| `caption1` | Caption 1 | 12 / 16 | Regular | Badges (uppercase NOT used; sentence case) |
| `caption2` | Caption 2 | 11 / 13 | Regular | Timeline axis labels only |

Dynamic Type implementation rules (all gated by the XXL check in section 7):
1. `allowFontScaling` stays on. Every `Text` goes through `AppText`, never raw `Text`.
2. Never fix the height of anything containing text. Rows are `minHeight: 44`, grow with content.
3. `maxFontSizeMultiplier`: chrome only (badges, caption2, tab labels are native) = 1.4; `HeroRecordButton` label = 1.6; body-level content is uncapped (it must reflow). Content that would clip at AX sizes must stack vertically (see rule 4).
4. At `PixelRatio.getFontScale() >= 1.5` (about xxxLarge and the AX sizes): horizontal pairs (label + value in `ListRow`) stack vertically; the `PrimaryButton` row of two buttons stacks; the timeline legend wraps; page dots stay 8pt (they are not text).
5. Spacing that sits next to text (card padding, row padding) uses fixed 4pt-grid values; it does not scale. Illustrations scale by `clamp(fontScale, 1, 1.3)` at most so the layout keeps room for text.
6. Verify numbers in `tabular-nums` do not wrap mid-time ("11:42 pm" has a non-breaking space ` ` before "pm").

### 2.3 Spacing and layout (4pt grid)

Scale: `s1=4, s2=8, s3=12, s4=16, s5=20, s6=24, s8=32, s10=40, s12=48`. Screen horizontal margin: 16 (lists/cards), 24 (onboarding). Vertical rhythm between groups: 24 (`s6`), group-header-to-group 8, row padding 12 vertical / 16 horizontal, card padding 16 (20 on hero cards). Minimum touch target 44x44pt (use `hitSlop` for visuals under 44). Use `useSafeAreaInsets()`; ScrollViews on native-stack screens use `contentInsetAdjustmentBehavior="automatic"` so large titles collapse correctly under the native header and content scrolls beneath the tab bar. Content max width on large phones: none (iPhone only; `supportsTablet:false`).

### 2.4 "Different borders", made premium

All rounded views set `borderCurve: 'continuous'` (squircle). Never use `overflow: 'hidden'` on the same view as a shadow (it clips the shadow): use a shadow wrapper and an inner clipping view. Radii follow a concentric rule: inner radius = outer radius - padding.

Radius scale (`radius` tokens):

| Token | Value | Use |
|---|---|---|
| `xs` | 6 | Source badges inner pieces, timeline cells |
| `sm` | 10 | Chips, text fields, small buttons, segmented pills |
| `md` | 14 | Inset grouped lists (the group container), banners |
| `lg` | 20 | Cards (`EvidenceCard`, night card, overview headline card) |
| `xl` | 28 | Hero surfaces (permission-denied card, onboarding tiles), sheet corner radius (`sheetCornerRadius`) |
| `pill` | 999 | Badges, dots, `PrimaryButton` when `shape="capsule"` |
| `hero` | `size/2` | `HeroRecordButton` (true circle; continuous curve is a no-op on a circle) |

Border and elevation levels (the complete set; do not invent others):

| Level | Name | Border | Shadow (iOS) | Use |
|---|---|---|---|---|
| L0 | Flat | none | none | Rows inside an `InsetGroup`; page background |
| L1 | Hairline | `StyleSheet.hairlineWidth` in `separator` (inside lists, inset 16pt from the leading edge, never touching the trailing edge; the last row has none) | none | Row separators in `InsetGroup`; header/tab bar edges (native) |
| L2 | Card | outer: 0.5 in `separatorOpaque` ... PLUS inner highlight: an absolutely positioned, non-interactive overlay `View` (`inset: 0.5`, same radius minus 0.5, `borderWidth: 0.5`, `pointerEvents: 'none'`) coloured `rgba(255,255,255,0.7)` in light and `rgba(255,255,255,0.07)` in dark | light: `shadowColor #1A2230, opacity 0.06, radius 10, offset (0, 2)`; dark: none (the inner highlight carries the depth) | `InsetGroup`, `EvidenceCard`, night card, overview card |
| L3 | Emphasis | as L2 but the OUTER border is 1.0 in the semantic `*-border` colour of the surface (`discuss`, `info`, `sample`, `model`) | as L2 | The conclusion headline card; the sample banner; `EvidenceCard` for `audio-observation` (model border) |
| L4 | Source-coded evidence border (see below) | per source | as L2 | `EvidenceCard` |
| L5 | Floating | outer hairline `separator`, inner highlight as L2 | `shadowColor #000, opacity 0.14, radius 24, offset (0, 10)`; dark: `opacity 0.5` | `HeroRecordButton`, floating pill buttons, `Sheet` custom surfaces |
| L6 | Material edge | top edge hairline only (native bars supply this); custom blur surfaces: 0.5 `rgba(255,255,255,0.35)` top inner border + `separator` outer | none | `GlassTabBar` fallback, any `BlurView` chrome |

L4: source-coded evidence borders. Each source has its own border personality AND a badge AND an icon, so no meaning relies on colour or line style alone:

| Source | Border | Fill | Badge icon (SF Symbol) |
|---|---|---|---|
| User-reported | solid 1.0, `info.border` | `card` | `person.text.rectangle` |
| Audio observation (simple measure or model) | solid 1.0, `model.border` | `card` | `waveform` |
| Missing | dashed 1.0 (`borderStyle: 'dashed'`), `missing.border` | `missing.bg` | `circle.dashed` |
| Sample (any `isSynthetic`) | dashed 1.5, `sample.border`, PLUS a "Sample" badge in the card header (a sample item also keeps its own source badge) | `sample.bg` at 40% over `card` | `testtube.2` |
| App guidance / Not a diagnosis | solid hairline, `separatorOpaque` | `info.bg` | `info.circle` |

Device check required: `borderStyle: 'dashed'` combined with `borderCurve: 'continuous'` and a radius must be viewed on a real device and in the simulator; if the dashed squircle renders as a plain rounded rect or looks uneven, fall back to a 4pt-dash SVG rounded-rect stroke (`react-native-svg`) with the same radius. This is the one border style with rendering risk; everything else is plain View borders.

Materials (via `expo-blur` `BlurView`), used only where the OS does not already provide a material:
- Native tab bar, native header, native formSheet: OS-supplied; do nothing custom.
- `GlassTabBar` fallback: `BlurView tint="systemChromeMaterial" intensity={80}` plus L6 border.
- Overlay chips on the Audio backdrop (for example the schedule pill) and the "Bedside" scrim: `BlurView tint="systemThinMaterial" intensity={60}`.
- Never put a light blurred surface on another blurred surface; never animate blur `intensity` (crossfade the opacity of a static BlurView, per animate-expo).

Liquid Glass (optional, iOS 26+, `expo-glass-effect`): only on FLOATING CONTROLS over a visually rich backdrop. In v1: (a) the idle `HeroRecordButton` lens, (b) the header gear button when using a custom (non-native) header button, (c) the fallback `GlassTabBar` is NOT glass (it is a blur). Gate with `isLiquidGlassAvailable()` (verify the exact API against the installed `expo-glass-effect` version); if unavailable use the L5 solid look. Never on content cards, rows, badges or text surfaces (legibility and the "no stacking" rule). Glass needs something behind it to refract: the Audio tab backdrop is a static two-blob accent gradient (`expo-linear-gradient`, `accent` at 18% and `info.bg` at 40%, 120pt blur by blob size, not animated). Reduced transparency -> glass becomes solid `accent` fill.

### 2.5 Reduced motion, reduced transparency, increased contrast, dark mode

| Setting | How detected | Behaviour |
|---|---|---|
| Reduce Motion | `useReducedMotion()` (Reanimated) | See the "Reduced motion" column in 3.1; fewer and gentler, not zero. Screen transitions are `animation: 'fade'`. |
| Reduce Transparency | `AccessibilityInfo.isReduceTransparencyEnabled()` (+ change event) in `useTheme()` | `BlurView` and glass are replaced by opaque `card`; native bars handle themselves. Borders get +0.25 pt (hairline stays hairline; the 0.5 inner highlight stays). |
| Increased contrast | `AccessibilityInfo.isDarkerSystemColorsEnabled?.()` if present in the installed RN (feature-detect; do not crash) | `separatorOpaque` and all `*.border` colours jump to `label` at 60% opacity; L3/L4 borders become 1.5. |
| Dark mode | `useColorScheme()` | tokens above; shadows off, inner highlight on. |
| Bold Text / Larger Accessibility Sizes | automatic via system font + `AppText` | tested at xxLarge and AX3 (section 7). |

### 2.6 Icons: SF Symbols via `expo-symbols`

`<SymbolView name type="hierarchical" size weight tintColor />`. Verify each name against the SF Symbols app / the installed `expo-symbols` types before use; names marked (v) must be verified on the minimum iOS (use iOS 17 as the floor, so avoid iOS 18+-only symbols). Fallback for an unknown name: render `info.circle` (never a blank).

| Use | Symbol | Notes |
|---|---|---|
| Audio tab | `waveform` | |
| Results tab | `list.bullet.rectangle` (selected: `list.bullet.rectangle.fill`) | |
| Settings button | `gearshape` | header right |
| Share | `square.and.arrow.up` | summary header right |
| Back / disclosure | `chevron.left` / `chevron.right` | native header handles back |
| Onboarding 1 Welcome | `moon.zzz` (hero, 88pt, hierarchical) | |
| Onboarding 2 Privacy | `lock.shield` | |
| Onboarding 3 Microphone | `mic` | |
| Onboarding 4 Sleep hours | `clock` | |
| Onboarding 5 About you | `list.clipboard` (v; fallback `doc.text`) | |
| Onboarding 6 Bystander / set | `person.2` | |
| Hero idle / recording | `moon.zzz` -> `stop.fill` | crossfade |
| Level meter label | `mic.fill` | small |
| Schedule row | `clock`; reminder: `bell` / `bell.slash` | |
| Charging tip | `battery.100.bolt` (v) | |
| Mic denied | `mic.slash` | |
| Interrupted | `exclamationmark.circle` | amber tone, not a warning triangle |
| Red flag banner | `exclamationmark.triangle` | amber tone, wording verbatim from claims |
| Summarizing | `ProgressView` native `ActivityIndicator` | no symbol |
| Source badges | person.text.rectangle / waveform / circle.dashed / testtube.2 / info.circle | see L4 |
| Night state: snore-like pattern observed | `waveform` (amber tint) | NOT a warning icon |
| Night state: few observations / sound levels only | `waveform` (info tint) | NOT a check mark |
| Night state: not assessed | `circle.dashed` (missing tint) | |
| Night state: sample | `testtube.2` | |
| Delete | `trash` (destructive tint) | |
| Questionnaire row chevrons | `chevron.up.chevron.down` | frequency picker rows |
| Checklist tick | `circle` -> `checkmark.circle.fill` tinted `accent` | accent, never green |
| Orange-dot explainer | `circle.fill` tinted `#FF9F0A` (decorative, hidden from a11y) | mimics the system indicator |

---

## 3. Motion spec (Reanimated 4 + Gesture Handler + Expo Haptics)

### 3.0 Gate results (animate-expo step 1-2)

| Candidate | Frequency tier | Decision | Purpose |
|---|---|---|---|
| Tab switch | 100+/day | NO ANIMATION (`animation: 'none'`) | n/a |
| Press feedback | tens/day | yes, under 160 ms | feedback |
| Onboarding paging + parallax | rare | yes | spatial consistency + delight (rare tier) |
| Hero button state change + ring | once/day | yes | state indication |
| Level meter | continuous while recording | yes, functional | state indication ("the mic is hearing sound") |
| Sheets | occasional | native | spatial consistency |
| Night card entrance | first visit per app session only | yes, short | preventing a jarring change |
| Result reveal | occasional | yes, calm | preventing a jarring change |
| Number count-up | would be occasional | NO | see 3.4 |
| Timeline strip draw-in | occasional | NO | decorative, adds nothing |
| Celebration on "You're set" | rare | NO (not a result, but a medical-adjacent product; keep the tone) | n/a |

### 3.1 Spring vocabulary and the motion table

Spring parameters are given as Apple's two designer parameters: damping ratio (zeta, 1.0 = no overshoot) and response (seconds, how quickly it reaches the target). Reanimated 4 accepts these directly: `withSpring(v, { duration: <response in ms>, dampingRatio: <zeta>, reduceMotion: ReduceMotion.System })`. The skill treats `duration` as the perceptual response; confirm by eye on device. Equivalent physics (mass 1) for anyone porting: stiffness `k = (2*pi/response)^2`, damping `c = 4*pi*zeta/response`.

Named springs (use only these):

| Name | Damping ratio | Response | `withSpring` config | Physics eq. (mass 1) | Where |
|---|---|---|---|---|---|
| `springSettle` | 1.0 | 0.40 s | `{ duration: 400, dampingRatio: 1 }` | k 247, c 31.4 | default settle, no overshoot |
| `springSnappy` | 1.0 | 0.25 s | `{ duration: 250, dampingRatio: 1 }` | k 632, c 50.3 | hero press-in/out, small state changes |
| `springLevel` | 1.0 | 0.18 s | `{ duration: 180, dampingRatio: 1 }` | k 1219, c 69.8 | level meter bars |
| `springReveal` | 1.0 | 0.35 s | `{ duration: 350, dampingRatio: 1 }` | k 322, c 35.9 | only if a spring is wanted for the result reveal (timing is the default) |
| `springMomentum` | 0.8 | 0.30 s | `{ duration: 300, dampingRatio: 0.8, velocity }` | k 439, c 33.5 | ONLY for a finger flick. v1 has one use: timeline scrub release (P1). Not used anywhere near results data. |

Easing curves (from animate-expo; no built-in `Easing.in`, `Easing.ease`):

```ts
export const EASE_OUT     = Easing.bezier(0.23, 1, 0.32, 1);     // entering, press release, fades
export const EASE_IN_OUT  = Easing.bezier(0.77, 0, 0.175, 1);    // on-screen movement, layout reflow
export const EASE_SINE    = Easing.inOut(Easing.sin);            // ONLY the breathing ring (a loop, not UI response)
```

The table (every motion in the app; anything not listed does not animate):

| # | Interaction | Tool / thread | Config | Reduced Motion | Reduced Transparency | Haptic |
|---|---|---|---|---|---|---|
| M1 | Press feedback: buttons, capsule buttons, tappable cards | Reanimated CSS transition on `transform` (UI thread), `Pressable onPressIn/Out` sets a boolean | press-in: scale 0.97 in 100 ms `EASE_OUT`; release: scale 1 in 160 ms `EASE_OUT`. Cards: scale 0.98. Min 44pt hit area, `pressRetentionOffset={{top:12,bottom:12,left:12,right:12}}` | Keep scale (it is tiny feedback, not travel); cap at 0.98 | none | none |
| M2 | Press feedback: `ListRow` | `Pressable` style callback, background only | press-in: background `fill` instantly (0 ms); release: 150 ms `EASE_OUT` fade to transparent. No scale inside grouped lists | same | none | none |
| M3 | Onboarding page transition | native `Animated.ScrollView horizontal pagingEnabled` + `useScrollOffset`/scroll handler writing `progress` (page index, float) | paging is the native scroll physics (interruptible, finger-bound). "Continue" calls `scrollTo({x, animated:true})` (native, ~350 ms) | "Continue" uses `animated:false` plus a 200 ms opacity crossfade of the incoming page (`opacity 0 to 1`, `EASE_OUT`). Finger paging stays (user-driven) | none | none |
| M4 | Onboarding illustration parallax | `useAnimatedStyle` from `progress` | 3 layers per page (offsets are px at page width W): halo blob `translateX = -(p - i) * W * 0.30`; symbol tile `translateX = -(p - i) * W * 0.15`; title/body native (1.0x). Plus symbol tile `scale = interpolate(abs(p - i), [0,1], [1, 0.92])` and `opacity = interpolate(abs(p-i), [0,0.6,1], [1,0.6,0])`. No springs (finger-bound 1:1) | no translate/scale; opacity crossfade only | halo blob becomes a static opaque tint | none |
| M5 | Page dots | `useAnimatedStyle` from `progress` | active dot width `interpolate(abs(p - i), [0,1], [20, 8])`, opacity `[1, 0.35]`; height 8, `borderCurve: 'continuous'` | width fixed 8; active = accent fill, inactive = 35% (colour only) | n/a | none |
| M6 | Permission result / state swap inside a page (idle -> allowed / denied) | Layout `entering={FadeIn.duration(200)}` / `exiting={FadeOut.duration(120)}` on the swapped block | 200 ms in, 120 ms out, opacity only | same (opacity only) | n/a | none |
| M7 | Disclosure rows ("What it can do", "About this result and its limits", "About the snore-pattern model") | Layout animation `LinearTransition.duration(250).easing(EASE_IN_OUT)` on the container; chevron rotates `0 to 90 deg` in 200 ms `EASE_OUT` via CSS transition | | instant open/close + 150 ms content opacity | n/a | `selectionAsync` is NOT used (it is not a value change) |
| M8 | Hero: start commit morph (idle -> recording) | shared value `recording` 0 to 1 via `withTiming`; layers are static views whose opacity/scale are derived (no BlurView or colour interpolation animated) | button fill layers crossfade 250 ms `EASE_OUT`; glyph swap `moon.zzz` -> `stop.fill`: outgoing opacity 1 to 0 + scale 1 to 0.9 in 120 ms; incoming opacity 0 to 1 + scale 0.9 to 1 in 200 ms, 80 ms delay (never from scale 0); ring layer opacity 0 to 1 in 400 ms | no scale on glyphs; 200 ms opacity crossfade of all layers | solid fills (no glass) | start: `impactAsync(Medium)` BEFORE capture starts, same frame as the visual (D8) |
| M9 | Hero: press-in / out | `useSharedValue(1)` + `withSpring(0.96, springSnappy)` in `onPressIn`, `withSpring(1, springSnappy)` in `onPressOut` | | scale 0.98 via `withTiming(100)` | none | none |
| M10 | Hero: breathing ring (recording only) | `withRepeat(withSequence(withTiming(1,{duration:4000,easing:EASE_SINE}), withTiming(0,{duration:4000,easing:EASE_SINE})), -1)` on a shared value `breath`; ring `scale = 1 + 0.05*breath`, `opacity = 0.28 - 0.14*breath` | 8 s cycle (0.125 Hz), amplitude 5%, ring is `accent` stroke 2pt; deliberately slower than the ~0.2 Hz band and tiny, because slow large oscillation is a motion-sickness trigger. `cancelAnimation(breath)` when `AppState !== 'active'` (nothing animates on a locked phone and it must not wake anything) | NOT RUN: static ring at opacity 0.22; the state is conveyed by the stop glyph, the word "Recording" and the elapsed time, never by motion alone | ring is a plain stroke | none |
| M11 | Live level meter | `levels = useSharedValue<number[]>(Array(24).fill(0))`; JS `set()`s a new array per capture tick (never `setState`); each bar `useDerivedValue(() => withSpring(levels.get()[i], springLevel))` -> `scaleY` on a fixed-height bar with `transformOrigin: 'bottom'` | 24 bars, 3pt wide, 3pt gap, 40pt tall, min `scaleY` 0.06 (a baseline, never an empty hole). dBFS to 0..1: `clamp((dB + 70) / 60, 0, 1)` (documented display mapping only, NOT a measurement claim). Colour `accent` at 85%, never amber/red regardless of loudness | `withTiming(120, linear)` per bar (no spring), updates still shown (it is data) | n/a | none |
| M12 | Tab switch | native tab bar | `animation: 'none'`; no cross-fade | n/a | native | none (system tab bar gives none) |
| M13 | Sheet presentation | native `formSheet` (UISheetPresentationController) | system spring and detents; do not override. Grabber visible; `sheetCornerRadius` 28; background `bg` | system fade | system | none |
| M14 | Night card entrance stagger | Reanimated CSS animation on mount (plain `ScrollView`, NOT virtualized, max 6 animated cards) | keyframes `from {opacity:0, translateY:8}` to `{opacity:1, translateY:0}`; 300 ms, `EASE_OUT`, `animationFillMode:'backwards'`, delay `index * 40 ms` capped at 5 cards (200 ms). Plays ONCE per app session on first Results mount (a module-level flag), never on tab re-focus (100+/day) | opacity only, 150 ms, no delay | none | none |
| M15 | New night inserted (after a recording ends) | `itemLayoutAnimation={LinearTransition.duration(250).easing(EASE_IN_OUT)}` on the list container | | none (instant) | n/a | none |
| M16 | Result reveal (night detail first open after processing, and the overview after answers change) | Skeleton blocks (static, no shimmer) -> content: sections wrapped in CSS-animated views | content opacity 0 to 1 in 280 ms `EASE_OUT`, `translateY 6 to 0`; section stagger 60 ms for at most 4 sections; the headline/state card first. NO scale, NO spring, NO overshoot, NO delay on the text itself | opacity-only crossfade 150 ms | none | NONE (never) |
| M17 | Banner appear (interrupted, error, red-flag, summary ready) | `entering={FadeInDown.duration(220).easing(EASE_OUT)}` with `translateY` 8 | `exiting={FadeOut.duration(150)}` | opacity only | n/a | none |
| M18 | Checklist tick | `SymbolView` swap, opacity crossfade 120 ms | | instant | n/a | `selectionAsync()` on toggle (user-driven value change) |
| M19 | Timeline scrub (P1, milestone 4) | `Gesture.Pan()` over the strip -> shared `x`; readout position follows 1:1; on release `withSpring(snapX, springMomentum with release velocity)` to the nearest 30-minute tick | | readout jumps without spring | n/a | `selectionAsync()` each time the scrub crosses an hour tick (one per tick, never per frame; fired via `scheduleOnRN` from an `useAnimatedReaction` that fires when the hour index changes) |

Rules that apply to every row:
- Reduce Motion is read with `useReducedMotion()`; each `withSpring/withTiming` also passes `reduceMotion: ReduceMotion.System` as a belt-and-braces default.
- Never `setState` in a gesture or scroll handler; never read `.value` during render; use `.get()/.set()`; functions called from a worklet start with `'worklet'`; schedule back to RN with `scheduleOnRN` from `react-native-worklets` only in `onEnd` or in a threshold reaction.
- Only `transform` and `opacity` are animated. The one permitted layout animation is the disclosure (M7) and list reflow (M15), both via Reanimated layout animations.
- Entering animations are never put on rows of a virtualized list. Night lists are short (cap 30 rendered; "Show earlier nights" row beyond), so a plain `ScrollView` is used.
- Nothing animates while the app is not `active`. Nothing animates a recording-state change on a locked screen (rendering is suspended by iOS anyway).
- Feel is judged on a release build on a real iPhone. Not Expo Go, not the simulator.

### 3.2 Gesture Handler: honest scope

With native tabs, native stack, native sheets and native paging, v1 needs very few custom gestures. `GestureHandlerRootView` wraps the root layout (required, or gestures silently do nothing). Custom gestures in v1: only the P1 timeline scrub (M19). `Pressable` (not `Gesture.Tap`) handles all taps. Do not hand-roll pans for sheets, paging or swipe-back. If scope allows, a second Gesture Handler use is a horizontal swipe on a night card to reveal "Delete" (P1; otherwise Delete lives in night detail).

### 3.3 Sheet specifics

- Start sheet: `sheetAllowedDetents: 'fitToContents'`. Content must be measurable (no flex-grow), so Dynamic Type cannot clip it; at AX sizes the sheet reaches full height and scrolls.
- Settings sheet: detents `[0.75, 1]`, scrollable.
- Dismissal during an active recording is allowed (the recording is independent of the sheet).

### 3.4 Count-up: decision NO

Reasons: (1) CLAUDE.md forbids celebratory motion on results, and a number climbing from 0 is a build-up to a reveal; (2) any frame mid-count shows a wrong value ("0 stretches", "0 snore-like windows"), and a screenshot, screen recording, or a VoiceOver announcement of a transient value is false reassurance; (3) counts here are findings with caveats, not a score being achieved; (4) the frequency tier is "occasional", so there is no delight budget to spend. Exception that is not a count-up: the recording elapsed-time label ticks once per second as a plain clock (tabular nums, no animation).

### 3.5 Haptics (`expo-haptics`), exact events

| Event | Call | Timing | Notes |
|---|---|---|---|
| Start recording commit (user taps "Start recording" in the start sheet, or the 3 s countdown completes) | `Haptics.impactAsync(ImpactFeedbackStyle.Medium)` | same frame as the hero morph begins, BEFORE `capture.start()` is invoked (D8) | one per start |
| Stop recording commit (user confirms "Stop and summarize") | `Haptics.impactAsync(ImpactFeedbackStyle.Light)` | AFTER capture reports `stopped` and the audio session is released | if the session is still recording iOS may suppress it; device test, and if suppressed accept silence (visual still stands alone). Do not set `allowHapticsAndSystemSoundsDuringRecording` just for this. |
| Selection changes: unit toggle (metric/imperial), snoring yes/no, sex, symptom frequency pick (from the action sheet), consent/ack checkbox, sleep-hours is NATIVE picker (it ticks itself; do not double up), checklist tick, timeline hour crossing (P1) | `Haptics.selectionAsync()` | on the value change, same frame | one per change |
| Delete my data confirmed / Delete this night confirmed | `Haptics.impactAsync(ImpactFeedbackStyle.Medium)` | on confirm | destructive |
| Result reveal, night state shown, evidence cards, summary generated, "Summary ready" banner, sample night opened, interruptions, errors, permission outcomes, onboarding page changes | NONE | | never celebratory or alarming |

Rules: never on scroll, never per frame, never the only feedback (every haptic above has a visual), all are no-ops when the system has haptics off. From a worklet call via `scheduleOnRN(Haptics.selectionAsync)`.

---

## 4. Screen-by-screen spec

Copy convention: `key` = existing string in `src/content/claims.ts` (use verbatim, import, do not retype). NEW = new string, listed with a stable id (N-xx) and reviewed in section 8. UI chrome words ("Continue", "Back", "Skip", "Not now", "Done", "Cancel", "Close", "Open Settings") are NEW generic chrome (id N-C), low risk, listed once.

Accessibility conventions for every screen: the large title / page title has `accessibilityRole="header"`; rows are one accessible element with a combined label ("Bedtime, 11:00 pm, button"); decorative symbols `accessible={false}` + `importantForAccessibility="no"`; badges announce their meaning ("Sample data"), never just an icon; the state of every control is in `accessibilityState`; no information by colour alone; page changes announce via `AccessibilityInfo.announceForAccessibility`.

### 4.1 Onboarding shell (`PagedOnboarding`)

```
 +--------------------------------+
 |  <                        Skip |  header row (44pt), absolute, safe-area aware
 |                                |
 |        .------------.          |  halo blob (parallax 0.30x)
 |        |  [symbol]  |          |  symbol tile 160x160, radius xl, parallax 0.15x
 |        '------------'          |
 |                                |
 |   Page title (serif title1)    |
 |   Body copy (body)             |
 |   ...page content...           |
 |                                |
 |            o o O o o o         |  6 dots
 |  [        Continue          ]  |  PrimaryButton, 50pt, capsule, bottom safe area + 16
 +--------------------------------+
```
- Page content scrolls (vertical `ScrollView` inside each page) so AX sizes never clip; the Continue button and dots are pinned outside the scroll area. At fontScale >= 1.5 the illustration tile shrinks to 96pt.
- Hardware/Switch control: Continue is the first focus after the title.
- Loading: none (all local). Error: a page never errors except permission/notification outcomes (below).
- Android hardware back = previous page. Not applicable on iPhone.
- Accessibility: pager `accessibilityRole="adjustable"` is NOT used; instead each page is a labelled region ("Page 2 of 6, Privacy") and the dots view is one element `accessibilityLabel="Page 2 of 6"`.

### 4.2 Onboarding pages

Page 1: Welcome
```
 |        [ moon.zzz tile ]       |
 |  Welcome to SleepSmooth        |  WELCOME_TITLE (serif)
 |  Helps you decide whether to   |  WELCOME_VALUE_PROP
 |  talk to a clinician ...       |
 |  [i Not a diagnosis]           |  badge N-01
 |  +--Please read this first----+|  WELCOME_LIMITS_HEADING, L3 info
 |  | SleepSmooth is informational||  DISCLAIMER_NOT_DIAGNOSIS
 |  | ...                        ||
 |  | - cannot tell you ...      ||  WELCOME_CANNOT[0..3] (all four)
 |  +----------------------------+|
 |  > What it can do              |  disclosure (M7) N-02 -> WELCOME_CAN[0..3]
 |  [         Continue          ] |
```
Components: `SourceBadge kind="not-diagnosis"`, `InsetGroup` (limits), `ListRow` (disclosure). Empty/loading/error: none. A11y: the limits group is read in full before Continue (heading "Please read this first"). Do not truncate `WELCOME_CANNOT`.

Page 2: Privacy and consent
```
 |        [ lock.shield tile ]    |
 |  Your night stays on your phone|  N-03
 |  +----------------------------+|  InsetGroup (rows with leading symbols)
 |  | waveform  Sound is analyzed||  N-04  (GATED, see 8)
 |  |           on this phone ...||
 |  | iphone    Nothing is uploaded N-05  (GATED)
 |  | list...   What is kept ... ||  N-06
 |  | trash     Delete anytime...||  N-07
 |  +----------------------------+|
 |  Recordings are analyzed ...   |  footnote: DISCLAIMER_AUDIO
 |  [  Agree and continue  ]      |  primary: records consent (N-08 shown above it)
 |  [      Not now         ]      |  tertiary: continues, granted:false
```
Consent statement above the primary button (footnote): N-08 "I agree to overnight sound analysis on this phone, as described above." The primary button label ("Agree and continue", N-C) is the affirmative action; there is no pre-ticked box. "Not now" proceeds with `granted:false`; recording is then blocked until consent is given via `/consent` (opened automatically from the Audio tab "Start tonight"). Consent has a version string and ISO timestamp (`OvernightConsent`). A11y: the button's hint reads N-08.

Page 3: Microphone
```
 |        [ mic tile ]            |
 |  Listens only after you tap    |  N-09
 |  Start                         |
 |  Your iPhone shows an orange   |  N-10 (the orange dot, with decorative circle.fill)
 |  dot while the microphone ...  |
 |  [   Allow microphone    ]     |  triggers the system prompt NOW
 |  [        Not now        ]     |
```
Result states (M6 crossfade into the same slot): granted -> row "Microphone is allowed" N-10b with accent `checkmark` (not green) and Continue enabled; denied -> N-11 text, "Open Settings" (Linking.openSettings) and "Continue" still enabled; undetermined restricted (parental) -> N-11. The button is replaced by the result; Continue becomes primary.

Page 4: Sleep hours
```
 |        [ clock tile ]          |
 |  When do you sleep?            |  N-12
 |  Used to time your reminder... |  N-13
 |  +----------------------------+|  InsetGroup
 |  | Bedtime          11:00 pm >||  tap: expands native wheel inline (iOS Settings pattern)
 |  |  [ native time wheel ]     ||  DateTimePicker display="spinner" mode="time"
 |  | Wake time         7:00 am >||
 |  +----------------------------+|
 |  That is 8 h in bed.           |  N-14 (computed, tabular nums)
 |  +----------------------------+|
 |  | Remind me at bedtime   (o) ||  Switch; ON -> notification permission prompt
 |  +----------------------------+|
 |  A notification when it is time|  N-15
 |  to start recording. You tap...|
```
Defaults: 11:00 pm and 7:00 am labelled "Suggested" (caption) until the user changes either (N-C). Time zone captured (`tz`), midnight wrap handled by schedule math (OVERNIGHT_PLAN M4 tests). The native picker ticks haptics itself: no extra haptic. Denied notifications -> N-16 under the switch (switch returns to off). Loading: none. Error: schedule write fails -> inline N-C "Could not save. Try again." with Retry.

Page 5: About you (optional)
```
 |        [ list.clipboard tile ]  |
 |  Add your answers (optional)   |  N-17
 |  A short screening score ...   |  N-18
 |  +----------------------------+|
 |  | NoSAS screening score    > ||  row, caption: NOSAS_SCREENING_NOT_DIAGNOSIS in footnote below
 |  | Symptom checklist        > ||  caption: SYMPTOM_NOT_VALIDATED
 |  +----------------------------+|
 |  NoSAS (Marti-Soler et al., ...|  NOSAS_SCREENING_NOT_DIAGNOSIS
 |  Height, weight, age and sex   |  N-19
 |  stay on this phone.           |
 |  [  Answer now   ]  [ Later ]  |
```
"Answer now" presents `/questionnaire?from=onboarding`; returning from it (done or dismissed) lands back on page 5 with the status row updated ("Added" in accent / "Later"). "Later" scrolls to page 6.

Page 6: Before your first night / You're set
```
 |        [ person.2 tile ]       |
 |  Before your first night       |  N-20
 |  Others sleeping in the room   |  N-21 (bystander notice, wording from OVERNIGHT_PLAN s9)
 |  may be audible. Tell them ... |
 |  [ ] I have told anyone sharing|  N-22 checkbox row (optional here; asked again at each Start)
 |      the room                  |
 |  You're set                    |  N-23 (title3)
 |  +----------------------------+|  recap InsetGroup (accent ticks)
 |  | Sleep hours   11 pm - 7 am ||
 |  | Reminder             On    ||
 |  | Microphone        Allowed  ||  or "Off" with Open Settings
 |  | Your answers       Later   ||
 |  +----------------------------+|
 |  [   Go to Audio tab   ]       |  N-C; sets onboardingCompletedAt, route -> (tabs)/audio
```
Completion has no confetti, no haptic, no spring: a 200 ms fade into the tab bar (`animation:'fade'`).

### 4.3 Audio tab ("Tonight")

Backdrop: `bg` plus the static accent gradient blobs; large title "Tonight" (N-24), header right: gear (opens `/settings`). All states share this skeleton:

```
 +--------------------------------+
 | Tonight                  (gear)|  large title, transparent blurred header
 |                                |
 |  [state banner area]           |  interruption / permission / night-ended cards (M17)
 |                                |
 |            .-------.           |
 |           (  hero   )          |  HeroRecordButton, 176pt circle, L5
 |            '-------'           |
 |         Start tonight          |  headline (label under the button, 1.6x cap)
 |  Tap once when you are in bed. |  N-25 (subheadline, secondary)
 |  Recording continues ...       |
 |                                |
 |  +--------------------------+  |  InsetGroup
 |  | clock  Sleep hours       |  |
 |  |        11:00 pm - 7:00 am>|  |  tap -> /settings (sleep hours section)
 |  | bell   Bedtime reminder  |  |
 |  |        On                >|  |
 |  +--------------------------+  |
 |  +--------------------------+  |
 |  | testtube.2  Look at a    |  |  sample night row (Sample badge)
 |  |   sample night         > |  |
 |  +--------------------------+  |
 |  Audio analysis detects ...    |  DISCLAIMER_AUDIO (footnote), always visible
 | [Audio]   [Results]            |  native tab bar
 +--------------------------------+
```

State A: Idle, no schedule yet. Group shows one row "Set your sleep hours" (N-26) instead of the two rows. Hero enabled.
State A2: Idle, scheduled (above). If the current time is within 60 minutes before bedtime the sub-copy is unchanged; do not add urgency. Charging tip row appears (N-27) when `expo-battery` reports not charging.
State B: Consent not given -> hero tap opens `/consent` sheet (N-08 text + "Agree and continue"), then continues to the start sheet.
State C: Start sheet (`/start-sheet`), formSheet, fit to content:
```
 |  ----  (grabber)               |
 |  Before you start              |  title2 N-28
 |  Others sleeping in the room   |  N-21 (compact one-liner after night 3 per OVERNIGHT_PLAN s9)
 |  may be audible. ...           |
 |  [ ] I have told anyone sharing|  N-22 (required to enable Start)
 |      the room                  |
 |  - Recording uses battery.     |  N-29; shown if not charging / Low Power Mode on / battery < 30%
 |    Plugging in is recommended. |
 |  - An orange dot and ...       |  N-10 (short form)
 |  [    Start recording     ]    |  disabled until the box is ticked (accessibilityState disabled; hint says why)
 |  [        Cancel          ]    |
```
State C2 (opened from the bedtime notification): same sheet plus a 3 s countdown ring on "Start recording" with the visible text "Starting in 3..." (N-30, each second updates) and "Cancel". The checkbox must already be ticked from a previous night OR the countdown does not auto-start (the user must tick, then tap). Auto-start only if the ack was recorded in the last 14 days (N-C default; implementer may tighten). The sheet itself never starts capture off-screen.
State D: Recording ("night surface", D7, dark tokens)
```
 |  Tonight                  (gear)|
 |                                |
 |          ((  (  [] )  ))       |  hero = stop.fill glyph, breathing ring (M10)
 |           Recording            |  headline
 |            0:42:10             |  title2, tabular-nums, accessibilityLabel "Recording for 42 minutes 10 seconds"
 |  You can lock your phone now.  |  N-31 (shown only after M1 gate confirmed lock-screen survival)
 |  Recording continues.          |
 |                                |
 |  mic  Room sound level         |  N-32
 |  |||||||||||||||||||||||||     |  LevelMeter, 24 bars (M11)
 |  Shows that the microphone is  |  N-33
 |  hearing sound. It does not    |
 |  measure your breathing.       |
 |  Recording ends at 7:00 am.    |  N-34
 |  [   Stop recording   ]        |  secondary capsule (not red; stopping is not destructive)
```
Tap hero or "Stop recording" -> native confirmation (`Alert`, 2 actions): title N-35 "Stop recording?", message N-36, actions "Stop and summarize" (default) / "Keep recording". After stop: haptic (3.5), then State H.
Level meter missing data: if no capture level tick arrives for 5 s while status is `recording`, the bars drop to the baseline, opacity 0.4, and the caption becomes N-37 "Not receiving audio" (accessibilityLiveRegion polite). It never shows alarming colours.
VoiceOver: the recording header is a live region `polite`; the meter is ONE element `accessibilityLabel="Room sound level"`, `accessibilityValue={{text: 'low' | 'medium' | 'high'}}` updated only when the category changes (not every tick).

State E: Interrupted
- E1 (app foreground, interruption began, may resume): banner (M17, discuss tint): "Recording interrupted" N-38 + "Trying to continue." N-39; hero keeps recording look but ring static. If resume succeeds the banner fades (200 ms), no haptic.
- E2 (app opened after the capture ended): banner card (discuss tint, `exclamationmark.circle`) title N-40 "Recording ended at {time}"; body = the reason string by `CaptureEndReason`:
  - `scheduled-end`: N-41 "Recording ended at your wake time."
  - `interrupted-call-or-alarm`: N-42 "A call, alarm, or another app interrupted the recording."
  - `os-killed-or-crash-recovered`: N-43 "Recording ended unexpectedly. The part that was recorded was kept."
  - `low-battery`: N-44 "Recording ended because the battery was low."
  - `mic-lost`: N-45 "The microphone became unavailable."
  - `storage-error`: N-46 "Recording ended because the phone could not save the results."
  - `user-stop`: no banner.
  Plus "Part of the night was not captured." N-47 and actions "View this night" (-> night detail) and "Start recording again" (OPEN QUESTION for the capture owner: append to the same night or begin a new one; the plan marks the remaining hours "not captured" and does not define resume; default proposal: begin a new capture appended to the same night with a recorded `CaptureGap`).
State F: Microphone denied
```
 |  +--------------------------+  |  card (missing tint, xl radius, dashed L4)
 |  |  mic.slash               |  |
 |  |  Microphone is off       |  |  N-48
 |  |  SleepSmooth needs the   |  |  N-49
 |  |  microphone to listen... |  |
 |  |  [  Open Settings  ]     |  |  Linking.openSettings()
 |  +--------------------------+  |
 |  sample night row still shown  |
```
The hero is hidden in this state (a disabled giant button would read as broken). Re-check permission on `AppState` -> active so returning from Settings updates the screen without a restart.
State G: Notifications off (not blocking): the reminder row's value reads "Off" with caption N-16; no banner.
State H: Night just ended (summary prompt), shown as a card above the hero:
- H1 processing: N-50 "Summarizing your night" + N-51 "This happens on your phone." with a native `ActivityIndicator` (no determinate percent claim). The hero returns to idle look.
- H2 ready: N-52 "Your night summary is ready" + button "Review last night" (-> `/results/night/[id]`). No celebration, no haptic. Also sets the Results tab badge dot until the night is opened.
- H3 error: N-53 "The summary could not be finished." N-54 "Your answers and settings are not affected." Actions "Try again" / "Delete this night".
- Not assessed outcomes (too short etc.) are NOT errors: they show H2 with N-52 and the night detail explains "Not assessed".

Audio-tab accessibility labels: hero idle `accessibilityLabel="Start tonight"`, `accessibilityHint="Opens a short checklist before recording starts"`; hero recording `accessibilityLabel="Stop recording"`, `accessibilityValue` elapsed; schedule rows `"Sleep hours, 11:00 pm to 7:00 am, button"`.

### 4.4 Results tab

Large title "Results". Header right: gear. Scroll content (all L2 cards / inset groups).

State R0: Empty (no nights, no answers). Content-unavailable layout (centred, not a card):
```
 |        [ list.bullet.rectangle ]|  80pt symbol, labelTertiary
 |  Nothing to review yet         |  RESULTS_EMPTY_TITLE
 |  You have not answered the     |  RESULTS_EMPTY_MESSAGE (states it is not reassuring)
 |  questions or added a ...      |
 |  [  Go to the questions  ]     |  RESULTS_EMPTY_ACTION -> /questionnaire?from=results
 |  [ Look at a sample night ]    |  N-55 (secondary) -> /results/night/sample
```
State R1: Overview + nights (normal). Order top to bottom:
```
 | Results                  (gear)|
 | +--[! Red-flag banner]-------+ |  only if a red flag: RED_FLAG_WORDING + RED_FLAG_NOTE (verbatim, amber)
 | +--Overview (L3 by conclusion)+ |
 | | Based on what you shared,  | |  HEADLINE_DISCUSS / HEADLINE_INCONCLUSIVE / HEADLINE_NOT_ENOUGH (serif title1)
 | | this is worth discussing   | |  amber for discuss, info blue for inconclusive, grey for not-enough
 | | with a clinician.          | |
 | | SleepSmooth is informational| |  DISCLAIMER_NOT_DIAGNOSIS
 | | and ...                    | |
 | +----------------------------+ |
 | NIGHTS                         |  group header (footnote, secondary, uppercase NOT used)
 | +----------------------------+ |
 | | Tue, Oct 6        waveform | |  night card/row (see below)
 | | Recorded 7 h 12 min        | |
 | | A snore-like pattern was...| |
 | |----------------------------| |
 | | Mon, Oct 5     circle.dashed| |
 | | Not assessed ...           | |
 | +----------------------------+ |
 | SAMPLE                         |
 | | [Sample] Sample night    > | |  dashed-purple border; SAMPLE_AUDIO_LABEL as subtitle
 | YOUR ANSWERS                   |
 | | NoSAS screening score    > | |  value: band string (NOSAS_BAND_*), or "Not answered"
 | | Symptom checklist        > | |  value: "Answered" / "Not answered"
 | FOR YOUR CLINICIAN             |
 | | Summary to discuss       > | |  -> /results/summary
 | | Next steps               > | |  -> /results/next-steps
 | Limits that apply to everything|  footnote group: DISCLAIMER_CANNOT_RULE_OUT, DISCLAIMER_SEEK_CARE, NOTE_NO_UNIFIED_SCORE
```
Overview headline source: `evaluate(buildRulesInput(...))` using the multi-night aggregate audio state (`aggregateNights`, OVERNIGHT_PLAN 8.4). Sample nights NEVER feed the aggregate (invariant 8.5.4). Multi-night note under the Nights group when >= 2 assessed nights: a neutral row "Observed on {k} of {m} assessed nights" (N-56; never "recurring" as a threshold claim unless k >= 2, as per the plan's descriptive note) and varied nights show a neutral "Varied" row (N-57).

Night row content by `NightAudioState` (title = date `EEE, MMM d`; subtitle = "Recorded {h} h {m} min" N-58; state line + tint):

| NightAudioState | State line (key) | Icon + tint | Border |
|---|---|---|---|
| `snore-like-observed` | `AUDIO_DETAIL.usableSnoreLikeObserved` | `waveform`, discuss | L3 discuss |
| `few-observations` | `AUDIO_DETAIL.usableFewObservations` + second line `DISCLAIMER_CANNOT_RULE_OUT` | `waveform`, info | L2 |
| `not-assessed` | N-59 "Not assessed" + reason from `notAssessedReasons` | `circle.dashed`, missing | L4 missing (dashed) |
| `model-not-applicable` | `MODEL_NOT_APPLICABLE` | `circle.dashed`, missing | dashed |
| `no-model` | `AUDIO_DETAIL.noModel` (+ `NO_MODEL_LINE`) | `waveform`, info | L2 |
| `not-recorded` | no row | | |
Never green; "few observations" is info blue and carries the cannot-rule-out sentence on the row itself.

Loading (first render): skeleton rows (static blocks, `fill` colour, no shimmer). Error: `ERROR_BOUNDARY_TITLE` / `ERROR_BOUNDARY_MESSAGE` / `ERROR_BOUNDARY_ACTION` in an error-tint card (the only place error red is used besides Delete).
Accessibility: each night row is one element: "Tuesday October 6, recorded 7 hours 12 minutes, a snore-like pattern was observed in part of the recording, not a diagnosis, button". Sample row announces "Sample data" first.

State R2: Sample night: appears as the dashed-purple SAMPLE row (always listed, also when real nights exist). Opening it shows the standard night detail with a top banner (sample tint, L4 sample): `SAMPLE_AUDIO_LABEL`, then `SAMPLE_AUDIO_NOT_USED`, plus `SYNTHETIC_LABEL` badge on every card; the header shows "Sample" badge in the title area (N-60 nav subtitle). Sample content is never used in the overview.
State R3: Real night, assessed (above). State R4: Not assessed (above, detail explains each reason). State R5: Multi-night list (above).

### 4.5 Night detail (`/results/night/[id]`)

```
 | <  Tue, Oct 6          (share?)|  native header, title = date (no large title)
 | [Sample banner if sample]       |
 | +--State card (L3 by state)---+ |
 | | waveform  A snore-like      | |  state line (key above) + SourceBadge(s)
 | | pattern was observed in part| |
 | | of the recording.           | |
 | | Snoring alone does not mean | |  NOTE_SNORE_LIKE (only for snore-like-observed)
 | | sleep apnea, but ...        | |
 | +-----------------------------+ |
 | Estimated sleep window          |  group header
 | +-----------------------------+ |
 | | 11:42 pm to 6:20 am         | |  title3 tabular; N-61 (unvalidated + "cannot tell sleep from lying quietly awake")
 | | [###==//==..........###]    | |  Timeline strip: solid / hatched / outlined, 24pt tall, radius xs cells
 | | solid Estimated asleep       | |  legend N-62 (pattern swatches, not just colour)
 | | hatched Uncertain            | |
 | | outlined Awake or not captured| |
 | | Signals used: schedule, app  | |  N-63
 | | state, audio level (3 of 5). | |
 | +-----------------------------+ |
 | User-reported                   |  section header (SourceBadge user-reported)
 |   EvidenceCard x n              |  NoSAS card, Symptom checklist card (engine items, source user-reported)
 | Audio observation               |  section header (SourceBadge audio-observation; +Sample if synthetic)
 |   EvidenceCard                  |  this night: AUDIO_DETAIL.*, snoreWindowsLine, tooQuietLine, SNORE_NOT_APNEA_LINE
 |   Sensitivity row               |  N-64 (plan 7.3: counted windows with likely-asleep only vs plus uncertain)
 | Missing information             |  section header (SourceBadge missing, dashed cards)
 |   EvidenceCard (missing) x n    |  engine `missing` + night `notAssessedReasons` (MISSING_* keys)
 | > About this result and its limits  RESULTS_DETAILS_HEADING (disclosure), content: DISCLAIMER_AUDIO,
 |                                    DISCLAIMER_CANNOT_RULE_OUT, NOTE_AUDIO_NEVER_DOWNGRADES, NOTE_NO_UNIFIED_SCORE
 | > About the snore-pattern model    MODEL_CARD_HEADING (-> /results/model-card)  + modelVersionLine
 | [   Create my summary   ]       |  PrimaryButton -> /results/summary
 | | Delete this night (destructive row) |  N-65, confirm N-66
```
Notes:
- No conclusion headline on this screen (it would conflict with the multi-night overview). A top link row "See the overall view" N-67 goes back to Overview.
- Not-assessed night: the state card is missing-tint with dashed L4, `MISSING_AUDIO_UNUSABLE`, the specific reasons list ("recording too short", etc., from `notAssessedReasons`), and `NEXT_STEPS_NOT_REASSURANCE`-style line `DISCLAIMER_CANNOT_RULE_OUT`. The timeline strip is still shown if an estimate exists, otherwise replaced by "No sleep-window estimate for this night." N-68.
- `snoreWindowsLine`, `tooQuietLine`, `SNORE_NONE_ASSESSABLE_LINE` render exactly as in the web results; no percentages, no bars of "amount".
- Timeline strip a11y: a single element; `accessibilityLabel` = "Estimated sleep window, 11:42 pm to 6:20 am. Estimated asleep 5 hours 10 minutes, uncertain 1 hour, awake or not captured 1 hour 8 minutes." (N-69, values computed). The scrub gesture (M19, P1) has an `accessibilityActions` alternative (increment/decrement by 30 minutes announcing the state at that time).
- Loading: skeleton then M16 reveal. Error: error card + "Try again" / "Delete this night".
- Reveal: M16 (calm, no bounce, no count-up, no haptic).

### 4.6 Clinician summary (`/results/summary`)

```
 | <  Summary          (share) |  native header; share = square.and.arrow.up
 | SleepSmooth: summary to discuss with a clinician   (serif title1, from SUMMARY_PRINT_TITLE)
 | Not a diagnosis. Prepared by an informational prototype, not by a clinician.   (SUMMARY_PRINT_NOT_DIAGNOSIS, info tint card L2)
 | This summary was generated ... (SUMMARY_GENERATED_NOTE)
 | WHAT I REPORTED                 |  SUMMARY_SECTION_TITLES.reported   (InsetGroup, text; "Edit" row)
 | SCREENING SCORE (NOSAS)         |  .screening  (+ Not provided = SUMMARY_NOT_PROVIDED)
 | RECORDING OBSERVATIONS          |  .audio  (overnight section from src/night/report.ts: per-night table = date, recorded hours, estimated window, assessed hours, state)
 | WHAT THIS APP CAN AND CANNOT SAY|  .guidance
 | QUESTIONS FOR MY CLINICIAN      |  .questions  (CLINICIAN_QUESTIONS x4)
 | LIMITATIONS                     |  .limits
 | [Sources: NOSAS_CITATION]       |  footnote (SUMMARY_PRINT_SOURCES)
```
Edit: each section has an "Edit" row opening `/summary-edit` (formSheet, `TextInput multiline`, keyboard avoiding via `react-native-keyboard-controller` only if a keyboard-tracking toolbar is added; otherwise `KeyboardAvoidingView` is acceptable), edited sections get the `SUMMARY_EDITED_MARKER` badge; regenerate prompt uses `SUMMARY_REGENERATE_CONFIRM` in an `Alert` (two buttons + Cancel, labels N-C).
Share: tapping share shows an `Alert` N-70 "Share this summary?" / N-71 "It includes the answers and observations shown here. It does not include any audio." / "Share" + "Cancel". Then `Share.share({ message })` (plain text; the OS share sheet). No automatic export. Sample nights are excluded from the shared text or clearly labelled "Sample data" if included. Empty state (nothing to summarise): `RESULTS_EMPTY_*`. Loading: skeleton. Error: error card.
A11y: each section is a heading + paragraphs; text is selectable (`selectable`) for copying.

### 4.7 Next steps (`/results/next-steps`)

Intro `NEXT_STEPS_INTRO`; groups from `NEXT_STEPS_GROUPS` (Who to contact / What to bring / What to ask) as `InsetGroup`s with tick rows (M18, `selectionAsync`); progress footer `NEXT_STEPS_PROGRESS(done, total)` (a plain text label; no ring, no percent animation); `NEXT_STEPS_DROWSY_HEADING` + `RED_FLAG_NOTE` (verbatim) when the red flag is present; closing `NEXT_STEPS_NOT_REASSURANCE`; storage note N-72 (phone, not browser tab). Row a11y: `accessibilityRole="checkbox"`, `accessibilityState={{checked}}`.

### 4.8 Settings sheet (`/settings`)

```
 |  ----                          |
 |  Settings              Close   |
 |  SLEEP HOURS                   |
 |  Bedtime / Wake time / Remind  |  same rows as onboarding p4
 |  YOUR ANSWERS                  |
 |  NoSAS and symptoms          > |  -> /questionnaire?from=settings
 |  PRIVACY                       |
 |  Overnight sound consent  On   |  N-73; "Withdraw consent" destructive row N-74 (stops capture, offers deletion)
 |  Delete my data                |  DELETE_DATA_LABEL (destructive text, trash)
 |  ABOUT                         |
 |  Sources and claims          > |  SOURCES_TITLE
 |  About the snore-pattern model>|  MODEL_CARD_TITLE
 |  Prototype for a hackathon...  |  FOOTER_TEXT
 |  Developer (only __DEV__)    > |  /(dev)/lab (existing spike screens)
```
Delete flow: `Alert` N-36/N-75 with "Delete" (destructive) / "Cancel"; on confirm: `impactAsync(Medium)`, delete nights, epochs, features, manifest, answers, settings, consent, cancel scheduled notifications (OVERNIGHT_PLAN s9 / invariant tests), then N-37 inline banner and route to onboarding. Loading: `ActivityIndicator` replacing the row while deleting. Error: N-76 "Some data could not be deleted. Try again." with Retry.

### 4.9 Questionnaire modal (`/questionnaire`)

```
 | Cancel          Question 3 of 8|  native modal header: left Cancel, center N-C progress
 | Do you snore?                   |  NOSAS_QUESTIONS.snoring (title1, not serif)
 | +----------------------------+ |
 | | Yes                      o | |  radio rows (InsetGroup), selection haptic
 | | No                       o | |
 | +----------------------------+ |
 | [        Continue         ]    |  disabled until answered; neck page: Continue always enabled (optional)
```
- Page 1: units segmented (`@react-native-segmented-control/segmented-control`, native `UISegmentedControl`; labels "Metric (cm, kg)" / "Imperial (in, lb)" as in the web UI) then `height`, `weight` number fields (`keyboardType="decimal-pad"`, `returnKeyType="next"`, 16pt+ font). Unit suffix switches inches/cm and lb/kg exactly as the web (`inches`/`cm`).
- Page 2: `NOSAS_QUESTIONS.neck` + `NOSAS_QUESTIONS.neckUnknown` switch (clears the field, sets `neckUnknown`).
- Page 5: `NOSAS_QUESTIONS.sex` rows "Male" / "Female" (as web) + `NOSAS_QUESTIONS.sexNote` footnote.
- Page 6: symptom checklist: for each `SYMPTOM_ITEMS` entry, one `ListRow` (text wraps), trailing value (`FREQUENCY_LABELS`) and `chevron.up.chevron.down`; tapping opens `ActionSheetIOS` with `FREQUENCY_LABELS` (Never / Sometimes / Often / Nearly every night) + Cancel; selection haptic on pick. Rationale: a 4-segment control truncates "Nearly every night" at normal widths and fails at XXL. Footer: `SYMPTOM_NOT_VALIDATED` badge + `SYMPTOM_CHECKLIST_NOTE` + `SYMPTOM_RULE_NOTE`. Row labels contain "pauses" only because the item text does (allowlisted).
- Page 7: `RED_FLAG_QUESTION` Yes/No rows and `RED_FLAG_NOTE` footnote.
- Page 8 review: recap rows with "Not answered" for blanks, citation `NOSAS_CITATION` (footnote), `NOSAS_SCREENING_NOT_DIAGNOSIS`, `NOSAS_ITEM_SKIPPED_NOTE`. "Done" saves and dismisses; no score and no band shown here.
- Dismiss with unsaved answers: `Alert` N-77 "Discard your answers?" with "Discard" / "Keep editing". Back swipe inside the modal stack goes to the previous question (native).
- Validation: inline under the field in `error.fg` with `FIELD_ERROR_POSITIVE` and an error summary banner `FORM_ERROR_SUMMARY` on Continue; error text is announced (`accessibilityLiveRegion="polite"`, `announceForAccessibility`). No error haptic.

### 4.10 Model card and Sources screens

Reuse existing strings: `MODEL_CARD_TITLE, MODEL_CARD_INTENDED, MODEL_CARD_NOT_FOR, MODEL_CARD_METRICS_INTRO, MODEL_CARD_METRIC_LABELS, MODEL_CARD_PHONE_WEAKNESS, MODEL_CARD_OTHER_LIMITS, MODEL_CARD_LICENSE`; `SOURCES_TITLE, SOURCES_INTRO, NOSAS_CITATION, NOSAS_URLS`. Plain `InsetGroup` text pages, no motion.

---

## 5. Component inventory

All in `mobile/src/ui/`. Props are TypeScript; every component supports `testID`, respects Reduce Motion / Reduce Transparency / Dynamic Type, and is light/dark aware via `useTheme()`.

```ts
// theme
type Theme = { colors: Colors; radius: Radius; space: Space; scheme: 'light'|'dark'; reduceMotion: boolean; reduceTransparency: boolean; increasedContrast: boolean };
const useTheme: () => Theme;
const withNightSurface: (t: Theme) => Theme;           // forces dark tokens + bg #05080D (recording state only)

// text
<AppText variant: 'largeTitle'|'title1'|'title2'|'title3'|'headline'|'body'|'callout'|'subheadline'|'footnote'|'caption1'|'caption2'
         tone?: 'label'|'secondary'|'tertiary'|'accent'|'destructive'|'onTint'   serif?: boolean   tabular?: boolean
         maxFontSizeMultiplier?: number   selectable?: boolean />

// layout + borders
<Surface level: 'L2'|'L3'|'L5'  tone?: 'default'|'info'|'discuss'|'missing'|'sample'|'model'|'error'  radius?: keyof Radius
         source?: 'user-reported'|'audio-observation'|'missing'|'sample'|'app-guidance'   // selects the L4 border
         padding?: number  children />      // owns shadow wrapper + clipping view + 0.5pt inner highlight overlay
<InsetGroup header?: string  footer?: string|ReactNode  children: ListRow[]  tone?: Tone />   // radius md, hairline separators inset 16
<ListRow title: string  subtitle?: string  value?: string  leading?: SymbolName|ReactNode  trailing?: 'chevron'|'chevronUpDown'|ReactNode
         onPress?: ()=>void  destructive?: boolean  selected?: boolean  accessibilityLabel?: string  stackAtLargeText?: boolean />   // minHeight 44, M2 press

// controls
<PrimaryButton label: string  onPress  variant?: 'filled'|'tinted'|'plain'|'destructive'  shape?: 'capsule'|'rounded'
               size?: 'large'|'medium'  loading?: boolean  disabled?: boolean  disabledReason?: string  haptic?: 'none'  />   // M1; large = 50pt
<HeroRecordButton state: 'idle'|'recording'|'starting'|'stopping'|'disabled'
                  onPress: ()=>void  elapsedSec?: number  size?: number /*176*/  />   // M8-M10; glass lens on iOS 26 else solid; label rendered by parent
<LevelMeter levels: SharedValue<number[]>  /* 24 values 0..1 */  active: boolean  stale: boolean  />   // M11; a11y value text
<SourceBadge kind: 'user-reported'|'audio-observation'|'missing'|'sample'|'not-diagnosis'|'app-guidance'  size?: 'regular'|'compact' />
        // label + SF Symbol + L1/L4-tinted capsule; 'sample' -> "Sample data"; 'not-diagnosis' -> N-01 (home: claims.ts)
<EvidenceCard item: EvidenceItem  hideLimitations?: readonly string[]  expanded?: boolean />   // mirrors web EvidenceCard (badge row, state text, label, detail, limits list, citation); source-coded L4 border; isSynthetic adds sample badge
<StateCard tone: Tone  icon: SymbolName  title: string  body?: string  actions?: {label:string; onPress:()=>void}[]  />   // overview, interruption, permission, night-ended, errors; M17 entrance
<NightRow night: NightListItem  onPress  />    // title date, subtitle hours, state line + tint per 4.4
<Timeline epochs: {state: EpochState}[]  windowLabel: string  summaryLabel: string  scrubbable?: boolean />   // solid/hatched/outlined via SVG pattern, legend, a11y summary
<Disclosure title: string  children  defaultOpen?: boolean />   // M7
<Banner tone  icon  children  />   // sample/red-flag/disclaimer strips

// flow
<PagedOnboarding pages: OnboardingPage[]  onFinish  />        // M3-M5; owns progress SharedValue; exposes scrollToPage
type OnboardingPage = { key: string; symbol: SymbolName; title: string; render: (ctx: {progress: SharedValue<number>; index: number; next(): void; back(): void; skipToEnd(): void}) => ReactNode; skippable: boolean };
<Sheet /> -> NOT a component: helper `sheetOptions({ detents: 'fitToContents' | number[]; grabber?: boolean })` returning native stack options (presentation 'formSheet', sheetAllowedDetents, sheetGrabberVisible, sheetCornerRadius 28, contentStyle) + <SheetHeader title onClose /> and <SheetScroll /> (ScrollView with contentInsetAdjustmentBehavior)
<GlassTabBar {...BottomTabBarProps} />   // FALLBACK ONLY (D1): BlurView systemChromeMaterial + L6 edge, 49pt + safe-area, SymbolView icons, press M2, no slide, reduced-transparency solid
<GlassIconButton symbol onPress label />  // gear etc.; glass on iOS 26 else blurred circle
<ScreenBackdrop variant: 'audio'|'plain' />   // static gradient blobs (audio)
<Skeleton lines?: number height?: number />   // static blocks, no shimmer
<FieldRow, SegmentedChoice (native), RadioRows />   // questionnaire inputs
// hooks
useCapture(): { status: 'idle'|'starting'|'recording'|'interrupted'|'stopping'|'stopped'|'error'; startedAt?: number; endReason?: CaptureEndReason; levels: SharedValue<number[]>; lastTickAt: SharedValue<number>; start(): Promise<void>; stop(): Promise<void> }  // wraps the M1 capture controller; UI never touches the audio lib directly
usePermissions(): { mic: 'undetermined'|'granted'|'denied'; notifications: ...; request...; refreshOnForeground }
```

Boundary rule: no scoring, thresholds, state machines or evidence logic in UI components (ER-7). Components receive `EvidenceItem`, `NightSummary`, `NightAudioState` etc. from `@core/*` and render them.

---

## 6. Library list (all via `npx expo install` so SDK 57 resolves the right versions; pin in `package.json` after install)

| Package | Purpose | Notes |
|---|---|---|
| `expo-router` | file-based routing, native stack, `NativeTabs` (`expo-router/unstable-native-tabs`), sheets | Brings required peers: `react-native-screens`, `react-native-safe-area-context`, `expo-linking`, `expo-constants`, `expo-splash-screen`. Entry-point change required (see 6.1). `NativeTabs` is an UNSTABLE API: verify it exists in the installed Router; fallback is `Tabs` + `GlassTabBar`. |
| `react-native-reanimated` (4.x) + `react-native-worklets` | all motion | See 6.1 worklets conflict. |
| `react-native-gesture-handler` | root view + timeline scrub (P1) | `GestureHandlerRootView` at root. |
| `expo-haptics` | haptics (3.5) | |
| `expo-symbols` | SF Symbols | iOS only; Android fallback not needed (iOS-first), render nothing/fallback glyph on Android. |
| `expo-blur` | materials where the OS provides none | never animate `intensity`. |
| `expo-glass-effect` (optional) | Liquid Glass on iOS 26 | Requires building with Xcode 26 and an iOS 26 runtime to see glass; always feature-detect (`isLiquidGlassAvailable`); fallback solid. |
| `expo-linear-gradient` | static backdrop blobs | |
| `@react-native-community/datetimepicker` | native iOS time wheel | `display="spinner" mode="time"`. Native module: batch with the rebuild. |
| `@react-native-segmented-control/segmented-control` | native `UISegmentedControl` (units) | Native module. |
| `react-native-svg` | timeline hatching pattern; dashed-border fallback; onboarding halo | Native module. |
| `expo-notifications` | bedtime reminder (already planned in OVERNIGHT_PLAN M4) | |
| `expo-battery` | charging / low-power tip | already planned. |
| `expo-splash-screen` | hold splash until route gate resolves | |
| `react-native-keyboard-controller` | only if keyboard-tracking UI is added (summary edit) | optional, P1. |
| Already present in the shell | `expo`, `expo-file-system`, `expo-asset`, `expo-dev-client`, `expo-build-properties`, `react-native-audio-api` ^0.13.6, `react-native-worklets` 0.10.1 | do not remove or reconfigure the `react-native-audio-api` plugin block (UIBackgroundModes `audio`, mic string) in `app.json`. |

### 6.1 Conflicts and cautions with the audio library choice (OVERNIGHT_PLAN ER-5.3 / ER-5.4)

1. `react-native-worklets` is ALREADY pinned at `0.10.1` in `mobile/package.json` as the peer of `react-native-audio-api` (which asks `>= 0.7.0`). Reanimated 4.x requires a specific worklets range. Install with `npx expo install react-native-reanimated react-native-worklets`, and let Expo choose the pair for SDK 57; then run `npx expo install --check`. If the resolved worklets version differs from 0.10.1, re-verify that `react-native-audio-api` still resolves and BUILDS (it consumes worklets natively; a pod/Gradle mismatch is a hard compile error, not a runtime one). Exactly ONE worklets version must exist in `node_modules`. If Reanimated and `react-native-audio-api` cannot agree on worklets, escalate immediately (fallback per plan: switch capture library to the `expo-audio` stream rather than downgrade animation).
2. Do not add a second audio library or a second background mode. UI libraries above add no background modes.
3. The night DSP runs on the RN JS thread (Hermes). That is good for motion (Reanimated animates on the UI thread and keeps running when JS is busy) and bad for anything that `setState`s: a busy JS thread will make React state updates lag. Therefore the level meter, breathing ring and page progress must be shared-value driven, never state driven. The 1 Hz elapsed-time label is the only state tick on the Audio screen while recording.
4. Level-meter data rate depends on the capture buffer size. The plan uses 1 s buffers (`bufferLength`), which gives a 1 Hz meter. That is acceptable (bars spring between ticks, `springLevel`) but the capture owner should expose a `levels` update at >= 4 Hz if cheap (the pipeline already computes 100 ms level blocks, `LEVEL_BLOCK_SAMPLES`). Do not request smaller `bufferLength` solely for the meter without the owner's consent; it changes JS callback frequency and battery.
5. iOS suppresses haptics and system sounds while a recording audio session is active (D8). Sequence the start/stop haptics around session activation/deactivation, and re-verify on device.
6. Required native rebuild: expo-router (screens, safe-area-context), reanimated/worklets, blur, symbols, haptics, glass-effect, linear-gradient, svg, datetimepicker, segmented control all change the native project. Install them in ONE batch and do one `expo prebuild` + dev-client rebuild, then re-run the M1 locked-screen audio check to confirm `UIBackgroundModes: audio` survived prebuild (`mobile/ios` is already generated; regenerating must not drop the plugin's changes).
7. Shared-core imports keep going through the existing `@core/*` Metro alias. `babel.config.js` already sets `unstable_transformImportMeta`; keep it. `metro.config.js` sets `nodeModulesPaths` to `mobile/node_modules` only and `disableHierarchicalLookup`; expo-router's `app` directory discovery and its `require.context` need no change, but verify that the router resolves `expo-router/entry` through this restricted lookup.

---

## 7. Implementation order (4 milestones, each demoable on a real iPhone, release build for feel checks)

Global acceptance checks applied at the end of EVERY milestone (do not defer):
- Reduced-motion check: Settings > Accessibility > Motion > Reduce Motion ON. Walk every screen built so far: no translation/scale/parallax/ring pulse; fades only; the app is fully usable. Toggle OFF and compare.
- Reduce Transparency ON: no blurred or glass surface remains; all text legible.
- Dynamic Type at XXL: Settings > Display & Brightness > Text Size (and Accessibility > Larger Text at AX3 for onboarding and the Audio tab). No clipped text, no overlapping controls, no horizontal scroll; rows grow; the hero label reflows; sheets scroll.
- Light and Dark: both look intentional; no hard-coded colours.
- VoiceOver: every interactive element has a label; the order is logical; sample/missing/not-a-diagnosis meaning is spoken.
- Forbidden-phrase scan (extend `src/content/forbiddenPhrases.test.ts` ROOT to include `mobile/src` and `mobile/app`, plus the night additions "sleep detected", "you slept", "sleep score/quality/efficiency", "stages"): zero hits.
- No raw Text, no `setState` in a gesture/scroll handler, no `runOnJS`, no `PanResponder`, no core `Animated`.

### Milestone 1: Native shell and design system (demo: "it feels like iOS")
Build: Expo Router migration (entry point, `app/` tree with placeholder screens, onboarding gate), `useTheme` + tokens, `AppText`, `Surface`, `InsetGroup`, `ListRow`, `PrimaryButton`, `SourceBadge`, `Disclosure`, `Skeleton`, `NativeTabs` with Audio and Results (large titles, blurred headers), gear -> `/settings` formSheet (static rows), the existing spike screens moved to `(dev)/lab`.
Demo: switch tabs (no animation), pull a large title, open and drag the settings sheet, light/dark, every border level on one dev "gallery" screen (`(dev)/gallery`).
Acceptance: global checks; every border level L0-L6 visible on the gallery; native tab bar shows Liquid Glass on iOS 26 or blur earlier; `npm test` (root) unchanged; the M1 capture spike still runs from `(dev)/lab` and still records with the screen locked (regression gate).

### Milestone 2: Onboarding and the Audio tab (demo: first run to a recording)
Build: `PagedOnboarding` (6 pages, parallax, dots), permission flows (mic, notifications), sleep-hours pickers, consent record, `/consent`, `/start-sheet` (+ countdown variant), `HeroRecordButton`, `LevelMeter`, `useCapture` wiring to the capture controller, all Audio states A-H (interruption, denied, summary-prompt) with the capture controller's real events; a `__DEV__` "Simulated level" source clearly labelled "Simulated input" for the simulator only.
Demo: fresh install -> onboarding -> Start tonight -> lock the phone -> unlock -> meter and ring alive -> Stop -> "Summarizing" -> "Summary ready".
Acceptance: global checks; breathing ring pauses (static) under Reduce Motion and when the app is not active; start/stop haptics fire as specified or are silent without error (record which on the device); denied-mic state recovers when returning from Settings; no `setState` per level tick (verify with the React DevTools profiler: Audio screen re-renders at most once per second while recording); skip and back work on every allowed page.

### Milestone 3: Results, questionnaire, evidence (demo: "what the night does and does not show")
Build: Results overview, nights list, sample night (labelled), night detail with Timeline, `EvidenceCard`, `StateCard`, sections User-reported / Audio observation / Missing, disclosures, model card and sources pages, `/questionnaire` modal (8 pages) wired to `noSas.ts` and `symptomChecklist.ts`, delete-night, R0-R5 states, M14-M16 entrances.
Demo: empty Results -> answer questionnaire -> sample night detail (all sample labels) -> a real short recording shows "Not assessed" honestly -> a quiet-room night shows "few observations" with the cannot-rule-out text and NO green/check anywhere.
Acceptance: global checks; wording matches claims.ts character for character for every keyed string; every `NightAudioState` renders with the table in 4.4; the overview never uses a sample night; red-flag banner verbatim; contrast >= 4.5:1 for all text pairs (spot-check amber and purple in dark); dashed border device check (2.4) done and the SVG fallback applied if needed.

### Milestone 4: Summary, sharing, polish (demo: the full 3-minute story)
Build: clinician summary (read + edit sheets + regenerate prompt), share with confirmation, next steps checklist, Settings completion (consent withdrawal, delete my data with full cleanup), optional Liquid Glass lens on the hero + gear, optional timeline scrub (M19), Results tab badge, copy and a11y pass, release-build feel pass, screen recording backup.
Demo: Results -> night -> summary -> share sheet -> next steps -> Delete my data (confirm) -> back to onboarding.
Acceptance: global checks on a release build on the slowest supported iPhone; delete leaves no files and no scheduled notifications (OVERNIGHT_PLAN s9 test); share text contains no audio and labels any sample content; frame-rate sanity (120 Hz devices need `CADisableMinimumFrameDurationOnPhone` in Info.plist; confirm it is set; add via `ios.infoPlist` if not); cut line: skip scrub, glass and summary editing before skipping anything in the global checks.

Cut list for this UI (cut from the top first): timeline scrub, Liquid Glass lens, summary editing (read-only summary), swipe-to-delete on rows, onboarding parallax (keep paging), Results tab badge, gradient backdrop, serif titles. Never cut: consent, bystander notice, deletion, sample labelling, "Not a diagnosis" on onboarding page 1, reduced-motion fallbacks.

---

## 8. New copy strings (NEW) needing review

Review rules applied: no `pause(s)`, `apnea event(s)`, `breathing stopped`, `low risk`, `safe`, `all clear`, `probabilit*`, `confidence`, `diagnos*` outside `claims.ts`/`Disclaimer.tsx`, and no `sleep detected`, `you slept`, `sleep score/quality/efficiency`, `stages`; "asleep" only after "estimated/likely". Each string below was checked against that list by eye; the real gate is the extended forbidden-phrase test.

GATED means: the sentence is true only after the named test passes, so do not ship it until then (CLAUDE.md "Be honest about implementation", OVERNIGHT_PLAN s9).

| Id | String | Where | Gate / note |
|---|---|---|---|
| N-01 | Not a diagnosis | badge (onboarding p1 and elsewhere) | Contains "diagnos": must live in `claims.ts` (allowlisted) as `NOT_A_DIAGNOSIS_BADGE`. Needs orchestrator approval to add to the shared file. |
| N-02 | What it can do | onboarding p1 disclosure | |
| N-03 | Your night stays on your phone | onboarding p2 title | GATED on "no network symbols in mobile/src" test |
| N-04 | Sound is analyzed on this phone and discarded within seconds. Recordings are not saved. | p2 | GATED on the M2 file-system diff test (OVERNIGHT_PLAN s9). If the file-chunk fallback library is used, rewrite. |
| N-05 | Nothing is uploaded. There are no accounts and no tracking. | p2 | GATED on the no-network and no-analytics checks |
| N-06 | What is kept: short summaries of each 30-second stretch (sound levels and counts), your answers, and your sleep hours. | p2 | MUST be amended if the ER-1 "retain window features" toggle is ON in a build (the plan requires the consent text to say it). |
| N-07 | You can delete everything at any time in Settings. | p2 | |
| N-08 | I agree to overnight sound analysis on this phone, as described above. | consent statement | consent text version `mobile-consent-1` |
| N-09 | Listens only after you tap Start | p3 title | true given one-tap contract |
| N-10 | Your iPhone shows an orange dot while the microphone is in use. This is a system indicator and cannot be hidden. | p3, start sheet | OVERNIGHT_PLAN I8 |
| N-10b | Microphone is allowed | p3 result | |
| N-11 | Microphone is off. You can turn it on later in Settings. You can still look at the sample night. | p3 denied | |
| N-12 | When do you sleep? | p4 title | |
| N-13 | Used to time your reminder and to stop recording in the morning. | p4 | |
| N-14 | That is {h} h in bed. | p4 computed | |
| N-15 | A notification when it is time to start recording. You tap it to begin. | p4 | honest one-tap wording ("never automatic recording") |
| N-16 | Notifications are off. You can start recording from the Audio tab any time. | p4, Audio | |
| N-17 | Add your answers (optional) | p5 title | |
| N-18 | A short screening score (NoSAS) and a symptom checklist. They help the results show what you reported next to what a recording shows. About 2 minutes. | p5 | "About 2 minutes" unmeasured: time it |
| N-19 | Height, weight, age and sex stay on this phone. | p5 | |
| N-20 | Before your first night | p6 title | |
| N-21 | Others sleeping in the room may be audible. Tell them before you record. Recording laws vary by place. SleepSmooth does not keep audio. | p6, start sheet | text from OVERNIGHT_PLAN s9; last sentence GATED like N-04 |
| N-22 | I have told anyone sharing the room | checkbox | `bystanderNoticeAckAt` |
| N-23 | You're set | p6 | |
| N-24 | Tonight | Audio large title | |
| N-25 | Tap once when you are in bed. Recording continues with the screen locked. | Audio idle | GATED on M1 locked-screen pass; wording from OVERNIGHT_PLAN s3 |
| N-26 | Set your sleep hours | Audio row | |
| N-27 | Recording uses battery. Plugging in your phone is recommended. | Audio tip | battery cost unmeasured (plan M6 logs it); keep qualitative |
| N-28 | Before you start | start sheet title | |
| N-29 | (same as N-27, shown in sheet when not charging / Low Power Mode / battery below 30%) | start sheet | "30%" threshold is a UI nudge, not clinical; PROVISIONAL |
| N-30 | Starting in {n}... | countdown | |
| N-31 | You can lock your phone now. Recording continues. | Audio recording | GATED on M1 pass |
| N-32 | Room sound level | meter label | |
| N-33 | Shows that the microphone is hearing sound. It does not measure your breathing. | meter caption | complements `DISCLAIMER_AUDIO` |
| N-34 | Recording ends at {time}. | recording | |
| N-35 | Stop recording? | alert | |
| N-36 | The night so far will be summarized on this phone. | alert | |
| N-37 | Not receiving audio | meter stale | |
| N-38 | Recording interrupted | banner E1 | |
| N-39 | Trying to continue. | banner E1 | only if resume is attempted (I6: may fail) |
| N-40 | Recording ended at {time} | banner E2 | |
| N-41..N-46 | Reason strings (scheduled-end, interrupted-call-or-alarm, os-killed-or-crash-recovered, low-battery, mic-lost, storage-error) exactly as in 4.3 State E2 | banner E2 | map to `CaptureEndReason` |
| N-47 | Part of the night was not captured. | banner E2 | |
| N-48 | Microphone is off | Audio denied | |
| N-49 | SleepSmooth needs the microphone to listen during your night. You can turn it on in Settings. | Audio denied | |
| N-50 | Summarizing your night | H1 | |
| N-51 | This happens on your phone. | H1 | |
| N-52 | Your night summary is ready | H2 | calm, no celebration |
| N-53 | The summary could not be finished. | H3 | |
| N-54 | Your answers and settings are not affected. | H3 | |
| N-55 | Look at a sample night | Results empty / Audio row | |
| N-56 | Observed on {k} of {m} assessed nights | multi-night | descriptive only, per OVERNIGHT_PLAN 8.4 |
| N-57 | Nights varied | multi-night | neutral, per plan 8.4 |
| N-58 | Recorded {h} h {m} min | night row | |
| N-59 | Not assessed | night row | plus plan `notAssessedReasons` strings |
| N-60 | Sample | nav subtitle | |
| N-61 | Estimated sleep window (unvalidated estimate): {start} to {end}. The phone cannot tell sleep from lying quietly awake. | night detail | from OVERNIGHT_PLAN 7.4 |
| N-62 | Estimated asleep / Uncertain / Awake or not captured | timeline legend | |
| N-63 | Signals used: {list} ({n} of 5). {unavailable list} not available. | night detail | replaces any "confidence" wording; plan 7.4 |
| N-64 | Counting only likely-asleep time: {a} windows. Including uncertain time: {b} windows. | night detail | plan 7.3 sensitivity line; "likely-asleep" form is allowed |
| N-65 | Delete this night | row | |
| N-66 | Delete this night? Its summary will be removed from this phone. | alert | |
| N-67 | See the overall view | link row | |
| N-68 | No sleep-window estimate for this night. | night detail | |
| N-69 | Timeline accessibility summary (template, see 4.5) | a11y | |
| N-70 | Share this summary? | share alert | |
| N-71 | It includes the answers and observations shown here. It does not include any audio. | share alert | |
| N-72 | Ticks are saved on this phone and are removed by "Delete my data". | next steps | replaces `NEXT_STEPS_STORAGE_NOTE` (which says browser tab) |
| N-73 | Overnight sound consent | settings | |
| N-74 | Withdraw consent | settings | confirm text: "Recording stops and no new nights can be started. You can choose to delete your data." |
| N-75 | Delete everything on this phone? This removes every night, your answers, sleep hours, consent, and scheduled reminders. This cannot be undone. | delete alert | |
| N-76 | Some data could not be deleted. Try again. | delete error | |
| N-77 | Discard your answers? | questionnaire | |
| N-C | Continue, Back, Skip, Not now, Done, Cancel, Close, Open Settings, Agree and continue, Allow microphone, Answer now, Later, Go to Audio tab, Try again, Retry, Share, Edit, Question {n} of {m}, Suggested | chrome | |
| N-DELDONE | Your data was deleted from this phone. | after delete | replaces `DELETE_DATA_DONE` (browser-tab wording) |

Existing strings deliberately NOT reused on mobile because they say "browser tab": `CONSENT_LABEL`, `CONSENT_DETAIL`, `WELCOME_START_OWN_NOTE`, `NEXT_STEPS_STORAGE_NOTE`, `DELETE_DATA_DONE`, `DELETE_DATA_LABEL` is reused (it is neutral).
