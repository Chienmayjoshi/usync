import { Stop } from 'phosphor-react-native';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, type SharedValue, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/ui/Text';

const BARS = 34;

/** Hold + to talk: the words as they come, a live waveform, and a red stop button. */
export function VoiceBar({ text, onStop }: { text: string; onStop: () => void }) {
  const t = useTheme();
  const s = useStyles();
  const phase = useSharedValue(0);
  useEffect(() => {
    phase.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1));
  }, [phase]);
  return (
    <View style={s.wrap}>
      <Text variant="title/lg" style={s.text}>{text || 'Listening…'}</Text>
      <View style={s.row}>
        <View style={s.wave} accessibilityLabel="Listening">
          {Array.from({ length: BARS }, (_, i) => <Bar key={i} i={i} phase={phase} />)}
        </View>
        <Pressable onPress={onStop} style={s.stop} accessibilityRole="button" accessibilityLabel="Stop listening">
          <Stop size={22} weight="fill" color={t.color.text.onColor} />
        </Pressable>
      </View>
    </View>
  );
}

function Bar({ i, phase }: { i: number; phase: SharedValue<number> }) {
  const t = useTheme();
  const s = useStyles();
  // Louder in the middle of the strip, like Figma's waveform; each bar on its own beat.
  const mid = 1 - Math.abs(i - BARS / 2) / (BARS / 2);
  const style = useAnimatedStyle(() => {
    const v = Math.abs(Math.sin((phase.value * 2 + i / 5) * Math.PI));
    return { height: 6 + v * 22 * (0.3 + mid * 0.7) };
  });
  return <Animated.View style={[s.bar, { backgroundColor: mid > 0.45 ? '#7DB8FF' : t.color.border.strong }, style]} />;
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: 18, paddingBottom: 8 },
  text: { fontSize: 20, lineHeight: 26 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wave: { flex: 1, height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bar: { width: 3, borderRadius: 2 },
  stop: { width: 56, height: 56, borderRadius: 28, backgroundColor: t.color.action.negative, alignItems: 'center', justifyContent: 'center', boxShadow: t.shadow.card },
}));
