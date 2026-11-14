import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderAvatars } from '@/features/account/HeaderAvatars';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';

import { pad2 } from './pad2';
import { Text } from './Text';

/** The header row's top, under the status bar (Figma: 72 on a 54 inset). Shared by every tab. */
export const HEADER_TOP = 18;
/** The header row (Figma 355:30854: 40 tall buttons, 8 above and below). */
export const HEADER_H = 56;
/** Where the body container starts on a tab (Figma 355:30867: y 156 = 72 + 56 + 28). */
export const BODY_TOP = HEADER_TOP + HEADER_H + 28;


type Props = {
  title: string;
  count?: number;
  /** Swaps in place of the bell and avatar. */
  right?: ReactNode;
};

/**
 * A tab's header on the dark backdrop (Figma 355:30854): the title in white caps, a small dot,
 * the count in the brand orange; the bell and my avatar on the right. The title crossfades
 * when it changes (On table / My deck).
 */
export function ScreenHeader({ title, count, right }: Props) {
  const t = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { top: insets.top + HEADER_TOP }]} pointerEvents="box-none">
      <Animated.View key={title} entering={FadeIn.duration(150)} exiting={FadeOut.duration(100)} style={s.left} accessibilityRole="header">
        <Text style={s.title} color={t.color.header.ink} numberOfLines={1}>{title}</Text>
        {count != null && (
          <>
            <View style={s.dot} />
            <Text style={s.title} color={t.color.brand}>{pad2(count)}</Text>
          </>
        )}
      </Animated.View>
      {right ?? <HeaderAvatars />}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  header: {
    position: 'absolute', left: 20, right: 20, height: HEADER_H, zIndex: 6,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  // Satoshi Black 20, caps (Figma 355:30855); line height "normal" for 20 is 27.
  title: { fontFamily: 'Satoshi-Black', fontSize: 20, lineHeight: 27, textTransform: 'uppercase', flexShrink: 1 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: t.color.header.dot },
}));
