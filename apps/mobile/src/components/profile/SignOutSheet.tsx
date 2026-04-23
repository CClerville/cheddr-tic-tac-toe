import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { PressableScale } from "@/components/PressableScale";
import { BottomSheet } from "@/components/ui/BottomSheet";

export interface SignOutSheetProps {
  visible: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

/**
 * Confirmation sheet for signing out. Reassures the user that ranked
 * progress is server-persisted so they don't fear data loss.
 */
export function SignOutSheet({
  visible,
  onConfirm,
  onDismiss,
}: SignOutSheetProps) {
  const { t } = useTranslation();
  return (
    <BottomSheet
      visible={visible}
      title={t("profile.signOutTitle")}
      onDismiss={onDismiss}
    >
      <Text className="text-secondary dark:text-secondary-dark mb-4">
        {t("profile.signOutBody")}
      </Text>
      <View className="gap-3">
        <PressableScale
          onPress={onConfirm}
          accessibilityRole="button"
          accessibilityLabel={t("profile.signOut")}
          className="bg-danger dark:bg-danger-dark py-3 rounded-full items-center"
        >
          <Text className="text-white font-semibold">
            {t("profile.signOut")}
          </Text>
        </PressableScale>
        <PressableScale
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t("common.cancel")}
          className="border border-glassBorder dark:border-glassBorder-dark py-3 rounded-full items-center"
        >
          <Text className="text-primary dark:text-primary-dark font-medium">
            {t("common.cancel")}
          </Text>
        </PressableScale>
      </View>
    </BottomSheet>
  );
}
