import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { ArrowsClockwise, Cards, type Icon, Intersect, Plus } from 'phosphor-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { useOpenDrop } from '@/features/drop/DropSheet';
import { haptics } from '@/theme/haptics';
import { theme } from '@/theme/tokens';

import { PopButton } from './PopButton';
import { Text } from './Text';

const ICONS: Record<string, { icon: Icon; label: string }> = {
  index: { icon: Cards, label: 'Deck' },
  us: { icon: Intersect, label: 'Us' },
  sync: { icon: ArrowsClockwise, label: 'Sync' },
};

/** Three tabs only, with the Drop button floating above. The active bar uses the viewer's color. */
export function TabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const openDrop = useOpenDrop();
  return (
    <View pointerEvents="box-none">
      <View style={styles.drop} pointerEvents="box-none">
        <PopButton label="Drop it" icon={Plus} tone="cream" onPress={openDrop} style={styles.dropBtn} />
        <Text variant="caption" color={theme.color.text.muted}>tap to type</Text>
      </View>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
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
              <View style={[styles.activeBar, { opacity: active ? 1 : 0 }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  drop: { alignItems: 'center', gap: 4, paddingBottom: 10 },
  dropBtn: { minWidth: 184 },
  bar: { flexDirection: 'row', backgroundColor: theme.color.bg.surface, borderTopWidth: 1, borderTopColor: theme.color.border.subtle, paddingTop: 10 },
  tab: { flex: 1, alignItems: 'center', gap: 4, minHeight: 48 },
  activeBar: { width: 20, height: 3, backgroundColor: theme.color.partner.a },
});
