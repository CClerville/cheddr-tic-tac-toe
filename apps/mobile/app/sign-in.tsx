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
type Step = "form" | "verify-email";

// Clerk surfaces validation issues as ClerkAPIError[] on the thrown error.
// We pull out the first human-readable message instead of dumping the raw
// status enum (e.g. "missing_requirements") into the UI.
type ClerkApiError = { errors?: { longMessage?: string; message?: string }[] };

function clerkErrorMessage(err: unknown, fallback: string): string {
  const apiErr = err as ClerkApiError;
  const first = apiErr?.errors?.[0];
  if (first?.longMessage) return first.longMessage;
  if (first?.message) return first.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/**
 * Email + password screen. After a successful Clerk session is established,
 * we attempt to merge the device's anon history into the new account.
 *
 * Clerk dev instances require email verification by default, so sign-up is a
 * two-step flow: create the SignUp resource, then enter the 6-digit code
 * Clerk emails to the user.
 */
export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const { signIn, setActive: setSignInActive } = useSignIn();
  const { signUp, setActive: setSignUpActive } = useSignUp();
  const { isSignedIn } = useAuth();

  function switchMode(next: Mode) {
    setMode(next);
    setStep("form");
    setError(null);
    setInfo(null);
    setCode("");
  }

  async function handleSubmit() {
    setError(null);
    setInfo(null);
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
          await finishAuth();
          return;
        }
        throw new Error(`Sign in needs an extra step (${attempt.status}).`);
      }

      if (!signUp) throw new Error("Auth not ready");
      const attempt = await signUp.create({
        emailAddress: email,
        password,
      });

      if (attempt.status === "complete") {
        await setSignUpActive?.({ session: attempt.createdSessionId });
        await finishAuth();
        return;
      }

      // Most common path on a fresh Clerk dev instance: email verification
      // is required. Send the code and move to the verify step.
      const needsEmailVerification =
        attempt.unverifiedFields?.includes("email_address") ?? false;

      if (needsEmailVerification) {
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setStep("verify-email");
        setInfo(`We sent a 6-digit code to ${email}.`);
        return;
      }

      const missing = attempt.missingFields?.join(", ");
      throw new Error(
        missing
          ? `Sign-up is missing required fields: ${missing}.`
          : `Sign-up needs another step (${attempt.status}).`,
      );
    } catch (err) {
      setError(clerkErrorMessage(err, "Sign-in failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyEmail() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (!signUp) throw new Error("Auth not ready");
      const attempt = await signUp.attemptEmailAddressVerification({ code });
      if (attempt.status === "complete") {
        await setSignUpActive?.({ session: attempt.createdSessionId });
        await finishAuth();
        return;
      }
      throw new Error(`Verification needs another step (${attempt.status}).`);
    } catch (err) {
      setError(clerkErrorMessage(err, "Verification failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleResendCode() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (!signUp) throw new Error("Auth not ready");
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setInfo(`We sent a new code to ${email}.`);
    } catch (err) {
      setError(clerkErrorMessage(err, "Could not resend code"));
    } finally {
      setBusy(false);
    }
  }

  async function finishAuth() {
    await mergeAnonHistory();
    router.replace("/profile");
  }

  async function mergeAnonHistory() {
    try {
      const anon = await readCachedAnon();
      if (!anon) return;
      const res = await apiPost<SyncAnonResponse>("/user/sync-anon", {
        anonToken: anon.token,
      });
      if (res.mergedGames > 0) {
        await clearAnon();
      }
    } catch {
      // Non-fatal: the user can manually retry from /profile later.
    }
  }

  const headerTitle =
    step === "verify-email"
      ? "Verify email"
      : mode === "sign-in"
        ? "Sign in"
        : "Create account";

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable onPress={() => router.back()} className="px-3 py-2">
          <Text className="text-base text-accent dark:text-accent-dark">
            Close
          </Text>
        </Pressable>
        <Text className="text-base font-semibold text-primary dark:text-primary-dark">
          {headerTitle}
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
        ) : step === "verify-email" ? (
          <>
            <View className="gap-3">
              <Text className="text-2xl font-bold text-primary dark:text-primary-dark">
                Check your email
              </Text>
              <Text className="text-secondary dark:text-secondary-dark">
                Enter the 6-digit code we sent to {email} to finish creating
                your account.
              </Text>
            </View>

            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              className="border border-elevated dark:border-elevated-dark bg-elevated dark:bg-elevated-dark text-primary dark:text-primary-dark px-4 py-3 rounded-xl text-center text-xl tracking-widest"
              placeholderTextColor="#888"
            />

            {info ? (
              <Text className="text-secondary dark:text-secondary-dark text-sm">
                {info}
              </Text>
            ) : null}
            {error ? (
              <Text className="text-red-500 text-sm">{error}</Text>
            ) : null}

            <PressableScale
              onPress={handleVerifyEmail}
              accessibilityRole="button"
              accessibilityLabel="Verify email"
              className="bg-accent dark:bg-accent-dark py-4 rounded-full items-center"
            >
              {busy ? (
                <ActivityIndicator />
              ) : (
                <Text className="text-accent-contrast dark:text-accent-contrast-dark font-semibold text-lg">
                  Verify email
                </Text>
              )}
            </PressableScale>

            <Pressable onPress={handleResendCode} accessibilityRole="button">
              <Text className="text-accent dark:text-accent-dark text-center">
                Resend code
              </Text>
            </Pressable>
          </>
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
              onPress={() => switchMode(mode === "sign-in" ? "sign-up" : "sign-in")}
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
