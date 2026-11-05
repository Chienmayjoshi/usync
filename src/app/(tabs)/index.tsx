import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderAvatars, shareInvite } from '@/features/account/HeaderAvatars';
import { useAccount, useNames } from '@/features/account/account';
import { CardStack, type Rect } from '@/features/deck/CardStack';
import { type Card, byWhen, deckCards, forMe, tableCards, type When } from '@/features/deck/model';
import { DeckDrawer } from '@/features/deck/DeckDrawer';
import { useDeck } from '@/features/deck/store';
import { useMoves } from '@/features/deck/useMoves';
import { UpdateSheet } from '@/features/update/UpdateSheet';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { FilterChips } from '@/ui/FilterChips';
import { navBottom } from '@/ui/TabBar';
import { Text } from '@/ui/Text';

/**
 * The Table: everything nobody has claimed yet, as a stack. Drag a card down into My Deck to
 * take it (press, then drag), swipe up and down through the stack, right to do it together, left
 * to ask your partner.
 * My Deck rises from the bottom to show what you carry.
 */
export default function TableScreen() {
  const t = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { state, ready } = useDeck();
  const { partner, inviteCode } = useAccount();
  const names = useNames();
  const move = useMoves();
  const [updating, setUpdating] = useState<Card | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [tableWhen, setTableWhen] = useState<When>('all');
  const [deckWhen, setDeckWhen] = useState<When>('all');
  const open = useSharedValue(0);
  const rect = useSharedValue<Rect>({ x: -1000, y: -1000, w: 0, h: 0 });
  const trayReady = useSharedValue(0);
  const hot = useSharedValue(0);

  // Until a partner joins there is no one to share with: your deck and the table are one stack,
  // and the My Deck drawer stays away (Figma 212:21257).
  const solo = !partner;
  const table = solo ? [...deckCards(state), ...tableCards(state)] : tableCards(state);
  const deck = deckCards(state);
  const tableShown = byWhen(table, tableWhen);
  const deckShown = byWhen(deck, deckWhen);
  const headerTop = insets.top + 18;
  const them = names.partnerOr;

  const counts = (cards: Card[]) => ({ all: cards.length, week: byWhen(cards, 'week').length, later: byWhen(cards, 'later').length });
  const tc = counts(table);
  const dc = counts(deck);

  const tableFade = useAnimatedStyle(() => ({ opacity: 1 - open.value * 0.6 }));

  return (
    <View style={s.screen}>
      {/* Figma: header row 68 tall at y=72 (18 under the status bar), chips 32 below it, the stack 20 below them. */}
      <View style={[s.header, { top: headerTop }]}>
        <Text variant="display/lg" style={s.flex}>{expanded ? 'My deck' : 'On table'}</Text>
        <HeaderAvatars />
      </View>

      {solo && inviteCode && <InviteStrip code={inviteCode} top={headerTop + 76} />}

      <Animated.View style={[s.table, { top: headerTop + (solo ? 234 : 100) }, tableFade]} pointerEvents={expanded ? 'none' : 'box-none'}>
        <FilterChips
          value={tableWhen}
          onChange={setTableWhen}
          glow={t.tones[names.colors.me].glow}
          options={[{ value: 'all', label: 'All Tasks', count: tc.all }, { value: 'week', label: 'This week', count: tc.week }, { value: 'later', label: 'Later', count: tc.later }]}
        />
        {!ready ? null : tableShown.length ? (
          <CardStack
            cards={tableShown}
            actions={solo ? {
              right: { label: 'Done', color: t.color.action.positive, run: (c) => move(c, 'done') },
            } : {
              right: { label: 'Do it together', color: t.color.action.positive, run: (c) => move(c, 'together') },
              left: { label: `Ask ${them}`, color: t.color.action.negative, run: (c) => move(c, 'ask') },
            }}
            drop={solo ? undefined : { rect, ready: trayReady, hot, onDrop: (c) => move(c, 'grab') }}
            onDelete={(c) => move(c, 'delete')}
            onUpdate={setUpdating}
          />
        ) : (
          <Empty
            image={require('@/../assets/illustrations/table-clear.png')}
            title="The Table Is Clear."
            body={table.length ? 'Nothing here for this filter.' : solo ? 'Nothing to do right now.\nAdd something new with +.' : 'Everything has an owner right now.\nAdd something new, or open your deck.'}
          />
        )}
      </Animated.View>

      {!solo && <DeckDrawer
        open={open}
        expanded={expanded}
        setExpanded={setExpanded}
        openTop={headerTop + 88}
        navBottom={navBottom(insets.bottom)}
        cards={deck}
        rect={rect}
        ready={trayReady}
        hot={hot}
        chips={(
          <FilterChips
            value={deckWhen}
            onChange={setDeckWhen}
            variant="drawer"
            glow={t.tones[names.colors.me].glow}
            options={[{ value: 'all', label: 'My Tasks', count: dc.all }, { value: 'week', label: 'This week', count: dc.week }, { value: 'later', label: 'Later', count: dc.later }]}
          />
        )}
      >
        {deckShown.length ? (
          <CardStack
            cards={deckShown}
            actions={{
              right: { label: 'Done', color: t.color.action.positive, run: (c) => move(c, 'done') },
              left: { label: 'Back to table', color: t.color.action.negative, run: (c) => move(c, 'table') },
            }}
            onDelete={(c) => move(c, 'delete')}
            onUpdate={setUpdating}
            surface="drawer"
            answer={(c) => (forMe(c) ? { onAccept: () => move(c, 'accept'), onDecline: () => move(c, 'decline') } : undefined)}
          />
        ) : (
          <Empty
            image={require('@/../assets/illustrations/hand-cleared.png')}
            title="Hand Cleared."
            body={deck.length ? 'Nothing here for this filter.' : `Nothing on your deck.\n${table.length} ${table.length === 1 ? 'card is' : 'cards are'} still on the table.`}
          />
        )}
      </DeckDrawer>}

      {updating && <UpdateSheet card={updating} onClose={() => setUpdating(null)} />}
    </View>
  );
}

function Empty({ image, title, body }: { image: number; title: string; body: string }) {
  const t = useTheme();
  const s = useStyles();
  return (
    <Animated.View entering={FadeIn.duration(300)} style={s.empty}>
      <Image source={image} style={s.art} resizeMode="contain" />
      <Text variant="display/xl" style={[s.center, s.emptyTitle]}>{title}</Text>
      <Text variant="body/md" color={t.color.text.secondary} style={s.center}>{body}</Text>
    </Animated.View>
  );
}

/** Figma "Invite strip" (214:21517): the code to send, until your person joins. */
function InviteStrip({ code, top }: { code: string; top: number }) {
  const t = useTheme();
  const s = useStyles();
  return (
    <View style={[s.invite, { top }]}>
      <View style={s.inviteText}>
        <Text style={s.inviteLabel} color={t.color.text.secondary}>INVITE YOUR PERSON</Text>
        <Text style={s.code} color={t.color.text.primary} accessibilityLabel={`Code ${code}`}>{code.split('').join(' ')}</Text>
        <Text style={s.inviteBody} color={t.color.text.primary}>Until they join, everything you add is you to pick</Text>
      </View>
      <Pressable onPress={() => shareInvite(code)} accessibilityRole="button" accessibilityLabel="Share code" hitSlop={8} style={s.share}>
        <Text style={s.shareText} color={t.color.action.onPrimary}>SHARE CODE</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.color.bg.canvas },
  header: { position: 'absolute', left: 20, right: 20, height: 68, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 6 },
  flex: { flex: 1 },
  table: { position: 'absolute', left: 20, right: 20, gap: 20 },
  empty: { alignItems: 'center', gap: 10 },
  art: { width: 200, height: 220 },
  emptyTitle: { textTransform: 'none', fontSize: 26 },
  center: { textAlign: 'center' },
  invite: {
    position: 'absolute', left: 20, right: 20, backgroundColor: t.color.bg.surface, borderRadius: 14,
    borderWidth: 1, borderStyle: 'dashed', borderColor: t.scheme === 'light' ? '#A3A3A3' : t.color.border.dashed,
    padding: 12, gap: 8, alignItems: 'flex-start',
  },
  inviteText: { gap: 4, alignSelf: 'stretch' },
  inviteLabel: { fontFamily: 'Satoshi-Medium', fontSize: 12, lineHeight: 16 },
  code: { fontFamily: 'Satoshi-Bold', fontSize: 28, lineHeight: 38 },
  inviteBody: { fontFamily: 'Satoshi-Medium', fontSize: 14, lineHeight: 19 },
  share: { backgroundColor: t.color.action.primary, borderRadius: 40, paddingHorizontal: 16, paddingVertical: 5.5 },
  shareText: { fontFamily: 'Satoshi-Bold', fontSize: 12, lineHeight: 16 },
}));
