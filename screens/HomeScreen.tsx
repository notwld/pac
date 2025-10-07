import { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, Image, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { fetchAnimeRanking, fetchSeasonalAnime, getCurrentSeason, RankingType } from '../api/mal';

const rankingSections: { key: RankingType; title: string }[] = [
  { key: 'airing', title: 'Top Airing' },
  { key: 'upcoming', title: 'Top Upcoming' },
  { key: 'bypopularity', title: 'Most Popular' },
];

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const current = useMemo(() => getCurrentSeason(), []);
  const [q, setQ] = useState('');

  const seasonal = useQuery({
    queryKey: ['seasonal', current.year, current.season],
    queryFn: () => fetchSeasonalAnime(current.year, current.season, 24),
  });

  const rankings = rankingSections.map((s) =>
    useQuery({ queryKey: ['rank', s.key], queryFn: () => fetchAnimeRanking(s.key, 20) })
  );

  const renderCard = (item: any) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      onPress={() => navigation.navigate('Info', { id: item.node.id })}
    >
      {!!item.node.main_picture?.medium && (
        <Image source={{ uri: item.node.main_picture.medium }} style={styles.poster} />
      )}
      <Text numberOfLines={2} style={styles.title}>{item.node.title}</Text>
    </Pressable>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
        <TextInput
          placeholder="Search anime..."
          placeholderTextColor="#94a3b8"
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => q.trim() && navigation.navigate('Search', { q })}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      <View style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
        <Text style={styles.h1}>Seasonal · {current.season.toUpperCase()} {current.year}</Text>
        <View style={styles.sectionActions}>
          <Pressable onPress={() => navigation.navigate('List', { kind: 'season', year: current.year, season: current.season })}>
            <Text style={styles.viewAll}>View all</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={seasonal.data?.data ?? []}
        keyExtractor={(it) => String(it.node.id)}
        renderItem={({ item }) => renderCard(item)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8 }}
        style={{ marginBottom: 4 }}
      />

      {rankingSections.map((s, idx) => (
        <View key={s.key} style={{ marginTop: 12 }}>
          <View style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
            <Text style={styles.h2}>{s.title}</Text>
            <View style={styles.sectionActions}>
              <Pressable onPress={() => navigation.navigate('List', { kind: 'ranking', rankingType: s.key })}>
                <Text style={styles.viewAll}>View all</Text>
              </Pressable>
            </View>
          </View>
          <FlatList
            data={rankings[idx].data?.data ?? []}
            keyExtractor={(it) => String(it.node.id)}
            renderItem={({ item }) => renderCard(item)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 8 }}
          />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0c' },
  h1: { color: '#e5e7eb', fontSize: 18, fontWeight: '700', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 6 },
  h2: { color: '#e5e7eb', fontSize: 16, fontWeight: '700', paddingHorizontal: 12, paddingBottom: 6 },
  input: {
    backgroundColor: '#111215',
    color: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  card: {
    width: 120,
    marginHorizontal: 6,
    backgroundColor: '#101113',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    overflow: 'hidden',
  },
  poster: { width: '100%', height: 160, backgroundColor: '#0b0b0c' },
  title: { color: '#cbd5e1', fontSize: 12, padding: 8 },
  sectionActions: { paddingHorizontal: 12, paddingTop: 4 },
  viewAll: { color: '#a3e635', fontWeight: '600' },
});