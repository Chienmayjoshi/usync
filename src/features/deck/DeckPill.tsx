import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  measure,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useNames } from '@/features/account/account';
import { motion } from '@/theme/motion';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { ArrowUpIcon, ChevronsDownIcon, CloseIcon } from '@/ui/DeckIcons';
import { Text } from '@/ui/Text';
import { ToneDot } from '@/ui/ToneDot';

import type { Rect } from './CardStack';
import { toneFor } from './DealCard';
import type { Card } from './model';

// Figma "ui update 2": the pill is 48 tall inside a 3 padding ring; 233 wide with the hint,
// 270 with tasks or while a card is carried, a 48 circle (close) while the list is open.
const H = 48;
const PAD = 3;
const W_EMPTY = 233;
const W_FULL = 270;
const DOT = 32;
/** Space between the pill and the nav (Figma: pill 650-704, nav top 728). */
export const PILL_ABOVE_NAV = 24;
export const PILL_OUTER = H + PAD * 2;

type Props = {
  cards: Card[];
  /** The list is open: the pill becomes its close button. */
  open: boolean;
  onToggle: () => void;
  /** Distance from the screen bottom to the pill's bottom edge. */
  bottom: number;
  rect: SharedValue<Rect>;
  /** Where a dropped card's circle lands: the pill's dot slot, window coordinates. */
  slot: SharedValue<{ x: number; y: number }>;
  ready: SharedValue<number>;
  hot: SharedValue<number>;
};

const pop = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.6 }] },
    animations: { opacity: withTiming(1, motion.release), transform: [{ scale: withTiming(1, motion.dealIn) }] },
  };
};

/**
 * My Deck as a small pill under the Table (Figma 239:23498, notes 239:23499): "Drag a task here
 * to take it" when empty, the deck's colors when not, and while a card is carried it widens,
 * rings green and points down. Tap it to open the list; it then turns into the list's close button.
 */
export function DeckPill({ cards, open, onToggle, bottom, rect, slot, ready, hot }: Props) {
  const t = useTheme();
  const s = useStyles();
  const names = useNames();
  const p = t.color.pill;
  const ref = useAnimatedRef<View>();
  const has = cards.length > 0;

  const base = useSharedValue(has ? W_FULL : W_EMPTY);
  const shut = useSharedValue(open ? 1 : 0);
  const filled = useSharedValue(has ? 1 : 0);
  const bob = useSharedValue(0);
  useEffect(() => { base.set(withTiming(has ? W_FULL : W_EMPTY, motion.panel)); filled.set(withTiming(has ? 1 : 0, motion.release)); }, [has, base, filled]);
  useEffect(() => { shut.set(withTiming(open ? 1 : 0, motion.panel)); }, [open, shut]);

  // Where cards can be dropped: measured as a drag starts, so it is right whatever moved.
  useAnimatedReaction(() => ready.value > 0, (on, was) => {
    if (on && !was) {
      const m = measure(ref);
      if (m) {
        rect.set({ x: m.pageX, y: m.pageY, w: m.width, h: m.height });
        const cx = m.pageX + m.width / 2;
        slot.set({ x: cx + W_FULL / 2 - PAD - 16 - DOT / 2, y: m.pageY + PILL_OUTER / 2 });
      }
      bob.set(withRepeat(withTiming(1, { duration: 520 }), -1, true));
    } else if (!on && was) {
      cancelAnimation(bob);
      bob.set(withTiming(0, motion.release));
    }
  });

  const wrap = useAnimatedStyle(() => {
    const w = interpolate(ready.value, [0, 1], [base.value, W_FULL]);
    return {
      width: interpolate(shut.value, [0, 1], [w, PILL_OUTER]),
      transform: [{ scale: 1 + hot.value * 0.03 }],
    };
  });
  const ring = useAnimatedStyle(() => ({ opacity: ready.value * (1 - shut.value), borderWidth: 1 + hot.value * 0.5 }));
  const active = useAnimatedStyle(() => ({ opacity: ready.value * (1 - shut.value) }));
  const hint = useAnimatedStyle(() => ({ opacity: (1 - ready.value) * (1 - filled.value) * (1 - shut.value) }));
  const deck = useAnimatedStyle(() => ({ opacity: (1 - ready.value) * filled.value * (1 - shut.value) }));
  const chevrons = useAnimatedStyle(() => ({ opacity: ready.value * (1 - shut.value), transform: [{ translateY: bob.value * 3 }] }));
  const close = useAnimatedStyle(() => ({ opacity: shut.value }));

  const shown = cards.slice(0, 3);
  const more = cards.length - shown.length;

  return (
    <View style={[s.row, { bottom }]} pointerEvents="box-none">
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Close my deck' : has ? `Open my deck, ${cards.length} ${cards.length === 1 ? 'task' : 'tasks'}` : 'My deck. Drag a task here to take it'}
      >
        <Animated.View ref={ref} style={[s.wrap, wrap]}>
          <Animated.View style={[s.ring, { borderColor: p.ring }, ring]} pointerEvents="none" />
          <View style={[s.pill, { backgroundColor: p.fill, borderColor: p.dash }]}>
            <Animated.View style={[s.fill, { backgroundColor: p.fillActive, borderColor: p.edge }, active]} />

            <Animated.View style={[s.layer, hint]} pointerEvents="none">
              <Text style={s.text} color={p.ink} numberOfLines={1}>Drag a task here to take it</Text>
            </Animated.View>

            <Animated.View style={[s.layer, s.split, deck]} pointerEvents="none">
              <View style={s.label}>
                <ArrowUpIcon color={p.ink} />
                <Text style={s.text} color={p.ink}>My Deck</Text>
              </View>
              <View style={s.dots}>
                {shown.map((c, i) => (
                  <Animated.View key={c.id} entering={pop} style={i > 0 && s.overlap}>
                    <ToneDot tone={toneFor(c, names.colors)} size={DOT} />
                  </Animated.View>
                ))}
                {more > 0 && (
                  <View style={[s.more, s.overlap, { backgroundColor: p.more, borderColor: p.edge }]}>
                    <Text style={s.moreText} color={p.ink}>{`+${more}`}</Text>
                  </View>
                )}
              </View>
            </Animated.View>

            <Animated.View style={[s.layer, chevrons]} pointerEvents="none">
              <ChevronsDownIcon color={p.icon} />
            </Animated.View>

            <Animated.View style={[s.layer, close]} pointerEvents="none">
              <CloseIcon color={p.icon} />
            </Animated.View>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  row: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  wrap: { height: PILL_OUTER, padding: PAD, borderRadius: 40 },
  ring: { ...StyleSheet.absoluteFill, borderRadius: 40 },
  // Figma 223:21961: 90% #F4F4F4, 1.5 dashed #DADADA, shadow 0 3 5 4%.
  pill: {
    flex: 1, height: H, borderRadius: 40, borderWidth: 1.5, borderStyle: 'dashed', overflow: 'hidden',
    boxShadow: '0px 3px 5px rgba(0,0,0,0.04)',
  },
  // While a card is carried (223:21834): a solid white stroke over a slightly darker fill.
  fill: { position: 'absolute', top: -1.5, left: -1.5, right: -1.5, bottom: -1.5, borderRadius: 40, borderWidth: 1.5 },
  layer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  split: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14.5 },
  label: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontFamily: 'Satoshi-Medium', fontSize: 14, lineHeight: 19 },
  dots: { flexDirection: 'row', alignItems: 'center' },
  overlap: { marginLeft: -8 },
  // Figma 232:22650: the "+2" circle.
  more: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontFamily: 'Satoshi-Medium', fontSize: 14, lineHeight: 20 },
}));
