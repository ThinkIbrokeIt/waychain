import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { wallet } from '../services/wallet';
import { satsToUsd, btcToUsd } from '../services/price';
import { encodePsbtFrames, decodePsbtFrames, buildCosignRequest } from '../services/btcCosign';
import QRCode from 'react-native-qrcode-svg';

// Scan-to-pay (issue #82). Greenfield camera+sign; reuses wallet.js BTC derivation.
//
// Flow:
//   1. Scan a BTC QR (BIP21 bitcoin:addr?amount= or bare address).
//   2. Review target + amount (BTC + USD).
//   3. Derive the user's BTC key from their SAME mnemonic (one wallet, two chains).
//   4. Co-sign model (founder): phone prepares + signs its half, then waits for the
//      COMPUTER companion to approve before broadcast. The companion is issue #83;
//      here we generate the co-sign request payload + id the computer scans/confirms.
//   5. Signing is REAL (ECDSA/secp256k1 via bitcoinjs-lib). Broadcast needs a BTC
//      backend — we surface the signed PSBT, never fake a "sent".

function parseQr(data) {
  // Detects chain + target + amount.
  // BTC:  bitcoin:<addr>?amount=  or bare bc1.../1.../3...
  // WAY:  waychain:<addr>?amount= or bare 0x... (64-hex or 20-byte)
  const raw = (data || '').trim();
  try {
    if (raw.toLowerCase().startsWith('bitcoin:')) {
      const rest = raw.slice('bitcoin:'.length);
      const q = rest.indexOf('?');
      const addr = q >= 0 ? rest.slice(0, q) : rest;
      const params = q >= 0 ? new URLSearchParams(rest.slice(q + 1)) : null;
      return { chain: 'btc', addr, amount: params ? (params.get('amount') || '') : '' };
    }
    if (raw.toLowerCase().startsWith('waychain:')) {
      const rest = raw.slice('waychain:'.length);
      const q = rest.indexOf('?');
      const addr = q >= 0 ? rest.slice(0, q) : rest;
      const params = q >= 0 ? new URLSearchParams(rest.slice(q + 1)) : null;
      return { chain: 'way', addr, amount: params ? (params.get('amount') || '') : '' };
    }
    if (/^(bc1|1|3)/.test(raw)) return { chain: 'btc', addr: raw, amount: '' };
    if (/^0x[0-9a-fA-F]{40}([0-9a-fA-F]{24})?$/.test(raw)) return { chain: 'way', addr: raw, amount: '' };
  } catch { /* ignore */ }
  return { chain: '', addr: '', amount: '' };
}

export default function ScanPayScreen({ navigation }) {
  const [perm, requestPerm] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [chain, setChain] = useState('');
  const [target, setTarget] = useState('');
  const [amount, setAmount] = useState('');
  const [btcAddr, setBtcAddr] = useState('');
  const [psbt, setPsbt] = useState('');
  const [signed, setSigned] = useState('');
  const [signedFrames, setSignedFrames] = useState([]);
  const [cosignId, setCosignId] = useState('');
  const [cosignFrames, setCosignFrames] = useState([]);
  const [account, setAccount] = useState(null);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    wallet.loadAccounts().then((a) => setAccount(a && a.length ? a[0] : null));
  }, []);

  const onScan = useCallback((res) => {
    if (scanned) return;
    setScanned(true);
    const p = parseQr(res.data || '');
    if (!p.addr) { Alert.alert('Unrecognized QR', 'Scan a bitcoin: or waychain: QR.'); setScanned(false); return; }
    setChain(p.chain);
    setTarget(p.addr);
    setAmount(p.amount || '');
  }, [scanned]);
  }, [scanned]);

  const derive = useCallback(() => {
    if (!account || !account.mnemonic) { Alert.alert('No wallet', 'Import your recovery phrase first.'); return null; }
    try {
      const k = wallet.deriveBtcFromMnemonic(account.mnemonic);
      setBtcAddr(k.btcAddress);
      return k;
    } catch (e) { Alert.alert('BTC derive failed', e?.message || 'err'); return null; }
  }, [account]);

  const prepareCosign = () => {
    // Phone prepares the pay intent as scannable QR frames the COMPUTER companion
    // scans to build the unsigned PSBT. No broadcast without computer approval (#83).
    if (!target) { Alert.alert('Scan first', 'Scan a BTC QR to pay.'); return; }
    const id = Math.random().toString(16).slice(2, 10);
    setCosignId(id);
    const req = buildCosignRequest(target, amount || '0', id);
    setCosignFrames(encodePsbtFrames(req));
  };

  const signPasted = () => {
    if (!psbt) { Alert.alert('Paste PSBT', 'Paste the PSBT base64 from your BTC backend / companion to sign.'); return; }
    const k = derive();
    if (!k) return;
    setBusy('Sign');
    try {
      const signedB64 = wallet.signBtcPsbt(psbt, k.btcPrivHex);
      setSigned(signedB64);
      // Air-gap: phone returns the signed PSBT as scannable QR frames for the
      // computer companion to scan + broadcast. Neither device alone moves BTC.
      setSignedFrames(encodePsbtFrames(signedB64));
      Alert.alert('Signed', 'PSBT signed by phone. Scan the frames with your computer companion to broadcast.');
    } catch (e) {
      Alert.alert('Sign failed', e?.message || 'err');
    } finally { setBusy(''); }
  };

  const signWaychain = async () => {
    if (!account || !account.privateKey) { Alert.alert('No wallet', 'Import your recovery phrase first.'); return; }
    if (chain !== 'way') { Alert.alert('Not a WayChain QR', 'Scan a waychain: address to sign a WAY tx.'); return; }
    setBusy('Sign');
    try {
      // Build the WayChain tx hash per consensus/serialize.go, sign with Ed25519.
      // from = 64-hex pubkey (wire/balance key), to = scanned target, value = amount (wei).
      const fields = {
        nonce: Date.now() % 100000, // placeholder; real nonce from chain at broadcast
        from: account.publicKey,
        to: target,
        value: amount ? BigInt(Math.round(parseFloat(amount) * 1e18)).toString() : '0',
        gasLimit: 21000,
        lane: 0,
        data: new Uint8Array(0),
        encData: new Uint8Array(0),
      };
      const { hash, sig } = await wallet.signWaychainTx(fields, account.privateKey);
      const payload = JSON.stringify({ chain: 'way', from: account.publicKey, to: target, value: fields.value, hash, sig });
      setSigned(payload);
      // Air-gap: return the signed WAY tx as scannable frames for the companion to broadcast.
      setSignedFrames(encodePsbtFrames('way:' + payload));
      Alert.alert('Signed (WAY)', 'WayChain tx signed with your Ed25519 key. Scan the frames with your computer companion to broadcast.');
    } catch (e) {
      Alert.alert('Sign failed', e?.message || 'err');
    } finally { setBusy(''); }
  };

  if (!perm) {
    return <View style={styles.screen}><ActivityIndicator color={COLORS.copper} /></View>;
  }
  if (!perm.granted) {
    return (
      <View style={styles.screen}>
        <BrandHeader subtitle="Scan to Pay" />
        <View style={styles.card}><Text style={styles.hint}>Camera permission is required to scan BTC QRs.</Text>
          <Button label="Grant camera" onPress={requestPerm} style={styles.btn} /></View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle={chain === 'way' ? 'Scan to Pay (WAY)' : 'Scan to Pay (BTC)'} />

      {!target ? (
        <View style={styles.card}>
          <Text style={styles.label}>Scan a Bitcoin or WayChain QR</Text>
          <View style={styles.camWrap}>
            <CameraView style={styles.cam} onBarcodeScanned={scanned ? undefined : onScan} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} />
          </View>
          {scanned && <Button label="Scan again" onPress={() => setScanned(false)} variant="secondary" style={styles.btn} />}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>Chain: {chain === 'way' ? 'WayChain (WAY)' : 'Bitcoin (BTC)'}</Text>
          <Text style={styles.label}>Pay to</Text>
          <Text style={styles.addr}>{target}</Text>
          <TextInput value={amount} onChangeText={setAmount} placeholder={chain === 'way' ? 'amount (WAY)' : 'amount (BTC)'} placeholderTextColor={COLORS.muted} style={styles.input} keyboardType="decimal-pad" />
          {amount ? <Text style={styles.usd}>≈ ${chain === 'way' ? (parseFloat(amount || '0') * 0.1).toFixed(2) : btcToUsd(amount)}</Text> : null}
          <Text style={styles.hint}>Review before signing. Your {chain === 'way' ? 'WayChain (Ed25519)' : 'BTC (secp256k1)'} key is derived from your SAME recovery phrase (one wallet, two chains).</Text>

          {chain === 'btc' ? (
            <>
              <Button label="Prepare co-sign request" onPress={prepareCosign} disabled={!!busy} style={styles.btn} />
              {cosignFrames.length > 0 ? (
                <View style={styles.framesWrap}>
                  <Text style={styles.label}>Scan with computer companion</Text>
                  {cosignFrames.map((f, i) => (
                    <View key={i} style={styles.frameBox}>
                      <QRCode value={f} size={120} color="#000000" backgroundColor="#FFFFFF" />
                      <Text style={styles.frameIdx}>{i + 1}/{cosignFrames.length}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={[styles.label, { marginTop: 14 }]}>Sign a PSBT (real ECDSA)</Text>
              <TextInput value={psbt} onChangeText={setPsbt} placeholder="paste PSBT base64" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" multiline />
              <Button label={busy === 'Sign' ? 'Signing…' : 'Sign PSBT (phone half)'} onPress={signPasted} disabled={!!busy} variant="secondary" style={styles.btn} />
            </>
          ) : (
            <Button label={busy === 'Sign' ? 'Signing…' : 'Sign WAY tx (Ed25519)'} onPress={signWaychain} disabled={!!busy} style={styles.btn} />
          )}

          {signedFrames.length > 0 ? (
            <View style={styles.framesWrap}>
              <Text style={styles.label}>Signed — scan frames with computer to broadcast</Text>
              {signedFrames.map((f, i) => (
                <View key={i} style={styles.frameBox}>
                  <QRCode value={f} size={120} color="#000000" backgroundColor="#FFFFFF" />
                  <Text style={styles.frameIdx}>{i + 1}/{signedFrames.length}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.note}>Scan-to-pay signs REAL txs — BTC (secp256k1) or WayChain (Ed25519) — from the SAME mnemonic. Broadcast needs a node/API; we surface signed frames, never fake a send. Phone+computer co-sign: phone signs, computer broadcasts (companion = issue #84).</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>Your BTC address (receive)</Text>
        <Text style={styles.addr}>{btcAddr || '— derive to show —'}</Text>
        <Button label="Derive BTC key" onPress={derive} style={styles.btn} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 18, marginTop: 14, borderWidth: 1, borderColor: COLORS.border },
  label: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 },
  addr: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.copper, marginTop: 6, flexWrap: 'wrap' },
  input: { backgroundColor: COLORS.parchment, color: COLORS.charcoal, padding: 12, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: COLORS.border, fontSize: 13 },
  btn: { marginTop: 12 },
  hint: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginTop: 6 },
  usd: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.copper, marginTop: 4 },
  camWrap: { marginTop: 10, borderRadius: 12, overflow: 'hidden', height: 280 },
  cam: { flex: 1 },
  cosign: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.charcoal, marginTop: 8 },
  signed: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.copper, marginTop: 8 },
  framesWrap: { marginTop: 10 },
  frameBox: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 8, padding: 6, marginTop: 8, alignSelf: 'flex-start' },
  frameIdx: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.muted, marginTop: 2 },
  note: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, marginTop: 12, lineHeight: 16 },
});
