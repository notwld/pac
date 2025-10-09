import { useCallback, useLayoutEffect } from 'react';
import { View, FlatList, Pressable, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { MalListResponse, MalRankingItem, MalNode, RankingType, SeasonName, fetchAnimeRanking, fetchSeasonalAnime, malGetAbsolute } from '../api/mal';

type Params =
  | { kind: 'ranking'; rankingType: RankingType }
  | { kind: 'season'; year: number; season: SeasonName };

type ListItem = { node: MalNode } | MalRankingItem;

export default function AnimeListScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const params = route.params as Params;

  useLayoutEffect(() => {
    if (params.kind === 'ranking') {
      navigation.setOptions({ title: `All · ${params.rankingType}` });
    } else {
      navigation.setOptions({ title: `All · ${params.season} ${params.year}` });
    }
  }, [navigation, params]);

  const query = useInfiniteQuery({
    queryKey: ['list', params],
    queryFn: async ({ pageParam }) => {
      if (typeof pageParam === 'string') {
        return await malGetAbsolute<MalListResponse<ListItem>>(pageParam);
      }
      if (params.kind === 'ranking') {
        return await fetchAnimeRanking(params.rankingType, 30) as unknown as MalListResponse<ListItem>;
      }
      return await fetchSeasonalAnime(params.year, params.season, 30) as unknown as MalListResponse<ListItem>;
    },
    getNextPageParam: (last) => last.paging?.next ?? undefined,
    initialPageParam: undefined as unknown as string | undefined,
  });

  const data = query.data?.pages.flatMap((p) => p.data) ?? [];

  const renderItem = useCallback(({ item }: { item: ListItem }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      onPress={() => navigation.navigate('Info', { id: item.node.id })}
    >
      {!!item.node.main_picture?.medium && (
        <Image source={{ uri: item.node.main_picture.medium }} style={styles.poster} />
      )}
      <Text numberOfLines={2} style={styles.title}>{item.node.title}</Text>
    </Pressable>
  ), [navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>
        {params.kind === 'ranking' ? `Top · ${params.rankingType.toUpperCase()}` : `Seasonal · ${params.season.toUpperCase()} ${params.year}`}
      </Text>
      <FlatList
        data={data}
        keyExtractor={(it) => String(it.node.id)}
        renderItem={renderItem}
        numColumns={3}
        columnWrapperStyle={{ paddingHorizontal: 8, gap: 8 }}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 24, gap: 8 }}
        onEndReached={() => query.hasNextPage && query.fetchNextPage()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={query.isFetchingNextPage ? () => (
          <View style={{ padding: 12 }}>
            <ActivityIndicator color="#a3e635" />
          </View>
        ) : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0c' },
  heading: { color: '#e5e7eb', fontSize: 18, fontWeight: '700', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 6 },
  card: {
    flex: 1,
    backgroundColor: '#101113',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    overflow: 'hidden',
  },
  poster: { width: '100%', aspectRatio: 2/3, backgroundColor: '#0b0b0c' },
  title: { color: '#cbd5e1', fontSize: 12, padding: 8, minHeight: 44 },
});