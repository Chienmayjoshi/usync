import type { Icon } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { haptics } from '@/theme/haptics';
import { motion } from '@/theme/motion';
import { theme, type Tone, tones } from '@/theme/tokens';

import { Edges } from './Edges';
import { Text } from './Text';

type Props = {
  label: string;
  onPress?: () => void;
  tone?: Tone | 'ghost';
  icon?: Icon;
  fill?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

const DEPTH = 4;

/** NeoPOP button: the face plunks into its edges on press, with a light haptic. */
export function PopButton({ label, onPress, tone = 'cream', icon: IconCmp, fill, disabled, style }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const p = useSharedValue(0);
  const ghost = tone === 'ghost';
  const t = tones[ghost ? 'neutral' : tone];
  const ink = disabled ? theme.color.text.muted : ghost ? theme.color.text.primary : t.ink;

  const faceStyle = useAnimatedStyle(() => ({ transform: [{ translateX: p.value * DEPTH }, { translateY: p.value * DEPTH }] }));
  const edgeStyle = useAnimatedStyle(() => ({ opacity: 1 - p.value }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPressIn={() => { p.set(withTiming(1, motion.press)); haptics.press(); }}
      onPressOut={() => { p.set(withSpring(0, motion.release)); }}
      onPress={onPress}
      style={[{ paddingRight: ghost ? 0 : DEPTH, paddingBottom: ghost ? 0 : DEPTH }, fill && styles.fill, style]}
    >
      {!ghost && !disabled && (
        <Animated.View style={[StyleSheet.absoluteFill, edgeStyle]} pointerEvents="none">
          <Edges width={size.w} height={size.h} depth={DEPTH} edge={t.edge} edgeDeep={t.edgeDeep} />
        </Animated.View>
      )}
      <Animated.View
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={[styles.face, { backgroundColor: ghost ? 'transparent' : disabled ? theme.color.bg.raised : t.face }, faceStyle]}
      >
        <View style={styles.row}>
          {IconCmp && <IconCmp size={16} color={ink} weight="fill" />}
          <Text variant="label/md" color={ink}>{label}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flexGrow: 1, flexBasis: 0 },
  face: { minHeight: 44, paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
