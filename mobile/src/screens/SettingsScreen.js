import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TextInput, Alert } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { getAuthPrefs, setAuthPrefs } from '../services/secure';
import { isBiometricAvailable, setPin } from '../services/auth';

export default function SettingsScreen() {
  const [prefs, setPrefs] = useState({ enabled: false, biometric: false, pinSet: false });
  const [bioAvail, setBioAvail] = useState(false);
  const [pin, setPinVal] = useState('');
  const [confirm, setConfirm] = useState('');

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

  return (
    <View style={styles.screen}>
      <BrandHeader subtitle="Settings" />
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment, padding: 20, paddingTop: 0 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginTop: 14, borderWidth: 1, borderColor: COLORS.border },
  rowLabel: { fontFamily: FONTS.medium, fontSize: 16, color: COLORS.charcoal },
  pinBox: { marginTop: 14 },
  label: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 },
  input: { backgroundColor: COLORS.card, color: COLORS.charcoal, padding: 14, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: COLORS.border },
  btn: { marginTop: 12 },
  note: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 18 },
});
