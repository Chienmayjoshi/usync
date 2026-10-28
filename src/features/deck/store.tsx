import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAccount } from '@/features/account/account';
import { dealTo, type LoadItem } from '@/lib/fairness';
import { router } from 'expo-router';

import { type EventRow, errorText, type Side, supabase, type TaskRow, type ThanksRow } from '@/lib/supabase';
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
  sendThanks: (id: string, note?: string) => Promise<void>;
  /** Hearts from my partner I have not acknowledged yet, oldest first. */
  hearts: ThanksRow[];
  ackHeart: (id: number) => void;
  /** The card my partner just finished, so a heart can go out right away. Cleared once handled. */
  heartFor: Card | null;
  askHeart: (card: Card | null) => void;
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
    droppedBy: r.dropped_by ? (r.dropped_by === myId ? 'me' : 'partner') : null, createdAt: r.created_at,
  }));
  const album: StoryCard[] = rows
    .filter((r) => r.status === 'done')
    .sort((x, y) => (y.done_at ?? '').localeCompare(x.done_at ?? ''))
    .map((r) => ({
      id: r.id, title: r.title, when: monthOf(r.done_at), together: r.owner === 'together', bucket: r.bucket,
      doneBy: r.done_by ? (r.done_by === myId ? 'me' : 'partner') : null,
    }));
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
  const [hearts, setHearts] = useState<ThanksRow[]>([]);
  const [heartFor, askHeart] = useState<Card | null>(null);
  const stateRef = useRef<DeckState>(empty);
  useEffect(() => { stateRef.current = state; }, [state]);
  const prev = useRef<Prev | null>(null);
  // Read inside the realtime callback without resubscribing on every change.
  const partnerName = useRef('Your partner');
  useEffect(() => { partnerName.current = partner?.name ?? 'Your partner'; }, [partner]);
  const coupleId = me?.couple_id ?? null;
  const side = me?.side ?? 'a';
  const myId = me?.id ?? '';

  const load = useCallback(async () => {
    if (!coupleId) return;
    const [t, e, th] = await Promise.all([
      supabase.from('tasks').select('*').order('sort_at', { ascending: true }),
      supabase.from('task_events').select('id, task_id, actor, kind, text, at').order('at', { ascending: true }),
      supabase.from('thanks').select('id, task_id, from_member, note, seen_at, at').order('at', { ascending: true }),
    ]);
    if (t.error) throw t.error;
    if (e.error) throw e.error;
    const r = t.data as TaskRow[];
    setRows(r);
    const all = (th.data ?? []) as ThanksRow[];
    setThanked(new Set(all.filter((x) => x.from_member === myId && x.task_id).map((x) => x.task_id as string)));
    setHearts(all.filter((x) => x.from_member !== myId && !x.seen_at));
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_events', filter: `couple_id=eq.${coupleId}` }, (p) => {
        soon();
        const e = p.new as EventRow;
        if (!e.actor || e.actor === myId) return;
        if (e.kind === 'drop') dropped.push(e.task_id);
        if (e.kind === 'done') finished = e.task_id;
        if (announce) clearTimeout(announce);
        // Wait for the reload that brings the new cards in, then say what happened in one banner.
        announce = setTimeout(tell, 600);
      })
      // A heart from my partner is the moment the product is built around: it takes the whole
      // screen and stays until it has been read (see HeartMoment).
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'thanks', filter: `couple_id=eq.${coupleId}` }, (p) => {
        const row = p.new as ThanksRow;
        if (row.from_member === myId) return;
        haptics.success();
        setHearts((h) => (h.some((x) => x.id === row.id) ? h : [...h, row]));
      })
      .subscribe();

    // What my partner did while I am in the app: dropped something, or finished a job.
    let announce: ReturnType<typeof setTimeout> | null = null;
    let dropped: string[] = [];
    let finished: string | null = null;
    const tell = () => {
      const cards = stateRef.current.cards;
      const who = partnerName.current;
      if (finished) {
        const card = cards.find((c) => c.id === finished);
        if (card) {
          haptics.success();
          toast({ kind: 'info', title: `${who} finished it`, body: card.title, ms: 7000, action: { label: 'Send a heart', onPress: () => askHeart(card) } });
        }
      } else if (dropped.length) {
        const fresh = cards.filter((c) => dropped.includes(c.id));
        const mine = fresh.filter((c) => c.owner === 'me' || c.owner === 'together').length;
        const titles = fresh.map((c) => c.title).join(', ');
        haptics.tick();
        toast({
          kind: 'info',
          title: `${who} dropped ${dropped.length === 1 ? 'something' : `${dropped.length} things`}`,
          body: `${titles || 'New cards'}${mine ? `. ${mine === fresh.length ? 'Dealt to you.' : `${mine} dealt to you.`}` : '.'}`,
          ms: 7000,
          action: { label: 'See', onPress: () => router.navigate(mine ? '/' : '/us') },
        });
      }
      dropped = [];
      finished = null;
    };
    return () => { if (timer) clearTimeout(timer); if (announce) clearTimeout(announce); supabase.removeChannel(ch); };
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

  const sendThanks = useCallback(async (id: string, note?: string) => {
    if (!me?.couple_id) return;
    setThanked((s) => new Set(s).add(id));
    const { error } = await supabase.from('thanks').insert({ couple_id: me.couple_id, task_id: id, from_member: me.id, note: note?.trim() || null });
    // A second tap on another phone is fine: one heart per job is enforced by the database.
    if (error && error.code !== '23505') throw error;
  }, [me]);

  const ackHeart = useCallback((id: number) => {
    setHearts((h) => h.filter((x) => x.id !== id));
    supabase.rpc('ack_thanks', { heart: id }).then(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, ready, addUpdate, resume, thanked, sendThanks, hearts, ackHeart, heartFor, askHeart }),
    [state, dispatch, ready, addUpdate, resume, thanked, sendThanks, hearts, ackHeart, heartFor],
  );
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
