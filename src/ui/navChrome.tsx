import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { type SharedValue, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { ease } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

type NavChrome = {
  /** 0 shown, 1 hidden: the nav slides down out of sight (My Deck, Figma 355:30606). */
  away: SharedValue<number>;
  hidden: boolean;
  setHidden: (on: boolean) => void;
};

const Ctx = createContext<NavChrome | null>(null);

/** Lets a tab screen put the floating nav away while it shows something of its own down there. */
export function NavChromeProvider({ children }: { children: ReactNode }) {
  const away = useSharedValue(0);
  const reduced = useReducedMotion();
  const [hidden, set] = useState(false);
  const setHidden = useCallback((on: boolean) => {
    set(on);
    // Out a little quicker than it comes back; with reduced motion the nav only fades.
    away.set(withTiming(on ? 1 : 0, { duration: reduced ? 160 : on ? 240 : 280, easing: ease.out }));
  }, [away, reduced]);
  const value = useMemo(() => ({ away, hidden, setHidden }), [away, hidden, setHidden]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNavChrome() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useNavChrome outside NavChromeProvider');
  return c;
}

/** Every tab's header sits on near black now (Figma 355:30852), so its status bar is light while focused. */
export function useLightStatusBar() {
  const t = useTheme();
  useFocusEffect(useCallback(() => {
    setStatusBarStyle('light');
    return () => setStatusBarStyle(t.scheme === 'dark' ? 'light' : 'dark');
  }, [t.scheme]));
}
