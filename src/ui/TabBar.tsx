import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { DropFab } from '@/features/drop/DropFab';
import { haptics } from '@/theme/haptics';
import { ease } from '@/theme/motion';
import { makeStyles } from '@/theme/ThemeProvider';

import { HeartFillIcon, HeartLineIcon, SyncFillIcon, SyncLineIcon, TableFillIcon, TableLineIcon } from './NavIcons';
import { Text } from './Text';

/**
 * Gap under the floating nav: Figma leaves 48 under it on a 34pt-inset iPhone, so it is the
 * system inset + 14 on both platforms. That also lifts it clear of Android's 3 button bar.
 */
export const navBottom = (inset: number) => inset + 14;
/** The nav pill's height (Figma 119:3570). */
export const NAV_H = 68;

// Figma "nav" (300:25871, ui update 3): a dark pill, 1.5 + 4 + 120 + 4 + 64 + 4 + 64 + 4 + 1.5 = 267
// wide whatever is active, so switching tabs never changes its width. The white highlight slides across.
const PAD_X = 4;
const PAD_Y = 4.5;
const GAP = 4;
const ACTIVE = 120;
const IDLE = 64;
const STEP = IDLE + GAP;
const SWITCH = { duration: 280, easing: ease.out };
const NAV_INK = '#1A1A1A';

// labelW: the label's width in Satoshi Bold 16, so icon and label sit centred in the 120 (Figma
// pads 14 / 18, which puts the Table icon 24 in and its label at 52).
// Figma 300:25680: the active tab's icon is filled and dark, the idle ones outlined in white;
// idleW is the outline's width (the heart's runs 25.2), iconW the filled one's.
type Icon = typeof TableFillIcon;
const TABS: Record<string, { icon: Icon; idle: Icon; label: string; iconW: number; idleW: number; labelW: number }> = {
  index: { icon: TableFillIcon, idle: TableLineIcon, label: 'Table', iconW: 20, idleW: 20, labelW: 40 },
  us: { icon: HeartFillIcon, idle: HeartLineIcon, label: 'Partner', iconW: 24, idleW: 25.2, labelW: 56 },
  sync: { icon: SyncFillIcon, idle: SyncLineIcon, label: 'Sync', iconW: 24, idleW: 24, labelW: 36 },
};
const iconIn = (m: { iconW: number; labelW: number }) => (ACTIVE - m.iconW - 8 - m.labelW) / 2 - 2;

export function TabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const s = useStyles();
  const routes = state.routes.filter((r) => TABS[r.name]);
  const active = routes.findIndex((r) => r.key === state.routes[state.index]?.key);
  const pos = useSharedValue(Math.max(0, active));
  useEffect(() => { if (active >= 0) pos.set(withTiming(active, SWITCH)); }, [active, pos]);

  const highlight = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value * STEP }] }));

  return (
    <View style={[s.wrap, { paddingBottom: navBottom(insets.bottom) }]} pointerEvents="box-none">
      <View style={s.pill}>
        <Animated.View style={[s.highlight, highlight]} pointerEvents="none" />
        {routes.map((r, i) => (
          <Tab
            key={r.key}
            index={i}
            pos={pos}
            meta={TABS[r.name]}
            active={i === active}
            ink={NAV_INK}
            idleInk="#FFFFFF"
            onPress={() => { if (i !== active) { haptics.tick(); navigateToTab(r.key); } }}
          />
        ))}
      </View>
      <DropFab />
    </View>
  );
}

type TabProps = { index: number; pos: SharedValue<number>; meta: (typeof TABS)[string]; active: boolean; ink: string; idleInk: string; onPress: () => void };

/** A tab grows from 64 to 120 as the highlight arrives; its label fades in where it will sit. */
function Tab({ index, pos, meta, active, ink, idleInk, onPress }: TabProps) {
  const s = useStyles();
  const Fill = meta.icon;
  const Line = meta.idle;
  const boxW = Math.max(meta.iconW, meta.idleW);
  const idleX = (IDLE - boxW) / 2;
  const activeX = iconIn({ iconW: boxW, labelW: meta.labelW });
  const box = useAnimatedStyle(() => {
    const w = Math.max(0, 1 - Math.abs(pos.value - index));
    return { width: IDLE + (ACTIVE - IDLE) * w };
  });
  const icon = useAnimatedStyle(() => {
    const w = Math.max(0, 1 - Math.abs(pos.value - index));
    // Centred in 64 when idle; centred with its label in 120 when active (Figma 300:25873).
    // Plain numbers worked out on the JS side: a worklet must not call a non-worklet function.
    return { transform: [{ translateX: idleX + (activeX - idleX) * w }] };
  });
  const label = useAnimatedStyle(() => {
    const w = Math.max(0, 1 - Math.abs(pos.value - index));
    return { opacity: w * w };
  });
  // The outline gives way to the filled icon as the white highlight slides under it.
  const fill = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - Math.abs(pos.value - index)) }));
  const line = useAnimatedStyle(() => ({ opacity: 1 - Math.max(0, 1 - Math.abs(pos.value - index)) }));
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={meta.label}>
      <Animated.View style={[s.tab, box]}>
        <Animated.View style={[s.icon, { width: boxW }, icon]}>
          <Animated.View style={[s.glyph, line]}><Line color={idleInk} /></Animated.View>
          <Animated.View style={[s.glyph, fill]}><Fill color={ink} /></Animated.View>
        </Animated.View>
        {/* 8 after the icon (Figma 300:25878). */}
        <Animated.View style={[s.label, { left: activeX + boxW + 8 }, label]}>
          <Text variant="title/md" color={ink} style={s.labelText} numberOfLines={1}>{meta.label}</Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => {
  const light = t.scheme === 'light';
  return {
    wrap: {
      position: 'absolute', left: 0, right: 0, bottom: 0,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    // Figma 300:25872: #1A1A1A at 96%, 1.5 white stroke, one soft shadow 0 7 29 rgba(100,100,111,0.2).
    // 1.5 + 4.5 + 56 + 4.5 + 1.5 = 68 tall.
    pill: {
      flexDirection: 'row', alignItems: 'center', gap: GAP, height: 68, paddingHorizontal: PAD_X, paddingVertical: PAD_Y,
      borderRadius: 999, borderWidth: 1.5,
      backgroundColor: 'rgba(26,26,26,0.96)',
      borderColor: light ? '#FFFFFF' : 'rgba(255,255,255,0.12)',
      boxShadow: light ? '0px 7px 29px rgba(100,100,111,0.2)' : '0px 7px 29px rgba(0,0,0,0.45)',
    },
    // Figma 300:25873: the active tab is a white pill, 120 x 56, its icon and label #1A1A1A.
    highlight: {
      position: 'absolute', left: PAD_X, top: PAD_Y, width: ACTIVE, height: 56, borderRadius: 999,
      backgroundColor: '#FFFFFF',
    },
    tab: { height: 56, justifyContent: 'center', overflow: 'hidden' },
    icon: { position: 'absolute', left: 0, top: 16, height: 24 },
    glyph: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    label: { position: 'absolute', top: 17 },
    labelText: { fontFamily: 'Satoshi-Bold', fontSize: 16, lineHeight: 22, letterSpacing: -0.032 },
  };
});
