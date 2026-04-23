import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Board } from "@/components/Board";
import { GameStatus } from "@/components/GameStatus";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { BackButton, ScreenHeader } from "@/components/ui/ScreenHeader";
import { GAME_SCREEN_HORIZONTAL_INSET_PT } from "@/constants/gameScreenLayout";
import { useGame } from "@/hooks/useGame";
import { useRankedGame } from "@/hooks/useRankedGame";
import { outcomeFromResult } from "@/storage/gameRepository";
import type { Difficulty } from "@cheddr/game-engine";

const VALID: Difficulty[] = ["beginner", "intermediate", "expert"];

function parseDifficulty(value: unknown): Difficulty {
  if (typeof value === "string" && (VALID as string[]).includes(value)) {
    return value as Difficulty;
  }
  return "intermediate";
}

export default function GameScreen() {
  const params = useLocalSearchParams();
  const initialDifficulty = parseDifficulty(params.difficulty);
  const isRanked = params.ranked === "1";

  return isRanked ? (
    <RankedGameScreen difficulty={initialDifficulty} />
  ) : (
    <LocalGameScreen difficulty={initialDifficulty} />
  );
}

function LocalGameScreen({ difficulty: initialDifficulty }: { difficulty: Difficulty }) {
  const { gameState, difficulty, phase, playMove, resetGame } = useGame({
    initialDifficulty,
    hydrate: false,
  });

  useGameOverNavigator({
    phase,
    result: gameState.result,
    difficulty,
    eloDelta: null,
    ranked: false,
  });

  return (
    <Shell title={difficulty} onReset={resetGame}>
      <GameStatus
        result={gameState.result}
        currentPlayer={gameState.currentPlayer}
      />
      <Board
        board={gameState.board}
        result={gameState.result}
        onCellPress={playMove}
        disabled={phase !== "player_turn"}
        currentPlayer={gameState.currentPlayer}
      />
    </Shell>
  );
}

function RankedGameScreen({ difficulty: initialDifficulty }: { difficulty: Difficulty }) {
  const ranked = useRankedGame({ difficulty: initialDifficulty, ranked: true });

  useGameOverNavigator({
    phase: ranked.phase,
    result: ranked.gameState.result,
    difficulty: initialDifficulty,
    eloDelta: ranked.eloDelta,
    ranked: true,
  });

  return (
    <Shell title={`${initialDifficulty} · Ranked`} onReset={ranked.resetGame}>
      {ranked.error ? (
        <Text className="text-red-500 text-center">{ranked.error}</Text>
      ) : null}
      <GameStatus
        result={ranked.gameState.result}
        currentPlayer={ranked.gameState.currentPlayer}
      />
      <Board
        board={ranked.gameState.board}
        result={ranked.gameState.result}
        onCellPress={ranked.playMove}
        disabled={ranked.phase !== "player_turn" || ranked.loading}
        currentPlayer={ranked.gameState.currentPlayer}
      />
    </Shell>
  );
}

function Shell({
  title,
  onReset,
  children,
}: {
  title: string;
  onReset: () => void;
  children: React.ReactNode;
}) {
  return (
    <ScreenContainer>
      <View className="px-4 pt-2 pb-2">
        <GlassPanel variant="panel" style={{ width: "100%" }}>
          <ScreenHeader
            title={title}
            titleClassName="capitalize"
            leading={
              <BackButton
                label="Quit"
                onPress={() => router.replace("/")}
              />
            }
            trailing={
              <Pressable
                onPress={onReset}
                accessibilityRole="button"
                accessibilityLabel="Reset game"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 8,
                }}
              >
                <Text className="text-base text-accent dark:text-accent-dark">
                  Reset
                </Text>
              </Pressable>
            }
          />
        </GlassPanel>
      </View>

      <View
        className="flex-1"
        style={{ paddingHorizontal: GAME_SCREEN_HORIZONTAL_INSET_PT }}
      >
        <ScrollView
          className="min-h-0 flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            alignItems: "center",
            gap: 24,
            paddingVertical: 8,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

function useGameOverNavigator(args: {
  phase: string;
  result: { status: string };
  difficulty: Difficulty;
  eloDelta: number | null;
  ranked: boolean;
}) {
  const { phase, result, difficulty, eloDelta, ranked } = args;
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (phase !== "game_over") {
      navigatedRef.current = false;
      return;
    }
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    const outcome =
      outcomeFromResult(result as never) ??
      ("draw" as const);
    const timer = setTimeout(() => {
      router.push({
        pathname: "/game-over",
        params: {
          outcome,
          difficulty,
          ranked: ranked ? "1" : "0",
          eloDelta: eloDelta === null ? "" : String(eloDelta),
        },
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [phase, result, difficulty, eloDelta, ranked]);
}
