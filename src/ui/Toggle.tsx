import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptics } from '@/theme/haptics';
import { ease } from '@/theme/motion';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';

type Props = { value: boolean; onChange: (v: boolean) => void; accessibilityLabel: string; size?: 'md' | 'sm' };

// Figma "Switch" (149:8650 off, 151:4728 on): 48 × 28 track, r14, a 22 knob 3 in from the edge.
// The add-task sheet's header uses the small one (267:24584): 42 × 24, an 18 knob.
const SIZES = { md: { W: 48, H: 28, KNOB: 22 }, sm: { W: 42, H: 24, KNOB: 18 } } as const;
const INSET = 3;
const SLIDE = { duration: 200, easing: ease.out };

/** The iOS style switch from the add-task sheet, drawn the same on every platform. */
export function Toggle({ value, onChange, accessibilityLabel, size = 'md' }: Props) {
  const { W, H, KNOB } = SIZES[size];
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
      <Animated.View style={[s.track, { width: W, height: H, borderRadius: H / 2 }, track]}>
        <Animated.View style={[s.knob, { width: KNOB, height: KNOB, borderRadius: KNOB / 2 }, knob]} />
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  track: { padding: INSET },
  knob: {},
}));
