import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import FeaturePending from '../components/FeaturePending';
import { waychainRPC } from '../services/rpc';

export default function BridgeScreen() {
  const [block, setBlock] = useState(null);
  const [stats, setStats] = useState(null);   // {committed, withdrawn}
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    waychainRPC.call('way_getBlockCount', []).then(r => setBlock(typeof r === 'string' ? parseInt(r, 16) : r)).catch(() => {});
    waychainRPC.getBridgeStats()
      .then(s => { setStats(s); setPending(false); })
      .catch(() => setPending(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Bridge" />
      <View style={styles.statRow}>
        <View style={styles.stat}><Text style={styles.statLabel}>Block</Text><Text style={styles.statVal}>#{block ?? '—'}</Text></View>
        <View style={styles.stat}><Text style={styles.statLabel}>Attestation</Text><Text style={styles.statVal}>SHA-256</Text></View>
      </View>

      {loading && <ActivityIndicator color={COLORS.copper} style={{ marginTop: 24 }} />}

      {!loading && !pending && stats && (
        <View style={styles.liveBox}>
          <Text style={styles.liveTitle}>BitcoinRegistry · on-chain</Text>
          <View style={styles.liveRow}>
            <Text style={styles.liveKey}>BTC committed</Text>
            <Text style={styles.liveVal}>{stats.committed} sat</Text>
          </View>
          <View style={styles.liveRow}>
            <Text style={styles.liveKey}>BTC withdrawn</Text>
            <Text style={styles.liveVal}>{stats.withdrawn} sat</Text>
          </View>
          <Text style={styles.liveNote}>CrossChainAttestation (0x1F) verifies BTC↔WayChain proofs via SHA-256.</Text>
        </View>
      )}

      {!loading && pending && (
        <FeaturePending
          title="Cross-chain bridging is being wired"
          detail="The CrossChainAttestation precompile (0x1F) verifies Bitcoin ↔ WayChain proofs using SHA-256 (not keccak). Bridge statistics are live via way_bridgeStats — this screen will surface them in a follow-up."
          precompile="0x1F · CrossChainAttestation"
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  stat: { flex: 1, backgroundColor: COLORS.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  statLabel: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1 },
  statVal: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.copper, marginTop: 4 },
  liveBox: { backgroundColor: COLORS.card, borderRadius: 14, padding: 20, marginTop: 16, borderWidth: 1, borderColor: COLORS.border },
  liveTitle: { fontFamily: FONTS.display, fontSize: 18, color: COLORS.charcoal, marginBottom: 12 },
  liveRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  liveKey: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.muted },
  liveVal: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.amber },
  liveNote: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 12, lineHeight: 18 },
});
