import { Component, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { logger } from "@/lib/logger";
import { Sentry } from "@/lib/sentry";
import { gameRepository } from "@/storage/gameRepository";

const log = logger.child({ scope: "ErrorBoundary" });

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Tag attached to log + Sentry events so we can tell whether the crash
   * happened at the root, inside a tab, on the game screen, etc.
   */
  scope?: string;
  /**
   * Default reset clears the saved local game (the most common root cause
   * of replayable crashes). Routes that don't own that storage can opt out.
   */
  clearGameOnReset?: boolean;
  /**
   * Override the fallback UI entirely (e.g. show a compact in-card error
   * for a smaller boundary instead of a full-screen takeover).
   */
  fallback?: (state: { error: Error; reset: () => void }) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error) {
    const scope = this.props.scope ?? "root";
    log.error("caught", { err: error, scope });
    Sentry.captureException(error, { tags: { boundary: scope } });
  }

  reset = async () => {
    if (this.props.clearGameOnReset !== false) {
      try {
        await gameRepository.clearGame();
      } catch {
        // best-effort
      }
    }
    this.setState({ error: null });
  };

  private handleReset = () => {
    void this.reset();
  };

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback({ error, reset: this.handleReset });
    }

    return (
      <View className="flex-1 items-center justify-center bg-surface dark:bg-surface-dark px-6">
        <Text className="text-2xl font-bold text-primary dark:text-primary-dark mb-2">
          Something went wrong
        </Text>
        <Text className="text-center text-secondary dark:text-secondary-dark mb-6">
          {error.message || "An unexpected error occurred."}
        </Text>
        <Pressable
          onPress={this.handleReset}
          accessibilityRole="button"
          accessibilityLabel="Restart"
          accessibilityHint="Clears saved game and reloads the screen"
          className="bg-accent dark:bg-accent-dark px-8 py-3 rounded-full active:opacity-80"
        >
          <Text className="text-accent-contrast dark:text-accent-contrast-dark font-semibold text-base">
            Restart
          </Text>
        </Pressable>
      </View>
    );
  }
}
