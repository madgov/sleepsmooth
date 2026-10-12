# Exact values extracted from the Figma reference files

The orchestrator extracted these on 2026-10-11 with the Figma connector, read-only. Use them for style inspiration only. Do not copy any assets (bike photos, 3D weather icons, the house illustration).

Screenshots in this folder:
- `figma-bike-overview.png`
- `figma-weather-overview.png`

## Bike app (bKv0gxo3MXt6kwLrHR0ver, node 1:2), dark neumorphic with a blue diagonal

### Bottom sheet surface (node 1:185)
- Background: `linear-gradient(154.9deg, #353F54 0%, #222834 58.5%)`
- Corner radius: 30
- Border: 2px stroke. Figma exports it as white, but it renders as a faint highlight, so treat it as a low-opacity white or a gradient stroke.
- Shadow: `0 -20 60 rgba(0,0,0,0.25)`

### Segmented control (Description / Specification)
- **Active pill**
  - Background: `#323B4F`, radius 10, padding 20×10
  - Outer neumorphic shadow pair: `-4 -4 10 #38445A` and `4 4 10 #252B39`
  - Text: Poppins Bold 15 with a gradient fill, `linear-gradient(90deg, #3CA4EB, #4286EE)`
- **Inactive pill**
  - Background: `#28303F`
  - Inset shadow pair: `inset -4 -4 8 #364055` and `inset 4 4 8 #202633`
  - Text: Poppins Regular 15 at `rgba(255,255,255,0.6)`

### Bottom action bar (node 1:193)
- Background: `#262E3D`, radius 50, 2px highlight stroke
- Shadow: `0 -10 40 #1C222E`
- Price text: `#3D9CEA`, 24 regular

### Primary button (node 1:197)
- Size 160×44, radius 10, 2px highlight stroke
- Background: `linear-gradient(171.9deg, #34C8E8 1.7%, #4E4AF2 114.5%)`
- Shadow: `0 30 60 #1A1F2C`
- Text: white, Medium 15, tracking -0.3

### Product card (node 1:73)
- 165×240 dark card, roughly `#353F54` to `#222834`, with soft shadows and a skewed or angled top edge.
- Label: 13 Medium at `rgba(255,255,255,0.6)`
- Title: 15 Bold, white
- Meta: 13 Medium at 0.6 opacity
- Text tracking: -0.3
- Heart icon: accent blue outline.

### Tab bar (node 1:150)
- 390×103.5 dark bar with a rounded top.
- Icons: SF Symbols, grey at about 0.6 opacity.
- Selected item: a raised 60×60 rounded square with the blue gradient fill and a slight skew, offset above the bar.

### Other motifs
- Large diagonal blue panel behind the content, using the `#34C8E8` to `#4E4AF2` family.
- Font: Poppins, used for the whole app.

## Weather app (GyRptKc8Ww1AQMO1ofCcX7, node 2:4), purple glass

### Gradients (frame 2:108 "Weather Color Styles")
- Linear `#2E335A` to `#1C1B33` (app background)
- Linear `#5936B4` to `#362A84` (cards and widgets)
- Linear `#3658B1` to `#C159EC`
- Linear `#AEC9FF` to `#083072`
- Radial `#F7CBFD` to `#7758D1`
- Angular `#612FAB`

### Solid colours
- `#48319D`
- `#1F1D47`
- `#C427FB`
- `#E0D9FF`

### Text colours (frame 40:2621)
- **Dark mode**
  - Primary: `#FFFFFF`
  - Secondary: `#EBEBF5` at 60%
  - Tertiary: `#EBEBF5` at 30%. This is decorative only and fails 4.5:1, so never use it for text.
  - Quaternary: `#EBEBF5` at 18%
- **Light mode**
  - Primary: `#000000`
  - Secondary, tertiary and quaternary: `#3C3C43` at 60%, 30% and 18%

These are iOS semantic label colours.

### Type
SF Pro (Display and Text), iOS text styles Caption2 through LargeTitle, in Regular and Bold.

### Tab bar (node 68:4384)
- 390×100 overall, with a back layer 88 tall.
- Purple glass bar.
- The centre section is a raised curved hump: a 258-wide subtract shape.
- Centre button: 64pt circle, white or light lavender fill with layered ellipses and an inner blur. Its glyph is `#48319D` bold 28.
- Side icons: SF Symbols 22pt in white, 32pt from each edge, 44pt targets, positioned 24 from the bottom.

### Icon buttons (frame 19:931)
- 44×44, with Hover OFF and ON states.

### Hourly pill (component 2:259)
- 60×146 capsule. The active state is a filled purple gradient; the inactive state is a glass outline.

### Widgets
- 342×184 cards with a skewed or angled background shape.
- Detail tiles are 164×164 glass squares, for example "UV INDEX", using a dimmed SF Symbol plus a caps label.

## Orchestrator mapping decisions (binding)
- **Base palette:** take it from the weather file. Background `#2E335A` to `#1C1B33`, cards `#5936B4` to `#362A84` at reduced opacity as glass. Text uses the iOS semantic labels above, with tertiary text never below 4.5:1.
- **Accent and primary CTA gradient:** take it from the bike file, `#34C8E8` to `#4E4AF2`.
  - Use it for the Start Tonight and centre record button, the active tab, primary buttons and the segmented active text.
  - Do not use it on evidence or result cards.
- **Tab bar:** use the weather file's curved centre hump with a raised 64pt centre button, giving Audio | ● | Results. Apply the bike file's selected-state treatment (a raised gradient tile or pill) to the active side tab. Keep the reference sheet's labels.
- **Segmented controls:** use the bike neumorphic pair for Results filters (for example, Nights / Summary) and the questionnaire choices.
- **Night timeline:** use the weather hourly capsule (60×146) for per-hour night cells. Inactive cells are a glass outline. Active or observed cells are a calm purple fill, not a neon glow.
- **Detail tiles:** use the 164×164 glass tiles for night metrics such as "Assessed time" and "Estimated window". Use plain wording only and no gauge that could read as a score.
- **Font:** keep SF Pro (the system font), not Poppins. This avoids bundling a font and keeps Dynamic Type working. Apply the bike file's -0.3 tracking only on 13–17pt text.
- **Never:**
  - green
  - gradient or neon on result or evidence cards
  - `#C427FB` magenta for anything that signals a finding (decorative backdrop only)
  - celebratory effects
