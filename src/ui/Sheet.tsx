import { type ReactNode, useEffect } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { motion } from '@/theme/motion';
import { theme } from '@/theme/tokens';

type Props = { onClose: () => void; children: ReactNode };

/**
 * Bottom sheet over everything, tabs included. Keyboard safe on both platforms: Android is
 * edge to edge, so the window no longer resizes for the keyboard and the sheet pads itself
 * instead ('padding' on iOS and Android, not the old iOS only setting).
 */
export function Sheet({ onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  const y = useSharedValue(600);
  useEffect(() => { y.set(withSpring(0, motion.sheetIn)); }, [y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior="padding" style={styles.kav} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, style]}>
          <View style={styles.handle} />
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 16 }]}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.62)' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', backgroundColor: theme.color.bg.raised, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: theme.color.border.subtle, paddingTop: 12 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: theme.color.border.strong, marginBottom: 2 },
  body: { paddingHorizontal: 20, paddingTop: 12, gap: 14 },
});
