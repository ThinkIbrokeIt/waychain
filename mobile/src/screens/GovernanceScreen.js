import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import FeaturePending from '../components/FeaturePending';
import { waychainRPC } from '../services/rpc';

const STATUS = { 0: 'Pending', 1: 'Active', 2: 'Passed', 3: 'Failed', 4: 'Executed' };
const VOTE_TYPE = { 0: 'Direct', 1: 'Quadratic', 2: 'Futarchy' };

export default function GovernanceScreen() {
  const [block, setBlock] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    waychainRPC.call('way_getBlockCount', []).then(r => setBlock(typeof r === 'string' ? parseInt(r, 16) : r)).catch(() => {});
    waychainRPC.getGovernanceProposals()
      .then(p => { setProposals(p); setPending(false); })
      .catch(() => setPending(true))
      .finally(() => setLoading(false));
  }, []);

  const active = proposals.filter(p => p.status === 1).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Governance" />
      <View style={styles.statRow}>
        <View style={styles.stat}><Text style={styles.statLabel}>Block</Text><Text style={styles.statVal}>#{block ?? '—'}</Text></View>
        <View style={styles.stat}><Text style={styles.statLabel}>Vote Type</Text><Text style={styles.statVal}>Direct</Text></View>
        <View style={styles.stat}><Text style={styles.statLabel}>Proposals</Text><Text style={styles.statVal}>{loading ? '—' : (pending ? '0' : proposals.length)}</Text></View>
      </View>

      {loading && <ActivityIndicator color={COLORS.copper} style={{ marginTop: 24 }} />}

      {!loading && !pending && (
        <View style={styles.liveBox}>
          <Text style={styles.liveTitle}>On-chain governance · live</Text>
          {proposals.length === 0 ? (
            <Text style={styles.liveNote}>No proposals yet. The Governance precompile (0x1D) is live — create one from a Level-2+ account.</Text>
          ) : (
            proposals.map((p, i) => (
              <View key={p.id || i} style={styles.propRow}>
                <View style={styles.propMeta}>
                  <Text style={styles.propType}>{VOTE_TYPE[p.voteType] ?? 'Direct'}</Text>
                  <Text style={styles.propStatus}>{STATUS[p.status] ?? '—'}</Text>
                </View>
                <Text style={styles.propId} numberOfLines={1}>{p.id}</Text>
              </View>
            ))
          )}
          <Text style={styles.liveNote}>Voting is Dox_Dev-weighted (Direct / Quadratic / Futarchy). Your identity-weighted voice is ready.</Text>
        </View>
      )}

      {!loading && pending && (
        <FeaturePending
          title="On-chain governance is live"
          detail="The Governance precompile (0x1D) supports Direct / Quadratic / Futarchy voting weighted by Dox_Dev identity. Proposal browsing and voting will activate here once the public RPC exposes way_govProposals. Your identity-weighted voice is ready."
          precompile="0x1D · Governance"
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
  propRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  propMeta: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  propType: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.copper },
  propStatus: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted },
  propId: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, flex: 1, textAlign: 'right', marginLeft: 12 },
  liveNote: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 12, lineHeight: 18 },
});
