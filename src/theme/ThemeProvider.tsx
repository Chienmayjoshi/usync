import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { type ImageStyle, StyleSheet, type TextStyle, useColorScheme, type ViewStyle } from 'react-native';

import { type Scheme, type Theme, themes } from './tokens';

export type ThemePref = 'system' | Scheme;

const KEY = 'usync.theme';

type Ctx = { theme: Theme; pref: ThemePref; setPref: (p: ThemePref) => void };

const ThemeCtx = createContext<Ctx>({ theme: themes.light, pref: 'system', setPref: () => undefined });

/** Light, dark, or follow the phone. The choice lives on this device only. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => { if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v); })
      .catch(() => undefined);
  }, []);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    AsyncStorage.setItem(KEY, p).catch(() => undefined);
  }, []);

  const scheme: Scheme = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  const value = useMemo(() => ({ theme: themes[scheme], pref, setPref }), [scheme, pref, setPref]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx).theme;
export const useThemePref = () => {
  const { pref, setPref } = useContext(ThemeCtx);
  return { pref, setPref };
};

/**
 * Styles that follow the theme. Each mode's sheet is built once and cached, so switching is cheap:
 *   const useStyles = makeStyles((t) => ({ box: { backgroundColor: t.color.bg.surface } }));
 *   const s = useStyles();
 */
type Named<T> = { [K in keyof T]: ViewStyle | TextStyle | ImageStyle };

export function makeStyles<T extends Named<T>>(build: (t: Theme) => T & Named<T>) {
  const cache = new Map<Theme, T>();
  return function useStyles(): T {
    const t = useTheme();
    const hit = cache.get(t);
    if (hit) return hit;
    const s = StyleSheet.create(build(t)) as T;
    cache.set(t, s);
    return s;
  };
}
