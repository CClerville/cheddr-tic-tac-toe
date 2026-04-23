import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  HEX_COLOR_PATTERN,
  type Profile,
  type ProfileUpdateRequest,
  type ProfileUpdateResponse,
  USERNAME_PATTERN,
} from "@cheddr/api-types";

import { PressableScale } from "@/components/PressableScale";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ApiError, apiPatch } from "@/lib/api";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * Curated avatar palette — colors picked to remain legible against
 * `accentContrast` text in both themes. Order matches the swatch row
 * shown in the picker.
 */
const AVATAR_COLORS = [
  "#D97706",
  "#F59E0B",
  "#DC2626",
  "#EC4899",
  "#8B5CF6",
  "#4F46E5",
  "#0891B2",
  "#10B981",
] as const;

const DEFAULT_AVATAR = AVATAR_COLORS[0];

interface EditProfileSheetProps {
  visible: boolean;
  profile: Profile;
  onDismiss: () => void;
}

/**
 * Bottom-sheet form for editing display name, username, and avatar color.
 *
 * Validation mirrors the server (`@cheddr/api-types`) so the user gets
 * inline feedback before hitting the network. The mutation only sends
 * fields that actually changed, and the sheet stays open on validation
 * or 409 errors so the user can fix their input without losing context.
 */
export function EditProfileSheet({
  visible,
  profile,
  onDismiss,
}: EditProfileSheetProps) {
  const { palette } = useTheme();
  const qc = useQueryClient();

  const initialDisplay = profile.displayName ?? "";
  const initialUsername = profile.username ?? "";
  const initialColor = profile.avatarColor ?? DEFAULT_AVATAR;

  const [displayName, setDisplayName] = useState(initialDisplay);
  const [username, setUsername] = useState(initialUsername);
  const [avatarColor, setAvatarColor] = useState(initialColor);
  const [serverError, setServerError] = useState<string | null>(null);
  const usernameRef = useRef<TextInput>(null);

  // Reset local state whenever the sheet is reopened or the underlying
  // profile changes (e.g., after a successful save).
  useEffect(() => {
    if (visible) {
      setDisplayName(profile.displayName ?? "");
      setUsername(profile.username ?? "");
      setAvatarColor(profile.avatarColor ?? DEFAULT_AVATAR);
      setServerError(null);
    }
  }, [visible, profile.displayName, profile.username, profile.avatarColor]);

  const trimmedDisplay = displayName.trim();
  const trimmedUsername = username.trim();

  const usernameError = useMemo(() => {
    if (!trimmedUsername) return "Username is required";
    if (!USERNAME_PATTERN.test(trimmedUsername))
      return "3-20 chars, letters/numbers/underscore";
    return null;
  }, [trimmedUsername]);

  const displayNameError = useMemo(() => {
    if (trimmedDisplay.length > 50) return "50 characters max";
    return null;
  }, [trimmedDisplay]);

  const avatarColorError = useMemo(() => {
    if (!HEX_COLOR_PATTERN.test(avatarColor)) return "Pick a color";
    return null;
  }, [avatarColor]);

  const dirty =
    trimmedDisplay !== (profile.displayName ?? "") ||
    trimmedUsername !== (profile.username ?? "") ||
    avatarColor !== (profile.avatarColor ?? DEFAULT_AVATAR);

  const valid =
    !usernameError && !displayNameError && !avatarColorError;

  const mutation = useMutation<ProfileUpdateResponse, Error, ProfileUpdateRequest>({
    mutationFn: (body) =>
      apiPatch<ProfileUpdateResponse, ProfileUpdateRequest>("/user/me", body),
    onSuccess: (res) => {
      haptics.win();
      qc.setQueryData<Profile>(["user", "me", profile.id], res.profile);
      void qc.invalidateQueries({ queryKey: ["user", "me"] });
      void qc.invalidateQueries({ queryKey: ["leaderboard"] });
      onDismiss();
    },
    onError: (err) => {
      haptics.draw();
      // Field-specific 409 on username is the common case — surface it
      // next to the username input rather than as a generic banner.
      if (err instanceof ApiError && err.status === 409) {
        setServerError("That username is already taken.");
        usernameRef.current?.focus();
        return;
      }
      setServerError(err.message || "Couldn't save your profile.");
    },
  });

  const handleSave = () => {
    if (!dirty || !valid || mutation.isPending) return;
    setServerError(null);
    haptics.cellTap();

    const body: ProfileUpdateRequest = {};
    if (trimmedUsername !== (profile.username ?? "")) {
      body.username = trimmedUsername;
    }
    if (trimmedDisplay !== (profile.displayName ?? "")) {
      // Empty string clears the display name on the server.
      body.displayName = trimmedDisplay.length > 0 ? trimmedDisplay : null;
    }
    if (avatarColor !== (profile.avatarColor ?? DEFAULT_AVATAR)) {
      body.avatarColor = avatarColor;
    }

    mutation.mutate(body);
  };

  const inputBase =
    "border bg-elevated dark:bg-elevated-dark text-primary dark:text-primary-dark px-4 py-3 rounded-xl";

  return (
    <BottomSheet
      visible={visible}
      title="Edit profile"
      onDismiss={onDismiss}
      maxHeightRatio={0.85}
      maxHeight={640}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          className="gap-4"
        >
          <View className="items-center gap-2 mb-2">
            <View
              accessibilityLabel={`Avatar preview, color ${avatarColor}`}
              className="items-center justify-center rounded-full"
              style={{
                width: 72,
                height: 72,
                backgroundColor: avatarColor,
              }}
            >
              <Text
                style={{ color: palette.accentContrast }}
                className="text-2xl font-extrabold"
              >
                {previewInitials(trimmedDisplay, trimmedUsername)}
              </Text>
            </View>
          </View>

          <View className="gap-1.5 mb-3">
            <Text className="text-xs uppercase tracking-widest text-muted dark:text-muted-dark">
              Display name
            </Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              autoCapitalize="words"
              maxLength={50}
              className={inputBase}
              style={{ borderColor: palette.glassBorder }}
              placeholderTextColor={palette.muted}
              returnKeyType="next"
              onSubmitEditing={() => usernameRef.current?.focus()}
            />
            {displayNameError ? (
              <Text className="text-danger dark:text-danger-dark text-xs">
                {displayNameError}
              </Text>
            ) : (
              <Text className="text-muted dark:text-muted-dark text-xs">
                Shown above your @handle. Optional.
              </Text>
            )}
          </View>

          <View className="gap-1.5 mb-3">
            <Text className="text-xs uppercase tracking-widest text-muted dark:text-muted-dark">
              Username
            </Text>
            <TextInput
              ref={usernameRef}
              value={username}
              onChangeText={(t) => {
                setUsername(t);
                if (serverError) setServerError(null);
              }}
              placeholder="cheddrfan"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              className={inputBase}
              style={{ borderColor: palette.glassBorder }}
              placeholderTextColor={palette.muted}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
            {usernameError ? (
              <Text className="text-danger dark:text-danger-dark text-xs">
                {usernameError}
              </Text>
            ) : (
              <Text className="text-muted dark:text-muted-dark text-xs">
                Visible on the leaderboard.
              </Text>
            )}
          </View>

          <View className="gap-2 mb-4">
            <Text className="text-xs uppercase tracking-widest text-muted dark:text-muted-dark">
              Avatar color
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {AVATAR_COLORS.map((c) => {
                const selected = c === avatarColor;
                return (
                  <Pressable
                    key={c}
                    onPress={() => {
                      haptics.selectionChange();
                      setAvatarColor(c);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Avatar color ${c}`}
                    accessibilityState={{ selected }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: c,
                      borderWidth: selected ? 3 : 1,
                      borderColor: selected
                        ? palette.primary
                        : palette.glassBorder,
                    }}
                  />
                );
              })}
            </View>
          </View>

          {serverError ? (
            <Text className="text-danger dark:text-danger-dark text-sm mb-2">
              {serverError}
            </Text>
          ) : null}

          <View className="gap-3 mb-2">
            <PressableScale
              onPress={handleSave}
              disabled={!dirty || !valid || mutation.isPending}
              accessibilityRole="button"
              accessibilityLabel="Save profile changes"
              className="bg-accent dark:bg-accent-dark py-3 rounded-full items-center"
              style={{
                opacity: !dirty || !valid || mutation.isPending ? 0.5 : 1,
              }}
            >
              {mutation.isPending ? (
                <ActivityIndicator color={palette.accentContrast} />
              ) : (
                <Text className="text-accent-contrast dark:text-accent-contrast-dark font-semibold">
                  Save changes
                </Text>
              )}
            </PressableScale>
            <PressableScale
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              className="border border-glassBorder dark:border-glassBorder-dark py-3 rounded-full items-center"
            >
              <Text className="text-primary dark:text-primary-dark font-medium">
                Cancel
              </Text>
            </PressableScale>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

function previewInitials(display: string, username: string): string {
  const source = display || username;
  if (!source) return "?";
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}
