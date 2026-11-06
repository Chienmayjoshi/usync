import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { DropFab } from '@/features/drop/DropFab';
import { haptics } from '@/theme/haptics';
import { ease } from '@/theme/motion';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';

import { PartnerIcon, SyncIcon, TableIcon } from './NavIcons';
import { Text } from './Text';

/**
 * Gap under the floating nav: Figma leaves 48 under it on a 34pt-inset iPhone, so it is the
 * system inset + 14 on both platforms. That also lifts it clear of Android's 3 button bar.
 */
export const navBottom = (inset: number) => inset + 14;
/** The nav pill's height (Figma 119:3570). */
export const NAV_H = 68;

// Figma "Navbar" (119:3568-3585): the pill is 6 + 123 + 4 + 64 + 4 + 64 + 6 wide whatever is
// active, so switching tabs never changes its width. The active highlight slides across.
const PAD = 6;
const GAP = 4;
const ACTIVE = 123;
const IDLE = 64;
const STEP = IDLE + GAP;
const SWITCH = { duration: 280, easing: ease.out };

const TABS: Record<string, { icon: typeof TableIcon; label: string; iconW: number }> = {
  index: { icon: TableIcon, label: 'Table', iconW: 21.5 },
  us: { icon: PartnerIcon, label: 'Partner', iconW: 26 },
  sync: { icon: SyncIcon, label: 'Sync', iconW: 27 },
};

export function TabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const t = useTheme();
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
            ink={t.color.action.onPrimary}
            idleInk={t.scheme === 'light' ? '#3A3A3A' : t.color.text.secondary}
            onPress={() => { if (i !== active) { haptics.tick(); navigateToTab(r.key); } }}
          />
        ))}
      </View>
      <DropFab />
    </View>
  );
}

type TabProps = { index: number; pos: SharedValue<number>; meta: (typeof TABS)[string]; active: boolean; ink: string; idleInk: string; onPress: () => void };

/** A tab grows from 64 to 123 as the highlight arrives; its label fades in where it will sit. */
function Tab({ index, pos, meta, active, ink, idleInk, onPress }: TabProps) {
  const s = useStyles();
  const Icon = meta.icon;
  const box = useAnimatedStyle(() => {
    const w = Math.max(0, 1 - Math.abs(pos.value - index));
    return { width: IDLE + (ACTIVE - IDLE) * w };
  });
  const icon = useAnimatedStyle(() => {
    const w = Math.max(0, 1 - Math.abs(pos.value - index));
    // Centered in 64 when idle; 14 from the left edge when active (Figma padding 14 / 18).
    return { transform: [{ translateX: (IDLE - meta.iconW) / 2 + (14 - (IDLE - meta.iconW) / 2) * w }] };
  });
  const label = useAnimatedStyle(() => {
    const w = Math.max(0, 1 - Math.abs(pos.value - index));
    return { opacity: w * w };
  });
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={meta.label}>
      <Animated.View style={[s.tab, box]}>
        <Animated.View style={[s.icon, icon]}>
          <Icon color={active ? ink : idleInk} />
        </Animated.View>
        <Animated.View style={[s.label, { left: 14 + meta.iconW + 12 }, label]}>
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
    // Figma 119:3570: white 80%, 1.5 white stroke, one soft shadow 0 7 29 (Figma blur) rgba(100,100,111,0.2).
    pill: {
      // Figma's 1.5 stroke sits inside the 68 height without moving content; RN borders take space,
      // so the vertical padding gives that 1.5 back to keep the tabs 56 tall.
      flexDirection: 'row', alignItems: 'center', gap: GAP, height: 68, paddingHorizontal: PAD - 1.5, paddingVertical: PAD - 1.5,
      borderRadius: 999, borderWidth: 1.5,
      backgroundColor: light ? 'rgba(255,255,255,0.8)' : 'rgba(30,27,36,0.82)',
      borderColor: light ? '#FFFFFF' : 'rgba(255,255,255,0.10)',
      boxShadow: light ? '0px 7px 29px rgba(100,100,111,0.2)' : '0px 7px 29px rgba(0,0,0,0.45)',
    },
    // Figma 119:3606: the active tab is a solid #1A1A1A pill, 123 x 56, white icon and label.
    highlight: {
      position: 'absolute', left: PAD - 1.5, top: PAD - 1.5, width: ACTIVE, height: 56, borderRadius: 999,
      backgroundColor: t.color.action.primary,
    },
    tab: { height: 56, justifyContent: 'center', overflow: 'hidden' },
    icon: { position: 'absolute', left: 0, top: 16 },
    label: { position: 'absolute', top: 17 },
    labelText: { fontFamily: 'Satoshi-Bold', fontSize: 16, lineHeight: 22, letterSpacing: -0.032 },
  };
});
