import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';

// Token registry (from waychain.org DEX + chain source)
const TOKENS = {
  WAY: '0x0000000000000000000000000000000000000001',
  BIJO: '0x0000000000000000000000000000000000000014',
  '1WAY': '0x0000000000000000000000000000000000000022',
  SWAY: '0x0000000000000000000000000000000000000024',
  '2WAY': '0x0000000000000000000000000000000000000018',
};

export default function DEXScreen() {
  const [tokenIn, setTokenIn] = useState('WAY');
  const [tokenOut, setTokenOut] = useState('BIJO');
  const [amountIn, setAmountIn] = useState('10');
  const [liqA, setLiqA] = useState('WAY');
  const [liqB, setLiqB] = useState('BIJO');
  const [amtA, setAmtA] = useState('100');
  const [amtB, setAmtB] = useState('50');
  const [swapMsg, setSwapMsg] = useState(null);
  const [liqMsg, setLiqMsg] = useState(null);

  const flip = () => { const t = tokenIn; setTokenIn(tokenOut); setTokenOut(t); };

  const onSwap = () => {
    if (!amountIn || Number(amountIn) <= 0) { setSwapMsg({ t: 'Enter an amount', k: 'bad' }); return; }
    setSwapMsg({ t: `Swap ${amountIn} ${tokenIn} → ${tokenOut}. Route: WayChain DEX (0x25). Sign in Wallet to broadcast.`, k: 'info' });
  };
  const onLiq = () => {
    if (!amtA || !amtB || Number(amtA) <= 0 || Number(amtB) <= 0) { setLiqMsg({ t: 'Enter both amounts', k: 'bad' }); return; }
    setLiqMsg({ t: `Add ${amtA} ${liqA} + ${amtB} ${liqB} to the pool. First deposit creates the pair; approve both tokens, then broadcast.`, k: 'info' });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="DEX" tagline="1-second settlement · Identity-gated · Truth-anchored" />

      {/* SWAP */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Swap Tokens</Text>
        <TokenRow label="From" token={tokenIn} setToken={setTokenIn} amount={amountIn} setAmount={setAmountIn} />
        <TouchableOpacity style={styles.flip} onPress={flip}>
          <Text style={styles.flipText}>⇅</Text>
        </TouchableOpacity>
        <TokenRow label="To" token={tokenOut} setToken={setTokenOut} editable={false} />
        <TouchableOpacity style={styles.launch} onPress={onSwap}>
          <Text style={styles.launchText}>Launch Swap</Text>
        </TouchableOpacity>
        {swapMsg ? <Text style={[styles.status, styles[swapMsg.k]]}>{swapMsg.t}</Text> : null}
      </View>

      {/* ADD LIQUIDITY — distinct from swap */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add Liquidity</Text>
        <Text style={styles.note}>Provide both sides of a pool. First deposit mints the pair; later deposits add to it.</Text>
        <TokenRow label="Token A" token={liqA} setToken={setLiqA} amount={amtA} setAmount={setAmtA} />
        <TokenRow label="Token B" token={liqB} setToken={setLiqB} amount={amtB} setAmount={setAmtB} />
        <TouchableOpacity style={styles.launch} onPress={onLiq}>
          <Text style={styles.launchText}>Add Liquidity</Text>
        </TouchableOpacity>
        {liqMsg ? <Text style={[styles.status, styles[liqMsg.k]]}>{liqMsg.t}</Text> : null}
      </View>

      <Text style={styles.footer}>WayChain DEX · Chain ID 10008 · Settlement in ~1s</Text>
    </ScrollView>
  );
}

function TokenRow({ label, token, setToken, amount, setAmount, editable = true }) {
  const isNum = !!setAmount;
  return (
    <View style={styles.row}>
      <View style={styles.rowLabel}><Text style={styles.rowLabelText}>{label}</Text></View>
      <View style={styles.rowBody}>
        {isNum ? (
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.0"
            placeholderTextColor={COLORS.muted}
            keyboardType="decimal-pad"
          />
        ) : (
          <Text style={styles.staticTok}>{TOKENS[token] ? token : token}</Text>
        )}
        <View style={styles.picker}>
          {Object.keys(TOKENS).map((tk) => (
            <TouchableOpacity
              key={tk}
              style={[styles.chip, token === tk && styles.chipActive]}
              onPress={() => setToken && setToken(tk)}
            >
              <Text style={[styles.chipText, token === tk && styles.chipTextActive]}>{tk}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, padding: 16, paddingBottom: 40 },
  card: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 18, marginTop: 14 },
  cardTitle: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.copper, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 },
  note: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginBottom: 12, lineHeight: 18 },
  row: { marginBottom: 10 },
  rowLabel: { marginBottom: 4 },
  rowLabelText: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1 },
  rowBody: { backgroundColor: COLORS.parchment, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12 },
  input: { fontFamily: FONTS.bold, fontSize: 22, color: COLORS.charcoal, marginBottom: 10 },
  staticTok: { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.charcoal, marginBottom: 10 },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { borderColor: COLORS.copper, backgroundColor: 'rgba(184,115,51,0.18)' },
  chipText: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.muted },
  chipTextActive: { color: COLORS.copper },
  flip: { alignSelf: 'center', marginVertical: 6 },
  flipText: { fontFamily: FONTS.bold, fontSize: 22, color: COLORS.copper },
  launch: { backgroundColor: COLORS.copper, borderRadius: 10, paddingVertical: 14, marginTop: 6 },
  launchText: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.warm, textAlign: 'center' },
  status: { fontFamily: FONTS.body, fontSize: 12, padding: 12, borderRadius: 8, marginTop: 10, lineHeight: 18 },
  info: { backgroundColor: 'rgba(184,115,51,0.12)', color: COLORS.copper, borderWidth: 1, borderColor: COLORS.copper },
  bad: { backgroundColor: 'rgba(229,57,53,0.12)', color: COLORS.red, borderWidth: 1, borderColor: COLORS.red },
  footer: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, textAlign: 'center', marginTop: 18 },
});
