import { useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, Pressable, ScrollView, Image, StatusBar } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import Video from 'react-native-video';
import RNFS from 'react-native-fs';
import Orientation from 'react-native-orientation-locker';
import { EpisodeSource, getEpisodeSources, refererHeader } from '../api/allanime';
import { fetchAnimeDetails } from '../api/mal';

type Params = { id: string; title: string; ep: string; malId?: number };

export default function PlayerScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id, title, ep, malId } = route.params as Params;
  const [selected, setSelected] = useState<EpisodeSource | null>(null);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [naturalAspectRatio, setNaturalAspectRatio] = useState<number | null>(null);
  const [aspectPreset, setAspectPreset] = useState<'auto' | '16:9' | '4:3' | '21:9' | '1:1'>('auto');
  const canOrient = typeof (Orientation as any)?.lockToLandscape === 'function';

  const lockToLandscapeSafe = () => {
    try {
      (Orientation as any)?.lockToLandscape?.();
    } catch (e) {
      console.warn('Orientation module not available. Rebuild the app after installing react-native-orientation-locker.');
    }
  };
  const lockToPortraitSafe = () => {
    try {
      (Orientation as any)?.lockToPortrait?.();
    } catch (e) {
      console.warn('Orientation module not available. Rebuild the app after installing react-native-orientation-locker.');
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({ title: `${title} · Ep ${ep}` });
  }, [navigation, title, ep]);

  useEffect(() => {
    return () => {
      if (isFullscreen) {
        lockToPortraitSafe();
        StatusBar.setHidden(false, 'fade');
        navigation.setOptions({ headerShown: true });
      }
    };
  }, [isFullscreen, navigation]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['sources', id, ep],
    queryFn: () => getEpisodeSources(id, ep),
  });

  const mal = useQuery({
    queryKey: ['mal', malId],
    queryFn: () => fetchAnimeDetails(malId!),
    enabled: !!malId,
  });

  useEffect(() => {
    if (!data || data.length === 0) return;
    const mp4 = data.find((s) => s.type === 'mp4');
    setSelected(mp4 ?? data[0]);
  }, [data]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#a3e635" />
        <Text style={styles.muted}>Fetching sources…</Text>
      </View>
    );
  }
  if (error || !selected) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Failed to load episode.</Text>
      </View>
    );
  }

  const remoteSource =
    selected.type === 'hls'
      ? { uri: selected.url, headers: { Referer: refererHeader } }
      : { uri: selected.url, headers: { Referer: refererHeader } };

  const activeSource = localUri ? { uri: localUri } : (remoteSource as any);

  const presetOrder: Array<'auto' | '16:9' | '4:3' | '21:9' | '1:1'> = ['auto', '16:9', '4:3', '21:9', '1:1'];
  const aspectRatioMap: Record<Exclude<typeof aspectPreset, 'auto'>, number> = {
    '16:9': 16 / 9,
    '4:3': 4 / 3,
    '21:9': 21 / 9,
    '1:1': 1,
  };
  const computedAspect = aspectPreset === 'auto' ? (naturalAspectRatio ?? 16 / 9) : aspectRatioMap[aspectPreset];

  return (
    <ScrollView style={[styles.container, isFullscreen && { backgroundColor: '#000' }]} contentContainerStyle={{ paddingBottom: isFullscreen ? 0 : 16 }}>
      <View style={isFullscreen ? styles.fullscreenWrap : undefined}>
        <Video
        style={[isFullscreen ? styles.videoFull : styles.video, { aspectRatio: computedAspect }]}
        controls
        resizeMode="contain"
        source={activeSource}
        onError={(e) => console.warn('video error', e)}
        onLoad={(meta: any) => {
          const ns = meta?.naturalSize;
          if (ns?.width && ns?.height) {
            setNaturalAspectRatio(ns.width / ns.height);
          }
        }}
        posterResizeMode="cover"
      />
        <View style={styles.rowWrap}>
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
            onPress={() => {
              if (!isFullscreen) {
                setIsFullscreen(true);
                lockToLandscapeSafe();
                navigation.setOptions({ headerShown: false });
                StatusBar.setHidden(true, 'fade');
              } else {
                setIsFullscreen(false);
                lockToPortraitSafe();
                navigation.setOptions({ headerShown: true });
                StatusBar.setHidden(false, 'fade');
              }
            }}
          >
            <Text style={styles.btnText}>{isFullscreen ? 'Exit Fullscreen' : (canOrient ? 'Fullscreen' : 'Fullscreen (requires rebuild)')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
            onPress={() => {
              const idx = presetOrder.indexOf(aspectPreset);
              const next = presetOrder[(idx + 1) % presetOrder.length];
              setAspectPreset(next);
            }}
          >
            <Text style={styles.btnText}>Aspect: {aspectPreset.toUpperCase()}</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.rowWrap}>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
          onPress={async () => {
            if (!selected || selected.type !== 'mp4') return;
            try {
              setDownloading(true);
              const safe = title.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
              const path = `${RNFS.CachesDirectoryPath}/${safe}_ep${ep}.mp4`;
              const exists = await RNFS.exists(path);
              if (!exists) {
                const res = await RNFS.downloadFile({
                  fromUrl: selected.url,
                  toFile: path,
                  headers: { Referer: refererHeader },
                }).promise;
                if (res.statusCode && res.statusCode >= 400) throw new Error('Download failed ' + res.statusCode);
              }
              setLocalUri(Platform.OS === 'android' ? `file://${path}` : path);
            } catch (e) {
              console.warn('download mp4 failed', e);
            } finally {
              setDownloading(false);
            }
          }}
        >
          <Text style={styles.btnText}>Download</Text>
        </Pressable>
      </View>
      {downloading && (
        <View style={styles.row}>
          <ActivityIndicator color="#a3e635" />
          <Text style={[styles.muted, { marginLeft: 8 }]}>Downloading…</Text>
        </View>
      )}
      <Text style={styles.meta}>{selected?.label}</Text>

      {!!mal.data && (
        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
          <View style={styles.infoRow}>
            {!!(mal.data.main_picture?.large || mal.data.main_picture?.medium) && (
              <Image
                source={{ uri: mal.data.main_picture!.large || mal.data.main_picture!.medium! }}
                style={styles.poster}
              />
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.infoTitle}>{mal.data.title}</Text>
              {!!mal.data.mean && <Text style={styles.muted}>Score: {mal.data.mean}</Text>}
              {!!mal.data.media_type && <Text style={styles.muted}>Type: {String(mal.data.media_type).toUpperCase()}</Text>}
              {!!mal.data.num_episodes && <Text style={styles.muted}>Episodes: {mal.data.num_episodes}</Text>}
            </View>
          </View>
          {!!mal.data.synopsis && <Text style={[styles.muted, { marginTop: 6 }]}>{mal.data.synopsis}</Text>}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0c' },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  videoFull: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  fullscreenWrap: { position: 'relative' },
  meta: { color: '#94a3b8', padding: 12 },
  row: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8 },
  btn: { backgroundColor: '#1a1b1e', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#2b2f36', marginRight: 8 },
  btnText: { color: '#a3e635', fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b0b0c' },
  muted: { color: '#94a3b8', marginTop: 8 },
  error: { color: '#ef4444' },
  rowWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8 },
  infoTitle: { color: '#e5e7eb', fontSize: 16, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start' },
  poster: { width: 90, height: 126, borderRadius: 8, backgroundColor: '#0b0b0c' },
});