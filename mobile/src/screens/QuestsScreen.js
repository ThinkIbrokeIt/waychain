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
  // Track A — Onboard (prove wallet + value transfer)
  { id: 'wallet-setup',    title: 'Wallet Setup + Backup',     reward: 100, proof: 'verifier', desc: 'Create a wallet and prove you can restore from your recovery phrase.' },
  { id: 'first-transfer',  title: 'First WAY Transfer',         reward: 10,  proof: 'action',   desc: 'Send WAY to another address. Proves value transfer + gas.' },
  { id: 'faucet-claim',    title: 'Claim Test WAY (Faucet)',   reward: 10,  proof: 'action',   desc: 'Request 10 WAY from the faucet. Proves onboarding works.' },
  { id: 'receive-way',     title: 'Receive WAY',                reward: 10,  proof: 'action',   desc: 'Receive WAY into your wallet. Proves inbound value.' },
  { id: 'governance-vote', title: 'Governance Vote',            reward: 25,  proof: 'action',   route: 'Governance', desc: 'Vote on a live proposal. Proves governance works.' },

  // Track B — Identity (Dox_Dev badge ladder)
  { id: 'doxdev-badge',    title: 'Earn Dox_Dev Badge (L2)',    reward: 100, proof: 'verifier', route: 'Identity', desc: 'Get verified Dox_Dev Level 2 — unlocks vaults + oracles.' },
  { id: 'badge-curate',    title: 'Curate a Dox_Dev Badge (L3)', reward: 200, proof: 'verifier', route: 'Identity', desc: 'Reach L3 and approve a badge application. Proves curation.' },

  // Track C — Governance (propose)
  { id: 'gov-propose',     title: 'Launch a Proposal',          reward: 25,  proof: 'action',   route: 'Governance', desc: 'Create a governance proposal for an improvement. (Top-tier gate.)' },

  // Track D — DeFi (stablecoin + DEX + stability)
  { id: '1way-mint',       title: 'Mint 1WAY (BTC Vault)',      reward: 300, proof: 'action',   route: 'Stablecoin', desc: 'Create a vault, deposit BTC, mint 1WAY. Gets value onto WayChain.' },
  { id: '1way-burn',       title: 'Burn 1WAY → BTC',            reward: 150, proof: 'action',   route: 'Stablecoin', desc: 'Burn 1WAY back to BTC. Proves the peg unwinds.' },
  { id: '2way-open',       title: 'Open a 2WAY Vault',          reward: 25,  proof: 'action',   desc: 'Open a CDP vault on the two-way peg. Proves DeFi lending.' },
  { id: 'first-swap',      title: 'First DEX Swap',             reward: 10,  proof: 'action',   route: 'DEX', desc: 'Swap tokens on SwapRoute. Proves the DEX.' },
  { id: 'add-liquidity',   title: 'Provide Liquidity',          reward: 10,  proof: 'action',   route: 'DEX', desc: 'LP on SwapRoute. Proves AMM liquidity.' },
  { id: 'stability-deposit', title: 'Stability Pool Deposit',   reward: 50,  proof: 'action',   desc: 'Deposit to the StabilityPool. Proves stability mechanics.' },
  { id: 'btc-bridge',      title: 'BTC Bridge Attest',          reward: 25,  proof: 'action',   desc: 'Attest a BTC commit on BitcoinRegistry. Proves the bridge.' },
  { id: 'sway-stake',      title: 'Stake SWAY',                 reward: 50,  proof: 'action',   desc: 'Stake SWAY for LP rewards. Proves the incentive token.' },

  // Track E — Native applications (use what we built)
  { id: 'bijo-journal',    title: 'Write a BinaryJournal',      reward: 100, proof: 'action',   route: 'EnergyTide', desc: 'Write an entry to the BIJO journal. Proves the journal.' },
  { id: 'lock-time',       title: 'Create a Time Lock',         reward: 25,  proof: 'action',   route: 'Locks', desc: 'Lock value on a timelock via TrustlessLock. Proves anti-rug.' },
  { id: 'lock-vesting',    title: 'Create a Vesting Lock',      reward: 50,  proof: 'action',   route: 'Locks', desc: 'Vesting lock via TrustlessLock. Proves vesting.' },
  { id: 'mrt-claim',       title: 'Register Mineral Rights',    reward: 150, proof: 'verifier', desc: 'Register an MRT claim. Proves mineral-rights tokenization.' },
  { id: 'dms-setup',       title: 'Set Up DeadMansSwitch',      reward: 150, proof: 'verifier', desc: 'Configure an inactivity switch. Proves inherited-asset logic.' },

  // Track F — Infrastructure (run the chain)
  { id: 'oracle-feed',     title: 'Submit Oracle Feed',         reward: 150, proof: 'action',   desc: 'Apply for oracle badge + submit a price attestation.' },
  { id: 'account-recovery', title: 'Test Account Recovery',     reward: 50,  proof: 'verifier', desc: 'Exercise the guardian recovery flow. Proves AccountManager.' },
  { id: 'privacy-proof',   title: 'Submit ZK Proof',            reward: 100, proof: 'verifier', desc: 'Submit a privacy range/membership proof. Proves ZK precompile.' },
  { id: 'staterent-pay',   title: 'Pay State Rent',             reward: 50,  proof: 'action',   desc: 'Pay state rent on an account. Proves the rent model.' },
  { id: 'xchain-attest',   title: 'Witness Cross-Chain Event',  reward: 100, proof: 'verifier', desc: 'Witness an external-chain event. Proves CrossChainAttestation.' },
  { id: 'template-deploy', title: 'Deploy from Template',       reward: 100, proof: 'verifier', desc: 'Deploy a contract from TemplateRegistry. Proves templates.' },
  { id: 'validator-72h',   title: 'Validator 72h Uptime',       reward: 100, proof: 'verifier', desc: 'Run a validator with 0 downtime for 72h. Top-tier ladder step.' },
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
  const [pool, setPool] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAccount = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    setAccount(accs && accs.length ? accs[0] : null);
  }, []);

  const refresh = useCallback(async () => {
    if (!account) { setLoading(false); return; }
    setLoading(true);
    const claimant = '0x' + account.publicKey.replace(/^0x/, '');
    const next = {};
    let total = 0;
    await Promise.all(QUESTS.map(async (q) => {
      try {
        const s = await waychainRPC.questStatus(encodeTaskId(q.id), claimant);
        next[q.id] = s === 'claimed' ? 'claimed' : s === 'verified' ? 'verified' : 'none';
      } catch {
        next[q.id] = 'none';
      }
    }));
    try { total = await waychainRPC.questPoolRemaining(); } catch { total = null; }
    setStatuses(next);
    setPool(total);
    setLoading(false);
  }, [account]);

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
        <Text style={styles.heroPool}>
          {pool == null ? 'Pool: —' : `Reward pool: ${pool.toLocaleString()} WAY remaining`}
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
  heroPool: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.amber, marginTop: 8, textAlign: 'center' },
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
