import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import FeaturePending from '../components/FeaturePending';
import { waychainRPC } from '../services/rpc';

export default function StakingScreen({ route }) {
  const [block, setBlock] = useState(null);
  const [stats, setStats] = useState(null);   // {vaults, totalDebt}
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false); // true => RPC doesn't expose read yet

  useEffect(() => {
    waychainRPC.call('way_getBlockCount', []).then(r => setBlock(typeof r === 'string' ? parseInt(r, 16) : r)).catch(() => {});
    waychainRPC.getTwoWayStats()
      .then(s => { setStats(s); setPending(false); })
      .catch(() => setPending(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Stake" />
      <View style={styles.statRow}>
        <View style={styles.stat}><Text style={styles.statLabel}>Network</Text><Text style={styles.statVal}>WayChain</Text></View>
        <View style={styles.stat}><Text style={styles.statLabel}>Block</Text><Text style={styles.statVal}>#{block ?? '—'}</Text></View>
        <View style={styles.stat}><Text style={styles.statLabel}>Chain ID</Text><Text style={styles.statVal}>10008</Text></View>
      </View>

      {loading && <ActivityIndicator color={COLORS.copper} style={{ marginTop: 24 }} />}

      {!loading && !pending && stats && (
        <View style={styles.liveBox}>
          <Text style={styles.liveTitle}>TwoWayVault · on-chain</Text>
          <View style={styles.liveRow}>
            <Text style={styles.liveKey}>Active vaults</Text>
            <Text style={styles.liveVal}>{stats.vaults}</Text>
          </View>
          <View style={styles.liveRow}>
            <Text style={styles.liveKey}>Total debt</Text>
            <Text style={styles.liveVal}>{stats.totalDebt} wei</Text>
          </View>
          <Text style={styles.liveNote}>Delegation + WAY staking UI activates as vaults open.</Text>
        </View>
      )}

      {!loading && pending && (
        <FeaturePending
          title="Staking arrives with the network upgrade"
          detail="WAY delegation/staking is not yet a live precompile. (Note: TwoWayVault 0x18 is deployed and has its own screen — this Stake tab is for WAY staking, which is planned.) The UI activates here once the staking precompile ships. Your keys already control any stake you authorize."
          precompile="planned · WAY staking"
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
