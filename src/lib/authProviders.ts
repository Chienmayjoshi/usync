import { SUPABASE_KEY, SUPABASE_URL } from './supabase';

export type Providers = { apple: boolean; google: boolean };

/** The sign in helpers, loaded only when a provider is on (they need native modules). */
export const socialAuth = () => import('./socialAuth');

/** Which providers the Supabase project has switched on (a public endpoint). */
export async function enabledProviders(): Promise<Providers> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } });
  const json = (await res.json()) as { external?: Record<string, boolean> };
  const google = !!json.external?.google;
  const apple = !!json.external?.apple && (await (await socialAuth()).appleAvailable());
  return { apple, google };
}
