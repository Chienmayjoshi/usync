import { View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useSharedValue } from 'react-native-reanimated';

import { useNames } from '@/features/account/account';
import { askLine } from '@/features/mascot/lines';
import { useNow } from '@/features/mascot/useNow';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/ui/Text';

import { DealCard, toneFor } from './DealCard';
import type { Card } from './model';

const OUT = Easing.bezier(0.23, 1, 0.32, 1);

type Props = { asks: Card[]; onAccept: (c: Card) => void; onDecline: (c: Card) => void };

/**
 * What my partner asked of me, pinned above My Deck: a full card with big answers, and their
 * mascot standing behind it doing the asking. Several asks wait behind it as plates; answering
 * one lets it go first, then the next comes forward.
 */
export function AskCard({ asks, onAccept, onDecline }: Props) {
  const t = useTheme();
  const s = useStyles();
  const names = useNames();
  const now = useNow();
  const flip = useSharedValue(0);
  const card = asks[0];
  if (!card?.request) return null;
  const behind = asks.slice(1, 3);

  return (
    <View style={s.wrap}>
      {asks.length > 1 && (
        <Text variant="label/md" color={t.color.text.secondary} style={s.count}>{`1 of ${asks.length}`}</Text>
      )}
      <View>
        {/* The asks still waiting, as the stack's tilted plates (CardStack Layer), behind the front one. */}
        {behind.map((c, i) => (
          <View
            key={c.id}
            pointerEvents="none"
            style={[s.plate, { backgroundColor: t.tones[toneFor(c, names.colors)].card, transform: [{ translateY: 8 + i * 6 }, { rotate: `${i === 0 ? 2.5 : -2.5}deg` }, { scale: 0.96 - i * 0.03 }] }]}
          />
        ))}
        <Animated.View
          key={card.id}
          entering={FadeIn.duration(200).delay(120).easing(OUT)}
          exiting={FadeOut.duration(140).easing(OUT)}
        >
          <DealCard
            card={card}
            flip={flip}
            minHeight={0}
            answers={{ onAccept: () => onAccept(card), onDecline: () => onDecline(card) }}
            nudge={{
              mood: 'asking', cutout: true, recipe: names.mascots.partner, bg: t.tones[names.colors.partner].glow[0],
              line: askLine(card.request, card.id, names.voices.partner, now),
            }}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  // Room above the card for the mascot standing behind its top edge.
  wrap: { paddingTop: 64, gap: 8, marginBottom: 20 },
  count: { position: 'absolute', top: 40, left: 4 },
  plate: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 24, borderWidth: 1.5, borderColor: '#FFFFFF' },
}));
