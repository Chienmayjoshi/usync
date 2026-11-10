import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stop } from 'phosphor-react-native';
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, type TextStyle, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { useAccount, useNames } from '@/features/account/account';
import { type Card, type DropPlace, fakeSort, splitDrop } from '@/features/deck/model';
import { useDeck } from '@/features/deck/store';
import { haptics } from '@/theme/haptics';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/type';
import { Chip } from '@/ui/Chip';
import { PopButton } from '@/ui/PopButton';
import { Segmented } from '@/ui/Segmented';
import { Sheet, useSheetClose } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { Toggle } from '@/ui/Toggle';
import { useToast } from '@/ui/Toast';

import { useVoice } from './voice';
import { VoiceBar } from './VoiceBar';
import { PrioritySlider } from './PrioritySlider';
import { type Step, stepFromText } from './priority';

export type DropMode = 'type' | 'voice';

const Ctx = createContext<(mode?: DropMode) => void>(() => undefined);
export const useOpenDrop = () => useContext(Ctx);

type Phase = 'typing' | 'sorting' | 'sorted';

const PLACE_KEY = 'usync.drop.place';
/** Voice drop waits on the native build; until then the mic is a second Add button. */
const VOICE_READY = false;

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
  return <Sheet onClose={onClose}><DropBody mode={mode} /></Sheet>;
}

function DropBody({ mode }: { mode: DropMode }) {
  const onClose = useSheetClose();
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
  // Not Decided and Myself are remembered between adds; Together is asked fresh each time.
  const pickPlace = (v: DropPlace) => { setPlace(v); if (v !== 'together') AsyncStorage.setItem(PLACE_KEY, v).catch(() => undefined); };
  // A surprise is always mine: it hides "Who's doing it?" and leaves the pick as it was for later.
  const toggleSurprise = (on: boolean) => setSurprise(on);
  // The knob follows the typed words ("kal", "by Friday") until it is moved by hand.
  const [picked, setPicked] = useState<Step | null>(null);
  const step: Step = picked ?? stepFromText(text) ?? 'today';
  const [phase, setPhase] = useState<Phase>('typing');
  const [preview, setPreview] = useState<Card[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const raw = useVoice(text, setText);
  const voice = VOICE_READY ? raw : { ...raw, available: false, listening: false, error: null };

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const toggleVoice = () => {
    haptics.press();
    if (voice.listening) voice.stop(); else voice.start().catch(() => undefined);
  };

  // Opened by holding the Drop button: start listening straight away.
  const started = useRef(false);
  useEffect(() => {
    if (mode !== 'voice' || !voice.available || started.current) return;
    started.current = true;
    const t = setTimeout(toggleVoice, 250);
    return () => clearTimeout(t);
  });

  const submit = () => {
    if (voice.listening) voice.stop();
    const parts = splitDrop(text);
    if (!parts.length) return;
    haptics.press();
    const where: DropPlace = surprise || !partner ? 'mine' : place;
    const cards = parts.map((p) => fakeSort(p, where, surprise, step));
    setPreview(cards);
    setPhase('sorting');
    // Card appears instantly; sorting resolves without blocking (rule F8).
    timers.current.push(setTimeout(() => { setPhase('sorted'); haptics.tick(); }, 900));
    timers.current.push(setTimeout(() => {
      dispatch({ type: 'drop', cards, place: where, surprise });
      haptics.success();
      const body = surprise ? `Only you can see it until you reveal it.`
        : where === 'mine' ? 'It’s on your deck.'
        : where === 'together' ? `Asked ${names.partnerOr} to do it together. It waits in Doing Together until they say yes.`
        : `It’s on the table. You or ${names.partnerOr} can take it.`;
      toast({ kind: 'info', title: `${cards.length === 1 ? '1 card' : `${cards.length} cards`} added`, body, ms: 4500 });
      onClose();
    }, 2100));
  };

  // Until voice ships, the mic is a second Add button: same state, same action.
  const empty = !text.trim();
  const mic = voice.available ? { onPress: toggleVoice, disabled: false } : { onPress: submit, disabled: empty };

  return (
    <>
      {phase === 'typing' && mode === 'voice' && voice.listening ? (
        <VoiceBar text={text} onStop={toggleVoice} />
      ) : phase === 'typing' ? (
        <View style={styles.form}>
          <View style={styles.top}>
            <View style={styles.header}>
              <Text style={[styles.heading, styles.title]} numberOfLines={1} color={voice.listening ? t.color.accent.tag : t.color.text.primary}>{voice.listening ? 'LISTENING…' : 'ADD A TASK'}</Text>
              {partner && (
                <View style={styles.surprise}>
                  <Text style={styles.heading} color={t.color.text.secondary}>SURPRISE?</Text>
                  <Toggle size="sm" value={surprise} onChange={toggleSurprise} accessibilityLabel={`A surprise for ${names.partnerOr}`} />
                </View>
              )}
            </View>
            <View style={[styles.input, voice.listening && styles.inputLive]}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={voice.listening ? 'SAY IT LIKE YOU’D TELL THEM…' : surprise ? 'WHAT’S THE SURPRISE?' : 'ENTER TASK HERE'}
                placeholderTextColor={t.color.field.placeholder}
                keyboardAppearance={t.scheme}
                multiline
                maxFontSizeMultiplier={1}
                autoFocus={mode === 'type' || !voice.available}
                style={[styles.inputText, noRing]}
                accessibilityLabel={surprise ? 'What’s the surprise?' : 'What needs doing?'}
              />
            </View>
          </View>
          {partner && (surprise ? (
            <Animated.View key="note" entering={FadeIn.duration(180).delay(80)} exiting={FadeOut.duration(120)} style={styles.note}>
              <Text variant="caption" color={t.color.text.secondary}>{`Just you. ${names.partnerOr} sees it once you reveal it.`}</Text>
            </Animated.View>
          ) : (
            <Animated.View key="who" entering={FadeIn.duration(180).delay(80)} exiting={FadeOut.duration(120)} style={styles.block}>
              <Text style={styles.heading} color={t.color.text.primary}>WHO’S DOING IT?</Text>
              <Segmented shape="pill" value={place} onChange={pickPlace} options={[{ value: 'table', label: 'Not Decided' }, { value: 'mine', label: 'Myself' }, { value: 'together', label: 'Together' }]} />
            </Animated.View>
          ))}
          <Animated.View layout={SHIFT} style={styles.block}>
            <Text style={styles.heading} color={t.color.text.primary}>{surprise ? 'REVEAL IT BY?' : 'WHAT’S THE PRIORITY?'}</Text>
            <PrioritySlider value={step} onChange={setPicked} accessibilityLabel={surprise ? 'Reveal it by' : 'Priority'} />
          </Animated.View>
          <Animated.View layout={SHIFT} style={styles.row}>
            <PopButton label={surprise ? 'Add surprise' : 'Add Task'} tone="primary" fill large onPress={submit} disabled={empty} />
            <MicButton listening={voice.listening} onPress={mic.onPress} disabled={mic.disabled} />
          </Animated.View>
          {voice.error && <Text variant="caption" color={t.color.action.negative}>{voice.error}</Text>}
        </View>
      ) : (
        <>
          <Text variant="label/md" color={t.color.text.secondary}>{`1 line → ${preview.length} ${preview.length === 1 ? 'card' : 'cards'}`}</Text>
          <Text variant="title/lg">Here{'’'}s how we read it.</Text>
          {preview.map((c) => <SortRow key={c.id} card={c} sorting={phase === 'sorting'} />)}
        </>
      )}
    </>
  );
}

function MicButton({ listening, onPress, disabled }: { listening: boolean; onPress: () => void; disabled: boolean }) {
  const t = useTheme();
  const styles = useStyles();
  const ring = useSharedValue(0);
  useEffect(() => {
    ring.set(listening ? withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 0 })), -1) : withTiming(0));
  }, [listening, ring]);
  const pulse = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - ring.value), transform: [{ scale: 1 + ring.value * 0.5 }] }));
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={listening ? 'Stop listening' : 'Drop by voice'} accessibilityState={{ disabled }} disabled={disabled} style={[styles.micWrap, disabled && styles.dim]} hitSlop={6}>
      <Animated.View style={[styles.micRing, pulse]} pointerEvents="none" />
      <View style={[styles.mic, listening && styles.micOn]}>
        {listening
          ? <Stop size={20} color={t.color.text.onColor} weight="fill" />
          : <MicIcon color={t.color.action.onPrimary} />}
      </View>
    </Pressable>
  );
}

/** Figma "Mic" glyph (158:17538), exported as is. */
function MicIcon({ color }: { color: string }) {
  return (
    <Svg width={15} height={22} viewBox="0 0 15 22" fill="none">
      <Path fill={color} d="M7.5 15C8.69309 14.9988 9.83697 14.5243 10.6806 13.6806C11.5243 12.837 11.9988 11.6931 12 10.5V4.5C12 3.30653 11.5259 2.16193 10.682 1.31802C9.83807 0.474106 8.69347 0 7.5 0C6.30653 0 5.16193 0.474106 4.31802 1.31802C3.47411 2.16193 3 3.30653 3 4.5V10.5C3.00124 11.6931 3.47575 12.837 4.31939 13.6806C5.16303 14.5243 6.30691 14.9988 7.5 15ZM4.5 4.5C4.5 3.70435 4.81607 2.94129 5.37868 2.37868C5.94129 1.81607 6.70435 1.5 7.5 1.5C8.29565 1.5 9.05871 1.81607 9.62132 2.37868C10.1839 2.94129 10.5 3.70435 10.5 4.5V10.5C10.5 11.2956 10.1839 12.0587 9.62132 12.6213C9.05871 13.1839 8.29565 13.5 7.5 13.5C6.70435 13.5 5.94129 13.1839 5.37868 12.6213C4.81607 12.0587 4.5 11.2956 4.5 10.5V4.5ZM8.25 17.9625V21C8.25 21.1989 8.17098 21.3897 8.03033 21.5303C7.88968 21.671 7.69891 21.75 7.5 21.75C7.30109 21.75 7.11032 21.671 6.96967 21.5303C6.82902 21.3897 6.75 21.1989 6.75 21V17.9625C4.90091 17.7743 3.18728 16.9072 1.94048 15.5288C0.693677 14.1504 0.00228386 12.3586 0 10.5C0 10.3011 0.0790178 10.1103 0.21967 9.96967C0.360322 9.82902 0.551088 9.75 0.75 9.75C0.948912 9.75 1.13968 9.82902 1.28033 9.96967C1.42098 10.1103 1.5 10.3011 1.5 10.5C1.5 12.0913 2.13214 13.6174 3.25736 14.7426C4.38258 15.8679 5.9087 16.5 7.5 16.5C9.0913 16.5 10.6174 15.8679 11.7426 14.7426C12.8679 13.6174 13.5 12.0913 13.5 10.5C13.5 10.3011 13.579 10.1103 13.7197 9.96967C13.8603 9.82902 14.0511 9.75 14.25 9.75C14.4489 9.75 14.6397 9.82902 14.7803 9.96967C14.921 10.1103 15 10.3011 15 10.5C14.9977 12.3586 14.3063 14.1504 13.0595 15.5288C11.8127 16.9072 10.0991 17.7743 8.25 17.9625Z" />
    </Svg>
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

const MIC = 56;
/** Rows below the Who block glide into place when it gives way to the surprise note (on-screen move: ease-in-out). */
const SHIFT = LinearTransition.duration(220).easing(Easing.bezier(0.77, 0, 0.175, 1));
// Chrome draws its own focus ring on the textarea; the sheet's stroke is the focus state instead.
const noRing = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

const useStyles = makeStyles((t) => ({
  // Figma "Sheet: update" (267:24575): sections 24 apart, a heading 12 above each.
  form: { gap: 24 },
  top: { gap: 12 },
  block: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 },
  surprise: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Android measures text without its letter spacing and then draws it with it, so a tight
  // tracking can push the last word off ("ADD A"). Figma's -0.24 only on iOS.
  heading: { fontFamily: fonts.uiBold, fontSize: 12, lineHeight: 16, letterSpacing: Platform.OS === 'ios' ? -0.24 : 0 },
  title: { flexShrink: 0, flexGrow: 1, marginRight: 12 },
  note: { minHeight: 16 },
  // Figma 267:24587: 200 tall, r24, a white 1.5 edge and a soft drop, the words big and black.
  input: {
    height: 200, borderRadius: 24, backgroundColor: t.color.field.bg, borderWidth: 1.5, borderColor: t.color.field.border,
    boxShadow: t.color.field.shadow, overflow: 'hidden',
  },
  inputLive: { borderColor: t.color.accent.tag },
  inputText: {
    color: t.color.text.primary, fontFamily: fonts.uiExtraBold, fontSize: 24, lineHeight: 32, letterSpacing: -0.48,
    flex: 1, padding: 24, paddingTop: 24, textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  who: { gap: 12 },
  dim: { opacity: 0.3 },
  switchTitle: { fontSize: 15, lineHeight: 20 },
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
