import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, { Easing, interpolate, type SharedValue, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useNames } from '@/features/account/account';
import type { Card } from '@/features/deck/model';
import { useDeck } from '@/features/deck/store';
import { errorText } from '@/lib/supabase';
import { haptics } from '@/theme/haptics';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

import { type Reaction, REACTIONS, reactionOf, slotAt } from './reactions';

const HINT_KEY = 'usync.appreciate.hint';
const SLOT = 44;
const PAD = 10;
const PILL_W = SLOT * REACTIONS.length + PAD * 2;
/** The pill pops from the button with a little give: a finger put it there (animate-expo: spring). */
const POP = { duration: 320, dampingRatio: 0.72 } as const;
const OUT = Easing.bezier(0.23, 1, 0.32, 1);

type Props = {
  card: Card;
  /** Where the picker opens from: the button's left edge (rows) or its right edge (album rows). */
  align?: 'left' | 'right';
  /** Show "Add a line" after sending. */
  withNote?: boolean;
};

/**
 * Appreciate a finished card (Figma 295:7427). Tap: a heart, right away. Press and hold: five
 * reactions rise above the button; slide to one and let go to send it, let go elsewhere to cancel.
 * Once sent it shows what you sent, and holding it again changes it.
 */
export function Appreciate({ card, align = 'left', withNote = true }: Props) {
  const t = useTheme();
  const s = useStyles();
  const names = useNames();
  const toast = useToast();
  const { reacted, react, retract, askHeart } = useDeck();
  const sent = reacted.get(card.id);
  const [hint, setHint] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [btnW, setBtnW] = useState(120);
  const open = useSharedValue(0);
  const hover = useSharedValue(-1);
  const pillLeft = align === 'right' ? btnW - PILL_W : 0;
  const left = useSharedValue(pillLeft);
  useEffect(() => { left.set(pillLeft); }, [left, pillLeft]);

  useEffect(() => {
    if (sent) return;
    AsyncStorage.getItem(HINT_KEY).then((v) => { if (!v) setHint(true); }).catch(() => undefined);
  }, [sent]);
  const hintSeen = () => { if (hint) { setHint(false); AsyncStorage.setItem(HINT_KEY, '1').catch(() => undefined); } };

  const send = (key: Reaction) => {
    hintSeen();
    haptics.success();
    const r = reactionOf(key);
    react(card.id, key)
      .then(() => toast({
        kind: 'info', title: `Sent ${r.emoji} to ${names.partnerOr}`, body: card.title, ms: 5000,
        action: { label: 'Undo', onPress: () => { haptics.tick(); retract(card.id).catch(() => undefined); } },
      }))
      .catch((e) => toast({ kind: 'info', title: 'That didn’t send', body: errorText(e) }));
  };
  const opened = () => { hintSeen(); haptics.press(); };
  const moved = (i: number | null) => { setHovered(i); if (i != null) haptics.tick(); };

  const pan = usePanGesture({
    activateAfterLongPress: 280,
    onActivate: () => {
      'worklet';
      hover.set(-1);
      open.set(withSpring(1, POP));
      scheduleOnRN(opened);
    },
    onUpdate: (e) => {
      'worklet';
      // Only near the pill's row counts; far above or below cancels.
      const near = e.y > -SLOT * 2.6 && e.y < SLOT * 1.4;
      const i = near ? slotAt(e.x - left.get() - PAD, SLOT * REACTIONS.length) : null;
      const next = i ?? -1;
      if (next !== hover.get()) { hover.set(next); scheduleOnRN(moved, i); }
    },
    onDeactivate: () => {
      'worklet';
      const i = hover.get();
      if (i >= 0) scheduleOnRN(send, REACTIONS[i].key);
    },
    onFinalize: () => {
      'worklet';
      hover.set(-1);
      open.set(withTiming(0, { duration: 140, easing: OUT }));
      scheduleOnRN(setHovered, null);
    },
  });
  const tap = useTapGesture({
    onActivate: () => {
      'worklet';
      if (!sent) scheduleOnRN(send, 'heart');
    },
  });
  const gesture = useCompetingGestures(pan, tap);

  const pill = useAnimatedStyle(() => ({
    opacity: open.get(),
    transform: [{ translateY: (1 - open.get()) * 10 }, { scale: 0.9 + open.get() * 0.1 }],
  }));
  const mine = sent ? reactionOf(sent) : null;

  return (
    <View style={s.wrap}>
      <GestureDetector gesture={gesture}>
        <View
          onLayout={(e) => setBtnW(e.nativeEvent.layout.width)}
          accessible
          accessibilityRole="button"
          accessibilityLabel={mine ? `${mine.sent}. Hold to change it` : `Appreciate ${card.title}`}
          accessibilityHint="Tap for a heart, hold for more"
          accessibilityActions={REACTIONS.map((r) => ({ name: r.key, label: r.label }))}
          onAccessibilityAction={(e) => send(e.nativeEvent.actionName as Reaction)}
        >
          {mine ? (
            <View style={s.chip}>
              <Text style={s.emoji} maxFontSizeMultiplier={1}>{mine.emoji}</Text>
              <Text style={s.chipText} color={t.color.text.primary}>{mine.sent}</Text>
            </View>
          ) : (
            <View style={s.button}>
              <Text style={s.buttonText} color={t.color.accent.tag}>Appreciate</Text>
            </View>
          )}
        </View>
      </GestureDetector>

      {mine && withNote && (
        <Pressable onPress={() => { haptics.tick(); askHeart(card); }} hitSlop={8} accessibilityRole="button">
          <Text style={s.link} color={t.tones[names.colors.partner].ink}>Add a line</Text>
        </Pressable>
      )}
      {!mine && hint && (
        <View style={[s.hint, { backgroundColor: t.color.action.primary }]}>
          <Text style={s.hintText} color={t.color.action.onPrimary}>Hold for more</Text>
        </View>
      )}

      {/* The five, above the button. Touch goes through: the button's gesture drives them. */}
      <Animated.View pointerEvents="none" style={[s.pill, { left: pillLeft }, pill]}>
        {REACTIONS.map((r, i) => (
          <Slot key={r.key} i={i} emoji={r.emoji} label={r.label} hover={hover} open={open} lit={hovered === i} />
        ))}
      </Animated.View>
    </View>
  );
}

function Slot({ i, emoji, label, hover, open, lit }: { i: number; emoji: string; label: string; hover: SharedValue<number>; open: SharedValue<number>; lit: boolean }) {
  const s = useStyles();
  const t = useTheme();
  // The one under the finger grows; the rest settle back. Each one arrives a beat after the last.
  const style = useAnimatedStyle(() => {
    const on = hover.get() === i;
    const arrive = interpolate(open.get(), [i * 0.06, i * 0.06 + 0.5], [0, 1], 'clamp');
    return {
      opacity: arrive,
      transform: [
        { translateY: (1 - arrive) * 8 },
        { translateY: withTiming(on ? -10 : 0, { duration: 120, easing: OUT }) },
        { scale: withTiming(on ? 1.45 : 1, { duration: 120, easing: OUT }) },
      ],
    };
  });
  return (
    <View style={s.slot}>
      {lit && (
        <View style={[s.label, { backgroundColor: t.color.action.primary }]}>
          <Text style={s.hintText} color={t.color.action.onPrimary}>{label}</Text>
        </View>
      )}
      <Animated.View style={style}>
        <Text style={s.slotEmoji} maxFontSizeMultiplier={1}>{emoji}</Text>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start', zIndex: 10 },
  // Figma 286:7327: white, a soft green edge, green words.
  button: {
    backgroundColor: t.color.bg.raised, borderRadius: 40, borderWidth: 1, borderColor: t.scheme === 'light' ? '#ABDBBE' : '#2C5A3D',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  buttonText: { fontFamily: 'Satoshi-Bold', fontSize: 14, lineHeight: 20 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.color.bg.raised, borderRadius: 20,
    borderWidth: 1, borderColor: t.color.border.strong, paddingLeft: 10, paddingRight: 12, paddingVertical: 5,
  },
  chipText: { fontFamily: 'Satoshi-Bold', fontSize: 13, lineHeight: 18 },
  emoji: { fontSize: 16, lineHeight: 20 },
  link: { fontFamily: 'Satoshi-Bold', fontSize: 13, lineHeight: 18 },
  hint: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  hintText: { fontFamily: 'Satoshi-Bold', fontSize: 11, lineHeight: 14 },
  pill: {
    position: 'absolute', bottom: '100%', marginBottom: 8, width: PILL_W, height: 60, flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: PAD, paddingBottom: 8, borderRadius: 40, backgroundColor: t.color.bg.raised,
    boxShadow: '0px 8px 24px 0px rgba(0,0,0,0.14)',
  },
  slot: { width: SLOT, alignItems: 'center', justifyContent: 'flex-end' },
  slotEmoji: { fontSize: 30, lineHeight: 38 },
  label: { position: 'absolute', bottom: 58, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
}));
