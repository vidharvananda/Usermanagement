import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Button, TextInput, StyleSheet, Alert } from 'react-native';
import axios from 'axios';

const API_BASE = 'http://localhost:8080';

export default function UsersScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/users`);
      setUsers(res.data);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not load users');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const createUser = async () => {
    if (!name.trim()) return Alert.alert('Validate', 'Name is required');
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return Alert.alert('Validate', 'Enter a valid email address');
    }
    try {
      await axios.post(`${API_BASE}/users`, { name, email, phone, address });
      setName('');
      setEmail('');
      setPhone('');
      setAddress('');
      fetchUsers();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not create user');
    }
  };

  const deleteUser = async (id) => {
    try {
      await axios.delete(`${API_BASE}/users/${id}`);
      fetchUsers();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not delete user');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Users</Text>
      <FlatList
        data={users}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            <Text style={styles.userName}>{item.name}</Text>
            <Text>{item.email || '-'} | {item.phone || '-'}</Text>
            <Text>{item.address || '-'}</Text>
            <View style={styles.actions}>
              <Button title="Delete" onPress={() => deleteUser(item.id)} color="crimson" />
            </View>
          </View>
        )}
      />

      <Text style={styles.subheader}>New User</Text>
      <TextInput placeholder="Name" style={styles.input} value={name} onChangeText={setName} />
      <TextInput placeholder="Email" style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" />
      <TextInput placeholder="Phone" style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextInput placeholder="Address" style={styles.input} value={address} onChangeText={setAddress} />
      <Button title="Add User" onPress={createUser} />

      <View style={{ height: 12 }} />
      <Button title="Go to Books" onPress={() => navigation.navigate('Books')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f7f7f7' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  subheader: { fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, marginBottom: 8, backgroundColor: 'white' },
  userCard: { backgroundColor: 'white', borderRadius: 8, padding: 12, marginBottom: 8, elevation: 2 },
  userName: { fontSize: 16, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
});