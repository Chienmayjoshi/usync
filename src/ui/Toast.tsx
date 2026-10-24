import { Heart } from 'phosphor-react-native';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/theme/tokens';

import { Edges } from './Edges';
import { Text } from './Text';

export type ToastSpec = {
  kind: 'info' | 'thanks';
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  ms?: number;
  onExpire?: () => void;
};

const Ctx = createContext<(t: ToastSpec) => void>(() => undefined);
export const useToast = () => useContext(Ctx);

/** In app banners. Undo lives here (5 second window), and so does the thanks moment. */
export function ToastHost({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastSpec & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ w: 0, h: 0 });

  const show = useCallback((t: ToastSpec) => {
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now();
    setToast({ ...t, id });
    timer.current = setTimeout(() => {
      setToast((cur) => (cur?.id === id ? null : cur));
      t.onExpire?.();
    }, t.ms ?? 5000);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const thanks = toast?.kind === 'thanks';
  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <Animated.View key={toast.id} entering={FadeInUp.springify().damping(16)} exiting={FadeOutUp.duration(160)} style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="box-none">
          <View style={styles.outer}>
            <Edges width={size.w} height={size.h} depth={4} edge={thanks ? theme.color.together.edge : theme.color.border.strong} edgeDeep={thanks ? theme.color.together.edgeDeep : theme.color.border.subtle} />
            <View onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} style={[styles.face, { borderColor: thanks ? theme.color.together.base : theme.color.border.strong }]}>
              {thanks && <Heart size={22} color={theme.color.together.base} weight="fill" />}
              <View style={styles.copy}>
                <Text variant="label/md" color={thanks ? theme.color.together.base : theme.color.text.muted}>{toast.title}</Text>
                {!!toast.body && <Text variant={thanks ? 'display/accent' : 'body/md'} style={thanks ? styles.accent : undefined}>{toast.body}</Text>}
              </View>
              {toast.action && (
                <Pressable hitSlop={12} onPress={() => { toast.action?.onPress(); setToast(null); }} accessibilityRole="button" style={styles.action}>
                  <Text variant="label/md" color={theme.color.text.primary}>{toast.action.label}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 50 },
  outer: { paddingRight: 4, paddingBottom: 4 },
  face: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.color.bg.raised, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 14 },
  copy: { flex: 1, gap: 2 },
  accent: { fontSize: 20, lineHeight: 26 },
  action: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
});
