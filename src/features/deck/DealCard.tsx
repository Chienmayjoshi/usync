import { Pressable, View } from 'react-native';
import Animated, { interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useNames } from '@/features/account/account';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import type { PersonColor, Tone } from '@/theme/tokens';
import { Avatar } from '@/ui/AvatarPair';
import { Blobs } from '@/ui/Glow';
import { PopButton } from '@/ui/PopButton';
import { Text } from '@/ui/Text';

import { type Card, forMe, isQuick } from './model';

/** Figma card: 350 x 300. */
export const CARD_H = 300;

export type People = { me: PersonColor; partner: PersonColor };

/** Whose color a card glows in: the owner's, or for the Table, whoever added it. */
export function toneFor(card: Card, colors: People): Tone {
  if (card.owner === 'together') return 'gold';
  if (card.owner === 'partner') return colors.partner;
  if (card.owner === 'me') return colors.me;
  return card.droppedBy === 'partner' ? colors.partner : colors.me;
}

export type CardAnswers = { onAccept: () => void; onDecline: () => void };

type Props = {
  card: Card;
  flip: SharedValue<number>;
  /** What the back of the card shows: its story, or the delete question (after a hold). */
  back?: 'story' | 'delete';
  answers?: CardAnswers;
  onUpdate?: () => void;
  onDelete?: () => void;
  onCancelDelete?: () => void;
  /** Extra action under the card details, e.g. "Ask for this" on the partner's deck. */
  footer?: React.ReactNode;
  minHeight?: number;
  /** Off when the stack draws the shadow itself, so it can fade as the card moves back. */
  shadow?: boolean;
};

/** A deck card: the job on the front; its story (or the delete question) on the back. */
export function DealCard({ card, flip, back = 'story', answers, onUpdate, onDelete, onCancelDelete, footer, minHeight = CARD_H, shadow = true }: Props) {
  const t = useTheme();
  const s = useStyles();
  const names = useNames();
  const tone = t.tones[toneFor(card, names.colors)];
  const them = names.partnerOr;
  const asking = forMe(card);

  const tag = asking
    ? card.request === 'take' ? `${them} asked you to take` : card.request === 'together' ? `${them} wants to do it together` : `${them} asked for your task`
    : card.request && card.requestedBy === 'me' ? `Waiting on ${them}`
      : card.surprise ? 'Surprise'
        : isQuick(card) ? 'Quick pick' : null;
  const meta = [card.bucket, card.effort, card.when].filter(Boolean).join('  ·  ');
  const people = card.owner === 'together' ? ['me', 'partner'] : card.owner === 'partner' ? ['partner'] : card.owner === 'me' ? ['me']
    : [card.droppedBy === 'partner' ? 'partner' : 'me'];
  const answerLabels = card.request === 'take' ? ['Not this one', 'Take it'] : card.request === 'together' ? ['Not now', 'Yes, together'] : ['Keep it', 'Give it'];

  const front = useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }] }));
  const rear = useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }] }));

  return (
    <View>
      <Animated.View style={[s.face, { minHeight }, !shadow && s.flat, s.hidden, front]}>
        <Blobs
          opacity={t.scheme === 'light' ? 0.8 : undefined}
          blobs={[
            { x: -12, y: -46, size: 152, blur: 84, color: tone.glow[0] },
            { x: 178, y: -46, size: 152, blur: 84, color: tone.glow[1] },
          ]}
        />
        {card.surprise && <Rings />}
        <View style={s.top}>
          <View style={s.people}>
            {people.map((p, i) => (
              <View key={p} style={i > 0 && s.overlap}>
                {p === 'me'
                  ? <Avatar initial={names.initials.a} avatar={names.avatars.a} color={names.colors.me} size={32} />
                  : <Avatar initial={names.initials.b} avatar={names.avatars.b} color={names.colors.partner} size={32} />}
              </View>
            ))}
          </View>
          {tag && (
            <View style={s.tag}>
              <Text variant="display/sm" color={t.color.accent.tag} numberOfLines={1}>{tag}</Text>
            </View>
          )}
        </View>
        <Text variant="display/xl" color={t.color.text.primary}>{card.title}</Text>
        {card.status === 'waiting' ? (
          <View style={s.waiting}><Text variant="label/md" color={t.color.text.secondary}>Waiting on someone else</Text></View>
        ) : (
          <Text variant="body/md" color={t.color.text.secondary}>{meta}</Text>
        )}
        {asking && answers && (
          <View style={s.answers}>
            <PopButton label={answerLabels[0]} tone="negative" fill onPress={answers.onDecline} />
            <PopButton label={answerLabels[1]} tone="positive" fill onPress={answers.onAccept} />
          </View>
        )}
        {footer}
      </Animated.View>

      <Animated.View style={[s.face, s.back, !shadow && s.flat, s.hidden, rear]}>
        {back === 'delete' ? (
          <View style={s.deleteFace}>
            <Text variant="display/2xl" color={t.color.action.negative} style={s.center}>Delete task?</Text>
            <View style={s.answers}>
              <PopButton label="Cancel" tone="neutral" fill onPress={onCancelDelete} />
              <PopButton label="Delete" tone="negative" fill onPress={onDelete} />
            </View>
          </View>
        ) : (
          <>
            <View style={s.top}>
              <Text variant="label/md" color={t.color.text.secondary}>The story so far</Text>
              {onUpdate && (
                <Pressable onPress={onUpdate} hitSlop={8} accessibilityRole="button" style={s.updatePill}>
                  <Text variant="button/sm" color={t.color.text.onColor}>Add an update</Text>
                </Pressable>
              )}
            </View>
            <Text variant="display/md">{card.title}</Text>
            <View style={s.timeline}>
              {(card.story.length ? card.story : ['Nothing yet.']).map((line, i, all) => (
                <View key={`${i}-${line}`} style={s.event}>
                  <View style={s.rail}>
                    <View style={[s.dot, { backgroundColor: i === all.length - 1 ? tone.face : t.color.text.placeholder }]} />
                    {i < all.length - 1 && <View style={s.line} />}
                  </View>
                  <Text variant="body/lg" style={s.flex}>{line}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Animated.View>
    </View>
  );
}

/** The surprise card's pattern: rows of soft concentric rings along the top and bottom edge. */
function Rings() {
  const t = useTheme();
  const stroke = t.scheme === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.12)';
  const row = (y: number) => Array.from({ length: 8 }, (_, i) => [0, 1, 2, 3].map((r) => (
    <Circle key={`${y}-${i}-${r}`} cx={i * 48 + 12} cy={y} r={8 + r * 7} stroke={stroke} strokeWidth={1.2} fill="none" />
  )));
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} pointerEvents="none">
      <Svg width="100%" height={56} style={{ position: 'absolute', top: 0 }}>{row(14)}</Svg>
      <Svg width="100%" height={56} style={{ position: 'absolute', bottom: 0 }}>{row(42)}</Svg>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  face: {
    backgroundColor: t.color.bg.raised, borderRadius: 24, borderWidth: 2, borderColor: t.color.border.card,
    paddingTop: 40, paddingHorizontal: 24, paddingBottom: 24, gap: 16, overflow: 'hidden', boxShadow: t.shadow.float,
  },
  hidden: { backfaceVisibility: 'hidden' },
  flat: { boxShadow: [] },
  back: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  people: { flexDirection: 'row' },
  overlap: { marginLeft: -8 },
  tag: {
    backgroundColor: t.scheme === 'light' ? '#FFFFFF' : 'rgba(0,0,0,0.4)', borderRadius: 40, borderWidth: 1, borderColor: t.color.border.subtle,
    paddingHorizontal: 12, paddingVertical: 4, flexShrink: 1,
  },
  waiting: { alignSelf: 'flex-start', backgroundColor: t.color.bg.sunken, borderRadius: t.radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  answers: { flexDirection: 'row', gap: 12, marginTop: 8 },
  updatePill: { backgroundColor: t.color.action.neutral, borderRadius: t.radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  spacer: { flex: 1, minHeight: 8 },
  timeline: { marginTop: 6 },
  event: { flexDirection: 'row', gap: 12 },
  rail: { width: 10, alignItems: 'center', paddingTop: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  line: { flex: 1, width: 1, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: t.color.text.placeholder, marginVertical: 2, minHeight: 14 },
  flex: { flex: 1, paddingBottom: 10 },
  deleteFace: { flex: 1, justifyContent: 'center', gap: 24 },
  center: { textAlign: 'center', fontSize: 40, lineHeight: 42 },
}));
