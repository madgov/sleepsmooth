# UI critique: why it did not feel premium

Compared against Calm, Oura, Rise, Apple Health, Things 3 and the Figma references. Screenshots: `docs/screenshots/audit-before-*.png` and `audit-after-*.png` (dark, 390x844).

## Findings by area
- Typography: ten-plus ad hoc sizes, scattered letterSpacing and uppercase labels, weights 500/600/700 mixed. Fixed: 7-step scale (display 44, largeTitle 34, title1/2 22, headline 17, body 17, callout 15, footnote 13, caption 11), SF tracking left to iOS, labels in sentence case.
- Spacing: cards with three nested paddings, stacked chips under every row. Partly fixed (Checks card compacted).
- Colour: every icon tile the same indigo gradient, glass fill heavy purple, low separation between cards and backdrop. Fixed: muted tint palette (sky, teal, violet, amber, rose, slate, never green), gradient reserved for CTAs and the active tab, lighter glass fill.
- Density and copy: "Not a diagnosis" as a chip, a paragraph and a subtitle on the same card. Fixed: one `DisclaimerNote` per surface.
- Components: capsule chips that read as buttons. Fixed: flat 8pt tags. Shadows and borders still heavy on glass cards (deferred).
- Motion: no scroll-linked behaviour, fade for modal. Fixed: collapsing large title with blurred bar, bottom-slide recording modal.
- Information architecture: Dashboard, Checks and Nights overlap; a first-time user sees two Start buttons. Fixed the duplicate CTA; the overlap remains (deferred, needs a product call).
- Details: skewed active tab tile (unskewed), tab bar hump kept, Ionicons on web vs SF Symbols on iOS differ (preview only).

## Top 15, ranked
1. Large title never collapsed; no blurred bar (fixed).
2. No coherent type scale or tracking (fixed).
3. Identical indigo tiles everywhere (fixed).
4. Disclaimer repeated three ways per card (fixed on hero; one note per surface).
5. Two "Start tonight" CTAs on an empty dashboard (fixed).
6. Form-like Checks cards with stacked status chip (fixed).
7. Uppercase micro-labels (fixed).
8. Small metric numerals (display size now).
9. Capsule chips resembling buttons (fixed).
10. Muddy glass fill (toned down).
11. Skewed active tab tile (fixed).
12. Press feedback missing in places (fixed in the audited components).
13. Modal transition (fixed).
14. Dashboard, Checks, Nights overlap (deferred).
15. Static skeletons, no shimmer (deferred, no layout shift risk today).

## Second loop (after the coordinator review)
- Check detail: four stacked labels for one fact collapsed to one Missing tag, the label and one line; the "cannot rule out" sentence now appears once; header tile uses the same teal tint as the Checks list (`checkTint.ts`).
- Dashboard: "Sample night" shown once (card), overview card no longer repeats the disclaimer.
- Disclaimer: one `DisclaimerNote` per screen on Dashboard (hero), Checks and Nights.
- Nights rows: the heavy amber fill on every observed night is gone (neutral glass, tone lives on the chip).
- Night detail: removed two stacked 164pt tiles; fixed "Window length 0 minutes" bug for overnight windows.
- Skeletons shimmer (static under Reduce Motion); segmented control haptic moved into `NeuSegmented`.
- Tags (source badges, clip chips) now flat 8pt, not capsules.

## Deferred
Card shadow reduction (needs a device pass), merging Dashboard, Checks and Nights (product decision), `PrimaryButton` scale still a CSS-style transition, native-only behaviours (see report).
