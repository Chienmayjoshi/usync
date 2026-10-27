import { useCallback, useEffect, useId, useState } from 'react';

import { useAccount } from '@/features/account/account';
import { supabase } from '@/lib/supabase';

import { type SyncEntry, weekStart, weeksInSync } from './weeks';

export type { SyncEntry };

export function useSync() {
  const { me } = useAccount();
  const [entries, setEntries] = useState<SyncEntry[]>([]);
  const coupleId = me?.couple_id;

  const load = useCallback(async () => {
    if (!coupleId) return;
    // RLS returns my notes always and my partner's only once both wrote (or the week ended).
    const { data } = await supabase.from('sync_entries').select('member, week_start, appreciation');
    setEntries((data ?? []) as SyncEntry[]);
  }, [coupleId]);

  // Us and Sync both use this hook; same named channels would collide in supabase-js.
  const instance = useId();
  useEffect(() => {
    if (!coupleId) return;
    Promise.resolve().then(load).catch(() => undefined);
    const ch = supabase.channel(`sync-${coupleId}-${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sync_entries', filter: `couple_id=eq.${coupleId}` }, () => { load().catch(() => undefined); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [coupleId, load, instance]);

  const week = weekStart();
  const mine = entries.find((e) => e.member === me?.id && e.week_start === week) ?? null;
  const theirs = entries.find((e) => e.member !== me?.id && e.week_start === week) ?? null;

  const appreciate = useCallback(async (text: string) => {
    if (!me?.couple_id) return;
    const { error } = await supabase.from('sync_entries').upsert(
      { couple_id: me.couple_id, member: me.id, week_start: week, appreciation: text.trim() },
      { onConflict: 'member,week_start' },
    );
    if (error) throw error;
    await load();
  }, [me, week, load]);

  return { week, mine, theirs, weeks: weeksInSync(entries), appreciate };
}
