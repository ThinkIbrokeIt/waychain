import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { wallet } from '../services/wallet';
import { waychainRPC } from '../services/rpc';
import { useNavigation } from '@react-navigation/native';

// WIFR Gauntlet Rewards (precompile 0x21).
// Reads: getTotalRemaining(), getRemainingRewards(uint64 poolId).
// Write: claimPioneer(address) — raw 20-byte address at input[4:24] (Go precompiles.go).
// Verified live 2026-07-15: selectors 0x100678aa / 0x63760e3d / 0x8aa238fa match
// waychain-consensus/evm/precompiles.go; getRemainingRewards returns '0x' when a
// pool is uninitialized (treat as 0). Claim requires a connected account signer.

// Encode a uint64 pool id as a 32-byte (64 hex) word, big-endian.
function encodeUint64(v) {
  return String(v).replace(/^0x/, '').padStart(64, '0');
}
// Format a WAY reward value (wei, 18 decimals) for display; guard overflow on 32-byte results.
function formatWay(hex) {
  if (!hex || hex === '0x' || hex === '0x0') return '0';
  try {
    const v = BigInt(hex);
    const whole = v / 10n ** 18n;
    const frac = v % 10n ** 18n;
    const fracStr = frac.toString().padStart(18, '0').replace(/0+$/, '');
    return fracStr ? `${whole}.${fracStr}` : `${whole}`;
  } catch {
    return String(hex);
  }
}

export default function WIFRScreen() {
  const navigation = useNavigation();
  const [account, setAccount] = useState(null);
  const [total, setTotal] = useState(null);
  const [pools, setPools] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const loadAccount = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    setAccount(accs && accs.length ? accs[0] : null);
  }, []);

  const fetchRewards = useCallback(async () => {
    setLoading(true);
    try {
      const t = await waychainRPC.precompileCall('0x21', 'getTotalRemaining', '');
      setTotal(t);
      const next = {};
      for (const poolId of [1, 2, 3]) {
        try {
          const r = await waychainRPC.precompileCall('0x21', 'getRemainingRewards', encodeUint64(poolId));
          next[poolId] = r && r !== '0x' ? r : '0x0';
        } catch {
          next[poolId] = '0x0';
        }
      }
      setPools(next);
    } catch (e) {
      setTotal('0x0');
      setPools({ 1: '0x0', 2: '0x0', 3: '0x0' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAccount(); }, [loadAccount]);
  useEffect(() => { fetchRewards(); }, [fetchRewards]);

  const claim = () => {
    if (!account) { Alert.alert('No wallet', 'Create or import a wallet to claim rewards.'); return; }
    Alert.alert(
      'Claim Pioneer Rewards',
      `Claim WIFR gauntlet rewards to\n${account.address.slice(0, 12)}…${account.address.slice(-8)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Claim', style: 'default', onPress: doClaim },
      ]
    );
  };

  const doClaim = async () => {
    if (!account) return;
    setBusy(true);
    try {
      // claimPioneer(address): Go reads input[4:24] = raw 20-byte address (no 0x).
      const argsHex = account.address.replace(/^0x/, '');
      const res = await waychainRPC.precompileCall('0x21', 'claimPioneer', argsHex, {
        write: true,
        privHex: account.privateKey,
        pub64: account.publicKey,
      });
      setClaimed(true);
      Alert.alert('Claimed', 'Transaction submitted.\nHash: ' + ((res && res.txHash) || 'pending').slice(0, 20) + '…');
      fetchRewards();
    } catch (e) {
      Alert.alert('Claim failed', e?.message || 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="WIFR Gauntlet" />

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Total Rewards Remaining</Text>
        <Text style={styles.heroVal}>{loading ? '—' : formatWay(total)} WAY</Text>
      </View>

      <View style={styles.poolBox}>
        <Text style={styles.boxTitle}>Reward Pools</Text>
        {[1, 2, 3].map((pid) => (
          <View key={pid} style={styles.poolRow}>
            <Text style={styles.poolName}>Pool {pid}</Text>
            <Text style={styles.poolVal}>{loading ? '—' : formatWay(pools[pid])} WAY</Text>
          </View>
        ))}
        <Text style={styles.note}>Live from WayChain precompile 0x21. 1,000 WIFR = 1 WAY.</Text>
      </View>

      {!account ? (
        <View style={styles.warnBox}>
          <Text style={styles.warnText}>No wallet found. Create or import a wallet to claim pioneer rewards.</Text>
        </View>
      ) : (
        <Button label={busy ? 'Claiming…' : 'Claim Pioneer Rewards'} onPress={claim} disabled={busy || loading} style={styles.claimBtn} />
      )}

      {claimed && (
        <TouchableOpacity style={styles.refresh} onPress={fetchRewards}>
          <Text style={styles.refreshText}>Tap to refresh balances</Text>
        </TouchableOpacity>
      )}

      <Button label="Open Quests" onPress={() => navigation.navigate('Quests')} style={styles.questsBtn} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  hero: { backgroundColor: COLORS.card, borderRadius: 16, padding: 22, marginTop: 8, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  heroLabel: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 2 },
  heroVal: { fontFamily: FONTS.display, fontSize: 34, color: COLORS.copper, marginTop: 6 },
  poolBox: { backgroundColor: COLORS.card, borderRadius: 14, padding: 20, marginTop: 16, borderWidth: 1, borderColor: COLORS.border },
  boxTitle: { fontFamily: FONTS.display, fontSize: 18, color: COLORS.charcoal, marginBottom: 12 },
  poolRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  poolName: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.muted },
  poolVal: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.amber },
  note: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 12, lineHeight: 18 },
  warnBox: { backgroundColor: 'rgba(229,57,53,0.10)', borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: COLORS.red },
  warnText: { fontFamily: FONTS.body, fontSize: 13, color: '#FF8A80', textAlign: 'center' },
  claimBtn: { marginTop: 18 },
  refresh: { marginTop: 14, alignItems: 'center' },
  refreshText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.copper },
  questsBtn: { marginTop: 18 },
});
