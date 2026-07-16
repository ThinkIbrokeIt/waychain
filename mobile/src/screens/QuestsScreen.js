import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Linking } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { wallet } from '../services/wallet';
import { waychainRPC } from '../services/rpc';
import { useNavigation } from '@react-navigation/native';

// ── Quests (TaskRegistry 0x23) ──────────────────────────────────────────────
// On-chain ledger: taskClaim(taskId[32]) marks caller "claimed"; taskVerify
// (Dox_Dev L2+) marks "verified" + pays WAY from treasury. taskStatus returns
// "none"/"claimed"/"verified" for the caller.
//
// Config-driven task list so the founder can add/remove quests WITHOUT a
// redeploy — edit QUESTS below. taskId MUST match a key in the Go
// taskRewardAmount() map (waychain-consensus/evm/task_registry.go) for
// on-chain reward payout, e.g. bridge-test/oracle-sign/badge-deploy/etc.
// New dev-flow tasks (crosschain-attest, run-oracle-24h, …) need adding to
// that Go map + a redeploy before they pay WAY.
const DISCORD_URL = 'https://discord.gg/waychain'; // TODO: set real invite
// Foundation quest program — IDs MUST match taskRewardAmount() in
// waychain-consensus/evm/task_registry.go for on-chain WAY payout.
// proof: 'action' = app verifies on-chain state before enabling claim (auto-marked);
//        'verifier' = Dox_Dev L2+ must confirm (Discord) before payout.
// route: optional screen to open for the action (instead of generic claim).
const QUESTS = [
  { id: 'wallet-setup',    title: 'Wallet Setup + Backup', reward: 100, proof: 'verifier', desc: 'Create a wallet and prove you can restore from your recovery phrase.' },
  { id: 'first-transfer',  title: 'First WAY Transfer',    reward: 10,  proof: 'action',   desc: 'Send WAY to another address. Proves value transfer + gas.' },
  { id: 'governance-vote', title: 'Governance Vote',       reward: 25,  proof: 'action',   desc: 'Vote on a live proposal. Proves governance works.' },
  { id: 'gov-propose',     title: 'Launch a Proposal',     reward: 25,  proof: 'action',   desc: 'Create a governance proposal for an improvement. (Top-tier gate.)' },
  { id: 'quest-feedback',  title: 'Quest Feedback',        reward: 50,  proof: 'verifier', desc: 'Write detailed feedback on any use case you tested.' },
  { id: 'doxdev-badge',    title: 'Earn Dox_Dev Badge (L2)', reward: 100, proof: 'verifier', desc: 'Get verified Dox_Dev Level 2 — unlocks vaults + oracles.' },
  { id: '1way-mint',       title: 'Mint 1WAY',             reward: 300, proof: 'action', route: 'Stablecoin', desc: 'Create a vault, deposit BTC, mint 1WAY. Gets value onto WayChain.' },
  { id: 'oracle-setup',    title: 'Oracle Setup',          reward: 150, proof: 'action',   desc: 'Apply for oracle badge + submit a price attestation.' },
  { id: 'validator-setup', title: 'Validator Setup (72h)', reward: 500, proof: 'verifier', desc: 'Run a validator with 0 downtime for 72h. Top-tier ladder step.' },
];

// Encode a taskId string as a 32-byte (64-hex) word, LEFT-padded — matches Go:
// taskClaim copies input[4:36] into slot[0:32], and recordTopTier compares to
// []byte("gov-propose") left-aligned. So left-align (fill from index 0).
function encodeTaskId(taskId) {
  const bytes = Array.from(new TextEncoder().encode(taskId));
  const out = new Array(32).fill(0);
  for (let i = 0; i < bytes.length && i < 32; i++) out[i] = bytes[i];
  return out.map((b) => b.toString(16).padStart(2, '0')).join('');
}

const STATUS_LABEL = { none: 'Not started', claimed: 'Claimed', verified: 'Verified ✓' };
const STATUS_COLOR = { none: COLORS.muted, claimed: COLORS.amber, verified: COLORS.copper };

export default function QuestsScreen({ navigation }) {
  const nav = useNavigation();
  const [account, setAccount] = useState(null);
  const [statuses, setStatuses] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAccount = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    setAccount(accs && accs.length ? accs[0] : null);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = {};
    for (const q of QUESTS) {
      try {
        const raw = await waychainRPC.precompileCall('0x23', 'taskStatus', encodeTaskId(q.id));
        const s = typeof raw === 'string' ? raw.replace(/^0x/, '') : '';
        next[q.id] = s === 'claimed' ? 'claimed' : s === 'verified' ? 'verified' : 'none';
      } catch {
        next[q.id] = 'none';
      }
    }
    setStatuses(next);
    setLoading(false);
  }, []);

  useEffect(() => { loadAccount(); }, [loadAccount]);
  useEffect(() => { if (account) refresh(); else setLoading(false); }, [account, refresh]);

  const claim = (q) => {
    if (!account) { Alert.alert('No wallet', 'Create or import a wallet to start quests.'); return; }
    if (q.id === '1way-mint') {
      nav.navigate('Stablecoin');
      return;
    }
    Alert.alert(
      'Mark task complete?',
      `${q.title}\n\nSubmit proof-of-completion on-chain, then verify + give feedback in Discord.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', style: 'default', onPress: () => doClaim(q) },
      ]
    );
  };

  const doClaim = async (q) => {
    setBusyId(q.id);
    try {
      await waychainRPC.precompileCall('0x23', 'taskClaim', encodeTaskId(q.id), {
        write: true,
        privHex: account.privateKey,
        pub64: account.publicKey,
      });
      setStatuses((s) => ({ ...s, [q.id]: 'claimed' }));
      Alert.alert('Submitted', `“${q.title}” marked complete on-chain.\nNow post your feedback in Discord so a verifier can approve + pay WAY.`);
      // open Discord for feedback/verification
      Linking.openURL(DISCORD_URL).catch(() => {});
    } catch (e) {
      Alert.alert('Failed', e?.message || 'Unknown error');
    } finally {
      setBusyId(null);
    }
  };

  const completed = Object.values(statuses).filter((s) => s !== 'none').length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="WayChain Quests" />

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Earn WAY · Build the Base</Text>
        <Text style={styles.heroVal}>
          {loading ? '—' : `${completed}/${QUESTS.length}`} <Text style={styles.heroSub}>complete</Text>
        </Text>
        <Text style={styles.heroNote}>
          Test WayChain flows, give dev feedback, earn WAY from the airdrop pool. Verified by Dox_Dev L2+.
        </Text>
      </View>

      {!account ? (
        <View style={styles.warnBox}>
          <Text style={styles.warnText}>No wallet found. Create or import a wallet to start quests.</Text>
          <Button label="Open Wallet" onPress={() => navigation.navigate('Wallet')} style={styles.warnBtn} />
        </View>
      ) : (
        <View style={styles.list}>
          {QUESTS.map((q) => {
            const st = statuses[q.id] || 'none';
            return (
              <View key={q.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>{q.title}</Text>
                  <Text style={[styles.statusPill, { color: STATUS_COLOR[st], borderColor: STATUS_COLOR[st] }]}>
                    {STATUS_LABEL[st]}
                  </Text>
                </View>
                <Text style={styles.cardDesc}>{q.desc}</Text>
                <View style={styles.cardFoot}>
                  <Text style={styles.reward}>+{q.reward} WAY</Text>
                  {st === 'none' ? (
                    <Button label={busyId === q.id ? 'Submitting…' : (q.route ? 'Open' : 'Mark Complete')} onPress={() => claim(q)} disabled={busyId === q.id} style={styles.completeBtn} />
                  ) : (
                    <TouchableOpacity style={styles.feedbackBtn} onPress={() => Linking.openURL(DISCORD_URL).catch(() => {})}>
                      <Text style={styles.feedbackText}>Give Feedback →</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <TouchableOpacity style={styles.discord} onPress={() => Linking.openURL(DISCORD_URL).catch(() => {})}>
        <Text style={styles.discordText}>Join the Quest Hub on Discord →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  hero: { backgroundColor: COLORS.card, borderRadius: 16, padding: 22, marginTop: 8, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  heroLabel: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 2 },
  heroVal: { fontFamily: FONTS.display, fontSize: 34, color: COLORS.copper, marginTop: 6 },
  heroSub: { fontFamily: FONTS.body, fontSize: 16, color: COLORS.muted },
  heroNote: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 10, textAlign: 'center', lineHeight: 18 },
  warnBox: { backgroundColor: 'rgba(229,57,53,0.10)', borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: COLORS.red, alignItems: 'center' },
  warnText: { fontFamily: FONTS.body, fontSize: 13, color: '#FF8A80', textAlign: 'center', marginBottom: 12 },
  warnBtn: { marginTop: 4 },
  list: { marginTop: 16 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontFamily: FONTS.display, fontSize: 17, color: COLORS.charcoal },
  statusPill: { fontFamily: FONTS.medium, fontSize: 11, borderWidth: 1, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8, overflow: 'hidden' },
  cardDesc: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.muted, marginTop: 8, lineHeight: 19 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  reward: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.amber },
  completeBtn: { width: 140 },
  feedbackBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  feedbackText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.copper },
  discord: { marginTop: 12, alignItems: 'center', padding: 14, backgroundColor: 'rgba(184,115,51,0.12)', borderRadius: 12, borderWidth: 1, borderColor: COLORS.copper },
  discordText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.copper },
});
