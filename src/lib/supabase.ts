import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { MascotRecipe } from '@/features/mascot/recipe';
import type { PersonColor } from '@/theme/tokens';

// The publishable key is meant to ship inside the app; row level security protects the data.
export const SUPABASE_URL = 'https://sylmsididyxunxxorydz.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_8YDvnj6fDHcTcQw5L6ubAg_I6cQopWk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Keep the session fresh only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (s) => {
    if (s === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export type Side = 'a' | 'b';

export type MemberRow = {
  id: string; couple_id: string | null; side: Side | null; name: string; color: PersonColor; avatar: string | null;
  /** Their mascot (Open Peeps recipe), its voice, and how firm nudges to them may get (0007). */
  mascot?: MascotRecipe | null; voice?: 'he' | 'she' | 'neutral'; nudge_max?: number;
};

export type TaskRow = {
  id: string;
  couple_id: string;
  title: string;
  raw: string;
  bucket: 'Home' | 'Admin' | 'Errands' | 'Family' | 'Us';
  effort: string;
  weight: number;
  when_text: string;
  detail: string;
  owner: Side | 'together' | 'table';
  status: 'deal' | 'active' | 'waiting' | 'done';
  traded: boolean;
  waiting_note: string | null;
  dropped_by: string | null;
  request: 'take' | 'together' | 'give' | null;
  requested_by: string | null;
  surprise: boolean;
  /** The date its priority stands for; a surprise's reveal date (0009). */
  due_on?: string | null;
  done_by: string | null;
  done_at: string | null;
  sort_at: string;
  created_at: string;
};

export type ThanksRow = {
  id: number; task_id: string | null; from_member: string; note: string | null; seen_at: string | null; at: string;
  /** What was sent (0010); absent before it, which reads as a heart. */
  reaction?: 'heart' | 'care' | 'laugh' | 'wow' | 'tears';
};

export type EventRow = { id: number; task_id: string; actor: string | null; kind: string; text: string; at: string };

/** Supabase errors carry a message worth showing; anything else gets a calm fallback. */
export function errorText(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string' && e.message) return e.message;
  return 'Something went wrong. Try again.';
}
