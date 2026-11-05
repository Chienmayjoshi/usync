import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Cards, Handshake, Heart, type Icon } from 'phosphor-react-native';
import { Pressable, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { DropFab } from '@/features/drop/DropFab';
import { useNames } from '@/features/account/account';
import { haptics } from '@/theme/haptics';
import { ease, motion } from '@/theme/motion';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

/**
 * Gap under the floating nav: Figma leaves 48 under it on a 34pt-inset iPhone, so it is the
 * system inset + 14 on both platforms. That also lifts it clear of Android's 3 button bar.
 */
export const navBottom = (inset: number) => inset + 14;

const ICONS: Record<string, { icon: Icon; label: (partner: string | null) => string }> = {
  index: { icon: Cards, label: () => 'Table' },
  us: { icon: Heart, label: (p) => p ?? 'Partner' },
  sync: { icon: Handshake, label: () => 'Sync' },
};

/** Floating pill: the active tab opens into an icon and a label. Drop (+) sits beside it. */
export function TabBar({ state, navigateToTab, insets, onHeight }: BottomTabBarProps & { onHeight?: (h: number) => void }) {
  const t = useTheme();
  const s = useStyles();
  const names = useNames();
  return (
    <View
      style={[s.wrap, { paddingBottom: navBottom(insets.bottom) }]}
      pointerEvents="box-none"
      onLayout={(e) => onHeight?.(e.nativeEvent.layout.height)}
    >
      <View style={s.pill}>
        {state.routes.map((r, i) => {
          const meta = ICONS[r.name];
          if (!meta) return null;
          const active = state.index === i;
          const IconCmp = meta.icon;
          const label = meta.label(names.partner);
          return (
            <Pressable
              key={r.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
              onPress={() => { if (!active) { haptics.tick(); navigateToTab(r.key); } }}
            >
              <Animated.View layout={LinearTransition.duration(motion.layout).easing(ease.out)} style={[s.tab, active && s.active]}>
                <IconCmp size={24} color={active ? t.color.text.primary : t.color.text.secondary} weight={active ? 'fill' : 'light'} />
                {active && <Text variant="title/md" numberOfLines={1} style={s.label}>{label}</Text>}
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
      <DropFab />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 8,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, borderRadius: t.radius.full,
    backgroundColor: t.scheme === 'light' ? 'rgba(242,242,242,0.96)' : 'rgba(30,27,36,0.96)',
    borderWidth: 1, borderColor: t.color.border.card, boxShadow: t.shadow.card,
  },
  tab: { height: 56, minWidth: 56, paddingHorizontal: 16, borderRadius: t.radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  active: { backgroundColor: t.scheme === 'light' ? 'rgba(255,255,255,0.92)' : t.color.bg.stack2, boxShadow: t.shadow.row },
  label: { maxWidth: 110 },
}));
