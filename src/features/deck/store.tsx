import { createContext, type Dispatch, type ReactNode, useContext, useReducer } from 'react';

import { initialDeck } from './mock';
import { type DeckAction, deckReducer, type DeckState } from './model';

const Ctx = createContext<{ state: DeckState; dispatch: Dispatch<DeckAction> } | null>(null);

export function DeckProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(deckReducer, initialDeck);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useDeck() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDeck must be used inside DeckProvider');
  return v;
}
