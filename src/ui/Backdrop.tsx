import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

/**
 * The screen behind everything (Figma 355:30852 "header bg"): near black at the top, where the
 * header sits, easing to white at the bottom, behind the light body container.
 */
export function Backdrop() {
  const t = useTheme();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="backdrop" x1="0" y1="0" x2="0" y2="1">
            {t.color.backdrop.map(([c, o]) => <Stop key={o} offset={o} stopColor={c} />)}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#backdrop)" />
      </Svg>
    </View>
  );
}
