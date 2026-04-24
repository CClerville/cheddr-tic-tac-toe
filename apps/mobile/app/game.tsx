import { useAuth } from "@clerk/clerk-expo";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { CommentaryBubble } from "@/components/ai/CommentaryBubble";
import { HintButton } from "@/components/ai/HintButton";
import { Board } from "@/components/Board";
import { GameStatus } from "@/components/GameStatus";
import { ApiErrorBanner } from "@/components/ui/ApiErrorBanner";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { BackButton, ScreenHeader } from "@/components/ui/ScreenHeader";
import { GAME_SCREEN_HORIZONTAL_INSET_PT } from "@/constants/gameScreenLayout";
import { useGame } from "@/hooks/useGame";
import { useRankedGame } from "@/hooks/useRankedGame";
import { outcomeFromResult } from "@/storage/gameRepository";
import { PersonalitySchema, type Personality } from "@cheddr/api-types";
import type { Difficulty, GameResult, Position } from "@cheddr/game-engine";

const VALID: Difficulty[] = ["beginner", "intermediate", "expert"];

// Reserved row height for the HintButton (PressableScale with text-sm + py-2).
// Keeping it constant prevents layout shift when the button conditionally renders.
const HINT_ROW_HEIGHT_PT = 40;

function parseDifficulty(value: unknown): Difficulty {
  if (typeof value === "string" && (VALID as string[]).includes(value)) {
    return value as Difficulty;
  }
  return "intermediate";
}

function parsePersonality(value: unknown): Personality {
  const r = PersonalitySchema.safeParse(value);
  return r.success ? r.data : "coach";
}

export default function GameScreen() {
  const params = useLocalSearchParams();
  const initialDifficulty = parseDifficulty(params.difficulty);
  const isRanked = params.ranked === "1";
  const personality = parsePersonality(params.personality);
  const { isSignedIn } = useAuth();

  // Server-backed when ranked OR when the user is signed in (so casual
  // games sync across devices and feed the per-personality breakdown).
  // Anonymous + casual stays purely local to keep offline play snappy
  // and avoid double-counting against signed-in casual aggregates.
  const useServer = isRanked || isSignedIn === true;

  return useServer ? (
    <ServerGameScreen
      difficulty={initialDifficulty}
      personality={personality}
      ranked={isRanked}
    />
  ) : (
    <LocalGameScreen difficulty={initialDifficulty} personality={personality} />
  );
}

function LocalGameScreen({
  difficulty: initialDifficulty,
  personality,
}: {
  difficulty: Difficulty;
  personality: Personality;
}) {
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
    gameId: null,
    personality,
    localOnly: true,
  });

  return (
    <Shell title={difficulty} onReset={resetGame}>
      <GameStatus
        result={gameState.result}
        currentPlayer={gameState.currentPlayer}
        aiThinking={phase === "ai_thinking"}
      />
      <Board
        board={gameState.board}
        result={gameState.result}
        onCellPress={playMove}
        disabled={phase !== "player_turn"}
        aiThinking={phase === "ai_thinking"}
      />
    </Shell>
  );
}

function ServerGameScreen({
  difficulty: initialDifficulty,
  personality,
  ranked: isRanked,
}: {
  difficulty: Difficulty;
  personality: Personality;
  ranked: boolean;
}) {
  const ranked = useRankedGame({
    difficulty: initialDifficulty,
    ranked: isRanked,
    personality,
  });
  const [hintCell, setHintCell] = useState<Position | null>(null);
  const [hintReasoning, setHintReasoning] = useState("");

  useEffect(() => {
    setHintCell(null);
    setHintReasoning("");
  }, [ranked.sessionId]);

  const moveFingerprint = useMemo(
    () => ranked.gameState.moveHistory.join(","),
    [ranked.gameState.moveHistory],
  );

  useGameOverNavigator({
    phase: ranked.phase,
    result: ranked.gameState.result,
    difficulty: initialDifficulty,
    eloDelta: ranked.eloDelta,
    ranked: isRanked,
    gameId: ranked.gameId,
    personality,
    localOnly: false,
  });

  const canHint =
    ranked.phase === "player_turn" &&
    ranked.gameState.currentPlayer === "X" &&
    ranked.gameState.result.status === "in_progress" &&
    !ranked.loading;

  return (
    <Shell
      title={`${initialDifficulty} · ${isRanked ? "Ranked" : "Casual"}`}
      onReset={ranked.resetGame}
      overlay
    >
      {ranked.error ? (
        <View className="w-full max-w-sm">
          <ApiErrorBanner
            error={ranked.error}
            onRetry={() => {
              void ranked.resetGame();
            }}
          />
        </View>
      ) : null}
      <GameStatus
        result={ranked.gameState.result}
        currentPlayer={ranked.gameState.currentPlayer}
        aiThinking={ranked.phase === "ai_thinking"}
      />
      {/* Fixed height keeps the board from jumping when the HintButton
          mounts/unmounts as turn ownership flips between player and AI. */}
      <View
        className="flex-row justify-center items-center gap-3 w-full max-w-sm"
        style={{ height: HINT_ROW_HEIGHT_PT }}
      >
        <HintButton
          sessionId={ranked.sessionId}
          canHint={canHint}
          onSuggest={(pos, reasoning) => {
            setHintCell(pos);
            setHintReasoning(reasoning);
          }}
        />
      </View>
      <Board
        board={ranked.gameState.board}
        result={ranked.gameState.result}
        onCellPress={(pos) => {
          setHintCell(null);
          setHintReasoning("");
          void ranked.playMove(pos);
        }}
        disabled={ranked.phase !== "player_turn" || ranked.loading}
        aiThinking={ranked.phase === "ai_thinking"}
        hintCell={hintCell}
        hintReasoning={hintReasoning}
        onDismissHint={() => {
          setHintCell(null);
          setHintReasoning("");
        }}
      />
      <CommentaryBubble
        sessionId={ranked.sessionId}
        moveFingerprint={moveFingerprint}
        gameOver={ranked.isGameOver}
        terminalAckVersion={ranked.terminalAckVersion}
        personality={personality}
      />
    </Shell>
  );
}

function Shell({
  title,
  onReset,
  children,
  overlay,
}: {
  title: string;
  onReset: () => void;
  children: React.ReactNode;
  /** When true, children can use absolute overlays (e.g. AI bubble). */
  overlay?: boolean;
}) {
  return (
    <ScreenContainer>
      <View className="px-4 pb-2">
        <GlassPanel variant="panel" style={{ width: "100%" }}>
          <ScreenHeader
            title={title}
            titleClassName="capitalize"
            leading={
              <BackButton label="Quit" onPress={() => router.replace("/")} />
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
        className={overlay ? "flex-1 relative" : "flex-1"}
        style={{ paddingHorizontal: GAME_SCREEN_HORIZONTAL_INSET_PT }}
      >
        <ScrollView
          className="min-h-0 flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            alignItems: "center",
            gap: 24,
            paddingTop: 8,
            // Reserve room for the absolute-positioned CommentaryBubble (overlay
            // screens only) so streaming text can grow without overlapping the
            // board. Local screens keep tight centering.
            paddingBottom: overlay ? 140 : 8,
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
  result: GameResult;
  difficulty: Difficulty;
  eloDelta: number | null;
  ranked: boolean;
  gameId: string | null;
  personality: Personality;
  /** Pure local engine — no server row; navigate as soon as the game ends. */
  localOnly?: boolean;
}) {
  const {
    phase,
    result,
    difficulty,
    eloDelta,
    ranked,
    gameId,
    personality,
    localOnly = false,
  } = args;
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (phase !== "game_over") {
      navigatedRef.current = false;
      return;
    }
    // Server hook applies optimistic terminal state before `/game/move` returns
    // `gameId`. If we schedule here, navigatedRef flips true; when `gameId`
    // arrives this effect re-runs, cleanup clears the timer, and the early
    // return blocks forever — user stays on the board (no game-over modal).
    if (!localOnly && !gameId) {
      navigatedRef.current = false;
      return;
    }
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    const outcome = outcomeFromResult(result) ?? ("draw" as const);
    const timer = setTimeout(() => {
      router.push({
        pathname: "/game-over",
        params: {
          outcome,
          difficulty,
          ranked: ranked ? "1" : "0",
          eloDelta: eloDelta === null ? "" : String(eloDelta),
          gameId: gameId ?? "",
          personality,
        },
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [phase, result, difficulty, eloDelta, ranked, gameId, personality, localOnly]);
}
