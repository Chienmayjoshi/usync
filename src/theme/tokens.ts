// Mirrors the Figma variables 1:1 (collections Primitives, Color, Spacing, Radius).
// Figma code syntax uses the same paths, e.g. color/bg/canvas -> theme.color.bg.canvas.

export const palette = {
  ink950: '#0B0A0F',
  ink900: '#141218',
  ink800: '#1E1B24',
  ink700: '#2A2631',
  ink500: '#6E6878',
  ink400: '#8F889A',
  ink300: '#B4AEBD',
  cream50: '#F6F1E7',
  ember400: '#FF7A59',
  ember700: '#B8462C',
  ember800: '#8A3220',
  lagoon400: '#5ED6C4',
  lagoon700: '#2E8F80',
  lagoon800: '#1F6B60',
  gold400: '#F5C451',
  gold700: '#A9801F',
  gold800: '#7A5B12',
  violet400: '#B49CFF',
  violet700: '#6E55C4',
  violet800: '#4C3A8C',
  lime400: '#B8E35F',
  lime700: '#76952C',
  lime800: '#536B1D',
  sky400: '#6FB9FF',
  sky700: '#3474B8',
  sky800: '#245385',
  rose400: '#FF8FB6',
  rose700: '#C2507A',
  rose800: '#8C3857',
  green400: '#7EE081',
  magenta400: '#F2529B',
} as const;

export const theme = {
  color: {
    bg: {
      canvas: palette.ink950,
      surface: palette.ink900,
      raised: palette.ink800,
      inverse: palette.cream50,
    },
    text: {
      primary: palette.cream50,
      secondary: palette.ink300,
      // ink400, not ink500: keeps captions at WCAG AA on every surface.
      muted: palette.ink400,
      inverse: palette.ink950,
    },
    border: {
      subtle: palette.ink700,
      strong: palette.ink500,
    },
    partner: {
      a: palette.ember400,
      aEdge: palette.ember700,
      aEdgeDeep: palette.ember800,
      b: palette.lagoon400,
      bEdge: palette.lagoon700,
      bEdgeDeep: palette.lagoon800,
    },
    together: {
      base: palette.gold400,
      edge: palette.gold700,
      edgeDeep: palette.gold800,
    },
    pop: {
      creamEdge: palette.ink300,
      creamEdgeDeep: palette.ink500,
    },
    feedback: {
      success: palette.green400,
      danger: palette.magenta400,
    },
  },
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 },
  radius: { none: 0, sm: 4, md: 12, lg: 20, xl: 28, full: 999 },
} as const;

/** The colors a person can pick for themselves. Gold stays reserved for together. */
export const PERSON_COLORS = ['ember', 'lagoon', 'violet', 'lime', 'sky', 'rose'] as const;
export type PersonColor = (typeof PERSON_COLORS)[number];

/** Visual tone of a pop surface: who owns it decides its color. */
export type Tone = PersonColor | 'gold' | 'cream' | 'neutral';

const person = (face: string, edge: string, edgeDeep: string) => ({ face, accent: face, edge, edgeDeep, ink: theme.color.text.inverse });

export const tones: Record<Tone, { face: string; accent: string; edge: string; edgeDeep: string; ink: string }> = {
  ember: { face: theme.color.partner.a, accent: theme.color.partner.a, edge: theme.color.partner.aEdge, edgeDeep: theme.color.partner.aEdgeDeep, ink: theme.color.text.inverse },
  lagoon: { face: theme.color.partner.b, accent: theme.color.partner.b, edge: theme.color.partner.bEdge, edgeDeep: theme.color.partner.bEdgeDeep, ink: theme.color.text.inverse },
  violet: person(palette.violet400, palette.violet700, palette.violet800),
  lime: person(palette.lime400, palette.lime700, palette.lime800),
  sky: person(palette.sky400, palette.sky700, palette.sky800),
  rose: person(palette.rose400, palette.rose700, palette.rose800),
  gold: { face: theme.color.together.base, accent: theme.color.together.base, edge: theme.color.together.edge, edgeDeep: theme.color.together.edgeDeep, ink: theme.color.text.inverse },
  cream: { face: theme.color.bg.inverse, accent: theme.color.bg.inverse, edge: theme.color.pop.creamEdge, edgeDeep: theme.color.pop.creamEdgeDeep, ink: theme.color.text.inverse },
  neutral: { face: theme.color.bg.raised, accent: theme.color.border.strong, edge: theme.color.border.strong, edgeDeep: theme.color.border.subtle, ink: theme.color.text.primary },
};
