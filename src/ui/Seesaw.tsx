import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';

import { ease } from '@/theme/motion';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';

type Props = { tilt: number; scale?: number; /** Each person's own color: mine on the left, theirs on the right. */ colors: { me: string; partner: string } };

/**
 * Shared load as a seesaw. tilt in [-1, 1]; negative sinks my side.
 * Never paired with numbers: the shape is the whole message.
 */
export function Seesaw({ tilt, scale = 1, colors }: Props) {
  const t = useTheme();
  const s = useStyles();
  const angle = useSharedValue(0);
  useEffect(() => {
    angle.set(withTiming(tilt * 9, { duration: 600, easing: ease.out }));
  }, [angle, tilt]);
  const plank = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));
  const w = 200 * scale;
  const ball = 24 * scale;
  return (
    <View style={{ width: w + 20 * scale, height: 96 * scale, alignItems: 'center' }} accessibilityLabel={tilt === 0 ? 'Balanced' : tilt < 0 ? 'Tilted toward you' : 'Tilted toward your partner'}>
      <Animated.View style={[{ width: w, height: 36 * scale, marginTop: 28 * scale }, plank]}>
        <View style={[s.ball, { width: ball, height: ball, borderRadius: ball / 2, left: 8 * scale, backgroundColor: colors.me }]} />
        <View style={[s.ball, { width: ball, height: ball, borderRadius: ball / 2, right: 8 * scale, backgroundColor: colors.partner }]} />
        <View style={[s.bar, { height: 6 * scale, top: ball, borderRadius: 3 * scale }]} />
      </Animated.View>
      <Svg width={40 * scale} height={30 * scale} style={{ marginTop: -2 * scale }}>
        <Polygon points={`0,${30 * scale} ${20 * scale},0 ${40 * scale},${30 * scale}`} fill={t.color.seesaw.fulcrum} />
      </Svg>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  ball: { position: 'absolute', top: 0 },
  bar: { position: 'absolute', left: 0, right: 0, backgroundColor: t.color.seesaw.bar },
}));
