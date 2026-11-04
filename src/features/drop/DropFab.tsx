import { Plus } from 'phosphor-react-native';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

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
      onPressOut={() => p.set(withSpring(0, motion.release))}
      onPress={() => openDrop('type')}
      onLongPress={() => { haptics.take(); openDrop('voice'); }}
      delayLongPress={350}
    >
      <Animated.View style={[s.fab, face]}>
        <Plus size={26} color={t.color.action.onPrimary} weight="regular" />
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  fab: {
    width: FAB, height: FAB, borderRadius: FAB / 2, backgroundColor: t.scheme === 'light' ? '#0B0A0F' : t.color.action.primary,
    alignItems: 'center', justifyContent: 'center', boxShadow: t.shadow.card,
  },
}));
