import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAccount } from '@/features/account/account';
import { router } from 'expo-router';

import { type EventRow, errorText, type Side, supabase, type TaskRow, type ThanksRow } from '@/lib/supabase';
import { haptics } from '@/theme/haptics';
import { useToast } from '@/ui/Toast';

import { arrange, type Card, type DeckAction, deckReducer, type DeckState, type DropPlace, type Owner, type StoryCard } from './model';

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
    droppedBy: r.dropped_by ? (r.dropped_by === myId ? 'me' : 'partner') : null, createdAt: r.created_at, sortAt: r.sort_at,
    request: r.request ?? null, requestedBy: r.requested_by ? (r.requested_by === myId ? 'me' : 'partner') : null, surprise: !!r.surprise,
    dueOn: r.due_on ?? null,
  }));
  const album: StoryCard[] = rows
    .filter((r) => r.status === 'done')
    .sort((x, y) => (y.done_at ?? '').localeCompare(x.done_at ?? ''))
    .map((r) => ({
      id: r.id, title: r.title, when: monthOf(r.done_at), together: r.owner === 'together', bucket: r.bucket,
      doneBy: r.done_by ? (r.done_by === myId ? 'me' : 'partner') : null, doneAt: r.done_at,
    }));
  return { cards, album };
}

type Prev = { postpone?: number; id: string; owner: TaskRow['owner']; status: TaskRow['status']; traded: boolean; sort_at: string; request: TaskRow['request']; requested_by: string | null };

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
    setState((s) => {
      const next = toState(r, e.data as EventRow[], side, myId);
      return { ...s, ...next, cards: arrange(next.cards, s.cards) };
    });
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
        if (e.kind === 'accept' || e.kind === 'decline') answered = { id: e.task_id, yes: e.kind === 'accept' };
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
    let answered: { id: string; yes: boolean } | null = null;
    const tell = () => {
      const cards = stateRef.current.cards;
      const who = partnerName.current;
      const reply = answered && cards.find((c) => c.id === answered?.id);
      if (reply && answered) {
        // My partner answered something I asked: a yes lands on both decks, a no goes back on the Table.
        if (!answered.yes && reply.owner === 'table') {
          haptics.tick();
          toast({ kind: 'info', title: `${who} can’t take this one right now`, body: `${reply.title} is back on the table.`, ms: 7000 });
        } else if (answered.yes && reply.owner === 'together') {
          haptics.success();
          toast({ kind: 'info', title: `${who} is in. Doing it together`, body: `${reply.title} is on both your decks.`, ms: 7000 });
        } else if (answered.yes && reply.owner === 'partner') {
          haptics.success();
          toast({ kind: 'info', title: `${who} took it`, body: reply.title, ms: 5000 });
        }
      } else if (finished) {
        const card = cards.find((c) => c.id === finished);
        if (card?.surprise) {
          // A surprise only becomes visible once it is revealed, so this is the reveal itself.
          haptics.success();
          toast({ kind: 'info', title: `${who} has a surprise for you 🎁`, body: card.title, ms: 9000, action: { label: 'Send a heart', onPress: () => askHeart(card) } });
        } else if (card) {
          haptics.success();
          toast({ kind: 'info', title: `${who} finished it`, body: card.title, ms: 7000, action: { label: 'Send a heart', onPress: () => askHeart(card) } });
        }
      } else if (dropped.length) {
        const fresh = cards.filter((c) => dropped.includes(c.id));
        if (fresh.length) {
          haptics.tick();
          toast({
            kind: 'info',
            title: `${who} put ${fresh.length === 1 ? 'something' : `${fresh.length} things`} on the table`,
            body: fresh.map((c) => c.title).join(', '),
            ms: 7000,
            action: { label: 'See', onPress: () => router.navigate('/') },
          });
        }
      }
      dropped = [];
      finished = null;
      answered = null;
    };
    return () => { if (timer) clearTimeout(timer); if (announce) clearTimeout(announce); supabase.removeChannel(ch); };
  }, [coupleId, load, toast, myId]);

  const fail = useCallback((err: unknown) => {
    toast({ kind: 'info', title: 'That didn’t save', body: errorText(err) });
    load().catch(() => undefined);
  }, [load, toast]);

  const drop = useCallback(async (cards: Card[], place: DropPlace, surprise = false) => {
    if (!me?.couple_id || !me.side) return;
    // Nothing is dealt any more: a card goes on the shared Table, or straight onto my deck.
    // Before the partner joins there is no table to share, so everything is mine.
    const mine = place === 'mine' || surprise || !partner;
    const inserts = cards.map((c) => ({
      couple_id: me.couple_id!, title: c.title, raw: c.title, bucket: c.bucket, effort: c.effort, weight: c.weight, when_text: c.when,
      detail: '', owner: mine ? me.side! : 'table', status: mine ? 'active' : 'deal', dropped_by: me.id, surprise: mine && surprise,
      ...(c.dueOn ? { due_on: c.dueOn } : {}),
    }));
    const { data, error } = await supabase.from('tasks').insert(inserts).select('id, couple_id');
    if (error) throw error;
    await supabase.from('task_events').insert(data.map((t) => ({ task_id: t.id, couple_id: t.couple_id, actor: me.id, kind: 'drop', text: `${me.name} added it` })));
    // "Together" goes on the Table and is asked straight away, the same move as swiping it right:
    // my partner gets the request, and a no puts it back on the Table (0006, 0008).
    if (place === 'together' && !mine) {
      for (const t of data) {
        const { error: e } = await supabase.rpc('deck_move', { task: t.id, move: 'together' });
        if (e) throw e;
      }
    }
  }, [me, partner]);

  const dispatch = useCallback((a: DeckAction) => {
    setState((s) => deckReducer(s, a));
    if (a.type === 'clearUndo') { prev.current = null; return; }
    if (a.type === 'drop') { drop(a.cards, a.place, a.surprise).catch(fail); return; }
    // Next card is a private glance: nothing changes for anyone.
    if (a.type === 'next' || a.type === 'prev') return;
    if (a.type === 'delete') { prev.current = null; supabase.rpc('delete_task', { task: a.id }).then(({ error }) => error && fail(error)); return; }
    if (a.type === 'postpone') {
      prev.current = { postpone: a.days ?? 1, id: a.id } as Prev;
      supabase.rpc('postpone_surprise', { task: a.id, days: a.days ?? 1 }).then(({ error }) => error && fail(error));
      return;
    }
    if (a.type === 'undo') {
      const p = prev.current;
      prev.current = null;
      if (p?.postpone) {
        supabase.rpc('postpone_surprise', { task: p.id, days: -p.postpone }).then(({ error }) => error && fail(error));
      } else if (p) {
        supabase.rpc('deck_restore_v2', {
          task: p.id, prev_owner: p.owner, prev_status: p.status, prev_traded: p.traded, prev_sort: p.sort_at, prev_request: p.request, prev_requested_by: p.requested_by,
        }).then(({ error }) => error && fail(error));
      }
      return;
    }
    const row = rows.find((r) => r.id === a.id);
    if (row) prev.current = { id: row.id, owner: row.owner, status: row.status, traded: row.traded, sort_at: row.sort_at, request: row.request ?? null, requested_by: row.requested_by ?? null };
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
      {children}
    </Ctx.Provider>
  );
}

export function useDeck() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDeck must be used inside DeckProvider');
  return v;
}

