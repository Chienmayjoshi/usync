import { type ComponentRef, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { GestureDetector, useCompetingGestures, useLongPressGesture, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useAccount, useNames } from '@/features/account/account';
import { haptics } from '@/theme/haptics';
import { motion } from '@/theme/motion';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/ui/Text';

import { DealCard, hintsFor } from './DealCard';
import { canHandOff, type Card } from './model';
import { catchBounce, isOver, useTradeTarget } from './tradeTarget';

/** `give` is a card dropped on the partner's avatar: a trade, whatever state the card is in. */
export type SwipeDir = 'left' | 'right' | 'up' | 'down' | 'give';

type Props = {
  cards: Card[];
  onSwipe: (card: Card, dir: SwipeDir) => void;
  onHold: (card: Card) => void;
};

const THRESHOLD = 110;
const FLING = 900;
const LAND = { duration: 260 };

type Origin = { x: number; y: number; w: number };

/** The deck: only the top card is live; up to two cards peek out behind it. */
export function SwipeDeck({ cards, onSwipe, onHold }: Props) {
  const progress = useSharedValue(0);
  // The deck's window position, so a card dropped on the partner avatar can fly into it.
  const origin = useSharedValue<Origin>({ x: 0, y: 0, w: 0 });
  const ref = useRef<ComponentRef<typeof View>>(null);
  const measure = () => ref.current?.measureInWindow((x, y, w) => origin.set({ x, y, w }));
  const [top, ...rest] = cards;
  const st = useStyles();
  return (
    <View ref={ref} onLayout={measure} collapsable={false} style={st.deck}>
      {rest.slice(0, 2).reverse().map((c, i, arr) => (
        <BehindCard key={c.id} level={arr.length - i} progress={progress} />
      ))}
      {top && <TopCard key={`${top.id}:${top.story.length}`} card={top} progress={progress} origin={origin} onSwipe={onSwipe} onHold={onHold} />}
    </View>
  );
}

/** Cards waiting their turn peek out above the top one, each a shade darker. */
function BehindCard({ level, progress }: { level: number; progress: SharedValue<number> }) {
  const t = useTheme();
  const st = useStyles();
  const style = useAnimatedStyle(() => {
    // As the top card leaves, the cards behind rise one step.
    const lvl = level - progress.value;
    return { transform: [{ translateY: -lvl * 14 }, { scale: 1 - lvl * 0.06 }] };
  });
  return (
    <Animated.View style={[st.behind, { backgroundColor: level === 1 ? t.color.bg.stack1 : t.color.bg.stack2 }, style]} pointerEvents="none" />
  );
}

type TopProps = { card: Card; progress: SharedValue<number>; origin: SharedValue<Origin>; onSwipe: Props['onSwipe']; onHold: Props['onHold'] };

function TopCard({ card, progress, origin, onSwipe, onHold }: TopProps) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(-60);
  const enter = useSharedValue(0);
  const flip = useSharedValue(0);
  const armed = useSharedValue(0);
  const cardH = useSharedValue(0);
  const over = useSharedValue(0);
  const land = useSharedValue(0);
  const finger = useSharedValue({ x: 0, y: 0 });
  const target = useTradeTarget();
  const { partner } = useAccount();
  const hints = hintsFor(card, !partner);
  const canUp = hints.up !== null;
  const canLeft = hints.left !== null;
  const canDown = hints.down !== null;
  const names = useNames();
  const t = useTheme();
  const st = useStyles();
  // Only an untraded card can be handed over; after the one trade it goes to the table instead.
  const canGive = !!partner && canHandOff(card) && !card.traded;

  useEffect(() => {
    // Deal in: the new top card drops onto the deck like a dealt card.
    progress.set(0);
    ty.set(withSpring(0, motion.dealIn));
    enter.set(withDelay(40, withTiming(1, { duration: 180 })));
  }, [enter, progress, ty]);

  const finish = (dir: SwipeDir) => onSwipe(card, dir);

  const fly = (dir: SwipeDir) => {
    'worklet';
    const to = dir === 'up' ? { x: tx.value, y: -900 } : dir === 'down' ? { x: tx.value, y: 900 } : { x: dir === 'right' ? 600 : -600, y: ty.value };
    progress.set(withTiming(1, motion.flyOut));
    ty.set(withTiming(to.y, motion.flyOut));
    tx.set(withTiming(to.x, motion.flyOut, (done) => {
      if (done) scheduleOnRN(finish, dir);
    }));
  };

  const give = () => {
    'worklet';
    // Fly the card's center into the avatar, shrinking as it goes, then the avatar catches it.
    const r = target.rect.value;
    const o = origin.value;
    progress.set(withTiming(1, LAND));
    tx.set(withTiming(r.x + r.w / 2 - (o.x + o.w / 2), LAND));
    ty.set(withTiming(r.y + r.h / 2 - (o.y + cardH.value / 2), LAND));
    land.set(withTiming(1, LAND, (done) => {
      if (!done) return;
      catchBounce(target.caught);
      target.hot.set(withTiming(0, { duration: 200 }));
      scheduleOnRN(haptics.success);
      scheduleOnRN(finish, 'give');
    }));
  };

  const pan = usePanGesture({
    activeOffsetX: [-8, 8],
    activeOffsetY: [-8, 8],
    onActivate: () => {
      'worklet';
      if (canGive) target.ready.set(withTiming(1, { duration: 160 }));
    },
    onUpdate: (e) => {
      'worklet';
      tx.set(e.translationX);
      ty.set(e.translationY);
      progress.set(Math.min(1, Math.hypot(e.translationX, e.translationY) / 220));
      finger.set({ x: e.absoluteX, y: e.absoluteY });
      const hovering = canGive && isOver(target.rect.value, e.absoluteX, e.absoluteY) ? 1 : 0;
      if (hovering !== over.value) {
        over.set(hovering);
        target.hot.set(withSpring(hovering, motion.release));
        if (hovering) scheduleOnRN(haptics.trade);
      }
      const past = !hovering && (e.translationX > THRESHOLD || (canLeft && e.translationX < -THRESHOLD) || (canUp && e.translationY < -THRESHOLD) || (canDown && e.translationY > THRESHOLD)) ? 1 : 0;
      if (past !== armed.value) {
        armed.set(past);
        if (past) scheduleOnRN(haptics.tick);
      }
    },
    onFinalize: () => {
      'worklet';
      target.ready.set(withTiming(0, { duration: 160 }));
    },
    onDeactivate: (e) => {
      'worklet';
      armed.set(0);
      if (over.value) {
        over.set(0);
        return give();
      }
      if (e.translationX > THRESHOLD || e.velocityX > FLING) return fly('right');
      if (canLeft && (e.translationX < -THRESHOLD || e.velocityX < -FLING)) return fly('left');
      if (canUp && (e.translationY < -THRESHOLD || e.velocityY < -FLING)) return fly('up');
      if (canDown && (e.translationY > THRESHOLD || e.velocityY > FLING)) return fly('down');
      tx.set(withSpring(0, motion.cardBack));
      ty.set(withSpring(0, motion.cardBack));
      progress.set(withSpring(0, motion.cardBack));
    },
  });

  const tap = useTapGesture({
    onActivate: () => {
      'worklet';
      flip.set(withTiming(flip.value > 0.5 ? 0 : 1, motion.flip));
      scheduleOnRN(haptics.tick);
    },
  });

  const hold = useLongPressGesture({
    minDuration: 450,
    onActivate: () => {
      'worklet';
      scheduleOnRN(onHold, card);
    },
  });

  const gesture = useCompetingGestures(pan, hold, tap);

  const cardStyle = useAnimatedStyle(() => {
    // Over the avatar the card shrinks and straightens, like a card being handed over.
    // It also hangs below and left of the finger so Meera's avatar stays in view.
    const hot = over.value || land.value ? target.hot.value : 0;
    const lift = hot * (1 - land.value);
    const o = origin.value;
    const cx = o.x + o.w / 2 + tx.value;
    const cy = o.y + cardH.value / 2 + ty.value;
    const scale = (1 - hot * 0.62) * (1 - land.value * 0.9);
    return {
      opacity: enter.value * (1 - land.value * 0.6),
      transform: [
        { translateX: tx.value + (finger.value.x - 90 - cx) * lift },
        { translateY: ty.value + (finger.value.y + 90 - cy) * lift },
        { rotate: `${(tx.value / 18) * (1 - hot)}deg` },
        { scale },
      ],
    };
  });
  // Direction stamps step aside while the card hovers over the avatar.
  const calm = () => {
    'worklet';
    return 1 - Math.max(over.value, land.value);
  };
  const rightStamp = useAnimatedStyle(() => ({ opacity: calm() * interpolate(tx.value, [20, THRESHOLD], [0, 1], Extrapolation.CLAMP) }));
  const leftStamp = useAnimatedStyle(() => ({ opacity: !canLeft ? 0 : calm() * interpolate(tx.value, [-20, -THRESHOLD], [0, 1], Extrapolation.CLAMP) }));
  const upStamp = useAnimatedStyle(() => ({ opacity: canUp ? calm() * interpolate(ty.value, [-20, -THRESHOLD], [0, 1], Extrapolation.CLAMP) : 0 }));
  const downStamp = useAnimatedStyle(() => ({ opacity: canDown ? calm() * interpolate(ty.value, [20, THRESHOLD], [0, 1], Extrapolation.CLAMP) : 0 }));

  const stamp = (hint: string | null) => {
    switch (hint) {
      case 'take it': return { text: 'Take it', color: t.color.action.positive };
      case 'done': return { text: 'Done', color: t.color.action.positive };
      case 'together': return { text: 'Do it together', color: t.color.accent.tag };
      case 'trade': return { text: `Ask ${names.partnerOr}`, color: t.color.action.negative };
      case 'to the table': return { text: 'Back to table', color: t.color.action.negative };
      default: return { text: hint ?? '', color: t.color.text.secondary };
    }
  };
  const r = stamp(hints.right);
  const l = stamp(hints.left);
  const u = stamp(hints.up);
  const d = stamp(hints.down);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[st.top, cardStyle]}
        onLayout={(e) => cardH.set(e.nativeEvent.layout.height)}
        accessibilityHint={`Swipe right, left, up or down.${canGive ? ' Drag onto your partner to hand it over.' : ''} Tap to flip. Hold to update.`}
      >
        <DealCard card={card} flip={flip} />
        <Animated.View style={[st.stamp, st.stampRight, rightStamp]} pointerEvents="none">
          <Text variant="display/2xl" color={r.color} style={st.stampText}>{r.text}</Text>
        </Animated.View>
        <Animated.View style={[st.stamp, st.stampLeft, leftStamp]} pointerEvents="none">
          <Text variant="display/2xl" color={l.color} style={st.stampText}>{l.text}</Text>
        </Animated.View>
        {canUp && (
          <Animated.View style={[st.stamp, st.stampUp, upStamp]} pointerEvents="none">
            <Text variant="display/2xl" color={u.color} style={st.stampText}>{u.text}</Text>
          </Animated.View>
        )}
        {canDown && (
          <Animated.View style={[st.stamp, st.stampDown, downStamp]} pointerEvents="none">
            <Text variant="display/2xl" color={d.color} style={st.stampText}>{d.text}</Text>
          </Animated.View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const useStyles = makeStyles((t) => ({
  // Top padding leaves room for the cards peeking above.
  deck: { minHeight: 340, paddingTop: 28 },
  top: { zIndex: 3 },
  behind: { position: 'absolute', left: 0, right: 0, top: 28, height: 120, borderRadius: t.radius.xl, zIndex: 1 },
  // Stamps: big upper case words over the card, like the redesign's TAKE IT / DONE / ASK.
  stamp: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  stampText: { textAlign: 'center', fontSize: 40, lineHeight: 42 },
  stampRight: { top: '38%', transform: [{ rotate: '-8deg' }] },
  stampLeft: { top: '38%', transform: [{ rotate: '8deg' }] },
  stampUp: { top: '30%', transform: [{ rotate: '-4deg' }] },
  stampDown: { top: '42%' },
}));
