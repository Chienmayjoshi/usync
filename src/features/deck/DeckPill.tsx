import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  measure,
  type SharedValue,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/theme/motion';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { ArrowUpIcon, ChevronsDownIcon } from '@/ui/DeckIcons';
import { Text } from '@/ui/Text';
import { ToneDot } from '@/ui/ToneDot';

import type { Rect } from './CardStack';
import { assignDots } from './dots';
import type { Card } from './model';

// Figma "ui update 2": the pill is 48 tall inside a 3 padding ring; 233 wide with the hint,
// 270 with tasks or while a card is carried, and "Go back to Table" while the list is open.
const H = 48;
const PAD = 3;
const W_EMPTY = 233;
const W_FULL = 270;
/** While the list is open: "(down arrow) Go back to Table", sized to its words. */
const W_OPEN = 184;
const DOT = 32;
/** Space between the pill and the nav (Figma: pill 650-704, nav top 728). */
export const PILL_ABOVE_NAV = 24;
export const PILL_OUTER = H + PAD * 2;

// The ring while a card is carried (Figma 223:21902): a 1px green stroke, full at one end of the
// pill and fading out along its long edges, running round and round. Drawn on the pill's outline
// as stacked dashes centred on one point: the more of them overlap, the brighter the stroke, so
// it peaks at the head and fades both ways. They all share one offset, so the arc travels as one.
const RING_W = W_FULL - 1;
const RING_H = PILL_OUTER - 1;
const RING_R = RING_H / 2;
/** Starts at the middle of the left end, where Figma's ring is brightest, and runs clockwise. */
const RING_PATH = `M0.5 ${PILL_OUTER / 2}A${RING_R} ${RING_R} 0 0 1 ${0.5 + RING_R} 0.5H${0.5 + RING_W - RING_R}`
  + `A${RING_R} ${RING_R} 0 0 1 ${0.5 + RING_W} ${PILL_OUTER / 2}A${RING_R} ${RING_R} 0 0 1 ${0.5 + RING_W - RING_R} ${0.5 + RING_H}`
  + `H${0.5 + RING_R}A${RING_R} ${RING_R} 0 0 1 0.5 ${PILL_OUTER / 2}Z`;
const RING_LEN = 2 * (RING_W - RING_H) + Math.PI * RING_H;
/** Dash lengths, longest (faintest tail) to shortest (the bright core): Figma's arc spans ~55% of the outline. */
const RING_DASHES = Array.from({ length: 24 }, (_, i) => 330 - i * 12);
const RING_ALPHA = 0.12;
/** One lap. */
const RING_LAP = 1600;

const AnimatedPath = Animated.createAnimatedComponent(Path);

function RingDash({ len, lap, hot, color }: { len: number; lap: SharedValue<number>; hot: SharedValue<number>; color: string }) {
  const props = useAnimatedProps(() => ({
    strokeDashoffset: len / 2 - lap.value * RING_LEN,
    strokeWidth: 1 + hot.value * 0.5,
  }));
  return (
    <AnimatedPath
      d={RING_PATH}
      fill="none"
      stroke={color}
      strokeDasharray={[len, RING_LEN - len]}
      strokeOpacity={RING_ALPHA}
      strokeLinecap="round"
      animatedProps={props}
    />
  );
}

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
 * a green ring runs round it and it points down. Tap it to open the list; it then turns into "Go back to Table".
 */
export function DeckPill({ cards, open, onToggle, bottom, rect, slot, ready, hot }: Props) {
  const t = useTheme();
  const s = useStyles();
  const p = t.color.pill;
  const ref = useAnimatedRef<View>();
  const has = cards.length > 0;

  const base = useSharedValue(has ? W_FULL : W_EMPTY);
  const shut = useSharedValue(open ? 1 : 0);
  const filled = useSharedValue(has ? 1 : 0);
  const bob = useSharedValue(0);
  const lap = useSharedValue(0);
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
      lap.set(0);
      lap.set(withRepeat(withTiming(1, { duration: RING_LAP, easing: Easing.linear }), -1, false));
    } else if (!on && was) {
      cancelAnimation(bob);
      bob.set(withTiming(0, motion.release));
      cancelAnimation(lap);
    }
  });

  const wrap = useAnimatedStyle(() => {
    const w = interpolate(ready.value, [0, 1], [base.value, W_FULL]);
    return {
      width: interpolate(shut.value, [0, 1], [w, W_OPEN]),
      transform: [{ scale: 1 + hot.value * 0.03 }],
    };
  });
  const ring = useAnimatedStyle(() => ({ opacity: ready.value * (1 - shut.value) }));
  const active = useAnimatedStyle(() => ({ opacity: ready.value * (1 - shut.value) }));
  const idleEdge = useAnimatedStyle(() => ({ opacity: 1 - ready.value * (1 - shut.value) }));
  const hint = useAnimatedStyle(() => ({ opacity: (1 - ready.value) * (1 - filled.value) * (1 - shut.value) }));
  const deck = useAnimatedStyle(() => ({ opacity: (1 - ready.value) * filled.value * (1 - shut.value) }));
  const drop = useAnimatedStyle(() => ({ opacity: ready.value * (1 - shut.value) }));
  const chevrons = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value * 3 }] }));
  const close = useAnimatedStyle(() => ({ opacity: shut.value }));

  const dots = assignDots(cards);
  const shown = cards.slice(0, 3);
  const more = cards.length - shown.length;

  return (
    <View style={[s.row, { bottom }]} pointerEvents="box-none">
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Go back to Table' : has ? `Open my deck, ${cards.length} ${cards.length === 1 ? 'task' : 'tasks'}` : 'My deck. Drag a task here to take it'}
      >
        <Animated.View ref={ref} style={[s.wrap, wrap]}>
          <Animated.View style={[s.ring, ring]} pointerEvents="none">
            <Svg width={W_FULL} height={PILL_OUTER}>
              {RING_DASHES.map((len) => <RingDash key={len} len={len} lap={lap} hot={hot} color={p.ring} />)}
            </Svg>
          </Animated.View>
          <View style={[s.pill, { backgroundColor: p.fill }]}>
            <Animated.View style={[s.fill, { backgroundColor: p.fillActive }, active]} />
            <Animated.View style={[s.edge, s.dashed, { borderColor: p.dash }, idleEdge]} pointerEvents="none" />
            <Animated.View style={[s.edge, { borderColor: p.edge }, active]} pointerEvents="none" />

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
                    <ToneDot colors={dots.get(c.id)} size={DOT} />
                  </Animated.View>
                ))}
                {more > 0 && (
                  <View style={[s.more, s.overlap, { backgroundColor: p.more, borderColor: p.edge }]}>
                    <Text style={s.moreText} color={p.ink}>{`+${more}`}</Text>
                  </View>
                )}
              </View>
            </Animated.View>

            <Animated.View style={[s.layer, s.label, drop]} pointerEvents="none">
              <Animated.View style={chevrons}><ChevronsDownIcon color={p.icon} /></Animated.View>
              <Text style={s.text} color={p.ink}>Drop it here</Text>
            </Animated.View>

            <Animated.View style={[s.layer, s.label, close]} pointerEvents="none">
              <View style={s.down}><ArrowUpIcon color={p.ink} /></View>
              <Text style={s.text} color={p.ink} numberOfLines={1}>Go back to Table</Text>
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
  ring: { position: 'absolute', top: 0, left: 0, width: W_FULL, height: PILL_OUTER },
  // Figma 223:21961: 90% #F4F4F4, 1.5 dashed #DADADA, shadow 0 3 5 4%.
  pill: { flex: 1, height: H, borderRadius: 40, boxShadow: '0px 3px 5px rgba(0,0,0,0.04)' },
  // While a card is carried (223:21834): a slightly darker fill and a solid white stroke.
  fill: { ...StyleSheet.absoluteFill, borderRadius: 40 },
  edge: { ...StyleSheet.absoluteFill, borderRadius: 40, borderWidth: 1.5 },
  dashed: { borderStyle: 'dashed' },
  layer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  split: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14.5 },
  label: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  down: { transform: [{ rotate: '180deg' }] },
  text: { fontFamily: 'Satoshi-Medium', fontSize: 14, lineHeight: 19 },
  dots: { flexDirection: 'row', alignItems: 'center' },
  overlap: { marginLeft: -8 },
  // Figma 232:22650: the "+2" circle.
  more: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontFamily: 'Satoshi-Medium', fontSize: 14, lineHeight: 20 },
}));
