import { Heart } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAccount, useNames } from '@/features/account/account';
import type { Card } from '@/features/deck/model';
import { useDeck } from '@/features/deck/store';
import { errorText } from '@/lib/supabase';
import { haptics } from '@/theme/haptics';
import { theme } from '@/theme/tokens';
import { Field } from '@/ui/Field';
import { PopButton } from '@/ui/PopButton';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

/** Both halves of thanks: receiving one (full screen, stays until read) and sending one. */
export function Hearts() {
  const { me } = useAccount();
  if (!me?.couple_id) return null;
  return (
    <>
      <HeartMoment />
      <SendHeartHost />
    </>
  );
}

/**
 * A heart from the partner takes the whole screen and waits to be read. A banner that slides
 * away in five seconds is wrong for the one moment the product is built around.
 */
function HeartMoment() {
  const { hearts, ackHeart, state } = useDeck();
  const names = useNames();
  const insets = useSafeAreaInsets();
  const beat = useSharedValue(1);
  const heart = hearts[0];
  useEffect(() => {
    if (!heart) return;
    haptics.success();
    beat.set(withRepeat(withSequence(withTiming(1.12, { duration: 220 }), withSpring(1, { damping: 6 })), -1, false));
  }, [heart, beat]);
  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));
  if (!heart) return null;
  const card = state.cards.find((c) => c.id === heart.task_id);
  const from = names.partnerOr;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => ackHeart(heart.id)}>
      <View style={[styles.moment, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.center}>
          <Animated.View entering={ZoomIn.springify().damping(10)} style={pulse}>
            <Heart size={112} color={theme.color.together.base} weight="fill" />
          </Animated.View>
          <Animated.View entering={FadeIn.delay(200)} style={styles.copy}>
            <Text variant="label/md" color={theme.color.together.base}>{`${from} sent you a heart`}</Text>
            {card && <Text variant="title/lg" style={styles.text}>{`for “${card.title}”`}</Text>}
            {heart.note ? (
              <Text variant="display/accent" style={[styles.text, styles.note]}>{`“${heart.note}”`}</Text>
            ) : (
              <Text variant="body/lg" color={theme.color.text.secondary} style={styles.text}>They noticed. That’s the whole point.</Text>
            )}
          </Animated.View>
        </View>
        <View style={styles.actions}>
          {hearts.length > 1 && <Text variant="caption" color={theme.color.text.muted} style={styles.text}>{`${hearts.length - 1} more waiting`}</Text>}
          <PopButton label={hearts.length > 1 ? 'Next heart' : 'Got it'} tone="gold" onPress={() => { haptics.take(); ackHeart(heart.id); }} />
        </View>
      </View>
    </Modal>
  );
}

function SendHeartHost() {
  const { heartFor, askHeart } = useDeck();
  if (!heartFor) return null;
  return <SendHeart key={heartFor.id} card={heartFor} onClose={() => askHeart(null)} />;
}

/** One tap heart, with an optional line. Any day of the week, not only at Sunday Sync. */
function SendHeart({ card, onClose }: { card: Card; onClose: () => void }) {
  const { sendThanks } = useDeck();
  const names = useNames();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await sendThanks(card.id, note);
      haptics.success();
      toast({ kind: 'thanks', title: 'Heart sent', body: `${names.partnerOr} will see it the next time they open usync.`, ms: 3500 });
      onClose();
    } catch (e) {
      toast({ kind: 'info', title: 'That didn’t send', body: errorText(e) });
      setBusy(false);
    }
  };
  return (
    <Sheet onClose={onClose}>
      <Text variant="label/md" color={theme.color.together.base}>{`Thank ${names.partnerOr}`}</Text>
      <Text variant="title/lg">{card.title}</Text>
      <Field label="Add a line (optional)" value={note} onChangeText={setNote} placeholder="Light’s back. You’re a star." maxLength={200} />
      <PopButton label={busy ? 'Sending…' : 'Send a heart'} tone="gold" disabled={busy} onPress={send} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  moment: { flex: 1, backgroundColor: theme.color.bg.canvas, paddingHorizontal: 24, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  copy: { alignItems: 'center', gap: 12 },
  text: { textAlign: 'center' },
  note: { fontSize: 28, lineHeight: 36 },
  actions: { gap: 10 },
});
