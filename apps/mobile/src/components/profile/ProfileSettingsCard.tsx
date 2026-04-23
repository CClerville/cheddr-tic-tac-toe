import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { ThemeToggle } from "@/components/ThemeToggle";
import { GlassPanel } from "@/components/ui/GlassPanel";

export interface ProfileSettingsCardProps {
  version: string;
  onSignOutPress: () => void;
}

/**
 * Theme toggle + version + destructive sign-out row, grouped in a
 * single GlassPanel. Shown only on the Overview tab for signed-in
 * users.
 */
export function ProfileSettingsCard({
  version,
  onSignOutPress,
}: ProfileSettingsCardProps) {
  const { t } = useTranslation();
  return (
    <GlassPanel variant="panel">
      <View className="p-4 gap-0">
        <View className="flex-row items-center justify-between py-3">
          <Text className="text-primary dark:text-primary-dark font-medium">
            {t("profile.theme")}
          </Text>
          <ThemeToggle />
        </View>
        <View className="h-px bg-glassBorder dark:bg-glassBorder-dark opacity-70" />
        <Text className="text-secondary dark:text-secondary-dark text-xs py-3">
          {t("profile.version", { version })}
        </Text>
        <View className="h-px bg-glassBorder dark:bg-glassBorder-dark opacity-70" />
        <Pressable
          onPress={onSignOutPress}
          accessibilityRole="button"
          accessibilityLabel={t("profile.signOut")}
          style={{ minHeight: 48, justifyContent: "center" }}
        >
          <Text className="text-danger dark:text-danger-dark font-semibold">
            {t("profile.signOut")}
          </Text>
        </Pressable>
      </View>
    </GlassPanel>
  );
}
