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
  // Figma "Segmented" (149:8641): 48 tall track, 4 padding and gap, a 40 tall plate with a 1px stroke.
  row: { flexDirection: 'row', backgroundColor: t.color.bg.sunken, borderRadius: t.radius.md, padding: 4, gap: 4 },
  seg: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: t.radius.sm, borderWidth: 1, borderColor: 'transparent' },
  on: { backgroundColor: t.color.bg.raised, borderColor: t.color.border.strong },
  label: { fontSize: 14 },
}));
