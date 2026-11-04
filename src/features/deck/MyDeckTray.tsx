import { CaretDown, CaretUp } from 'phosphor-react-native';
import { type ComponentRef, type ReactNode, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, type SharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, RadialGradient, Rect as SvgRect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { useNames } from '@/features/account/account';
import { haptics } from '@/theme/haptics';
import { motion } from '@/theme/motion';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Glow } from '@/ui/Glow';
import { Text } from '@/ui/Text';

import type { Rect } from './CardStack';
import { toneFor } from './DealCard';
import type { Card } from './model';

/** How much of the tray shows while collapsed, above the bottom edge. */
export const TRAY_PEEK = 210;

type Props = {
  /** 0 collapsed, 1 expanded. Owned by the screen so the header can follow it. */
  open: SharedValue<number>;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  /** Where the expanded tray's top edge sits (just under the filters). */
  top: number;
  cards: Card[];
  rect: SharedValue<Rect>;
  ready: SharedValue<number>;
  hot: SharedValue<number>;
  children: ReactNode;
};

/**
 * My Deck: a tray at the bottom of the Table. Drag a card into it to take it. Drag the handle up
 * (or tap "My Deck") and it rises over the Table to show the deck; Collapse brings it back down.
 */
export function MyDeckTray({ open, expanded, setExpanded, top, cards, rect, ready, hot, children }: Props) {
  const t = useTheme();
  const s = useStyles();
  const names = useNames();
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const height = H - top;
  const travel = height - TRAY_PEEK;
  const slot = useRef<ComponentRef<typeof View>>(null);
  const measure = () => slot.current?.measureInWindow((x, y, w, h) => rect.set({ x, y, w, h }));
  useEffect(() => { if (!expanded) setTimeout(measure, 350); });

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

  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - open.value) * travel }] }));
  const peek = useAnimatedStyle(() => ({ opacity: 1 - open.value, transform: [{ scale: 1 + hot.value * 0.03 }] }));
  const deck = useAnimatedStyle(() => ({ opacity: interpolate(open.value, [0.3, 1], [0, 1]) }));
  const invite = useAnimatedStyle(() => ({ opacity: Math.max(ready.value, cards.length ? 0 : 1) }));
  const minis = useAnimatedStyle(() => ({ opacity: 1 - ready.value }));
  const glow = useAnimatedStyle(() => ({ opacity: hot.value }));
  const light = t.scheme === 'light';
  const shown = cards.slice(0, 3);

  return (
    <Animated.View style={[s.panel, { height }, panel]}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="tray" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={light ? '#EFEFEF' : t.color.bg.stack1} />
            <Stop offset="1" stopColor={light ? '#C9C9C9' : t.color.bg.sunken} />
          </LinearGradient>
        </Defs>
        <SvgRect x="0" y="0" width="100" height="100" fill="url(#tray)" />
      </Svg>

      <GestureDetector gesture={drag}>
        <View style={s.grip} accessibilityRole="adjustable" accessibilityLabel={expanded ? 'Collapse my deck' : 'Open my deck'}>
          <View style={s.notch} />
        </View>
      </GestureDetector>

      {/* Collapsed: the slot cards drop into, with a peek of what is already in the deck. */}
      <Animated.View style={[s.peekWrap, peek]} pointerEvents={expanded ? 'none' : 'box-none'}>
        <View ref={slot} onLayout={measure} collapsable={false} style={s.slot}>
          <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="slot" cx="50%" cy="0%" r="100%">
                <Stop offset="0" stopColor={light ? '#6E6E6E' : '#000000'} />
                <Stop offset="1" stopColor={light ? '#ACACAC' : t.color.bg.stack2} />
              </RadialGradient>
            </Defs>
            <SvgRect x="0" y="0" width="100" height="100" fill="url(#slot)" />
          </Svg>
          <Animated.View style={[StyleSheet.absoluteFill, glow]} pointerEvents="none">
            <Glow colors={t.tones[names.colors.me].glow} placement="center" opacity={0.9} />
          </Animated.View>
          <Animated.View style={[s.minis, minis]} pointerEvents="none">
            {shown.map((c, i) => (
              <View key={c.id} style={[s.mini, { top: (shown.length - 1 - i) * 10, left: 8 + i * 6, right: 8 + i * 6, zIndex: 3 - i }]}>
                <Glow colors={t.tones[toneFor(c, names.colors)].glow} placement="center" opacity={0.95} />
              </View>
            ))}
          </Animated.View>
          <Animated.View style={[s.inviteWrap, invite]} pointerEvents="none">
            <Text variant="body/md" color="#FFFFFF">Drag a task here to take it</Text>
          </Animated.View>
          {cards.length > 0 && (
            <Animated.View style={[s.pillWrap, minis]}>
              <Pressable onPress={toggle} style={s.pill} accessibilityRole="button" accessibilityLabel={`Open my deck, ${cards.length} cards`}>
                <CaretUp size={14} weight="fill" color={t.color.text.secondary} />
                <Text variant="body/md" color={t.color.text.secondary}>My Deck</Text>
                <Text variant="body/md" style={s.bold}>{String(cards.length).padStart(2, '0')}</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
      </Animated.View>

      {/* Expanded: the deck itself. */}
      <Animated.View style={[s.deck, { paddingBottom: insets.bottom + 96 }, deck]} pointerEvents={expanded ? 'box-none' : 'none'}>
        <View style={s.flex}>{children}</View>
        <Pressable onPress={toggle} style={[s.pill, s.collapse]} accessibilityRole="button">
          <CaretDown size={14} weight="fill" color={t.color.text.secondary} />
          <Text variant="body/md" color={t.color.text.secondary}>Collapse</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => ({
  panel: {
    position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: t.radius.xl, borderTopRightRadius: t.radius.xl,
    overflow: 'hidden', boxShadow: t.shadow.sheet, zIndex: 5,
  },
  grip: { height: 36, alignItems: 'center', justifyContent: 'center' },
  notch: { width: 40, height: 5, borderRadius: 3, backgroundColor: t.scheme === 'light' ? '#C9C9C9' : t.color.border.strong },
  peekWrap: { position: 'absolute', left: 32, right: 32, top: 48, height: 96 },
  slot: { flex: 1, borderRadius: t.radius.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  minis: { position: 'absolute', left: 0, right: 0, top: 6, bottom: 0 },
  mini: { position: 'absolute', height: 80, borderRadius: t.radius.lg, backgroundColor: t.color.bg.raised, overflow: 'hidden', borderWidth: 2, borderColor: t.color.border.card },
  inviteWrap: { position: 'absolute', alignItems: 'center' },
  pillWrap: { position: 'absolute', alignItems: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, height: 36, borderRadius: t.radius.full,
    backgroundColor: t.scheme === 'light' ? 'rgba(255,255,255,0.85)' : 'rgba(30,27,36,0.9)', alignSelf: 'center',
  },
  bold: { fontFamily: 'DMSans_700Bold' },
  deck: { flex: 1, paddingHorizontal: 20, paddingTop: 4, gap: 12 },
  flex: { flex: 1 },
  collapse: { marginTop: 4 },
}));
