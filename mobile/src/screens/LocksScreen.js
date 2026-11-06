import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { wallet } from '../services/wallet';
import { waychainRPC } from '../services/rpc';

// TrustlessLock precompile 0x1A (verified vs evm/trustless_lock.go, live 2026-07-15):
//   getLock(bytes32)        sel d4e5f6a7 (read)  — lockID = input[4:36] (32-byte)
//   releasableAmount(bytes32) sel e5f6a7b8 (read) — lockID = input[4:36]
//   release(bytes32)        sel f6a7b8c9 (write) — lockID = input[4:36]
//   extend(bytes32,uint256) sel a7b8c9d0 (write) — lockID[4:36] + blocks[36:68]
// Calldata layouts proven in web B3: release = 32-byte lockID (36B total w/ sel);
// extend = 32-byte lockID + 32-byte blocks (68B total w/ sel).

function pad32(h) { return h.replace(/^0x/, '').padStart(64, '0'); }
function encodeUint256(v) { return BigInt(v).toString(16).padStart(64, '0'); }
function formatWay(hex) {
  if (!hex || hex === '0x' || hex === '0x0') return '0';
  try {
    const v = BigInt(hex);
    const whole = v / 10n ** 18n;
    const frac = (v % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
    return frac ? `${whole}.${frac}` : `${whole}`;
  } catch { return String(hex); }
}

export default function LocksScreen() {
  const [account, setAccount] = useState(null);
  const [lockId, setLockId] = useState('');
  const [lock, setLock] = useState(null);       // decoded getLock result
  const [releasable, setReleasable] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [extendBlocks, setExtendBlocks] = useState('');

  const loadAccount = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    setAccount(accs && accs.length ? accs[0] : null);
  }, []);
  useEffect(() => { loadAccount(); }, [loadAccount]);

  const lookup = async () => {
    const id = lockId.trim().replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(id)) { Alert.alert('Invalid lock ID', 'Enter a 32-byte (64 hex) lock ID.'); return; }
    setLoading(true);
    try {
      const [lk, rel] = await Promise.allSettled([
        waychainRPC.precompileCall('0x1A', 'getLock', pad32(id)),
        waychainRPC.precompileCall('0x1A', 'releasableAmount', pad32(id)),
      ]);
      setLock(lk.status === 'fulfilled' && lk.value && lk.value !== '0x' ? lk.value : null);
      setReleasable(rel.status === 'fulfilled' && rel.value && rel.value !== '0x' ? rel.value : '0x0');
    } finally {
      setLoading(false);
    }
  };

  const write = async (label, fn) => {
    if (!account) { Alert.alert('No wallet', 'Create or import a wallet to transact.'); return; }
    setBusy(label);
    try {
      const res = await fn();
      Alert.alert(label + ' submitted', 'Tx: ' + ((res && res.txHash) || 'pending').slice(0, 20) + '…');
      lookup();
    } catch (e) {
      Alert.alert(label + ' failed', e?.message || 'Unknown error');
    } finally {
      setBusy('');
    }
  };

  const release = () => {
    const id = lockId.trim().replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(id)) { Alert.alert('Invalid lock ID', 'Enter a 32-byte (64 hex) lock ID.'); return; }
    write('Release', () =>
      waychainRPC.precompileCall('0x1A', 'release', pad32(id), { write: true, privHex: account.privateKey, pub64: account.publicKey }));
  };

  const extend = () => {
    const id = lockId.trim().replace(/^0x/, '');
    const blocks = parseInt(extendBlocks, 10);
    if (!/^[0-9a-fA-F]{64}$/.test(id)) { Alert.alert('Invalid lock ID', 'Enter a 32-byte (64 hex) lock ID.'); return; }
    if (!blocks || blocks <= 0) { Alert.alert('Invalid blocks', 'Enter +blocks to extend.'); return; }
    write('Extend', () =>
      waychainRPC.precompileCall('0x1A', 'extend', pad32(id) + encodeUint256(blocks), { write: true, privHex: account.privateKey, pub64: account.publicKey }));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Trustless Locks" />

      <View style={styles.card}>
        <Text style={styles.label}>Lock ID (32-byte hex)</Text>
        <TextInput value={lockId} onChangeText={setLockId} placeholder="0x… 64 hex" placeholderTextColor={COLORS.muted}
          style={styles.input} autoCapitalize="none" />
        <Button label={loading ? 'Looking up…' : 'Look Up Lock'} onPress={lookup} disabled={loading} style={styles.btn} />

        {lock && (
          <View style={styles.detail}>
            <Text style={styles.row}><Text style={styles.k}>Lock state</Text><Text style={styles.v}>{lock}</Text></Text>
            <Text style={styles.row}><Text style={styles.k}>Releasable</Text><Text style={styles.v}>{formatWay(releasable)} WAY</Text></Text>
          </View>
        )}

        <Text style={styles.label}>Extend by (blocks)</Text>
        <TextInput value={extendBlocks} onChangeText={setExtendBlocks} placeholder="e.g. 1000" placeholderTextColor={COLORS.muted}
          style={styles.input} keyboardType="decimal-pad" />
        <View style={styles.actions}>
          <Button label={busy === 'Release' ? '…' : 'Release'} onPress={release} disabled={!!busy || !lock} variant="secondary" style={styles.actBtn} />
          <Button label={busy === 'Extend' ? '…' : 'Extend'} onPress={extend} disabled={!!busy || !lock} variant="secondary" style={styles.actBtn} />
        </View>
      </View>

      <Text style={styles.note}>TrustlessLock (0x1A): time-locked liquidity, releasable on schedule. release/extend are proven write ops. createTimeLock needs pool/token/recipient args — added in a follow-up.</Text>

      {loading && <ActivityIndicator color={COLORS.copper} style={{ marginTop: 12 }} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 18, marginTop: 14, borderWidth: 1, borderColor: COLORS.border },
  label: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 },
  input: { backgroundColor: COLORS.parchment, color: COLORS.charcoal, padding: 12, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: COLORS.border, fontSize: 13 },
  btn: { marginTop: 12 },
  detail: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  k: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted },
  v: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.amber },
  actions: { flexDirection: 'row', gap: 12, marginTop: 14 },
  actBtn: { flex: 1 },
  note: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, marginTop: 14, lineHeight: 16 },
});
