import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../theme';

// Honest "feature not yet live on this RPC" panel. Used by P3 screens
// (Stake / Governance / Bridge) where the chain precompile exists but the
// public RPC doesn't yet expose a read method. Never shows fake data.
export default function FeaturePending({ title, detail, precompile }) {
  return (
    <View style={styles.box}>
      <Text style={styles.emoji}>🛠️</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.detail}>{detail}</Text>
      {precompile ? <Text style={styles.pre}>Precompile {precompile} · on-chain</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: COLORS.card, borderRadius: 14, padding: 28, marginTop: 16, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  emoji: { fontSize: 38 },
  title: { fontFamily: FONTS.display, fontSize: 20, color: COLORS.charcoal, marginTop: 10, textAlign: 'center' },
  detail: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.muted, marginTop: 8, textAlign: 'center', lineHeight: 21 },
  pre: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.copper, marginTop: 12, letterSpacing: 0.5 },
});
