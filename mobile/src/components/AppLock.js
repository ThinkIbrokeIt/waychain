import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TextInput } from 'react-native';
import { COLORS, FONTS } from '../theme';
import Button from './Button';
import { getAuthPrefs, getLastBackground, AUTO_LOCK_MS } from '../services/secure';
import { unlock, authenticateBiometric } from '../services/auth';

// Gate shown when app lock is enabled and (a) first launch or (b) returned from background > timeout.
export default function AppLock({ children }) {
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [prefs, setPrefs] = useState(null);

  useEffect(() => {
    (async () => {
      const p = await getAuthPrefs();
      setPrefs(p);
      if (!p.enabled) { setLocked(false); return; }
      // Lock if enabled (first launch) or was backgrounded beyond timeout.
      const last = await getLastBackground();
      const elapsed = last ? Date.now() - last : AUTO_LOCK_MS + 1;
      setLocked(elapsed > AUTO_LOCK_MS);
    })();
  }, []);

  const tryUnlock = async () => {
    const ok = await unlock(pin);
    if (ok) { setLocked(false); setPin(''); }
    else Alert.alert('Locked', 'Incorrect PIN or authentication failed.');
  };

  const tryBio = async () => {
    if (prefs?.biometric) {
      const ok = await authenticateBiometric();
      if (ok) setLocked(false);
    }
  };

  if (!locked) return children;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>WayChain</Text>
      <Text style={styles.sub}>Locked</Text>
      {prefs?.biometric && <Button label="Unlock with biometrics" onPress={tryBio} style={styles.btn} />}
      <TextInput value={pin} onChangeText={setPin} placeholder="PIN" placeholderTextColor={COLORS.muted}
        style={styles.input} secureTextEntry keyboardType="numeric" maxLength={8} />
      <Button label="Unlock" onPress={tryUnlock} style={styles.btn} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment, justifyContent: 'center', alignItems: 'center', padding: 40 },
  title: { fontFamily: FONTS.display, fontSize: 34, color: COLORS.copper },
  sub: { fontFamily: FONTS.medium, fontSize: 18, color: COLORS.charcoal, marginBottom: 24 },
  input: { backgroundColor: COLORS.card, color: COLORS.charcoal, padding: 14, borderRadius: 10, width: '80%', marginTop: 12, borderWidth: 1, borderColor: COLORS.border, textAlign: 'center' },
  btn: { marginTop: 14, width: '80%' },
});
