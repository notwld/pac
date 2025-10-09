import { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, Image, StyleSheet, ScrollView, ActivityIndicator, TextInput, Modal, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { fetchAnimeRanking, fetchSeasonalAnime, getCurrentSeason, RankingType, fetchAnimeDetails } from '../api/mal';

const topFilters: { key: RankingType; label: string }[] = [
  { key: 'tv', label: 'TV' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'airing', label: 'Airing' },
  { key: 'movie', label: 'Movies' },
];

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const current = useMemo(() => getCurrentSeason(), []);
  const [selectedTop, setSelectedTop] = useState<RankingType>('tv');
  const [q, setQ] = useState('');
  const [aboutOpen, setAboutOpen] = useState(false);

  const seasonal = useQuery({
    queryKey: ['seasonal', current.year, current.season],
    queryFn: () => fetchSeasonalAnime(current.year, current.season, 24),
  });

  const topQuery = useQuery({
    queryKey: ['rank', selectedTop],
    queryFn: () => fetchAnimeRanking(selectedTop, 20),
  });

  // Hyped airing top 10: use ranking 'airing', then fetch details for broadcast info per item
  const hypedAiring = useQuery({
    queryKey: ['rank-airing-top10'],
    queryFn: () => fetchAnimeRanking('airing', 10),
  });

  const renderCard = (item: any) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      onPress={() => navigation.navigate('Info', { id: item.node.id })}
    >
      {!!item.node.main_picture?.medium && (
        <Image source={{ uri: item.node.main_picture.medium }} style={styles.poster} />
      )}
      {!!item.node.media_type && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{String(item.node.media_type).toUpperCase()}</Text>
        </View>
      )}
      <Text numberOfLines={2} style={styles.title}>{item.node.title}</Text>
      {!!item.node.mean && (
        <Text style={styles.score}>★ {item.node.mean.toFixed(2)}</Text>
      )}
    </Pressable>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
        <View style={styles.searchRow}>
          <Pressable onPress={() => setAboutOpen(true)} style={({ pressed }) => [styles.logoBtn, pressed && { opacity: 0.9 }]}>
            <Image source={require('../assets/logo.png')} style={styles.logo} />
          </Pressable>
          <TextInput
            placeholder="Search anime..."
            placeholderTextColor="#94a3b8"
            value={q}
            onChangeText={setQ}
            onSubmitEditing={() => q.trim() && navigation.navigate('Search', { q })}
            style={[styles.input, { flex: 1 }]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>
      </View>
      <View style={styles.sectionCard}>
        <Text style={styles.h1}>Top Anime</Text>
        <FlatList
          data={topFilters}
          keyExtractor={(it) => it.key}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelectedTop(item.key)}
              style={({ pressed }) => [
                styles.chip,
                selectedTop === item.key && styles.chipActive,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={[styles.chipText, selectedTop === item.key && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          )}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8 }}
        />
        {topQuery.isLoading ? (
          <View style={styles.loader}> 
            <ActivityIndicator color="#a3e635" />
          </View>
        ) : (
          <FlatList
            data={[...(topQuery.data?.data ?? []), { __more: true }] as any[]}
            keyExtractor={(it: any, idx) => (it.node?.id ? String(it.node.id) : `more-${idx}`)}
            renderItem={({ item }: any) => (
              item.__more ? (
                <Pressable
                  style={({ pressed }) => [styles.moreCard, pressed && { opacity: 0.85 }]}
                  onPress={() => navigation.navigate('List', { kind: 'ranking', rankingType: selectedTop })}
                >
                  <Text style={styles.moreText}>More</Text>
                </Pressable>
              ) : (
                renderCard(item)
              )
            )}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 12 }}
          />
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.h1}>Current Season</Text>
        {seasonal.isLoading ? (
          <View style={styles.loader}>
            <ActivityIndicator color="#a3e635" />
          </View>
        ) : (
          <FlatList
            data={[...(seasonal.data?.data ?? []), { __more: true }] as any[]}
            keyExtractor={(it: any, idx) => (it.node?.id ? String(it.node.id) : `more-${idx}`)}
            renderItem={({ item }: any) => (
              item.__more ? (
                <Pressable
                  style={({ pressed }) => [styles.moreCard, pressed && { opacity: 0.85 }]}
                  onPress={() => navigation.navigate('List', { kind: 'season', year: current.year, season: current.season })}
                >
                  <Text style={styles.moreText}>More</Text>
                </Pressable>
              ) : (
                renderCard(item)
              )
            )}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 12 }}
          />
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.h1}>Release Schedule</Text>
        {hypedAiring.isLoading ? (
          <View style={styles.loader}>
            <ActivityIndicator color="#a3e635" />
          </View>
        ) : (
          (hypedAiring.data?.data ?? []).map((item) => (
            <HypeRow key={item.node.id} id={item.node.id} title={item.node.title} poster={item.node.main_picture?.medium} />
          ))
        )}
      </View>
      <Modal visible={aboutOpen} transparent animationType="fade" onRequestClose={() => setAboutOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Connect</Text>
            <View style={{ gap: 8 }}>
              <Pressable
                style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.85 }]}
                onPress={() => Linking.openURL('https://github.com/notwld').catch(() => {})}
              >
                <Image source={{ uri: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png' }} style={styles.linkIcon} />
                <Text style={styles.linkText}>notwld</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.85 }]}
                onPress={() => Linking.openURL('https://www.instagram.com/wa1e3d/').catch(() => {})}
              >
                <Image source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png' }} style={styles.linkIcon} />
                <Text style={styles.linkText}>wa1e3d</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.85 }]}
                onPress={() => Linking.openURL('https://discord.gg/kBBe3E5Cbx').catch(() => {})}
              >
                <Image source={{ uri: 'https://seeklogo.com/images/D/discord-color-logo-E5E6DFEF80-seeklogo.com.png' }} style={styles.linkIcon} />
                <Text style={styles.linkText}>discord server</Text>
              </Pressable>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Pressable onPress={() => setAboutOpen(false)}>
                <Text style={styles.close}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function HypeRow({ id, title, poster }: { id: number; title: string; poster?: string }) {
  const navigation = useNavigation<any>();
  const details = useQuery({ queryKey: ['mal-details', id], queryFn: () => fetchAnimeDetails(id) });

  const broadcast = details.data?.broadcast;
  let when: string = 'Schedule TBA';
  if (broadcast?.day_of_week) {
    const day = String(broadcast.day_of_week).slice(0, 1).toUpperCase() + String(broadcast.day_of_week).slice(1);
    const time = broadcast.start_time ? `${broadcast.start_time} JST` : '';
    when = time ? `${day} ${time}` : day;
  } else if (details.data?.status) {
    when = details.data.status === 'currently_airing' ? 'Airing' : details.data.status === 'not_yet_aired' ? 'Upcoming' : 'Schedule TBA';
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.hypeRow, pressed && { opacity: 0.9 }]}
      onPress={() => navigation.navigate('Info', { id })}
    >
      {!!poster && <Image source={{ uri: poster }} style={styles.hypePoster} />}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={styles.hypeTitle}>{title}</Text>
        <Text style={styles.hypeSub}>{when}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0c' },
  sectionCard: { backgroundColor: '#0f0f10', borderRadius: 12, borderWidth: 1, borderColor: '#1f2937', marginHorizontal: 12, marginTop: 12 },
  h1: { color: '#e5e7eb', fontSize: 20, fontWeight: '700', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 6 },
  input: {
    backgroundColor: '#111215',
    color: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBtn: { width: 50, height: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 45, height: 45, borderRadius: 6 },
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
  title: { color: '#cbd5e1', fontSize: 12, paddingHorizontal: 8, paddingTop: 8 },
  score: { color: '#e5e7eb', fontSize: 12, paddingHorizontal: 8, paddingBottom: 8 },
  badge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText: { color: '#f1f5f9', fontSize: 10, fontWeight: '700' },
  chip: { borderWidth: 1, borderColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, marginHorizontal: 6 },
  chipActive: { backgroundColor: '#2563eb' },
  chipText: { color: '#bfdbfe', fontWeight: '600' },
  chipTextActive: { color: '#e5e7eb' },
  loader: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  moreCard: { width: 120, height: 160, marginHorizontal: 6, backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#1f2937', alignItems: 'center', justifyContent: 'center' },
  moreText: { color: '#93c5fd', fontWeight: '700' },
  hypeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1f2937' },
  hypePoster: { width: 52, height: 74, borderRadius: 8, backgroundColor: '#0b0b0c', marginRight: 4 },
  hypeTitle: { color: '#e5e7eb', fontWeight: '600' },
  hypeSub: { color: '#94a3b8', marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 520, backgroundColor: '#0f0f10', borderRadius: 12, borderWidth: 1, borderColor: '#1f2937', padding: 12 },
  modalTitle: { color: '#e5e7eb', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#101113', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#1f2937' },
  linkIcon: { width: 22, height: 22 },
  linkText: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
  close: { color: '#a3e635', fontWeight: '700', padding: 10 },
});