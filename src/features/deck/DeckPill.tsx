import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect as SvgRect, Stop } from 'react-native-svg';
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

import { type Mood } from '@/features/mascot/lines';
import { Mascot } from '@/features/mascot/Mascot';
import type { MascotRecipe } from '@/features/mascot/recipe';
import { motion } from '@/theme/motion';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { ArrowUpIcon, ChevronsDownIcon } from '@/ui/DeckIcons';
import { Text } from '@/ui/Text';

import type { Rect } from './CardStack';
import { toneFor } from './taskTone';
import type { Card } from './model';

// Figma "ui update 3" (300:25147, 300:25405, 300:25526): the pill is 64 tall inside a 3 padding
// ring; 233 wide with the hint, 270 with tasks or while a card is carried, and "Go back to Table"
// while the list is open.
const H = 64;
const PAD = 3;
const W_EMPTY = 233;
const W_FULL = 270;
/** While the list is open: "(down arrow) Go back to Table", sized to its words. */
const W_OPEN = 184;
/** The tokens: the newest task 40 square tilted -4deg, the one before it 32 tilted 3deg (Figma 300:25534). */
const TOKEN = 40;
const TOKEN_BACK = 32;
/** Where the newest token's centre sits, from the pill's centre: alone, or with others behind it. */
const SLOT_ONE = PAD + (W_FULL - PAD * 2 - 20 - 42.69 / 2) - W_FULL / 2;
const SLOT_MANY = PAD + (W_FULL - PAD * 2 - 20 - 80 + 18.15 + TOKEN / 2) - W_FULL / 2;
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
  /** The partner's mascot peeking over the pill while something in the deck waits too long. */
  peek?: { recipe: MascotRecipe | null; mood: Mood; bg: string };
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
export function DeckPill({ cards, open, onToggle, bottom, rect, slot, ready, hot, peek }: Props) {
  const t = useTheme();
  const s = useStyles();
  const p = t.color.pill;
  const ref = useAnimatedRef<View>();
  const has = cards.length > 0;
  const count = useSharedValue(cards.length);
  useEffect(() => { count.set(cards.length); }, [cards.length, count]);

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
        // The card lands as the newest token: alone if the deck was empty, in front of the rest if not.
        slot.set({ x: cx + (count.value ? SLOT_MANY : SLOT_ONE), y: m.pageY + PILL_OUTER / 2 });
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
  const peeking = useAnimatedStyle(() => ({ opacity: (1 - ready.value) * (1 - shut.value), transform: [{ translateY: ready.value * 8 }] }));


  return (
    <View style={[s.row, { bottom }]} pointerEvents="box-none">
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Go back to Table' : has ? `Open my deck, ${cards.length} ${cards.length === 1 ? 'task' : 'tasks'}` : 'My deck. Drag a task here to take it'}
      >
        <Animated.View ref={ref} style={[s.wrap, wrap]}>
          {peek && (
            <Animated.View style={[s.peek, peeking]} pointerEvents="none">
              <Mascot recipe={peek.recipe} mood={peek.mood} size={28} bg={peek.bg} />
            </Animated.View>
          )}
          <Animated.View style={[s.ring, ring]} pointerEvents="none">
            <Svg width={W_FULL} height={PILL_OUTER}>
              {RING_DASHES.map((len) => <RingDash key={len} len={len} lap={lap} hot={hot} color={p.ring} />)}
            </Svg>
          </Animated.View>
          <View style={[s.pill, { backgroundColor: p.fill }]}>
            <Animated.View style={[s.fill, { backgroundColor: p.fillActive }, active]} />
            <Animated.View style={[s.edge, s.dashed, { borderColor: p.dash }, idleEdge]} pointerEvents="none" />
            <Animated.View style={[s.edge, { borderColor: p.edge }, active]} pointerEvents="none" />

            {/* Figma 300:25148: two chevrons and the hint. */}
            <Animated.View style={[s.layer, s.label, hint]} pointerEvents="none">
              <ChevronsDownIcon color={p.ink} />
              <Text style={s.text} color={p.ink} numberOfLines={1}>Drag a task here to take it</Text>
            </Animated.View>

            {/* Figma 300:25406 / 300:25527: "My Tasks" behind an arrow in a white circle; the tokens on the right. */}
            <Animated.View style={[s.layer, s.split, deck]} pointerEvents="none">
              <View style={s.label}>
                <View style={[s.up, { backgroundColor: t.color.bg.raised, borderColor: p.dash }]}><ArrowUpIcon color={p.ink} /></View>
                <Text style={s.strong} color={p.ink}>My Tasks</Text>
              </View>
              {has && <Tokens cards={cards} />}
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

/** When a card came into my deck (taken, or last moved): the newest first. */
const latest = (a: Card, b: Card) => (b.sortAt ?? b.createdAt ?? '').localeCompare(a.sortAt ?? a.createdAt ?? '');

/**
 * The deck at a glance (Figma 300:25534): the latest task's token in front, the second latest
 * tilted behind it, and "+N" for the rest once there are more than two.
 */
function Tokens({ cards: all }: { cards: Card[] }) {
  const s = useStyles();
  const cards = [...all].sort(latest);
  const rest = cards.length - 2;
  if (cards.length === 1) {
    return (
      <View style={s.one}>
        <Animated.View key={cards[0].id} entering={pop}><Token card={cards[0]} size={TOKEN} rot={-4} dot /></Animated.View>
      </View>
    );
  }
  return (
    <View style={s.many}>
      <Animated.View key={cards[1].id} entering={pop} style={s.back}><Token card={cards[1]} size={TOKEN_BACK} rot={3} /></Animated.View>
      <Animated.View key={cards[0].id} entering={pop} style={s.front}><Token card={cards[0]} size={TOKEN} rot={-4} dot /></Animated.View>
      {/* Keyed by the count, so it pops each time the deck grows or shrinks. */}
      {rest > 0 && (
        <Animated.View key={rest} entering={pop} style={s.countWrap}>
          <View style={s.count}><Text style={s.countText}>{`+${rest}`}</Text></View>
        </Animated.View>
      )}
    </View>
  );
}

/** One task as a token (Figma "Table default" token): its two lights as a gradient, a white edge, a soft drop. */
function Token({ card, size, rot, dot }: { card: Card; size: number; rot: number; dot?: boolean }) {
  const t = useTheme();
  const s = useStyles();
  const [a, b] = t.tones[toneFor(card)].dot;
  const id = `tok-${card.id}-${size}`;
  const r = (size * 12) / 40;
  return (
    <View style={[s.token, { width: size, height: size, borderRadius: r, transform: [{ rotate: `${rot}deg` }] }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0.31" y1="0.07" x2="0.79" y2="0.93">
            <Stop offset="0" stopColor={a} />
            <Stop offset="1" stopColor={b} />
          </LinearGradient>
        </Defs>
        <SvgRect x={0.5} y={0.5} width={size - 1} height={size - 1} rx={r - 0.5} fill={`url(#${id})`} stroke="#FFFFFF" strokeWidth={1} />
      </Svg>
      {dot && <View style={s.badge} />}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  row: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  wrap: { height: PILL_OUTER, padding: PAD, borderRadius: 40 },
  ring: { position: 'absolute', top: 0, left: 0, width: W_FULL, height: PILL_OUTER },
  // Peeks over the pill's top edge, beside the dots.
  peek: { position: 'absolute', top: -20, left: 20, zIndex: 2, borderRadius: 16, borderWidth: 2, borderColor: '#FFFFFF' },
  // Figma 223:21961: 90% #F4F4F4, 1.5 dashed #DADADA, shadow 0 3 5 4%.
  pill: { flex: 1, height: H, borderRadius: 40, boxShadow: '0px 3px 5px rgba(0,0,0,0.04)' },
  // While a card is carried (223:21834): a slightly darker fill and a solid white stroke.
  fill: { ...StyleSheet.absoluteFill, borderRadius: 40 },
  edge: { ...StyleSheet.absoluteFill, borderRadius: 40, borderWidth: 1.5 },
  dashed: { borderStyle: 'dashed' },
  layer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  split: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 20 },
  label: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  down: { transform: [{ rotate: '180deg' }] },
  text: { fontFamily: 'Satoshi-Medium', fontSize: 14, lineHeight: 19 },
  strong: { fontFamily: 'Satoshi-Bold', fontSize: 14, lineHeight: 19 },
  up: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  one: { width: 42.69, height: 42.69, alignItems: 'center', justifyContent: 'center' },
  many: { width: 80, height: 44 },
  back: { position: 'absolute', left: 47.15, top: 6 },
  front: { position: 'absolute', left: 18.15, top: 2 },
  token: { boxShadow: '0px 8px 24px rgba(149,157,165,0.2)' },
  // Figma: a 7 red dot with a white edge on the newest token's top right corner.
  badge: { position: 'absolute', top: 0.3, right: -2.5, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5D54', borderWidth: 1, borderColor: '#FFFFFF' },
  // Figma 300:25539: a white tag, tilted 4deg, over the front token's left edge.
  countWrap: { position: 'absolute', left: 0, top: 13, width: 36, alignItems: 'center' },
  count: { backgroundColor: '#FFFFFF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, transform: [{ rotate: '4deg' }], boxShadow: '0px 8px 12px rgba(149,157,165,0.2)' },
  countText: { fontFamily: 'Satoshi-Bold', fontSize: 14, lineHeight: 19, color: '#466FF6' },
}));
