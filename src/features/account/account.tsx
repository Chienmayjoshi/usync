import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { forgetPush } from '@/lib/notifications';
import { type MemberRow, supabase } from '@/lib/supabase';
import { type PersonColor, tones } from '@/theme/tokens';

export type Profile = { name: string; color: PersonColor; avatar: string | null };

type Account = {
  /** undefined while the stored session loads. */
  session: Session | null | undefined;
  me: MemberRow | null;
  partner: MemberRow | null;
  inviteCode: string | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  saveProfile: (p: Partial<Profile>) => Promise<void>;
  createSpace: () => Promise<void>;
  joinSpace: (code: string) => Promise<void>;
  leaveSpace: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const Ctx = createContext<Account | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const uid = session?.user.id;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    if (!uid) return;
    const { data, error } = await supabase.from('members').select('id, couple_id, side, name, color, avatar');
    if (error) throw error;
    setMembers(data as MemberRow[]);
    const mine = (data as MemberRow[]).find((m) => m.id === uid);
    if (mine?.couple_id) {
      const { data: c } = await supabase.from('couples').select('invite_code').eq('id', mine.couple_id).single();
      setInviteCode(c?.invite_code ?? null);
    } else setInviteCode(null);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    // First fetch runs after mount, like the realtime updates that follow it.
    Promise.resolve().then(refresh).catch(() => undefined);
    // Hear the partner join, rename or leave.
    const ch = supabase.channel(`members-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => { refresh().catch(() => undefined); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid, refresh]);

  const me = (uid && members?.find((m) => m.id === uid)) || null;
  const partner = (me?.couple_id && members?.find((m) => m.id !== uid && m.couple_id === me.couple_id)) || null;

  const value = useMemo<Account>(() => ({
    session,
    me,
    partner,
    inviteCode,
    loading: session === undefined || (!!session && members === null),
    async signUp(email, password) {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      if (!data.session) throw new Error('Account created, but Supabase still asks for email confirmation. Turn off "Confirm email" in Supabase, then sign in.');
    },
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    },
    async signOut() {
      await forgetPush().catch(() => undefined);
      await supabase.auth.signOut();
      setMembers(null);
    },
    async saveProfile(p) {
      const patch = { ...p, ...(p.name !== undefined && { name: p.name.trim() }) };
      const { error } = me
        ? await supabase.from('members').update(patch).eq('id', me.id)
        : await supabase.from('members').insert({ id: uid, ...patch });
      if (error) throw error;
      await refresh();
    },
    async createSpace() {
      const { error } = await supabase.rpc('create_space');
      if (error) throw error;
      await refresh();
    },
    async joinSpace(code) {
      const { error } = await supabase.rpc('join_space', { code });
      if (error) throw error;
      await refresh();
    },
    async deleteAccount() {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw error;
      await supabase.auth.signOut();
      setMembers(null);
    },
    async leaveSpace() {
      const { error } = await supabase.rpc('leave_space');
      if (error) throw error;
      await refresh();
    },
  }), [session, me, partner, inviteCode, members, uid, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccount() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAccount must be used inside AccountProvider');
  return v;
}

/** The partner gets the other default color until they pick, and never the same as mine. */
export function partnerColorFor(mine: PersonColor, theirs?: PersonColor | null): PersonColor {
  if (theirs && theirs !== mine) return theirs;
  return mine === 'lagoon' ? 'ember' : 'lagoon';
}

/** Names, colors and avatars for copy and UI. Falls back gently before the partner joins. */
export function useNames() {
  const { me, partner } = useAccount();
  const initial = (n?: string) => (n ? n.trim().charAt(0).toUpperCase() : null);
  const mine = me?.color ?? 'ember';
  return {
    me: me?.name ?? 'You',
    partner: partner?.name ?? null,
    partnerOr: partner?.name ?? 'your partner',
    initials: { a: initial(me?.name) ?? '?', b: initial(partner?.name) },
    avatars: { a: me?.avatar ?? null, b: partner?.avatar ?? null },
    colors: { me: mine, partner: partnerColorFor(mine, partner?.color) },
    hex: { me: tones[mine].face, partner: tones[partnerColorFor(mine, partner?.color)].face },
  };
}
