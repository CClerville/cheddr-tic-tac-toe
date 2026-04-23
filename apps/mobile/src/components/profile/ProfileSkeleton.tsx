import { View } from "react-native";

import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  Skeleton,
  SkeletonCircle,
  SkeletonGroup,
} from "@/components/ui/Skeleton";

const WIN_RATE_RING_SIZE = 120;

/**
 * Loading placeholder for the profile screen.
 *
 * Sized to match the real layout's header + tab strip + stats row so
 * the screen doesn't shift when data resolves. Kept structurally
 * identical to `SignedInProfile` to avoid jank on the swap.
 */
export function ProfileSkeleton() {
  return (
    <SkeletonGroup accessibilityLabel="Loading profile">
      <View className="items-center gap-3">
        <SkeletonCircle size={88} />
        <Skeleton
          width="60%"
          height={28}
          radius={8}
          style={{ alignSelf: "center" }}
        />
        <Skeleton
          width="32%"
          height={14}
          radius={6}
          style={{ alignSelf: "center" }}
        />
        <Skeleton
          width={88}
          height={32}
          radius={999}
          style={{ alignSelf: "center" }}
        />
        <Skeleton
          width="100%"
          height={50}
          radius={999}
          style={{ alignSelf: "stretch", marginTop: 4 }}
        />
      </View>

      <View
        className="flex-row rounded-2xl p-1 bg-glass dark:bg-glass-dark border border-glassBorder dark:border-glassBorder-dark"
        style={{
          gap: 6,
          minHeight: 52,
          paddingVertical: 4,
          paddingHorizontal: 4,
        }}
      >
        {([0, 1, 2] as const).map((i) => (
          <View
            key={i}
            className="flex-1"
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Skeleton height={36} radius={12} />
          </View>
        ))}
      </View>

      <View className="gap-6 mt-1">
        <View className="flex-row gap-3 justify-between">
          {([0, 1, 2] as const).map((i) => (
            <GlassPanel key={i} variant="panel" style={{ flex: 1 }}>
              <View className="py-4 px-2 items-center gap-2">
                <Skeleton width={36} height={26} radius={6} />
                <Skeleton width={44} height={10} radius={4} />
              </View>
            </GlassPanel>
          ))}
        </View>
        <Skeleton
          width="50%"
          height={10}
          radius={4}
          style={{ alignSelf: "center" }}
        />

        <GlassPanel variant="panel">
          <View className="p-6 items-center">
            <Skeleton
              width={140}
              height={12}
              radius={4}
              style={{ marginBottom: 16 }}
            />
            <SkeletonCircle size={WIN_RATE_RING_SIZE} />
            <Skeleton
              width={120}
              height={12}
              radius={4}
              style={{ marginTop: 16 }}
            />
          </View>
        </GlassPanel>
      </View>
    </SkeletonGroup>
  );
}
