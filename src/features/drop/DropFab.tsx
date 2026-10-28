import { usePathname } from 'expo-router';
import { Plus } from 'phosphor-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { haptics } from '@/theme/haptics';
import { motion } from '@/theme/motion';
import { theme } from '@/theme/tokens';

import { useOpenDrop } from './DropSheet';

const FAB = 60;
const DEPTH = 4;

/**
 * A round NeoPOP button that sits above the content, bottom right. Tap to type, hold to talk.
 * Where noticing happens (Deck, Us); Sync is a ritual with its own inputs, so Drop stays out of it.
 */
export function DropFab({ bottom }: { bottom: number }) {
  const openDrop = useOpenDrop();
  const path = usePathname();
  const p = useSharedValue(0);
  const face = useAnimatedStyle(() => ({ transform: [{ translateX: p.value * DEPTH }, { translateY: p.value * DEPTH }] }));
  if (path.startsWith('/sync')) return null;
  return (
    <View style={[styles.fabWrap, { bottom }]} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Drop something"
        accessibilityHint="Tap to type it, hold to say it"
        onPressIn={() => { p.set(withTiming(1, motion.press)); haptics.press(); }}
        onPressOut={() => p.set(withSpring(0, motion.release))}
        onPress={() => openDrop('type')}
        onLongPress={() => { haptics.take(); openDrop('voice'); }}
        delayLongPress={350}
        style={styles.fab}
      >
        {/* The round version of the NeoPOP edge: a darker disc the face presses down into. */}
        <View style={styles.edge} pointerEvents="none" />
        <Animated.View style={[styles.fabFace, face]}>
          <Plus size={28} color={theme.color.text.inverse} weight="bold" />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fabWrap: { position: 'absolute', right: 16, zIndex: 10 },
  fab: { width: FAB + DEPTH, height: FAB + DEPTH },
  edge: { position: 'absolute', top: DEPTH, left: DEPTH, width: FAB, height: FAB, borderRadius: FAB / 2, backgroundColor: theme.color.pop.creamEdgeDeep },
  fabFace: { width: FAB, height: FAB, borderRadius: FAB / 2, backgroundColor: theme.color.bg.inverse, alignItems: 'center', justifyContent: 'center' },
});
