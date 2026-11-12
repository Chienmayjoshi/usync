// The Table stack's gesture decisions, kept pure so they can be tested. All of them run on the UI
// thread inside the pan's callbacks, so every function here is a worklet.

/** Press and keep still this long, then move: the card is carried (to My Tasks) instead of swiped. */
export const HOLD_MS = 180;
/** A still press this long flips the card to "Delete task?". */
export const DELETE_MS = 450;
/** A quick swipe up or down moves the stack a card once it travels this far, or flings this fast. */
export const STEP_DISTANCE = 48;
export const STEP_FLING = 600;

export type Intent = 'swipe' | 'restack' | 'back' | 'drag';

/**
 * What the finger means, decided once as the pan activates. Held first (and there is somewhere
 * to drop it): carry the card. Otherwise sideways swipes it, up sends it to the back, and down
 * brings back the one that went there last.
 */
export function intentOf(dx: number, dy: number, heldMs: number, canDrop: boolean): Intent {
  'worklet';
  if (heldMs >= HOLD_MS && canDrop) return 'drag';
  if (Math.abs(dx) > Math.abs(dy)) return 'swipe';
  return dy < 0 ? 'restack' : 'back';
}

/** Does a quick vertical swipe move the stack? dir: -1 for up (restack), 1 for down (back). */
export function stepCommits(dy: number, vy: number, dir: -1 | 1): boolean {
  'worklet';
  return dy * dir > STEP_DISTANCE || vy * dir > STEP_FLING;
}

/**
 * Does letting go of a carried card take it? Over the pill, or close enough that it has mostly
 * become the token, or on its way there with a downward fling.
 */
export function dropCommits(morph: number, over: boolean, vy: number): boolean {
  'worklet';
  return over || morph > 0.6 || (morph > 0.3 && vy > 900);
}
