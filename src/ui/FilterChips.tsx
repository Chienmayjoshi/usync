import { Pressable, View } from 'react-native';

import { haptics } from '@/theme/haptics';
import { makeStyles } from '@/theme/ThemeProvider';

import { Blobs } from './Glow';
import { Text } from './Text';

type Option<T extends string> = { value: T; label: string; count?: number };
type Props<T extends string> = {
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  glow: readonly [string, string];
  /** On the Table inactive chips are bare; inside the My Deck drawer every chip is a pill. */
  variant?: 'table' | 'drawer';
};

/** Figma "Fairness hint" chips: label + count, the active one glows in the viewer's colors. */
export function FilterChips<T extends string>({ value, options, onChange, glow, variant = 'table' }: Props<T>) {
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
            style={[s.chip, (on || variant === 'drawer') ? s.filled : s.bare, on && s.on]}
          >
            {on && (
              <View style={s.clip} pointerEvents="none">
                <Blobs blobs={[{ x: -2, y: -16, size: 50, blur: 34, color: glow[0] }, { x: 51, y: -6, size: 50, blur: 34, color: glow[1] }]} />
              </View>
            )}
            <Text variant="body/md" style={s.label} numberOfLines={1}>{o.label}</Text>
            {o.count != null && <Text variant="body/md" style={s.count}>{String(o.count).padStart(2, '0')}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', gap: 12 },
  chip: {
    flex: 1, height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    // Figma: 12px side padding with a centred 2px stroke; RN borders sit inside, so 12 - 2 - 2.
    paddingHorizontal: 8, borderRadius: 40, borderWidth: 2, borderColor: t.color.border.card,
  },
  filled: { backgroundColor: t.color.chip.fill },
  // Figma's white stroke disappears on the white Table; keep it invisible in dark mode too.
  bare: { borderColor: 'transparent' },
  on: { boxShadow: t.shadow.chip },
  clip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 40, overflow: 'hidden' },
  label: { color: t.color.chip.ink },
  count: { color: t.color.chip.ink, fontFamily: 'Satoshi-Bold' },
}));
