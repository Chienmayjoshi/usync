import { type ReactNode, useEffect } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { motion } from '@/theme/motion';
import { makeStyles } from '@/theme/ThemeProvider';

type Props = { onClose: () => void; children: ReactNode };

/**
 * Bottom sheet over everything, tabs included. Keyboard safe on both platforms: Android is
 * edge to edge, so the window no longer resizes for the keyboard and the sheet pads itself.
 */
export function Sheet({ onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const y = useSharedValue(600);
  useEffect(() => { y.set(withTiming(0, motion.sheetIn)); }, [y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior="padding" style={s.kav} pointerEvents="box-none">
        <Animated.View style={[s.sheet, style]}>
          <View style={s.handle} />
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 16 }]}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: t.color.bg.scrim },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%', backgroundColor: t.color.bg.sheet, borderTopLeftRadius: t.radius.lg, borderTopRightRadius: t.radius.lg,
    paddingTop: 10, boxShadow: t.shadow.sheet,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: t.color.border.strong, marginBottom: 2 },
  body: { paddingHorizontal: 20, paddingTop: 14, gap: 14 },
}));
