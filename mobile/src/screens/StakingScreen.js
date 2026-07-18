import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { waychainRPC } from '../services/rpc';
import { wallet } from '../services/wallet';

// ── arg packing (WayChain SHA256 ABI: big-endian, no keccak) ──
const pad32 = (v) => {
  try { return BigInt(v).toString(16).padStart(64, '0'); } catch { return '0'.repeat(64); }
};
const pad20 = (addr20) => addr20.toLowerCase().replace(/^0x/, '').padStart(40, '0');

export default function StakingScreen({ navigation }) {
  const [account, setAccount] = useState(null);
  const [block, setBlock] = useState(null);
  const [loading, setLoading] = useState(true);

  // 2WAY vault section
  const [vault, setVault] = useState(null);        // {btc, debt} for current account
  const [vaultCount, setVaultCount] = useState(null);
  const [vaultBusy, setVaultBusy] = useState(false);
  const [depositAmt, setDepositAmt] = useState(''); // BTC amount (string)

  // WAY operator staking section
  const [opInfo, setOpInfo] = useState(null);       // {active, stakedWay}
  const [opCount, setOpCount] = useState(null);
  const [opBusy, setOpBusy] = useState(false);
  const [stakeAmt, setStakeAmt] = useState('');      // WAY amount (string)

  useEffect(() => {
    wallet.loadAccounts().then((a) => setAccount(a && a.length ? a[0] : null));
    waychainRPC.call('way_getBlockCount', []).then(r => setBlock(typeof r === 'string' ? parseInt(r, 16) : r)).catch(() => {});
  }, []);

  // addr20 = 20-byte display form of the Ed25519 pubkey (pub[0:40])
  const addr20 = account ? account.publicKey.slice(2, 42) : '';

  const refresh = useCallback(async () => {
    if (!account) { setLoading(false); return; }
    try {
      // 2WAY vault stats
      const vc = await waychainRPC.precompileCall('0x18', 'vaultCount', '', { write: false });
      setVaultCount(parseInt(vc, 16));
      // vault id derived from account (sha256 style) — read this account's vault if any
      const v = await waychainRPC.precompileCall('0x18', 'getVault', pad20(addr20), { write: false }).catch(() => null);
      if (v && v !== '0x' && v !== '0x0') setVault({ raw: v });
      // WAY operator staking
      const oc = await waychainRPC.precompileCall('0x17', 'getOperatorCount', '', { write: false }).catch(() => null);
      setOpCount(oc ? parseInt(oc, 16) : null);
      const oi = await waychainRPC.precompileCall('0x17', 'getOperatorInfo', pad20(addr20), { write: false }).catch(() => null);
      if (oi && oi !== '0x' && oi.length >= 4) {
        const active = parseInt(oi.slice(2, 4), 16);
        const stakedHex = '0x' + oi.slice(4); // joinedAt(8) + stakedWay(23)
        setOpInfo({ active, stakedWay: stakedHex });
      } else {
        setOpInfo(null);
      }
    } catch (e) {
      // non-fatal; sections render with whatever loaded
    } finally {
      setLoading(false);
    }
  }, [account, addr20]);

  useEffect(() => { if (account) refresh(); }, [refresh]);

  // ── 2WAY vault: open (deposit + mint) ──
  const openVault = async () => {
    if (!account) { Alert.alert('No wallet', 'Import your recovery phrase first.'); return; }
    if (!depositAmt || parseFloat(depositAmt) <= 0) { Alert.alert('Enter BTC amount', 'Amount must be > 0.'); return; }
    setVaultBusy(true);
    try {
      // vault id = sha256-style of account (use addr20 as the vault seed)
      const vaultId = pad32(BigInt('0x' + addr20.padStart(40, '0')).toString(16) || '1');
      const amtWei = pad32(BigInt(Math.round(parseFloat(depositAmt) * 1e8)).toString(16)); // BTC satoshis as wei-equivalent
      await waychainRPC.precompileCall('0x18', 'deposit', vaultId + pad32('0x0') /*btcProof placeholder*/ + amtWei, {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      await waychainRPC.precompileCall('0x18', 'mint', vaultId + amtWei, {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      Alert.alert('Vault opened', '2WAY vault created. Mint queued on-chain.');
      refresh();
    } catch (e) {
      Alert.alert('Vault open failed', e?.message || 'err');
    } finally { setVaultBusy(false); }
  };

  // ── WAY operator staking: registerOperator ──
  const stakeOperator = async () => {
    if (!account) { Alert.alert('No wallet', 'Import your recovery phrase first.'); return; }
    if (!stakeAmt || parseFloat(stakeAmt) <= 0) { Alert.alert('Enter WAY amount', 'Amount must be > 0.'); return; }
    setOpBusy(true);
    try {
      const amtWei = pad32(BigInt(Math.round(parseFloat(stakeAmt) * 1e18)).toString(16));
      await waychainRPC.precompileCall('0x17', 'registerOperator', amtWei, {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      Alert.alert('Staked', `Registered as WAY storage operator with ${stakeAmt} WAY.`);
      refresh();
    } catch (e) {
      Alert.alert('Stake failed', e?.message || 'err');
    } finally { setOpBusy(false); }
  };

  const unregisterOp = async () => {
    if (!account) return;
    setOpBusy(true);
    try {
      await waychainRPC.precompileCall('0x17', 'unregisterOperator', '', {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      Alert.alert('Unregistered', 'Operator stake released (inactive).');
      refresh();
    } catch (e) {
      Alert.alert('Unregister failed', e?.message || 'err');
    } finally { setOpBusy(false); }
  };

  if (!account) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        <BrandHeader subtitle="Stake" />
        <View style={styles.card}><Text style={styles.hint}>Import your recovery phrase to stake.</Text></View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Stake" />
      <View style={styles.statRow}>
        <View style={styles.stat}><Text style={styles.statLabel}>Network</Text><Text style={styles.statVal}>WayChain</Text></View>
        <View style={styles.stat}><Text style={styles.statLabel}>Block</Text><Text style={styles.statVal}>#{block ?? '—'}</Text></View>
        <View style={styles.stat}><Text style={styles.statLabel}>Chain ID</Text><Text style={styles.statVal}>10008</Text></View>
      </View>

      {loading && <ActivityIndicator color={COLORS.copper} style={{ marginTop: 24 }} />}

      {/* ── Section 1: 2WAY Vault ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2WAY Vault · Bitcoin-backed stablecoin</Text>
        <Text style={styles.sectionSub}>Open a vault, deposit BTC, mint 2WAY (precompile 0x18).</Text>
        <View style={styles.statInline}>
          <Text style={styles.k}>Active vaults</Text><Text style={styles.v}>{vaultCount ?? '—'}</Text>
        </View>
        {vault && (
          <View style={styles.statInline}>
            <Text style={styles.k}>Your vault</Text><Text style={styles.v}>{vault.raw.slice(0, 18)}…</Text>
          </View>
        )}
        <TextInput
          value={depositAmt} onChangeText={setDepositAmt}
          placeholder="BTC amount to deposit" placeholderTextColor={COLORS.muted}
          keyboardType="decimal-pad" style={styles.input}
        />
        <Button label={vaultBusy ? 'Opening…' : 'Open 2WAY Vault'} onPress={openVault} disabled={vaultBusy} style={styles.btn} />
      </View>

      {/* ── Section 2: WAY Operator Staking ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>WAY Operator Staking · StorageEndowment</Text>
        <Text style={styles.sectionSub}>Stake WAY to register as a storage operator (precompile 0x17).</Text>
        <View style={styles.statInline}>
          <Text style={styles.k}>Operators</Text><Text style={styles.v}>{opCount ?? '—'}</Text>
        </View>
        {opInfo && opInfo.active === 1 && (
          <View style={styles.statInline}>
            <Text style={styles.k}>Your stake</Text>
            <Text style={styles.v}>{opInfo.stakedWay === '0x' ? '0' : (Number(BigInt(opInfo.stakedWay)) / 1e18).toFixed(2) + ' WAY'}</Text>
          </View>
        )}
        <TextInput
          value={stakeAmt} onChangeText={setStakeAmt}
          placeholder="WAY amount to stake" placeholderTextColor={COLORS.muted}
          keyboardType="decimal-pad" style={styles.input}
        />
        {opInfo && opInfo.active === 1 ? (
          <Button label={opBusy ? '…' : 'Unregister Operator'} onPress={unregisterOp} disabled={opBusy} variant="secondary" style={styles.btn} />
        ) : (
          <Button label={opBusy ? 'Staking…' : 'Stake WAY (register)'} onPress={stakeOperator} disabled={opBusy} style={styles.btn} />
        )}
      </View>

      <Text style={styles.note}>
        Both sections call live WayChain precompiles (0x18 TwoWayVault, 0x17 StorageEndowment).
        Writes are real signed txs from your mnemonic. Reads reflect on-chain state.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  stat: { flex: 1, backgroundColor: COLORS.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  statLabel: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1 },
  statVal: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.copper, marginTop: 4 },
  section: { backgroundColor: COLORS.card, borderRadius: 14, padding: 18, marginTop: 16, borderWidth: 1, borderColor: COLORS.border },
  sectionTitle: { fontFamily: FONTS.display, fontSize: 17, color: COLORS.charcoal },
  sectionSub: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 4, lineHeight: 16 },
  statInline: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  k: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.muted },
  v: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.amber },
  input: { backgroundColor: COLORS.parchment, color: COLORS.charcoal, padding: 12, borderRadius: 10, marginTop: 10, borderWidth: 1, borderColor: COLORS.border, fontSize: 13 },
  btn: { marginTop: 12 },
  note: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, marginTop: 14, lineHeight: 16 },
  hint: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.muted },
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 18, marginTop: 14, borderWidth: 1, borderColor: COLORS.border },
});
