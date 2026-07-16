import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { getAddressBook } from '../services/secure';
import { buildAndSignTx, sendRawTransaction, getNonce } from '../services/tx';

export default function SendScreen({ route, navigation }) {
  const account = route.params?.account || {};
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [book, setBook] = useState([]);

  useEffect(() => { getAddressBook().then(setBook); }, []);

  const buildPreview = () => {
    const amt = parseFloat(amount);
    if (!to.trim() || !amt || amt <= 0) { setPreview(null); return; }
    const valueWei = BigInt(Math.round(amt * 1e18)).toString(); // WAY 18 decimals
    setPreview({ to: to.trim().replace(/^0x/, ''), valueWei, amount: amt });
  };

  useEffect(() => { buildPreview(); }, [to, amount]);

  const send = async () => {
    if (!preview) return;
    // Validate recipient is a 64-char hex Ed25519 address (strip optional 0x).
    const toHex = preview.to.replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(toHex)) {
      Alert.alert('Invalid recipient', 'Recipient must be a 64-character WayChain (Ed25519) address.');
      return;
    }
    Alert.alert(
      'Confirm send',
      `Send ${preview.amount} WAY to\n${toHex.slice(0, 12)}…${toHex.slice(-8)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', style: 'destructive', onPress: doSend },
      ]
    );
  };

  const doSend = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const nonce = await getNonce(account.publicKey);
      const res = await buildAndSignTx({
        fromPrivHex: account.privateKey,
        fromPub64: account.publicKey,
        to: preview.to,
        valueWei: BigInt(preview.valueWei),
        nonce,
      });
      const txHash = await sendRawTransaction(res.rawHex);
      const finalHash = (txHash || res.txHash);
      if (route.params?.onSent) {
        route.params.onSent({ to: preview.to, amount: preview.amount, txHash: finalHash, at: Date.now() });
      }
      Alert.alert('Sent', 'Transaction submitted.\nHash: ' + finalHash.slice(0, 20) + '…');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Send failed', e?.message || 'Unknown error');
    } finally { setBusy(false); }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Send" />
      <Text style={styles.label}>From</Text>
      <Text style={styles.addr}>{account.address}</Text>

      <Text style={styles.label}>Recipient address</Text>
      <TextInput value={to} onChangeText={setTo} placeholder="0x… or raw hex" placeholderTextColor={COLORS.muted}
        style={styles.input} autoCapitalize="none" multiline />
      {book.length > 0 && (
        <View style={styles.book}>
          {book.map((e) => (
            <TouchableOpacity key={e.address} style={styles.bookItem} onPress={() => setTo('0x' + e.address)}>
              <Text style={styles.bookName}>{e.name}</Text>
              <Text style={styles.bookAddr}>{e.address.slice(0, 12)}…</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.label}>Amount (WAY)</Text>
      <TextInput value={amount} onChangeText={setAmount} placeholder="0.0" placeholderTextColor={COLORS.muted}
        style={styles.input} keyboardType="decimal-pad" />

      {preview && (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Preview</Text>
          <Text style={styles.previewRow}>To: {preview.to.slice(0, 16)}…</Text>
          <Text style={styles.previewRow}>Amount: {preview.amount} WAY</Text>
          <Text style={styles.previewRow}>Network: WayChain (Ed25519, lane 0)</Text>
        </View>
      )}

      <Button label={busy ? 'Sending…' : 'Send'} onPress={send} disabled={!preview || busy} style={styles.btn} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  label: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 16 },
  addr: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.charcoal },
  input: { backgroundColor: COLORS.card, color: COLORS.charcoal, padding: 14, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: COLORS.border, fontSize: 15 },
  book: { marginTop: 8 },
  bookItem: { backgroundColor: COLORS.parchment, borderRadius: 10, padding: 10, marginTop: 6, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-between' },
  bookName: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.charcoal },
  bookAddr: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted },
  preview: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginTop: 18, borderWidth: 1, borderColor: COLORS.amber },
  previewTitle: { fontFamily: FONTS.display, fontSize: 16, color: COLORS.amber },
  previewRow: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.charcoal, marginTop: 6 },
  btn: { marginTop: 20 },
});
