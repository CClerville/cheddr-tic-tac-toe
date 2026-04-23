import { View, Text } from "react-native";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";

import { useTheme } from "@/theme/ThemeProvider";

const SIZE = 120;
const STROKE = 10;

export function WinRateRing({
  wins,
  losses,
  draws,
}: {
  wins: number;
  losses: number;
  draws: number;
}) {
  const { palette } = useTheme();
  const total = wins + losses + draws;
  const rate = total > 0 ? wins / total : 0;
  const pct = Math.round(rate * 100);

  const r = (SIZE - STROKE) / 2;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const oval = Skia.XYWHRect(cx - r, cy - r, 2 * r, 2 * r);

  const track = Skia.Path.Make();
  track.addOval(oval);

  const progress = Skia.Path.Make();
  const sweep = 360 * rate;
  progress.addArc(oval, -90, sweep);

  return (
    <View
      className="items-center justify-center"
      style={{ width: SIZE, height: SIZE }}
    >
      <Canvas style={{ width: SIZE, height: SIZE }}>
        <Path
          path={track}
          style="stroke"
          strokeWidth={STROKE}
          color={palette.subtle}
          strokeCap="round"
        />
        {rate > 0 ? (
          <Path
            path={progress}
            style="stroke"
            strokeWidth={STROKE}
            color={palette.accent}
            strokeCap="round"
          />
        ) : null}
      </Canvas>
      <View
        style={{
          position: "absolute",
          alignItems: "center",
          justifyContent: "center",
          width: SIZE - STROKE * 2,
          height: SIZE - STROKE * 2,
        }}
      >
        <Text
          style={{ color: palette.primary }}
          className="text-2xl font-extrabold"
        >
          {total === 0 ? "—" : `${pct}%`}
        </Text>
        <Text
          style={{ color: palette.muted }}
          className="text-[10px] uppercase tracking-wider mt-0.5"
        >
          wins
        </Text>
      </View>
    </View>
  );
}
