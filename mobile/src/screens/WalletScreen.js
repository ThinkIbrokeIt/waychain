import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { wallet } from '../services/wallet';
import { waychainRPC } from '../services/rpc';
import { addTx } from '../services/secure';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { formatBalance } from '../utils/format';

export default function WalletScreen({ navigation }) {
  const [accounts, setAccounts] = useState([]);
  const [active, setActive] = useState(null);
  const [balance, setBalance] = useState('0');
  const [busy, setBusy] = useState(false);
  const [revealMnemonic, setRevealMnemonic] = useState(null);
  const [revealAddr, setRevealAddr] = useState(null);
  const [needsBackup, setNeedsBackup] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const accs = await wallet.loadAccounts();
    setAccounts(accs);
    if (accs.length) {
      setActive(prev => accs.find(a => prev && a.address === prev.address) || accs[0]);
      setNeedsBackup(!(await wallet.allBackedUp()));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refreshBalance = useCallback(async (addr) => {
    try { const bal = await waychainRPC.getBalance(addr); setBalance(formatBalance(bal)); }
    catch { setBalance('0'); }
  }, []);

  useEffect(() => { if (active) refreshBalance(active.publicKey); }, [active, refreshBalance]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (active) await refreshBalance(active.publicKey);
    setRefreshing(false);
  }, [active, refreshBalance]);

  const createWallet = async () => {
    try {
      setBusy(true);
      const acc = await wallet.createAccount(12);
      const accs = await wallet.loadAccounts();
      setAccounts(accs);
      setActive(acc);
      setRevealMnemonic(acc.mnemonic);
      setRevealAddr(acc.address);
      setNeedsBackup(true);
    } catch (e) {
      Alert.alert('Error', 'Wallet creation failed: ' + (e?.message || e));
    } finally { setBusy(false); }
  };

  const confirmSaved = async () => {
    const addr = revealAddr || active?.address;
    if (addr) {
      const next = await wallet.markBackedUp(addr);
      setAccounts(next);
      setActive(next.find(a => a.address === addr));
    }
    setRevealMnemonic(null);
    setRevealAddr(null);
    setNeedsBackup(!(await wallet.allBackedUp()));
  };

  const doImport = async (text) => {
    try {
      setBusy(true);
      const acc = text.split(/\s+/).length >= 12
        ? await wallet.importMnemonic(text)
        : await wallet.importPrivateKey(text);
      const accs = await wallet.loadAccounts();
      setAccounts(accs);
      setActive(acc);
      Alert.alert('Imported', 'Account added: ' + acc.address.slice(0, 12) + '…');
    } catch (e) {
      Alert.alert('Import failed', e?.message || 'Invalid seed or key');
    } finally { setBusy(false); }
  };

  const onSent = async (tx) => { await addTx(tx); };
  const goSend = () => navigation.navigate('Send', { account: active, onSent });

  // Forced backup gate: if any account needs backup, block until user confirms.
  if (needsBackup && accounts.length > 0 && !revealMnemonic) {
    const pending = accounts.find(a => !a.backedUp) || active;
    return (
      <View style={styles.gate}>
        <BrandHeader subtitle="Secure your wallet" />
        <View style={styles.gateCard}>
          <Text style={styles.gateTitle}>Back up required</Text>
          <Text style={styles.gateText}>
            One account still needs its recovery phrase backed up. This is the only way to recover your funds if this device is lost.
          </Text>
          <Button label="Show recovery phrase" onPress={() => { setRevealAddr(pending.address); setRevealMnemonic(pending.mnemonic); }} style={styles.gateBtn} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.copper} />}>
      <BrandHeader subtitle="Self-Sovereign Wallet" />

      {accounts.length > 0 && (
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={createWallet} disabled={busy}>
            <Text style={styles.iconBtnText}>＋</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.iconBtnText}>⚙</Text>
          </TouchableOpacity>
        </View>
      )}

      {revealMnemonic && (
        <View style={styles.reveal}>
          <Text style={styles.revealTitle}>⚠️ Write this down now</Text>
          <Text style={styles.revealText} selectable>{revealMnemonic}</Text>
          <Text style={styles.revealNote}>This is the only time it will be shown. Anyone with these words controls your funds.</Text>
          <Button label="I've saved it" onPress={confirmSaved} style={styles.revealBtn} />
        </View>
      )}

      {accounts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.lead}>Your keys. Your chain.</Text>
          <Text style={styles.sub}>Create a WayChain wallet secured on this device.</Text>
          <Button label={busy ? 'Creating…' : 'Create New Wallet'} onPress={createWallet} disabled={busy} style={styles.cta} />
          <TouchableOpacity onPress={() => promptImport(doImport)}>
            <Text style={styles.link}>Import existing wallet</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          {active && !active.backedUp && (
            <TouchableOpacity style={styles.warn} onPress={() => { setRevealAddr(active.address); setRevealMnemonic(active.mnemonic); }}>
              <Text style={styles.warnText}>⚠️ Not backed up — tap to view recovery phrase</Text>
            </TouchableOpacity>
          )}

          <View style={styles.hero}>
            <Text style={styles.heroLabel}>Total Balance</Text>
            <Text style={styles.balance}>{balance}<Text style={styles.balanceUnit}> WAY</Text></Text>
            <View style={styles.heroAddrRow}>
              <Text style={styles.heroAddr} selectable numberOfLines={1}>{active?.address}</Text>
            </View>
          </View>

          <Text style={styles.label}>Accounts ({accounts.length})</Text>
          <View style={styles.chips}>
            {accounts.map((a, i) => (
              <TouchableOpacity key={a.address} style={[styles.chip, a.address === active?.address && styles.chipActive]} onPress={() => setActive(a)}>
                <Text style={styles.chipLabel}>{a.label || ('Account ' + (i + 1))}{a.backedUp ? '  ✓' : '  ⚠'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.grid}>
            <Button label="Receive" onPress={() => navigation.navigate('Receive', { address: active?.address })} variant="secondary" style={styles.gridBtn} />
            <Button label="Send" onPress={goSend} variant="secondary" style={styles.gridBtn} />
            <Button label="History" onPress={() => navigation.navigate('History')} variant="secondary" style={styles.gridBtn} />
            <Button label="Address Book" onPress={() => navigation.navigate('AddressBook')} variant="secondary" style={styles.gridBtn} />
            <Button label="Tokens" onPress={() => navigation.navigate('Tokens')} variant="secondary" style={styles.gridBtn} />
            <Button label="Identity" onPress={() => navigation.navigate('Identity')} variant="secondary" style={styles.gridBtn} />
            <Button label="Locks" onPress={() => navigation.navigate('Locks')} variant="secondary" style={styles.gridBtn} />
            <Button label="Protocol" onPress={() => navigation.navigate('Protocol')} variant="secondary" style={styles.gridBtn} />
          </View>

          <Text style={styles.sectionTitle}>Protocol Precompiles</Text>
          <View style={styles.grid}>
            <Button label="TwoWay Vault" onPress={() => navigation.navigate('TwoWayVault')} variant="secondary" style={styles.gridBtn} />
            <Button label="Swap Route" onPress={() => navigation.navigate('SwapRoute')} variant="secondary" style={styles.gridBtn} />
            <Button label="Stability Pool" onPress={() => navigation.navigate('StabilityPool')} variant="secondary" style={styles.gridBtn} />
            <Button label="Bitcoin Reg" onPress={() => navigation.navigate('BitcoinRegistry')} variant="secondary" style={styles.gridBtn} />
            <Button label="Dead Man's" onPress={() => navigation.navigate('DeadMansSwitch')} variant="secondary" style={styles.gridBtn} />
            <Button label="Account Mgr" onPress={() => navigation.navigate('AccountManager')} variant="secondary" style={styles.gridBtn} />
            <Button label="State Rent" onPress={() => navigation.navigate('StateRent')} variant="secondary" style={styles.gridBtn} />
            <Button label="Mineral Rts" onPress={() => navigation.navigate('MineralRights')} variant="secondary" style={styles.gridBtn} />
            <Button label="Templates" onPress={() => navigation.navigate('TemplateRegistry')} variant="secondary" style={styles.gridBtn} />
            <Button label="Keccak256" onPress={() => navigation.navigate('Keccak256')} variant="secondary" style={styles.gridBtn} />
          </View>

          <Text style={styles.sectionTitle}>Dox_Dev & Community</Text>
          <View style={styles.grid}>
            <Button label="Dox_Dev" onPress={() => navigation.navigate('DoxDev')} variant="secondary" style={styles.gridBtn} />
            <Button label="Community Tasks" onPress={() => navigation.navigate('CommunityTasks')} variant="secondary" style={styles.gridBtn} />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function promptImport(doImport) {
  Alert.prompt('Import', 'Seed phrase (12+ words) or private key', async (text) => {
    if (text && text.trim()) doImport(text.trim());
  });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', padding: 32 },
  lead: { fontFamily: FONTS.display, fontSize: 26, color: COLORS.charcoal, textAlign: 'center', marginBottom: 8 },
  sub: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.muted, textAlign: 'center', marginBottom: 28 },
  cta: { marginTop: 8 },
  link: { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.copper, textAlign: 'center', marginTop: 20 },
  card: { margin: 16, backgroundColor: COLORS.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: COLORS.border, shadowColor: COLORS.charcoal, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  hero: { alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 4 },
  heroLabel: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 2 },
  balance: { fontFamily: FONTS.display, fontSize: 42, color: COLORS.copper, marginTop: 4 },
  balanceUnit: { fontFamily: FONTS.medium, fontSize: 18, color: COLORS.muted },
  heroAddrRow: { width: '100%', marginTop: 10, backgroundColor: COLORS.parchment, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  heroAddr: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.charcoal, textAlign: 'center' },
  label: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { backgroundColor: COLORS.parchment, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { borderColor: COLORS.copper, backgroundColor: 'rgba(184,115,51,0.18)' },
  chipLabel: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.charcoal },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 },
  gridBtn: { flex: 1, minWidth: '45%', minHeight: 42 },
  sectionTitle: { fontFamily: FONTS.display, fontSize: 16, color: COLORS.copper, marginTop: 22, marginBottom: 2, letterSpacing: 1 },
  topActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginTop: -8, marginBottom: 4 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.copper, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.copper, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  iconBtnText: { fontFamily: FONTS.bold, fontSize: 22, color: COLORS.copper, textAlign: 'center' },
  reveal: { margin: 16, backgroundColor: 'rgba(255,191,0,0.1)', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: COLORS.amber },
  revealTitle: { fontFamily: FONTS.display, fontSize: 18, color: COLORS.amber, textAlign: 'center' },
  revealText: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.charcoal, marginTop: 10, lineHeight: 24 },
  revealNote: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 10 },
  revealBtn: { marginTop: 12 },
  warn: { backgroundColor: 'rgba(229,57,53,0.12)', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.red },
  warnText: { fontFamily: FONTS.medium, fontSize: 13, color: '#FF8A80', textAlign: 'center' },
  gate: { flex: 1, backgroundColor: COLORS.parchment, padding: 24 },
  gateCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 28, borderWidth: 1, borderColor: COLORS.amber, marginTop: 24 },
  gateTitle: { fontFamily: FONTS.display, fontSize: 24, color: COLORS.charcoal, textAlign: 'center', marginBottom: 12 },
  gateText: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.muted, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  gateBtn: { marginTop: 8 },
});
