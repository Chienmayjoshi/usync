import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptics } from '@/theme/haptics';
import { motion } from '@/theme/motion';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';

import { Text } from '@/ui/Text';

import { useOpenDrop } from './DropSheet';

const FAB = 56;

/** The round + beside the tab pill. Tap to type, hold to talk. */
export function DropFab() {
  const t = useTheme();
  const s = useStyles();
  const openDrop = useOpenDrop();
  const p = useSharedValue(0);
  const face = useAnimatedStyle(() => ({ transform: [{ scale: 1 - p.value * 0.08 }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add a task"
      accessibilityHint="Tap to type it, hold to say it"
      onPressIn={() => { p.set(withTiming(1, motion.press)); haptics.press(); }}
      onPressOut={() => p.set(withTiming(0, motion.release))}
      onPress={() => openDrop('type')}
      onLongPress={() => { haptics.take(); openDrop('voice'); }}
      delayLongPress={350}
    >
      <Animated.View style={[s.fab, face]}>
        <Text style={s.plus} color={t.color.action.onPrimary}>+</Text>
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  // Figma 119:3583: 56, #0B0A0F, 1.5 white stroke, shadows 0 20 25 / 0 10 10 (Figma blur), Manrope Light "+".
  fab: {
    width: FAB, height: FAB, borderRadius: FAB / 2, backgroundColor: t.scheme === 'light' ? '#0B0A0F' : t.color.action.primary,
    borderWidth: 1.5, borderColor: t.color.border.card,
    alignItems: 'center', justifyContent: 'center',
    boxShadow: t.scheme === 'light' ? '0px 20px 25px rgba(0,0,0,0.1), 0px 10px 10px rgba(0,0,0,0.04)' : t.shadow.card,
  },
  plus: { fontFamily: 'Manrope_300Light', fontSize: 32, lineHeight: 32, includeFontPadding: false, textAlign: 'center' },
}));
