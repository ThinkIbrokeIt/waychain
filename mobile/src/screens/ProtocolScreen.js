import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import { useNavigation } from '@react-navigation/native';

// C5: honest visibility for the precompiles that have NO wallet UI because they
// require off-chain crypto tooling (not faked buttons). Truth-first: every entry
// below is a real no-selector precompile in evm/precompiles.go (0x0C-0x12, 0x17,
// 0x1C, 0x1F) — verified against Go, not invented. These are intentionally not
// wired as wallet ops; they need signed oracle reports, ZK proofs, or relayed
// chain witnesses constructed off-device.

const ADVANCED = [
  { id: '0x0C', name: 'Oracle Aggregator', note: 'Aggregates ed25519-signed oracle reports (Dox_Dev L2+). Input = [count][pubkey(32)][value(32)][hash(32)][sig(64)]×n. Requires constructing signed reports off-device.' },
  { id: '0x0D', name: 'Oracle Scheduler', note: 'Schedules recurring feeds: [interval(8)][startBlock(8)][feedId(32)][maxExec(8)][reward(8)]. Raw-input; advanced.' },
  { id: '0x0E', name: 'Oracle Verifier', note: 'Verifies report authenticity against signed payloads. Raw-input; advanced.' },
  { id: '0x0F', name: 'TLS Verifier', note: 'Proves a TLS session transcript (RFC 8446). Requires an off-chain transcript + proof; not callable from wallet UI.' },
  { id: '0x10', name: 'Aggregate Signature', note: 'BLS aggregate ed25519 signature verify. Raw-input; advanced crypto tooling required.' },
  { id: '0x11', name: 'Account Recovery', note: 'Social-recovery vault: guardian-signed key rotation after cooldown. Requires the guardian set’s signatures off-device.' },
  { id: '0x12', name: 'State Rent', note: 'calcRent: raw [address(20)][contractSize(8)]. Rent = size × blocksSinceLast / 1000 (min 1 WAY/KB). Read-only; surfaced on the Stake/Protocol read paths.' },
  { id: '0x17', name: 'Storage Endowment', note: 'Endows storage rent for contracts. Raw-input write; advanced.' },
  { id: '0x1C', name: 'Privacy (ZK)', note: 'ZK selective disclosure: range / membership / identity attestation proofs. Proof construction needs off-chain ZK tooling.' },
  { id: '0x1F', name: 'Cross-Chain Attestation', note: 'Witnesses external-chain events (witnessEvent/getAttestation). SHA-256 proofs, not keccak. Requires relayed chain proofs.' },
];

// Wallet-wired DeFi precompiles (have real screens). Tap to open.
const DEFI = [
  { id: '0x18', name: 'TwoWay Vault', screen: 'TwoWayVault', note: 'Deposit stablecoins, mint/burn 2WAY synthetic USD. Real write ops.' },
  { id: '0x19', name: 'Stability Pool', screen: 'StabilityPool', note: 'Absorb 2WAY liquidation debt; earn WAY+SWAY. Real deposit/withdraw/claim.' },
  { id: '0x1D', name: 'Governance', screen: 'Governance', note: 'Propose / vote (Direct/Quadratic/Futarchy). Real.' },
  { id: '0x25', name: 'Swap Route (DEX)', screen: 'SwapRoute', note: 'Add liquidity (mints SWAY). Swap/remove pending on-chain finish.' },
  { id: '0x16', name: 'Bitcoin Registry', screen: 'BitcoinRegistry', note: 'BTC bridge backing 1WAY. Commit / withdraw.' },
  { id: '0x15', name: "Dead Man's Switch", screen: 'DeadMansSwitch', note: 'Truth-disclosure heir switch. Create/heartbeat/claim.' },
  { id: '0x1B', name: 'Account Manager', screen: 'AccountManager', note: 'Identity lifecycle, key rotation, freeze. Real.' },
  { id: '0x1E', name: 'State Rent', screen: 'StateRent', note: 'Pay/check rent (burn/validator/treasury split).' },
  { id: '0x20', name: 'Mineral Rights', screen: 'MineralRights', note: 'Tokenized mineral claims (Dox_Dev L2+).' },
  { id: '0x26', name: 'Template Registry', screen: 'TemplateRegistry', note: 'Clone-to-deploy contract templates.' },
  { id: '0x21', name: 'Keccak256', screen: 'Keccak256', note: 'App-layer hash bridge (read-only demo).' },
];

export default function ProtocolScreen() {
  const navigation = useNavigation();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Protocol & Advanced Precompiles" />

      <Text style={styles.section}>DeFi precompiles (wallet-wired)</Text>
      {DEFI.map((p) => (
        <TouchableOpacity key={p.id} style={styles.card} onPress={() => navigation.navigate(p.screen)}>
          <View style={styles.head}>
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.addr}>{p.id} ›</Text>
          </View>
          <Text style={styles.note}>{p.note}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.section}>Advanced precompiles (off-device tooling)</Text>
      <Text style={styles.intro}>These precompiles are live on WayChain but require off-device cryptography (signed oracle reports, ZK proofs, or relayed chain witnesses). They are intentionally not exposed as wallet buttons — honest scope, not missing functionality.</Text>

      {ADVANCED.map((p) => (
        <View key={p.id} style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.addr}>{p.id}</Text>
          </View>
          <Text style={styles.note}>{p.note}</Text>
        </View>
      ))}

      <Text style={styles.foot}>Full set: 27 precompiles (0x0C–0x26). The wallet surfaces reads/writes for token, DeFi, identity, governance, WIFR, and lock precompiles; the above are protocol-grade and handled by dedicated tooling.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  intro: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, lineHeight: 18, marginTop: 8, marginBottom: 14 },
  section: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.copper, textTransform: 'uppercase', letterSpacing: 1, marginTop: 18, marginBottom: 4 },
  card: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginTop: 12, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 4, borderLeftColor: COLORS.amber },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  name: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.charcoal },
  addr: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.copper },
  note: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, lineHeight: 17, marginTop: 6 },
  foot: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, lineHeight: 16, marginTop: 18, fontStyle: 'italic' },
});
