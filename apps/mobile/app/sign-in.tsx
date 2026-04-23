import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/ui/ScreenContainer";
import {
  isClerkAPIResponseError,
  useAuth,
  useSignIn,
  useSignUp,
} from "@clerk/clerk-expo";

import { PressableScale } from "@/components/PressableScale";
import { apiPost, setClerkTokenGetter } from "@/lib/api";
import { readCachedAnon, clearAnon } from "@/lib/auth";
import { useGoogleSignIn } from "@/lib/oauth";
import { SyncAnonResponseSchema } from "@cheddr/api-types";

type Step = "choose" | "email" | "code";
type EmailAuthKind = "signInCode" | "signUpCode";

type ClerkApiError = { errors?: { longMessage?: string; message?: string }[] };

function clerkErrorMessage(err: unknown, fallback: string): string {
  const apiErr = err as ClerkApiError;
  const first = apiErr?.errors?.[0];
  if (first?.longMessage) return first.longMessage;
  if (first?.message) return first.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** Returning-user sign-in failed because the identifier is unknown → start sign-up. */
function isLikelyUnknownUser(err: unknown): boolean {
  if (!isClerkAPIResponseError(err)) return false;
  const codes = new Set(err.errors.map((e) => e.code));
  if (
    codes.has("form_identifier_not_found") ||
    codes.has("identifier_not_found") ||
    codes.has("external_account_not_found")
  ) {
    return true;
  }
  const first = err.errors[0];
  if (!first) return false;
  const text = `${first.message ?? ""} ${first.longMessage ?? ""}`.toLowerCase();
  return text.includes("not found") || text.includes("does not exist");
}

/**
 * Passwordless sign-in: Google OAuth or email verification code.
 * After a Clerk session is active, anonymous game history is merged when possible.
 */
export default function SignInScreen() {
  const [step, setStep] = useState<Step>("choose");
  const [emailAuthKind, setEmailAuthKind] = useState<EmailAuthKind>("signInCode");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const { signIn, setActive: setSignInActive } = useSignIn();
  const { signUp, setActive: setSignUpActive } = useSignUp();
  const { isSignedIn, getToken } = useAuth();
  const signInWithGoogle = useGoogleSignIn();

  function goToChoose() {
    setStep("choose");
    setError(null);
    setInfo(null);
    setCode("");
  }

  function goToEmail() {
    setStep("email");
    setError(null);
    setInfo(null);
    setCode("");
  }

  async function handleGoogle() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await signInWithGoogle();
      if (res.ok) {
        await finishAuth();
        return;
      }
      if (!res.cancelled) {
        setError("Could not complete Google sign-in.");
      }
    } catch (err) {
      setError(clerkErrorMessage(err, "Google sign-in failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSendEmailCode() {
    setError(null);
    setInfo(null);
    setBusy(true);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email address.");
      setBusy(false);
      return;
    }
    try {
      if (!signIn) throw new Error("Auth not ready");

      try {
        await signIn.create({ identifier: trimmed });
        const factor = signIn.supportedFirstFactors?.find(
          (f) => f.strategy === "email_code",
        );
        if (!factor || !("emailAddressId" in factor) || !factor.emailAddressId) {
          throw new Error(
            "Email code sign-in is not enabled. In Clerk Dashboard: User & Authentication → Email → enable verification code and disable password-only if you want passwordless.",
          );
        }
        await signIn.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: factor.emailAddressId,
        });
        setEmailAuthKind("signInCode");
        setStep("code");
        setCode("");
        setInfo(`We sent a code to ${trimmed}.`);
      } catch (err) {
        if (isLikelyUnknownUser(err) && signUp) {
          await signUp.create({ emailAddress: trimmed });
          await signUp.prepareEmailAddressVerification({
            strategy: "email_code",
          });
          setEmailAuthKind("signUpCode");
          setStep("code");
          setCode("");
          setInfo(`We sent a code to ${trimmed}.`);
          return;
        }
        throw err;
      }
    } catch (err) {
      setError(clerkErrorMessage(err, "Could not send code"));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCode() {
    setError(null);
    setInfo(null);
    setBusy(true);
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Enter the code from your email.");
      setBusy(false);
      return;
    }
    try {
      if (emailAuthKind === "signInCode") {
        if (!signIn) throw new Error("Auth not ready");
        const attempt = await signIn.attemptFirstFactor({
          strategy: "email_code",
          code: trimmed,
        });
        if (attempt.status === "complete") {
          await setSignInActive?.({ session: attempt.createdSessionId });
          await finishAuth();
          return;
        }
        throw new Error(`Sign-in needs another step (${attempt.status}).`);
      }

      if (!signUp) throw new Error("Auth not ready");
      const attempt = await signUp.attemptEmailAddressVerification({
        code: trimmed,
      });
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
      if (emailAuthKind === "signInCode") {
        if (!signIn) throw new Error("Auth not ready");
        const factor = signIn.supportedFirstFactors?.find(
          (f) => f.strategy === "email_code",
        );
        if (!factor || !("emailAddressId" in factor) || !factor.emailAddressId) {
          throw new Error("Could not resend code.");
        }
        await signIn.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: factor.emailAddressId,
        });
      } else {
        if (!signUp) throw new Error("Auth not ready");
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      }
      setInfo(`We sent a new code to ${email.trim()}.`);
    } catch (err) {
      setError(clerkErrorMessage(err, "Could not resend code"));
    } finally {
      setBusy(false);
    }
  }

  async function finishAuth() {
    // Wire Clerk before any API call: AuthBootstrap only runs in useLayoutEffect;
    // finishAuth runs in the same tick as setActive, before that layout pass.
    setClerkTokenGetter(() => getToken());
    await mergeAnonHistory();
    router.replace("/profile");
  }

  async function mergeAnonHistory() {
    try {
      const anon = await readCachedAnon();
      if (!anon) return;
      const res = await apiPost(
        "/user/sync-anon",
        {
          anonToken: anon.token,
        },
        SyncAnonResponseSchema,
      );
      if (res.mergedGames > 0) {
        await clearAnon();
      }
    } catch {
      // Non-fatal: the user can manually retry from /profile later.
    }
  }

  const headerTitle =
    step === "choose"
      ? "Sign in"
      : step === "email"
        ? "Continue with email"
        : "Check your email";

  return (
    <ScreenContainer variant="modal">
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
              You&apos;re signed in.
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
        ) : step === "choose" ? (
          <>
            <View className="gap-3">
              <Text className="text-2xl font-bold text-primary dark:text-primary-dark">
                Welcome
              </Text>
              <Text className="text-secondary dark:text-secondary-dark">
                Sign in to sync your stats and see your rank. Pick a method below.
              </Text>
            </View>

            {error ? (
              <Text className="text-red-500 text-sm">{error}</Text>
            ) : null}

            <PressableScale
              onPress={handleGoogle}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
              className="bg-elevated dark:bg-elevated-dark py-4 rounded-full items-center border border-elevated dark:border-elevated-dark"
            >
              {busy ? (
                <ActivityIndicator />
              ) : (
                <Text className="text-primary dark:text-primary-dark font-semibold text-lg">
                  Continue with Google
                </Text>
              )}
            </PressableScale>

            <PressableScale
              onPress={goToEmail}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Continue with email"
              className="bg-accent dark:bg-accent-dark py-4 rounded-full items-center"
            >
              <Text className="text-accent-contrast dark:text-accent-contrast-dark font-semibold text-lg">
                Continue with email
              </Text>
            </PressableScale>
          </>
        ) : step === "email" ? (
          <>
            <View className="gap-3">
              <Text className="text-2xl font-bold text-primary dark:text-primary-dark">
                Your email
              </Text>
              <Text className="text-secondary dark:text-secondary-dark">
                We&apos;ll email you a 6-digit code. No password needed.
              </Text>
            </View>

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

            {error ? (
              <Text className="text-red-500 text-sm">{error}</Text>
            ) : null}

            <PressableScale
              onPress={handleSendEmailCode}
              accessibilityRole="button"
              accessibilityLabel="Send verification code"
              className="bg-accent dark:bg-accent-dark py-4 rounded-full items-center"
            >
              {busy ? (
                <ActivityIndicator />
              ) : (
                <Text className="text-accent-contrast dark:text-accent-contrast-dark font-semibold text-lg">
                  Send code
                </Text>
              )}
            </PressableScale>

            <Pressable onPress={goToChoose} accessibilityRole="button">
              <Text className="text-accent dark:text-accent-dark text-center">
                Other sign-in options
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <View className="gap-3">
              <Text className="text-2xl font-bold text-primary dark:text-primary-dark">
                Enter code
              </Text>
              <Text className="text-secondary dark:text-secondary-dark">
                Enter the 6-digit code we sent to {email.trim()}.
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
              onPress={handleVerifyCode}
              accessibilityRole="button"
              accessibilityLabel="Verify code"
              className="bg-accent dark:bg-accent-dark py-4 rounded-full items-center"
            >
              {busy ? (
                <ActivityIndicator />
              ) : (
                <Text className="text-accent-contrast dark:text-accent-contrast-dark font-semibold text-lg">
                  Continue
                </Text>
              )}
            </PressableScale>

            <Pressable onPress={handleResendCode} accessibilityRole="button">
              <Text className="text-accent dark:text-accent-dark text-center">
                Resend code
              </Text>
            </Pressable>

            <Pressable onPress={goToEmail} accessibilityRole="button">
              <Text className="text-accent dark:text-accent-dark text-center">
                Use a different email
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}
