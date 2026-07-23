import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import { wallet } from '../services/wallet';
import { waychainRPC } from '../services/rpc';

// Dox_Dev identity precompile 0x13 (verified vs evm/precompiles.go, live 2026-07-15):
//   Reads: getLevel(address) 9e9f1846 · isVerified(address) 65274728 ·
//          hasMinLevel(address,uint8) 7b245afa · getCuratorCount() 5fcf5764 ·
//          getTotalBadges() e55b5b05
//   Writes (curator-gated, NOT wired as user buttons): issueBadge / upgradeBadge /
//          revokeBadge / addCurator / removeCurator.
// Truth-first: only reads are surfaced. Badge issuance is a curator action — shown as
// an honest note, not a fake button (same discipline as web B1).

function raw20(addr) { return addr.replace(/^0x/, '').toLowerCase().padStart(40, '0').slice(0, 40); }
const LEVEL_NAME = { 0: 'None', 1: 'L1 · Human', 2: 'L2 · Identity', 3: 'L3 · Curator' };

export default function IdentityScreen() {
  const [account, setAccount] = useState(null);
  const [level, setLevel] = useState(null);
  const [verified, setVerified] = useState(null);
  const [curators, setCurators] = useState(null);
  const [totalBadges, setTotalBadges] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAccount = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    setAccount(accs && accs.length ? accs[0] : null);
  }, []);

  const fetchId = useCallback(async (addr) => {
    setLoading(true);
    const a = raw20(addr);
    try {
      const [lv, v, c, tb] = await Promise.allSettled([
        waychainRPC.precompileCall('0x13', 'getLevel', a),
        waychainRPC.precompileCall('0x13', 'isVerified', a),
        waychainRPC.precompileCall('0x13', 'getCuratorCount', ''),
        waychainRPC.precompileCall('0x13', 'getTotalBadges', ''),
      ]);
      setLevel(lv.status === 'fulfilled' && lv.value ? parseInt(lv.value, 16) : 0);
      setVerified(v.status === 'fulfilled' && v.value && v.value !== '0x0' && v.value !== '0x00');
      setCurators(c.status === 'fulfilled' && c.value ? parseInt(c.value, 16) : 0);
      setTotalBadges(tb.status === 'fulfilled' && tb.value ? parseInt(tb.value, 16) : 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAccount(); }, [loadAccount]);
  useEffect(() => { if (account) fetchId(account.publicKey); }, [account, fetchId]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Dox_Dev Identity" />

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Your Dox_Dev Level</Text>
        <Text style={styles.heroVal}>{loading ? '—' : (LEVEL_NAME[level] || 'L' + level)}</Text>
        <View style={[styles.badge, verified ? styles.badgeOn : styles.badgeOff]}>
          <Text style={styles.badgeText}>{loading ? '—' : (verified ? '✓ Verified Human' : 'Not verified')}</Text>
        </View>
        {account && <Text style={styles.addr} selectable numberOfLines={1}>{account.address}</Text>}
      </View>

      <View style={styles.statBox}>
        <View style={styles.statRow}>
          <Text style={styles.k}>Network curators</Text><Text style={styles.v}>{loading ? '—' : curators}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.k}>Total badges issued</Text><Text style={styles.v}>{loading ? '—' : totalBadges}</Text>
        </View>
      </View>

      <View style={styles.noteBox}>
        <Text style={styles.noteTitle}>How Dox_Dev works</Text>
        <Text style={styles.note}>Verified-human identity is the chain's anti-rug layer. L2 unlocks contract deployment and oracle attestation; L3 curators issue badges and govern.</Text>
        <Text style={styles.note}>Badge issuance (issueBadge / upgradeBadge) is a curator-only action on precompile 0x13 — it is not exposed as a wallet button. Reach L2+ to participate.</Text>
      </View>

      {loading && <ActivityIndicator color={COLORS.copper} style={{ marginTop: 12 }} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  hero: { backgroundColor: COLORS.card, borderRadius: 16, padding: 22, marginTop: 8, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  heroLabel: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 2 },
  heroVal: { fontFamily: FONTS.display, fontSize: 30, color: COLORS.copper, marginTop: 6 },
  badge: { marginTop: 12, paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20 },
  badgeOn: { backgroundColor: 'rgba(255,191,0,0.18)', borderWidth: 1, borderColor: COLORS.amber },
  badgeOff: { backgroundColor: 'rgba(229,57,53,0.10)', borderWidth: 1, borderColor: COLORS.red },
  badgeText: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.charcoal },
  addr: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, marginTop: 12, textAlign: 'center' },
  statBox: { backgroundColor: COLORS.card, borderRadius: 14, padding: 18, marginTop: 16, borderWidth: 1, borderColor: COLORS.border },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  k: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.muted },
  v: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.amber },
  noteBox: { backgroundColor: COLORS.card, borderRadius: 14, padding: 18, marginTop: 16, borderWidth: 1, borderColor: COLORS.border },
  noteTitle: { fontFamily: FONTS.display, fontSize: 16, color: COLORS.charcoal, marginBottom: 8 },
  note: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, lineHeight: 18, marginBottom: 8 },
});
