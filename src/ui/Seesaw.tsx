import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';

import { theme } from '@/theme/tokens';

type Props = { tilt: number; scale?: number; /** Each person's own color: mine on the left, theirs on the right. */ colors?: { me: string; partner: string } };

/**
 * Shared load as a seesaw. tilt in [-1, 1]; negative sinks my (ember) side.
 * Never paired with numbers: the shape is the whole message.
 */
export function Seesaw({ tilt, scale = 1, colors = { me: theme.color.partner.a, partner: theme.color.partner.b } }: Props) {
  const angle = useSharedValue(0);
  useEffect(() => {
    angle.set(withSpring(tilt * 9, { damping: 9, stiffness: 90 }));
  }, [angle, tilt]);
  const plank = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));
  const w = 200 * scale;
  return (
    <View style={{ width: w + 20 * scale, height: 110 * scale, alignItems: 'center' }} accessibilityLabel={tilt === 0 ? 'Balanced' : tilt < 0 ? 'Tilted toward you' : 'Tilted toward your partner'}>
      <Animated.View style={[{ width: w, height: 40 * scale, marginTop: 34 * scale }, plank]}>
        <View style={[styles.ball, { width: 28 * scale, height: 28 * scale, borderRadius: 14 * scale, left: 6 * scale, backgroundColor: colors.me }]} />
        <View style={[styles.ball, { width: 28 * scale, height: 28 * scale, borderRadius: 14 * scale, right: 6 * scale, backgroundColor: colors.partner }]} />
        <View style={[styles.bar, { height: 8 * scale, top: 28 * scale }]} />
      </Animated.View>
      <Svg width={48 * scale} height={36 * scale} style={{ marginTop: -2 * scale }}>
        <Polygon points={`0,${36 * scale} ${24 * scale},0 ${48 * scale},${36 * scale}`} fill={theme.color.pop.creamEdgeDeep} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  ball: { position: 'absolute', top: 0 },
  bar: { position: 'absolute', left: 0, right: 0, backgroundColor: theme.color.bg.inverse },
});
