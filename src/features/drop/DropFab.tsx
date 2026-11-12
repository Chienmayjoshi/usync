import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { haptics } from '@/theme/haptics';
import { motion } from '@/theme/motion';
import { makeStyles } from '@/theme/ThemeProvider';

import { useOpenDrop } from './DropSheet';

const FAB = 68;

/** The round + beside the tab pill. Tap to type, hold to talk. */
export function DropFab() {
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
        {/* Figma 300:25892: a 24 plus, 1.5 strokes with round ends. Drawn, so it sits dead centre on every platform. */}
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path d="M3.75 12H20.25M12 3.75V20.25" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  // Figma 300:25891: 68, #FF7A59, 1.5 white stroke, shadows 0 20 25 / 0 10 10 (Figma blur).
  fab: {
    width: FAB, height: FAB, borderRadius: FAB / 2, backgroundColor: '#FF7A59',
    borderWidth: 1.5, borderColor: t.scheme === 'light' ? '#FFFFFF' : 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    boxShadow: t.scheme === 'light' ? '0px 20px 25px rgba(0,0,0,0.1), 0px 10px 10px rgba(0,0,0,0.04)' : t.shadow.card,
  },
}));
