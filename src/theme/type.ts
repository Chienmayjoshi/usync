import type { TextStyle } from 'react-native';

// Mirrors the Figma text styles. Letter spacing converted from % to points.
export const fonts = {
  displaySemiBold: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_400Regular_Italic',
  uiMedium: 'Manrope_500Medium',
  uiBold: 'Manrope_700Bold',
  uiExtraBold: 'Manrope_800ExtraBold',
} as const;

export const type = {
  'display/2xl': { fontFamily: fonts.displaySemiBold, fontSize: 64, lineHeight: 64, letterSpacing: -1.6 },
  'display/xl': { fontFamily: fonts.displaySemiBold, fontSize: 44, lineHeight: 48, letterSpacing: -0.66 },
  'display/lg': { fontFamily: fonts.displaySemiBold, fontSize: 32, lineHeight: 36, letterSpacing: -0.32 },
  'display/accent': { fontFamily: fonts.displayItalic, fontSize: 26, lineHeight: 32, letterSpacing: -0.13 },
  'title/lg': { fontFamily: fonts.uiBold, fontSize: 22, lineHeight: 28, letterSpacing: -0.11 },
  'title/md': { fontFamily: fonts.uiBold, fontSize: 17, lineHeight: 22, letterSpacing: -0.03 },
  'body/lg': { fontFamily: fonts.uiMedium, fontSize: 16, lineHeight: 24 },
  'body/md': { fontFamily: fonts.uiMedium, fontSize: 14, lineHeight: 20 },
  'label/md': { fontFamily: fonts.uiExtraBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: 'uppercase' },
  caption: { fontFamily: fonts.uiMedium, fontSize: 12, lineHeight: 16 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
