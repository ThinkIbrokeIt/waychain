import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { wallet } from '../services/wallet';
import { waychainRPC } from '../services/rpc';

// StabilityPool precompile 0x19 (verified vs evm/stability_pool.go):
//   deposit(uint256)          sel 0x4E26609A (write) — amount[32]
//   withdraw(uint256)         sel 0x2E1A7DDD (write) — amount[32]
//   claimRewards()            sel 0x6B6F4360 (write) — no args
//   getUserDeposit(address)   sel 0x3C5F5F80 (read)  — address[32] (20-byte left-padded)
//   getPoolStats()            sel 0x8C5F41D0 (read)  — no args, returns (total,way,sway)
//   absorb(address vaultId)   sel 0x91B78CB4 (write) — vaultId[32]
// Absorbs 2WAY liquidation debt; LPs earn fees + penalties (WAY + SWAY buckets).

function encodeUint256(v) { try { return BigInt(v).toString(16).padStart(64, '0'); } catch { return '0'.repeat(64); } }
function padAddr(a) { return a.replace(/^0x/, '').toLowerCase().padStart(64, '0'); }

export default function StabilityPoolScreen() {
  const [account, setAccount] = useState(null);
  const [amount, setAmount] = useState('');
  const [userDeposit, setUserDeposit] = useState(null);
  const [pool, setPool] = useState(null);
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
      const [p, u] = await Promise.allSettled([
        waychainRPC.precompileCall('0x19', 'getPoolStats', ''),
        account ? waychainRPC.precompileCall('0x19', 'getUserDeposit', padAddr(account.address)) : Promise.resolve(null),
      ]);
      setPool(p.status === 'fulfilled' && p.value ? p.value : null);
      setUserDeposit(u.status === 'fulfilled' && u.value && u.value !== '0x' ? u.value : '0x0');
    } finally { setLoading(false); }
  }, [account]);
  useEffect(() => { refresh(); }, [refresh]);

  const write = async (label, args) => {
    if (!account) { Alert.alert('No wallet', 'Create or import a wallet.'); return; }
    if ((label === 'Deposit' || label === 'Withdraw') && BigInt(amount || '0') <= 0n) { Alert.alert('Amount', 'Enter an amount > 0.'); return; }
    setBusy(label);
    try {
      const res = await waychainRPC.precompileCall('0x19', label.toLowerCase(), args, {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      Alert.alert(label + ' submitted', 'Tx: ' + ((res && res.txHash) || 'pending').slice(0, 20) + '…');
      refresh();
    } catch (e) {
      Alert.alert(label + ' failed', e?.message || 'Unknown error');
    } finally { setBusy(''); }
  };

  const deposit = () => write('Deposit', encodeUint256(amount));
  const withdraw = () => write('Withdraw', encodeUint256(amount));
  const claim = () => write('ClaimRewards', '');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Stability Pool" />

      <View style={styles.card}>
        <Text style={styles.label}>Pool stats</Text>
        <Text style={styles.stat}>{loading ? '…' : (pool || 'unavailable')}</Text>
        <Text style={styles.sub}>Your deposit: {userDeposit == null ? '…' : userDeposit} (2WAY)</Text>
        <Button label="Refresh" onPress={refresh} disabled={loading} style={styles.btn} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Amount (2WAY, 18 decimals)</Text>
        <TextInput value={amount} onChangeText={setAmount} placeholder="e.g. 1000000000000000000" placeholderTextColor={COLORS.muted} style={styles.input} keyboardType="decimal-pad" />
        <View style={styles.actions}>
          <Button label={busy === 'Deposit' ? '…' : 'Deposit'} onPress={deposit} disabled={!!busy} variant="secondary" style={styles.actBtn} />
          <Button label={busy === 'Withdraw' ? '…' : 'Withdraw'} onPress={withdraw} disabled={!!busy} variant="secondary" style={styles.actBtn} />
        </View>
        <Button label={busy === 'ClaimRewards' ? 'Claiming…' : 'Claim Rewards (WAY + SWAY)'} onPress={claim} disabled={!!busy || !account} style={styles.btn} />
      </View>

      <Text style={styles.note}>StabilityPool (0x19): absorbs 2WAY liquidation debt; LPs earn fees + penalties from the WAY and SWAY reward buckets. Selectors verified vs evm/stability_pool.go. Deposit/withdraw/claim are real write ops.</Text>

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
  sub: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 6 },
  btn: { marginTop: 12 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  actBtn: { flex: 1 },
  note: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, marginTop: 14, lineHeight: 16 },
});
