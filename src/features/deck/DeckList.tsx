import { type ReactNode, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useNames } from '@/features/account/account';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { FilterChips } from '@/ui/FilterChips';

import type { CardAnswers } from './DealCard';
import type { Card } from './model';
import { SwipeRow } from './SwipeRow';

type Tab = 'mine' | 'together';

type Props = {
  cards: Card[];
  onDone: (c: Card) => void;
  onLater: (c: Card) => void;
  onOpen: (c: Card) => void;
  answer: (c: Card) => CardAnswers | undefined;
  /** Shown when the chosen tab has nothing in it. */
  empty: ReactNode;
  /** Room to leave under the last row for the pill and the nav. */
  bottomSpace: number;
};

const FADE_H = 263;

/**
 * My Deck as a list (Figma 223:22064): "My Tasks" and "Doing Together", one row per task.
 * Swipe a row right to finish it, left to put it back on the table for later.
 */
export function DeckList({ cards, onDone, onLater, onOpen, answer, empty, bottomSpace }: Props) {
  const t = useTheme();
  const s = useStyles();
  const names = useNames();
  const [tab, setTab] = useState<Tab>('mine');
  const mine = cards.filter((c) => c.owner !== 'together');
  const together = cards.filter((c) => c.owner === 'together');
  const shown = tab === 'mine' ? mine : together;
  const f = t.color.fade;

  const labels = (c: Card): [string, string] => (c.request === 'take' ? ['Not this one', 'Take it'] : c.request === 'together' ? ['Not now', 'Yes'] : ['Keep it', 'Give it']);

  return (
    <View style={s.fill}>
      <FilterChips
        value={tab}
        onChange={setTab}
        variant="deck"
        glow={t.tones[names.colors.me].glow}
        options={[{ value: 'mine', label: 'My Tasks', count: mine.length }, { value: 'together', label: 'Doing Together', count: together.length }]}
      />
      {shown.length ? (
        <ScrollView style={s.fill} contentContainerStyle={[s.list, { paddingBottom: bottomSpace }]} showsVerticalScrollIndicator>
          {shown.map((c, i) => {
            const answers = answer(c);
            return (
              <SwipeRow
                key={c.id}
                card={c}
                first={i === 0}
                onOpen={() => onOpen(c)}
                onDone={() => onDone(c)}
                onLater={c.owner === 'together' ? undefined : () => onLater(c)}
                answers={answers}
                answerLabels={answers ? labels(c) : undefined}
              />
            );
          })}
        </ScrollView>
      ) : (
        <View style={s.empty}>{empty}</View>
      )}
      {/* Figma 232:22821: the list fades to white under the pill and the nav. */}
      <View style={[s.fade, { height: FADE_H }]} pointerEvents="none">
        <Svg width="100%" height={FADE_H}>
          <Defs>
            <LinearGradient id="deckFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={f[0]} />
              <Stop offset="0.28621" stopColor={f[1]} />
              <Stop offset="1" stopColor={f[2]} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={FADE_H} fill="url(#deckFade)" />
        </Svg>
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  fill: { flex: 1 },
  // Figma: the list starts 24 under the chips.
  list: { paddingTop: 24 - 4 },
  empty: { paddingTop: 40 },
  fade: { position: 'absolute', left: -20, right: -20, bottom: 0 },
}));
