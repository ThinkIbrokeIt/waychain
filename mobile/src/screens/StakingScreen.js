// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { waychainRPC } from '../services/rpc';
import { wallet } from '../services/wallet';
import { VALIDATOR_CONSTANTS } from '../services/consensus-constants';

// ── arg packing (WayChain SHA256 ABI: big-endian, no keccak) ──
const pad32 = (v) => {
  try { return BigInt(v).toString(16).padStart(64, '0'); } catch { return '0'.repeat(64); }
};
const pad20 = (addr20) => addr20.toLowerCase().replace(/^0x/, '').padStart(40, '0');
const fmtWay = (hexOrNum) => {
  try {
    const wei = typeof hexOrNum === 'string' ? BigInt(hexOrNum) : BigInt(hexOrNum);
    return (Number(wei) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 });
  } catch { return '0'; }
};

export default function StakingScreen({ navigation }) {
  const [account, setAccount] = useState(null);
  const [block, setBlock] = useState(null);
  const [loading, setLoading] = useState(true);

  // Read-only network-security context (live + protocol constants)
  const [validatorCount, setValidatorCount] = useState(null); // LIVE: way_validatorCount
  const [opCount, setOpCount] = useState(null);               // LIVE: 0x17 getOperatorCount (storage operators)
  const [opInfo, setOpInfo] = useState(null);                 // { active, stakedWay } for this account

  // WAY staking action (0x17 StorageEndowment)
  const [stakeAmt, setStakeAmt] = useState('');
  const [opBusy, setOpBusy] = useState(false);

  useEffect(() => {
    wallet.loadAccounts().then((a) => setAccount(a && a.length ? a[0] : null));
    waychainRPC.call('way_getBlockCount', []).then(r => setBlock(typeof r === 'string' ? parseInt(r, 16) : r)).catch(() => {});
  }, []);

  const addr20 = account ? account.publicKey.slice(2, 42) : '';

  const refresh = useCallback(async () => {
    if (!account) { setLoading(false); return; }
    try {
      // LIVE read-only: how many validators are securing the network right now
      const vc = await waychainRPC.call('way_validatorCount', []).catch(() => null);
      setValidatorCount(vc != null ? parseInt(vc, 10) : null);
      // LIVE read-only: community storage operators (0x17)
      const oc = await waychainRPC.precompileCall('0x17', 'getOperatorCount', '', { write: false }).catch(() => null);
      setOpCount(oc ? parseInt(oc, 16) : null);
      // This account's stake position (0x17)
      const oi = await waychainRPC.precompileCall('0x17', 'getOperatorInfo', pad20(addr20), { write: false }).catch(() => null);
      if (oi && oi !== '0x' && oi.length >= 4) {
        const active = parseInt(oi.slice(2, 4), 16);
        const stakedHex = '0x' + oi.slice(4);
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

  // ── WAY staking: registerOperator (0x17) ──
  const stakeOperator = async () => {
    if (!account) { Alert.alert('No wallet', 'Import your recovery phrase first.'); return; }
    if (!stakeAmt || parseFloat(stakeAmt) <= 0) { Alert.alert('Enter WAY amount', 'Amount must be > 0.'); return; }
    setOpBusy(true);
    try {
      const amtWei = pad32(BigInt(Math.round(parseFloat(stakeAmt) * 1e18)).toString(16));
      await waychainRPC.precompileCall('0x17', 'registerOperator', amtWei, {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      Alert.alert('Staked', `Staked ${stakeAmt} WAY to help secure the network.`);
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
      Alert.alert('Unregistered', 'Your WAY stake is released (no longer securing a position).');
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

      {/* ── Network Security (read-only context) ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Network Security</Text>
        <Text style={styles.sectionSub}>Stakes are how we secure the network. Validators bond WAY; thresholds must be met to join the active set, and bonds cover other positions if a validator misbehaves.</Text>
        <View style={styles.statInline}>
          <Text style={styles.k}>Validators securing now</Text>
          <Text style={styles.v}>{validatorCount != null ? `${validatorCount} / ${VALIDATOR_CONSTANTS.maxValidators}` : '—'}</Text>
        </View>
        <View style={styles.statInline}>
          <Text style={styles.k}>Min stake to be a validator</Text>
          <Text style={styles.v}>{VALIDATOR_CONSTANTS.minValidatorStake.toLocaleString()} WAY</Text>
        </View>
        <View style={styles.statInline}>
          <Text style={styles.k}>Missed-block jail threshold</Text>
          <Text style={styles.v}>{VALIDATOR_CONSTANTS.jailThresholdBlocks} blocks</Text>
        </View>
        <View style={styles.statInline}>
          <Text style={styles.k}>Community storage operators</Text>
          <Text style={styles.v}>{opCount != null ? opCount : '—'}</Text>
        </View>
        <Text style={styles.note}>Validator thresholds are protocol constants (consensus/consensus.go, validators.go). The live validator count is read from the node (way_validatorCount).</Text>
      </View>

      {/* ── Your WAY stake (action via 0x17 StorageEndowment) ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your WAY Stake</Text>
        <Text style={styles.sectionSub}>Stake WAY to take a secured position in the network (precompile 0x17, StorageEndowment).</Text>
        {opInfo && opInfo.active === 1 && (
          <View style={styles.statInline}>
            <Text style={styles.k}>Your staked position</Text>
            <Text style={styles.v}>{fmtWay(opInfo.stakedWay)} WAY</Text>
          </View>
        )}
        <TextInput
          value={stakeAmt}
          onChangeText={setStakeAmt}
          placeholder="WAY amount to stake"
          placeholderTextColor={COLORS.muted}
          keyboardType="decimal-pad"
          style={styles.input}
        />
        {opInfo && opInfo.active === 1 ? (
          <Button label={opBusy ? '…' : 'Unstake (release)'}
            onPress={unregisterOp} disabled={opBusy} variant="secondary" style={styles.btn} />
        ) : (
          <Button label={opBusy ? 'Staking…' : 'Stake WAY'}
            onPress={stakeOperator} disabled={opBusy} style={styles.btn} />
        )}
      </View>

      <Text style={styles.note}>
        Staking calls the live WayChain precompile 0x17. Writes are real signed txs from your
        mnemonic. The 2WAY Bitcoin-backed vault has its own tab — this screen is WAY-only.
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
