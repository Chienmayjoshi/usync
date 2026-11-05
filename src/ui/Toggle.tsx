import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptics } from '@/theme/haptics';
import { ease } from '@/theme/motion';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';

type Props = { value: boolean; onChange: (v: boolean) => void; accessibilityLabel: string };

// Figma "Switch" (149:8650 off, 151:4728 on): 48 × 28 track, r14, a 22 knob 3 in from the edge.
const W = 48;
const H = 28;
const KNOB = 22;
const INSET = 3;
const SLIDE = { duration: 200, easing: ease.out };

/** The iOS style switch from the add-task sheet, drawn the same on every platform. */
export function Toggle({ value, onChange, accessibilityLabel }: Props) {
  const t = useTheme();
  const s = useStyles();
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => { p.set(withTiming(value ? 1 : 0, SLIDE)); }, [p, value]);

  const off = t.scheme === 'light' ? '#A3A3A3' : '#4A4552';
  const on = t.color.action.primary;
  const knobOn = t.color.action.onPrimary;
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], [off, on]) }));
  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * (W - KNOB - INSET * 2) }],
    backgroundColor: interpolateColor(p.value, [0, 1], ['#FFFFFF', knobOn]),
  }));

  return (
    <Pressable
      onPress={() => { haptics.tick(); onChange(!value); }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
    >
      <Animated.View style={[s.track, track]}>
        <Animated.View style={[s.knob, knob]} />
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  track: { width: W, height: H, borderRadius: H / 2, padding: INSET },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2 },
}));
