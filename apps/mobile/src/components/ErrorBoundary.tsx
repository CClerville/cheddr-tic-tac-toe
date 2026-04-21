import { Component, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { gameRepository } from "@/storage/gameRepository";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (__DEV__) {
      console.error("[ErrorBoundary]", error);
    }
  }

  reset = async () => {
    try {
      await gameRepository.clearGame();
    } catch {
      // best-effort
    }
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View className="flex-1 items-center justify-center bg-surface dark:bg-surface-dark px-6">
          <Text className="text-2xl font-bold text-primary dark:text-primary-dark mb-2">
            Something went wrong
          </Text>
          <Text className="text-center text-secondary dark:text-secondary-dark mb-6">
            {this.state.error.message || "An unexpected error occurred."}
          </Text>
          <Pressable
            onPress={this.reset}
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
    return this.props.children;
  }
}
