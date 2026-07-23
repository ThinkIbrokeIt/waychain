import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { wallet } from '../services/wallet';
import { waychainRPC } from '../services/rpc';

// TemplateRegistry precompile 0x26 (verified vs evm/template_registry.go):
//   registerTemplate(bytes32 templateId, uint8 type) sel 0x7cbd749e (write)
//     requires registrar or Dox_Dev L2+.
//   deployFromTemplate(bytes32 templateId, bytes code) sel 0x1de26edf (write)
//   getTemplate(bytes32) sel 0x8ecfe43a (read)
//   getUserTemplates(address) sel 0xe47e9f21 (read) — addr[32]
//   isRegistrar(address) sel 0x47b4d00d (read) — addr[32]
// NOTE: selectors in source are lowercase hex; normalized to 0x-prefixed 8-hex.
// The protocol-manifest encodes them as 0x7cbd749e etc.

function pad32(h) { return h.replace(/^0x/, '').padStart(64, '0'); }

export default function TemplateRegistryScreen() {
  const [account, setAccount] = useState(null);
  const [templateId, setTemplateId] = useState('');
  const [tType, setTType] = useState('1');
  const [code, setCode] = useState('');
  const [isReg, setIsReg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');

  const loadAccount = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    setAccount(accs && accs.length ? accs[0] : null);
  }, []);
  useEffect(() => { loadAccount(); }, [loadAccount]);

  const checkRegistrar = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const r = await waychainRPC.precompileCall('0x26', 'isRegistrar', pad32(account.publicKey));
      setIsReg(r);
    } catch { setIsReg('err'); }
    finally { setLoading(false); }
  }, [account]);
  useEffect(() => { checkRegistrar(); }, [checkRegistrar]);

  const write = async (label, args) => {
    if (!account) { Alert.alert('No wallet', 'Create or import a wallet.'); return; }
    setBusy(label);
    try {
      const res = await waychainRPC.precompileCall('0x26', label.toLowerCase().startsWith('register') ? 'registerTemplate' : label.toLowerCase(), args, {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      Alert.alert(label + ' submitted', 'Tx: ' + ((res && res.txHash) || 'pending').slice(0, 20) + '…');
    } catch (e) { Alert.alert(label + ' failed', e?.message || 'Unknown error'); }
    finally { setBusy(''); }
  };

  const register = () => {
    const id = templateId.trim().replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(id)) { Alert.alert('Invalid ID', 'templateId must be 32-byte hex.'); return; }
    write('RegisterTemplate', pad32(id) + String(tType === '1' ? 1 : 0));
  };
  const deploy = () => {
    const id = templateId.trim().replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(id)) { Alert.alert('Invalid ID', 'templateId must be 32-byte hex.'); return; }
    const c = code.trim().replace(/^0x/, '');
    if (!/^[0-9a-fA-F]*$/.test(c)) { Alert.alert('Invalid code', 'code must be hex bytecode.'); return; }
    write('DeployFromTemplate', pad32(id) + c);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Template Registry" />
      <View style={styles.card}>
        <Text style={styles.label}>Registrar status</Text>
        <Text style={styles.stat}>{loading ? '…' : (isReg == null ? '—' : String(isReg))}</Text>
        <Button label="Check registrar" onPress={checkRegistrar} disabled={loading} style={styles.btn} />
        <Text style={styles.warn}>Registering templates requires registrar role or Dox_Dev L2+.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Template ID (32-byte hex)</Text>
        <TextInput value={templateId} onChangeText={setTemplateId} placeholder="0x… 64 hex" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" />
        <TextInput value={tType} onChangeText={setTType} placeholder="type (uint8)" placeholderTextColor={COLORS.muted} style={styles.input} keyboardType="decimal-pad" />
        <Button label={busy === 'RegisterTemplate' ? 'Registering…' : 'Register Template'} onPress={register} disabled={!!busy} style={styles.btn} />
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Deploy from template (bytecode hex)</Text>
        <TextInput value={code} onChangeText={setCode} placeholder="0x… contract bytecode" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" />
        <Button label={busy === 'DeployFromTemplate' ? 'Deploying…' : 'Deploy'} onPress={deploy} disabled={!!busy} style={styles.btn} />
      </View>
      <Text style={styles.note}>TemplateRegistry (0x26): reusable contract templates (clone-to-deploy). Selectors verified vs evm/template_registry.go.</Text>
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
  warn: { fontFamily: FONTS.body, fontSize: 11, color: '#FF8A80', marginTop: 8 },
  note: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, marginTop: 14, lineHeight: 16 },
});
