import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ScrollView } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';

export default function DexScreen() {
  const [tokenA, setTokenA] = useState('');
  const [tokenB, setTokenB] = useState('');
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');

  const createPair = () => {
    if (!tokenA || !tokenB) { Alert.alert('Error', 'Enter both tokens'); return; }
    Alert.alert('Pair Created', `${tokenA}/${tokenB} pair ready (SwapRoute 0x25)`);
  };

  const addLiquidity = () => {
    Alert.alert('Liquidity Added', `${amountA} + ${amountB}`);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="SwapRoute DEX" />
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Create Pair</Text>
        <TextInput placeholder="Token A" value={tokenA} onChangeText={setTokenA} style={styles.input} placeholderTextColor={COLORS.muted} />
        <TextInput placeholder="Token B" value={tokenB} onChangeText={setTokenB} style={styles.input} placeholderTextColor={COLORS.muted} />
        <Button label="Create Pair" onPress={createPair} style={styles.btn} />
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add Liquidity</Text>
        <TextInput placeholder="Amount A" value={amountA} onChangeText={setAmountA} style={styles.input} placeholderTextColor={COLORS.muted} />
        <TextInput placeholder="Amount B" value={amountB} onChangeText={setAmountB} style={styles.input} placeholderTextColor={COLORS.muted} />
        <Button label="Add Liquidity" onPress={addLiquidity} variant="secondary" style={styles.btn} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, paddingBottom: 32 },
  section: { marginHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontFamily: FONTS.display, fontSize: 20, color: COLORS.charcoal, marginBottom: 12 },
  input: { backgroundColor: COLORS.card, color: COLORS.charcoal, padding: 14, marginBottom: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  btn: { marginTop: 4 },
});
