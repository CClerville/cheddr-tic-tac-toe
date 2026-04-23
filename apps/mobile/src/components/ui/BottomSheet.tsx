import { type ReactNode, useLayoutEffect } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useTheme } from "@/theme/ThemeProvider";

const SPRING = { damping: 24, stiffness: 280 };

export function BottomSheet({
  visible,
  title,
  children,
  onDismiss,
  /**
   * Cap the sheet height as a fraction of window height. Defaults to 0.55
   * (good for confirms). Bump to ~0.85 for forms with multiple inputs.
   */
  maxHeightRatio = 0.55,
  /**
   * Hard ceiling in points. Defaults to 420 (paired with the 0.55 ratio
   * above so simple confirms feel compact on tablets). Bump alongside
   * `maxHeightRatio` for taller content.
   */
  maxHeight = 420,
}: {
  visible: boolean;
  title: string;
  children: ReactNode;
  onDismiss: () => void;
  maxHeightRatio?: number;
  maxHeight?: number;
}) {
  const { height: winH } = useWindowDimensions();
  const { palette } = useTheme();
  const sheetMax = Math.min(winH * maxHeightRatio, maxHeight);
  const translateY = useSharedValue(sheetMax);

  useLayoutEffect(() => {
    if (visible) {
      translateY.value = sheetMax;
      requestAnimationFrame(() => {
        translateY.value = withSpring(0, SPRING);
      });
    }
  }, [visible, sheetMax, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const finishDismiss = () => {
    onDismiss();
  };

  const animateClose = () => {
    translateY.value = withSpring(sheetMax, SPRING, (finished) => {
      if (finished) runOnJS(finishDismiss)();
    });
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 80 || e.velocityY > 600) {
        translateY.value = withSpring(sheetMax, SPRING, (finished) => {
          if (finished) runOnJS(finishDismiss)();
        });
      } else {
        translateY.value = withSpring(0, SPRING);
      }
    });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={animateClose}
    >
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={animateClose}>
          <View style={styles.scrim} />
        </Pressable>
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              styles.sheet,
              {
                maxHeight: sheetMax,
                paddingBottom: 24,
                backgroundColor: palette.surfaceTop,
                borderColor: palette.glassBorder,
              },
              sheetStyle,
            ]}
          >
            <View style={styles.handleWrap}>
              <View
                style={[styles.handle, { backgroundColor: palette.muted }]}
              />
            </View>
            <Text
              style={{ color: palette.primary }}
              className="text-lg font-bold px-5 pb-3"
            >
              {title}
            </Text>
            <View className="px-5">{children}</View>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
});
