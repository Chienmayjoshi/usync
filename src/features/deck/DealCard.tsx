import { View } from 'react-native';
import Animated, { interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { useAccount, useNames } from '@/features/account/account';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import type { PersonColor, Tone } from '@/theme/tokens';
import { Avatar } from '@/ui/AvatarPair';
import { Glow } from '@/ui/Glow';
import { Text } from '@/ui/Text';

import type { Card } from './model';

export type People = { me: PersonColor; partner: PersonColor };

/** Each person's cards glow in their own color; together is gold, the table neutral. */
export function toneFor(card: Card, colors: People): Tone {
  if (card.owner === 'together') return 'gold';
  if (card.owner === 'table') return 'neutral';
  if (card.owner === 'partner') return colors.partner;
  return colors.me;
}

export type Hints = { left: string | null; up: string | null; down: string | null; right: string };

/** Swipe hints per card. Solo (partner not joined yet) a deal can only be taken or skipped. */
export function hintsFor(card: Card, solo = false): Hints {
  if (card.status === 'active') return { left: 'later', up: null, down: null, right: 'done' };
  if (solo) return { left: null, up: null, down: 'skip', right: 'take it' };
  return { left: card.traded ? 'to the table' : 'trade', up: 'together', down: 'skip', right: 'take it' };
}

type Props = { card: Card; flip: SharedValue<number>; minHeight?: number };

/** A deck card with a front (the job) and a back (the job story). `flip` runs 0 -> 1. */
export function DealCard({ card, flip, minHeight = 300 }: Props) {
  const t = useTheme();
  const s = useStyles();
  const names = useNames();
  const { partner } = useAccount();
  const toneKey = toneFor(card, names.colors);
  const tone = t.tones[toneKey];
  const tag = card.status === 'active' ? (card.owner === 'together' ? 'Together' : 'On your deck')
    : card.droppedBy === 'partner' ? `From ${names.partnerOr}` : card.owner === 'together' ? 'Together' : 'Dealt to you';
  const meta = [card.bucket, card.effort, card.when].filter(Boolean).join('  ·  ');
  const showPartner = !!partner && (card.owner === 'together' || card.owner === 'partner' || card.droppedBy === 'partner');
  const showMe = card.owner !== 'partner';

  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
  }));

  return (
    <View>
      <Animated.View style={[s.face, { minHeight }, s.hidden, front]}>
        <Glow colors={tone.glow} />
        <View style={s.top}>
          <View style={s.people}>
            {showMe && <Avatar initial={names.initials.a} avatar={names.avatars.a} color={names.colors.me} size={36} />}
            {showPartner && (
              <View style={showMe && s.overlap}>
                <Avatar initial={names.initials.b} avatar={names.avatars.b} color={names.colors.partner} size={36} />
              </View>
            )}
          </View>
          <View style={s.tag}>
            <Text variant="display/sm" color={t.color.accent.tag} numberOfLines={1}>{tag}</Text>
          </View>
        </View>
        <View style={s.spacer} />
        <Text variant="display/xl">{card.title}</Text>
        {!!card.detail && <Text variant="body/md" color={t.color.text.secondary}>{card.detail}</Text>}
        <Text variant="body/sm" color={t.color.text.secondary}>{meta}</Text>
      </Animated.View>

      <Animated.View style={[s.face, s.back, s.hidden, back]}>
        <View style={s.top}>
          <Text variant="label/md" color={t.color.text.secondary}>The story so far</Text>
          <View style={s.holdPill}>
            <Text variant="button/sm" color={t.color.text.onColor}>Hold to update</Text>
          </View>
        </View>
        <Text variant="display/md">{card.title}</Text>
        <View style={s.timeline}>
          {(card.story.length ? card.story : ['Nothing yet. Hold the card to add an update.']).map((line, i, all) => (
            <View key={`${i}-${line}`} style={s.event}>
              <View style={s.rail}>
                <View style={[s.dot, { backgroundColor: i === all.length - 1 ? tone.face : t.color.text.placeholder }]} />
                {i < all.length - 1 && <View style={s.line} />}
              </View>
              <Text variant="body/lg" style={s.flex}>{line}</Text>
            </View>
          ))}
        </View>
        <View style={s.spacer} />
        <Text variant="caption" color={t.color.text.muted}>Written by usync from your one line updates. Tap to flip back.</Text>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  face: {
    backgroundColor: t.color.bg.raised, borderRadius: t.radius.xl, borderWidth: 2, borderColor: t.color.border.card,
    padding: 24, gap: 10, overflow: 'hidden', boxShadow: t.shadow.card,
  },
  hidden: { backfaceVisibility: 'hidden' },
  back: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  people: { flexDirection: 'row' },
  overlap: { marginLeft: -8 },
  tag: { backgroundColor: t.scheme === 'light' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.35)', borderRadius: t.radius.full, paddingHorizontal: 10, paddingVertical: 5, flexShrink: 1 },
  holdPill: { backgroundColor: t.color.action.neutral, borderRadius: t.radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  spacer: { flex: 1, minHeight: 8 },
  timeline: { marginTop: 6 },
  event: { flexDirection: 'row', gap: 12 },
  rail: { width: 10, alignItems: 'center', paddingTop: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  line: { flex: 1, width: 1, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: t.color.text.placeholder, marginVertical: 2, minHeight: 14 },
  flex: { flex: 1, paddingBottom: 10 },
}));
