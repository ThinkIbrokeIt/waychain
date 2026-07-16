import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Clipboard } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';

export default function ReceiveScreen({ route }) {
  const address = route.params?.address || '';
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    Clipboard.setString(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Receive" />

      <View style={styles.qrFrame}>
        <QRCode value={address} size={230} color={COLORS.charcoal} backgroundColor={COLORS.parchment} />
      </View>

      <Text style={styles.caption}>Scan to deposit WAY or any WayChain asset</Text>

      <View style={styles.addrBox}>
        <Text style={styles.addrLabel}>Your address</Text>
        <Text style={styles.addr} selectable>{address}</Text>
      </View>

      <Button label={copied ? 'Copied ✓' : 'Copy address'} onPress={copy} style={styles.btn} />
      <Text style={styles.note}>This address is public — share it freely to receive funds. Only the recovery phrase controls spending.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, padding: 20, paddingBottom: 40, alignItems: 'center' },
  qrFrame: { backgroundColor: COLORS.parchment, padding: 18, borderRadius: 20, marginTop: 12, borderWidth: 2, borderColor: COLORS.copper, shadowColor: COLORS.copper, shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  caption: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.muted, marginTop: 14, textAlign: 'center' },
  addrBox: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginTop: 20, borderWidth: 1, borderColor: COLORS.border, width: '100%' },
  addrLabel: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  addr: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.charcoal, lineHeight: 20 },
  btn: { marginTop: 18, width: '80%' },
  note: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 16, textAlign: 'center', paddingHorizontal: 20, lineHeight: 18 },
});
