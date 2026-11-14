// My Deck's list sheet (Figma 355:30660): dragged by its handle between where it rests (under the
// decision tiles) and expanded (over them, right under the header). Worklets: they run in the pan.

/** A fling this fast picks its own direction, wherever the sheet is. */
export const SHEET_FLING = 500;

/**
 * Where the sheet settles when let go at `y` with vertical speed `vy` (both in screen points,
 * down positive). `expanded` is the higher (smaller) top. Flung: the way it was thrown. Else the
 * nearer of the two.
 */
export function sheetSnap(y: number, vy: number, rest: number, expanded: number): number {
  'worklet';
  if (rest <= expanded) return expanded;
  if (vy <= -SHEET_FLING) return expanded;
  if (vy >= SHEET_FLING) return rest;
  return y - expanded < rest - y ? expanded : rest;
}

/**
 * The sheet following the finger: 1:1 between the two stops, then resisting past either end
 * (rubber band, a third of the overshoot, never more than 40).
 */
export function sheetFollow(y: number, rest: number, expanded: number): number {
  'worklet';
  const band = (over: number) => Math.min(40, over / 3);
  if (y < expanded) return expanded - band(expanded - y);
  if (y > rest) return rest + band(y - rest);
  return y;
}
