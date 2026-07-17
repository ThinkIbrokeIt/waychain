import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { wallet } from '../services/wallet';
import { waychainRPC } from '../services/rpc';

// AccountManager precompile 0x1B (verified vs evm/account_manager.go):
//   getStage(address)        sel 0xB1C2D3E4 (read)  — addr[32]
//   graduate()               sel 0xC2D3E4F5 (write) — caller context
//   advance()                sel 0xD3E4F5A6 (write) — caller context
//   rotateKey(bytes32)       sel 0xE4F5A6B7 (write) — newPubkey[32]
//   createSession(...)       sel 0xF5A6B7C8 (write) — caller context (simplified)
//   freeze() / unfreeze()    sel 0xE0F1A2B3 / 0xF1A2B3C4 (write) — caller context
// Most ops are caller-scoped (precompileCall passes account.publicKey as caller).

function pad32(h) { return h.replace(/^0x/, '').padStart(64, '0'); }

export default function AccountManagerScreen() {
  const [account, setAccount] = useState(null);
  const [stage, setStage] = useState(null);
  const [newKey, setNewKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');

  const loadAccount = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    setAccount(accs && accs.length ? accs[0] : null);
  }, []);
  useEffect(() => { loadAccount(); }, [loadAccount]);

  const getStage = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const s = await waychainRPC.precompileCall('0x1B', 'getStage', pad32(account.address));
      setStage(s);
    } catch { setStage('err'); }
    finally { setLoading(false); }
  }, [account]);
  useEffect(() => { getStage(); }, [getStage]);

  const write = async (label, args = '') => {
    if (!account) { Alert.alert('No wallet', 'Create or import a wallet.'); return; }
    setBusy(label);
    try {
      const res = await waychainRPC.precompileCall('0x1B', label.toLowerCase(), args, {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      Alert.alert(label + ' submitted', 'Tx: ' + ((res && res.txHash) || 'pending').slice(0, 20) + '…');
      getStage();
    } catch (e) { Alert.alert(label + ' failed', e?.message || 'Unknown error'); }
    finally { setBusy(''); }
  };

  const rotate = () => {
    const k = newKey.trim().replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(k)) { Alert.alert('Invalid key', 'newKey must be 32-byte (64 hex) pubkey.'); return; }
    write('RotateKey', pad32(k));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Account Manager" />

      <View style={styles.card}>
        <Text style={styles.label}>Your stage</Text>
        <Text style={styles.stat}>{loading ? '…' : (stage == null ? '—' : String(stage))}</Text>
        <Button label="Refresh stage" onPress={getStage} disabled={loading} style={styles.btn} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Lifecycle</Text>
        <View style={styles.actions}>
          <Button label={busy === 'Advance' ? '…' : 'Advance'} onPress={() => write('Advance')} disabled={!!busy} variant="secondary" style={styles.actBtn} />
          <Button label={busy === 'Graduate' ? '…' : 'Graduate'} onPress={() => write('Graduate')} disabled={!!busy} variant="secondary" style={styles.actBtn} />
        </View>
        <View style={styles.actions}>
          <Button label={busy === 'Freeze' ? '…' : 'Freeze'} onPress={() => write('Freeze')} disabled={!!busy} variant="secondary" style={styles.actBtn} />
          <Button label={busy === 'Unfreeze' ? '…' : 'Unfreeze'} onPress={() => write('Unfreeze')} disabled={!!busy} variant="secondary" style={styles.actBtn} />
        </View>
        <Button label={busy === 'CreateSession' ? '…' : 'Create Session'} onPress={() => write('CreateSession')} disabled={!!busy} style={styles.btn} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Rotate key (new pubkey 32-byte)</Text>
        <TextInput value={newKey} onChangeText={setNewKey} placeholder="0x… 64 hex" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" />
        <Button label={busy === 'RotateKey' ? 'Rotating…' : 'Rotate Key'} onPress={rotate} disabled={!!busy || !account} style={styles.btn} />
      </View>

      <Text style={styles.note}>AccountManager (0x1B): identity lifecycle (stage/advance/graduate), key rotation, session mgmt, freeze. Selectors verified vs evm/account_manager.go. Most ops are caller-scoped (your pubkey is the caller).</Text>
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
  stat: { fontFamily: FONTS.mono, fontSize: 14, color: COLORS.copper, marginTop: 6 },
  btn: { marginTop: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actBtn: { flex: 1 },
  note: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, marginTop: 14, lineHeight: 16 },
});
