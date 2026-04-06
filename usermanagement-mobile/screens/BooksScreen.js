import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Button, TextInput, StyleSheet, Alert } from 'react-native';
import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8080';

export default function BooksScreen({ navigation }) {
  const [books, setBooks] = useState([]);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [genre, setGenre] = useState('');
  const [description, setDescription] = useState('');

  const fetchBooks = async () => {
    try {
      const res = await axios.get(`${API_BASE}/books`);
      setBooks(res.data);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not load books');
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const createBook = async () => {
    if (!title.trim()) return Alert.alert('Validate', 'Title is required');
    try {
      await axios.post(`${API_BASE}/books`, { title, author, genre, description });
      setTitle(''); setAuthor(''); setGenre(''); setDescription('');
      fetchBooks();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not create book');
    }
  };

  const deleteBook = async (id) => {
    try {
      await axios.delete(`${API_BASE}/books/${id}`);
      fetchBooks();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not delete book');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Books</Text>
      <FlatList
        data={books}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.bookCard}>
            <Text style={styles.bookTitle}>{item.title}</Text>
            <Text>{item.author || '-'} | {item.genre || '-'}</Text>
            <Text>{item.description || '-'}</Text>
            <View style={styles.actions}>
              <Button title="Delete" color="crimson" onPress={() => deleteBook(item.id)} />
            </View>
          </View>
        )}
      />

      <Text style={styles.subheader}>New Book</Text>
      <TextInput placeholder="Title" style={styles.input} value={title} onChangeText={setTitle} />
      <TextInput placeholder="Author" style={styles.input} value={author} onChangeText={setAuthor} />
      <TextInput placeholder="Genre" style={styles.input} value={genre} onChangeText={setGenre} />
      <TextInput placeholder="Description" style={styles.input} value={description} onChangeText={setDescription} />
      <Button title="Add Book" onPress={createBook} />
      <View style={{ height: 12 }} />
      <Button title="Go to Users" onPress={() => navigation.navigate('Users')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f7f7f7' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  subheader: { fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, marginBottom: 8, backgroundColor: 'white' },
  bookCard: { backgroundColor: 'white', borderRadius: 8, padding: 12, marginBottom: 8, elevation: 2 },
  bookTitle: { fontSize: 16, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
});
