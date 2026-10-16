# Button and interaction audit (iPhone app)

Method: static sweep of every Pressable, PressScale, PrimaryButton, ListRow, Switch, router push and sheet action in `mobile/app` and `mobile/src`, plus a dynamic sweep in the Expo web preview (dark, 390x844) with console checks. Status: Fixed, Verified (web), or Device-only (cannot be checked off-device).

| Screen | Element | Problem | Fix | Status |
|---|---|---|---|---|
| All routes | Any push or navigate | Rapid double-tap pushed the same route twice | `useSafeRouter` with shared 450 ms guard (`src/mobileLogic/navGuard.ts`, 6 tests) in 18 files | Fixed |
| All pushed screens | Back button with empty history (deep link, reload) | GO_BACK unhandled, silent no-op | `useSafeRouter().back` falls back to `replace('/')` | Fixed, verified |
| Settings | Delete data, withdraw consent, delete clips, health connect | `Alert.alert` is a silent no-op on web: confirm never appeared | `confirmAction` (Alert natively, `window.confirm` on web) | Fixed |
| Night detail | Delete night, stop recording (shared hook) | Same Alert no-op | `confirmAction` | Fixed |
| Night detail | Error state button | Said "Try again" when nothing could retry | Label prop: "Go back" | Fixed |
| Night detail | "See the overall view" row | Duplicated the Dashboard link, led nowhere new | Removed | Fixed |
| Questionnaire steps | Disabled Continue | No explanation why it is disabled | Visible `disabledReason` footnote and selection haptic | Fixed |
| Settings | Open iOS Settings link | Unhandled promise rejection | catch in `openSystemSettings` | Fixed |
| Night detail | Clip waveform | Svg `accessible` prop warning, focusable noise | Wrapped in hidden, non-interactive View | Fixed, verified |
| Icon.web | `xmark.circle` | Missing web mapping (warning, blank glyph) | Mapped | Fixed |
| Samples list | SampleRow | Raw Pressable, no pressed feedback | `PressScale` | Fixed |
| Disclosures, filled/tinted buttons, segmented | Missing haptic | Haptic added (Disclosure selection, PrimaryButton `haptic` prop) | Fixed (device-only to feel) |
| Tab bar | Tab item | No pressed state | Opacity on press | Fixed |
| Onboarding | Paged onboarding files | Dead code, unreachable | Deleted `PagedOnboarding.tsx`, `pages.tsx` | Fixed |
| Recording | Route transition | Fade for a full-screen modal | `slide_from_bottom` | Fixed |

Not changed on purpose: `_layout.tsx`, `stop.tsx` and the automation route keep raw `useRouter` (they must navigate even inside the lock window).

## Dynamic sweep results (web preview, dark, 390x844 unless noted)

| Flow | Result | Status |
|---|---|---|
| Clip play/pause, two clips | Starting clip B stops clip A (A back to Play, B shows Stop); progress is 0 for any non-active row by construction | Verified |
| Auto-record guide: Open Shortcuts | Silent on web (URL scheme swallowed) | Fixed: honest "could not be opened" note on web |
| Auto-record guide: Not now, acknowledgements, Done enable | Not now leaves the screen, both checkboxes enable Done | Verified |
| Dashboard auto-record card: Not now | Card disappears and stays hidden after reload | Verified |
| Settings routine card: Find my routine | Shows "Motion history is not available on this device or in this preview." | Verified |
| Routine card: Use this / Not now with a real suggestion | Needs motion history (device only); gallery uses no-op handlers by design | Device-only |
| Summary: Share as text, Share as PDF | Responded with a generic failure | Fixed: web says sharing needs the iPhone app, nothing was sent |
| Next steps checkboxes | Toggle, persist across reload, untick | Verified |
| Sources links | Open the cited URLs | Verified |
| Model card | Renders, Back works | Verified |
| Questionnaire retake end to end | Height, weight, neck, snore, age, sex, six symptoms, driving question, review, Save returns to Checks | Verified |
| Delete my data: cancel and confirm | Cancel keeps settings; confirm clears settings and routes to /intro | Verified |
| Night detail: Window length | Showed "0 minutes" for an overnight window (end before start) | Fixed (wraps past midnight), duplicate tile removed |
| 30 nights (dev fixture `?nights=30`) | List scrolls (4700 px), rows stay readable at 390 and 320 wide | Verified |
| 0 nights (`?nights=0`) | Single Start tonight, sample clearly labelled | Verified |
| Font scale 1.35 (dev `?fontscale=1.35`) | Metric numerals and hero date were truncated; tab labels crowded | Fixed (no truncation, tab label cap) |
| 320 wide | Tab bar and Nights rows fit | Verified |
| Rapid double-tap | Guarded by `useSafeRouter` (unit-tested logic); not reproducible via the automation tool | Logic only |

The dev switches (`?nights=N`, `?fontscale=X`) live in `mobile/src/dev/devParams.ts`, are gated on `__DEV__` and web, and do nothing in a release build or on device.

Not changed on purpose: `_layout.tsx`, `stop.tsx` and the automation route keep raw `useRouter`.
