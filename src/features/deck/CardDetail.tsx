import {
  ArrowCircleDown, ArrowCircleUp, CalendarDots, ChatCircleText, CheckCircle, DotOutline, DotsThree, Gift, Handshake, HourglassMedium,
  type IconProps, PlusCircle, Question, X, XCircle,
} from 'phosphor-react-native';
import { type ComponentType, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation, interpolate, type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Line, LinearGradient, Rect as SvgRect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { useNames } from '@/features/account/account';
import { haptics } from '@/theme/haptics';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Avatar } from '@/ui/AvatarPair';
import { Blobs } from '@/ui/Glow';
import { Text } from '@/ui/Text';

import type { Rect } from './CardStack';
import type { Card } from './model';
import { type StoryIcon, storyIcon } from './storyIcon';
import { toneFor } from './taskTone';

/** The stack's spring (the reference: stiffness 170, damping 26), so opening feels like the stack. */
const SPRING = { stiffness: 170, damping: 26, mass: 1 } as const;
/** A pull down on the open card closes it past this, or on a flick this fast. */
const CLOSE_PULL = 120;
const CLOSE_FLING = 800;

// Figma 319:26369: each line of the story gets a phosphor icon, filled, white.
const ICONS: Record<StoryIcon, ComponentType<IconProps>> = {
  added: PlusCircle, asked: Question, undone: XCircle, took: ArrowCircleDown, back: ArrowCircleUp, done: CheckCircle,
  together: Handshake, note: ChatCircleText, waiting: HourglassMedium, surprise: Gift, date: CalendarDots, other: DotOutline,
};

type Props = {
  card: Card;
  /** Where the card sat in the stack (window coordinates): it grows from there and shrinks back to it. */
  from: Rect;
  onClosed: () => void;
  onUpdate: (card: Card) => void;
  /** The "more" button left of close: it closes the card, then opens its actions (delete). */
  onMore?: (card: Card) => void;
};

/**
 * A Table card, opened (Figma 319:26333): the card grows from its place in the stack to fill the
 * screen in its own colours, then its story arrives: people and close, the title, each line of
 * the story, and "Add an update" pinned to the bottom. Close (X, back, or pull it down) and it
 * shrinks back into the stack.
 */
export function CardDetail({ card, from, onClosed, onUpdate, onMore }: Props) {
  const t = useTheme();
  const s = useStyles();
  const names = useNames();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const tone = t.tones[toneFor(card)];
  // Start from the window's size so it opens straight away; the modal's own layout (which also
  // covers the status bar on Android) corrects it a frame later.
  const win = useWindowDimensions();
  const size = { w: win.width, h: win.height };
  const p = useSharedValue(0);
  const pull = useSharedValue(0);
  const W = useSharedValue(win.width);
  const H = useSharedValue(win.height);
  const [contentH, setContentH] = useState(0);
  const [box, setBox] = useState(0);
  const overflow = contentH > box + 1;

  useEffect(() => {
    p.set(reduced ? withTiming(1, { duration: 200 }) : withSpring(1, SPRING));
  }, [p, reduced]);

  const close = (then?: () => void) => {
    haptics.tick();
    const done = () => { onClosed(); then?.(); };
    const end = (finished?: boolean) => { 'worklet'; if (finished) scheduleOnRN(done); };
    p.set(reduced ? withTiming(0, { duration: 160 }, end) : withSpring(0, { ...SPRING, overshootClamping: true }, end));
    pull.set(withSpring(0, SPRING));
  };

  // Pull the open card down to put it back; it follows the finger with some give.
  const drag = usePanGesture({
    activeOffsetY: [-1000, 12],
    failOffsetX: [-24, 24],
    onUpdate: (e) => { 'worklet'; pull.set(Math.max(0, e.translationY) * 0.6); },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > CLOSE_PULL || e.velocityY > CLOSE_FLING) scheduleOnRN(close);
      else pull.set(withSpring(0, { ...SPRING, velocity: e.velocityY }));
    },
  });

  // The card's colour, from its place in the stack to the whole screen. Only this plain, childless
  // panel changes size; everything inside fades and moves with transforms.
  const panel = useAnimatedStyle(() => {
    const full = reduced ? 1 : p.value;
    return {
      // The real card stays in the stack underneath. Near its own size the panel is see-through, so
      // opening starts from the card itself and closing ends on it: a crossfade, never an empty card.
      opacity: reduced ? p.value : interpolate(p.value, [0, 0.22], [0, 1], Extrapolation.CLAMP),
      // Edges, not size: open, every edge is exactly 0, whatever size the screen turns out to be.
      left: interpolate(full, [0, 1], [from.x, 0]),
      top: interpolate(full, [0, 1], [from.y, 0]),
      right: interpolate(full, [0, 1], [Math.max(0, W.value - from.x - from.w), 0]),
      bottom: interpolate(full, [0, 1], [Math.max(0, H.value - from.y - from.h), 0]),
      borderRadius: interpolate(full, [0, 1], [24, 0]),
      transform: [{ translateY: pull.value }, { scale: 1 - pull.value / 2400 }],
    };
  });
  const lights = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.8, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: pull.value }],
  }));

  const people = card.owner === 'together' ? ['me', 'partner'] : card.owner === 'partner' ? ['partner'] : card.owner === 'me' ? ['me']
    : [card.droppedBy === 'partner' ? 'partner' : 'me'];
  const meta = [card.bucket, card.effort, card.when].filter(Boolean).join('  ·  ');
  const story = card.story.length ? card.story : ['Nothing yet.'];

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => close()}>
      <View
        style={s.fill}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          W.set(width);
          H.set(height);
        }}
      >
        <Animated.View style={[s.panel, { backgroundColor: tone.card }, panel]} />
        {!!size.w && (
          <Animated.View style={[s.lights, lights]} pointerEvents="none">
            {/* Figma 319:26334-5: the same two lights as the card, top left and top right. */}
            <Blobs
              opacity={1}
              blobs={[
                { x: -12, y: -46, size: 152, blur: 0, sigma: 72, color: tone.cardGlow[0] },
                { x: 88, y: -137.37, size: 333, blur: 0, sigma: 140, color: tone.cardGlow[1] },
              ]}
            />
          </Animated.View>
        )}

        {!!size.w && (
          <View style={[s.content, { paddingTop: Math.max(56, insets.top + 12), paddingBottom: Math.max(56, insets.bottom + 22) }]}>
            <GestureDetector gesture={drag}>
              <View style={s.head}>
                {/* Figma 319:26337: the people on the card, and close. */}
                <Stage p={p} pull={pull} at={0}>
                  <View style={s.top}>
                    <View style={s.people}>
                      {people.map((who, i) => (
                        <View key={who} style={[s.face, i > 0 && s.overlap]}>
                          {who === 'me'
                            ? <Avatar initial={names.initials.a} avatar={names.avatars.a} color={names.colors.me} size={44} />
                            : <Avatar initial={names.initials.b} avatar={names.avatars.b} color={names.colors.partner} size={44} />}
                        </View>
                      ))}
                    </View>
                    <View style={s.buttons}>
                      {onMore && (
                        <Pressable onPress={() => close(() => onMore(card))} hitSlop={8} accessibilityRole="button" accessibilityLabel="More options"
                          style={({ pressed }) => [s.close, pressed && s.pressed]}>
                          <DotsThree size={24} weight="bold" color="#1A1A1A" />
                        </Pressable>
                      )}
                      <Pressable onPress={() => close()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close"
                        style={({ pressed }) => [s.close, pressed && s.pressed]}>
                        <X size={24} color="#1A1A1A" />
                      </Pressable>
                    </View>
                  </View>
                </Stage>
                {/* Figma 319:26419: what it is. */}
                <Stage p={p} pull={pull} at={1}>
                  <View style={s.titleBlock}>
                    <Text style={s.kicker}>THE STORY SO FAR</Text>
                    <Text style={s.title}>{card.title}</Text>
                    <Text style={s.meta}>{meta}</Text>
                  </View>
                </Stage>
              </View>
            </GestureDetector>

            {/* Figma 319:26369: the story, one line at a time; it scrolls once it is long, fading out above the button. */}
            <View style={s.timelineBox} onLayout={(e) => setBox(e.nativeEvent.layout.height)}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                onContentSizeChange={(_, h) => setContentH(h)}
                contentContainerStyle={s.timeline}
              >
                {story.map((line, i) => {
                  const Icon = ICONS[storyIcon(line)];
                  return (
                    <Stage key={`${i}-${line}`} p={p} pull={pull} at={2 + Math.min(i, 8) * 0.3}>
                      {i > 0 && (
                        <Svg width={20} height={12} style={s.joint}>
                          <Line x1={10} y1={0} x2={10} y2={12} stroke="#FFFFFF" strokeWidth={1} strokeDasharray="2 2" />
                        </Svg>
                      )}
                      <View style={s.row}>
                        <Icon size={20} color="#FFFFFF" weight="fill" />
                        <Text style={s.line}>{line}</Text>
                      </View>
                    </Stage>
                  );
                })}
              </ScrollView>
              {overflow && (
                <Svg style={s.fade} width="100%" height={24} pointerEvents="none">
                  <Defs>
                    <LinearGradient id="detailFade" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={tone.card} stopOpacity={0} />
                      <Stop offset="1" stopColor={tone.card} stopOpacity={1} />
                    </LinearGradient>
                  </Defs>
                  <SvgRect width="100%" height={24} fill="url(#detailFade)" />
                </Svg>
              )}
            </View>

            {/* Figma 319:26430: pinned to the bottom. */}
            <Stage p={p} pull={pull} at={3}>
              <Pressable
                onPress={() => close(() => onUpdate(card))}
                accessibilityRole="button"
                style={({ pressed }) => [s.update, pressed && s.pressed]}
              >
                <Text style={s.updateText}>Add an update</Text>
              </Pressable>
            </Stage>
          </View>
        )}
      </View>
    </Modal>
  );
}

/**
 * One block of the open card arriving: the panel grows first, then each block fades and rises
 * 12 into place, a beat after the one before (at: its place in the order). Closing plays it back,
 * so the content is gone before the panel shrinks.
 */
function Stage({ p, pull, at, children }: { p: SharedValue<number>; pull: SharedValue<number>; at: number; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => {
    const start = 0.55 + at * 0.06;
    const k = interpolate(p.value, [start, Math.min(1, start + 0.3)], [0, 1], Extrapolation.CLAMP);
    return { opacity: k, transform: [{ translateY: (1 - k) * 12 + pull.value }] };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

const useStyles = makeStyles(() => ({
  fill: { flex: 1 },
  panel: { position: 'absolute', overflow: 'hidden' },
  lights: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  // Figma 319:26333: 40 at the sides, 56 top and bottom.
  content: { ...StyleSheet.absoluteFill, paddingHorizontal: 40 },
  head: { gap: 40, paddingBottom: 40 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  buttons: { flexDirection: 'row', gap: 12 },
  people: { flexDirection: 'row' },
  // 48 with a 2 white edge.
  face: { borderRadius: 24, borderWidth: 2, borderColor: '#FFFFFF' },
  overlap: { marginLeft: -8 },
  close: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.97 }] },
  titleBlock: { gap: 16 },
  kicker: { fontFamily: 'Satoshi-Bold', fontSize: 12, lineHeight: 16, letterSpacing: -0.24, color: '#FFFFFF' },
  title: { fontFamily: 'Satoshi-Black', fontSize: 32, lineHeight: 40, letterSpacing: -0.64, color: '#FFFFFF' },
  meta: { fontFamily: 'Satoshi-Medium', fontSize: 14, lineHeight: 19, color: '#FFFFFF' },
  timelineBox: { flex: 1, marginBottom: 16 },
  timeline: { paddingBottom: 24 },
  joint: { marginVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  line: { flex: 1, fontFamily: 'Satoshi-Medium', fontSize: 14, lineHeight: 20, letterSpacing: -0.28, color: '#FFFFFF' },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  update: { height: 48, borderRadius: 40, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  updateText: { fontFamily: 'Satoshi-Bold', fontSize: 16, lineHeight: 20, letterSpacing: -0.32, color: '#1A1A1A' },
}));
