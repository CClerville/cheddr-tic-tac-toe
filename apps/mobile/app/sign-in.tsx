import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSignIn, useSignUp, useAuth } from "@clerk/clerk-expo";

import { PressableScale } from "@/components/PressableScale";
import { apiPost } from "@/lib/api";
import { readCachedAnon, clearAnon } from "@/lib/auth";
import type { SyncAnonResponse } from "@cheddr/api-types";

type Mode = "sign-in" | "sign-up";

/**
 * Email + password screen with magic-link-friendly UX. After a successful
 * Clerk session is established, we attempt to merge the device's anon
 * history into the new account.
 */
export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { signIn, setActive: setSignInActive } = useSignIn();
  const { signUp, setActive: setSignUpActive } = useSignUp();
  const { isSignedIn } = useAuth();

  async function handleSubmit() {
    setError(null);
    setBusy(true);
    try {
      if (mode === "sign-in") {
        if (!signIn) throw new Error("Auth not ready");
        const attempt = await signIn.create({
          identifier: email,
          password,
        });
        if (attempt.status === "complete") {
          await setSignInActive?.({ session: attempt.createdSessionId });
        } else {
          throw new Error(`Status: ${attempt.status}`);
        }
      } else {
        if (!signUp) throw new Error("Auth not ready");
        const attempt = await signUp.create({
          emailAddress: email,
          password,
        });
        if (attempt.status === "complete") {
          await setSignUpActive?.({ session: attempt.createdSessionId });
        } else {
          throw new Error(`Status: ${attempt.status}`);
        }
      }

      await mergeAnonHistory();
      router.replace("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function mergeAnonHistory() {
    try {
      const anon = await readCachedAnon();
      if (!anon) return;
      const res = await apiPost<SyncAnonResponse>("/user/sync-anon", {
        anonToken: anon.token,
      });
      if (res.mergedGames > 0) {
        // Clear the now-orphan anon token so we don't try to re-sync.
        await clearAnon();
      }
    } catch {
      // Non-fatal: the user can manually retry from /profile later.
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable onPress={() => router.back()} className="px-3 py-2">
          <Text className="text-base text-accent dark:text-accent-dark">
            Close
          </Text>
        </Pressable>
        <Text className="text-base font-semibold text-primary dark:text-primary-dark">
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </Text>
        <View className="w-12" />
      </View>

      <View className="flex-1 px-6 justify-center gap-6">
        {isSignedIn ? (
          <View className="items-center gap-3">
            <Text className="text-xl text-primary dark:text-primary-dark">
              You're signed in.
            </Text>
            <PressableScale
              onPress={() => router.replace("/profile")}
              className="bg-accent dark:bg-accent-dark py-3 px-8 rounded-full"
              accessibilityRole="button"
              accessibilityLabel="View profile"
            >
              <Text className="text-accent-contrast dark:text-accent-contrast-dark font-semibold">
                View profile
              </Text>
            </PressableScale>
          </View>
        ) : (
          <>
            <View className="gap-3">
              <Text className="text-2xl font-bold text-primary dark:text-primary-dark">
                {mode === "sign-in"
                  ? "Welcome back"
                  : "Climb the leaderboard"}
              </Text>
              <Text className="text-secondary dark:text-secondary-dark">
                {mode === "sign-in"
                  ? "Sign in to sync your stats and see your rank."
                  : "Create an account to claim your anonymous history."}
              </Text>
            </View>

            <View className="gap-3">
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                className="border border-elevated dark:border-elevated-dark bg-elevated dark:bg-elevated-dark text-primary dark:text-primary-dark px-4 py-3 rounded-xl"
                placeholderTextColor="#888"
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                secureTextEntry
                className="border border-elevated dark:border-elevated-dark bg-elevated dark:bg-elevated-dark text-primary dark:text-primary-dark px-4 py-3 rounded-xl"
                placeholderTextColor="#888"
              />
            </View>

            {error ? (
              <Text className="text-red-500 text-sm">{error}</Text>
            ) : null}

            <PressableScale
              onPress={handleSubmit}
              accessibilityRole="button"
              accessibilityLabel={mode === "sign-in" ? "Sign in" : "Create account"}
              className="bg-accent dark:bg-accent-dark py-4 rounded-full items-center"
            >
              {busy ? (
                <ActivityIndicator />
              ) : (
                <Text className="text-accent-contrast dark:text-accent-contrast-dark font-semibold text-lg">
                  {mode === "sign-in" ? "Sign in" : "Create account"}
                </Text>
              )}
            </PressableScale>

            <Pressable
              onPress={() =>
                setMode(mode === "sign-in" ? "sign-up" : "sign-in")
              }
              accessibilityRole="button"
            >
              <Text className="text-accent dark:text-accent-dark text-center">
                {mode === "sign-in"
                  ? "No account yet? Create one"
                  : "Already have an account? Sign in"}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
