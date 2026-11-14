import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Image, Pressable, useWindowDimensions, View } from 'react-native';
import { usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation, FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { shareInvite } from '@/features/account/HeaderAvatars';
import { useAccount, useNames } from '@/features/account/account';
import { CardDetail } from '@/features/deck/CardDetail';
import { CardStack, type Rect } from '@/features/deck/CardStack';
import { DecisionTiles } from '@/features/deck/DecisionTiles';
import { DeckList } from '@/features/deck/DeckList';
import { DeckPill, PILL_ABOVE_NAV, PILL_OUTER } from '@/features/deck/DeckPill';
import { sheetFollow, sheetSnap } from '@/features/deck/deckSheet';
import { CARD_H } from '@/features/deck/DealCard';
import { GO_BACK_H, GoBack, goBackBottom } from '@/features/deck/GoBack';
import { type Card, deckCards, forMe, pendingTogether, tableCards } from '@/features/deck/model';
import { useFocus } from '@/features/deck/focus';
import { useDeck } from '@/features/deck/store';
import { useMoves } from '@/features/deck/useMoves';
import { MOOD_FOR, nudgeLevel } from '@/features/mascot/lines';
import { useMascotPrompt } from '@/features/mascot/useMascotPrompt';
import { useNow } from '@/features/mascot/useNow';
import { haptics } from '@/theme/haptics';
import { ease } from '@/theme/motion';
import { UpdateSheet } from '@/features/update/UpdateSheet';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Backdrop } from '@/ui/Backdrop';
import { useLightStatusBar, useNavChrome } from '@/ui/navChrome';
import { BODY_TOP, ScreenHeader } from '@/ui/ScreenHeader';
import { navBottom, NAV_H } from '@/ui/TabBar';
import { Text } from '@/ui/Text';

// Figma 355:30606 (My Deck), from the status bar inset (54 there): the decision tiles at 140, the
// sheet at 340 under them (180 tall + 20), or at 140 when there are none or it is dragged up.
const TILES_TOP = 86; // HEADER_TOP 18 + header 56 + 12
const SHEET_REST = TILES_TOP + 180 + 20;
/** Switching Table <-> My Deck: opening takes the panel's 300, closing is quicker. */
const OPEN = { duration: 300, easing: ease.out };
const CLOSE = { duration: 220, easing: ease.out };
const SNAP = { duration: 300, dampingRatio: 0.8 };

/**
 * The Table: everything nobody has claimed yet, as a stack, on the light body under the dark
 * header (Figma 355:30851). Press a card, then drag it down to the My Deck pill to take it; swipe
 * up and down through the stack, right to do it together, left to ask your partner. Tap the pill
 * for My Deck (355:30606): your partner's asks as tiles up top, your list in a sheet below, and
 * "Go back to table" where the nav was.
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
  const nav = useNavChrome();
  const { setHidden } = nav;
  const reduced = useReducedMotion();
  useMascotPrompt();
  useLightStatusBar();
  const [updating, setUpdating] = useState<Card | null>(null);
  const [opened, setOpened] = useState<{ card: Card; from: Rect } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [raised, setRaised] = useState(false);
  const rect = useSharedValue<Rect>({ x: -1000, y: -1000, w: 0, h: 0 });
  const slot = useSharedValue({ x: 0, y: 0 });
  const trayReady = useSharedValue(0);
  const hot = useSharedValue(0);

  // Until a partner joins there is no one to share with: your deck and the table are one stack,
  // and My Deck stays away (Figma 212:21257).
  const solo = !partner;
  const table = solo ? [...deckCards(state), ...tableCards(state)] : tableCards(state);
  const deck = deckCards(state);
  const asks = deck.filter(forMe);
  const bodyTop = insets.top + BODY_TOP;
  const tilesTop = insets.top + TILES_TOP;
  const restTop = asks.length ? insets.top + SHEET_REST : tilesTop;
  const pillBottom = navBottom(insets.bottom) + NAV_H + PILL_ABOVE_NAV;
  const them = names.partnerOr;
  // Figma's card is 394 tall on an 844 phone, 24 clear of the pill. A shorter phone gets a shorter
  // card (never under 300) rather than one that runs into the pill. The stack frame starts 28 into
  // the body (355:30868); solo, under the invite strip.
  const stackTop = solo ? bodyTop + 24 + 158 : bodyTop + 28;
  const floor = solo ? navBottom(insets.bottom) + NAV_H : pillBottom + PILL_OUTER;
  const cardH = Math.round(Math.max(300, Math.min(CARD_H, screenH - floor - 24 - stackTop - 52)));
  const now = useNow();
  // The most ignored card in my deck decides how the partner's mascot looks, peeking over the pill.
  const deckLevel = deck.reduce<number>((m, c) => Math.max(m, nudgeLevel(c, now, names.nudgeMax)), 0) as 0 | 1 | 2 | 3;
  const peek = deckLevel ? { recipe: names.mascots.partner, mood: MOOD_FOR[deckLevel], bg: t.tones[names.colors.partner].glow[0] } : undefined;

  // mode: 0 the Table, 1 My Deck. sheetY: the body's top edge, in screen points.
  const mode = useSharedValue(0);
  const sheetY = useSharedValue(bodyTop);
  const restY = useSharedValue(restTop);
  const topY = useSharedValue(tilesTop);
  const startY = useSharedValue(0);
  useEffect(() => { restY.set(restTop); topY.set(tilesTop); }, [restTop, tilesTop, restY, topY]);

  const show = useCallback((open: boolean) => {
    const go = open ? OPEN : CLOSE;
    mode.set(withTiming(open ? 1 : 0, go));
    const to = open ? restY.value : bodyTop;
    sheetY.set(reduced ? to : withTiming(to, go));
    setHidden(open);
    setExpanded(open);
    setRaised(false);
  }, [mode, sheetY, restY, bodyTop, setHidden, reduced]);
  const toggle = () => { haptics.tick(); show(!expanded); };

  // My Deck is a peek from the Table, not a place: leaving the tab closes it, so coming back
  // always lands on the stack. Closed instantly, as the screen is out of sight by then.
  useFocusEffect(useCallback(() => () => {
    mode.set(0); sheetY.set(bodyTop); setHidden(false); setExpanded(false); setRaised(false);
  }, [mode, sheetY, bodyTop, setHidden]));
  // Android's back closes My Deck first.
  useEffect(() => {
    if (!expanded) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { show(false); return true; });
    return () => sub.remove();
  }, [expanded, show]);
  // The last ask answered: the tiles have gone, so the header area folds and the sheet rises.
  useEffect(() => {
    if (!expanded || raised) return;
    sheetY.set(reduced ? restTop : withTiming(restTop, OPEN));
  }, [restTop, expanded, raised, sheetY, reduced]);

  // Sent here from Activity or a push: bring that card into view (the Table's front, or My Deck).
  const { focus, clear } = useFocus();
  const [focusId, setFocusId] = useState<string | undefined>();
  useEffect(() => {
    if (!focus || focus.place === 'partner') return;
    // After this screen has come into view (the tab switch happens in the same tap).
    const go = setTimeout(() => {
      show(focus.place !== 'table' && !solo);
      setFocusId(focus.id ? `${focus.id}@${focus.at}` : undefined);
      clear();
    }, 0);
    return () => clearTimeout(go);
  }, [focus, clear, show, solo]);

  // The sheet by its handle: 1:1 between resting under the tiles and up over them, rubber band
  // past either; let go, it springs to the nearer stop or the way it was flung.
  const settled = (up: boolean) => { setRaised(up); haptics.tick(); };
  const grip = usePanGesture({
    enabled: expanded,
    activeOffsetY: [-6, 6],
    onActivate: () => {
      'worklet';
      cancelAnimation(sheetY);
      startY.set(sheetY.value);
    },
    onUpdate: (e) => {
      'worklet';
      sheetY.set(sheetFollow(startY.value + e.translationY, restY.value, topY.value));
    },
    onDeactivate: (e) => {
      'worklet';
      const to = sheetSnap(sheetY.value, e.velocityY, restY.value, topY.value);
      const was = startY.value <= topY.value + 1;
      sheetY.set(withSpring(to, { ...SNAP, velocity: e.velocityY }));
      const up = to === topY.value && restY.value > topY.value;
      if (up !== was) scheduleOnRN(settled, up);
    },
  });
  const tapGrip = () => {
    if (restTop <= tilesTop) return;
    const up = !raised;
    sheetY.set(withSpring(up ? tilesTop : restTop, SNAP));
    settled(up);
  };

  const stackOut = useAnimatedStyle(() => ({ opacity: 1 - mode.value, transform: [{ translateY: -mode.value * 12 }] }));
  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));
  // The list arrives just after the sheet starts moving, and goes first on the way back.
  const listIn = useAnimatedStyle(() => ({ opacity: Math.max(0, (mode.value - 0.25) / 0.75) }));
  const pillAway = useAnimatedStyle(() => ({ opacity: 1 - nav.away.value, transform: [{ translateY: nav.away.value * 40 }] }));

  return (
    <View style={s.screen}>
      <Backdrop />
      {/* Figma 355:30854: the header on the dark top, 72 down on a 54 inset. */}
      <ScreenHeader title={expanded ? 'My deck' : 'On table'} count={ready ? (expanded ? deck.length : table.length) : undefined} />

      {expanded && asks.length > 0 && (
        <Animated.View style={[s.tiles, { top: tilesTop }]} exiting={FadeOut.duration(140)}>
          <DecisionTiles asks={focused(asks, focusId)} onAccept={(c) => move(c, 'accept')} onDecline={(c) => move(c, 'decline')} />
        </Animated.View>
      )}

      {/* Figma 355:30867 / 355:30660: one light body, the Table's floor and My Deck's sheet. */}
      <Animated.View style={[s.panel, { height: screenH, borderTopWidth: expanded ? 2 : 4 }, panel]}>
        {!solo && (
          <Animated.View style={[s.sheet, { height: screenH - tilesTop }, listIn]} pointerEvents={expanded ? 'box-none' : 'none'}>
            <DeckList
              cards={deck}
              pending={pendingTogether(state)}
              focusId={expanded ? focusId : undefined}
              onDone={(c) => move(c, 'done')}
              onLater={(c) => move(c, 'table')}
              onPostpone={(c) => move(c, 'postpone')}
              onOpen={setUpdating}
              bottomSpace={GO_BACK_H + goBackBottom(insets.bottom) + 24 + (raised ? 0 : restTop - tilesTop)}
              grip={grip}
              onGripTap={tapGrip}
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
      </Animated.View>

      {solo && inviteCode && <InviteStrip code={inviteCode} top={bodyTop + 24} />}

      <Animated.View style={[s.table, { top: stackTop }, stackOut]} pointerEvents={expanded ? 'none' : 'box-none'}>
        {!ready ? null : table.length ? (
          <CardStack
            cards={table}
            cardH={cardH}
            onOpen={(card, from) => setOpened({ card, from })}
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
        <Animated.View style={[s.pill, pillAway]} pointerEvents={expanded ? 'none' : 'box-none'}>
          <DeckPill cards={deck} onToggle={toggle} bottom={pillBottom} rect={rect} slot={slot} ready={trayReady} hot={hot} peek={peek} />
        </Animated.View>
      )}

      {!solo && <GoBack onBack={toggle} shown={mode} visible={expanded} />}

      {opened && <CardDetail card={opened.card} from={opened.from} onClosed={() => setOpened(null)} onUpdate={setUpdating} />}
      {updating && <UpdateSheet card={updating} onClose={() => setUpdating(null)} />}
    </View>
  );
}

/** The ask a tap was about goes first. */
function focused(asks: Card[], focusId?: string) {
  const id = focusId?.split('@')[0];
  const i = id ? asks.findIndex((a) => a.id === id) : -1;
  return i > 0 ? [asks[i], ...asks.slice(0, i), ...asks.slice(i + 1)] : asks;
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
  screen: { flex: 1 },
  // Over the dark top, under the sheet when it is dragged up over them.
  tiles: { position: 'absolute', left: 0, right: 0, zIndex: 1 },
  // Figma 355:30867: 8 in from each side, #FDFDFD, a white top edge, 24 top corners.
  panel: {
    position: 'absolute', left: 8, right: 8, top: 0, zIndex: 2, overflow: 'hidden',
    backgroundColor: t.color.body.fill, borderColor: t.color.body.edge,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  sheet: { position: 'absolute', left: 0, right: 0, top: 0 },
  pill: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, zIndex: 2 },
  // Above the pill, so a card carried down as a circle passes over it.
  table: { position: 'absolute', left: 20, right: 20, gap: 32, zIndex: 3 },
  empty: { alignItems: 'center', gap: 10 },
  art: { width: 200, height: 220 },
  emptyTitle: { textTransform: 'none', fontSize: 26 },
  center: { textAlign: 'center' },
  invite: {
    position: 'absolute', left: 20, right: 20, zIndex: 3, backgroundColor: t.color.bg.surface, borderRadius: 14,
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
