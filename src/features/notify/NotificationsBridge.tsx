import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { type Href, router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useAccount, useNames } from '@/features/account/account';
import { MOOD_FOR, type NudgeLevel } from '@/features/mascot/lines';
import { Mascot } from '@/features/mascot/Mascot';
import { type PushKind, registerForPush } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { useToast } from '@/ui/Toast';

const SEEN = 'usync.banners.seenAt';
const routeFor = (kind: unknown): Href => (kind === 'sync' ? '/sync' : kind === 'drop' || kind === 'done' ? '/us' : '/');

type Row = { kind: PushKind; title: string; body: string; sent_at: string };

/**
 * Asks for push once the space is real (paired), opens the right tab from a tapped push, and
 * shows pushes that land while the app is open as its own banners. Phones without push get the
 * same messages as banners the next time they open the app.
 */
export function NotificationsBridge() {
  const { me } = useAccount();
  const toast = useToast();
  const paired = !!me?.couple_id;
  const hasPush = useRef(false);
  const t = useTheme();
  const names = useNames();
  // The partner's mascot, kept current for the notification listener (which is set up once).
  const mascotRef = useRef({ recipe: names.mascots.partner, bg: t.tones[names.colors.partner].glow[0] });
  useEffect(() => {
    mascotRef.current = { recipe: names.mascots.partner, bg: t.tones[names.colors.partner].glow[0] };
  }, [names.mascots.partner, names.colors.partner, t]);

  useEffect(() => {
    if (!paired) return;
    let live = true;
    registerForPush()
      .then((ok) => { if (live) hasPush.current = ok; })
      .catch(() => { hasPush.current = false; });
    return () => { live = false; };
  }, [paired]);

  // In the foreground the system banner is off (see lib/notifications), so show ours.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationReceivedListener((n) => {
      const kind = n.request.content.data?.kind;
      // Hearts, drops and finished jobs already arrive live through the deck's realtime channel.
      if (kind === 'thanks' || kind === 'drop' || kind === 'done') return;
      const level = Number(n.request.content.data?.level ?? 0);
      const lead = kind === 'nudge'
        ? <Mascot recipe={mascotRef.current.recipe} mood={MOOD_FOR[(Math.min(3, Math.max(0, level)) as NudgeLevel)]} size={40} bg={mascotRef.current.bg} />
        : undefined;
      toast({ kind: 'info', lead, title: n.request.content.title ?? 'usync', body: n.request.content.body ?? undefined, ms: 6000 });
    });
    return () => sub.remove();
  }, [toast]);

  // Banners for phones without push: whatever was sent while the app was away.
  useEffect(() => {
    if (!paired) return;
    const catchUp = async () => {
      if (hasPush.current) return;
      const seen = (await AsyncStorage.getItem(SEEN)) ?? new Date(Date.now() - 12 * 3600e3).toISOString();
      await AsyncStorage.setItem(SEEN, new Date().toISOString());
      const { data } = await supabase.from('push_outbox').select('kind, title, body, sent_at')
        .gt('sent_at', seen).order('sent_at', { ascending: false }).limit(5);
      // Unread hearts get their own full screen moment (HeartMoment), so they are left out here.
      const rows = ((data ?? []) as Row[]).filter((r) => r.kind !== 'thanks');
      if (rows.length === 0) return;
      const top = rows[0];
      const more = rows.length > 1 ? `  ·  ${rows.length - 1} more while you were away` : '';
      toast({ kind: 'info', title: top.title + more, body: top.body, ms: 6000 });
    };
    const markSeen = () => AsyncStorage.setItem(SEEN, new Date().toISOString()).catch(() => undefined);
    // Wait a beat so the deck has painted before a banner slides over it.
    const first = setTimeout(() => { catchUp().catch(() => undefined); }, 800);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') catchUp().catch(() => undefined);
      else markSeen();
    });
    return () => { clearTimeout(first); sub.remove(); };
  }, [paired, toast]);

  return Platform.OS === 'web' ? null : <TapRouter />;
}

/** Opening a push lands on the tab it is about. Native only: web has no notification responses. */
function TapRouter() {
  const tapped = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (tapped && tapped.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      router.navigate(routeFor(tapped.notification.request.content.data?.kind));
    }
  }, [tapped]);
  return null;
}
