import { createContext, type ReactNode, type Ref, useCallback, useContext, useEffect, useImperativeHandle, useRef } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { motion } from '@/theme/motion';
import { makeStyles } from '@/theme/ThemeProvider';

export type SheetHandle = { close: () => void };
type Props = { onClose: () => void; children: ReactNode; ref?: Ref<SheetHandle> };

const Close = createContext<() => void>(() => undefined);
/** Close the sheet from inside it, sliding it out first. */
export const useSheetClose = () => useContext(Close);

const OFF = 900;

/**
 * Bottom sheet over everything, tabs included. It slides up, and slides back down whether you
 * tap the scrim, drag the handle down or finish inside it. Keyboard safe on both platforms:
 * Android is edge to edge, so the window no longer resizes for the keyboard and the sheet pads itself.
 */
export function Sheet({ onClose, children, ref }: Props) {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const y = useSharedValue(OFF);
  const h = useSharedValue(OFF);
  const closing = useRef(false);
  useEffect(() => { y.set(withTiming(0, motion.sheetIn)); }, [y]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    y.set(withTiming(h.value, motion.sheetOut, (done) => { if (done) scheduleOnRN(onClose); }));
  }, [h, onClose, y]);
  useImperativeHandle(ref, () => ({ close }), [close]);

  const drag = usePanGesture({
    onUpdate: (e) => { y.set(Math.max(0, e.translationY)); },
    onDeactivate: (e) => {
      if (e.translationY > h.value * 0.3 || e.velocityY > 800) {
        y.set(withTiming(h.value, motion.sheetOut, (done) => { if (done) scheduleOnRN(onClose); }));
      } else {
        y.set(withTiming(0, motion.cardBack));
      }
    },
  });

  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const scrim = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, Math.min(h.value, OFF)], [1, 0], 'clamp') }));

  return (
    <Modal visible transparent animationType="none" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      <GestureHandlerRootView style={s.flex}>
        <Animated.View style={[s.scrim, scrim]}>
          <Pressable style={s.flex} onPress={close} accessibilityLabel="Close" />
        </Animated.View>
        <KeyboardAvoidingView behavior="padding" style={s.kav} pointerEvents="box-none">
          <Animated.View style={[s.sheet, sheet]} onLayout={(e) => h.set(e.nativeEvent.layout.height)}>
            <GestureDetector gesture={drag}>
              <View style={s.grab} accessibilityRole="adjustable" accessibilityLabel="Drag down to close">
                <View style={s.handle} />
              </View>
            </GestureDetector>
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]}
              showsVerticalScrollIndicator={false}
            >
              <Close.Provider value={close}>{children}</Close.Provider>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: t.color.bg.scrim },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%', backgroundColor: t.color.bg.sheet, borderTopLeftRadius: t.radius.lg, borderTopRightRadius: t.radius.lg,
    boxShadow: t.shadow.sheet,
  },
  // A full-width strip so the handle is easy to catch.
  grab: { height: 22, alignItems: 'center', justifyContent: 'flex-end' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: t.color.border.strong },
  // Figma "Sheet: update": 18 / 20 / 24, 12 between rows.
  body: { paddingHorizontal: 20, paddingTop: 18, gap: 12 },
}));
