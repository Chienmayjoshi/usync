import { StyleSheet } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

type Props = { width: number; height: number; depth: number; edge: string; edgeDeep: string };

/**
 * NeoPOP bevel: a right strip (edge) and a bottom strip (edgeDeep) meeting on a 45 degree seam.
 * width/height are the face size; the strips sit in the extra `depth` to the right and bottom.
 */
export function Edges({ width: w, height: h, depth: d, edge, edgeDeep }: Props) {
  if (w <= 0 || h <= 0) return null;
  return (
    <Svg width={w + d} height={h + d} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Polygon points={`${w},0 ${w + d},${d} ${w + d},${h + d} ${w},${h}`} fill={edge} />
      <Polygon points={`0,${h} ${w},${h} ${w + d},${h + d} ${d},${h + d}`} fill={edgeDeep} />
    </Svg>
  );
}
