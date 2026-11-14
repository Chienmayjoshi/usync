import { useEffect } from 'react';
import { Platform, Pressable, View } from 'react-native';
import Animated, { Easing, type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/ui/Text';

const OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** The fade behind the button (Figma 355:30756): 162 tall. */
export const GO_BACK_FADE = 162;
/** From the screen bottom to the button's bottom edge (Figma: 56 on a 34 inset). */
export const goBackBottom = (inset: number) => (Platform.OS === 'ios' ? inset + 22 : inset + 20);
/** The button with its 3 ring, 54 tall. */
export const GO_BACK_H = 54;

type Props = {
  onBack: () => void;
  /** 0 on the Table, 1 in My Deck: the button rises in last and goes first. */
  shown: SharedValue<number>;
  visible: boolean;
  /** The list runs on under the button: only then does it fade out behind it. */
  overflow: boolean;
};

/**
 * "Go back to table" (Figma 355:30757): a light pill floating at the bottom of My Deck where the
 * nav was, over a fade that lets the list dissolve under it.
 */
export function GoBack({ onBack, shown, visible, overflow }: Props) {
  const t = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const g = t.color.goBack;
  const f = t.color.body.fill;
  const over = useSharedValue(overflow ? 1 : 0);
  useEffect(() => { over.set(withTiming(overflow ? 1 : 0, { duration: 200, easing: OUT })); }, [overflow, over]);
  const press = useSharedValue(1);
  // Later than the rest of the switch: starts once the sheet is a third of the way in.
  const button = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, (shown.value - 0.35) / 0.65));
    return { opacity: p, transform: [{ translateY: (1 - p) * 16 }, { scale: press.value }] };
  });
  const fade = useAnimatedStyle(() => ({ opacity: shown.value * over.value }));
  return (
    <View style={s.fill} pointerEvents="box-none">
      <Animated.View style={[s.fade, fade]} pointerEvents="none">
        <Svg width="100%" height={GO_BACK_FADE}>
          <Defs>
            <LinearGradient id="goBackFade" x1="0" y1="0" x2="0" y2="1">
              {/* Opacity on its own: Android's SVG ignores the alpha in an rgba stop colour. */}
              <Stop offset="0" stopColor={f} stopOpacity={0} />
              <Stop offset="0.41527" stopColor={f} stopOpacity={0.8} />
              <Stop offset="1" stopColor={f} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={GO_BACK_FADE} fill="url(#goBackFade)" />
        </Svg>
      </Animated.View>
      <View style={[s.row, { bottom: goBackBottom(insets.bottom) }]} pointerEvents="box-none">
        <Pressable
          onPress={onBack}
          disabled={!visible}
          onPressIn={() => press.set(withTiming(0.97, { duration: 100, easing: OUT }))}
          onPressOut={() => press.set(withTiming(1, { duration: 140, easing: OUT }))}
          accessibilityRole="button"
          accessibilityLabel="Go back to table"
          accessibilityElementsHidden={!visible}
          importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
          hitSlop={6}
        >
          <Animated.View style={[s.ring, button]}>
            <View style={[s.pill, { backgroundColor: g.fill, borderColor: g.border }]}>
              <TableFill color={g.icon} />
              <Text style={s.text} color={g.ink}>Go back to table</Text>
            </View>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

/** Figma "table-fill" (355:30768), 16 x 19, from the export. */
function TableFill({ color }: { color: string }) {
  return (
    <Svg width={16} height={19} viewBox="0 0 16 19" fill="none">
      <Path d="M0 7.125C0 5.81332 1.07452 4.75 2.4 4.75H13.6C14.9255 4.75 16 5.81332 16 7.125V16.625C16 17.9367 14.9255 19 13.6 19H2.4C1.07452 19 0 17.9367 0 16.625V7.125Z" fill={color} />
      <Path d="M2.4 2.77083C2.4 2.55222 2.57909 2.375 2.8 2.375H13.2C13.4209 2.375 13.6 2.55222 13.6 2.77083V2.77083C13.6 2.98945 13.4209 3.16667 13.2 3.16667H2.8C2.57909 3.16667 2.4 2.98945 2.4 2.77083V2.77083Z" fill={color} />
      <Path d="M4.8 0.395833C4.8 0.177221 4.97909 0 5.2 0H10.8C11.0209 0 11.2 0.177221 11.2 0.395833V0.395833C11.2 0.614446 11.0209 0.791667 10.8 0.791667H5.2C4.97909 0.791667 4.8 0.614446 4.8 0.395833V0.395833Z" fill={color} />
    </Svg>
  );
}

const useStyles = makeStyles(() => ({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 7 },
  // Over the body only (8 in from each side), not the backdrop beside it.
  fade: { position: 'absolute', left: 8, right: 8, bottom: 0, height: GO_BACK_FADE },
  row: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  // Figma 355:30757: a 3 ring round a 48 pill.
  ring: { padding: 3 },
  // Figma 355:30758: 90% #F4F4F4, a 1.5 solid #DADADA edge, 20 at the sides, the icon 8 from the words.
  pill: {
    height: 48, borderRadius: 40, borderWidth: 1.5, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8, boxShadow: '0px 3px 5px rgba(0,0,0,0.04)',
  },
  text: { fontFamily: 'Satoshi-Bold', fontSize: 14, lineHeight: 19, textAlign: 'center' },
}));
