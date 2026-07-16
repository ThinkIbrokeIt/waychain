import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { COLORS, FONTS } from '../theme';
import BrandHeader from '../components/BrandHeader';
import Button from '../components/Button';
import { getAddressBook, addAddressEntry, removeAddressEntry } from '../services/secure';

export default function AddressBookScreen() {
  const [book, setBook] = useState([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  const reload = () => getAddressBook().then(setBook);
  useEffect(() => { reload(); }, []);

  const add = async () => {
    if (!name.trim() || !address.trim()) { Alert.alert('Missing', 'Enter both a name and address.'); return; }
    if (!/^[0-9a-fA-F]{64}$/.test(address.trim().replace(/^0x/, ''))) { Alert.alert('Invalid', 'WayChain address must be 64 hex chars.'); return; }
    await addAddressEntry({ name, address });
    setName(''); setAddress(''); reload();
  };

  const del = async (addr) => { await removeAddressEntry(addr); reload(); };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BrandHeader subtitle="Address Book" />
      <Text style={styles.label}>Saved contacts (encrypted on device)</Text>
      {book.length === 0 && <Text style={styles.empty}>No saved addresses yet.</Text>}
      {book.map((e) => (
        <View key={e.address} style={styles.item}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{e.name}</Text>
            <Text style={styles.addr}>{e.address.slice(0, 16)}…{e.address.slice(-8)}</Text>
          </View>
          <TouchableOpacity onPress={() => del(e.address)}><Text style={styles.del}>Delete</Text></TouchableOpacity>
        </View>
      ))}

      <Text style={styles.label}>Add contact</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Name" placeholderTextColor={COLORS.muted} style={styles.input} />
      <TextInput value={address} onChangeText={setAddress} placeholder="0x… address" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" />
      <Button label="Save contact" onPress={add} style={styles.btn} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  label: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 16 },
  empty: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.muted, marginTop: 8 },
  item: { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center' },
  name: { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.charcoal },
  addr: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted },
  del: { fontFamily: FONTS.medium, fontSize: 14, color: '#B00020' },
  input: { backgroundColor: COLORS.card, color: COLORS.charcoal, padding: 14, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: COLORS.border },
  btn: { marginTop: 16 },
});
