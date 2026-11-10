import { useNames } from '@/features/account/account';
import { haptics } from '@/theme/haptics';
import { useToast } from '@/ui/Toast';

import { postponed, revealLabel } from '@/features/drop/priority';

import type { Card, Move } from './model';
import { useDeck } from './store';

export type { Move };

/** Every deck move, from a swipe, a drag or a button, with the same haptic and undo banner. */
export function useMoves() {
  const { dispatch } = useDeck();
  const toast = useToast();
  const names = useNames();
  const them = names.partnerOr;

  const undoable = (title: string, body: string) =>
    toast({ kind: 'info', title, body, action: { label: 'Undo', onPress: () => { haptics.tick(); dispatch({ type: 'undo' }); } }, onExpire: () => dispatch({ type: 'clearUndo' }) });

  return (card: Card, move: Move | 'next' | 'prev' | 'delete' | 'postpone') => {
    dispatch({ type: move, id: card.id });
    switch (move) {
      case 'next':
      case 'prev':
        return haptics.tick();
      case 'delete':
        haptics.take();
        return toast({ kind: 'info', title: 'Deleted', body: card.title, ms: 2500 });
      case 'grab':
        haptics.take();
        return undoable('On your deck', card.title);
      case 'ask':
        haptics.trade();
        return undoable(`Asked ${them}`, `${card.title}. It’s on their deck until they answer.`);
      case 'together':
        haptics.together();
        return undoable(`Asked ${them} to do it together`, `${card.title}. It waits in Doing Together until they say yes.`);
      case 'ask_for':
        haptics.trade();
        return undoable(`Asked ${them} for it`, card.title);
      case 'accept':
        haptics.take();
        return undoable(card.request === 'give' ? `Given to ${them}` : card.request === 'together' ? 'Doing it together' : 'On your deck', card.title);
      case 'decline':
        haptics.trade();
        return undoable(card.request === 'give' ? 'You kept it' : 'Back on the table', card.title);
      case 'table':
        haptics.trade();
        return undoable('Back on the table', card.title);
      case 'postpone': {
        haptics.tick();
        const label = revealLabel(postponed(card.dueOn, Date.now()), Date.now());
        return undoable(label === 'Reveal tomorrow' ? 'Reveal moved to tomorrow' : label.replace('Reveal by', 'Reveal moved to'), card.title);
      }
      case 'done':
        haptics.success();
        if (card.surprise) return undoable(`Revealed 🎁  ·  ${them} can see it now`, card.title);
        return undoable('Done  ·  into the album', card.title);
    }
  };
}
