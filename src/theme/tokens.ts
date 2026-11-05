// Design tokens. Light mirrors the Figma redesign (file "usync", section "designs");
// dark is derived from it: same roles, same structure, tuned for a near black canvas.
// Components never read a mode directly: they ask useTheme() (ThemeProvider) for the active set.

export const PERSON_COLORS = ['ember', 'lagoon', 'violet', 'lime', 'sky', 'rose'] as const;
export type PersonColor = (typeof PERSON_COLORS)[number];

/** Visual tone of a card or surface: who owns it decides its color. */
export type Tone = PersonColor | 'gold' | 'cream' | 'neutral';

export type ToneSpec = {
  /** Solid identity color: avatars, seesaw, small dots. */
  face: string;
  /** Same as face; kept as a name for borders and rings. */
  accent: string;
  /** Text in this tone on the canvas, at AA contrast for the mode. */
  ink: string;
  /** The two soft lights that glow behind a card (Figma: two blurred ellipses). */
  glow: readonly [string, string];
};

export type Scheme = 'light' | 'dark';

const glows: Record<Tone, readonly [string, string]> = {
  ember: ['#FFB199', '#FEF26B'],
  lagoon: ['#5ED6C4', '#8DFC63'],
  violet: ['#C9B8FF', '#FEB4D4'],
  lime: ['#8DFC63', '#FEF26B'],
  sky: ['#9FD4FF', '#5ED6C4'],
  rose: ['#FEB4D4', '#FEF26B'],
  gold: ['#FEF26B', '#5ED6C4'],
  cream: ['#E6E6E6', '#D4D4D4'],
  neutral: ['#E6E6E6', '#D4D4D4'],
};

const faces: Record<Tone, string> = {
  ember: '#FF7A59',
  lagoon: '#5ED6C4',
  violet: '#B49CFF',
  lime: '#B8E35F',
  sky: '#6FB9FF',
  rose: '#FF8FB6',
  gold: '#F5C451',
  cream: '#A7A7A8',
  neutral: '#A7A7A8',
};

// Text in a person's color: deep on white, bright on black.
const inks: Record<Scheme, Record<Tone, string>> = {
  light: {
    ember: '#B8462C', lagoon: '#1F7A6D', violet: '#6E55C4', lime: '#536B1D', sky: '#245385', rose: '#C4527C',
    gold: '#8A6512', cream: '#5C5C5C', neutral: '#5C5C5C',
  },
  dark: {
    ember: '#FF7A59', lagoon: '#5ED6C4', violet: '#B49CFF', lime: '#B8E35F', sky: '#6FB9FF', rose: '#FF8FB6',
    gold: '#F5C451', cream: '#B4AEBD', neutral: '#B4AEBD',
  },
};

const buildTones = (s: Scheme) =>
  Object.fromEntries(
    (Object.keys(faces) as Tone[]).map((t) => [t, { face: faces[t], accent: faces[t], ink: inks[s][t], glow: glows[t] }]),
  ) as Record<Tone, ToneSpec>;

const light = {
  bg: {
    canvas: '#FFFFFF',
    surface: '#F5F5F5',
    raised: '#FFFFFF',
    sunken: '#EDEDED',
    tray: '#EAE9E9',
    stack1: '#DEDEDE',
    stack2: '#D2D2D2',
    sync: '#FAF7F7',
    sheet: 'rgba(255,255,255,0.97)',
    inverse: '#1A1A1A',
    scrim: 'rgba(17,17,26,0.32)',
  },
  text: {
    title: '#000000',
    primary: '#1A1A1A',
    secondary: '#5C5C5C',
    // Darker than Figma's #A7A7A8 so captions pass AA on white; #A7A7A8 stays for placeholders.
    muted: '#737373',
    placeholder: '#A7A7A8',
    inverse: '#FFFFFF',
    onColor: '#FFFFFF',
  },
  border: { subtle: '#EFEFEF', strong: '#D3D3D3', dashed: '#A7A7A8', card: '#FFFFFF' },
  action: { primary: '#1A1A1A', onPrimary: '#FFFFFF', positive: '#3BCF6C', negative: '#FF6159', neutral: '#A2A2A2' },
  accent: { tag: '#36B469', highlight: '#C4527C', heart: '#EF4242' },
  seesaw: { bar: '#E3DED3', fulcrum: '#6E6878' },
  chip: { fill: '#F5F5F5', ink: '#1A1A1A' },
  // Cards waiting behind the top card: [furthest, nearer], on the Table and inside My Deck.
  stack: { table: ['#F5F5F5', '#EFEFEF'], drawer: ['#D2D2D2', '#DEDEDE'] },
  // The My Deck drawer (Figma "deck": back panel + front lip).
  drawer: {
    backClosed: ['#6E6E6E', '#ACACAC'],
    backOpen: ['#AAAAAA', '#9B9B9B'],
    front: ['#EFEFEF', '#9D9D9D'],
    edge: '#FFFFFF',
    handle: '#A2A2A2',
    hint: '#FFFFFF',
    pill: 'rgba(255,255,255,0.9)',
    pillInk: '#1A1A1A',
    pillIcon: '#5C5C5C',
  },
  glowOpacity: 0.9,
};

const dark: typeof light = {
  bg: {
    canvas: '#0B0A0F',
    surface: '#17151C',
    raised: '#1E1B24',
    sunken: '#141218',
    tray: '#1A1820',
    stack1: '#25222C',
    stack2: '#2C2833',
    sync: '#141218',
    sheet: 'rgba(30,27,36,0.98)',
    inverse: '#F6F1E7',
    scrim: 'rgba(0,0,0,0.62)',
  },
  text: {
    title: '#FFFFFF',
    primary: '#F6F1E7',
    secondary: '#B4AEBD',
    muted: '#8F889A',
    placeholder: '#6E6878',
    inverse: '#0B0A0F',
    onColor: '#FFFFFF',
  },
  border: { subtle: '#2A2631', strong: '#3A3542', dashed: '#6E6878', card: 'rgba(255,255,255,0.08)' },
  action: { primary: '#F6F1E7', onPrimary: '#0B0A0F', positive: '#2FB45C', negative: '#F0544C', neutral: '#4A4552' },
  accent: { tag: '#5FD58E', highlight: '#FF8FB6', heart: '#FF5A5A' },
  seesaw: { bar: '#3A3542', fulcrum: '#8F889A' },
  chip: { fill: '#1E1B24', ink: '#F6F1E7' },
  stack: { table: ['#1A1820', '#211E27'], drawer: ['#2C2833', '#34303C'] },
  drawer: {
    backClosed: ['#050407', '#1E1B24'],
    backOpen: ['#1C1A21', '#141218'],
    front: ['#2A2631', '#141218'],
    edge: 'rgba(255,255,255,0.10)',
    handle: '#4A4552',
    hint: '#B4AEBD',
    pill: 'rgba(30,27,36,0.92)',
    pillInk: '#F6F1E7',
    pillIcon: '#B4AEBD',
  },
  glowOpacity: 0.22,
};

export type ThemeColors = typeof light;

const shadows = {
  light: {
    card: '0px 16px 48px rgba(17,17,26,0.10), 0px 8px 24px rgba(17,17,26,0.10), 0px 1px 0px rgba(17,17,26,0.10)',
    chip: '0px 16px 48px rgba(17,17,26,0.10), 0px 8px 24px rgba(17,17,26,0.10), 0px 1px 0px rgba(17,17,26,0.10)',
    float: '0px 48px 100px rgba(17,12,46,0.15)',
    sheet: '0px -4px 16px rgba(0,0,0,0.16)',
    row: '0px 2px 8px rgba(99,99,99,0.20)',
  },
  dark: {
    card: '0px 16px 48px rgba(0,0,0,0.45), 0px 1px 0px rgba(255,255,255,0.04)',
    chip: '0px 8px 24px rgba(0,0,0,0.4)',
    float: '0px 48px 100px rgba(0,0,0,0.55)',
    sheet: '0px -4px 16px rgba(0,0,0,0.5)',
    row: '0px 2px 8px rgba(0,0,0,0.4)',
  },
};

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;
export const radius = { none: 0, sm: 9, md: 12, lg: 24, xl: 40, full: 999 } as const;

const make = (scheme: Scheme, color: ThemeColors) => ({
  scheme,
  color,
  tones: buildTones(scheme),
  shadow: shadows[scheme],
  space,
  radius,
});

export type Theme = ReturnType<typeof make>;

export const themes: Record<Scheme, Theme> = { light: make('light', light), dark: make('dark', dark) };

/** Mode independent identity colors, for places outside React (e.g. useNames hex). */
export const personFace = (c: Tone) => faces[c];
