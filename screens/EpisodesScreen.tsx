import { useLayoutEffect, useMemo, useState } from 'react';
import { View, FlatList, Pressable, Text, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { listEpisodes } from '../api/allanime';

type Params = { id: string; title: string; malId?: number };

export default function EpisodesScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id, title, malId } = route.params as Params;
  const [descending, setDescending] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({
      title,
      headerRight: () => (
        <Pressable onPress={() => setDescending((v) => !v)}>
          <Text style={styles.sortBtn}>{descending ? '↓' : '↑'}</Text>
        </Pressable>
      ),
    });
  }, [navigation, title, descending]);

  const { data } = useQuery({ queryKey: ['episodes', id], queryFn: () => listEpisodes(id) });
  const sorted = useMemo(() => {
    const list = [...(data ?? [])];
    list.sort((a, b) => Number(a) - Number(b));
    return descending ? list.reverse() : list;
  }, [data, descending]);

  return (
    <View style={styles.container}>
      <FlatList
        data={sorted}
        keyExtractor={(ep) => ep}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
            onPress={() => navigation.navigate('Player', { id, title, ep: item, malId })}
          >
            <Text style={styles.title}>Episode {item}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0c', padding: 12 },
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
  sortBtn: { color: '#a3e635', fontSize: 18, paddingHorizontal: 4 },
});