import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { PressableScale } from "@/components/PressableScale";
import type { useTheme } from "@/theme/ThemeProvider";

import { initialsFrom } from "./initials";

export interface ProfileHeaderProps {
  displayName: string;
  handle: string;
  elo: number;
  avatarBg: string;
  palette: ReturnType<typeof useTheme>["palette"];
  onEditProfile: () => void;
}

/**
 * Avatar + name + ELO + edit-profile button stack shown above the
 * tabbed body of the signed-in profile.
 *
 * Pure presentational; all data + callbacks come in via props so the
 * parent screen owns fetch, modal state, and routing.
 */
export function ProfileHeader({
  displayName,
  handle,
  elo,
  avatarBg,
  palette,
  onEditProfile,
}: ProfileHeaderProps) {
  const { t } = useTranslation();
  return (
    <View className="items-center gap-3">
      <View
        className="items-center justify-center rounded-full"
        style={{
          width: 88,
          height: 88,
          backgroundColor: avatarBg,
        }}
      >
        <Text
          style={{ color: palette.accentContrast }}
          className="text-2xl font-extrabold"
        >
          {initialsFrom(displayName)}
        </Text>
      </View>
      <Text className="text-3xl font-bold text-primary dark:text-primary-dark text-center">
        {displayName}
      </Text>
      <Text className="text-secondary dark:text-secondary-dark">{handle}</Text>
      <View
        className="px-4 py-1.5 rounded-full"
        style={{ backgroundColor: palette.accent }}
      >
        <Text
          style={{ color: palette.accentContrast }}
          className="font-bold text-sm"
        >
          ELO {elo}
        </Text>
      </View>
      <PressableScale
        onPress={onEditProfile}
        accessibilityRole="button"
        accessibilityLabel={t("profile.editProfile")}
        className="border border-glassBorder dark:border-glassBorder-dark py-3 px-8 rounded-full w-full items-center mt-1"
      >
        <Text className="text-primary dark:text-primary-dark font-semibold text-base">
          {t("profile.editProfile")}
        </Text>
      </PressableScale>
    </View>
  );
}
