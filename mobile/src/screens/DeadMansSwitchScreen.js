import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { wallet } from '../services/wallet';
import { waychainRPC } from '../services/rpc';

// DeadMansSwitch precompile 0x15 (verified vs evm/precompiles.go inline impl):
//   createSwitch(uint8 truthType, address heir, uint64 interval, bytes32 keyRef) sel 0x7F78EDCF (write)
//     calldata: truthType[1] + heir[20] + interval[8] + keyRef[32] (after 4-byte sel)
//   heartbeat(uint64)   sel 0x7018B39E (write) — id[8]
//   claim(uint64)       sel 0x40FADB8B (write) — id[8]
//   cancel(uint64)      sel 0x26C1497E (write) — id[8]
//   canClaim(uint64)    sel 0xA688A635 (read)  — id[8]
// Interval must be 86400..31536000 (1 day..1 yr). Returns switch ID as uint64.

function pad20(a) { return a.replace(/^0x/, '').toLowerCase().padStart(40, '0'); }
function pad8(n) { try { return BigInt(n).toString(16).padStart(16, '0'); } catch { return '0'.repeat(16); } }
function pad32(h) { return h.replace(/^0x/, '').padStart(64, '0'); }

export default function DeadMansSwitchScreen() {
  const [account, setAccount] = useState(null);
  const [truthType, setTruthType] = useState('1');
  const [heir, setHeir] = useState('');
  const [interval, setInterval] = useState('86400');
  const [keyRef, setKeyRef] = useState('');
  const [switchId, setSwitchId] = useState('');
  const [canClaim, setCanClaim] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');

  const loadAccount = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    setAccount(accs && accs.length ? accs[0] : null);
  }, []);
  useEffect(() => { loadAccount(); }, [loadAccount]);

  const checkCanClaim = async () => {
    const id = BigInt(switchId || '0');
    if (id <= 0n) { Alert.alert('Need switch ID', 'Enter a switch ID to check.'); return; }
    setLoading(true);
    try {
      const r = await waychainRPC.precompileCall('0x15', 'canClaim', pad8(switchId));
      setCanClaim(r);
    } catch (e) { setCanClaim('err'); }
    finally { setLoading(false); }
  };

  const write = async (label, args) => {
    if (!account) { Alert.alert('No wallet', 'Create or import a wallet.'); return; }
    setBusy(label);
    try {
      const res = await waychainRPC.precompileCall('0x15', label.toLowerCase(), args, {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      const tx = ((res && res.txHash) || 'pending').slice(0, 20);
      if (label === 'CreateSwitch') {
        const id = res && res.result ? res.result : '';
        setSwitchId(id);
        Alert.alert('Switch created', 'ID: ' + id + '\nTx: ' + tx);
      } else {
        Alert.alert(label + ' submitted', 'Tx: ' + tx);
      }
    } catch (e) { Alert.alert(label + ' failed', e?.message || 'Unknown error'); }
    finally { setBusy(''); }
  };

  const create = () => {
    const h = heir.trim().replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{40}$/.test(h)) { Alert.alert('Invalid heir', 'Heir must be a 20-byte (40 hex) address.'); return; }
    const iv = parseInt(interval, 10);
    if (iv < 86400 || iv > 31536000) { Alert.alert('Invalid interval', 'Must be 86400..31536000 (1 day..1 yr) blocks.'); return; }
    const kr = keyRef.trim() || '0'.repeat(64);
    if (!/^[0-9a-fA-F]{64}$/.test(kr.replace(/^0x/, ''))) { Alert.alert('Invalid keyRef', 'keyRef must be 32-byte hex.'); return; }
    write('CreateSwitch',
      String(truthType === '1' ? 1 : 0) +          // uint8 truthType
      pad20(h) +                                     // address heir (20)
      pad8(interval) +                               // uint64 interval (8)
      pad32(kr));                                    // bytes32 keyRef (32)
  };
  const heartbeat = () => write('Heartbeat', pad8(switchId));
  const claim = () => write('Claim', pad8(switchId));
  const cancel = () => write('Cancel', pad8(switchId));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Dead Man's Switch" />

      <View style={styles.card}>
        <Text style={styles.label}>Create switch</Text>
        <TextInput value={truthType} onChangeText={setTruthType} placeholder="truthType (0/1)" placeholderTextColor={COLORS.muted} style={styles.input} keyboardType="decimal-pad" />
        <TextInput value={heir} onChangeText={setHeir} placeholder="heir addr (20-byte)" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" />
        <TextInput value={interval} onChangeText={setInterval} placeholder="interval (86400..31536000)" placeholderTextColor={COLORS.muted} style={styles.input} keyboardType="decimal-pad" />
        <TextInput value={keyRef} onChangeText={setKeyRef} placeholder="keyRef (32-byte hex, optional)" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" />
        <Button label={busy === 'CreateSwitch' ? 'Creating…' : 'Create Switch'} onPress={create} disabled={!!busy} style={styles.btn} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Switch ID (uint64)</Text>
        <TextInput value={switchId} onChangeText={setSwitchId} placeholder="e.g. 1" placeholderTextColor={COLORS.muted} style={styles.input} keyboardType="decimal-pad" />
        <View style={styles.actions}>
          <Button label={busy === 'Heartbeat' ? '…' : 'Heartbeat'} onPress={heartbeat} disabled={!!busy || !switchId} variant="secondary" style={styles.actBtn} />
          <Button label={busy === 'Claim' ? '…' : 'Claim'} onPress={claim} disabled={!!busy || !switchId} variant="secondary" style={styles.actBtn} />
          <Button label={busy === 'Cancel' ? '…' : 'Cancel'} onPress={cancel} disabled={!!busy || !switchId} variant="secondary" style={styles.actBtn} />
        </View>
        <Button label="Check canClaim" onPress={checkCanClaim} disabled={loading || !switchId} style={styles.btn} />
        {canClaim != null && <Text style={styles.res}>canClaim: {String(canClaim)}</Text>}
      </View>

      <Text style={styles.note}>DeadMansSwitch (0x15): truth-disclosure heir switch. Selectors verified vs evm/precompiles.go. Interval clamped 1 day..1 yr. createSwitch returns the new switch ID.</Text>
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
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actBtn: { flex: 1 },
  res: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.copper, marginTop: 8 },
  note: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, marginTop: 14, lineHeight: 16 },
});
