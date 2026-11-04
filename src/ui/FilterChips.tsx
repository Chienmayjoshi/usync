import { Pressable, View } from 'react-native';

import { haptics } from '@/theme/haptics';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';

import { Glow } from './Glow';
import { Text } from './Text';

type Option<T extends string> = { value: T; label: string; count?: number };
type Props<T extends string> = { value: T; options: Option<T>[]; onChange: (v: T) => void; glow: readonly [string, string] };

/** Pill filters with a count. The active one glows in the viewer's colors. */
export function FilterChips<T extends string>({ value, options, onChange, glow }: Props<T>) {
  const t = useTheme();
  const s = useStyles();
  return (
    <View style={s.row} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => { if (!on) { haptics.tick(); onChange(o.value); } }}
            style={[s.chip, on && s.on]}
          >
            {on && <Glow colors={glow} placement="center" opacity={t.scheme === 'light' ? 0.95 : 0.5} />}
            <Text variant="body/md">{o.label}</Text>
            {o.count != null && <Text variant="body/md" style={s.count}>{String(o.count).padStart(2, '0')}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: t.radius.full,
    overflow: 'hidden', backgroundColor: 'transparent',
  },
  on: { backgroundColor: t.color.bg.surface, borderWidth: 2, borderColor: t.color.border.card, boxShadow: t.shadow.row },
  count: { fontFamily: 'DMSans_700Bold' },
}));
