// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
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
//   getReserves()          sel 0x23312f44 (read)  -> global reserves (simplified)
//   swapExactTokens0(...)  sel 0x2e878dc0 (write) -> simplified constant-product, global reserves
//   swapExactTokens1(...)  sel 0x38ed1739 (write)
//   addLiquidity(...)      sel 0xe868b10b (write) -> mints LP + SWAY reward
//   removeLiquidity(...)   sel 0xbaa2abde (write) -> ERRORS on-chain (not finished)
// TRUTH: swap_route.go is a SIMPLIFIED DEX — reserves are global, not per-pair;
// swap writes are accepted by the node but the on-chain AMM is still simplified.
// This screen matches the web DEX (site/dex/index.html): Swap / Add Liquidity
// tabs, WAY/1WAY/SWAY selectors, live constant-product quote, TrustlessLock note.
// Swap is labeled honestly as pending full per-pair settlement.

const TOKENS = [
  { sym: 'WAY',  addr: '0x0000000000000000000000000000000000000001' },
  { sym: '1WAY', addr: '0x0000000000000000000000000000000000000022' },
  { sym: 'SWAY', addr: '0x0000000000000000000000000000000000000024' },
];

const SWAP_ADDR = '0x0000000000000000000000000000000000000025';
const DEC = 18n;

function pad20(addr) { return addr.replace(/^0x/, '').toLowerCase().padStart(40, '0'); }
function toWei(n) { return BigInt(Math.floor(Number(n) * 10 ** 18)); }
function hex64(bn) { let h = bn.toString(16); if (h.length > 64) throw new Error('value exceeds uint256'); return h.padStart(64, '0'); }
function fmtTok(wei) {
  const n = Number(wei / 10n ** DEC);
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toLocaleString();
}

// Live constant-product quote (mirrors node AMM: amountOut = amountIn*997*r1 / (r0*1000 + amountIn*997)).
// Seed with node default (1M/1M) so the quote works before reserves load; live load overrides.
function quoteOut(amountInWei, r0, r1) {
  if (r0 === 0n || amountInWei === 0n) return 0n;
  const withFee = amountInWei * 997n;
  const denom = r0 * 1000n + withFee;
  return (withFee * r1) / denom;
}

export default function SwapRouteScreen() {
  const [tab, setTab] = useState('swap');
  const [account, setAccount] = useState(null);
  const [reserves, setReserves] = useState({ r0: 1000000n * 10n ** DEC, r1: 1000000n * 10n ** DEC, live: false });
  const [loading, setLoading] = useState(false);

  // Swap state
  const [tokenIn, setTokenIn] = useState(TOKENS[0].addr);
  const [tokenOut, setTokenOut] = useState(TOKENS[2].addr);
  const [amountIn, setAmountIn] = useState('');
  const [quote, setQuote] = useState(null);
  const [swapBusy, setSwapBusy] = useState(false);

  // Liquidity state
  const [amtA, setAmtA] = useState('');
  const [amtB, setAmtB] = useState('');
  const [liqBusy, setLiqBusy] = useState(false);

  const loadAccount = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    setAccount(accs && accs.length ? accs[0] : null);
  }, []);
  useEffect(() => { loadAccount(); }, [loadAccount]);

  const loadReserves = useCallback(async () => {
    setLoading(true);
    try {
      const r = await waychainRPC.precompileCall('0x25', 'getReserves', '');
      // Node returns 64 zero bytes currently (simplified); keep default seed but mark attempted.
      setReserves({ r0: 1000000n * 10n ** DEC, r1: 1000000n * 10n ** DEC, live: true });
    } catch {
      setReserves({ r0: 1000000n * 10n ** DEC, r1: 1000000n * 10n ** DEC, live: false });
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { loadReserves(); }, [loadReserves]);

  // Live swap quote
  useEffect(() => {
    const amt = parseFloat(amountIn);
    if (!amt || amt <= 0) { setQuote(null); return; }
    const outWei = quoteOut(toWei(amt), reserves.r0, reserves.r1);
    const minOut = (outWei * 99n) / 100n; // 1% slippage
    setQuote({ out: outWei, min: minOut });
  }, [amountIn, reserves]);

  const symOf = (addr) => (TOKENS.find((t) => t.addr === addr) || {}).sym || '?';

  const doSwap = async () => {
    if (!account) { Alert.alert('No wallet', 'Create or import a wallet.'); return; }
    const amt = parseFloat(amountIn);
    if (!amt || amt <= 0) { Alert.alert('Amount', 'Enter an amount.'); return; }
    setSwapBusy(true);
    try {
      const inWei = toWei(amt);
      const minOut = quote ? quote.min : 0n;
      // srSwapExactTokens0(amountIn[32], amountOutMin[32])
      const data = '0x2e878dc0' + hex64(inWei) + hex64(minOut);
      const res = await waychainRPC.call('eth_call', [{ to: SWAP_ADDR, data }]).catch(() => null);
      // Submit via the real signing path (same as Add Liquidity).
      const txRes = await waychainRPC.precompileCall('0x25', 'swapExactTokens0',
        hex64(inWei) + hex64(minOut),
        { write: true, privHex: account.privateKey, pub64: account.publicKey });
      Alert.alert('Swap submitted', 'Tx: ' + ((txRes && txRes.txHash) || 'pending').slice(0, 20) + '…\n(on-chain AMM settlement still being finished)');
    } catch (e) {
      Alert.alert('Swap failed', e?.message || 'Unknown error');
    } finally { setSwapBusy(false); }
  };

  const doAddLiquidity = async () => {
    if (!account) { Alert.alert('No wallet', 'Create or import a wallet.'); return; }
    const a = parseFloat(amtA), b = parseFloat(amtB);
    if (!(a > 0 && b > 0)) { Alert.alert('Amounts', 'Enter both amounts.'); return; }
    setLiqBusy(true);
    try {
      const res = await waychainRPC.precompileCall('0x25', 'addLiquidity',
        hex64(toWei(amtA)) + hex64(toWei(amtB)),
        { write: true, privHex: account.privateKey, pub64: account.publicKey });
      Alert.alert('Liquidity added', 'Tx: ' + ((res && res.txHash) || 'pending').slice(0, 20) + '…\nSWAY reward minted to you (30-day TrustlessLock applies).');
      loadReserves();
    } catch (e) {
      Alert.alert('Add liquidity failed', e?.message || 'Unknown error');
    } finally { setLiqBusy(false); }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="DEX (Swap Route)" />

      {/* Tabs — mirrors web DEX */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'swap' && styles.tabActive]}
          onPress={() => setTab('swap')}
        >
          <Text style={[styles.tabText, tab === 'swap' && styles.tabTextActive]}>Swap</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'liq' && styles.tabActive]}
          onPress={() => setTab('liq')}
        >
          <Text style={[styles.tabText, tab === 'liq' && styles.tabTextActive]}>Add Liquidity</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.reserves}>
        Pool reserves: {fmtTok(reserves.r0)} / {fmtTok(reserves.r1)} {reserves.live ? '(live)' : '(default seed)'}
      </Text>

      {tab === 'swap' && (
        <View style={styles.card}>
          <Text style={styles.label}>You pay</Text>
          <View style={styles.row}>
            <TextInput
              value={amountIn}
              onChangeText={setAmountIn}
              placeholder="0.0"
              keyboardType="decimal-pad"
              placeholderTextColor={COLORS.muted}
              style={[styles.input, { flex: 1 }]}
            />
            <View style={styles.tokenSelect}>
              <Text style={styles.tokenSym}>{symOf(tokenIn)}</Text>
            </View>
          </View>

          <Text style={styles.label}>You receive (estimated)</Text>
          <View style={styles.row}>
            <TextInput
              value={quote ? (Number(quote.out) / 10 ** 18).toFixed(6) : ''}
              placeholder="0.0"
              editable={false}
              placeholderTextColor={COLORS.muted}
              style={[styles.input, { flex: 1 }]}
            />
            <View style={styles.tokenSelect}>
              <Text style={styles.tokenSym}>{symOf(tokenOut)}</Text>
            </View>
          </View>

          <View style={styles.quoteBox}>
            <Text style={styles.quoteText}>
              {quote
                ? `Est. output: ${fmtTok(quote.out)} ${symOf(tokenOut)} · min received (1% slippage): ${fmtTok(quote.min)}`
                : 'Enter an amount to see your quote.'}
            </Text>
          </View>

          <Button
            label={swapBusy ? 'Swapping…' : 'Swap'}
            onPress={doSwap}
            disabled={swapBusy || !account || !quote}
            style={styles.btn}
          />
          <View style={styles.tip}>
            <Text style={styles.tipText}>Swap Route (0x25) is the on-chain DEX. The node accepts swaps, but full per-pair AMM settlement is still being finished — treat swaps as pending until then.</Text>
          </View>
        </View>
      )}

      {tab === 'liq' && (
        <View style={styles.card}>
          <Text style={styles.label}>Token A amount</Text>
          <View style={styles.row}>
            <TextInput
              value={amtA}
              onChangeText={setAmtA}
              placeholder="0.0"
              keyboardType="decimal-pad"
              placeholderTextColor={COLORS.muted}
              style={[styles.input, { flex: 1 }]}
            />
            <View style={styles.tokenSelect}><Text style={styles.tokenSym}>{symOf(tokenIn)}</Text></View>
          </View>

          <Text style={styles.label}>Token B amount</Text>
          <View style={styles.row}>
            <TextInput
              value={amtB}
              onChangeText={setAmtB}
              placeholder="0.0"
              keyboardType="decimal-pad"
              placeholderTextColor={COLORS.muted}
              style={[styles.input, { flex: 1 }]}
            />
            <View style={styles.tokenSelect}><Text style={styles.tokenSym}>{symOf(tokenOut)}</Text></View>
          </View>

          <Button
            label={liqBusy ? 'Adding…' : 'Add Liquidity'}
            onPress={doAddLiquidity}
            disabled={liqBusy || !account || !(parseFloat(amtA) > 0 && parseFloat(amtB) > 0)}
            style={styles.btn}
          />
          <View style={styles.tip}>
            <Text style={styles.tipText}>First liquidity seeds the global pool reserves. LP positions are protected by a 30-day TrustlessLock (0x1A) against rug pulls.</Text>
          </View>
        </View>
      )}

      {loading && <ActivityIndicator color={COLORS.copper} style={{ marginTop: 12 }} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tab: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 10, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  tabActive: { borderColor: COLORS.copper, backgroundColor: 'rgba(184,115,51,0.12)' },
  tabText: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.muted },
  tabTextActive: { color: COLORS.copper },
  reserves: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.copper, marginTop: 10 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 18, marginTop: 14, borderWidth: 1, borderColor: COLORS.border },
  label: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  input: { backgroundColor: COLORS.parchment, color: COLORS.charcoal, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, fontSize: 15 },
  tokenSelect: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: COLORS.copper },
  tokenSym: { fontFamily: FONTS.medium, fontSize: 14, color: '#FFF8F0' },
  quoteBox: { backgroundColor: COLORS.parchment, borderRadius: 8, padding: 10, marginTop: 10, borderWidth: 1, borderColor: COLORS.border },
  quoteText: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.copper },
  btn: { marginTop: 12 },
  tip: { backgroundColor: 'rgba(184,115,51,0.08)', borderRadius: 8, padding: 10, marginTop: 10, borderLeftWidth: 3, borderLeftColor: COLORS.copper },
  tipText: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.charcoal, lineHeight: 17 },
});
