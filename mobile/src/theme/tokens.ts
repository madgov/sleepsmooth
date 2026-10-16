// Design tokens (IOS_DESIGN.md section 2). There is NO success/green token by design.
export interface Tone {
  bg: string;
  fg: string;
  border: string;
}

/** Muted tints for icon tiles and quiet list glyphs. Purposeful, desaturated, never green, never a status signal. */
export type TintName = 'sky' | 'teal' | 'violet' | 'amber' | 'rose' | 'slate';
export interface Tint {
  /** Glyph colour (at least 4.5:1 on its own tint over the card). */
  fg: string;
  /** Tile fill. */
  bg: string;
  /** 1pt tile edge. */
  border: string;
}

export interface Colors {
  /** Restrained icon-tile palette. The single-accent rule still holds for calls to action: tints are never used on buttons. */
  tint: Record<TintName, Tint>;
  bg: string;
  card: string;
  cardRaised: string;
  fill: string;
  label: string;
  labelSecondary: string;
  labelTertiary: string;
  separator: string;
  separatorOpaque: string;
  accent: string;
  accentFg: string;
  accentFill: string;
  focus: string;
  info: Tone;
  discuss: Tone;
  missing: Tone;
  sample: Tone;
  model: Tone;
  error: Tone;
  destructive: string;
  cardHighlight: string;
  shadow: string;
  /** v2 (IOS_DESIGN_V2): three-stop screen background, top to bottom, ending exactly on `bg` so it meets the tab bar strip seamlessly. Static; never animated. */
  bgGradient: readonly [string, string, string];
  /** v2: frosted chrome fill (tab bar, hero cards). Never used on result or evidence cards. */
  glassFill: string;
  /** v2: 1pt gradient border, light edge to faint edge. Chrome only. */
  glassBorder: readonly [string, string];
  /** v2: soft halo behind the centre record button. Chrome only. */
  glow: string;
  /** v2: exact bike-file accent gradient (#34C8E8 to #4E4AF2). Non-text uses only: centre button, active tab tile, glyph fills. */
  /** Off-state track for switches: at least 3:1 against the card in both schemes. */
  switchOff: string;
  accentGradient: readonly [string, string];
  /** v2: the same gradient with the cyan end darkened so white text on it is at least 4.5:1. Primary CTAs that carry a label. */
  accentGradientText: readonly [string, string];
  /** v2: weather-file card gradient (#5936B4 to #362A84) at reduced opacity, as glass. Chrome and metric tiles only. */
  glassGradient: readonly [string, string];
  /** v2: neumorphic pair (bike file) for segmented controls. */
  neu: { track: string; trackLight: string; trackDark: string; active: string; activeLight: string; activeDark: string };
  /** v2: calm purple for observed hour capsules (weather file #48319D family). Not a finding colour. */
  capsule: { fill: string; fillEnd: string; outline: string; label: string };
}

export const lightColors: Colors = {
  tint: {
    sky: { fg: '#1F5FA6', bg: 'rgba(31,95,166,0.10)', border: 'rgba(31,95,166,0.20)' },
    teal: { fg: '#0F6573', bg: 'rgba(15,101,115,0.10)', border: 'rgba(15,101,115,0.20)' },
    violet: { fg: '#5A3FC2', bg: 'rgba(90,63,194,0.10)', border: 'rgba(90,63,194,0.20)' },
    amber: { fg: '#7F5400', bg: 'rgba(166,110,0,0.12)', border: 'rgba(166,110,0,0.24)' },
    rose: { fg: '#A02F4D', bg: 'rgba(160,47,77,0.09)', border: 'rgba(160,47,77,0.20)' },
    slate: { fg: '#4A4F73', bg: 'rgba(74,79,115,0.10)', border: 'rgba(74,79,115,0.18)' },
  },
  bg: '#F2F1FA',
  card: '#FFFFFF',
  cardRaised: '#F7F6FD',
  fill: 'rgba(60,60,67,0.18)',
  label: '#000000',
  labelSecondary: '#4A4A55',
  labelTertiary: '#5E5E69',
  separator: 'rgba(60,60,67,0.29)',
  separatorOpaque: '#D6D4E8',
  accent: '#4339D8',
  accentFg: '#FFFFFF',
  switchOff: '#82829A',
  accentFill: 'rgba(78,74,242,0.12)',
  focus: '#3D35CC',
  info: { bg: '#E8F0FB', fg: '#17396B', border: '#9DB8E0' },
  discuss: { bg: '#FFF3D4', fg: '#5A3D00', border: '#D9A520' },
  missing: { bg: '#EEF1F5', fg: '#3E4859', border: '#8C97A8' },
  sample: { bg: '#F1E9FB', fg: '#47246F', border: '#A98BD0' },
  model: { bg: '#E3F3F6', fg: '#0F4553', border: '#7FBAC6' },
  error: { bg: '#FDE8E8', fg: '#7A1D1D', border: '#D98A8A' },
  destructive: '#B3261E',
  cardHighlight: 'rgba(255,255,255,0.7)',
  shadow: '#1A1A33',
  bgGradient: ['#E4E2F6', '#F2F1FA', '#F2F1FA'],
  glassFill: 'rgba(255,255,255,0.72)',
  glassBorder: ['rgba(255,255,255,0.95)', 'rgba(78,74,242,0.16)'],
  glow: 'rgba(89,54,180,0.14)',
  accentGradient: ['#34C8E8', '#4E4AF2'],
  accentGradientText: ['#3068E3', '#4E4AF2'],
  glassGradient: ['rgba(255,255,255,0.80)', 'rgba(255,255,255,0.62)'],
  neu: { track: '#E6E4F4', trackLight: '#FFFFFF', trackDark: '#CFCDE6', active: '#F6F5FC', activeLight: '#FFFFFF', activeDark: '#CFCDE6' },
  capsule: { fill: '#48319D', fillEnd: '#362A84', outline: '#B9B4DD', label: '#5E5E69' },
};

export const darkColors: Colors = {
  tint: {
    sky: { fg: '#8DBFF5', bg: 'rgba(110,170,240,0.16)', border: 'rgba(141,191,245,0.26)' },
    teal: { fg: '#7FCFDB', bg: 'rgba(90,190,208,0.15)', border: 'rgba(127,207,219,0.25)' },
    violet: { fg: '#BBAAF7', bg: 'rgba(150,125,240,0.17)', border: 'rgba(187,170,247,0.27)' },
    amber: { fg: '#F2C777', bg: 'rgba(235,175,70,0.15)', border: 'rgba(242,199,119,0.25)' },
    rose: { fg: '#F2A3B8', bg: 'rgba(235,120,150,0.15)', border: 'rgba(242,163,184,0.25)' },
    slate: { fg: '#B4BBD8', bg: 'rgba(180,187,216,0.12)', border: 'rgba(180,187,216,0.20)' },
  },
  bg: '#1C1B33',
  card: '#25264A',
  cardRaised: '#2D2E58',
  fill: 'rgba(235,235,245,0.18)',
  label: '#FFFFFF',
  labelSecondary: '#B9BAD0',
  labelTertiary: '#ADAFC8',
  separator: 'rgba(235,235,245,0.18)',
  separatorOpaque: '#3C3D66',
  accent: '#34C8E8',
  accentFg: '#10213D',
  switchOff: '#74769F',
  accentFill: 'rgba(52,200,232,0.16)',
  focus: '#7FD9F0',
  info: { bg: '#1B2A44', fg: '#CFE0FB', border: '#46639A' },
  discuss: { bg: '#3A2C0C', fg: '#FFE3A3', border: '#B48414' },
  missing: { bg: '#232C3B', fg: '#C9D1DE', border: '#66738A' },
  sample: { bg: '#2C2040', fg: '#E3D3FA', border: '#7E5FB0' },
  model: { bg: '#123640', fg: '#C5EBF2', border: '#3F8797' },
  error: { bg: '#46191C', fg: '#FFD2D2', border: '#A54F55' },
  destructive: '#FF948B',
  cardHighlight: 'rgba(255,255,255,0.07)',
  shadow: '#000000',
  bgGradient: ['#2E335A', '#252746', '#1C1B33'],
  glassFill: 'rgba(120,100,220,0.13)',
  glassBorder: ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.04)'],
  glow: 'rgba(89,54,180,0.30)',
  accentGradient: ['#34C8E8', '#4E4AF2'],
  accentGradientText: ['#3068E3', '#4E4AF2'],
  glassGradient: ['rgba(120,100,220,0.17)', 'rgba(70,56,160,0.12)'],
  neu: { track: '#232447', trackLight: '#33356A', trackDark: '#18182F', active: '#2F3160', activeLight: '#3A3D72', activeDark: '#1B1C38' },
  capsule: { fill: '#5936B4', fillEnd: '#362A84', outline: 'rgba(235,235,245,0.32)', label: '#B9BAD0' },
};

/** Recording-state surface (D7): dark tokens with a near-black OLED-friendly background. */
export const nightColors: Colors = {
  ...darkColors,
  bg: '#05080D',
  card: '#12131F',
  cardRaised: '#181A2A',
  separatorOpaque: '#2A2B45',
  bgGradient: ['#0A0D1E', '#070A16', '#05080D'],
  glassFill: 'rgba(89,54,180,0.12)',
  glassGradient: ['rgba(89,54,180,0.14)', 'rgba(54,42,132,0.14)'],
  glow: 'rgba(89,54,180,0.18)',
  neu: { track: '#0E0F1C', trackLight: '#1A1C30', trackDark: '#03040A', active: '#161830', activeLight: '#202340', activeDark: '#03040A' },
};

export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export type Radius = typeof radius;

export const space = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s8: 32, s10: 40, s12: 48 } as const;
export type Space = typeof space;

export type ToneName = 'default' | 'info' | 'discuss' | 'missing' | 'sample' | 'model' | 'error';
