import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

// Wardenclyffe Lighthouse mark, built from plain Views (no SVG dependency)
// so it always renders on the parchment header. Copper tower + amber light.
export default function Logo({ size = 56 }) {
  const s = size / 56; // scale factor
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {/* light beams */}
      <View style={[styles.beamL, { borderRightWidth: 18 * s, top: 10 * s, height: 22 * s }]} />
      <View style={[styles.beamR, { borderLeftWidth: 18 * s, top: 10 * s, height: 22 * s }]} />
      {/* tower */}
      <View style={[styles.tower, { width: 26 * s, height: 34 * s, bottom: 16 * s }]} />
      {/* stripes */}
      <View style={[styles.stripe1, { width: 26 * s, bottom: 34 * s }]} />
      <View style={[styles.stripe2, { width: 26 * s, bottom: 24 * s }]} />
      {/* lantern + light */}
      <View style={[styles.lantern, { width: 22 * s, height: 14 * s, bottom: 48 * s }]} />
      <View style={[styles.light, { width: 9 * s, height: 9 * s, bottom: 51 * s }]} />
      {/* roof */}
      <View style={[styles.roof, { borderBottomWidth: 9 * s, borderLeftWidth: 13 * s, borderRightWidth: 13 * s, bottom: 60 * s }]} />
      {/* base */}
      <View style={[styles.base, { width: 34 * s, height: 12 * s, bottom: 4 * s }]} />
    </View>
  );
}

const C = COLORS.copper;
const A = COLORS.amber;
const P = COLORS.parchment;

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  beamL: { position: 'absolute', left: 2, width: 0, height: 0, borderTopWidth: 0, borderBottomColor: 'transparent', borderTopColor: 'transparent', borderRightColor: A, opacity: 0.3, transform: [{ rotate: '18deg' }] },
  beamR: { position: 'absolute', right: 2, width: 0, height: 0, borderTopWidth: 0, borderBottomColor: 'transparent', borderTopColor: 'transparent', borderLeftColor: A, opacity: 0.3, transform: [{ rotate: '-18deg' }] },
  tower: { position: 'absolute', left: '50%', marginLeft: -13, backgroundColor: C, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  stripe1: { position: 'absolute', left: '50%', marginLeft: -13, height: 8, backgroundColor: P, opacity: 0.85 },
  stripe2: { position: 'absolute', left: '50%', marginLeft: -13, height: 8, backgroundColor: P, opacity: 0.85 },
  lantern: { position: 'absolute', left: '50%', marginLeft: -11, backgroundColor: C, borderRadius: 2 },
  light: { position: 'absolute', left: '50%', marginLeft: -4, borderRadius: 999, backgroundColor: A },
  roof: { position: 'absolute', left: '50%', marginLeft: -13, width: 0, height: 0, borderTopColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: C },
  base: { position: 'absolute', left: '50%', marginLeft: -17, backgroundColor: C, borderRadius: 3 },
});
