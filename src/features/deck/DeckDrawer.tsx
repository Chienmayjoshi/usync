import { CaretDown, CaretUp } from 'phosphor-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, type SharedValue, useAnimatedReaction, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { useNames } from '@/features/account/account';
import { haptics } from '@/theme/haptics';
import { motion } from '@/theme/motion';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Blobs } from '@/ui/Glow';
import { Text } from '@/ui/Text';

import type { Rect } from './CardStack';
import { toneFor } from './DealCard';
import type { Card } from './model';

// Geometry from Figma "ui update" (390 wide): the back panel's top sits 48 above the front lip;
// the lip's pocket (its U shaped cut) is 48.5 deep with 32 wide ears either side.
export const LIP_TO_NAV = 140; // lip top (656) to the nav's bottom edge (796)
const BACK_ABOVE_LIP = 48; // back top 608 vs lip top 656
const POCKET = 48.5;
const EAR = 32;

/** The back panel: rounded top with a 64 x 10 notch in the middle for the handle (Figma "back"). */
function backPath(w: number, h: number) {
  const c = w / 2;
  return `M${c - 38} 0C${c - 34.686} 0 ${c - 32} 2.686 ${c - 32} 6V5C${c - 32} 7.761 ${c - 29.761} 10 ${c - 27} 10H${c + 27}`
    + `C${c + 29.761} 10 ${c + 32} 7.761 ${c + 32} 5V6C${c + 32} 2.686 ${c + 34.686} 0 ${c + 38} 0H${w - 24}`
    + `C${w - 10.745} 0 ${w} 10.745 ${w} 24V${h}H0V24C0 10.745 10.745 0 24 0Z`;
}

/** The front lip: full width, with the pocket cut into its top between two rounded ears (Figma "front"). */
function frontPath(w: number, h: number) {
  return `M16 .5C24.837 .5 32 7.663 32 16.5V26.832C33.173 38.993 43.419 48.5 55.887 48.5H${w - 55.887}`
    + `C${w - 43.419} 48.5 ${w - 33.173} 38.993 ${w - 32} 26.832V16.5C${w - 32} 7.663 ${w - 24.837} .5 ${w - 16} .5`
    + `H${w}V${h}H0V.5H16Z`;
}

type Props = {
  /** 0 collapsed, 1 open. Owned by the screen so the header follows it. */
  open: SharedValue<number>;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  /** Screen y of the back panel's top edge when open (20 under the header). */
  openTop: number;
  /** Space the floating nav needs at the bottom (its bottom inset). */
  navBottom: number;
  cards: Card[];
  rect: SharedValue<Rect>;
  ready: SharedValue<number>;
  hot: SharedValue<number>;
  /** Filter chips, shown inside the drawer when it is open. */
  chips: ReactNode;
  children: ReactNode;
};

export function DeckDrawer({ open, expanded, setExpanded, openTop, navBottom, cards, rect, ready, hot, chips, children }: Props) {
  const t = useTheme();
  const s = useStyles();
  const names = useNames();
  const win = useWindowDimensions();
  // Laid out on the screen it actually fills (the window can be taller on Android and web).
  const [box, setBox] = useState({ w: win.width, h: win.height });
  const W = box.w;
  const H = box.h;
  const lipTop = H - navBottom - LIP_TO_NAV;
  const closedTop = lipTop - BACK_ABOVE_LIP;
  const travel = closedTop - openTop;
  const backH = H - openTop + 2;
  const lipH = H - lipTop;
  const d = t.color.drawer;

  // The pocket cards drop into: between the ears, from the back's top edge to the lip's floor.
  useAnimatedReaction(() => open.value, (v) => {
    if (v === 0) rect.set({ x: EAR, y: closedTop, w: W - EAR * 2, h: BACK_ABOVE_LIP + POCKET });
    else rect.set({ x: -1000, y: -1000, w: 0, h: 0 });
  }, [closedTop, W]);

  const snap = (to: 0 | 1) => {
    'worklet';
    open.set(withTiming(to, motion.panel));
    scheduleOnRN(setExpanded, to === 1);
    scheduleOnRN(haptics.tick);
  };
  const toggle = () => { open.set(withTiming(expanded ? 0 : 1, motion.panel)); setExpanded(!expanded); haptics.tick(); };

  const drag = usePanGesture({
    activeOffsetY: [-6, 6],
    onUpdate: (e) => {
      'worklet';
      const from = expanded ? 1 : 0;
      open.set(Math.max(0, Math.min(1, from - e.translationY / travel)));
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.velocityY < -500) return snap(1);
      if (e.velocityY > 500) return snap(0);
      snap(open.value > 0.5 ? 1 : 0);
    },
  });

  const back = useAnimatedStyle(() => ({ transform: [{ translateY: openTop + (1 - open.value) * travel }] }));
  const openShade = useAnimatedStyle(() => ({ opacity: open.value }));
  const inside = useAnimatedStyle(() => ({ opacity: interpolate(open.value, [0.35, 1], [0, 1]) }));
  const closedOnly = useAnimatedStyle(() => ({ opacity: interpolate(open.value, [0, 0.4], [1, 0]) }));
  const hint = useAnimatedStyle(() => ({ opacity: interpolate(open.value, [0, 0.4], [1, 0]) * Math.max(ready.value, cards.length ? 0 : 1) }));
  const minis = useAnimatedStyle(() => ({ opacity: interpolate(open.value, [0, 0.4], [1, 0]) * (1 - ready.value) }));
  const glow = useAnimatedStyle(() => ({ opacity: hot.value * (1 - open.value) }));
  const shown = cards.slice(0, 3);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (width !== box.w || height !== box.h) setBox({ w: width, h: height }); }}
    >
      {/* Back panel. Its gradient changes from the closed to the open look as it rises. */}
      <Animated.View style={[s.back, { height: backH }, back]} pointerEvents="box-none">
        <Svg width={W} height={backH} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="backClosed" gradientUnits="userSpaceOnUse" cx={W / 2} cy={134} rx={361 * (W / 390)} ry={103}>
              <Stop offset="0" stopColor={d.backClosed[0]} />
              <Stop offset="1" stopColor={d.backClosed[1]} />
            </RadialGradient>
          </Defs>
          <Path d={backPath(W, backH)} fill="url(#backClosed)" stroke={d.edge} strokeWidth={1} />
        </Svg>
        <Animated.View style={[StyleSheet.absoluteFill, openShade]} pointerEvents="none">
          <Svg width={W} height={backH}>
            <Defs>
              <RadialGradient id="backOpen" gradientUnits="userSpaceOnUse" cx={W / 2} cy={210.5} rx={210 * (W / 390)} ry={473.5}>
                <Stop offset="0" stopColor={d.backOpen[0]} />
                <Stop offset="1" stopColor={d.backOpen[1]} />
              </RadialGradient>
            </Defs>
            <Path d={backPath(W, backH)} fill="url(#backOpen)" stroke={d.edge} strokeWidth={1} />
          </Svg>
        </Animated.View>

        <GestureDetector gesture={drag}>
          <View style={s.grip} accessibilityRole="adjustable" accessibilityLabel={expanded ? 'Collapse my deck' : 'Open my deck'}>
            <View style={[s.handle, { backgroundColor: d.handle }]} />
          </View>
        </GestureDetector>

        {/* Open: chips 48 below the top edge, the deck 20 below them. */}
        <Animated.View style={[s.inside, { height: lipTop - openTop - 48 - 12 }, inside]} pointerEvents={expanded ? 'box-none' : 'none'}>
          {chips}
          <View style={s.flex}>{children}</View>
        </Animated.View>

        {/* Closed: what is already in the deck peeks out of the pocket; glows when a card hovers. */}
        <Animated.View style={[s.pocketGlow, glow]} pointerEvents="none">
          <Blobs blobs={[{ x: 40, y: 0, size: 120, blur: 60, color: t.tones[names.colors.me].glow[0] }, { x: W - 200, y: 0, size: 120, blur: 60, color: t.tones[names.colors.me].glow[1] }]} />
        </Animated.View>
        <Animated.View style={[s.minis, minis]} pointerEvents="none">
          {shown.map((c, i) => (
            <View key={c.id} style={[s.mini, { top: 22 + i * 10, left: EAR + 12 + i * 8, right: EAR + 12 + i * 8, zIndex: 3 - i }]}>
              <Blobs blobs={[
                { x: -12, y: -46, size: 152, blur: 60, color: t.tones[toneFor(c, names.colors)].glow[0] },
                { x: W - 230, y: -46, size: 152, blur: 60, color: t.tones[toneFor(c, names.colors)].glow[1] },
              ]} />
            </View>
          ))}
        </Animated.View>
      </Animated.View>

      {/* Front lip: never moves. The hint sits in the pocket; the pills sit on its edge. */}
      <View style={[s.front, { top: lipTop, height: lipH }]} pointerEvents="box-none">
        <Svg width={W} height={lipH} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="front" gradientUnits="userSpaceOnUse" x1={W / 2} y1={84.5} x2={W / 2} y2={lipH}>
              <Stop offset="0" stopColor={d.front[0]} />
              <Stop offset="1" stopColor={d.front[1]} />
            </LinearGradient>
          </Defs>
          <Path d={frontPath(W, lipH)} fill="url(#front)" stroke={d.edge} strokeWidth={1} />
        </Svg>
        <Animated.View style={[s.hint, hint]} pointerEvents="none">
          <Text variant="body/md" color={d.hint}>Drag a task here to take it</Text>
        </Animated.View>
        {cards.length > 0 && (
          <Animated.View style={[s.pillRow, closedOnly]} pointerEvents={expanded ? 'none' : 'box-none'}>
            <Pressable onPress={toggle} style={[s.pill, { backgroundColor: d.pill }]} accessibilityRole="button" accessibilityLabel={`Open my deck, ${cards.length} cards`}>
              <CaretUp size={16} weight="fill" color={d.pillIcon} />
              <Text variant="body/md" color={d.pillInk}>My Deck</Text>
              <Text variant="body/md" color={d.pillInk} style={s.bold}>{String(cards.length).padStart(2, '0')}</Text>
            </Pressable>
          </Animated.View>
        )}
        <Animated.View style={[s.pillRow, inside]} pointerEvents={expanded ? 'box-none' : 'none'}>
          <Pressable onPress={toggle} style={[s.pill, s.collapse, { backgroundColor: d.pill }]} accessibilityRole="button" accessibilityLabel="Collapse my deck">
            <CaretDown size={16} weight="fill" color={d.pillIcon} />
            <Text variant="body/md" color={d.pillInk}>Collapse</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  back: { position: 'absolute', left: 0, right: 0, top: 0 },
  grip: { position: 'absolute', top: 0, left: 0, right: 0, height: 44, alignItems: 'center', zIndex: 2 },
  handle: { width: 40, height: 4, borderRadius: 12, marginTop: 1 },
  inside: { position: 'absolute', top: 48, left: 20, right: 20, gap: 20 },
  flex: { flex: 1 },
  pocketGlow: { position: 'absolute', top: 0, left: EAR, right: EAR, height: BACK_ABOVE_LIP + POCKET, borderRadius: 24, overflow: 'hidden' },
  minis: { position: 'absolute', top: 0, left: 0, right: 0, height: BACK_ABOVE_LIP + POCKET },
  mini: { position: 'absolute', height: 90, borderRadius: 24, backgroundColor: t.color.bg.raised, borderWidth: 2, borderColor: t.color.border.card, overflow: 'hidden' },
  front: { position: 'absolute', left: 0, right: 0 },
  hint: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  pillRow: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 4, minHeight: 29,
    borderRadius: 40, borderWidth: 1, borderColor: t.color.drawer.edge,
  },
  collapse: { minWidth: 141, justifyContent: 'center' },
  bold: { fontFamily: 'Satoshi-Bold' },
}));
