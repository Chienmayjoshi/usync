import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { useNames } from '@/features/account/account';
import { haptics } from '@/theme/haptics';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Avatar } from '@/ui/AvatarPair';
import { Blobs } from '@/ui/Glow';
import { Text } from '@/ui/Text';

import type { Card } from './model';
import { toneFor } from './taskTone';

const OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** Figma 355:30624: 300 wide tiles, 12 apart; the row starts 20 in, under the header's left edge. */
export const TILE_W = 300;
export const TILE_H = 180;
const GAP = 12;
const SIDE = 20;
/** Figma "Take It" (355:30640) and "Not this one" (355:30638). */
const YES = '#22B854';
const NO = '#FF6159';

type Props = { asks: Card[]; onAccept: (c: Card) => void; onDecline: (c: Card) => void };

/**
 * My Deck's decisions, in the dark header (Figma 355:30623): every ask from my partner as a tile
 * in its task's colour, in a row that scrolls sideways, each with its two answers.
 */
export function DecisionTiles({ asks, onAccept, onDecline }: Props) {
  const s = useStyles();
  const { width } = useWindowDimensions();
  // A single decision takes the full width; several keep Figma's 300 so the next one peeks in.
  const only = asks.length === 1;
  const w = only ? width - SIDE * 2 : TILE_W;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEnabled={!only}
      snapToInterval={w + GAP}
      decelerationRate="fast"
      contentContainerStyle={s.row}
      style={s.scroll}
    >
      {asks.map((c, i) => (
        <Tile key={c.id} card={c} index={i} width={w} onAccept={() => onAccept(c)} onDecline={() => onDecline(c)} />
      ))}
    </ScrollView>
  );
}

/** From 24 to the right, fading in, after `delay`. */
const slideIn = (delay: number) => () => {
  'worklet';
  const go = { duration: 260, easing: OUT };
  return {
    initialValues: { opacity: 0, transform: [{ translateX: 24 }] },
    animations: { opacity: withDelay(delay, withTiming(1, go)), transform: [{ translateX: withDelay(delay, withTiming(0, go)) }] },
  };
};

function Tile({ card, index, width, onAccept, onDecline }: { card: Card; index: number; width: number; onAccept: () => void; onDecline: () => void }) {
  const t = useTheme();
  const s = useStyles();
  const names = useNames();
  const reduced = useReducedMotion();
  const tone = t.tones[toneFor(card)];
  const together = card.request === 'together';
  const tag = together ? 'Do it together' : card.request === 'take' ? 'Asked to take it' : 'Asked to give it';
  const [no, yes] = card.request === 'give' ? ['Keep it', 'Give it'] : ['Not this one', 'Take It'];
  const ring = { width: 1.5, color: '#FFFFFF' };
  // In from a little to the right, one after another, once the sheet has started to move.
  const entering = reduced ? FadeIn.duration(160) : slideIn(60 + Math.min(index, 3) * 40);
  return (
    <Animated.View
      entering={entering}
      exiting={FadeOut.duration(140).easing(OUT)}
      layout={reduced ? undefined : LinearTransition.duration(220).easing(OUT)}
      style={[s.tile, { width, backgroundColor: tone.card }]}
    >
      {/* Figma 355:30625-6: a 152 light top left, a 332 x 334 light top right. */}
      <Blobs
        opacity={1}
        blobs={[
          { x: -12, y: -46, size: 152, blur: 0, sigma: 72, color: tone.cardGlow[0] },
          { x: 88, y: -137.37, size: 333, blur: 0, sigma: 140, color: tone.cardGlow[1] },
        ]}
      />
      <View style={s.top}>
        <View style={s.people}>
          {together && <Avatar initial={names.initials.a} avatar={names.avatars.a} color={names.colors.me} size={32} ring={ring} />}
          <View style={together && s.overlap}>
            <Avatar initial={names.initials.b} avatar={names.avatars.b} color={names.colors.partner} size={32} ring={ring} />
          </View>
        </View>
        <View style={s.tag}><Text style={s.tagText} numberOfLines={1}>{tag}</Text></View>
      </View>
      <Text style={s.title} color="#FFFFFF" numberOfLines={2}>{card.title}</Text>
      <View style={s.answers}>
        <Answer label={no} color={NO} onPress={() => { haptics.tick(); onDecline(); }} />
        <Answer label={yes} color={YES} onPress={() => { haptics.success(); onAccept(); }} />
      </View>
    </Animated.View>
  );
}

/** A tile's answer: presses in to 0.97 on touch (feedback before the commit), 120ms. */
function Answer({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  const s = useStyles();
  const press = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  return (
    <Pressable
      style={s.answerWrap}
      onPress={onPress}
      onPressIn={() => press.set(withTiming(0.97, { duration: 100, easing: OUT }))}
      onPressOut={() => press.set(withTiming(1, { duration: 140, easing: OUT }))}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View style={[s.answer, { backgroundColor: color }, style]}>
        <Text style={s.answerText} color="#FFFFFF" numberOfLines={1}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  scroll: { flexGrow: 0, overflow: 'visible' },
  row: { paddingHorizontal: SIDE, gap: GAP },
  // Figma 355:30624: 300 x 180, 24 corners, 16 padding, 16 between blocks, the deal shadow.
  tile: { width: TILE_W, height: TILE_H, borderRadius: 24, padding: 16, gap: 16, overflow: 'hidden', boxShadow: t.shadow.deal },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'stretch', height: 32 },
  people: { flexDirection: 'row' },
  overlap: { marginLeft: -8 },
  // Figma 355:30632: 80% white pill, Satoshi Black 12 caps.
  tag: { backgroundColor: 'rgba(253,253,253,0.8)', borderRadius: 40, paddingHorizontal: 12, justifyContent: 'center', flexShrink: 1, marginLeft: 12 },
  tagText: { fontFamily: 'Satoshi-Black', fontSize: 12, lineHeight: 16, color: '#1A1A1A', textTransform: 'uppercase' },
  // Figma 355:30635: Satoshi Bold 16/22, -0.32.
  title: { fontFamily: 'Satoshi-Bold', fontSize: 16, lineHeight: 22, letterSpacing: -0.32, height: 44 },
  answers: { flexDirection: 'row', gap: 16 },
  answerWrap: { flex: 1 },
  // Figma 355:30638: 40 tall, round, a 1.5 #FDFDFD edge; Satoshi Bold 14, -0.28.
  answer: { height: 40, borderRadius: 40, borderWidth: 1.5, borderColor: '#FDFDFD', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  answerText: { fontFamily: 'Satoshi-Bold', fontSize: 14, lineHeight: 19, letterSpacing: -0.28 },
}));
