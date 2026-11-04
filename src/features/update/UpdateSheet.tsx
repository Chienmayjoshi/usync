import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import type { Card } from '@/features/deck/model';
import { useDeck } from '@/features/deck/store';
import { isWaiting } from '@/lib/sorter';
import { errorText } from '@/lib/supabase';
import { haptics } from '@/theme/haptics';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/type';
import { PopButton } from '@/ui/PopButton';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

/** Hold a card, say one line about what changed. No threads, no comments: it lands in the job story. */
export function UpdateSheet({ card, onClose }: { card: Card; onClose: () => void }) {
  const t = useTheme();
  const styles = useStyles();
  const { addUpdate } = useDeck();
  const toast = useToast();
  const [note, setNote] = useState('');
  // The guess follows the words until the person taps the chip themselves.
  const [manual, setManual] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waiting = manual ?? isWaiting(note);

  useEffect(() => { haptics.take(); }, []);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await addUpdate(card.id, note, waiting);
      haptics.success();
      toast({ kind: 'info', title: waiting ? 'Parked in waiting' : 'Added to the story', body: waiting ? 'Off your deck until they come through. It never counts as a slip.' : card.title, ms: 3500 });
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Sheet onClose={onClose}>
      <Text variant="label/md" color={t.color.text.secondary}>Add an update</Text>
      <Text variant="display/md">{card.title}</Text>
      <View style={styles.input}>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="he needs a spare part, back Tuesday 11am"
          placeholderTextColor={t.color.text.placeholder}
          keyboardAppearance={t.scheme}
          multiline
          autoFocus
          style={styles.inputText}
          accessibilityLabel="One line update"
        />
      </View>
      <Pressable onPress={() => { haptics.tick(); setManual(!waiting); }} style={[styles.chip, waiting && styles.chipOn]} accessibilityRole="switch" accessibilityState={{ checked: waiting }}>
        <Text variant="label/md" color={waiting ? t.color.text.onColor : t.color.text.secondary}>{waiting ? 'Waiting on someone else' : 'Still on my plate'}</Text>
      </Pressable>
      <Text variant="caption" color={t.color.text.muted}>{waiting ? 'The card leaves your deck and sits in “Waiting on others”. Tap it when they come through.' : 'Tap the chip if you’re waiting on someone, like a technician or a callback.'}</Text>
      {error && <Text variant="body/md" color={t.color.action.negative}>{error}</Text>}
      <PopButton label={busy ? 'Saving…' : 'Save update'} tone="primary" disabled={!note.trim() || busy} onPress={save} />
    </Sheet>
  );
}

const useStyles = makeStyles((t) => ({
  input: { backgroundColor: t.color.bg.surface, borderRadius: t.radius.md, paddingHorizontal: 16, paddingVertical: 12, minHeight: 72 },
  inputText: { color: t.color.text.primary, fontFamily: fonts.uiSemiBold, fontSize: 17, lineHeight: 22 },
  chip: { alignSelf: 'flex-start', borderWidth: 1, borderColor: t.color.border.strong, borderRadius: t.radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: t.color.accent.tag, borderColor: t.color.accent.tag },
}));
