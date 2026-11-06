import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { haptics } from '@/theme/haptics';
import { motion } from '@/theme/motion';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';

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
        {/* Figma's "+" is Manrope Light 32: a 17.6 wide cross with 1.6 strokes. Drawn, so it sits dead centre on every platform. */}
        <Svg width={18} height={18} viewBox="0 0 18 18">
          <Path d="M9 0.2V17.8M0.2 9H17.8" stroke={t.color.action.onPrimary} strokeWidth={1.6} />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  // Figma 119:3583: 56, #0B0A0F, 1.5 white stroke, shadows 0 20 25 / 0 10 10 (Figma blur).
  fab: {
    width: FAB, height: FAB, borderRadius: FAB / 2, backgroundColor: t.scheme === 'light' ? '#0B0A0F' : t.color.action.primary,
    borderWidth: 1.5, borderColor: t.color.border.card,
    alignItems: 'center', justifyContent: 'center',
    boxShadow: t.scheme === 'light' ? '0px 20px 25px rgba(0,0,0,0.1), 0px 10px 10px rgba(0,0,0,0.04)' : t.shadow.card,
  },
}));
