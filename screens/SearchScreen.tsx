import { useEffect, useState } from 'react';
import { View, TextInput, FlatList, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { searchShows } from '../api/allanime';

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initialQ: string = route.params?.q ?? '';
  const [q, setQ] = useState(initialQ);
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['search', q],
    queryFn: () => searchShows(q.trim()),
    enabled: false,
  });

  useEffect(() => {
    if (initialQ && initialQ.trim()) {
      refetch();
    }
  }, [initialQ]);

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Search anime..."
        placeholderTextColor="#94a3b8"
        value={q}
        onChangeText={setQ}
        onSubmitEditing={() => q.trim() && refetch()}
        style={styles.input}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 8 }}
        ListEmptyComponent={
          !isFetching && q.trim()
            ? () => <Text style={styles.empty}>No results</Text>
            : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
            onPress={() => navigation.navigate('Episodes', { id: item.id, title: item.name })}
          >
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.subtitle}>{item.availableEpisodesText}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0c', padding: 12 },
  input: {
    backgroundColor: '#111215',
    color: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#101113',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginHorizontal: 4,
    marginVertical: 6,
  },
  title: { color: '#e5e7eb', fontSize: 16, fontWeight: '600' },
  subtitle: { color: '#94a3b8', marginTop: 4 },
  empty: { color: '#94a3b8', textAlign: 'center', marginTop: 24 },
});