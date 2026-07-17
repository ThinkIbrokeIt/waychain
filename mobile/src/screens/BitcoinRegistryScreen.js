import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { wallet } from '../services/wallet';
import { waychainRPC } from '../services/rpc';

// BitcoinRegistry precompile 0x16 (verified vs evm/precompiles.go inline impl):
//   getBalance(address)            sel 0x2AFE5AE4 (read)  — addr[20] at input[4:24]
//   getTotalCommitted()            sel 0x3ABFEF65 (read)
//   getTotalWithdrawn()            sel 0x4A77D80B (read)
//   attestCommitment(bytes32,uint256,address) sel 0xF237C0C2 (write) — simplified: utxo[32]+amount[32]+target[20]
//   requestWithdrawal(uint256,string)      sel 0x1D772727 (write) — amount[32] (string arg omitted in simplified path)
// BTC bridge backing 1WAY (1:1). Commit = credit target's BTC balance; withdraw = acknowledge + bump totalWithdrawn.

function pad20(a) { return a.replace(/^0x/, '').toLowerCase().padStart(40, '0'); }
function pad32(h) { return h.replace(/^0x/, '').padStart(64, '0'); }
function encodeUint256(v) { try { return BigInt(v).toString(16).padStart(64, '0'); } catch { return '0'.repeat(64); } }

export default function BitcoinRegistryScreen() {
  const [account, setAccount] = useState(null);
  const [utxo, setUtxo] = useState('');
  const [amount, setAmount] = useState('');
  const [target, setTarget] = useState('');
  const [wdAmount, setWdAmount] = useState('');
  const [bal, setBal] = useState(null);
  const [committed, setCommitted] = useState(null);
  const [withdrawn, setWithdrawn] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');

  const loadAccount = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    setAccount(accs && accs.length ? accs[0] : null);
  }, []);
  useEffect(() => { loadAccount(); }, [loadAccount]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [cb, cw, cc] = await Promise.allSettled([
        account ? waychainRPC.precompileCall('0x16', 'getBalance', pad20(account.address)) : Promise.resolve(null),
        waychainRPC.precompileCall('0x16', 'getTotalCommitted', ''),
        waychainRPC.precompileCall('0x16', 'getTotalWithdrawn', ''),
      ]);
      setBal(cb.status === 'fulfilled' && cb.value ? cb.value : '0x0');
      setCommitted(cc.status === 'fulfilled' && cc.value ? cc.value : '0x0');
      setWithdrawn(cw.status === 'fulfilled' && cw.value ? cw.value : '0x0');
    } finally { setLoading(false); }
  }, [account]);
  useEffect(() => { refresh(); }, [refresh]);

  const attest = async () => {
    if (!account) { Alert.alert('No wallet', 'Create or import a wallet.'); return; }
    const u = utxo.trim().replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(u)) { Alert.alert('Invalid UTXO', 'Enter a 32-byte (64 hex) BTC UTXO hash.'); return; }
    if (BigInt(amount || '0') <= 0n) { Alert.alert('Amount', 'Enter a satoshi amount.'); return; }
    const tgt = (target.trim() || account.address).replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{40}$/.test(tgt)) { Alert.alert('Invalid target', 'Target must be a 20-byte (40 hex) address.'); return; }
    setBusy('Attest');
    try {
      const res = await waychainRPC.precompileCall('0x16', 'attestCommitment', pad32(u) + encodeUint256(amount) + pad20(tgt), {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      Alert.alert('Commitment attested', 'Tx: ' + ((res && res.txHash) || 'pending').slice(0, 20) + '…\n(credits target BTC balance; on-chain clamp 10k–100M sats)');
      refresh();
    } catch (e) {
      Alert.alert('Attest failed', e?.message || 'Unknown error');
    } finally { setBusy(''); }
  };

  const withdraw = async () => {
    if (!account) { Alert.alert('No wallet', 'Create or import a wallet.'); return; }
    if (BigInt(wdAmount || '0') <= 0n) { Alert.alert('Amount', 'Enter a withdrawal amount.'); return; }
    setBusy('Withdraw');
    try {
      const res = await waychainRPC.precompileCall('0x16', 'requestWithdrawal', encodeUint256(wdAmount), {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      Alert.alert('Withdrawal requested', 'Tx: ' + ((res && res.txHash) || 'pending').slice(0, 20) + '…\n(simplified: acknowledges + bumps totalWithdrawn)');
      refresh();
    } catch (e) {
      Alert.alert('Withdraw failed', e?.message || 'Unknown error');
    } finally { setBusy(''); }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Bitcoin Registry" />

      <View style={styles.card}>
        <Text style={styles.label}>Bridge stats (BTC, sats)</Text>
        <Text style={styles.stat}>Your BTC balance: {bal == null ? '…' : bal}</Text>
        <Text style={styles.stat}>Total committed: {committed == null ? '…' : committed}</Text>
        <Text style={styles.stat}>Total withdrawn: {withdrawn == null ? '…' : withdrawn}</Text>
        <Button label="Refresh" onPress={refresh} disabled={loading} style={styles.btn} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Attest BTC commitment</Text>
        <TextInput value={utxo} onChangeText={setUtxo} placeholder="UTXO hash (32-byte hex)" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" />
        <TextInput value={amount} onChangeText={setAmount} placeholder="amount (sats)" placeholderTextColor={COLORS.muted} style={styles.input} keyboardType="decimal-pad" />
        <TextInput value={target} onChangeText={setTarget} placeholder="target addr (20-byte, default you)" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" />
        <Button label={busy === 'Attest' ? 'Attesting…' : 'Attest Commitment'} onPress={attest} disabled={!!busy} style={styles.btn} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Request withdrawal (sats)</Text>
        <TextInput value={wdAmount} onChangeText={setWdAmount} placeholder="amount (sats)" placeholderTextColor={COLORS.muted} style={styles.input} keyboardType="decimal-pad" />
        <Button label={busy === 'Withdraw' ? 'Requesting…' : 'Request Withdrawal'} onPress={withdraw} disabled={!!busy} style={styles.btn} />
      </View>

      <Text style={styles.note}>BitcoinRegistry (0x16): BTC bridge backing 1WAY 1:1. Selectors verified vs evm/precompiles.go. attestCommitment credits the target's BTC balance (on-chain clamp 10k–100M sats, rejects outside range). requestWithdrawal is a simplified acknowledge (bumps totalWithdrawn) — full BTC payout is off-chain settlement.</Text>

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
