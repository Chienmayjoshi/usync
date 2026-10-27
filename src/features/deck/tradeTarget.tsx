import { type ComponentRef, createContext, type ReactNode, useContext, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { theme } from '@/theme/tokens';
import { useNames } from '@/features/account/account';
import { Text } from '@/ui/Text';

// The partner avatar doubles as a drop target: drag a deal onto Meera to trade it to her.
// The card's pan worklet reads the avatar's window rect and drives `ready` / `hot` directly.

export type Rect = { x: number; y: number; w: number; h: number };

type Target = {
  rect: SharedValue<Rect>;
  /** 1 while an eligible card is being dragged, so the avatar can invite the drop. */
  ready: SharedValue<number>;
  /** 1 while the finger is over the avatar. */
  hot: SharedValue<number>;
  /** Bumped when a card lands, for the catch bounce. */
  caught: SharedValue<number>;
};

const Ctx = createContext<Target | null>(null);

export function TradeTargetProvider({ children }: { children: ReactNode }) {
  const rect = useSharedValue<Rect>({ x: -1000, y: -1000, w: 0, h: 0 });
  const ready = useSharedValue(0);
  const hot = useSharedValue(0);
  const caught = useSharedValue(0);
  return <Ctx.Provider value={{ rect, ready, hot, caught }}>{children}</Ctx.Provider>;
}

export function useTradeTarget() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTradeTarget must be used inside TradeTargetProvider');
  return v;
}

/** Generous hit radius: a thumb covering the avatar should count, and Android status bar offsets vary. */
export const HIT_RADIUS = 64;

export function isOver(rect: Rect, x: number, y: number) {
  'worklet';
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  return Math.hypot(x - cx, y - cy) < HIT_RADIUS;
}

/** Wraps the partner avatar: measures it and reacts to drags. */
export function PartnerDropZone({ children }: { children: ReactNode }) {
  const { rect, ready, hot, caught } = useTradeTarget();
  const names = useNames();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const measure = () => ref.current?.measureInWindow((x, y, w, h) => rect.set({ x, y, w, h }));

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ready.value * 0.06 + hot.value * 0.14 + caught.value * 0.18 }],
  }));
  const label = useAnimatedStyle(() => ({ opacity: hot.value, transform: [{ translateX: (1 - hot.value) * 8 }] }));
  const ring = useAnimatedStyle(() => ({
    opacity: ready.value * (0.5 + hot.value * 0.5),
    transform: [{ scale: 1 + hot.value * 0.12 }],
  }));

  return (
    <Animated.View style={[styles.zone, style]}>
      <Animated.View pointerEvents="none" style={[styles.ring, ring]} />
      <View ref={ref} onLayout={measure} collapsable={false}>{children}</View>
      <Animated.View pointerEvents="none" style={[styles.label, label]}>
        <Text variant="label/md" color={theme.color.partner.b}>{`Hand it to ${names.partnerOr}`}</Text>
      </Animated.View>
    </Animated.View>
  );
}

export function catchBounce(caught: SharedValue<number>) {
  'worklet';
  caught.set(withSequence(withSpring(1, { damping: 6, stiffness: 400 }), withTiming(0, { duration: 260 })));
}

const styles = StyleSheet.create({
  zone: { zIndex: 2 },
  label: { position: 'absolute', top: 11, right: 62, width: 170, alignItems: 'flex-end' },
  ring: { position: 'absolute', top: -6, left: -6, right: -6, bottom: -6, borderRadius: 999, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.color.partner.b },
});
