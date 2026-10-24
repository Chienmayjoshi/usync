import * as Haptics from 'expo-haptics';

// One place for every haptic so the app feels consistent. Failures are ignored:
// some Android devices have no vibrator and that must never break an action.
const safe = (p: Promise<void>) => p.catch(() => undefined);

export const haptics = {
  tick: () => safe(Haptics.selectionAsync()),
  press: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  take: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  trade: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  together: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};
