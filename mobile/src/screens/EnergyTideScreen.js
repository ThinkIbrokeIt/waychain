import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ScrollView, TouchableOpacity } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';

const STORE_KEY = 'energyTideEntries';

export default function EnergyTideScreen() {
  const [entry, setEntry] = useState('');
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORE_KEY);
        if (raw) setEntries(JSON.parse(raw));
      } catch (e) {
        // corrupted store — start fresh
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = async (next) => {
    try {
      await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(next));
    } catch (e) {
      Alert.alert('Error', 'Failed to save entry to vault.');
    }
  };

  const anchorTruth = async () => {
    if (!entry.trim()) { Alert.alert('Error', 'Enter truth to anchor'); return; }
    const next = [{ id: String(Date.now()), text: entry.trim(), ts: Date.now() }, ...entries];
    setEntries(next);
    setEntry('');
    await persist(next);
    Alert.alert('Truth Anchored', 'Secured to your vault. Eternal.');
  };

  const deleteEntry = (id) => {
    Alert.alert('Delete entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const next = entries.filter(e => e.id !== id);
          setEntries(next);
          await persist(next);
        }
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Immutable Knowledge Vault" />
      <Text style={styles.lead}>Anchor your truth. Eternal.</Text>
      <TextInput
        placeholder="Truth to anchor…"
        value={entry}
        onChangeText={setEntry}
        style={styles.input}
        multiline
        placeholderTextColor={COLORS.muted}
      />
      <Button label="Anchor Truth" onPress={anchorTruth} style={styles.cta} />
      <View style={styles.list}>
        {!loaded && <Text style={styles.empty}>Unsealing vault…</Text>}
        {loaded && entries.length === 0 && <Text style={styles.empty}>No entries anchored yet.</Text>}
        {loaded && entries.map(e => (
          <View key={e.id} style={styles.entryCard}>
            <Text style={styles.entryText}>{e.text}</Text>
            <View style={styles.entryFoot}>
              <Text style={styles.entryTime}>
                {e.ts ? new Date(e.ts).toLocaleString() : ''}
              </Text>
              <TouchableOpacity onPress={() => deleteEntry(e.id)}>
                <Text style={styles.delete}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, paddingBottom: 32 },
  lead: { fontFamily: FONTS.display, fontSize: 22, color: COLORS.charcoal, textAlign: 'center', marginVertical: 18 },
  input: { backgroundColor: COLORS.card, color: COLORS.charcoal, padding: 16, borderRadius: 12, minHeight: 120, marginHorizontal: 20, borderWidth: 1, borderColor: COLORS.border, textAlignVertical: 'top' },
  cta: { marginHorizontal: 20, marginTop: 16 },
  list: { paddingHorizontal: 20, marginTop: 20 },
  entryCard: { backgroundColor: COLORS.card, borderLeftWidth: 4, borderLeftColor: COLORS.copper, borderRadius: 10, padding: 14, marginBottom: 10 },
  entryText: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.charcoal },
  entryFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  entryTime: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted },
  delete: { fontFamily: FONTS.medium, fontSize: 13, color: '#B23A3A' },
  empty: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.muted, textAlign: 'center', marginTop: 20 },
});
