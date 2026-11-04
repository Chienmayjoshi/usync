import { Easing } from 'react-native-reanimated';

// Shared motion. Everything eases out and settles: no springs, no overshoot.
// Micro interactions 100-150ms, panels 250-300ms; closing is faster than opening.
const out = Easing.bezier(0.2, 0, 0, 1);
const inOut = Easing.bezier(0.4, 0, 0.2, 1);

export const ease = { out, inOut };

export const motion = {
  press: { duration: 90, easing: out },
  release: { duration: 140, easing: out },
  cardBack: { duration: 220, easing: out },
  dealIn: { duration: 260, easing: out },
  flyOut: { duration: 220, easing: Easing.bezier(0.4, 0, 1, 1) },
  flip: { duration: 360, easing: inOut },
  sheetIn: { duration: 280, easing: out },
  sheetOut: { duration: 200, easing: inOut },
  panel: { duration: 300, easing: out },
  layout: 220,
  dealStagger: 90,
} as const;
