import type { TextStyle } from 'react-native';

// Display mirrors Figma's Roc Grotesk ExtraBold (commercial). Archivo Black is a free stand in
// with the same heavy, upper case grotesque feel; swap the file here to switch everywhere.
export const fonts = {
  display: 'ArchivoBlack_400Regular',
  uiRegular: 'DMSans_400Regular',
  uiMedium: 'DMSans_500Medium',
  uiSemiBold: 'DMSans_600SemiBold',
  uiBold: 'DMSans_700Bold',
  uiExtraBold: 'DMSans_800ExtraBold',
} as const;

const display = (size: number, lineHeight: number, letterSpacing = 0): TextStyle => ({
  fontFamily: fonts.display, fontSize: size, lineHeight, letterSpacing, textTransform: 'uppercase',
});

export const type = {
  // Display: upper case, for card titles, screen titles, stamps.
  'display/2xl': display(44, 44, -0.5),
  'display/xl': display(26, 29, -0.3),
  'display/lg': display(20, 24),
  'display/md': display(16, 19),
  'display/sm': display(12, 15, 0.3),
  // Kept for quotes and thanks: a large, calm sentence.
  'display/accent': { fontFamily: fonts.uiMedium, fontSize: 22, lineHeight: 30, letterSpacing: -0.2 },
  'title/lg': { fontFamily: fonts.uiSemiBold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  'title/md': { fontFamily: fonts.uiSemiBold, fontSize: 16, lineHeight: 22 },
  'body/lg': { fontFamily: fonts.uiMedium, fontSize: 16, lineHeight: 22 },
  'body/md': { fontFamily: fonts.uiMedium, fontSize: 14, lineHeight: 20 },
  'body/sm': { fontFamily: fonts.uiRegular, fontSize: 13, lineHeight: 18 },
  'label/md': { fontFamily: fonts.uiSemiBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.4, textTransform: 'uppercase' },
  button: { fontFamily: fonts.uiBold, fontSize: 16, lineHeight: 20 },
  'button/sm': { fontFamily: fonts.uiExtraBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.4, textTransform: 'uppercase' },
  caption: { fontFamily: fonts.uiRegular, fontSize: 12, lineHeight: 16 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
