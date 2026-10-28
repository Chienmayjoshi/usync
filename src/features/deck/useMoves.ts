import { useNames } from '@/features/account/account';
import { haptics } from '@/theme/haptics';
import { useToast } from '@/ui/Toast';

import type { Card } from './model';
import { useDeck } from './store';

export type Move = 'take' | 'trade' | 'together' | 'done' | 'later' | 'grab' | 'table';

/** Every deck move, from a swipe, a button or the list, with the same haptic and undo banner. */
export function useMoves() {
  const { dispatch } = useDeck();
  const toast = useToast();
  const names = useNames();

  const undoable = (title: string, body: string) =>
    toast({ kind: 'info', title, body, action: { label: 'Undo', onPress: () => { haptics.tick(); dispatch({ type: 'undo' }); } }, onExpire: () => dispatch({ type: 'clearUndo' }) });

  return (card: Card, move: Move) => {
    dispatch({ type: move, id: card.id });
    switch (move) {
      case 'take':
        haptics.take();
        return undoable('It’s yours', card.title);
      case 'grab':
        haptics.take();
        return undoable('It’s yours', 'Grabbed from the open table.');
      case 'together':
        haptics.together();
        return undoable('Doing it together', 'It’s on both decks now. Us shows everything you share.');
      case 'trade':
        haptics.trade();
        return card.traded
          ? undoable('Passed to the table', 'The trade was used, so it’s up for grabs on Us.')
          : undoable(`Traded to ${names.partnerOr}`, 'They can take it or pass it to the table.');
      case 'table':
        haptics.trade();
        return undoable('On the open table', 'Either of you can grab it from Us.');
      case 'later':
        haptics.trade();
        return card.status === 'deal'
          ? undoable('Skipped for now', 'It waits at the back of your deck, still yours to decide.')
          : undoable('Moved to later', 'Out of sight for now. It comes back on its own.');
      case 'done':
        haptics.success();
        return undoable('Done  ·  into the album', card.title);
    }
  };
}
