// Minimal MyAnimeList (MAL) v2 client for rankings, seasonal lists, and details
// Uses Client ID only (public data). Do NOT ship client secret to clients.

const MAL_API = 'https://api.myanimelist.net/v2';

export type MalPicture = { medium?: string; large?: string };
export type MalNode = {
  id: number;
  title: string;
  main_picture?: MalPicture;
};

export type MalRankingItem = { node: MalNode; ranking: { rank: number } };
export type MalListResponse<T> = { data: T[]; paging?: { next?: string; previous?: string } };

export type MalAnimeDetails = MalNode & {
  synopsis?: string;
  start_date?: string;
  end_date?: string;
  mean?: number;
  rank?: number;
  popularity?: number;
  media_type?: string;
  num_episodes?: number;
  status?: string;
  genres?: { id: number; name: string }[];
};

export type RankingType =
  | 'all'
  | 'airing'
  | 'upcoming'
  | 'tv'
  | 'ova'
  | 'movie'
  | 'special'
  | 'bypopularity'
  | 'favorite';

export type SeasonName = 'winter' | 'spring' | 'summer' | 'fall';

let MAL_CLIENT_ID: string | undefined;

export function configureMalClient(clientId: string) {
  MAL_CLIENT_ID = clientId;
}

function assertConfigured() {
  if (!MAL_CLIENT_ID) throw new Error('MAL Client ID not configured');
}

async function malGet<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  assertConfigured();
  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined) continue;
    qp.set(k, String(v));
  }
  const url = `${MAL_API}${path}${qp.toString() ? `?${qp.toString()}` : ''}`;
  const res = await fetch(url, { headers: { 'X-MAL-CLIENT-ID': MAL_CLIENT_ID! } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MAL HTTP ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

// Fetch using an absolute MAL paging URL
export async function malGetAbsolute<T>(absoluteUrl: string): Promise<T> {
  assertConfigured();
  const res = await fetch(absoluteUrl, { headers: { 'X-MAL-CLIENT-ID': MAL_CLIENT_ID! } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MAL HTTP ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

// Fetch anime rankings
export async function fetchAnimeRanking(
  rankingType: RankingType,
  limit: number = 20
): Promise<MalListResponse<MalRankingItem>> {
  return await malGet(`/anime/ranking`, { ranking_type: rankingType, limit, fields: 'id,title,main_picture' });
}

// Fetch seasonal anime
export async function fetchSeasonalAnime(
  year: number,
  season: SeasonName,
  limit: number = 24
): Promise<MalListResponse<{ node: MalNode }>> {
  return await malGet(`/anime/season/${year}/${season}`, { limit, fields: 'id,title,main_picture' });
}

// Fetch anime details
export async function fetchAnimeDetails(id: number): Promise<MalAnimeDetails> {
  return await malGet(`/anime/${id}`, {
    fields:
      'id,title,main_picture,synopsis,start_date,end_date,mean,rank,popularity,media_type,num_episodes,status,genres',
  });
}

// Utility: derive current season and year
export function getCurrentSeason(): { year: number; season: SeasonName } {
  const now = new Date();
  const m = now.getUTCMonth(); // 0-11
  const year = now.getUTCFullYear();
  const season: SeasonName = m <= 1 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'fall';
  return { year, season };
}


