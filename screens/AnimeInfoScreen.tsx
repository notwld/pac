import { useLayoutEffect, useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable, ScrollView, Modal, TextInput, FlatList } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { fetchAnimeDetails } from '../api/mal';
import { searchShows } from '../api/allanime';

type Params = { id: number };

export default function AnimeInfoScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id } = route.params as Params;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [q, setQ] = useState('');

  const { data } = useQuery({ queryKey: ['mal', id], queryFn: () => fetchAnimeDetails(id) });

  useLayoutEffect(() => {
    if (data?.title) {
      navigation.setOptions({ title: data.title });
    }
  }, [navigation, data?.title]);

  const allAnimeTitle = useMemo(() => data?.title ?? '', [data?.title]);
  const baseSearch = useQuery({
    queryKey: ['allanime-search', allAnimeTitle],
    queryFn: () => searchShows(allAnimeTitle),
    enabled: !!allAnimeTitle,
  });
  const liveSearch = useQuery({
    queryKey: ['allanime-search-live', q],
    queryFn: () => searchShows(q.trim()),
    enabled: pickerOpen && !!q.trim(),
  });
  const listToShow = pickerOpen ? (q.trim() ? liveSearch.data ?? [] : baseSearch.data ?? []) : baseSearch.data ?? [];
  const firstMatch = baseSearch.data?.[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 12 }}>
      <View style={{position:"absolute",top:0,left:0,right:0,bottom:0}}> 
      <Image source={require('../assets/yourname.jpg')} style={styles.banner} />
        <View style={{position:"absolute",top:0,left:0,height:'100%',width:'100%',backgroundColor:"rgba(0,0,0,0.5)"}} />

      </View>
      <View style={styles.headerRow}>
        {!!data?.main_picture?.large && (
          <Image source={{ uri: data.main_picture.large }} style={styles.poster} />
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>{data?.title ?? 'Loading…'}</Text>
          {!!data?.mean && <Text style={styles.meta}>Score: {data.mean}</Text>}
          {!!data?.rank && <Text style={styles.meta}>Rank: #{data.rank}</Text>}
          {!!data?.popularity && <Text style={styles.meta}>Popularity: #{data.popularity}</Text>}
          {!!data?.media_type && <Text style={styles.meta}>Type: {String(data.media_type).toUpperCase()}</Text>}
          {!!data?.num_episodes && <Text style={styles.meta}>Episodes: {data.num_episodes}</Text>}
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}
        onPress={() => {
          setPickerOpen(true);
        }}
      >
        <Text style={styles.btnText}>{firstMatch ? 'View Episodes' : 'Find Episodes'}</Text>
      </Pressable>

      {!!data?.synopsis && <Text style={styles.synopsis}>{data.synopsis}</Text>}

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select correct series/season</Text>
            <TextInput
              placeholder="Refine search..."
              placeholderTextColor="#94a3b8"
              value={q}
              onChangeText={setQ}
              style={styles.input}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            <FlatList
              data={listToShow}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 360 }}
              contentContainerStyle={{ paddingVertical: 6 }}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.pickItem, pressed && { opacity: 0.85 }]}
                  onPress={() => {
                    setPickerOpen(false);
                    navigation.navigate('Episodes', { id: item.id, title: item.name, malId: id });
                  }}
                >
                  <Text style={styles.pickTitle}>{item.name}</Text>
                  <Text style={styles.pickSub}>{item.availableEpisodesText}</Text>
                </Pressable>
              )}
              ListEmptyComponent={() => (
                <Text style={styles.hint}>No matches. Try another title.</Text>
              )}
            />
            <View style={{ alignItems: 'flex-end' }}>
              <Pressable onPress={() => setPickerOpen(false)}>
                <Text style={styles.close}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0c' },
  banner: { width: '100%', height: 240, backgroundColor: '#0b0b0c',margin:0,padding:0 },
  headerRow: { flexDirection: 'row',marginTop:70 },
  poster: { width: 120, height: 168, borderRadius: 10, backgroundColor: '#0b0b0c' },
  title: { color: '#e5e7eb', fontSize: 18, fontWeight: '700' },
  meta: { color: '#94a3b8', marginTop: 4 },
  synopsis: { color: '#cbd5e1', marginTop: 12, lineHeight: 20 },
  btn: { backgroundColor: '#1a1b1e', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#2b2f36', marginTop: 16, alignItems: 'center' },
  btnText: { color: '#a3e635', fontWeight: '700' },
  hint: { color: '#94a3b8', marginTop: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 520, backgroundColor: '#0f0f10', borderRadius: 12, borderWidth: 1, borderColor: '#1f2937', padding: 12 },
  modalTitle: { color: '#e5e7eb', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  input: { backgroundColor: '#111215', color: '#f1f5f9', borderRadius: 12, paddingHorizontal: 16, height: 44, borderWidth: 1, borderColor: '#1f2937' },
  pickItem: { backgroundColor: '#101113', borderRadius: 10, borderWidth: 1, borderColor: '#1f2937', padding: 12, marginVertical: 6 },
  pickTitle: { color: '#e5e7eb', fontWeight: '600' },
  pickSub: { color: '#94a3b8', marginTop: 4 },
  close: { color: '#a3e635', fontWeight: '700', padding: 10 },
});