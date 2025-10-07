// Minimal AllAnime GraphQL client mirroring ani-cli flow for search, episodes, sources.
// Note: This consumes a public endpoint used by ani-cli. Availability may vary.

const userAgents = [
  // Desktop Firefox
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  // Desktop Chrome
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  // Android Chrome
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  // iOS Safari
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
];
const allanimeBase = 'allanime.day';
const allanimeApi = `https://api.${allanimeBase}`;
const allanimeReferer = 'https://allmanga.to';

type TranslationMode = 'sub' | 'dub';

export type AllAnimeShow = {
  id: string;
  name: string;
  availableEpisodesText: string;
};

function normalizeUrl(fragment: string): string {
  // Accept absolute URLs as is
  if (/^https?:\/\//i.test(fragment)) return fragment;
  // Some provider ids start with "--" and then a path; strip leading dashes
  const cleaned = fragment.replace(/^--+/, '');
  // Ensure single leading slash when joining with base
  const path = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  return `https://${allanimeBase}${path}`;
}

function normalizeDirectUrl(u: string): string {
  // Fix accidental double slashes after host
  return u.replace('https://tools.fast4speed.rsvp//', 'https://tools.fast4speed.rsvp/');
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 8000, ...rest } = init;
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...rest, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function fetchRetry(
  input: string,
  init: Omit<RequestInit & { timeoutMs?: number }, 'headers'> & { headers?: Record<string, string> },
  kind: 'json' | 'text' | 'response'
) {
  const { headers = {}, timeoutMs, ...rest } = init || {};
  let lastErr: any;
  for (const ua of userAgents) {
    try {
      const res = await fetchWithTimeout(input, {
        ...rest,
        timeoutMs,
        headers: { 'User-Agent': ua, ...headers },
      });
      console.log('[HTTP]', res.status, kind, 'UA=', ua.split(')')[0] + ')');
      if (!res.ok) {
        lastErr = new Error('HTTP ' + res.status);
        continue;
      }
      if (kind === 'json') return await res.json();
      if (kind === 'text') return await res.text();
      return res;
    } catch (e) {
      lastErr = e;
      console.log('[HTTP-ERR]', (e as Error).message);
    }
  }
  throw lastErr ?? new Error('Network error');
}

export async function searchShows(query: string, mode: TranslationMode = 'sub') {
  const searchGql =
    'query( $search: SearchInput $limit: Int $page: Int $translationType: VaildTranslationTypeEnumType $countryOrigin: VaildCountryOriginEnumType ) { shows( search: $search limit: $limit page: $page translationType: $translationType countryOrigin: $countryOrigin ) { edges { _id name availableEpisodes __typename } }}';
  const variables = {
    search: { allowAdult: false, allowUnknown: false, query },
    limit: 40,
    page: 1,
    translationType: mode,
    countryOrigin: 'ALL',
  } as const;

  const url = `${allanimeApi}/api?query=${encodeURIComponent(searchGql)}&variables=${encodeURIComponent(JSON.stringify(variables))}`;
  console.log('[AllAnime] search url:', url);
  const json = await fetchRetry(url, { headers: { Referer: allanimeReferer }, timeoutMs: 10000 }, 'json');
  console.log('[AllAnime] search response keys:', Object.keys(json || {}));
  const edges = json?.data?.shows?.edges ?? [];
  return (edges as any[]).map((e) => ({
    id: e._id as string,
    name: e.name as string,
    availableEpisodesText: `${mode}: ${e[mode] ?? 0}`,
  })) as AllAnimeShow[];
}

export async function listEpisodes(showId: string, mode: TranslationMode = 'sub') {
  const gql = 'query ($showId: String!) { show( _id: $showId ) { _id availableEpisodesDetail }}';
  const variables = { showId } as const;
  const url = `${allanimeApi}/api?query=${encodeURIComponent(gql)}&variables=${encodeURIComponent(JSON.stringify(variables))}`;
  console.log('[AllAnime] episodes url:', url);
  const json = await fetchRetry(url, { headers: { Referer: allanimeReferer }, timeoutMs: 10000 }, 'json');
  console.log('[AllAnime] episodes resp has show:', !!json?.data?.show);
  const detail = json?.data?.show?.availableEpisodesDetail;
  const arr: string[] = (detail?.[mode] ?? []).map(String);
  return arr.sort((a, b) => Number(a) - Number(b));
}

export type EpisodeSource = {
  label: string; // e.g. 1080p
  url: string; // direct stream url (m3u8 or mp4)
  type: 'hls' | 'mp4';
  requiresReferer: boolean;
};

export async function getEpisodeSources(
  showId: string,
  episodeString: string,
  mode: TranslationMode = 'sub'
): Promise<EpisodeSource[]> {
  const gql =
    'query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) { episode( showId: $showId translationType: $translationType episodeString: $episodeString ) { episodeString sourceUrls }}';
  const variables = { showId, translationType: mode, episodeString } as const;
  const url = `${allanimeApi}/api?query=${encodeURIComponent(gql)}&variables=${encodeURIComponent(JSON.stringify(variables))}`;
  console.log('[AllAnime] sources url:', url);
  const text = await fetchRetry(url, { headers: { Referer: allanimeReferer }, timeoutMs: 12000 }, 'text');
  console.log('[AllAnime] sources raw length:', text.length);

  // Decode provider fragments and fetch embed pages to extract final stream URLs
  const items: EpisodeSource[] = [];
  const linkRegex = /sourceUrl":"--([^"]*)".*?sourceName":"([^"]*)"/g;
  const providers: { name: string; embedUrl: string }[] = [];
  for (const m of text.matchAll(linkRegex)) {
    const encoded = m[1];
    const name = m[2];
    const decodedPath = decodeProviderFragment(encoded);
    const absolute = normalizeUrl(decodedPath);
    console.log('[AllAnime] candidate:', name, absolute);
    providers.push({ name, embedUrl: absolute });
  }

  // Short-circuit: if we already have a direct playable (Yt-mp4), return immediately
  const fast = providers.find((p) => /tools\.fast4speed\.rsvp/i.test(p.embedUrl));
  if (fast) {
    const direct = normalizeDirectUrl(fast.embedUrl);
    // quick status probe
    try {
      const head = (await fetchRetry(direct, { method: 'HEAD', headers: { Referer: allanimeReferer }, timeoutMs: 5000 }, 'response')) as Response;
      console.log('[Probe]', head.status, direct);
    } catch (e) {
      console.log('[Probe-ERR]', (e as Error).message);
    }
    items.push({ label: fast.name, url: direct, type: 'mp4', requiresReferer: true });
    return items;
  }

  // Otherwise, try other providers with timeouts in parallel and stop after first success
  await Promise.allSettled(
    providers.map(async (p) => {
      try {
        console.log('[AllAnime] fetch embed:', p.embedUrl);
        const r = (await fetchRetry(p.embedUrl, { headers: { Referer: allanimeReferer }, timeoutMs: 8000 }, 'response')) as Response;
        if (!r.ok) { console.log('[AllAnime] embed http', r.status); return; }
        const body = await r.text();
        const mp4Matches = [...body.matchAll(/link\\":\\"([^\\"]*)\\"[^\n]*?resolutionStr\\":\\"([^\\"]*)\\"/g)];
        for (const m of mp4Matches) {
          const url = m[1];
          const label = m[2];
          if (/^https?:\/:\//.test(url)) items.push({ label, url, type: 'mp4', requiresReferer: true });
        }
        const hlsMatches = [...body.matchAll(/hls\\",\\"url\\":\\"([^\\"]*)\\"[^\n]*?hardsub_lang\\":\\"en-US\\"/g)];
        for (const m of hlsMatches) {
          const url = m[1];
          if (/^https?:\/:\//.test(url)) items.push({ label: 'HLS', url, type: 'hls', requiresReferer: true });
        }
      } catch (e: any) {
        console.log('[AllAnime] embed error:', e?.message ?? String(e));
      }
    })
  );

  // De-duplicate and prefer higher resolutions
  const seen = new Set<string>();
  const unique = items.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)));
  unique.sort((a, b) => {
    const toNum = (s: string) => parseInt((s.match(/[0-9]{3,4}/)?.[0]) || '0', 10);
    return toNum(b.label) - toNum(a.label);
  });
  return unique;
}

export const refererHeader = allanimeReferer;

// Decode provider fragment using the hex mapping used by ani-cli
function decodeProviderFragment(fragment: string): string {
  const map: Record<string, string> = {
    '79':'A','7a':'B','7b':'C','7c':'D','7d':'E','7e':'F','7f':'G','70':'H','71':'I','72':'J','73':'K','74':'L','75':'M','76':'N','77':'O','68':'P','69':'Q','6a':'R','6b':'S','6c':'T','6d':'U','6e':'V','6f':'W','60':'X','61':'Y','62':'Z',
    '59':'a','5a':'b','5b':'c','5c':'d','5d':'e','5e':'f','5f':'g','50':'h','51':'i','52':'j','53':'k','54':'l','55':'m','56':'n','57':'o','48':'p','49':'q','4a':'r','4b':'s','4c':'t','4d':'u','4e':'v','4f':'w','40':'x','41':'y','42':'z',
    '08':'0','09':'1','0a':'2','0b':'3','0c':'4','0d':'5','0e':'6','0f':'7','00':'8','01':'9',
    '15':'-','16':'.','67':'_','46':'~','02':':','17':'/','07':'?','1b':'#','63':'[','65':']','78':'@','19':'!','1c':'$','1e':'&','10':'(','11':')','12':'*','13':'+','14':',','03':';','05':'=','1d':'%'
  };
  const hex = fragment.replace(/[^0-9a-f]/gi, '').toLowerCase();
  let out = '';
  for (let i = 0; i < hex.length; i += 2) {
    const pair = hex.slice(i, i + 2);
    out += map[pair] ?? '';
  }
  return out.replace('/clock', '/clock.json');
}

