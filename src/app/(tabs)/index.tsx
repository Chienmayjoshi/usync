import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderAvatars, shareInvite } from '@/features/account/HeaderAvatars';
import { useAccount, useNames } from '@/features/account/account';
import { CardDetail } from '@/features/deck/CardDetail';
import { CardStack, type Rect } from '@/features/deck/CardStack';
import { DeckList } from '@/features/deck/DeckList';
import { DeckPill, PILL_ABOVE_NAV, PILL_OUTER } from '@/features/deck/DeckPill';
import { CARD_H } from '@/features/deck/DealCard';
import { type Card, deckCards, pendingTogether, tableCards } from '@/features/deck/model';
import { useFocus } from '@/features/deck/focus';
import { useDeck } from '@/features/deck/store';
import { useMoves } from '@/features/deck/useMoves';
import { MOOD_FOR, nudgeLevel } from '@/features/mascot/lines';
import { useMascotPrompt } from '@/features/mascot/useMascotPrompt';
import { useNow } from '@/features/mascot/useNow';
import { haptics } from '@/theme/haptics';
import { motion } from '@/theme/motion';
import { UpdateSheet } from '@/features/update/UpdateSheet';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { HEADER_TOP } from '@/ui/Screen';
import { navBottom, NAV_H } from '@/ui/TabBar';
import { Text } from '@/ui/Text';

/**
 * The Table: everything nobody has claimed yet, as a stack. Press a card, then drag it down to the
 * My Deck pill to take it (it turns into a circle on the way); swipe up and down through the stack,
 * right to do it together, left to ask your partner. Tap the pill to see My Deck as a list.
 */
export default function TableScreen() {
  const t = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const { state, ready } = useDeck();
  const { partner, inviteCode } = useAccount();
  const names = useNames();
  const move = useMoves();
  useMascotPrompt();
  const [updating, setUpdating] = useState<Card | null>(null);
  const [opened, setOpened] = useState<{ card: Card; from: Rect } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const open = useSharedValue(0);
  const rect = useSharedValue<Rect>({ x: -1000, y: -1000, w: 0, h: 0 });
  const slot = useSharedValue({ x: 0, y: 0 });
  const trayReady = useSharedValue(0);
  const hot = useSharedValue(0);
  // My Deck is a peek from the Table, not a place: leaving the tab closes it, so coming back
  // always lands on the stack. Closed instantly, as the screen is out of sight by then.
  useFocusEffect(useCallback(() => () => { open.set(0); setExpanded(false); }, [open]));
  // Sent here from Activity or a push: bring that card into view (the Table's front, or My Deck).
  const { focus, clear } = useFocus();
  const [focusId, setFocusId] = useState<string | undefined>();
  useEffect(() => {
    if (!focus || focus.place === 'partner') return;
    // After this screen has come into view (the tab switch happens in the same tap).
    const go = setTimeout(() => {
      if (focus.place === 'table') {
        open.set(withTiming(0, motion.panel));
        setExpanded(false);
      } else {
        open.set(withTiming(1, motion.panel));
        setExpanded(true);
      }
      setFocusId(focus.id ? `${focus.id}@${focus.at}` : undefined);
      clear();
    }, 0);
    return () => clearTimeout(go);
  }, [focus, clear, open]);
  const toggle = () => {
    open.set(withTiming(expanded ? 0 : 1, motion.panel));
    setExpanded(!expanded);
    haptics.tick();
  };

  // Until a partner joins there is no one to share with: your deck and the table are one stack,
  // and the My Deck drawer stays away (Figma 212:21257).
  const solo = !partner;
  const table = solo ? [...deckCards(state), ...tableCards(state)] : tableCards(state);
  const deck = deckCards(state);
  const headerTop = insets.top + HEADER_TOP;
  const pillBottom = navBottom(insets.bottom) + NAV_H + PILL_ABOVE_NAV;
  const them = names.partnerOr;
  // Figma's card is 394 tall on an 844 phone, 24 clear of the pill. A shorter phone gets a shorter
  // card (never under 300) rather than one that runs into the pill.
  const stackTop = headerTop + (solo ? 234 : 92);
  const floor = solo ? navBottom(insets.bottom) + NAV_H : pillBottom + PILL_OUTER;
  const cardH = Math.round(Math.max(300, Math.min(CARD_H, screenH - floor - 24 - stackTop - 52)));
  const now = useNow();
  // The most ignored card in my deck decides how the partner's mascot looks, peeking over the pill.
  const deckLevel = deck.reduce<number>((m, c) => Math.max(m, nudgeLevel(c, now, names.nudgeMax)), 0) as 0 | 1 | 2 | 3;
  const peek = deckLevel ? { recipe: names.mascots.partner, mood: MOOD_FOR[deckLevel], bg: t.tones[names.colors.partner].glow[0] } : undefined;

  const tableFade = useAnimatedStyle(() => ({ opacity: 1 - open.value, transform: [{ translateY: -open.value * 12 }] }));
  const listIn = useAnimatedStyle(() => ({ opacity: open.value, transform: [{ translateY: (1 - open.value) * 16 }] }));

  return (
    <View style={s.screen}>
      {/* Figma 300:25102: header row 68 tall at y=72 (18 under the status bar), the stack at 164. */}
      <View style={[s.header, { top: headerTop }]}>
        <Text variant="display/lg" style={s.flex}>{expanded ? 'My deck' : 'On table'}</Text>
        <HeaderAvatars />
      </View>

      {solo && inviteCode && <InviteStrip code={inviteCode} top={headerTop + 76} />}

      <Animated.View style={[s.table, { top: stackTop }, tableFade]} pointerEvents={expanded ? 'none' : 'box-none'}>
        {/* Figma 300:25103: no filters any more; the stack sits right under the header. */}
        {!ready ? null : table.length ? (
          <CardStack
            cards={table}
            cardH={cardH}
            onOpen={(card, from) => setOpened({ card, from })}
            opened={!!opened}
            focusId={expanded ? undefined : focusId}
            actions={solo ? {
              right: { label: 'Done', color: t.color.action.positive, run: (c) => move(c, 'done') },
            } : {
              right: { label: 'Do it together', stamp: 'Doing It\nTogether', color: t.color.action.positive, run: (c) => move(c, 'together') },
              left: { label: `Ask ${them}`, stamp: `Ask\n${them}`, color: t.color.action.negative, run: (c) => move(c, 'ask') },
            }}
            drop={solo ? undefined : { rect, slot, ready: trayReady, hot, onDrop: (c) => move(c, 'grab') }}
            onUpdate={setUpdating}
          />
        ) : (
          <Empty
            image={require('@/../assets/illustrations/table-clear.png')}
            title="The Table Is Clear."
            body={solo ? 'Nothing to do right now.\nAdd something new with +.' : 'Everything has an owner right now.\nAdd something new, or open your deck.'}
          />
        )}
      </Animated.View>

      {!solo && (
        <Animated.View style={[s.list, { top: headerTop + 92 }, listIn]} pointerEvents={expanded ? 'box-none' : 'none'}>
          <DeckList
            cards={deck}
            pending={pendingTogether(state)}
            focusId={expanded ? focusId : undefined}
            onDone={(c) => move(c, 'done')}
            onLater={(c) => move(c, 'table')}
            onPostpone={(c) => move(c, 'postpone')}
            onOpen={setUpdating}
            onAccept={(c) => move(c, 'accept')}
            onDecline={(c) => move(c, 'decline')}
            all={state.cards}
            bottomSpace={pillBottom + PILL_OUTER + 24}
            empty={(
              <Empty
                image={require('@/../assets/illustrations/hand-cleared.png')}
                title="Hand Cleared."
                body={deck.length ? 'Nothing here yet.' : `Nothing on your deck.\n${table.length} ${table.length === 1 ? 'card is' : 'cards are'} still on the table.`}
              />
            )}
          />
        </Animated.View>
      )}

      {!solo && <DeckPill cards={deck} open={expanded} onToggle={toggle} bottom={pillBottom} rect={rect} slot={slot} ready={trayReady} hot={hot} peek={peek} />}

      {opened && <CardDetail card={opened.card} from={opened.from} onClosed={() => setOpened(null)} onUpdate={setUpdating} />}
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
  // Above the pill, so a card carried down as a circle passes over it.
  table: { position: 'absolute', left: 20, right: 20, gap: 32, zIndex: 3 },
  list: { position: 'absolute', left: 20, right: 20, bottom: 0 },
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
