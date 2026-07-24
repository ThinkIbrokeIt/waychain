import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Switch, TextInput, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { getAuthPrefs, setAuthPrefs } from '../services/secure';
import { isBiometricAvailable, setPin } from '../services/auth';
import { wallet } from '../services/wallet';

export default function SettingsScreen({ navigation }) {
  const [prefs, setPrefs] = useState({ enabled: false, biometric: false, pinSet: false });
  const [bioAvail, setBioAvail] = useState(false);
  const [pin, setPinVal] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAuthPrefs().then(setPrefs);
    isBiometricAvailable().then(setBioAvail);
  }, []);

  const toggleLock = async (val) => {
    const next = { ...prefs, enabled: val };
    if (val && !prefs.pinSet) {
      Alert.alert('Set a PIN', 'Enable app lock by setting a 4–8 digit PIN first.');
      return;
    }
    await setAuthPrefs(next); setPrefs(next);
  };

  const toggleBio = async (val) => {
    const next = { ...prefs, biometric: val };
    await setAuthPrefs(next); setPrefs(next);
  };

  const savePin = async () => {
    if (!/^\d{4,8}$/.test(pin)) { Alert.alert('Invalid PIN', 'Use 4–8 digits.'); return; }
    if (pin !== confirm) { Alert.alert('Mismatch', 'PINs do not match.'); return; }
    await setPin(pin);
    setPrefs({ ...prefs, pinSet: true, enabled: true });
    setPinVal(''); setConfirm('');
    Alert.alert('Saved', 'App lock enabled.');
  };

  // ── Wallet management ──────────────────────────────────────────────
  const doImport = useCallback(async (text) => {
    try {
      setBusy(true);
      const acc = text.split(/\s+/).length >= 12
        ? await wallet.importMnemonic(text)
        : await wallet.importPrivateKey(text);
      const accs = await wallet.loadAccounts();
      Alert.alert('Imported', 'Account added: ' + acc.address.slice(0, 12) + '…');
      navigation.navigate('Wallet');
    } catch (e) {
      Alert.alert('Import failed', e?.message || 'Invalid seed or key');
    } finally { setBusy(false); }
  }, [navigation]);

  const promptImportText = () => {
    Alert.prompt(
      'Import wallet',
      'Paste your 12/24-word recovery phrase, or a private key (hex).',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Import', onPress: (t) => t && t.trim() && doImport(t.trim()) },
      ],
      'plain-text'
    );
  };

  const createWallet = async () => {
    try {
      setBusy(true);
      const acc = await wallet.createAccount(12);
      await wallet.loadAccounts();
      Alert.alert('Wallet created', 'Write down your recovery phrase when prompted.');
      navigation.navigate('Wallet');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not create wallet');
    } finally { setBusy(false); }
  };

  return (
    <ScrollView style={styles.screen}>
      <BrandHeader subtitle="Settings" />

      {/* Wallet */}
      <Text style={styles.sectionTitle}>Wallet</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.walletRow} onPress={createWallet} disabled={busy}>
          <Text style={styles.walletRowText}>＋ Create new wallet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.walletRow} onPress={promptImportText} disabled={busy}>
          <Text style={styles.walletRowText}>🔤 Import via recovery phrase</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.walletRow}
          onPress={() => navigation.navigate('ScanPay', { mode: 'import', onImport: doImport })}>
          <Text style={[styles.walletRowText, { color: COLORS.amber }]}>📷 Import via QR</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.walletRow} onPress={promptImportText} disabled={busy}>
          <Text style={styles.walletRowText}>🔑 Import via private key</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>Keys never leave your device. Back up your phrase immediately after creating or importing.</Text>
      </View>

      {/* Faucet */}
      <Text style={styles.sectionTitle}>Gas</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.faucetBtn}
          onPress={async () => {
            try {
              setBusy(true);
              const accs = await wallet.loadAccounts();
              const active = accs[0];
              if (!active) { Alert.alert('No wallet', 'Create or import a wallet first.'); return; }
              const { waychainRPC } = await import('../services/rpc');
              await waychainRPC.precompileCall('0x27', 'drip', '', {
                write: true, privHex: active.privateKey, pub64: active.publicKey,
              });
              Alert.alert('Faucet drip sent', 'Gas WAY is on its way.');
            } catch (e) {
              Alert.alert('Drip failed', e?.message || String(e));
            } finally { setBusy(false); }
          }}
          disabled={busy}>
          <Text style={styles.faucetBtnText}>{busy ? 'Dripping…' : '💧 Faucet Drip (gas WAY)'}</Text>
        </TouchableOpacity>
      </View>

      {/* Security */}
      <Text style={styles.sectionTitle}>Security</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>App lock (PIN)</Text>
        <Switch value={prefs.enabled} onValueChange={toggleLock} trackColor={{ true: COLORS.copper }} />
      </View>
      {bioAvail && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Biometric unlock</Text>
          <Switch value={prefs.biometric} onValueChange={toggleBio} trackColor={{ true: COLORS.copper }} />
        </View>
      )}
      {!prefs.pinSet && (
        <View style={styles.pinBox}>
          <Text style={styles.label}>Set PIN</Text>
          <TextInput value={pin} onChangeText={setPinVal} placeholder="PIN (4–8 digits)" placeholderTextColor={COLORS.muted}
            style={styles.input} secureTextEntry keyboardType="numeric" maxLength={8} />
          <TextInput value={confirm} onChangeText={setConfirm} placeholder="Confirm PIN" placeholderTextColor={COLORS.muted}
            style={styles.input} secureTextEntry keyboardType="numeric" maxLength={8} />
          <Button label="Save PIN" onPress={savePin} style={styles.btn} />
        </View>
      )}
      <Text style={styles.note}>Keys never leave your device. Lock uses Android Keystore-backed SecureStore.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment, padding: 20, paddingTop: 0 },
  sectionTitle: { fontFamily: FONTS.display, fontSize: 18, color: COLORS.charcoal, marginTop: 22, marginBottom: 8 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 8, borderWidth: 1, borderColor: COLORS.border },
  walletRow: { paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  walletRowText: { fontFamily: FONTS.medium, fontSize: 16, color: COLORS.charcoal },
  hint: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, padding: 10, lineHeight: 18 },
  faucetBtn: { backgroundColor: COLORS.copper, borderRadius: 12, paddingVertical: 14, alignItems: 'center', margin: 8 },
  faucetBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.parchment },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginTop: 14, borderWidth: 1, borderColor: COLORS.border },
  rowLabel: { fontFamily: FONTS.medium, fontSize: 16, color: COLORS.charcoal },
  pinBox: { marginTop: 14 },
  label: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 },
  input: { backgroundColor: COLORS.card, color: COLORS.charcoal, padding: 14, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: COLORS.border },
  btn: { marginTop: 12 },
  note: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 18 },
});
