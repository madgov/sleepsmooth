import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

export interface ClipWaveformProps {
  peaks: readonly number[];
  /** 0..1 played fraction. Bars up to it use the accent colour. */
  progress: number;
  width: number;
  height: number;
  playedColor: string;
  idleColor: string;
}

/** Mini waveform from stored peaks (0..100). Decorative: the row carries the accessible label. */
export function ClipWaveform({ peaks, progress, width, height, playedColor, idleColor }: ClipWaveformProps) {
  const n = Math.max(1, peaks.length);
  const slot = width / n;
  const bar = Math.max(2, slot * 0.6);
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none">
    <Svg width={width} height={height}>
      {peaks.map((p, i) => {
        const h = Math.max(3, (Math.min(100, Math.max(0, p)) / 100) * height);
        return <Rect key={i} x={i * slot + (slot - bar) / 2} y={(height - h) / 2} width={bar} height={h} rx={bar / 2} fill={(i + 0.5) / n <= progress ? playedColor : idleColor} />;
      })}
    </Svg>
    </View>
  );
}
