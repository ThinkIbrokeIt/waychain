import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { wallet } from '../services/wallet';
import { waychainRPC } from '../services/rpc';
import { useNavigation } from '@react-navigation/native';

// WIFR Door — the onboarding key to the WayChain Quest.
// Truth (2026-07-17, #65 + #62): 0x21 is now the Keccak256 precompile, NOT a
// reward pool. The WIFR Door is the `wifr-bridge` quest at TaskRegistry (0x23):
// burn 1 WIFR on Solana -> CrossChainAttestation (0x1F, "solana-waychain") witnesses
// it -> autopilot (or Dox_Dev L2+) verifies -> 50 WAY from treasury (0x03).
// This screen reads live quest state and deep-links to Quests. It does NOT call
// any removed 0x21 method.

const TASK_ID = 'wifr-bridge';

function encodeTaskId(task) {
  // left-aligned ASCII in 32-byte buffer (chain convention)
  return task.padEnd(32, ' ');
}

export default function WIFRScreen() {
  const navigation = useNavigation();
  const [account, setAccount] = useState(null);
  const [pool, setPool] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAccount = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    setAccount(accs && accs.length ? accs[0] : null);
  }, []);

  const fetchState = useCallback(async () => {
    setLoading(true);
    try {
      // Live quest pool remaining (treasury 0x03, WAY available to pay)
      const rem = await waychainRPC.call('way_questPoolRemaining', []);
      setPool(rem);
    } catch {
      setPool(null);
    }
    try {
      if (account) {
        const st = await waychainRPC.call('way_taskStatus', [encodeTaskId(TASK_ID)]);
        setStatus(typeof st === 'string' ? st : (st && st.result) || 'none');
      } else {
        setStatus(null);
      }
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => { loadAccount(); }, [loadAccount]);
  useEffect(() => { fetchState(); }, [fetchState]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="WIFR Door" />

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Treasury (0x03) WAY balance</Text>
        <Text style={styles.heroVal}>
          {loading ? '—' : (pool == null ? 'n/a' : `${pool} WAY`)}
        </Text>
        <Text style={styles.heroSub}>
          {pool === '0x0' || pool === 0 || pool === '0' || pool === '0x0000000000000000000000000000000000000000000000000000000000000000'
            ? 'unfunded on the live node — quest payouts need a treasury top-up (questFund)'
            : 'treasury 0x03 · cap = 5% live supply'}
        </Text>
      </View>

      <View style={styles.steps}>
        <Text style={styles.stepsTitle}>The Door</Text>
        <View style={styles.step}><Text style={styles.stepNum}>1</Text><Text style={styles.stepTxt}>Burn <Text style={styles.bold}>1 WIFR</Text> on Solana (PUMP.fun) to the designated sink.</Text></View>
        <View style={styles.step}><Text style={styles.stepNum}>2</Text><Text style={styles.stepTxt}>A Dox_Dev attester witnesses it at <Text style={styles.mono}>0x1F</Text> (CrossChainAttestation, <Text style={styles.mono}>solana-waychain</Text>).</Text></View>
        <View style={styles.step}><Text style={styles.stepNum}>3</Text><Text style={styles.stepTxt}>The <Text style={styles.mono}>wifr-bridge</Text> quest (0x23) opens: <Text style={styles.bold}>50 WAY</Text> from the treasury (0x03).</Text></View>
      </View>

      {account && (
        <View style={styles.statusBox}>
          <Text style={styles.boxTitle}>Your wifr-bridge status</Text>
          <Text style={styles.statusVal}>
            {loading ? 'checking…' : (status || 'connect wallet to view')}
          </Text>
          <Text style={styles.note}>
            Status reads from way_taskStatus on the live node. Claim is gated by the
            in-protocol 0x1F attestation (no bot) — see issue #62.
          </Text>
        </View>
      )}

      {!account && (
        <View style={styles.warnBox}>
          <Text style={styles.warnText}>No wallet found. Create or import a wallet to track your Door status.</Text>
        </View>
      )}

      <Button label="Open Quests" onPress={() => navigation.navigate('Quests')} style={styles.questsBtn} />
      <TouchableOpacity style={styles.refresh} onPress={fetchState}>
        <Text style={styles.refreshText}>Tap to refresh</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  hero: { backgroundColor: COLORS.card, borderRadius: 16, padding: 22, marginTop: 8, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  heroLabel: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 2 },
  heroVal: { fontFamily: FONTS.display, fontSize: 30, color: COLORS.copper, marginTop: 6 },
  heroSub: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, marginTop: 4 },
  steps: { backgroundColor: COLORS.card, borderRadius: 14, padding: 20, marginTop: 16, borderWidth: 1, borderColor: COLORS.border },
  stepsTitle: { fontFamily: FONTS.display, fontSize: 18, color: COLORS.charcoal, marginBottom: 12 },
  step: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  stepNum: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.amber, width: 24 },
  stepTxt: { flex: 1, fontFamily: FONTS.body, fontSize: 14, color: COLORS.charcoal, lineHeight: 20 },
  bold: { fontFamily: FONTS.bold },
  mono: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.copper },
  statusBox: { backgroundColor: COLORS.card, borderRadius: 14, padding: 20, marginTop: 16, borderWidth: 1, borderColor: COLORS.border },
  boxTitle: { fontFamily: FONTS.display, fontSize: 16, color: COLORS.charcoal, marginBottom: 8 },
  statusVal: { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.amber, textTransform: 'capitalize' },
  note: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 10, lineHeight: 18 },
  warnBox: { backgroundColor: 'rgba(229,57,53,0.10)', borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: COLORS.red },
  warnText: { fontFamily: FONTS.body, fontSize: 13, color: '#FF8A80', textAlign: 'center' },
  questsBtn: { marginTop: 18 },
  refresh: { marginTop: 14, alignItems: 'center' },
  refreshText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.copper },
});
