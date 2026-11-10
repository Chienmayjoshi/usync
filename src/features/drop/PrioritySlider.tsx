import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { FadeInLeft, FadeInRight, FadeOutLeft, FadeOutRight, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptics } from '@/theme/haptics';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/ui/Text';

import { type Step, STEPS } from './priority';
import { SheetGlyph } from './SheetGlyphs';

const STOP = 40;
const PAD = 4;
/** Snap back to a stop: the finger's speed carries into the settle (animate-expo: reposition after a drag). */
const SNAP = { duration: 400, dampingRatio: 0.8 } as const;
const LABEL_IN = 180;
const LABEL_OUT = 120;

type Props = { value: Step; onChange: (s: Step) => void; accessibilityLabel: string };

/**
 * Figma "What's the priority?" (267:24607): a knob on a track of four stops, its stop named on the
 * right with an icon. Drag the knob (it follows the finger 1:1, then springs to the nearest stop
 * with the release speed), or tap a stop. Each stop crossed ticks once.
 */
export function PrioritySlider({ value, onChange, accessibilityLabel }: Props) {
  const t = useTheme();
  const s = useStyles();
  const index = STEPS.findIndex((x) => x.key === value);
  const [width, setWidth] = useState(0);
  // The knob's travel: the track's inner width less one stop.
  const travel = Math.max(0, width - PAD * 2 - STOP);
  const gap = travel / (STEPS.length - 1);

  const x = useSharedValue(0);
  const start = useSharedValue(0);
  const at = useSharedValue(index);
  const span = useSharedValue({ travel, gap });
  const dragging = useSharedValue(0);

  // Which way the label moves, so it enters from the side the knob is heading to.
  const [seen, setSeen] = useState({ index, dir: 1 });
  if (seen.index !== index) setSeen({ index, dir: index > seen.index ? 1 : -1 });
  const dir = seen.index !== index ? (index > seen.index ? 1 : -1) : seen.dir;

  // A change from outside (the typed words name a day, a tap on a stop): spring there.
  useEffect(() => {
    span.set({ travel, gap });
    at.set(index);
    // Mid-drag the finger owns the knob; the release springs it home.
    if (!dragging.get()) x.set(withSpring(index * gap, SNAP));
  }, [index, gap, travel, x, at, span, dragging]);

  const step = (i: number) => {
    haptics.tick();
    onChange(STEPS[i].key);
  };

  const pan = usePanGesture({
    activeOffsetX: [-4, 4],
    failOffsetY: [-12, 12],
    onActivate: () => {
      'worklet';
      start.set(x.get());
      dragging.set(1);
    },
    onUpdate: (e) => {
      'worklet';
      const { travel: max, gap: g } = span.get();
      let v = start.get() + e.translationX;
      // Past either end the knob gives a little, it doesn't stop dead.
      if (v < 0) v *= 0.2;
      else if (v > max) v = max + (v - max) * 0.2;
      x.set(v);
      const i = g > 0 ? Math.max(0, Math.min(STEPS.length - 1, Math.round(v / g))) : 0;
      // Only when a stop is crossed, never per frame.
      if (i !== at.get()) { at.set(i); scheduleOnRN(step, i); }
    },
    onDeactivate: (e) => {
      'worklet';
      const { gap: g } = span.get();
      dragging.set(0);
      x.set(withSpring(at.get() * g, { ...SNAP, velocity: e.velocityX }));
    },
  });

  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const cur = STEPS[index];

  return (
    <View
      style={s.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: cur.label }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const i = index + (e.nativeEvent.actionName === 'increment' ? 1 : -1);
        if (i >= 0 && i < STEPS.length) step(i);
      }}
    >
      <GestureDetector gesture={pan}>
        <View style={s.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {STEPS.map((x2, i) => (
            <Pressable key={x2.key} onPress={() => { if (i !== index) step(i); }} style={s.stop} hitSlop={4} accessibilityElementsHidden importantForAccessibility="no">
              <View style={[s.dot, { backgroundColor: t.color.dotIdle }]} />
            </Pressable>
          ))}
          {width > 0 && (
            <Animated.View style={[s.knob, knob]} pointerEvents="none">
              <SheetGlyph name="grip" color={t.color.text.primary} />
            </Animated.View>
          )}
        </View>
      </GestureDetector>
      <View style={s.label}>
        <Animated.View
          key={cur.key}
          entering={(dir > 0 ? FadeInRight : FadeInLeft).duration(LABEL_IN)}
          exiting={(dir > 0 ? FadeOutLeft : FadeOutRight).duration(LABEL_OUT)}
          style={s.labelInner}
        >
          <SheetGlyph name={cur.key} color={t.color.text.primary} />
          <Text style={s.labelText} color={t.color.text.primary} numberOfLines={1}>{cur.label}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  // Figma 267:24606: track (flex) + an 8 gap + the 133 wide label.
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: {
    flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: t.color.bg.sunken, borderRadius: 40, padding: PAD,
  },
  stop: { width: STOP, height: STOP, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  knob: {
    position: 'absolute', left: PAD, top: PAD, width: STOP, height: STOP, borderRadius: STOP / 2,
    backgroundColor: t.color.bg.raised, borderWidth: 1, borderColor: t.color.border.strong,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { width: 133, height: 48, justifyContent: 'center' },
  labelInner: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  labelText: { fontFamily: 'Satoshi-Bold', fontSize: 16, lineHeight: 22, letterSpacing: -0.032 },
}));
