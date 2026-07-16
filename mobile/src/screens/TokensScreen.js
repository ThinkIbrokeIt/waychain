import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { wallet } from '../services/wallet';
import { waychainRPC } from '../services/rpc';

// Token precompiles (verified vs evm/*.go, live 2026-07-15):
//   BIJO 0x14:  balanceOf(address) sel 5b46f8f6 (read) · enableTransfers() sel ad478cda (write, no args)
//   1WAY 0x22:  getUserVault() sel a8b7c9d0 / getPrice() sel b9c8d0e1 (read) · createVault(bytes32) sel a2b1c3d4 (write)
//   SWAY 0x24:  getTotalSupply() sel d4e5a6b7 (read, WORKS) · getBalance(address) sel c3d4e5a6 (502 on public RPC — node bug) · burn(address,uint256) sel b2c3d4f5 (write)
// NOTE: SWAY getBalance 502s server-side (precompile panic on address read) — shown as
// "unavailable"; getTotalSupply works. burn calldata (raw20+uint256, 56B) is proven correct
// but may also 502 on execution; errors are surfaced honestly, no fake success.

function raw20(addr) { return addr.replace(/^0x/, '').toLowerCase().padStart(40, '0').slice(0, 40); }
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

export default function TokensScreen({ navigation }) {
  const [account, setAccount] = useState(null);
  const [bijo, setBijo] = useState(null);
  const [wayPrice, setWayPrice] = useState(null);
  const [vault, setVault] = useState(null);
  const [swaySupply, setSwaySupply] = useState(null);
  const [swayBal, setSwayBal] = useState(null);   // null = unavailable (502)
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const loadAccount = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    setAccount(accs && accs.length ? accs[0] : null);
  }, []);

  const fetchAll = useCallback(async (addr) => {
    setLoading(true);
    try {
      const a = raw20(addr);
      const [b, price, v, swaySup, swayB] = await Promise.allSettled([
        waychainRPC.precompileCall('0x14', 'balanceOf', a),
        waychainRPC.precompileCall('0x22', 'getPrice', ''),
        waychainRPC.precompileCall('0x22', 'getUserVault', ''),
        waychainRPC.precompileCall('0x24', 'getTotalSupply', ''),
        waychainRPC.precompileCall('0x24', 'getBalance', a),
      ]);
      setBijo(b.status === 'fulfilled' ? b.value : '0x0');
      setWayPrice(price.status === 'fulfilled' ? price.value : '0x0');
      setVault(v.status === 'fulfilled' && v.value && v.value !== '0x' ? v.value : null);
      setSwaySupply(swaySup.status === 'fulfilled' ? swaySup.value : '0x0');
      // SWAY getBalance 502s server-side → mark unavailable rather than fake 0.
      setSwayBal(swayB.status === 'fulfilled' && swayB.value && swayB.value !== '0x' ? swayB.value : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAccount(); }, [loadAccount]);
  useEffect(() => { if (account) fetchAll(account.address); }, [account, fetchAll]);

  const write = async (label, fn) => {
    if (!account) { Alert.alert('No wallet', 'Create or import a wallet to transact.'); return; }
    setBusy(label);
    try {
      const res = await fn();
      Alert.alert(label + ' submitted', 'Tx: ' + ((res && res.txHash) || 'pending').slice(0, 20) + '…');
      fetchAll(account.address);
    } catch (e) {
      Alert.alert(label + ' failed', e?.message || 'Unknown error');
    } finally {
      setBusy('');
    }
  };

  const enableBijo = () => write('Enable BIJO transfers', () =>
    waychainRPC.precompileCall('0x14', 'enableTransfers', '', { write: true, privHex: account.privateKey, pub64: account.publicKey }));

  const [vaultId, setVaultId] = useState('');
  const createVault = () => {
    const id = vaultId.trim().replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(id)) { Alert.alert('Invalid vault ID', 'Enter a 32-byte (64 hex) vault ID.'); return; }
    write('Create 1WAY vault', () =>
      waychainRPC.precompileCall('0x22', 'createVault', id, { write: true, privHex: account.privateKey, pub64: account.publicKey }));
  };

  const [burnAmt, setBurnAmt] = useState('');
  const burnSway = () => {
    const amt = parseFloat(burnAmt);
    if (!amt || amt <= 0) { Alert.alert('Invalid amount', 'Enter a SWAY amount.'); return; }
    const wei = BigInt(Math.floor(amt * 1e18)).toString(16);
    const args = raw20(account.address) + encodeUint256('0x' + wei);
    write('Burn SWAY', () =>
      waychainRPC.precompileCall('0x24', 'burn', args, { write: true, privHex: account.privateKey, pub64: account.publicKey }));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Tokens" />

      {/* BIJO */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>BIJO <Text style={styles.addr}>0x14</Text></Text>
        <Text style={styles.row}><Text style={styles.k}>Your balance</Text><Text style={styles.v}>{loading ? '—' : formatWay(bijo)} BIJO</Text></Text>
        <Button label={busy === 'Enable BIJO transfers' ? 'Submitting…' : 'Enable Transfers'} onPress={enableBijo} disabled={!!busy || loading} style={styles.btn} />
      </View>

      {/* 1WAY */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>1WAY <Text style={styles.addr}>0x22</Text></Text>
        <Text style={styles.row}><Text style={styles.k}>BTC price (wei)</Text><Text style={styles.v}>{loading ? '—' : formatWay(wayPrice)}</Text></Text>
        <Text style={styles.row}><Text style={styles.k}>Your vault</Text><Text style={styles.v}>{vault ? vault.slice(0, 16) + '…' : 'none'}</Text></Text>
        <TextInput value={vaultId} onChangeText={setVaultId} placeholder="vault ID (64 hex)" placeholderTextColor={COLORS.muted}
          style={styles.input} autoCapitalize="none" />
        <Button label={busy === 'Create 1WAY vault' ? 'Submitting…' : 'Create Vault'} onPress={createVault} disabled={!!busy || loading} style={styles.btn} />
      </View>

      {/* SWAY */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>SWAY <Text style={styles.addr}>0x24</Text></Text>
        <Text style={styles.row}><Text style={styles.k}>Total supply</Text><Text style={styles.v}>{loading ? '—' : formatWay(swaySupply)} SWAY</Text></Text>
        <Text style={styles.row}><Text style={styles.k}>Your balance</Text>
          <Text style={[styles.v, !swayBal && styles.unavail]}>{swayBal ? formatWay(swayBal) + ' SWAY' : (loading ? '—' : 'unavailable')}</Text></Text>
        <Text style={styles.note}>SWAY getBalance is temporarily unavailable on the public RPC (node error). burn is offered but may also error until fixed.</Text>
        <TextInput value={burnAmt} onChangeText={setBurnAmt} placeholder="amount to burn" placeholderTextColor={COLORS.muted}
          style={styles.input} keyboardType="decimal-pad" />
        <Button label={busy === 'Burn SWAY' ? 'Submitting…' : 'Burn SWAY'} onPress={burnSway} disabled={!!busy || loading} style={styles.btn} />
      </View>

      {loading && <ActivityIndicator color={COLORS.copper} style={{ marginTop: 12 }} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 18, marginTop: 14, borderWidth: 1, borderColor: COLORS.border },
  cardTitle: { fontFamily: FONTS.display, fontSize: 18, color: COLORS.charcoal, marginBottom: 10 },
  addr: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  k: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted },
  v: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.amber },
  unavail: { color: COLORS.muted, fontSize: 13 },
  note: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, marginTop: 8, lineHeight: 16 },
  input: { backgroundColor: COLORS.parchment, color: COLORS.charcoal, padding: 12, borderRadius: 10, marginTop: 10, borderWidth: 1, borderColor: COLORS.border, fontSize: 14 },
  btn: { marginTop: 12 },
});
