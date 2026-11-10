import { useEffect, useRef, useState } from 'react';
import { type LayoutRectangle, Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptics } from '@/theme/haptics';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type Props<T extends string> = {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; accent?: string;
  /** `pill`: fully round track and plates (the add-task sheet, Figma 267:24597). */
  shape?: 'rounded' | 'pill';
};

// The plate travels across the track rather than entering or leaving: ease-in-out, and short,
// since a segmented control is picked tens of times a day (animate-expo: segmented indicator).
const SLIDE = { duration: 220, easing: Easing.bezier(0.77, 0, 0.175, 1) };
// Press feedback: a slight give the moment the finger lands, back on release.
const PRESS = { duration: 120, easing: Easing.bezier(0.23, 1, 0.32, 1) };

/**
 * Two to four views of the same thing. The active one sits on a white plate in a grey track; the
 * plate slides to whatever you press. Measured once with onLayout, then only transforms move.
 */
export function Segmented<T extends string>({ value, options, onChange, accent, shape = 'rounded' }: Props<T>) {
  const t = useTheme();
  const s = useStyles();
  const [layouts, setLayouts] = useState<Partial<Record<T, LayoutRectangle>>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const shown = useSharedValue(0);
  // Only a press slides the plate; a value set from outside (a remembered pick on open) just sits there.
  const pressed = useRef(false);

  useEffect(() => {
    const l = layouts[value];
    if (!l) return;
    if (pressed.current && shown.get()) {
      x.set(withTiming(l.x, SLIDE));
      w.set(withTiming(l.width, SLIDE));
    } else {
      x.set(l.x);
      w.set(l.width);
      shown.set(1);
    }
    pressed.current = false;
  }, [value, layouts, x, w, shown]);

  const plate = useAnimatedStyle(() => ({ opacity: shown.get(), width: w.get(), transform: [{ translateX: x.get() }] }));
  const round = shape === 'pill' ? s.pill : null;

  return (
    <View style={[s.row, round]} accessibilityRole="tablist">
      {/* Absolutely placed and childless, so animating its width re-lays-out nothing. */}
      <Animated.View style={[s.plate, round, plate]} pointerEvents="none" />
      {options.map((o) => (
        <Segment
          key={o.value}
          label={o.label}
          on={o.value === value}
          color={o.value === value ? accent ?? t.color.text.primary : t.color.text.secondary}
          round={shape === 'pill'}
          onLayout={(l) => setLayouts((m) => (m[o.value]?.x === l.x && m[o.value]?.width === l.width ? m : { ...m, [o.value]: l }))}
          onPress={() => {
            if (o.value === value) return;
            haptics.tick();
            pressed.current = true;
            onChange(o.value);
          }}
        />
      ))}
    </View>
  );
}

function Segment({ label, on, color, round, onLayout, onPress }: {
  label: string; on: boolean; color: string; round: boolean; onLayout: (l: LayoutRectangle) => void; onPress: () => void;
}) {
  const s = useStyles();
  const scale = useSharedValue(1);
  const press = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      onLayout={(e) => onLayout(e.nativeEvent.layout)}
      onPressIn={() => scale.set(withTiming(0.96, PRESS))}
      onPressOut={() => scale.set(withTiming(1, PRESS))}
      onPress={onPress}
      style={[s.seg, round && s.pill]}
    >
      <Animated.View style={press}>
        <Text variant={on ? 'title/md' : 'body/md'} style={s.label} color={color}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  // Figma "Segmented" (149:8641): 48 tall track, 4 padding and gap, a 40 tall plate with a 1px stroke.
  row: { flexDirection: 'row', backgroundColor: t.color.bg.sunken, borderRadius: t.radius.md, padding: 4, gap: 4 },
  seg: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: t.radius.sm },
  plate: {
    position: 'absolute', top: 4, left: 0, height: 40, borderRadius: t.radius.sm,
    backgroundColor: t.color.bg.raised, borderWidth: 1, borderColor: t.color.border.strong,
  },
  label: { fontSize: 14 },
  pill: { borderRadius: 40 },
}));
