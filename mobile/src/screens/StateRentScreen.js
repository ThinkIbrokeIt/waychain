import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import AmountField from '../components/AmountField';
import { wayToUsd, fmtWay } from '../services/price';
import { wallet } from '../services/wallet';
import { waychainRPC } from '../services/rpc';

// StateRent precompile 0x1E (verified vs evm/state_rent.go):
//   payRent(uint256)     sel 0xE1F2A3B4 (write) — amount[32] (caller-scoped)
//   getStatus(address)   sel 0xF2A3B4C5 (read)  — addr[32]
//   getDue(address)      sel 0xA3B4C5D6 (read)  — addr[32]
// Rent = size × blocksSinceLast / 1000 (min 1 WAY/KB). 60% burn / 30% validators / 10% treasury.

function pad32(h) { return h.replace(/^0x/, '').padStart(64, '0'); }
function encodeUint256(v) { try { return BigInt(v).toString(16).padStart(64, '0'); } catch { return '0'.repeat(64); } }

export default function StateRentScreen() {
  const [account, setAccount] = useState(null);
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState(null);
  const [due, setDue] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');

  const loadAccount = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    setAccount(accs && accs.length ? accs[0] : null);
  }, []);
  useEffect(() => { loadAccount(); }, [loadAccount]);

  const refresh = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const [s, d] = await Promise.allSettled([
        waychainRPC.precompileCall('0x1E', 'getStatus', pad32(account.publicKey)),
        waychainRPC.precompileCall('0x1E', 'getDue', pad32(account.publicKey)),
      ]);
      setStatus(s.status === 'fulfilled' ? s.value : 'err');
      setDue(d.status === 'fulfilled' ? d.value : 'err');
    } finally { setLoading(false); }
  }, [account]);
  useEffect(() => { refresh(); }, [refresh]);

  const pay = async () => {
    if (!account) { Alert.alert('No wallet', 'Create or import a wallet.'); return; }
    if (BigInt(Math.round((parseFloat(amount) || 0) * 1e18)) <= 0n) { Alert.alert('Amount', 'Enter an amount > 0.'); return; }
    setBusy('PayRent');
    try {
      const res = await waychainRPC.precompileCall('0x1E', 'payRent', encodeUint256(BigInt(Math.round((parseFloat(amount) || 0) * 1e18))), {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      Alert.alert('Rent paid', 'Tx: ' + ((res && res.txHash) || 'pending').slice(0, 20) + '…');
      refresh();
    } catch (e) { Alert.alert('Pay failed', e?.message || 'Unknown error'); }
    finally { setBusy(''); }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="State Rent" />
      <View style={styles.card}>
        <Text style={styles.label}>Your rent status / due</Text>
        <Text style={styles.stat}>status: {loading ? '…' : (status ?? '—')}</Text>
        <Text style={styles.stat}>due: {loading ? '…' : (due ?? '—')}</Text>
        <Button label="Refresh" onPress={refresh} disabled={loading} style={styles.btn} />
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Pay rent (WAY)</Text>
        <AmountField label="" value={amount} onChange={setAmount} placeholder="0.0 WAY" />
        <Button label={busy === 'PayRent' ? 'Paying…' : 'Pay Rent'} onPress={pay} disabled={!!busy} style={styles.btn} />
      </View>
      <Text style={styles.note}>State Rent (0x1E): every account pays rent on the chain storage it uses, so bloat is discouraged and the network stays lean. Rent is priced by data size and time held; most of it is burned, the rest goes to validators and the treasury.</Text>
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
  stat: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.copper, marginTop: 6 },
  btn: { marginTop: 12 },
  note: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, marginTop: 14, lineHeight: 16 },
});
