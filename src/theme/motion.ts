// Shared motion values. Micro interactions 100-150ms, panels 200-300ms; closing is faster than opening.
export const motion = {
  press: { duration: 90 },
  release: { damping: 14, stiffness: 320, mass: 0.6 },
  cardBack: { damping: 16, stiffness: 180 },
  dealIn: { damping: 15, stiffness: 140, mass: 0.9 },
  flyOut: { duration: 220 },
  flip: { duration: 360 },
  sheetIn: { damping: 20, stiffness: 200 },
  sheetOut: { duration: 200 },
  dealStagger: 90,
} as const;
