import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { type ComposedGesture, GestureDetector, type PanGesture } from 'react-native-gesture-handler';

import { useNames } from '@/features/account/account';
import { revealLabel } from '@/features/drop/priority';
import { lineFor, MOOD_FOR, nudgeKind, nudgeLevel } from '@/features/mascot/lines';
import { useNow } from '@/features/mascot/useNow';
import { haptics } from '@/theme/haptics';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { pad2 } from '@/ui/pad2';
import { Text } from '@/ui/Text';

import { type Card, forMe } from './model';
import { SwipeRow } from './SwipeRow';

type Tab = 'mine' | 'together';

type Props = {
  cards: Card[];
  /** Cards I asked my partner to do together, waiting on their yes (shown under Doing Together). */
  pending?: Card[];
  onDone: (c: Card) => void;
  onLater: (c: Card) => void;
  /** A surprise's left swipe: reveal it a day later. */
  onPostpone: (c: Card) => void;
  onOpen: (c: Card) => void;
  /** A card to bring into view ("id@time"), when sent here from Activity or a push. */
  focusId?: string;
  /** Shown when the chosen tab has nothing in it. */
  empty: ReactNode;
  /** Room to leave under the last row for Go back to table. */
  bottomSpace: number;
  /** Drags the sheet by its handle and chips. */
  grip: PanGesture | ComposedGesture;
  /** A tap on the handle: expand or settle back. */
  onGripTap: () => void;
  /** Points at the bottom of the list that are off screen or under Go back. */
  covered: number;
  /** Whether the rows run on under that: Go back's fade shows only then. */
  onOverflow: (over: boolean) => void;
};

/**
 * My Deck's sheet (Figma 355:30660): a handle, "My Tasks" and "Doing Together", and one row per
 * task. Swipe a row right to finish it, left to put it back on the table for later. Asks are not
 * here: they are decisions, shown as tiles above the sheet (DecisionTiles).
 */
export function DeckList({ cards, pending = [], onDone, onLater, onPostpone, onOpen, focusId, empty, bottomSpace, grip, onGripTap, covered, onOverflow }: Props) {
  const t = useTheme();
  const s = useStyles();
  const names = useNames();
  const [tab, setTab] = useState<Tab>('mine');
  const scroll = useRef<{ scrollTo: (o: { y: number; animated: boolean }) => void } | null>(null);
  const rowY = useRef(new Map<string, number>());
  const [lit, setLit] = useState<string | null>(null);
  // Sent here for one card: open its tab, scroll to it, and light it up once.
  useEffect(() => {
    const id = focusId?.split('@')[0];
    const c = id ? cards.find((x) => x.id === id) ?? pending.find((x) => x.id === id) : undefined;
    if (!c || forMe(c)) return;
    const pick = setTimeout(() => setTab(c.owner === 'together' ? 'together' : 'mine'), 0);
    const go = setTimeout(() => {
      const y = rowY.current.get(c.id);
      if (y != null) scroll.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
      setLit(focusId ?? null);
    }, 320);
    return () => { clearTimeout(pick); clearTimeout(go); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);
  const litId = lit?.split('@')[0];
  const work = cards.filter((c) => !forMe(c));
  const mine = work.filter((c) => c.owner !== 'together');
  const together = [...work.filter((c) => c.owner === 'together'), ...pending];

  const shown = tab === 'mine' ? mine : together;
  const [box, setBox] = useState({ view: 0, content: 0 });
  const over = shown.length > 0 && box.content - bottomSpace > box.view - covered;
  useEffect(() => { onOverflow(over); }, [over, onOverflow]);
  const now = useNow();
  // A card sitting too long speaks in the partner's mascot's voice (0007's nudges, mirrored).
  const nudgeFor = (c: Card) => {
    const kind = nudgeKind(c);
    const level = kind ? nudgeLevel(c, now, names.nudgeMax) : 0;
    if (!kind || !level) return undefined;
    return {
      mood: MOOD_FOR[level], line: lineFor(c, kind, level, names.voices.partner, now, true),
      recipe: names.mascots.partner, bg: t.tones[names.colors.partner].glow[0], ink: t.tones[names.colors.partner].ink,
    };
  };

  return (
    <View style={s.fill}>
      <GestureDetector gesture={grip}>
        <View style={s.grip}>
          <Pressable onPress={onGripTap} hitSlop={{ top: 12, bottom: 8, left: 40, right: 40 }} accessibilityRole="adjustable" accessibilityLabel="Resize the list">
            <View style={[s.handle, { backgroundColor: t.color.handle }]} />
          </Pressable>
          <View style={s.tabs} accessibilityRole="tablist">
            <TabChip label="My Tasks" count={mine.length} active={tab === 'mine'} onPress={() => setTab('mine')} />
            <TabChip label="Doing Together" count={together.length} active={tab === 'together'} onPress={() => setTab('together')} />
          </View>
        </View>
      </GestureDetector>
      {shown.length ? (
        <ScrollView
          ref={scroll as never}
          onLayout={(e) => { const view = e.nativeEvent.layout.height; setBox((b) => (b.view === view ? b : { ...b, view })); }}
          onContentSizeChange={(_, content) => setBox((b) => (b.content === content ? b : { ...b, content }))}
          style={s.fill} contentContainerStyle={[s.list, { paddingBottom: bottomSpace }]} showsVerticalScrollIndicator={false}>
          {shown.map((c, i) => {
            const waiting = pending.includes(c);
            const ink = t.tones[names.colors.partner].ink;
            const note = waiting
              ? `Waiting for ${names.partnerOr} to say yes`
              : c.surprise ? `Surprise  ·  ${revealLabel(c.dueOn, now)}`
              : undefined;
            return (
              <View key={c.id} onLayout={(e) => rowY.current.set(c.id, e.nativeEvent.layout.y)}>
                <SwipeRow
                  lit={litId === c.id ? lit : null}
                  card={c}
                  first={i === 0}
                  last={i === shown.length - 1}
                  onOpen={() => onOpen(c)}
                  onDone={waiting ? undefined : () => onDone(c)}
                  onLater={waiting || c.owner === 'together' ? undefined : c.surprise ? () => onPostpone(c) : () => onLater(c)}
                  laterStays={c.surprise}
                  labels={c.surprise ? { done: 'REVEAL', later: '+1 DAY' } : undefined}
                  note={note ? { text: note, ink: c.surprise ? t.color.accent.tag : ink } : undefined}
                  nudge={waiting ? undefined : nudgeFor(c)}
                />
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={s.empty}>{empty}</View>
      )}
    </View>
  );
}

/** Figma 355:30665 / 355:30670: the chosen list in the brand orange, the other one quiet. */
function TabChip({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) {
  const t = useTheme();
  const s = useStyles();
  const c = t.color.deckChip;
  const ink = active ? c.onActive : c.idleInk;
  return (
    <Pressable
      onPress={() => { if (!active) { haptics.tick(); onPress(); } }}
      style={[s.chip, active ? { backgroundColor: c.active } : { backgroundColor: c.idle, borderWidth: 1.5, borderColor: c.idleEdge }]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label}, ${count}`}
    >
      <Text style={s.chipLabel} color={ink} numberOfLines={1}>{label}</Text>
      <Text style={s.chipCount} color={ink}>{pad2(count)}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  fill: { flex: 1 },
  // Figma 355:30661: the handle, 16, then the chips; 12 more down to the list.
  grip: { alignItems: 'center', gap: 16, paddingTop: 8, paddingBottom: 12, paddingHorizontal: 16 },
  handle: { width: 40, height: 4, borderRadius: 12 },
  tabs: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  chip: { flex: 1, height: 32, borderRadius: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, overflow: 'hidden' },
  chipLabel: { fontFamily: 'Satoshi-Medium', fontSize: 14, lineHeight: 19, flexShrink: 1 },
  chipCount: { fontFamily: 'Satoshi-Bold', fontSize: 14, lineHeight: 19 },
  list: { paddingHorizontal: 16 },
  empty: { paddingTop: 40, paddingHorizontal: 16 },
}));
