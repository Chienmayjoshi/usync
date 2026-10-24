import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type Card, fakeSort, splitDrop } from '@/features/deck/model';
import { useDeck } from '@/features/deck/store';
import { haptics } from '@/theme/haptics';
import { motion } from '@/theme/motion';
import { theme } from '@/theme/tokens';
import { PopButton } from '@/ui/PopButton';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

const Ctx = createContext<() => void>(() => undefined);
export const useOpenDrop = () => useContext(Ctx);

type Phase = 'typing' | 'sorting' | 'sorted';

export function DropProvider({ children }: { children: ReactNode }) {
  // A fresh key per open remounts the sheet, so every drop starts from a clean slate.
  const [openKey, setOpenKey] = useState(0);
  const [open, setOpen] = useState(false);
  return (
    <Ctx.Provider value={() => { setOpenKey((k) => k + 1); setOpen(true); }}>
      {children}
      {open && <DropSheet key={openKey} onClose={() => setOpen(false)} />}
    </Ctx.Provider>
  );
}

function DropSheet({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { dispatch } = useDeck();
  const toast = useToast();
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('typing');
  const [preview, setPreview] = useState<Card[]>([]);
  const y = useSharedValue(600);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    y.set(withSpring(0, motion.sheetIn));
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, [y]);

  const close = () => {
    y.set(withTiming(600, motion.sheetOut));
    timers.current.push(setTimeout(onClose, motion.sheetOut.duration));
  };

  const submit = () => {
    const parts = splitDrop(text);
    if (!parts.length) return;
    haptics.press();
    const cards = parts.map(fakeSort);
    setPreview(cards);
    setPhase('sorting');
    // Card appears instantly; sorting resolves without blocking (rule F8).
    timers.current.push(setTimeout(() => { setPhase('sorted'); haptics.tick(); }, 900));
    timers.current.push(setTimeout(() => {
      dispatch({ type: 'drop', cards });
      haptics.success();
      toast({ kind: 'info', title: `${cards.length === 1 ? '1 card' : `${cards.length} cards`} sorted`, body: 'Nothing for you to fill in. It’s on your deck.', ms: 3500 });
      close();
    }, 2100));
  };

  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }, sheet]}>
          <View style={styles.handle} />
          {phase === 'typing' ? (
            <>
              <Text variant="label/md" color={theme.color.partner.a}>Drop it</Text>
              <View style={styles.input}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="bedroom light flickering, call electrician, return the parcel"
                  placeholderTextColor={theme.color.text.muted}
                  multiline
                  autoFocus
                  style={styles.inputText}
                  accessibilityLabel="What needs doing?"
                />
              </View>
              <Text variant="caption" color={theme.color.text.muted}>No dates, no owners, no buckets. One line; we{'’'}ll sort it. Tip: your keyboard mic works for voice, Hinglish too.</Text>
              <PopButton label="Drop it" tone="cream" onPress={submit} disabled={!text.trim()} />
            </>
          ) : (
            <>
              <Text variant="label/md" color={theme.color.partner.a}>{`1 line → ${preview.length} ${preview.length === 1 ? 'card' : 'cards'}`}</Text>
              <Text variant="title/lg">Here{'’'}s how we read it.</Text>
              {preview.map((c) => <SortRow key={c.id} card={c} sorting={phase === 'sorting'} />)}
              <Text variant="caption" color={theme.color.text.muted}>Guesses are tappable to fix in a later sprint. Fixes teach usync.</Text>
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SortRow({ card, sorting }: { card: Card; sorting: boolean }) {
  const shimmer = useSharedValue(0.35);
  useEffect(() => {
    shimmer.set(withRepeat(withSequence(withTiming(0.9, { duration: 450 }), withTiming(0.35, { duration: 450 })), -1));
  }, [shimmer]);
  const s = useAnimatedStyle(() => ({ opacity: shimmer.value }));
  return (
    <View style={styles.row}>
      <Text variant="title/md">{card.title}</Text>
      <View style={styles.chips}>
        {sorting
          ? [64, 84, 56].map((w) => <Animated.View key={w} style={[styles.ghostChip, { width: w }, s]} />)
          : [card.bucket, card.effort, card.when].map((g) => (
              <View key={g} style={styles.chip}><Text variant="label/md" color={theme.color.text.secondary}>{g}</Text></View>
            ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.62)' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.color.bg.raised, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: theme.color.border.subtle, paddingHorizontal: 20, paddingTop: 12, gap: 14 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: theme.color.border.strong },
  input: { backgroundColor: theme.color.bg.surface, borderWidth: 1.5, borderColor: theme.color.partner.a, paddingHorizontal: 16, paddingVertical: 12, minHeight: 72 },
  inputText: { color: theme.color.text.primary, fontFamily: 'Manrope_700Bold', fontSize: 17, lineHeight: 22 },
  row: { backgroundColor: theme.color.bg.surface, borderWidth: 1, borderColor: theme.color.border.subtle, padding: 14, gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderStyle: 'dashed', borderColor: theme.color.border.strong, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  ghostChip: { height: 24, borderRadius: 12, backgroundColor: theme.color.bg.raised },
});
