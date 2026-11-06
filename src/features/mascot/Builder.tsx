import { router } from 'expo-router';
import { X } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAccount, useNames } from '@/features/account/account';
import type { Card } from '@/features/deck/model';
import { errorText } from '@/lib/supabase';
import { haptics } from '@/theme/haptics';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { PopButton } from '@/ui/PopButton';
import { Segmented } from '@/ui/Segmented';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

import { lineFor, type Mood, type Voice } from './lines';
import { Mascot } from './Mascot';
import { DEFAULT_RECIPE, type MascotRecipe, PARTS, randomRecipe, validRecipe } from './recipe';

type Tab = 'head' | 'facialHair' | 'accessories' | 'skin' | 'clothing';
const TABS: { value: Tab; label: string }[] = [
  { value: 'head', label: 'Hair' },
  { value: 'facialHair', label: 'Beard' },
  { value: 'accessories', label: 'Extras' },
  { value: 'skin', label: 'Skin' },
  { value: 'clothing', label: 'Top' },
];
const VOICES: { value: Voice; label: string }[] = [
  { value: 'he', label: 'He' },
  { value: 'she', label: 'She' },
  { value: 'neutral', label: 'Neutral' },
];
// The preview runs through what your partner will see as a card waits longer.
const MOODS: { mood: Mood; level: 1 | 2 | 3 | null; label: string }[] = [
  { mood: 'calm', level: null, label: 'All good' },
  { mood: 'gentle', level: 1, label: 'Gentle · 3 days' },
  { mood: 'cheeky', level: 2, label: 'Cheeky · 6 days' },
  { mood: 'firm', level: 3, label: 'Firm · 10 days' },
];
const SAMPLE = { id: 'sample-task', title: 'Renew the car insurance' } as Card;
/** A fixed day, so the sample line only changes with the mood and voice. */
const SAMPLE_DAY = Date.parse('2026-01-01T12:00:00');

/** Build the mascot your partner gets their nudges from: you, as an Open Peep, in your voice. */
export function MascotBuilder() {
  const t = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { me, partner, saveProfile } = useAccount();
  const names = useNames();
  const toast = useToast();
  const [recipe, setRecipe] = useState<MascotRecipe>(() => validRecipe(me?.mascot) ?? DEFAULT_RECIPE);
  const [voice, setVoice] = useState<Voice>(me?.voice ?? 'neutral');
  const [tab, setTab] = useState<Tab>('head');
  const [beat, setBeat] = useState(1);
  const [busy, setBusy] = useState(false);
  const them = partner?.name ?? 'your partner';
  const bg = t.tones[names.colors.me].glow[0];

  useEffect(() => {
    const id = setInterval(() => setBeat((b) => (b + 1) % MOODS.length), 1600);
    return () => clearInterval(id);
  }, []);
  const now = MOODS[beat];
  const sample = now.level ? lineFor(SAMPLE, 'mine', now.level, voice, SAMPLE_DAY) : `Nothing waiting. ${names.me}'s mascot is chilling.`;

  const set = <K extends keyof MascotRecipe>(k: K, v: MascotRecipe[K]) => { haptics.tick(); setRecipe((r) => ({ ...r, [k]: v })); };
  const save = async () => {
    setBusy(true);
    try {
      await saveProfile({ mascot: recipe, voice });
      haptics.success();
      toast({ kind: 'info', title: 'Mascot saved', body: `${them} gets their nudges from this one now.`, ms: 2500 });
      router.back();
    } catch (e) {
      toast({ kind: 'info', title: 'That didn’t work', body: errorText(e) });
    } finally { setBusy(false); }
  };

  return (
    <View style={[s.fill, { paddingTop: insets.top + 12 }]}>
      <View style={s.header}>
        <Text variant="display/lg">Your mascot</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={s.close}>
          <X size={22} color={t.color.text.primary} />
        </Pressable>
      </View>

      <View style={s.stage}>
        <Mascot recipe={recipe} mood={now.mood} size={168} bg={bg} />
        <Text variant="label/md" color={t.color.text.muted}>{now.label}</Text>
        <Animated.View key={beat} entering={FadeIn.duration(220)} style={s.bubble}>
          <Text variant="body/md" color={t.color.text.primary} style={s.center}>{sample}</Text>
        </Animated.View>
        <Text variant="caption" color={t.color.text.muted} style={s.center}>{`How ${them} sees you when a task of theirs sits too long.`}</Text>
      </View>

      <View style={s.controls}>
        <Segmented value={tab} onChange={setTab} options={TABS} />
        <ScrollView style={s.fill} contentContainerStyle={s.grid}>
          {tab === 'skin' || tab === 'clothing' ? (
            PARTS[tab].map((c) => (
              <Swatch key={c} on={recipe[tab] === c} onPress={() => set(tab, c)} label={c}>
                <View style={[s.colour, { backgroundColor: `#${c}` }]} />
              </Swatch>
            ))
          ) : (
            <>
              {tab !== 'head' && (
                <Swatch on={recipe[tab] === null} onPress={() => set(tab, null)} label="None">
                  <Mascot recipe={{ ...recipe, [tab]: null }} mood="calm" size={64} bg={t.color.bg.surface} />
                </Swatch>
              )}
              {PARTS[tab].map((p) => (
                <Swatch key={p} on={recipe[tab] === p} onPress={() => set(tab, p)} label={p}>
                  <Mascot recipe={{ ...recipe, [tab]: p }} mood="calm" size={64} bg={t.color.bg.surface} />
                </Swatch>
              ))}
            </>
          )}
        </ScrollView>
        <View style={s.voice}>
          <Text variant="label/md" color={t.color.text.muted}>Voice</Text>
          <Segmented value={voice} onChange={setVoice} options={VOICES} />
        </View>
        <View style={[s.actions, { paddingBottom: insets.bottom + 12 }]}>
          <View style={s.flex}><PopButton label="Shuffle" tone="ghost" onPress={() => { haptics.tick(); setRecipe(randomRecipe()); }} /></View>
          <View style={s.flex}><PopButton label={busy ? 'Saving…' : 'Save'} tone="primary" disabled={busy} onPress={save} /></View>
        </View>
      </View>
    </View>
  );
}

function Swatch({ on, onPress, label, children }: { on: boolean; onPress: () => void; label: string; children: React.ReactNode }) {
  const t = useTheme();
  const s = useStyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label} style={[s.swatch, on && { borderColor: t.color.action.primary }]}>
      {children}
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  fill: { flex: 1, backgroundColor: t.color.bg.canvas },
  flex: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 56, paddingHorizontal: 20 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: t.color.bg.surface },
  stage: { alignItems: 'center', gap: 10, paddingHorizontal: 28, paddingVertical: 12 },
  bubble: { backgroundColor: t.color.bg.surface, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10, minHeight: 60, justifyContent: 'center', alignSelf: 'stretch' },
  center: { textAlign: 'center' },
  controls: { flex: 1, paddingHorizontal: 20, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 4, justifyContent: 'center' },
  swatch: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  colour: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: t.color.border.subtle },
  voice: { gap: 6 },
  actions: { flexDirection: 'row', gap: 12 },
}));
