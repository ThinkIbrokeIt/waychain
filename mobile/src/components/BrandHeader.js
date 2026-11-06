import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../theme';

// Wardenclyffe Lighthouse mark — clean copper/amber lighthouse (assets/lighthouse.png).
// Brand mark = favicontower (Tesla Wardenclyffe Tower) per founder directive
// (2026-07-17): tower logo throughout the app. Composited onto parchment in
// assets prep. waylogo.png (rainbow mascot) and lighthouse.png are NOT the brand.
export default function BrandHeader({ subtitle, tagline }) {
  return (
    <View style={styles.wrap}>
      <Image source={require('../../assets/favicontower.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.brand} numberOfLines={1}>WAYCHAIN</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.rule} />
      <Text style={styles.tagline}>{tagline || 'Self-custodial · Ed25519 · Your keys, your chain'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 28, paddingBottom: 16 },
  logo: { width: 88, height: 88 },
  brand: { fontFamily: FONTS.display, fontSize: 28, color: COLORS.warm, letterSpacing: 2, marginTop: 8, textAlign: 'center' },
  subtitle: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.copper, textTransform: 'uppercase', letterSpacing: 3, marginTop: 4, textAlign: 'center' },
  rule: { width: 44, height: 2, backgroundColor: COLORS.copper, marginTop: 10, marginBottom: 8 },
  tagline: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, letterSpacing: 0.5, textAlign: 'center', paddingHorizontal: 20 },
});
