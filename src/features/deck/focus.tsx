import { router } from 'expo-router';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { useDeck } from '@/features/deck/store';
import { type ActivityData, destination, type Focus } from '@/features/notify/where';

type Ctx = { focus: Focus | null; clear: () => void; open: (kind: string, data?: ActivityData | null) => boolean };
const FocusCtx = createContext<Ctx>({ focus: null, clear: () => undefined, open: () => false });
export const useFocus = () => useContext(FocusCtx);

/**
 * "Take me to that card": an activity row or a tapped push names a card, and the screen it lives
 * on brings it into view (Table: to the front; My Deck: opened, row lit; ask: first; partner: row lit).
 * One handoff for both, so a push lands exactly where its activity row would.
 */
export function FocusProvider({ children }: { children: ReactNode }) {
  const { state } = useDeck();
  const [focus, setFocus] = useState<Focus | null>(null);
  const clear = useCallback(() => setFocus(null), []);
  const open = useCallback((kind: string, data?: ActivityData | null) => {
    const id = data?.task_id ?? data?.task_ids?.[0];
    const card = id ? state.cards.find((c) => c.id === id) : undefined;
    const to = destination(kind, card);
    if (!to) return false;
    setFocus(to.focus ? { ...to.focus, at: Date.now() } : null);
    router.navigate(to.path);
    return true;
  }, [state.cards]);
  const value = useMemo(() => ({ focus, clear, open }), [focus, clear, open]);
  return <FocusCtx.Provider value={value}>{children}</FocusCtx.Provider>;
}
