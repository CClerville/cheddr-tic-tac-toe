import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { ApiError } from "@cheddr/api-types";

export interface ApiErrorBannerProps {
  /**
   * Anything thrown from `apiGet`/`apiPost`. We branch on `ApiError`
   * to surface the canonical message + request id (for support), and
   * fall back to a generic message for raw `Error` / unknown values.
   */
  error: unknown;
  /** Optional retry handler — when set, renders the "Try again" button. */
  onRetry?: () => void;
  /** Optional dismiss handler — when set, renders a "Dismiss" button. */
  onDismiss?: () => void;
}

/**
 * Inline banner for surfacing recoverable API errors close to the action that
 * triggered them. For unrecoverable render-time errors, use `ErrorBoundary`.
 *
 * Visual style intentionally stays compact (no GlassPanel) so callers can drop
 * it inside any list/card without fighting layout.
 */
export function ApiErrorBanner({
  error,
  onRetry,
  onDismiss,
}: ApiErrorBannerProps) {
  const { t } = useTranslation();
  const message = resolveMessage(error);
  const requestId = error instanceof ApiError ? error.requestId : null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2"
    >
      <Text className="text-sm font-semibold text-red-600 dark:text-red-400">
        {t("errors.title")}
      </Text>
      <Text className="mt-1 text-sm text-red-700 dark:text-red-300">
        {message}
      </Text>
      {requestId ? (
        <Text
          className="mt-1 text-xs text-red-700/70 dark:text-red-300/70"
          selectable
        >
          {t("errors.requestId", { id: requestId })}
        </Text>
      ) : null}
      {(onRetry || onDismiss) && (
        <View className="mt-2 flex-row gap-3">
          {onRetry ? (
            <Pressable
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel={t("errors.tryAgain")}
              // hitSlop bridges the gap to the 44pt iOS HIG / Android a11y
              // touch target without forcing a chunky pill in the layout.
              hitSlop={ACTION_HIT_SLOP}
              className="rounded-full border border-red-500/40 px-3 py-1.5 active:opacity-70"
            >
              <Text className="text-xs font-medium text-red-700 dark:text-red-300">
                {t("errors.tryAgain")}
              </Text>
            </Pressable>
          ) : null}
          {onDismiss ? (
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel={t("errors.dismiss")}
              hitSlop={ACTION_HIT_SLOP}
              className="rounded-full px-3 py-1.5 active:opacity-70"
            >
              <Text className="text-xs font-medium text-red-700 dark:text-red-300">
                {t("errors.dismiss")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const ACTION_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const;

function resolveMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "An unexpected error occurred.";
}
