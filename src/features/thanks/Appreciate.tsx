import { Smiley, X } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useNames } from '@/features/account/account';
import type { Card } from '@/features/deck/model';
import { useDeck } from '@/features/deck/store';
import { errorText } from '@/lib/supabase';
import { haptics } from '@/theme/haptics';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

import { type Reaction, REACTIONS, reactionOf } from './reactions';

/**
 * Appreciate a finished card (Figma 299:25101). Tap it and the four open in its place, with a
 * cross to close; tap one to send it. Once sent it reads "❤️ Appreciated", and a tap opens the
 * four again to change it. Plain taps only: nothing to hold, nothing to slide.
 */
export function Appreciate({ card }: { card: Card }) {
  const t = useTheme();
  const s = useStyles();
  const names = useNames();
  const toast = useToast();
  const { reacted, react, retract } = useDeck();
  const sent = reacted.get(card.id);
  const [open, setOpen] = useState(false);

  const send = (key: Reaction) => {
    setOpen(false);
    if (key === sent) return;
    haptics.success();
    const r = reactionOf(key);
    react(card.id, key)
      .then(() => toast({
        kind: 'info', title: `Sent ${r.emoji} to ${names.partnerOr}`, body: card.title, ms: 5000,
        action: { label: 'Undo', onPress: () => { haptics.tick(); retract(card.id).catch(() => undefined); } },
      }))
      .catch((e) => toast({ kind: 'info', title: 'That didn’t send', body: errorText(e) }));
  };

  if (open) {
    return (
      <View style={s.options}>
        <Pressable onPress={() => { haptics.tick(); setOpen(false); }} hitSlop={4} accessibilityRole="button" accessibilityLabel="Close"
          style={({ pressed }) => [s.circle, pressed && s.pressed]}>
          <X size={20} color={t.color.text.primary} />
        </Pressable>
        {REACTIONS.map((r, i) => (
          // Each arrives a beat after the one before, from the cross outwards.
          <Animated.View key={r.key} entering={FadeIn.duration(160).delay(30 + i * 30)}>
            <Pressable onPress={() => send(r.key)} hitSlop={4} accessibilityRole="button" accessibilityLabel={`Send ${r.label}`}
              accessibilityState={{ selected: sent === r.key }}
              style={({ pressed }) => [s.circle, sent === r.key && s.circleOn, pressed && s.pressed]}>
              <Text style={s.emoji} maxFontSizeMultiplier={1}>{r.emoji}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    );
  }

  const mine = sent ? reactionOf(sent) : null;
  return (
    <Pressable onPress={() => { haptics.tick(); setOpen(true); }} hitSlop={4} accessibilityRole="button"
      accessibilityLabel={mine ? `You sent ${mine.label}. Tap to change it` : `Appreciate ${card.title}`}
      style={({ pressed }) => [s.button, pressed && s.pressed]}>
      {mine
        ? <Text style={s.emoji} maxFontSizeMultiplier={1}>{mine.emoji}</Text>
        : <Smiley size={24} color={t.color.accent.tag} />}
      <Text style={s.label} color={t.color.accent.tag}>{mine ? 'Appreciated' : 'Appreciate'}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  // Figma 299:25023: white, a soft green edge, green words, 42 tall.
  button: {
    flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, alignSelf: 'flex-start',
    paddingHorizontal: 16, borderRadius: 40, borderWidth: 1,
    backgroundColor: t.color.bg.raised, borderColor: t.scheme === 'light' ? '#ABDBBE' : '#2C5A3D',
  },
  label: { fontFamily: 'Satoshi-Bold', fontSize: 14, lineHeight: 20 },
  // Figma 299:25035: five 42 circles, 6 apart.
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignSelf: 'flex-start' },
  circle: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: t.scheme === 'light' ? '#D3D3D3' : t.color.border.strong, backgroundColor: t.color.bg.raised,
  },
  circleOn: { borderColor: t.scheme === 'light' ? '#ABDBBE' : '#2C5A3D', borderWidth: 2 },
  emoji: { fontSize: 22, lineHeight: 28, includeFontPadding: false, textAlign: 'center' },
  pressed: { transform: [{ scale: 0.94 }] },
}));
