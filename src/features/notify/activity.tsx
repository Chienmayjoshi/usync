import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAccount } from '@/features/account/account';
import { supabase } from '@/lib/supabase';

import type { ActivityItem } from './where';

export type { ActivityItem };


const SEEN_KEY = 'usync.activity.seen';

type Ctx = { items: ActivityItem[]; unread: boolean; seen: string | null; markSeen: () => void };
const ActivityCtx = createContext<Ctx>({ items: [], unread: false, seen: null, markSeen: () => undefined });
export const useActivity = () => useContext(ActivityCtx);

/**
 * What happened between you two, from the same ledger that sends pushes: requests, hearts,
 * drops, finished jobs. Read only; RLS returns my own rows. One subscription for the app.
 */
export function ActivityProvider({ children }: { children: ReactNode }) {
  const { me } = useAccount();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [seen, setSeen] = useState<string | null>(null);
  const id = me?.id;

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from('push_outbox').select('id, kind, title, body, created_at, data').order('created_at', { ascending: false }).limit(60);
    setItems((data ?? []) as ActivityItem[]);
  }, [id]);

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY).then(setSeen).catch(() => undefined);
    if (!id) return;
    Promise.resolve().then(load).catch(() => undefined);
    const ch = supabase.channel(`activity-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'push_outbox', filter: `member=eq.${id}` }, () => { load().catch(() => undefined); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  const markSeen = useCallback(() => {
    const now = new Date().toISOString();
    setSeen(now);
    AsyncStorage.setItem(SEEN_KEY, now).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ items, seen, markSeen, unread: items.some((i) => !seen || i.created_at > seen) }), [items, seen, markSeen]);
  return <ActivityCtx.Provider value={value}>{children}</ActivityCtx.Provider>;
}
