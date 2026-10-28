import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { ArrowsClockwise, Cards, type Icon, Intersect } from 'phosphor-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { useNames } from '@/features/account/account';
import { haptics } from '@/theme/haptics';
import { theme } from '@/theme/tokens';

import { Text } from './Text';

const ICONS: Record<string, { icon: Icon; label: string }> = {
  index: { icon: Cards, label: 'Deck' },
  us: { icon: Intersect, label: 'Us' },
  sync: { icon: ArrowsClockwise, label: 'Sync' },
};

/** Three tabs. The active bar uses the viewer's own color. Drop floats above it (DropFab). */
export function TabBar({ state, navigateToTab, insets, onHeight }: BottomTabBarProps & { onHeight?: (h: number) => void }) {
  const names = useNames();
  return (
    <View>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]} onLayout={(e) => onHeight?.(e.nativeEvent.layout.height)}>
        {state.routes.map((r, i) => {
          const meta = ICONS[r.name];
          if (!meta) return null;
          const active = state.index === i;
          const IconCmp = meta.icon;
          const color = active ? theme.color.text.primary : theme.color.text.muted;
          return (
            <Pressable
              key={r.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={meta.label}
              onPress={() => { if (!active) { haptics.tick(); navigateToTab(r.key); } }}
              style={styles.tab}
            >
              <IconCmp size={24} color={color} weight={active ? 'bold' : 'regular'} />
              <Text variant="label/md" color={color}>{meta.label}</Text>
              <View style={[styles.activeBar, { opacity: active ? 1 : 0, backgroundColor: names.hex.me }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: theme.color.bg.surface, borderTopWidth: 1, borderTopColor: theme.color.border.subtle, paddingTop: 10 },
  tab: { flex: 1, alignItems: 'center', gap: 4, minHeight: 48 },
  activeBar: { width: 20, height: 3 },
});
