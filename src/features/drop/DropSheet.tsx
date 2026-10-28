import { Microphone, Stop } from 'phosphor-react-native';
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { type Card, fakeSort, splitDrop } from '@/features/deck/model';
import { useDeck } from '@/features/deck/store';
import { haptics } from '@/theme/haptics';
import { theme } from '@/theme/tokens';
import { PopButton } from '@/ui/PopButton';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

import { useVoice } from './voice';

export type DropMode = 'type' | 'voice';

const Ctx = createContext<(mode?: DropMode) => void>(() => undefined);
export const useOpenDrop = () => useContext(Ctx);

type Phase = 'typing' | 'sorting' | 'sorted';

export function DropProvider({ children }: { children: ReactNode }) {
  // A fresh key per open remounts the sheet, so every drop starts from a clean slate.
  const [open, setOpen] = useState<{ key: number; mode: DropMode } | null>(null);
  return (
    <Ctx.Provider value={(mode = 'type') => setOpen((o) => ({ key: (o?.key ?? 0) + 1, mode }))}>
      {children}
      {open && <DropSheet key={open.key} mode={open.mode} onClose={() => setOpen(null)} />}
    </Ctx.Provider>
  );
}

function DropSheet({ mode, onClose }: { mode: DropMode; onClose: () => void }) {
  const { dispatch } = useDeck();
  const toast = useToast();
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('typing');
  const [preview, setPreview] = useState<Card[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const voice = useVoice(text, setText);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const toggleVoice = () => {
    haptics.press();
    if (!voice.available) {
      setVoiceNote('Voice drop needs the new usync build. For now, tap the mic on your keyboard: it works the same, Hinglish too.');
      return;
    }
    if (voice.listening) voice.stop(); else voice.start().catch(() => undefined);
  };

  // Opened by holding the Drop button: start listening straight away.
  const started = useRef(false);
  useEffect(() => {
    if (mode !== 'voice' || started.current) return;
    started.current = true;
    const t = setTimeout(toggleVoice, 250);
    return () => clearTimeout(t);
  });

  const submit = () => {
    if (voice.listening) voice.stop();
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
      toast({ kind: 'info', title: `${cards.length === 1 ? '1 card' : `${cards.length} cards`} sorted`, body: 'Nothing for you to fill in. Dealt by who has less on their plate.', ms: 3500 });
      onClose();
    }, 2100));
  };

  return (
    <Sheet onClose={onClose}>
      {phase === 'typing' ? (
        <>
          <Text variant="label/md" color={theme.color.together.base}>{voice.listening ? 'Listening…' : 'Drop it'}</Text>
          <View style={[styles.input, voice.listening && styles.inputLive]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={mode === 'voice' ? 'Say it like you’d tell them…' : 'bedroom light flickering, call electrician, return the parcel'}
              placeholderTextColor={theme.color.text.muted}
              multiline
              autoFocus={mode === 'type'}
              style={styles.inputText}
              accessibilityLabel="What needs doing?"
            />
          </View>
          <View style={styles.row}>
            <MicButton listening={voice.listening} onPress={toggleVoice} />
            <PopButton label="Drop it" tone="cream" fill onPress={submit} disabled={!text.trim()} />
          </View>
          <Text variant="caption" color={theme.color.text.muted}>
            {voice.error ?? voiceNote ?? 'No dates, no owners, no buckets. One line; we’ll sort it. Several things in one line become several cards.'}
          </Text>
        </>
      ) : (
        <>
          <Text variant="label/md" color={theme.color.together.base}>{`1 line → ${preview.length} ${preview.length === 1 ? 'card' : 'cards'}`}</Text>
          <Text variant="title/lg">Here{'’'}s how we read it.</Text>
          {preview.map((c) => <SortRow key={c.id} card={c} sorting={phase === 'sorting'} />)}
        </>
      )}
    </Sheet>
  );
}

function MicButton({ listening, onPress }: { listening: boolean; onPress: () => void }) {
  const ring = useSharedValue(0);
  useEffect(() => {
    ring.set(listening ? withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 0 })), -1) : withTiming(0));
  }, [listening, ring]);
  const pulse = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - ring.value), transform: [{ scale: 1 + ring.value * 0.5 }] }));
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={listening ? 'Stop listening' : 'Drop by voice'} style={styles.micWrap} hitSlop={6}>
      <Animated.View style={[styles.micRing, pulse]} pointerEvents="none" />
      <View style={[styles.mic, listening && styles.micOn]}>
        {listening
          ? <Stop size={20} color={theme.color.text.inverse} weight="fill" />
          : <Microphone size={22} color={theme.color.text.primary} weight="bold" />}
      </View>
    </Pressable>
  );
}

function SortRow({ card, sorting }: { card: Card; sorting: boolean }) {
  const shimmer = useSharedValue(0.35);
  useEffect(() => {
    shimmer.set(withRepeat(withSequence(withTiming(0.9, { duration: 450 }), withTiming(0.35, { duration: 450 })), -1));
  }, [shimmer]);
  const s = useAnimatedStyle(() => ({ opacity: shimmer.value }));
  return (
    <View style={styles.sortRow}>
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

const MIC = 52;

const styles = StyleSheet.create({
  input: { backgroundColor: theme.color.bg.surface, borderWidth: 1.5, borderColor: theme.color.border.strong, paddingHorizontal: 16, paddingVertical: 12, minHeight: 88 },
  inputLive: { borderColor: theme.color.together.base },
  inputText: { color: theme.color.text.primary, fontFamily: 'Manrope_700Bold', fontSize: 17, lineHeight: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  micWrap: { width: MIC, height: MIC, alignItems: 'center', justifyContent: 'center' },
  micRing: { position: 'absolute', width: MIC, height: MIC, borderRadius: MIC / 2, borderWidth: 2, borderColor: theme.color.together.base },
  mic: { width: MIC, height: MIC, borderRadius: MIC / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: theme.color.border.strong, backgroundColor: theme.color.bg.surface },
  micOn: { backgroundColor: theme.color.together.base, borderColor: theme.color.together.base },
  sortRow: { backgroundColor: theme.color.bg.surface, borderWidth: 1, borderColor: theme.color.border.subtle, padding: 14, gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderStyle: 'dashed', borderColor: theme.color.border.strong, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  ghostChip: { height: 24, borderRadius: 12, backgroundColor: theme.color.bg.raised },
});
