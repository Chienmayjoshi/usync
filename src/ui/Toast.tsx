import { Heart } from 'phosphor-react-native';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '@/theme/ThemeProvider';

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
  const t = useTheme();
  const s = useStyles();

  const show = useCallback((spec: ToastSpec) => {
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now();
    setToast({ ...spec, id });
    timer.current = setTimeout(() => {
      setToast((cur) => (cur?.id === id ? null : cur));
      spec.onExpire?.();
    }, spec.ms ?? 5000);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const thanks = toast?.kind === 'thanks';
  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <Animated.View key={toast.id} entering={FadeInUp.springify().damping(16)} exiting={FadeOutUp.duration(160)} style={[s.wrap, { top: insets.top + 8 }]} pointerEvents="box-none">
          <View style={s.face}>
            {thanks && <Heart size={22} color={t.color.accent.heart} weight="fill" />}
            <View style={s.copy}>
              <Text variant="label/md" color={thanks ? t.color.accent.heart : t.color.text.secondary}>{toast.title}</Text>
              {!!toast.body && <Text variant="body/md">{toast.body}</Text>}
            </View>
            {toast.action && (
              <Pressable hitSlop={12} onPress={() => { toast.action?.onPress(); setToast(null); }} accessibilityRole="button" style={s.action}>
                <Text variant="button/sm">{toast.action.label}</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 50 },
  face: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.color.bg.raised, borderRadius: t.radius.lg,
    borderWidth: 1, borderColor: t.color.border.card, paddingHorizontal: 18, paddingVertical: 14, boxShadow: t.shadow.card,
  },
  copy: { flex: 1, gap: 2 },
  action: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: t.radius.full, backgroundColor: t.color.bg.surface },
}));
