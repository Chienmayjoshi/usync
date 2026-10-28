import { Pressable, StyleSheet, View } from 'react-native';

import { haptics } from '@/theme/haptics';
import { theme } from '@/theme/tokens';

import { Text } from './Text';

type Props<T extends string> = { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; accent?: string };

/** Two to four views of the same screen. The active one sits on a raised plate. */
export function Segmented<T extends string>({ value, options, onChange, accent = theme.color.text.primary }: Props<T>) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => { if (!on) { haptics.tick(); onChange(o.value); } }}
            style={[styles.seg, on && styles.on]}
          >
            <Text variant="label/md" color={on ? accent : theme.color.text.muted}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', backgroundColor: theme.color.bg.surface, borderRadius: 12, padding: 4, gap: 4 },
  seg: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  on: { backgroundColor: theme.color.bg.raised, borderWidth: 1, borderColor: theme.color.border.strong },
});
