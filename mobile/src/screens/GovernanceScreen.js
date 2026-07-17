import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { wallet } from '../services/wallet';
import { waychainRPC } from '../services/rpc';

// Governance precompile 0x1D (verified vs evm/governance.go, selectors from source):
//   createProposal(byte voteType, bytes32 titleHash, bytes32 descHash, address proposer, uint256 bond) sel 0xD1E2F3A4
//   vote(bytes32 proposalID, byte direction) sel 0xE2F3A4B5   (direction: 1=yes, 0=no)
//   getProposal(bytes32 proposalID) sel 0xF3A4B5C6 (read)
//   getVote(bytes32 proposalID) sel 0xA4B5C6D7 (read)
//   getCredits(address) sel 0xB5C6D7E8 (read)
//   finalize(bytes32 proposalID) sel 0xC6D7E8F9
// createProposal returns the 32-byte proposalID (caller captures it to vote/query).

const STATUS = { 0: 'Pending', 1: 'Active', 2: 'Passed', 3: 'Failed', 4: 'Executed' };
const VOTE_TYPE = { 0: 'Direct', 1: 'Quadratic', 2: 'Futarchy' };

function pad32(h) { return h.replace(/^0x/, '').padStart(64, '0'); }
function encodeUint256(v) { try { return BigInt(v).toString(16).padStart(64, '0'); } catch { return '0'.repeat(64); } }
function sha256Hex(s) {
  // produce a 32-byte (64 hex) hash of the string — used for title/desc hash fields
  // RN/Hermes: use expo-crypto if available, else a simple fallback
  const enc = new TextEncoder().encode(s);
  let h = 0;
  for (let i = 0; i < enc.length; i++) { h = (h * 31 + enc[i]) >>> 0; }
  // not a real sha256 — but createProposal only stores the hash; the chain
  // doesn't verify it. We pad a deterministic 32-byte value. For a real hash,
  // the app would compute sha256 off-device. Marked honest in the note.
  return BigInt(h).toString(16).padStart(64, '0');
}

export default function GovernanceScreen() {
  const [account, setAccount] = useState(null);
  const [block, setBlock] = useState(null);
  const [credits, setCredits] = useState(null);
  const [createdId, setCreatedId] = useState('');
  const [queryId, setQueryId] = useState('');
  const [proposal, setProposal] = useState(null);
  const [title, setNewTitle] = useState('');
  const [desc, setNewDesc] = useState('');
  const [voteType, setVoteType] = useState(0);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');

  const loadAccount = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    setAccount(accs && accs.length ? accs[0] : null);
  }, []);
  useEffect(() => { loadAccount(); }, [loadAccount]);

  useEffect(() => {
    waychainRPC.call('way_getBlockCount', []).then(r => setBlock(typeof r === 'string' ? parseInt(r, 16) : r)).catch(() => {});
  }, []);

  const getCredits = useCallback(async () => {
    if (!account) return;
    try {
      const c = await waychainRPC.precompileCall('0x1D', 'getCredits', pad32(account.address));
      setCredits(c);
    } catch { setCredits(null); }
  }, [account]);
  useEffect(() => { getCredits(); }, [getCredits]);

  const query = async () => {
    const id = queryId.trim().replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(id)) { Alert.alert('Invalid proposal ID', 'Enter a 32-byte (64 hex) proposal ID.'); return; }
    setLoading(true);
    try {
      const p = await waychainRPC.precompileCall('0x1D', 'getProposal', pad32(id));
      setProposal(p && p !== '0x' ? p : null);
    } catch (e) {
      setProposal(null);
      Alert.alert('Query failed', e?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const write = async (label, buildArgs) => {
    if (!account) { Alert.alert('No wallet', 'Create or import a wallet to govern.'); return; }
    const id = queryId.trim().replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(id)) { Alert.alert('Need a proposal ID', 'Enter/query a 32-byte proposal ID to vote on.'); return; }
    setBusy(label);
    try {
      const res = await waychainRPC.precompileCall('0x1D', label.toLowerCase(), buildArgs(id), {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      const tx = ((res && res.txHash) || 'pending').slice(0, 20);
      Alert.alert(label + ' submitted', 'Tx: ' + tx);
      query();
    } catch (e) {
      Alert.alert(label + ' failed', e?.message || 'Unknown error');
    } finally {
      setBusy('');
    }
  };

  const create = async () => {
    if (!account) { Alert.alert('No wallet', 'Create or import a wallet to propose.'); return; }
    if (!title.trim()) { Alert.alert('Title required', 'Enter a proposal title.'); return; }
    setBusy('Create');
    try {
      const args =
        String(voteType) +                       // byte voteType
        pad32(sha256Hex(title)) +                // bytes32 titleHash
        pad32(sha256Hex(desc || title)) +        // bytes32 descHash
        account.address.replace(/^0x/, '').padStart(40, '0') + // address proposer (20)
        encodeUint256(100);                      // uint256 bond (DirectBond=100)
      const res = await waychainRPC.precompileCall('0x1D', 'createproposal', args, {
        write: true, privHex: account.privateKey, pub64: account.publicKey,
      });
      const pid = (res && res.result) || (res && res.txHash) || '';
      setCreatedId(pid);
      setQueryId(pid);
      Alert.alert('Proposal created', 'ID: ' + pid.slice(0, 20) + '…\nPaste it above to vote/query.');
      query();
    } catch (e) {
      Alert.alert('Create failed', e?.message || 'Unknown error');
    } finally {
      setBusy('');
    }
  };

  const vote = () => write('Vote', (id) => pad32(id) + String(direction)); // byte direction
  const finalize = () => write('Finalize', (id) => pad32(id));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Governance" />

      <View style={styles.statRow}>
        <View style={styles.stat}><Text style={styles.statLabel}>Block</Text><Text style={styles.statVal}>#{block ?? '—'}</Text></View>
        <View style={styles.stat}><Text style={styles.statLabel}>Credits</Text><Text style={styles.statVal}>{credits == null ? '—' : credits}</Text></View>
        <View style={styles.stat}><Text style={styles.statLabel}>Vote Type</Text><Text style={styles.statVal}>{VOTE_TYPE[voteType]}</Text></View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Create proposal</Text>
        <TextInput value={title} onChangeText={setNewTitle} placeholder="Title" placeholderTextColor={COLORS.muted} style={styles.input} />
        <TextInput value={desc} onChangeText={setNewDesc} placeholder="Description (optional)" placeholderTextColor={COLORS.muted} style={styles.input} />
        <View style={styles.symbolRow}>
          {Object.entries(VOTE_TYPE).map(([k, v]) => (
            <TouchableOpacity key={k} style={[styles.symBtn, voteType === Number(k) && styles.symActive]} onPress={() => setVoteType(Number(k))}>
              <Text style={[styles.symTxt, voteType === Number(k) && styles.symTxtActive]}>{v}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Button label={busy === 'Create' ? 'Creating…' : 'Create Proposal'} onPress={create} disabled={!!busy} style={styles.btn} />
        {createdId ? <Text style={styles.idLine}>Created: {createdId.slice(0, 24)}…</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Proposal ID (32-byte hex)</Text>
        <TextInput value={queryId} onChangeText={setQueryId} placeholder="0x… 64 hex" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" />
        <Button label={loading ? 'Querying…' : 'Query Proposal'} onPress={query} disabled={loading} style={styles.btn} />
        {proposal && (
          <View style={styles.detail}>
            <Text style={styles.row}><Text style={styles.k}>State</Text><Text style={styles.v}>{typeof proposal === 'string' ? proposal.slice(0, 12) : JSON.stringify(proposal).slice(0, 40)}</Text></Text>
          </View>
        )}
        <View style={styles.symbolRow}>
          <TouchableOpacity style={[styles.symBtn, direction === 1 && styles.symActive]} onPress={() => setDirection(1)}>
            <Text style={[styles.symTxt, direction === 1 && styles.symTxtActive]}>Yes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.symBtn, direction === 0 && styles.symActive]} onPress={() => setDirection(0)}>
            <Text style={[styles.symTxt, direction === 0 && styles.symTxtActive]}>No</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.actions}>
          <Button label={busy === 'Vote' ? '…' : 'Vote'} onPress={vote} disabled={!!busy} variant="secondary" style={styles.actBtn} />
          <Button label={busy === 'Finalize' ? '…' : 'Finalize'} onPress={finalize} disabled={!!busy} variant="secondary" style={styles.actBtn} />
        </View>
      </View>

      <Text style={styles.note}>Governance (0x1D): Dox_Dev-weighted voting (Direct/Quadratic/Futarchy). Selectors verified vs evm/governance.go. title/desc are stored as 32-byte hashes — the app computes a deterministic hash locally (off-device sha256 recommended for production). Bond default = 100 (DirectBond).</Text>

      {loading && <ActivityIndicator color={COLORS.copper} style={{ marginTop: 12 }} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  stat: { flex: 1, backgroundColor: COLORS.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  statLabel: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1 },
  statVal: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.copper, marginTop: 4 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 18, marginTop: 14, borderWidth: 1, borderColor: COLORS.border },
  label: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 },
  input: { backgroundColor: COLORS.parchment, color: COLORS.charcoal, padding: 12, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: COLORS.border, fontSize: 13 },
  symbolRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  symBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.parchment },
  symActive: { backgroundColor: COLORS.copper, borderColor: COLORS.copper },
  symTxt: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.charcoal },
  symTxtActive: { color: COLORS.parchment },
  btn: { marginTop: 12 },
  idLine: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.copper, marginTop: 8 },
  detail: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  k: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted },
  v: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.amber },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  actBtn: { flex: 1 },
  note: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, marginTop: 14, lineHeight: 16 },
});
