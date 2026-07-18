import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import AmountField from '../components/AmountField';
import { wayToUsd, fmtWay } from '../services/price';
import { wallet } from '../services/wallet';
import { waychainRPC } from '../services/rpc';

// SwapRoute precompile 0x25 (verified vs evm/swap_route.go, selectors from source):
//   getPair(token0[20], token1[20])   sel 0xe6a537a4 (read)  -> 20-byte pair id
//   getReserves()                     sel 0x23312f44 (read)  -> global reserves (simplified)
//   addLiquidity(amount0[32], amount1[32]) sel 0xe868b10b (write) -> mints LP + SWAY reward
//   removeLiquidity(...)              sel 0xbaa2abde (write) -> ERRORS on-chain (TrustlessLock-gated, not finished)
//   swap(amountIn[32], amountOutMin[32]) sel 0x... (write) -> simplified constant-product, global reserves
// TRUTH: swap_route.go is a SIMPLIFIED DEX — reserves are global, not per-pair;
// removeLiquidity returns an error. This screen wires what works (reads + addLiquidity)
// and labels swap/remove honestly as pending full per-pair implementation.

const TOKENS = [
  { sym: '1WAY', addr: '0x0000000000000000000000000000000000000022' },
  { sym: 'SWAY', addr: '0x0000000000000000000000000000000000000024' },
  { sym: '2WAY', addr: '0x0000000000000000000000000000000000000018' },
];

function pad20(addr) { return addr.replace(/^0x/, '').toLowerCase().padStart(40, '0'); }
function encodeUint256(v) { try { return BigInt(v).toString(16).padStart(64, '0'); } catch { return '0'.repeat(64); } }

export default function SwapRouteScreen() {
  const [account, setAccount] = useState(null);
  const [reserves, setReserves] = useState(null);
  const [pair, setPair] = useState('');
  const [t0, setT0] = useState(TOKENS[0].addr);
  const [t1, setT1] = useState(TOKENS[1].addr);
  const [amt0, setAmt0] = useState('');
  const [amt1, setAmt1] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');

  const loadAccount = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    setAccount(accs && accs.length ? accs[0] : null);
  }, []);
  useEffect(() => { loadAccount(); }, [loadAccount]);

  const getReserves = useCallback(async () => {
    setLoading(true);
    try {
      const r = await waychainRPC.precompileCall('0x25', 'getReserves', '');
      setReserves(r);
    } catch { setReserves(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { getReserves(); }, [getReserves]);

  const getPair = async () => {
    try {
      const p = await waychainRPC.precompileCall('0x25', 'getPair', pad20(t0) + pad20(t1));
      setPair(p && p !== '0x' ? '0x' + p.slice(-40) : '—');
    } catch (e) { setPair('error'); }
  };

  const toWei = (a) => BigInt(Math.round((parseFloat(a) || 0) * 1e18));
  const addLiquidity = async () => {
    if (!account) { Alert.alert('No wallet', 'Create or import a wallet.'); return; }
    if (toWei(amt0) <= 0n || toWei(amt1) <= 0n) { Alert.alert('Amounts', 'Enter both amounts.'); return; }
    setBusy('AddLiquidity');
    try {
      const res = await waychainRPC.precompileCall('0x25', 'addLiquidity', encodeUint256(toWei(amt0)) + encodeUint256(toWei(amt1)), {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      Alert.alert('Liquidity added', 'Tx: ' + ((res && res.txHash) || 'pending').slice(0, 20) + '…\nSWAY reward minted to you.');
      getReserves();
    } catch (e) {
      Alert.alert('Add liquidity failed', e?.message || 'Unknown error');
    } finally { setBusy(''); }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="DEX (Swap Route)" />

      <View style={styles.card}>
        <Text style={styles.label}>Global reserves (simplified DEX)</Text>
        <Text style={styles.reserves}>{loading ? '…' : (reserves || 'unavailable')}</Text>
        <Button label="Refresh reserves" onPress={getReserves} disabled={loading} style={styles.btn} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Get pair ID</Text>
        <TextInput value={t0} onChangeText={setT0} placeholder="token0 20-byte addr" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" />
        <TextInput value={t1} onChangeText={setT1} placeholder="token1 20-byte addr" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" />
        <Button label="Get Pair" onPress={getPair} style={styles.btn} />
        {pair ? <Text style={styles.pairLine}>Pair: {pair}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Add liquidity (amount0 / amount1)</Text>
        <AmountField label="" value={amt0} onChange={setAmt0} placeholder="0.0 token0" />
        <AmountField label="" value={amt1} onChange={setAmt1} placeholder="0.0 token1" />
        <Button label={busy === 'AddLiquidity' ? 'Adding…' : 'Add Liquidity'} onPress={addLiquidity} disabled={!!busy || !account} style={styles.btn} />
      </View>

      <View style={styles.warnBox}>
        <Text style={styles.warnText}>Swap Route (0x25) is the on-chain DEX: provide two tokens as liquidity and earn SWAY rewards from trading fees. Swap & remove-liquidity are still being finished on-chain (current code uses global reserves, not per-pair; remove returns an error). This screen wires reads + addLiquidity for now.</Text>
      </View>

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
  reserves: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.copper, marginTop: 6 },
  pairLine: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.copper, marginTop: 8 },
  warnBox: { backgroundColor: 'rgba(229,57,53,0.10)', borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: COLORS.red },
  warnText: { fontFamily: FONTS.body, fontSize: 12, color: '#FF8A80', lineHeight: 17 },
});
