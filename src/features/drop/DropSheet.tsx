import AsyncStorage from '@react-native-async-storage/async-storage';
import { Microphone, Stop } from 'phosphor-react-native';
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { Pressable, Switch, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { useAccount, useNames } from '@/features/account/account';
import { type Card, type DropPlace, fakeSort, splitDrop } from '@/features/deck/model';
import { useDeck } from '@/features/deck/store';
import { haptics } from '@/theme/haptics';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/type';
import { Chip } from '@/ui/Chip';
import { PopButton } from '@/ui/PopButton';
import { Segmented } from '@/ui/Segmented';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

import { useVoice } from './voice';
import { VoiceBar } from './VoiceBar';

export type DropMode = 'type' | 'voice';

const Ctx = createContext<(mode?: DropMode) => void>(() => undefined);
export const useOpenDrop = () => useContext(Ctx);

type Phase = 'typing' | 'sorting' | 'sorted';

const PLACE_KEY = 'usync.drop.place';

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
  const t = useTheme();
  const styles = useStyles();
  const { dispatch } = useDeck();
  const { partner } = useAccount();
  const names = useNames();
  const toast = useToast();
  const [text, setText] = useState('');
  // Remembered between adds: someone adding their own errands shouldn't re-pick every time.
  const [place, setPlace] = useState<DropPlace>('table');
  const [surprise, setSurprise] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(PLACE_KEY).then((v) => { if (v === 'table' || v === 'mine') setPlace(v); }).catch(() => undefined);
  }, []);
  const pickPlace = (v: DropPlace) => { setPlace(v); if (v === 'table') setSurprise(false); AsyncStorage.setItem(PLACE_KEY, v).catch(() => undefined); };
  const toggleSurprise = (on: boolean) => { haptics.tick(); setSurprise(on); if (on) pickPlace('mine'); };
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
    const where: DropPlace = partner ? place : 'mine';
    const cards = parts.map((p) => fakeSort(p, where, surprise));
    setPreview(cards);
    setPhase('sorting');
    // Card appears instantly; sorting resolves without blocking (rule F8).
    timers.current.push(setTimeout(() => { setPhase('sorted'); haptics.tick(); }, 900));
    timers.current.push(setTimeout(() => {
      dispatch({ type: 'drop', cards, place: where, surprise });
      haptics.success();
      const body = surprise ? `Only you can see it until it’s done.` : where === 'mine' ? 'It’s on your deck.' : `It’s on the table. You or ${names.partnerOr} can take it.`;
      toast({ kind: 'info', title: `${cards.length === 1 ? '1 card' : `${cards.length} cards`} added`, body, ms: 4500 });
      onClose();
    }, 2100));
  };

  return (
    <Sheet onClose={onClose}>
      {phase === 'typing' && mode === 'voice' && voice.listening ? (
        <VoiceBar text={text} onStop={toggleVoice} />
      ) : phase === 'typing' ? (
        <>
          <Text variant="label/md" color={voice.listening ? t.color.accent.tag : t.color.text.secondary}>{voice.listening ? 'Listening…' : 'Add a task'}</Text>
          <View style={[styles.input, voice.listening && styles.inputLive]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={mode === 'voice' ? 'Say it like you’d tell them…' : 'bedroom light flickering, call electrician, return the parcel'}
              placeholderTextColor={t.color.text.placeholder}
              keyboardAppearance={t.scheme}
              multiline
              autoFocus={mode === 'type'}
              style={styles.inputText}
              accessibilityLabel="What needs doing?"
            />
          </View>
          {partner && (
            <View style={styles.who}>
              <Text variant="label/md" color={t.color.text.secondary}>Where does it go?</Text>
              <Segmented value={place} onChange={pickPlace} options={[{ value: 'table', label: 'On the table' }, { value: 'mine', label: 'My deck' }]} />
              <View style={styles.switchRow}>
                <View style={styles.flex}>
                  <Text variant="title/md">{`A surprise for ${names.partnerOr}`}</Text>
                  <Text variant="caption" color={t.color.text.secondary}>Only you can see it until it’s done.</Text>
                </View>
                <Switch
                  value={surprise}
                  onValueChange={toggleSurprise}
                  trackColor={{ false: t.color.action.neutral, true: t.color.action.primary }}
                  thumbColor={t.scheme === 'light' ? '#FFFFFF' : t.color.bg.canvas}
                  ios_backgroundColor={t.color.action.neutral}
                  accessibilityLabel={`A surprise for ${names.partnerOr}`}
                />
              </View>
            </View>
          )}
          <View style={styles.row}>
            <PopButton label={surprise ? 'Add surprise' : 'Add task'} tone="primary" fill onPress={submit} disabled={!text.trim()} />
            <MicButton listening={voice.listening} onPress={toggleVoice} />
          </View>
          <Text variant="caption" color={t.color.text.muted}>
            {voice.error ?? voiceNote ?? 'One line; we’ll sort it. Several things in one line become several cards. Hold + to say it instead.'}
          </Text>
        </>
      ) : (
        <>
          <Text variant="label/md" color={t.color.text.secondary}>{`1 line → ${preview.length} ${preview.length === 1 ? 'card' : 'cards'}`}</Text>
          <Text variant="title/lg">Here{'’'}s how we read it.</Text>
          {preview.map((c) => <SortRow key={c.id} card={c} sorting={phase === 'sorting'} />)}
        </>
      )}
    </Sheet>
  );
}

function MicButton({ listening, onPress }: { listening: boolean; onPress: () => void }) {
  const t = useTheme();
  const styles = useStyles();
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
          ? <Stop size={20} color={t.color.text.onColor} weight="fill" />
          : <Microphone size={22} color={t.color.action.onPrimary} weight="bold" />}
      </View>
    </Pressable>
  );
}

function SortRow({ card, sorting }: { card: Card; sorting: boolean }) {
  const styles = useStyles();
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
          : [card.bucket, card.effort, card.when].map((g) => <Chip key={g} label={g} />)}
      </View>
    </View>
  );
}

const MIC = 48;

const useStyles = makeStyles((t) => ({
  input: { backgroundColor: t.color.bg.surface, borderRadius: t.radius.md, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 16, paddingVertical: 12, minHeight: 88 },
  inputLive: { borderColor: t.color.accent.tag },
  inputText: { color: t.color.text.primary, fontFamily: fonts.uiSemiBold, fontSize: 17, lineHeight: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  who: { gap: 10 },
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.color.bg.surface, borderRadius: t.radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  micWrap: { width: MIC, height: MIC, alignItems: 'center', justifyContent: 'center' },
  micRing: { position: 'absolute', width: MIC, height: MIC, borderRadius: MIC / 2, borderWidth: 2, borderColor: t.color.action.negative },
  mic: { width: MIC, height: MIC, borderRadius: MIC / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: t.color.action.primary },
  micOn: { backgroundColor: t.color.action.negative },
  sortRow: { backgroundColor: t.color.bg.surface, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.color.border.subtle, padding: 16, gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ghostChip: { height: 26, borderRadius: 13, backgroundColor: t.color.bg.sunken },
}));
