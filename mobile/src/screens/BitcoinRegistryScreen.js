import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { satsToUsd } from '../services/price';
import { wallet } from '../services/wallet';
import { waychainRPC } from '../services/rpc';
import {
  derivedVaultBTCAddress,
  buildDepositArgs,
  decodeVault,
  pad32,
  encodeUint256,
} from '../services/btcVault';

// Trustless 1WAY vault (issue #78 / PR #79). The vault's BTC wallet is DERIVED
// from the vault ID (sha256). The user sends REAL BTC to that address, then
// feeds the tx + the BTC amount they hold; the chain verifies (sha256 proof)
// and only then credits + mints 1WAY. No promise.
//
// Lock light (from getVault on 0x22):
//   OFF   = no BTC in vault
//   RED   = BTC present + 1WAY loan outstanding  ("DEBT")
//   GREEN = BTC present + loan repaid            ("1WAY")

function pad20(a) { return a.replace(/^0x/, '').toLowerCase().padStart(40, '0'); }

export default function BitcoinRegistryScreen({ navigation }) {
  const [account, setAccount] = useState(null);
  const [vaultId, setVaultId] = useState('');
  const [vaultAddr, setVaultAddr] = useState(''); // derived BTC address
  const [vault, setVault] = useState(null); // { btc, debt, light, label }
  const [hasVault, setHasVault] = useState(false);

  // Deposit proof inputs
  const [txid, setTxid] = useState('');
  const [outIndex, setOutIndex] = useState('0');
  const [btcHeld, setBtcHeld] = useState(''); // sats the user says the vault holds
  const [mintAmount, setMintAmount] = useState('');

  const [wdAmount, setWdAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');

  const loadAccount = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    setAccount(accs && accs.length ? accs[0] : null);
  }, []);
  useEffect(() => { loadAccount(); }, [loadAccount]);

  // Derive the vault ID + BTC address once we have an account.
  useEffect(() => {
    if (account && !vaultId) {
      const id = pad32(account.address);
      setVaultId(id);
      setVaultAddr(derivedVaultBTCAddress(id));
    }
  }, [account, vaultId]);

  const refreshVault = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const id = vaultId || pad32(account.address);
      const [has, v] = await Promise.allSettled([
        waychainRPC.precompileCall('0x22', 'getUserVault', ''),
        waychainRPC.precompileCall('0x22', 'getVault', id),
      ]);
      const hv = has.status === 'fulfilled' && has.value ? has.value : '0x0';
      setHasVault(BigInt(hv.replace(/^0x/, '') || '0') === 1n);
      if (v.status === 'fulfilled' && v.value) {
        setVault(decodeVault(v.value));
      }
    } catch {
      /* vault may not exist yet */
    } finally { setLoading(false); }
  }, [account, vaultId]);
  useEffect(() => { refreshVault(); }, [refreshVault]);

  const createVault = async () => {
    if (!account) { Alert.alert('No wallet', 'Create or import a wallet.'); return; }
    const id = (vaultId || pad32(account.address)).replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(id)) { Alert.alert('Invalid vault ID', 'Enter 32-byte (64 hex).'); return; }
    setBusy('Create');
    try {
      await waychainRPC.precompileCall('0x22', 'createVault', pad32(id), {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      // Vault's BTC wallet is now derived + ready to receive.
      setVaultAddr(derivedVaultBTCAddress(pad32(id)));
      Alert.alert('Vault created', 'Your BTC wallet address is now populated. Send BTC to it, then enter the amount + tx to verify.');
      refreshVault();
    } catch (e) {
      Alert.alert('Create failed', e?.message || 'Unknown error');
    } finally { setBusy(''); }
  };

  const deposit = async () => {
    if (!account) { Alert.alert('No wallet'); return; }
    const id = (vaultId || pad32(account.address)).replace(/^0x/, '');
    const t = txid.trim().replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(t)) { Alert.alert('Invalid txid', 'Enter the 32-byte (64 hex) BTC txid.'); return; }
    if (BigInt(btcHeld || '0') <= 0n) { Alert.alert('Enter BTC held', 'Enter how much BTC (sats) the vault holds.'); return; }
    const oi = BigInt(outIndex || '0');
    setBusy('Deposit');
    try {
      const args = buildDepositArgs(pad32(id), btcHeld, t, oi, vaultAddr);
      const res = await waychainRPC.precompileCall('0x22', 'depositBTC', args, {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      if (res && res.error) throw new Error(res.error.message || 'deposit rejected');
      Alert.alert('BTC verified', 'Tx: ' + ((res && res.txHash) || 'pending').slice(0, 20) + '…\nReal BTC arrival proven at your vault address. The light is now on.');
      refreshVault();
    } catch (e) {
      Alert.alert('Deposit rejected', e?.message || 'The proof did not match — BTC not credited (no promise).');
    } finally { setBusy(''); }
  };

  const mint = async () => {
    if (!account) { Alert.alert('No wallet'); return; }
    const id = (vaultId || pad32(account.address)).replace(/^0x/, '');
    const amt = mintAmount || btcHeld;
    if (BigInt(amt || '0') <= 0n) { Alert.alert('Enter mint amount', 'Enter sats worth of 1WAY to mint (or use BTC held).'); return; }
    setBusy('Mint');
    try {
      const res = await waychainRPC.precompileCall('0x22', 'mint1Way', pad32(id) + encodeUint256(amt), {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      Alert.alert('1WAY minted', 'Tx: ' + ((res && res.txHash) || 'pending').slice(0, 20) + '…\nVault is now LOCKED (DEBT). Repay to unlock.');
      refreshVault();
    } catch (e) {
      Alert.alert('Mint failed', e?.message || 'Unknown error');
    } finally { setBusy(''); }
  };

  const repay = async () => {
    if (!account) { Alert.alert('No wallet'); return; }
    const id = (vaultId || pad32(account.address)).replace(/^0x/, '');
    const amt = mintAmount || btcHeld;
    if (BigInt(amt || '0') <= 0n) { Alert.alert('Enter repay amount', 'Enter 1WAY to burn (repay loan).'); return; }
    setBusy('Repay');
    try {
      const res = await waychainRPC.precompileCall('0x22', 'burn1Way', pad32(id) + encodeUint256(amt), {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      Alert.alert('Loan repaid', 'Tx: ' + ((res && res.txHash) || 'pending').slice(0, 20) + '…\nVault UNLOCKED (1WAY).');
      refreshVault();
    } catch (e) {
      Alert.alert('Repay failed', e?.message || 'Unknown error');
    } finally { setBusy(''); }
  };

  const getWay = () => {
    Alert.alert('Get WAY', '1WAY is BTC-backed. To get WAY, swap 1WAY for WAY in the DEX.', [
      { text: 'Open DEX', onPress: () => navigation.navigate('SwapRoute') },
      { text: 'Later', style: 'cancel' },
    ]);
  };

  const lightColor = vault?.light === 'green' ? COLORS.copper
    : vault?.light === 'red' ? '#b00020'
    : COLORS.muted;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Bitcoin Bridge — 1WAY Vault" />

      {/* LOCK LIGHT */}
      <View style={[styles.lightCard, { borderColor: lightColor }]}>
        <View style={[styles.lightDot, { backgroundColor: lightColor }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.lightLabel}>
            {vault?.label ? vault.label : (vault && vault.btc > 0n ? '' : 'NO BTC')}
          </Text>
          <Text style={styles.lightSub}>
            {vault?.light === 'green' && 'BTC-backed 1WAY position — free'}
            {vault?.light === 'red' && '1WAY loan outstanding — BTC locked'}
            {(!vault || vault.btc === 0n) && 'Send BTC to your vault to begin'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Your vault BTC wallet</Text>
        <Text style={styles.addr}>{vaultAddr || '— create a vault to populate —'}</Text>
        {vaultAddr ? (
          <View style={styles.qrWrap}>
            <QRCode value={vaultAddr} size={148} color="#000000" backgroundColor="#FFFFFF" />
          </View>
        ) : null}
        <Text style={styles.hint}>Scan this with any BTC wallet to send REAL BTC. Address is derived from your vault ID (sha256).</Text>
        <Button label={busy === 'Create' ? 'Creating…' : (hasVault ? 'Vault exists' : 'Create Vault')}
          onPress={createVault} disabled={!!busy || hasVault} style={styles.btn} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Deposit BTC (verify arrival)</Text>
        <TextInput value={txid} onChangeText={setTxid} placeholder="BTC txid (32-byte hex)" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" />
        <TextInput value={outIndex} onChangeText={setOutIndex} placeholder="output index" placeholderTextColor={COLORS.muted} style={styles.input} keyboardType="decimal-pad" />
        <TextInput value={btcHeld} onChangeText={setBtcHeld} placeholder="BTC held by vault (sats)" placeholderTextColor={COLORS.muted} style={styles.input} keyboardType="decimal-pad" />
        {btcHeld ? <Text style={styles.usd}>≈ ${satsToUsd(btcHeld)}</Text> : null}
        <Text style={styles.hint}>Enter how much BTC the vault holds — the chain proves it matches real arrival. Mismatch = rejected.</Text>
        <Button label={busy === 'Deposit' ? 'Verifying…' : 'Verify & Deposit BTC'} onPress={deposit} disabled={!!busy} style={styles.btn} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Borrow / Repay 1WAY</Text>
        <TextInput value={mintAmount} onChangeText={setMintAmount} placeholder="amount (sats)" placeholderTextColor={COLORS.muted} style={styles.input} keyboardType="decimal-pad" />
        <Button label={busy === 'Mint' ? 'Minting…' : 'Mint 1WAY (LOCK -> DEBT)'} onPress={mint} disabled={!!busy} style={styles.btn} />
        <Button label={busy === 'Repay' ? 'Repaying…' : 'Repay 1WAY (UNLOCK -> 1WAY)'} onPress={repay} disabled={!!busy} variant="secondary" style={styles.btn} />
        <Button label="Get WAY (swap in DEX)" onPress={getWay} variant="secondary" style={styles.btn} />
      </View>

      <Text style={styles.note}>Trustless bridge: BTC is held in a WayChain-derived vault wallet with safety rules. A deposit is only credited with a sha256 proof of real BTC arrival — no promise, no trusting an unknown party. Red = DEBT (loan), Green = 1WAY (free).</Text>

      {loading && <ActivityIndicator color={COLORS.copper} style={{ marginTop: 12 }} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  lightCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginTop: 14, borderWidth: 2 },
  lightDot: { width: 18, height: 18, borderRadius: 9, marginRight: 12 },
  lightLabel: { fontFamily: FONTS.bold, fontSize: 22, color: COLORS.charcoal, letterSpacing: 1 },
  lightSub: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 2 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 18, marginTop: 14, borderWidth: 1, borderColor: COLORS.border },
  label: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 },
  addr: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.copper, marginTop: 6, flexWrap: 'wrap' },
  qrWrap: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, padding: 10, marginTop: 10, alignSelf: 'flex-start' },
  input: { backgroundColor: COLORS.parchment, color: COLORS.charcoal, padding: 12, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: COLORS.border, fontSize: 13 },
  btn: { marginTop: 12 },
  hint: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 6, marginBottom: 4 },
  usd: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.copper, marginTop: 4 },
  note: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, marginTop: 14, lineHeight: 16 },
});
