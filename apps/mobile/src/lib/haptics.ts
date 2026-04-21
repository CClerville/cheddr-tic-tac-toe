import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * Tiny façade around `expo-haptics` so call sites read declaratively
 * (`haptics.cellTap()` instead of `Haptics.impactAsync(...)`) and so we have
 * one place to no-op on web / handle errors silently.
 */

const isSupported = Platform.OS === "ios" || Platform.OS === "android";

function safe(promise: Promise<unknown>): void {
  promise.catch(() => {
    // Haptics are advisory; never propagate hardware errors.
  });
}

export const haptics = {
  cellTap(): void {
    if (!isSupported) return;
    safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  pieceLanded(): void {
    if (!isSupported) return;
    safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },
  selectionChange(): void {
    if (!isSupported) return;
    safe(Haptics.selectionAsync());
  },
  win(): void {
    if (!isSupported) return;
    safe(
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    );
  },
  loss(): void {
    if (!isSupported) return;
    safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  },
  draw(): void {
    if (!isSupported) return;
    safe(
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    );
  },
};

export type HapticsApi = typeof haptics;
