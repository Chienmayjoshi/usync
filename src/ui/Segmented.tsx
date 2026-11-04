import { Pressable, View } from 'react-native';

import { haptics } from '@/theme/haptics';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type Props<T extends string> = { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; accent?: string };

/** Two to four views of the same thing. The active one sits on a white plate in a grey track. */
export function Segmented<T extends string>({ value, options, onChange, accent }: Props<T>) {
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
            style={[s.seg, on && s.on]}
          >
            <Text variant={on ? 'title/md' : 'body/md'} style={s.label} color={on ? accent ?? t.color.text.primary : t.color.text.secondary}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', backgroundColor: t.color.bg.sunken, borderRadius: t.radius.md, padding: 3, gap: 3 },
  seg: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: t.radius.sm },
  on: { backgroundColor: t.color.bg.raised, boxShadow: t.shadow.row },
  label: { fontSize: 14 },
}));
