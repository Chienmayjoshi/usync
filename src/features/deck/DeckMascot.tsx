import { Pressable, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut } from 'react-native-reanimated';

import { useNames } from '@/features/account/account';
import type { DeckMood } from '@/features/mascot/lines';
import { Mascot } from '@/features/mascot/Mascot';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/ui/Text';

import type { Card } from './model';

const OUT = Easing.bezier(0.23, 1, 0.32, 1);

type Props = { mood: DeckMood; onOpen: (c: Card) => void };

/**
 * One mascot for the whole deck (Uncle Rudy's way): the partner's, in one mood set by the most
 * ignored card, saying so in one line. Calm when all is well, and a rare proud face on a day you
 * finished things. Tap the line to open the card it is about.
 */
export function DeckMascot({ mood: m, onOpen }: Props) {
  const t = useTheme();
  const s = useStyles();
  const names = useNames();
  const ink = t.tones[names.colors.partner].ink;

  return (
    <View style={s.row}>
      <Animated.View key={m.mood} entering={FadeIn.duration(180).easing(OUT)} exiting={FadeOut.duration(120)}>
        <Mascot recipe={names.mascots.partner} mood={m.mood} size={72} cutout />
      </Animated.View>
      <Pressable
        style={s.bubble}
        disabled={!m.card}
        onPress={() => m.card && onOpen(m.card)}
        accessibilityRole={m.card ? 'button' : 'text'}
        accessibilityLabel={`${names.partnerOr}’s mascot: ${m.line}`}
      >
        <View style={[s.tail, { backgroundColor: t.color.bg.surface }]} />
        <Animated.View key={m.line} entering={FadeIn.duration(180).easing(OUT)}>
          <Text style={s.line} color={m.card ? ink : t.color.text.primary} numberOfLines={3}>{m.line}</Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingTop: 8, marginBottom: 16 },
  bubble: {
    flex: 1, backgroundColor: t.color.bg.surface, borderRadius: 18, borderBottomLeftRadius: 6,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14,
  },
  tail: { position: 'absolute', left: -5, bottom: 0, width: 12, height: 12, transform: [{ rotate: '45deg' }] },
  line: { fontFamily: 'Satoshi-Bold', fontSize: 14, lineHeight: 19 },
}));
