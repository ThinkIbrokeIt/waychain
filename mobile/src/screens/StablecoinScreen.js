import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { wallet } from '../services/wallet';
import { waychainRPC } from '../services/rpc';

// 1WAY Stablecoin vault (precompile 0x22).
// Real flow (way_stablecoin.go):
//   createVault(bytes32 vaultID)  — caller must be Dox_Dev L2+ (governance gate)
//   depositBTC(bytes32 vaultID, uint256 satoshis)
//   mint1Way(bytes32 vaultID)     — mints 70% of BTC value as 1WAY
//   getTotalSupply()              — total 1WAY in circulation
//   getPrice()                    — BTC/USD price (oracle-set, $68k default)
// NOTE: depositBTC is a trusted satoshi counter (no real on-chain BTC proof in
// this precompile) — it proves the vault/mint mechanics, not custody.
//
// Priority quest: getting value onto WayChain. Requires Dox_Dev L2 first.

function vaultIDFromPub(pub64) {
  // Derive a deterministic 32-byte vaultID from the user's 64-hex pubkey.
  const clean = pub64.replace(/^0x/, '');
  const pad = clean.length >= 64 ? clean.slice(0, 64) : clean.padEnd(64, '0');
  return pad;
}

export default function StablecoinScreen({ navigation }) {
  const [account, setAccount] = useState(null);
  const [doxLevel, setDoxLevel] = useState(0);
  const [hasVault, setHasVault] = useState(false);
  const [totalSupply, setTotalSupply] = useState(null);
  const [price, setPrice] = useState(null);
  const [deposit, setDeposit] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const vid = account ? vaultIDFromPub(account.publicKey) : '';

  const loadAccount = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    setAccount(accs && accs.length ? accs[0] : null);
  }, []);

  const fetchState = useCallback(async () => {
    setLoading(true);
    try {
      const [ts, pr] = await Promise.all([
        waychainRPC.precompileCall('0x22', 'getTotalSupply', ''),
        waychainRPC.precompileCall('0x22', 'getPrice', ''),
      ]);
      setTotalSupply(ts);
      setPrice(pr);
      if (account) {
        const vaultHex = account.address.replace(/^0x/, '').padStart(64, '0');
        const v = await waychainRPC.precompileCall('0x22', 'getUserVault', vaultHex);
        setHasVault(v && v !== '0x' && v.replace(/^0x/, '').replace(/0/g, '') !== '');
      }
    } catch {
      setTotalSupply('0x0');
      setPrice(null);
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => { loadAccount(); }, [loadAccount]);
  useEffect(() => { if (account) fetchState(); else setLoading(false); }, [account, fetchState]);

  const createVault = async () => {
    if (!account) return;
    setBusy(true);
    try {
      await waychainRPC.precompileCall('0x22', 'createVault', vid, {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      setHasVault(true);
      Alert.alert('Vault created', 'Now deposit test BTC and mint 1WAY.');
      fetchState();
    } catch (e) {
      Alert.alert('Failed', e?.message || 'Need Dox_Dev Level 2+ to create a vault.');
    } finally {
      setBusy(false);
    }
  };

  const depositBTC = async () => {
    if (!account || !deposit) return;
    setBusy(true);
    try {
      const amt = (BigInt(deposit) * 10n ** 8n).toString(16).padStart(64, '0'); // satoshis
      await waychainRPC.precompileCall('0x22', 'depositBTC', vid + amt, {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      Alert.alert('Deposited', `${deposit} BTC (test) added to vault.`);
      fetchState();
    } catch (e) {
      Alert.alert('Failed', e?.message || 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const mint1Way = async () => {
    if (!account) return;
    setBusy(true);
    try {
      const res = await waychainRPC.precompileCall('0x22', 'mint1Way', vid, {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      Alert.alert('Minted', '1WAY minted to your balance.\n' + ((res && res.slice) ? res.slice(0, 20) : 'done'));
      fetchState();
    } catch (e) {
      Alert.alert('Failed', e?.message || 'Deposit BTC first.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="1WAY Stablecoin" />

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Total 1WAY Supply</Text>
        <Text style={styles.heroVal}>{loading ? '—' : formatWei(totalSupply)}</Text>
        <Text style={styles.heroNote}>Bitcoin-backed. Mint 1WAY by depositing BTC into a vault.</Text>
      </View>

      {!account ? (
        <View style={styles.warnBox}>
          <Text style={styles.warnText}>No wallet found. Create or import a wallet.</Text>
        </View>
      ) : (
        <View style={styles.panel}>
          {hasVault ? (
            <>
              <Text style={styles.ok}>✓ Vault active</Text>
              <Text style={styles.fieldLabel}>Deposit BTC (test satoshis amount)</Text>
              <TextInputVal value={deposit} onChange={setDeposit} placeholder="0.001" />
              <Button label={busy ? 'Working…' : 'Deposit BTC'} onPress={depositBTC} disabled={busy} style={styles.btn} />
              <Button label="Mint 1WAY" onPress={mint1Way} disabled={busy} style={styles.btn} />
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>Create a vault to mint 1WAY.</Text>
              <Text style={styles.note}>Requires Dox_Dev Level 2+ (earn it via the Quests → DoxDev Badge task).</Text>
              <Button label={busy ? 'Creating…' : 'Create Vault'} onPress={createVault} disabled={busy} style={styles.btn} />
            </>
          )}
          {price && (
            <Text style={styles.price}>BTC/USD: ${formatWei(price)}</Text>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function formatWei(hex) {
  if (!hex || hex === '0x' || hex === '0x0') return '0';
  try {
    const v = BigInt(hex);
    const whole = v / 10n ** 18n;
    return whole.toString();
  } catch { return String(hex); }
}

// Lightweight inline text input (avoids extra import churn).
import { TextInput } from 'react-native';
function TextInputVal({ value, onChange, placeholder }) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={COLORS.muted}
      keyboardType="decimal-pad"
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  hero: { backgroundColor: COLORS.card, borderRadius: 16, padding: 22, marginTop: 8, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  heroLabel: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 2 },
  heroVal: { fontFamily: FONTS.display, fontSize: 30, color: COLORS.copper, marginTop: 6 },
  heroNote: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 10, textAlign: 'center', lineHeight: 18 },
  panel: { backgroundColor: COLORS.card, borderRadius: 14, padding: 18, marginTop: 16, borderWidth: 1, borderColor: COLORS.border },
  ok: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.copper, marginBottom: 12 },
  fieldLabel: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.charcoal, marginBottom: 8 },
  note: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginBottom: 12, lineHeight: 18 },
  input: { backgroundColor: COLORS.parchment, borderRadius: 10, padding: 12, fontFamily: FONTS.body, fontSize: 15, color: COLORS.charcoal, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  btn: { marginTop: 8 },
  price: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.amber, marginTop: 12, textAlign: 'center' },
  warnBox: { backgroundColor: 'rgba(229,57,53,0.10)', borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: COLORS.red },
  warnText: { fontFamily: FONTS.body, fontSize: 13, color: '#FF8A80', textAlign: 'center' },
  back: { marginTop: 18, alignItems: 'center' },
  backText: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.copper },
});
