import { Pressable, View } from 'react-native';

import { haptics } from '@/theme/haptics';
import { makeStyles } from '@/theme/ThemeProvider';

import { type Blob, Blobs } from './Glow';
import { Text } from './Text';

type Option<T extends string> = { value: T; label: string; count?: number };
type Props<T extends string> = {
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  glow: readonly [string, string];
  /** Table: three chips with small lights (Figma 223:21692). Deck: two wide chips with big lights (232:22730). */
  variant?: 'table' | 'deck';
};

// The active chip's two blurred lights, from the SVG export (stdDeviation 17).
const LIGHTS: Record<'table' | 'deck', Omit<Blob, 'color'>[]> = {
  table: [{ x: -2.75, y: -16.75, size: 50, blur: 0, sigma: 17 }, { x: 50.25, y: -6.75, size: 50, blur: 0, sigma: 17 }],
  deck: [{ x: -73.75, y: -57.75, size: 132, blur: 0, sigma: 17 }, { x: 52.25, y: -54.75, size: 146, blur: 0, sigma: 17 }],
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
            style={[s.chip, on && s.on]}
          >
            {on && (
              <View style={s.clip} pointerEvents="none">
                <Blobs opacity={1} blobs={LIGHTS[variant].map((b, i) => ({ ...b, x: b.x - 1.5, y: b.y - 1.5, color: glow[i] }))} />
              </View>
            )}
            <Text variant="body/md" style={[s.label, on && s.labelOn]}>{o.label}</Text>
            {o.count != null && <Text variant="body/md" style={[s.count, on && s.labelOn]}>{String(o.count).padStart(2, '0')}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', gap: 12 },
  // Figma: #F5F5F5, 1.5 white stroke, 32 tall, 12 side padding (RN borders sit inside: 12 - 1.5).
  chip: {
    flex: 1, height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 10.5, borderRadius: 40, borderWidth: 1.5, borderColor: t.color.border.card,
    backgroundColor: t.color.chip.fill,
  },
  on: { boxShadow: t.shadow.ring },
  // Inside the stroke (Figma draws the stroke over the lights), so the lights shift by its 1.5.
  clip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 38.5, overflow: 'hidden' },
  // Figma lets a long label run to the chip's padding rather than truncate: never wrap or ellipsize.
  label: { color: t.color.chip.idle, flexShrink: 0 },
  count: { color: t.color.chip.idle, fontFamily: 'Satoshi-Bold', flexShrink: 0 },
  labelOn: { color: t.color.chip.ink },
}));
