import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../theme';
import { WAY_USD_RATE, wayToUsd, usdToWay, fmtWay } from '../services/price';

// Reusable amount entry with WAY/USD toggle.
// Stores value in HUMAN WAY units (e.g. "12.5"), reports via onChange(wayString).
// Shows the converted USD live; hides raw decimals/wei.
// mode: 'way' | 'usd' — user flips which they type in.
export default function AmountField({ label, value, onChange, placeholder }) {
  const [mode, setMode] = useState('way');

  const handle = (text) => {
    const clean = text.replace(/[^0-9.]/g, '');
    if (mode === 'way') onChange(clean);
    else onChange(usdToWay(clean)); // store as WAY
  };

  const display = mode === 'way' ? (value || '') : (value ? wayToUsd(value) : '');
  const conv = mode === 'way'
    ? (value ? `≈ $${wayToUsd(value)}` : `rate: 1 WAY = $${WAY_USD_RATE}`)
    : (value ? `≈ ${fmtWay(usdToWay(value))} WAY` : `rate: 1 WAY = $${WAY_USD_RATE}`);

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <TextInput
          value={display}
          onChangeText={handle}
          placeholder={mode === 'way' ? (placeholder || '0.0 WAY') : '0.00'}
          placeholderTextColor={COLORS.muted}
          style={styles.input}
          keyboardType="decimal-pad"
        />
        <TouchableOpacity style={styles.toggle} onPress={() => setMode(m => (m === 'way' ? 'usd' : 'way'))}>
          <Text style={styles.toggleTxt}>{mode === 'way' ? 'WAY' : 'USD'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.conv}>{conv}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  input: { flex: 1, backgroundColor: COLORS.parchment, color: COLORS.charcoal, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, fontSize: 15 },
  toggle: { marginLeft: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.copper, backgroundColor: COLORS.card },
  toggleTxt: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.copper },
  conv: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.copper, marginTop: 4 },
});
