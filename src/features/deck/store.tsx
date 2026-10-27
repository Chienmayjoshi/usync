import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAccount } from '@/features/account/account';
import { dealTo, type LoadItem } from '@/lib/fairness';
import { type EventRow, errorText, type Side, supabase, type TaskRow } from '@/lib/supabase';
import { haptics } from '@/theme/haptics';
import { useToast } from '@/ui/Toast';

import { type Card, type DeckAction, deckReducer, type DeckState, type Owner, type StoryCard } from './model';
import { TradeTargetProvider } from './tradeTarget';

// The deck lives in Supabase. Moves apply locally first (so swipes feel instant), then the
// server applies the same rules in deck_move and realtime brings both phones back in line.

type Deck = {
  state: DeckState;
  dispatch: (a: DeckAction) => void;
  ready: boolean;
  /** One line update; `waiting` parks the card off the deck until someone else comes through. */
  addUpdate: (id: string, note: string, waiting: boolean) => Promise<void>;
  resume: (id: string) => Promise<void>;
  /** Task ids I already sent a heart for. */
  thanked: Set<string>;
  sendThanks: (id: string) => Promise<void>;
};
const Ctx = createContext<Deck | null>(null);

const empty: DeckState = { cards: [], album: [], weeksInSync: 0, undo: null, lastDoneId: null };

const ownerFor = (row: TaskRow, side: Side): Owner =>
  row.owner === side ? 'me' : row.owner === 'together' ? 'together' : row.owner === 'table' ? 'table' : 'partner';

const monthOf = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'This week');

function toState(rows: TaskRow[], events: EventRow[], side: Side, myId: string): Pick<DeckState, 'cards' | 'album'> {
  const story = new Map<string, string[]>();
  for (const e of events) story.set(e.task_id, [...(story.get(e.task_id) ?? []), e.text]);
  const cards: Card[] = rows.map((r) => ({
    id: r.id, title: r.title, bucket: r.bucket, effort: r.effort, when: r.when_text, detail: r.detail,
    owner: ownerFor(r, side), status: r.status, traded: r.traded, weight: r.weight, story: story.get(r.id) ?? [],
    doneBy: r.done_by ? (r.done_by === myId ? 'me' : 'partner') : null, doneAt: r.done_at, waitingNote: r.waiting_note,
  }));
  const album: StoryCard[] = rows
    .filter((r) => r.status === 'done')
    .sort((x, y) => (y.done_at ?? '').localeCompare(x.done_at ?? ''))
    .map((r) => ({ id: r.id, title: r.title, when: monthOf(r.done_at), together: r.owner === 'together' }));
  return { cards, album };
}

type Prev = { id: string; owner: TaskRow['owner']; status: TaskRow['status']; traded: boolean; sort_at: string };

export function DeckProvider({ children }: { children: ReactNode }) {
  const { me, partner } = useAccount();
  const toast = useToast();
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [state, setState] = useState<DeckState>(empty);
  const [ready, setReady] = useState(false);
  const [thanked, setThanked] = useState<Set<string>>(new Set());
  const prev = useRef<Prev | null>(null);
  // Read inside the realtime callback without resubscribing on every change.
  const rowsRef = useRef<TaskRow[]>([]);
  const partnerName = useRef('Your partner');
  useEffect(() => { rowsRef.current = rows; partnerName.current = partner?.name ?? 'Your partner'; }, [rows, partner]);
  const coupleId = me?.couple_id ?? null;
  const side = me?.side ?? 'a';
  const myId = me?.id ?? '';

  const load = useCallback(async () => {
    if (!coupleId) return;
    const [t, e, th] = await Promise.all([
      supabase.from('tasks').select('*').order('sort_at', { ascending: true }),
      supabase.from('task_events').select('id, task_id, actor, kind, text, at').order('at', { ascending: true }),
      supabase.from('thanks').select('task_id').eq('from_member', myId),
    ]);
    if (t.error) throw t.error;
    if (e.error) throw e.error;
    const r = t.data as TaskRow[];
    setRows(r);
    setThanked(new Set((th.data ?? []).map((x) => x.task_id as string)));
    setState((s) => ({ ...s, ...toState(r, e.data as EventRow[], side, myId) }));
    setReady(true);
  }, [coupleId, side, myId]);

  useEffect(() => {
    if (!coupleId) return;
    Promise.resolve().then(load).catch((err) => toast({ kind: 'info', title: 'Could not load the deck', body: errorText(err) }));
    // Coalesce bursts (a move writes a task and an event) into one reload.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { load().catch(() => undefined); }, 150); };
    const ch = supabase.channel(`deck-${coupleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `couple_id=eq.${coupleId}` }, soon)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_events', filter: `couple_id=eq.${coupleId}` }, soon)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'thanks', filter: `couple_id=eq.${coupleId}` }, (p) => {
        // A heart from my partner is the moment the product is built around: show it right away.
        const row = p.new as { from_member: string; task_id: string | null };
        if (row.from_member === myId) return;
        const title = rowsRef.current.find((x) => x.id === row.task_id)?.title;
        haptics.success();
        toast({ kind: 'thanks', title: `${partnerName.current} sent a heart`, body: title ? `for “${title.toLowerCase()}”` : 'for something you did', ms: 5000 });
      })
      .subscribe();
    return () => { if (timer) clearTimeout(timer); supabase.removeChannel(ch); };
  }, [coupleId, load, toast, myId]);

  const fail = useCallback((err: unknown) => {
    toast({ kind: 'info', title: 'That didn’t save', body: errorText(err) });
    load().catch(() => undefined);
  }, [load, toast]);

  const drop = useCallback(async (cards: Card[]) => {
    if (!me?.couple_id || !me.side) return;
    // Deal each new card by load. Before the partner joins, everything waits on my deck.
    const load: LoadItem[] = rows.map((r) => ({ owner: r.owner, weight: r.weight, at: Date.parse(r.done_at ?? r.created_at), done: r.status === 'done' }));
    const inserts = cards.map((c) => {
      const owner: TaskRow['owner'] = !partner ? me.side! : dealTo(load, me.side!, { together: c.owner === 'together' });
      load.push({ owner, weight: c.weight, at: Date.now(), done: false });
      const detail = owner === 'together' ? 'A shared plan, so it’s on both decks.'
        : !partner ? 'Waiting for your partner to join. Until then it’s yours.'
          : `Dealt to ${owner === me.side ? me.name : partner.name}: less on their plate this week.`;
      return { couple_id: me.couple_id!, title: c.title, raw: c.title, bucket: c.bucket, effort: c.effort, weight: c.weight, when_text: c.when, detail, owner, dropped_by: me.id };
    });
    const { data, error } = await supabase.from('tasks').insert(inserts).select('id, couple_id');
    if (error) throw error;
    await supabase.from('task_events').insert(data.map((t) => ({ task_id: t.id, couple_id: t.couple_id, actor: me.id, kind: 'drop', text: `${me.name} dropped it` })));
  }, [me, partner, rows]);

  const dispatch = useCallback((a: DeckAction) => {
    setState((s) => deckReducer(s, a));
    if (a.type === 'clearUndo') { prev.current = null; return; }
    if (a.type === 'drop') { drop(a.cards).catch(fail); return; }
    if (a.type === 'undo') {
      const p = prev.current;
      prev.current = null;
      if (p) supabase.rpc('deck_restore', { task: p.id, prev_owner: p.owner, prev_status: p.status, prev_traded: p.traded, prev_sort: p.sort_at }).then(({ error }) => error && fail(error));
      return;
    }
    const row = rows.find((r) => r.id === a.id);
    if (row) prev.current = { id: row.id, owner: row.owner, status: row.status, traded: row.traded, sort_at: row.sort_at };
    supabase.rpc('deck_move', { task: a.id, move: a.type }).then(({ error }) => error && fail(error));
  }, [drop, fail, rows]);

  const addUpdate = useCallback(async (id: string, note: string, waiting: boolean) => {
    const { error } = await supabase.rpc('add_update', { task: id, note, waiting });
    if (error) throw error;
    await load();
  }, [load]);

  const resume = useCallback(async (id: string) => {
    const { error } = await supabase.rpc('resume_task', { task: id });
    if (error) throw error;
    await load();
  }, [load]);

  const sendThanks = useCallback(async (id: string) => {
    if (!me?.couple_id) return;
    setThanked((s) => new Set(s).add(id));
    const { error } = await supabase.from('thanks').insert({ couple_id: me.couple_id, task_id: id, from_member: me.id });
    // A second tap on another phone is fine: one heart per job is enforced by the database.
    if (error && error.code !== '23505') throw error;
  }, [me]);

  const value = useMemo(() => ({ state, dispatch, ready, addUpdate, resume, thanked, sendThanks }), [state, dispatch, ready, addUpdate, resume, thanked, sendThanks]);
  return (
    <Ctx.Provider value={value}>
      <TradeTargetProvider>{children}</TradeTargetProvider>
    </Ctx.Provider>
  );
}

export function useDeck() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDeck must be used inside DeckProvider');
  return v;
}
