import { Check } from 'phosphor-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { haptics } from '@/theme/haptics';
import { PERSON_COLORS, type PersonColor, theme, tones } from '@/theme/tokens';
import { Avatar } from '@/ui/AvatarPair';
import { Text } from '@/ui/Text';

export const AVATARS = ['🦊', '🐼', '🐯', '🐨', '🦉', '🐙', '🌻', '🌵', '🍉', '🌙', '⚡', '🎧'] as const;

type Value = { color: PersonColor; avatar: string | null };
type Props = { value: Value; onChange: (v: Value) => void; initial: string | null; partnerColor?: PersonColor | null; partnerName?: string | null };

/** Your color (shown on your cards, your side of the seesaw, your avatar) and an optional emoji. */
export function ProfilePicker({ value, onChange, initial, partnerColor, partnerName }: Props) {
  const set = (patch: Partial<Value>) => { haptics.tick(); onChange({ ...value, ...patch }); };
  return (
    <View style={styles.wrap}>
      <View style={styles.preview}>
        <Avatar initial={initial} avatar={value.avatar} color={value.color} size={72} />
      </View>

      <Text variant="label/md" color={theme.color.text.muted}>Your color</Text>
      <View style={styles.row}>
        {PERSON_COLORS.map((c) => {
          const taken = c === partnerColor;
          const on = c === value.color;
          return (
            <Pressable
              key={c}
              disabled={taken}
              onPress={() => set({ color: c })}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, disabled: taken }}
              accessibilityLabel={taken ? `${c}, ${partnerName ?? 'your partner'}’s color` : c}
              style={[styles.swatch, { backgroundColor: tones[c].face, borderColor: on ? theme.color.text.primary : 'transparent' }, taken && styles.taken]}
            >
              {on && <Check size={18} color={theme.color.text.inverse} weight="bold" />}
              {taken && <Text variant="label/md" color={theme.color.text.inverse}>{(partnerName ?? '?').charAt(0)}</Text>}
            </Pressable>
          );
        })}
      </View>

      <Text variant="label/md" color={theme.color.text.muted}>Your avatar</Text>
      <View style={styles.row}>
        <Pressable onPress={() => set({ avatar: null })} accessibilityRole="radio" accessibilityState={{ selected: !value.avatar }} accessibilityLabel="Just my initial"
          style={[styles.emoji, !value.avatar && { borderColor: tones[value.color].face }]}>
          <Text variant="title/md">{initial ?? 'Aa'}</Text>
        </Pressable>
        {AVATARS.map((a) => (
          <Pressable key={a} onPress={() => set({ avatar: a })} accessibilityRole="radio" accessibilityState={{ selected: value.avatar === a }}
            style={[styles.emoji, value.avatar === a && { borderColor: tones[value.color].face }]}>
            <Text style={styles.emojiText}>{a}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  preview: { alignItems: 'center', paddingVertical: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  taken: { opacity: 0.35 },
  emoji: { width: 48, height: 48, borderRadius: 12, borderWidth: 2, borderColor: theme.color.border.subtle, backgroundColor: theme.color.bg.surface, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 24, lineHeight: 30 },
});
