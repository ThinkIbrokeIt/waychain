import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, TouchableOpacity, Switch } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import AmountField from '../components/AmountField';
import { wallet } from '../services/wallet';
import { waychainRPC } from '../services/rpc';

// Phase 1 (issue #75): community task portal UI.
// On-chain createTask/escrow + gov-funding is Phase 2 (protocol change).
// Tasks here are local state; verification + payout wire to the TaskRegistry
// (0x23) precompile once Phase 2 lands.

const TIERS = ['1', '2', '3p', '3t'];
const VERIFY = ['autopilot', 'human-L2', 'poster-confirm'];

export default function CommunityTasksScreen({ navigation }) {
  const [account, setAccount] = useState(null);
  const [level, setLevel] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);

  // form state
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [tier, setTier] = useState('2');
  const [payout, setPayout] = useState('');
  const [isPublic, setIsPublic] = useState(false); // false=self-escrow, true=gov-vote
  const [verify, setVerify] = useState('autopilot');
  const [posterAddr, setPosterAddr] = useState('');

  const load = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    const a = accs[0] || null;
    setAccount(a);
    if (a) {
      try { const lvl = await waychainRPC.getDoxLevel(a.address); setLevel(parseInt(lvl, 16) || 0); }
      catch { setLevel(0); }
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tierOk = (req) => { const order = { '1': 1, '2': 2, '3p': 3, '3t': 3 }; return (order[level] || 0) >= (order[req] || 0); };

  const postTask = () => {
    if (!title.trim()) { Alert.alert('Title required'); return; }
    if (!payout || Number(payout) <= 0) { Alert.alert('Payout must be > 0 WAY'); return; }
    const t = {
      id: 'task-' + Date.now(),
      title: title.trim(),
      desc: desc.trim(),
      tier,
      payout: Number(payout),
      funding: isPublic ? 'gov-vote' : 'self-escrow',
      verify,
      poster: posterAddr.trim() || (account ? account.address : 'unknown'),
      status: isPublic ? 'voting' : 'open',
      claims: [],
    };
    setTasks([t, ...tasks]);
    setTitle(''); setDesc(''); setPayout(''); setPosterAddr(''); setIsPublic(false); setShowForm(false);
    Alert.alert('Posted', isPublic
      ? 'Sent to governance vote (yay/nay decides treasury funding).'
      : 'Escrow funded by poster. Professionals can now claim.');
  };

  const claim = (t) => {
    if (!tierOk(t.tier)) { Alert.alert('Requires Dox_Dev ' + t.tier, 'Your level: ' + level); return; }
    if (!account) { Alert.alert('No wallet'); return; }
    setTasks(tasks.map(x => x.id === t.id ? { ...x, claims: [...x.claims, account.address], status: 'claimed' } : x));
    Alert.alert('Claimed', 'Task marked claimed by you. Verification: ' + t.verify + '.');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Community Task Portal" />
      <Text style={styles.levelLine}>Your Dox_Dev level: <Text style={styles.levelVal}>{level}</Text>  (0→1→2→3p/3t)</Text>

      <TouchableOpacity style={styles.postBtn} onPress={() => setShowForm(s => !s)}>
        <Text style={styles.postBtnText}>{showForm ? 'Cancel' : '+ Post a task'}</Text>
      </TouchableOpacity>

      {showForm && (
        <View style={styles.card}>
          <Text style={styles.label}>Title</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="What needs doing?" placeholderTextColor={COLORS.muted} style={styles.input} />
          <Text style={styles.label}>Description</Text>
          <TextInput value={desc} onChangeText={setDesc} placeholder="Scope / deliverable" placeholderTextColor={COLORS.muted} style={[styles.input, { height: 64 }]} multiline />
          <Text style={styles.label}>Required Dox_Dev tier</Text>
          <View style={styles.row}>{TIERS.map(t => (
            <TouchableOpacity key={t} style={[styles.chip, tier === t && styles.chipOn]} onPress={() => setTier(t)}>
              <Text style={[styles.chipTxt, tier === t && styles.chipTxtOn]}>{t}</Text>
            </TouchableOpacity>
          ))}</View>
          <Text style={styles.label}>Payout (WAY)</Text>
          <AmountField label="" value={payout} onChange={setPayout} placeholder="0.0 WAY" />
          <Text style={styles.label}>Verification method</Text>
          <View style={styles.row}>{VERIFY.map(v => (
            <TouchableOpacity key={v} style={[styles.chip, verify === v && styles.chipOn]} onPress={() => setVerify(v)}>
              <Text style={[styles.chipTxt, verify === v && styles.chipTxtOn]}>{v}</Text>
            </TouchableOpacity>
          ))}</View>
          <View style={styles.switchRow}>
            <Text style={styles.label}>Public-good (governance votes treasury funding)</Text>
            <Switch value={isPublic} onValueChange={setIsPublic} />
          </View>
          <Text style={styles.hint}>{isPublic ? 'Treasury (0x03) funds if gov vote passes.' : 'You (poster) pay WAY into escrow.'}</Text>
          <Text style={styles.label}>Poster payment address (optional)</Text>
          <TextInput value={posterAddr} onChangeText={setPosterAddr} placeholder="0x… leave blank for active wallet" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" />
          <Button label="Post task" onPress={postTask} variant="primary" style={styles.full} />
        </View>
      )}

      <Text style={styles.sectionTitle}>Open tasks</Text>
      {tasks.length === 0 && <Text style={styles.empty}>No tasks yet. Post the first one.</Text>}
      {tasks.map(t => (
        <View key={t.id} style={styles.taskCard}>
          <View style={styles.taskHead}>
            <Text style={styles.taskTitle}>{t.title}</Text>
            <Text style={styles.taskPay}>{t.payout} WAY</Text>
          </View>
          <Text style={styles.taskMeta}>tier {t.tier} · {t.funding} · verify: {t.verify}</Text>
          {t.desc ? <Text style={styles.taskDesc}>{t.desc}</Text> : null}
          <Text style={styles.taskStatus}>status: {t.status}</Text>
          <Button label={tierOk(t.tier) ? 'Claim' : 'Locked (need ' + t.tier + ')'} onPress={() => claim(t)} disabled={!tierOk(t.tier) || t.status !== 'open'} variant="secondary" style={styles.full} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { padding: 16, paddingBottom: 40 },
  levelLine: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.copper, marginTop: 6, marginBottom: 10 },
  levelVal: { fontFamily: FONTS.bold, color: COLORS.warm },
  postBtn: { backgroundColor: COLORS.copper, borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginBottom: 12 },
  postBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: '#fff' },
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  label: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.copper, marginTop: 10, marginBottom: 4 },
  input: { backgroundColor: COLORS.parchment, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 9, fontFamily: FONTS.body, fontSize: 14, color: COLORS.charcoal },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1.5, borderColor: COLORS.copper, backgroundColor: COLORS.card },
  chipOn: { backgroundColor: COLORS.copper },
  chipTxt: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.copper },
  chipTxtOn: { color: '#fff' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  hint: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 4 },
  full: { marginTop: 12 },
  sectionTitle: { fontFamily: FONTS.display, fontSize: 16, color: COLORS.copper, marginTop: 8, marginBottom: 8, letterSpacing: 1 },
  empty: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.muted },
  taskCard: { backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  taskHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskTitle: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.warm, flex: 1 },
  taskPay: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.copper },
  taskMeta: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 3 },
  taskDesc: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.charcoal, marginTop: 4 },
  taskStatus: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.copper, marginTop: 4 },
});
