import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { SUPABASE_KEY, SUPABASE_URL, supabase } from './supabase';

// Apple and Google sign in. Apple is native (iOS only) and hands Supabase an ID token; Google
// goes through Supabase's hosted OAuth page in an in app browser and comes back on a deep link.
// Both only show once the provider is switched on in Supabase, so nobody hits a dead button.

WebBrowser.maybeCompleteAuthSession();

export type Providers = { apple: boolean; google: boolean };

/** Which providers the Supabase project has switched on (a public endpoint). */
export async function enabledProviders(): Promise<Providers> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } });
  const json = (await res.json()) as { external?: Record<string, boolean> };
  const appleHere = Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync().catch(() => false));
  return { apple: !!json.external?.apple && appleHere, google: !!json.external?.google };
}

const cancelled = (e: unknown) => !!e && typeof e === 'object' && 'code' in e && e.code === 'ERR_REQUEST_CANCELED';

/** Returns the first name Apple shares (only on the very first sign in), so the name step can prefill it. */
export async function signInWithApple(): Promise<string | null> {
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!cred.identityToken) throw new Error('Apple did not return a sign in token. Try again.');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken });
    if (error) throw error;
    return cred.fullName?.givenName ?? null;
  } catch (e) {
    if (cancelled(e)) return null;
    throw e;
  }
}

/** "a=1&b=2" from either the query or the fragment of the redirect. */
function paramsOf(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = [url.split('#')[1], url.split('?')[1]?.split('#')[0]];
  for (const part of parts) {
    for (const pair of (part ?? '').split('&')) {
      const [k, v] = pair.split('=');
      if (k) out[decodeURIComponent(k)] = decodeURIComponent((v ?? '').replace(/\+/g, ' '));
    }
  }
  return out;
}

export async function signInWithGoogle(): Promise<void> {
  const redirectTo = Linking.createURL('auth');
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return;
  const p = paramsOf(result.url);
  if (p.error_description || p.error) throw new Error(p.error_description || p.error);
  if (p.code) {
    const { error: e } = await supabase.auth.exchangeCodeForSession(p.code);
    if (e) throw e;
  } else if (p.access_token && p.refresh_token) {
    const { error: e } = await supabase.auth.setSession({ access_token: p.access_token, refresh_token: p.refresh_token });
    if (e) throw e;
  } else {
    throw new Error('Google sign in did not finish. Try again.');
  }
}
