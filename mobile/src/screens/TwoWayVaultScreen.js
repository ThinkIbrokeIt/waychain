import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { wallet } from '../services/wallet';
import { waychainRPC } from '../services/rpc';

// TwoWayVault precompile 0x18 (verified vs evm/two_way.go, selectors from source):
//   deposit(bytes32,bytes20,uint256) sel 0xFBB35030 (write) — vaultId[32] + stablecoin[20 ASCII] + amount[32]
//   mint(bytes32,uint256)           sel 0xD185E07F (write) — vaultId[32] + amount[32]
//   withdraw(bytes32,bytes20,uint256) sel 0xE9C4B112 (write) — vaultId[32] + stablecoin[20] + amount[32]
//   burn(bytes32,uint256)           sel 0x0E0C59BE (write) — vaultId[32] + amount[32]
//   liquidate(bytes32)              sel 0x5C8B7698 (write) — vaultId[32]
// NOTE: two_way.go has NO read selector (default errors on unknown). Vault state is
// observable via on-chain logs / storage; this screen drives the real write ops and
// shows the last tx result honestly. 2WAY balance is minted here; read via token
// registry when exposed (#68 follow-up).

const SYMBOLS = ['USDC', 'USDT', 'DAI', '1WAY']; // accepted collateral (isAcceptedCollateral)

function pad32(h) { return h.replace(/^0x/, '').padStart(64, '0'); }
function encodeUint256(v) {
  try { return BigInt(v).toString(16).padStart(64, '0'); }
  catch { return '0'.repeat(64); }
}
// stablecoin = 20-byte buffer, symbol ASCII left-aligned (trimRightZeros on chain)
function encodeSymbol(sym) {
  const buf = new Uint8Array(20);
  const ascii = sym.slice(0, 20);
  for (let i = 0; i < ascii.length; i++) buf[i] = ascii.charCodeAt(i);
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}
function defaultVaultId(address) { return pad32(address); } // one vault per address

export default function TwoWayVaultScreen() {
  const [account, setAccount] = useState(null);
  const [vaultId, setVaultId] = useState('');
  const [symbol, setSymbol] = useState(SYMBOLS[0]);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [last, setLast] = useState(null);

  const loadAccount = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    const acc = accs && accs.length ? accs[0] : null;
    setAccount(acc);
    if (acc) setVaultId(defaultVaultId(acc.address));
  }, []);
  useEffect(() => { loadAccount(); }, [loadAccount]);

  const write = async (label, buildArgs) => {
    if (!account) { Alert.alert('No wallet', 'Create or import a wallet to transact.'); return; }
    const id = vaultId.trim().replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(id)) { Alert.alert('Invalid vault ID', 'Enter a 32-byte (64 hex) vault ID.'); return; }
    const amt = encodeUint256(amount || '0');
    if (BigInt(amount || '0') <= 0n) { Alert.alert('Enter an amount', 'Amount must be greater than 0.'); return; }
    setBusy(label);
    try {
      const args = buildArgs(id, amt);
      const res = await waychainRPC.precompileCall('0x18', label.toLowerCase(), args, {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      setLast({ label, tx: ((res && res.txHash) || 'pending').slice(0, 20) });
      Alert.alert(label + ' submitted', 'Tx: ' + ((res && res.txHash) || 'pending').slice(0, 20) + '…');
    } catch (e) {
      setLast({ label, err: e?.message || 'Unknown error' });
      Alert.alert(label + ' failed', e?.message || 'Unknown error');
    } finally {
      setBusy('');
    }
  };

  const deposit = () => write('Deposit', (id, amt) => pad32(id) + encodeSymbol(symbol) + amt);
  const mint = () => write('Mint', (id, amt) => pad32(id) + amt);
  const withdraw = () => write('Withdraw', (id, amt) => pad32(id) + encodeSymbol(symbol) + amt);
  const burn = () => write('Burn', (id, amt) => pad32(id) + amt);
  const liquidate = () => {
    const id = vaultId.trim().replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(id)) { Alert.alert('Invalid vault ID', 'Enter a 32-byte (64 hex) vault ID.'); return; }
    setBusy('Liquidate');
    waychainRPC.precompileCall('0x18', 'liquidate', pad32(id), {
      write: true, privHex: account?.privateKey, pub64: account?.publicKey,
    }).then(res => setLast({ label: 'Liquidate', tx: ((res && res.txHash) || 'pending').slice(0, 20) }))
      .catch(e => setLast({ label: 'Liquidate', err: e?.message }))
      .finally(() => setBusy(''));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="TwoWay Vault" />

      <View style={styles.card}>
        <Text style={styles.label}>Vault ID (32-byte hex)</Text>
        <TextInput value={vaultId} onChangeText={setVaultId} placeholder="0x… 64 hex (default = your address)" placeholderTextColor={COLORS.muted}
          style={styles.input} autoCapitalize="none" />

        <Text style={styles.label}>Collateral symbol</Text>
        <View style={styles.symbolRow}>
          {SYMBOLS.map(s => (
            <TouchableOpacity key={s} style={[styles.symBtn, symbol === s && styles.symActive]} onPress={() => setSymbol(s)}>
              <Text style={[styles.symTxt, symbol === s && styles.symTxtActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Amount (18 decimals)</Text>
        <TextInput value={amount} onChangeText={setAmount} placeholder="e.g. 1000000000000000000" placeholderTextColor={COLORS.muted}
          style={styles.input} keyboardType="decimal-pad" />

        <View style={styles.actions}>
          <Button label={busy === 'Deposit' ? '…' : 'Deposit'} onPress={deposit} disabled={!!busy} variant="secondary" style={styles.actBtn} />
          <Button label={busy === 'Mint' ? '…' : 'Mint 2WAY'} onPress={mint} disabled={!!busy} variant="secondary" style={styles.actBtn} />
        </View>
        <View style={styles.actions}>
          <Button label={busy === 'Withdraw' ? '…' : 'Withdraw'} onPress={withdraw} disabled={!!busy} variant="secondary" style={styles.actBtn} />
          <Button label={busy === 'Burn' ? '…' : 'Burn 2WAY'} onPress={burn} disabled={!!busy} variant="secondary" style={styles.actBtn} />
        </View>
        <Button label={busy === 'Liquidate' ? 'Liquidating…' : 'Liquidate Vault'} onPress={liquidate} disabled={!!busy || !account} style={styles.liqBtn} />
      </View>

      {last && (
        <View style={styles.result}>
          <Text style={styles.resLabel}>{last.label}</Text>
          {last.err
            ? <Text style={styles.resErr}>{last.err}</Text>
            : <Text style={styles.resTx}>Tx: {last.tx}…</Text>}
        </View>
      )}

      <Text style={styles.note}>TwoWayVault (0x18): deposit stablecoins, mint/burn 2WAY synthetic USD against collateral. Selectors verified vs evm/two_way.go. Vault read state is via chain logs (no read selector yet); last tx result shown above. Collateral symbols accepted on-chain: USDC/USDT/DAI/1WAY.</Text>

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
  symbolRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  symBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.parchment },
  symActive: { backgroundColor: COLORS.copper, borderColor: COLORS.copper },
  symTxt: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.charcoal },
  symTxtActive: { color: COLORS.parchment },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  actBtn: { flex: 1 },
  liqBtn: { marginTop: 14 },
  result: { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginTop: 14, borderWidth: 1, borderColor: COLORS.border },
  resLabel: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.charcoal, textTransform: 'capitalize' },
  resTx: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.copper, marginTop: 4 },
  resErr: { fontFamily: FONTS.body, fontSize: 12, color: '#FF8A80', marginTop: 4 },
  note: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, marginTop: 14, lineHeight: 16 },
});
