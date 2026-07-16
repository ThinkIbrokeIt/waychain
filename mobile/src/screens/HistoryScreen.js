import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import { getTxLog } from '../services/secure';
import { waychainRPC } from '../services/rpc';
import { formatWay, timeAgo, shortAddr } from '../utils/format';

export default function HistoryScreen() {
  const [log, setLog] = useState([]);
  const [hash, setHash] = useState('');
  const [lookup, setLookup] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getTxLog().then(setLog); }, []);

  const search = async () => {
    if (!hash.trim()) return;
    setBusy(true);
    try {
      const r = await waychainRPC.call('eth_getTransactionByHash', [hash.trim()]);
      setLookup(r);
      if (!r) Alert.alert('Not found', 'No transaction with that hash on this node.');
    } catch (e) { Alert.alert('Lookup failed', e?.message || 'Error'); }
    finally { setBusy(false); }
  };

  const valStr = (v) => (v ? formatWay(typeof v === 'string' && v.startsWith('0x') ? BigInt(v).toString() : String(v)) : '0');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="History" />

      <View style={styles.searchBox}>
        <Text style={styles.label}>Lookup by tx hash</Text>
        <TextInput value={hash} onChangeText={setHash} placeholder="0x…" placeholderTextColor={COLORS.muted}
          style={styles.input} autoCapitalize="none" />
        <TouchableOpacity style={[styles.lookupBtn, busy && styles.disabled]} onPress={search} disabled={busy}>
          <Text style={styles.lookupBtnText}>{busy ? 'Searching…' : 'Search chain'}</Text>
        </TouchableOpacity>
      </View>

      {lookup && (
        <View style={[styles.txCard, styles.txFound]}>
          <View style={styles.txTop}>
            <Text style={styles.txTitle}>On-chain transaction</Text>
            <View style={[styles.pill, styles.pillOk]}><Text style={styles.pillText}>FOUND</Text></View>
          </View>
          <Text style={styles.txRow}>From: {shortAddr(lookup.from, 12, 10)}</Text>
          <Text style={styles.txRow}>To: {shortAddr(lookup.to, 12, 10)}</Text>
          <Text style={styles.txRow}>Value: {valStr(lookup.value)} WAY</Text>
          <Text style={styles.txRow}>Nonce: {lookup.nonce}</Text>
        </View>
      )}

      <Text style={styles.label}>Your activity</Text>
      {log.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyTitle}>No transactions yet</Text>
          <Text style={styles.emptyText}>Sent payments will appear here with time and status.</Text>
        </View>
      ) : (
        log.slice().reverse().map((t, i) => (
          <View key={i} style={styles.txCard}>
            <View style={styles.txTop}>
              <Text style={styles.txTitle}>Sent {t.amount} WAY</Text>
              <View style={[styles.pill, styles.pillPending]}><Text style={styles.pillText}>SENT</Text></View>
            </View>
            <Text style={styles.txRow}>To: {shortAddr(t.to, 12, 10)}</Text>
            <Text style={styles.txRow}>Hash: {shortAddr(t.txHash, 12, 8)}</Text>
            <Text style={styles.txTime}>{timeAgo(t.at)}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  label: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 18, marginBottom: 8 },
  searchBox: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  input: { backgroundColor: COLORS.parchment, color: COLORS.charcoal, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  lookupBtn: { backgroundColor: COLORS.copper, borderRadius: 10, padding: 14, marginTop: 10, alignItems: 'center' },
  lookupBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.parchment },
  disabled: { opacity: 0.5 },
  txCard: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginTop: 12, borderWidth: 1, borderColor: COLORS.border },
  txFound: { borderColor: COLORS.copper },
  txTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  txTitle: { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.charcoal },
  txRow: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.charcoal, marginTop: 4 },
  txTime: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 8 },
  pill: { borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10 },
  pillOk: { backgroundColor: 'rgba(76,175,80,0.16)' },
  pillPending: { backgroundColor: 'rgba(184,115,51,0.16)' },
  pillText: { fontFamily: FONTS.bold, fontSize: 11, letterSpacing: 0.5, color: COLORS.copperDark },
  empty: { alignItems: 'center', marginTop: 40, paddingHorizontal: 30 },
  emptyEmoji: { fontSize: 42 },
  emptyTitle: { fontFamily: FONTS.display, fontSize: 20, color: COLORS.charcoal, marginTop: 10 },
  emptyText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
