import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { wallet } from '../services/wallet';
import { waychainRPC } from '../services/rpc';

// MineralRightsRegistry precompile 0x20 (verified vs evm/mineral_rights.go):
//   registerClaim(bytes32 deedHash, bytes32 gpsHash, bytes32 owner) sel 0xA1B2C3D4 (write)
//     owner is left-aligned ASCII (empty => caller). Requires Dox_Dev L2+.
//   verifyClaim(bytes32,bytes32,uint8) sel 0xB2C3D4E5 (write)
//   approveReserve(bytes32,bytes32,uint256) sel 0xC3D4E5A6 (write)
//   issueTokens(bytes32) sel 0xD4E5A6B7 (write)
//   getClaim(bytes32) sel 0xE5A6B7C8 (read)
//   getTokens(bytes32,address) sel 0xF6B7C8D9 (read) — id[32]+addr[32]
//   environmentalCheck(bytes32,uint256) sel 0xA7B8C9D0 (write)
//   transferRights(bytes32,address) sel 0xB8C9D0E1 (write)

function pad32(h) { return h.replace(/^0x/, '').padStart(64, '0'); }

export default function MineralRightsScreen() {
  const [account, setAccount] = useState(null);
  const [deed, setDeed] = useState('');
  const [gps, setGps] = useState('');
  const [claimId, setClaimId] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');

  const loadAccount = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    setAccount(accs && accs.length ? accs[0] : null);
  }, []);
  useEffect(() => { loadAccount(); }, [loadAccount]);

  const getClaim = async () => {
    const id = claimId.trim().replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(id)) { Alert.alert('Invalid claim ID', 'Enter a 32-byte (64 hex) claim ID.'); return; }
    setLoading(true);
    try {
      const c = await waychainRPC.precompileCall('0x20', 'getClaim', pad32(id));
      Alert.alert('Claim', c || 'none');
    } catch (e) { Alert.alert('Query failed', e?.message || 'Unknown error'); }
    finally { setLoading(false); }
  };

  const write = async (label, args) => {
    if (!account) { Alert.alert('No wallet', 'Create or import a wallet.'); return; }
    setBusy(label);
    try {
      const res = await waychainRPC.precompileCall('0x20', label.toLowerCase(), args, {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      const tx = ((res && res.txHash) || 'pending').slice(0, 20);
      if (label === 'RegisterClaim') { const id = res && res.result ? res.result : ''; setClaimId(id); }
      Alert.alert(label + ' submitted', 'Tx: ' + tx);
    } catch (e) { Alert.alert(label + ' failed', e?.message || 'Unknown error'); }
    finally { setBusy(''); }
  };

  const register = () => {
    const d = deed.trim().replace(/^0x/, '');
    const g = gps.trim().replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(d) || !/^[0-9a-fA-F]{64}$/.test(g)) { Alert.alert('Hashes', 'deedHash and gpsHash must be 32-byte hex.'); return; }
    // owner left-aligned ASCII; empty => caller (pass 32 zero bytes)
    write('RegisterClaim', pad32(d) + pad32(g) + '0'.repeat(64));
  };
  const issue = () => write('IssueTokens', pad32(claimId.trim().replace(/^0x/, '')));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Mineral Rights" />
      <View style={styles.card}>
        <Text style={styles.label}>Register claim</Text>
        <TextInput value={deed} onChangeText={setDeed} placeholder="deedHash (32-byte hex)" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" />
        <TextInput value={gps} onChangeText={setGps} placeholder="gpsBoundaryHash (32-byte hex)" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" />
        <Button label={busy === 'RegisterClaim' ? 'Registering…' : 'Register Claim'} onPress={register} disabled={!!busy} style={styles.btn} />
        <Text style={styles.warn}>Requires Dox_Dev L2+ to register. Returns a claim ID.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Claim ID (32-byte hex)</Text>
        <TextInput value={claimId} onChangeText={setClaimId} placeholder="0x… 64 hex" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" />
        <View style={styles.actions}>
          <Button label="Get Claim" onPress={getClaim} disabled={loading} variant="secondary" style={styles.actBtn} />
          <Button label={busy === 'IssueTokens' ? '…' : 'Issue Tokens'} onPress={issue} disabled={!!busy} variant="secondary" style={styles.actBtn} />
        </View>
      </View>
      <Text style={styles.note}>MineralRightsRegistry (0x20): tokenized mineral rights (MRT). Selectors verified vs evm/mineral_rights.go. registerClaim requires Dox_Dev L2+; verifyClaim/approveReserve/environmentalCheck/transferRights also available.</Text>
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
  warn: { fontFamily: FONTS.body, fontSize: 11, color: '#FF8A80', marginTop: 8 },
  note: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, marginTop: 14, lineHeight: 16 },
});
