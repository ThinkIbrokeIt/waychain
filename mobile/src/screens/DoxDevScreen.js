import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, Switch, TouchableOpacity } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { wallet } from '../services/wallet';
import { waychainRPC } from '../services/rpc';

// Issue #75 Phase 1: Dox_Dev verify ladder + 3p/3t application flow.
// Ladder: 0 unverified → 1 basic (easy: cross-chain attest 0x1F grants L1)
// → 2 professional verifier → 3p governed professional / 3t task autopilot.
// 3p/3t reached by APPLICATION: role + docs (if needed) + confirm payment address.

const LADDER = [
  { key: '0', name: 'Unverified', note: 'No badge. Cannot verify or earn.' },
  { key: '1', name: 'Basic', note: 'Extremely easy to verify (witness a cross-chain event / 0x1F attest). Earns L1 tasks.' },
  { key: '2', name: 'Professional', note: 'Verifier. Can verify subjective quests (taskVerify). Earns L2 tasks.' },
  { key: '3p', name: 'L3 Professional', note: 'Governed professional. Can govern / set autopilot. Apply with docs + payment addr.' },
  { key: '3t', name: 'L3 Task', note: 'Task autopilot. Auto-verifies + pays objective quests from 0x03. Apply with docs + payment addr.' },
];

export default function DoxDevScreen({ navigation }) {
  const [account, setAccount] = useState(null);
  const [level, setLevel] = useState(0);
  const [applying, setApplying] = useState(null); // '3p' | '3t' | null
  const [role, setRole] = useState('');
  const [needDocs, setNeedDocs] = useState(true);
  const [docsNote, setDocsNote] = useState('');
  const [payAddr, setPayAddr] = useState('');

  const load = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    const a = accs[0] || null;
    setAccount(a);
    if (a) {
      try { const lvl = await waychainRPC.getDoxLevel(a); setLevel(lvl); }
      catch { setLevel(0); }
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const verifyL1 = () => {
    Alert.alert('Verify L1', 'Burn 1 WIFR on Solana → CrossChainAttestation (0x1F) witnesses it → grants Dox_Dev L1. Open the WIFR Door to start.', [
      { text: 'Go to WIFR', onPress: () => navigation.navigate('WIFR') },
      { text: 'Later', style: 'cancel' },
    ]);
  };

  const submitApp = async () => {
    if (!role.trim()) { Alert.alert('Role required'); return; }
    if (!payAddr.trim()) { Alert.alert('Confirm payment address'); return; }
    if (!account) { Alert.alert('No wallet'); return; }
    try {
      // doxApply(bytes32 roleHash, bytes32 docsHash, address payAddr)
      const enc = (s) => { const b = new TextEncoder().encode(s.slice(0, 32)); const o = new Uint8Array(32); o.set(b); return Array.from(o).map((x) => x.toString(16).padStart(2, '0')).join(''); };
      const roleHex = enc(role.trim());
      const docsHex = enc(needDocs ? (docsNote.trim() || role.trim()) : '');
      const pay = payAddr.trim().replace(/^0x/, '').toLowerCase().padStart(40, '0');
      const args = '0x' + roleHex + docsHex + pay;
      await waychainRPC.precompileCall('0x13', 'doxApply', args, {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      setApplying(null); setRole(''); setDocsNote(''); setPayAddr('');
      Alert.alert('Application submitted on-chain', `Role: ${role}\nReviewed by governor (3p) or designated via questSetAutopilot (3t).`);
    } catch (e) {
      Alert.alert('Failed', e?.message || 'Unknown error');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Dox_Dev Verify Ladder" />
      <Text style={styles.levelLine}>Your level: <Text style={styles.levelVal}>{level}</Text></Text>

      {LADDER.map((s, i) => (
        <View key={s.key} style={[styles.ladRow, String(level) === s.key && styles.ladOn]}>
          <Text style={styles.ladKey}>{s.key}</Text>
          <View style={styles.ladBody}>
            <Text style={styles.ladName}>{s.name}</Text>
            <Text style={styles.ladNote}>{s.note}</Text>
          </View>
        </View>
      ))}

      {level < 1 && (
        <Button label="Verify L1 (basic, easy)" onPress={verifyL1} variant="primary" style={styles.full} />
      )}

      <Text style={styles.sectionTitle}>Apply for L3 role</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.appBtn} onPress={() => setApplying('3p')}>
          <Text style={styles.appBtnText}>Apply: 3p Governed Professional</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.appBtn} onPress={() => setApplying('3t')}>
          <Text style={styles.appBtnText}>Apply: 3t Task Autopilot</Text>
        </TouchableOpacity>

        {applying && (
          <View style={styles.appForm}>
            <Text style={styles.label}>Role you are filling</Text>
            <TextInput value={role} onChangeText={setRole} placeholder="e.g. Oracle feed operator / Governor" placeholderTextColor={COLORS.muted} style={styles.input} />
            <View style={styles.switchRow}>
              <Text style={styles.label}>Documents required?</Text>
              <Switch value={needDocs} onValueChange={setNeedDocs} />
            </View>
            {needDocs && (
              <>
                <Text style={styles.label}>Document note / hash</Text>
                <TextInput value={docsNote} onChangeText={setDocsNote} placeholder="Describe docs or paste hash" placeholderTextColor={COLORS.muted} style={styles.input} />
              </>
            )}
            <Text style={styles.label}>Confirm payment address (receives WAY)</Text>
            <TextInput value={payAddr} onChangeText={setPayAddr} placeholder="0x… (your WayChain address)" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" />
            <Text style={styles.hint}>Applying as: {applying} — reviewed by governor / autopilot designation.</Text>
            <Button label="Submit application" onPress={submitApp} variant="primary" style={styles.full} />
          </View>
        )}
      </View>

      <Text style={styles.foot}>Economy: professionals bill per task (hours × rate, USD→WAY). Each tier has its own tasks; reward scales by complexity. Post tasks in the Community Tasks portal.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { padding: 16, paddingBottom: 40 },
  levelLine: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.copper, marginBottom: 12 },
  levelVal: { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.warm },
  ladRow: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  ladOn: { borderColor: COLORS.copper, backgroundColor: 'rgba(184,115,51,0.12)' },
  ladKey: { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.copper, width: 36, textAlign: 'center' },
  ladBody: { flex: 1, paddingLeft: 8 },
  ladName: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.warm },
  ladNote: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 2 },
  full: { marginTop: 14 },
  sectionTitle: { fontFamily: FONTS.display, fontSize: 16, color: COLORS.copper, marginTop: 16, marginBottom: 8, letterSpacing: 1 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  appBtn: { backgroundColor: COLORS.parchment, borderRadius: 10, paddingVertical: 11, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.copper, marginBottom: 10 },
  appBtnText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.copper },
  appForm: { marginTop: 6, borderTopWidth: 1, borderColor: COLORS.border, paddingTop: 12 },
  label: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.copper, marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: COLORS.parchment, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 9, fontFamily: FONTS.body, fontSize: 14, color: COLORS.charcoal },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  hint: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 6 },
  foot: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 16, lineHeight: 18 },
});
