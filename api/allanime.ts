import CryptoJS from 'crypto-js';

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
const allanimeKeySeed = 'Xot36i3lK3:v1';

type TranslationMode = 'sub' | 'dub';

export type AllAnimeShow = {
  id: string;
  name: string;
  availableEpisodesText: string;
};

function normalizeUrl(fragment: string): string {
  if (/^https?:\/\//i.test(fragment)) return fragment;
  const cleaned = fragment.replace(/^--+/, '');
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
    const res = await fetch(input as RequestInfo, { ...rest, signal: ctrl.signal });
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

function randomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)]!;
}

async function postGraphql<T>(query: string, variables: Record<string, unknown>, timeoutMs = 12000): Promise<T> {
  const json = await fetchRetry(
    `${allanimeApi}/api`,
    {
      method: 'POST',
      timeoutMs,
      headers: {
        Referer: allanimeReferer,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    },
    'json'
  );
  return json as T;
}

function hexToUint8(hex: string): Uint8Array {
  const cleanHex = hex.trim().toLowerCase();
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}

async function sha256Hex(value: string): Promise<string> {
  const subtle = (globalThis as any).crypto?.subtle as any;
  if (!subtle) {
    return CryptoJS.SHA256(value).toString(CryptoJS.enc.Hex);
  }
  const digest = await subtle.digest('SHA-256', Uint8Array.from(value, (ch) => ch.charCodeAt(0)));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function decodeToBeParsed(blob: string): Promise<string | null> {
  try {
    const subtle = (globalThis as any).crypto?.subtle as any;
    const atobFn = (globalThis as any).atob as ((v: string) => string) | undefined;
    let raw: Uint8Array;
    if (atobFn) {
      raw = Uint8Array.from(atobFn(blob), (c) => c.charCodeAt(0));
    } else {
      const maybeBuffer = (globalThis as any).Buffer;
      if (!maybeBuffer) return null;
      const buf = maybeBuffer.from(blob, 'base64');
      raw = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    if (raw.length < 30) return null;

    const iv = raw.slice(1, 13);
    const ciphertext = raw.slice(13, raw.length - 16);
    const keyHex = await sha256Hex(allanimeKeySeed);
    if (subtle) {
      const keyBytes = hexToUint8(keyHex);
      const key = await subtle.importKey('raw', keyBytes, { name: 'AES-CTR' }, false, ['decrypt']);
      const counter = new Uint8Array(16);
      counter.set(iv, 0);
      counter[15] = 0x02;
      const plain = await subtle.decrypt({ name: 'AES-CTR', counter, length: 128 }, key, ciphertext);
      return Array.from(new Uint8Array(plain))
        .map((byte) => String.fromCharCode(byte))
        .join('');
    }

    const ivHex = Array.from(iv)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const ctrHex = `${ivHex}00000002`;
    const cipherWords = CryptoJS.lib.WordArray.create(ciphertext as unknown as number[]);
    const keyWords = CryptoJS.enc.Hex.parse(keyHex);
    const ctrWords = CryptoJS.enc.Hex.parse(ctrHex);
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: cipherWords } as any,
      keyWords,
      { mode: CryptoJS.mode.CTR, iv: ctrWords, padding: CryptoJS.pad.NoPadding }
    );
    const plainText = CryptoJS.enc.Utf8.stringify(decrypted);
    return plainText || null;
  } catch {
    return null;
  }
}

function extractSourcePairs(payload: string): Array<{ sourceName: string; sourceUrl: string }> {
  const pairs: Array<{ sourceName: string; sourceUrl: string }> = [];
  for (const m of payload.matchAll(/sourceUrl":"--([^"]*)".*?sourceName":"([^"]*)"/g)) {
    pairs.push({ sourceUrl: m[1], sourceName: m[2] });
  }
  for (const m of payload.matchAll(/sourceName":"([^"]*)".*?sourceUrl":"--([^"]*)"/g)) {
    pairs.push({ sourceName: m[1], sourceUrl: m[2] });
  }
  return pairs;
}

function parseEpisodeSourcePairs(rawResponseText: string): Array<{ sourceName: string; sourceUrl: string }> {
  try {
    const parsed = JSON.parse(rawResponseText);
    const sourceUrls = parsed?.data?.episode?.sourceUrls;
    if (Array.isArray(sourceUrls)) {
      const pairs = sourceUrls
        .map((entry: any) => {
          if (typeof entry === 'string') {
            return { sourceName: 'source', sourceUrl: entry.replace(/^--+/, '') };
          }
          return {
            sourceName: String(entry?.sourceName ?? 'source'),
            sourceUrl: String(entry?.sourceUrl ?? '').replace(/^--+/, ''),
          };
        })
        .filter((entry: { sourceName: string; sourceUrl: string }) => !!entry.sourceUrl);
      if (pairs.length > 0) return pairs;
    }
  } catch {
    // fall through to text extraction
  }
  return [];
}

function resolveProviderPath(rawSourceUrl: string): string {
  const cleaned = rawSourceUrl.replace(/^--+/, '').trim();
  if (!cleaned) return '';
  if (/^https?:\/\//i.test(cleaned) || cleaned.startsWith('/')) return cleaned;
  const hexCandidate = cleaned.replace(/[^0-9a-f]/gi, '');
  const isHexEncoded = hexCandidate.length >= 8 && hexCandidate.length % 2 === 0 && hexCandidate === cleaned.toLowerCase();
  return isHexEncoded ? decodeProviderFragment(cleaned) : cleaned;
}

export async function searchShows(query: string, mode: TranslationMode = 'sub') {
  const searchGql =
    'query( $search: SearchInput $limit: Int $page: Int $translationType: VaildTranslationTypeEnumType $countryOrigin: VaildCountryOriginEnumType ) { shows( search: $search limit: $limit page: $page translationType: $translationType countryOrigin: $countryOrigin ) { edges { _id name availableEpisodes __typename } }}';
  const variables: Record<string, unknown> = {
    search: { allowAdult: false, allowUnknown: false, query },
    limit: 40,
    page: 1,
    translationType: mode,
    countryOrigin: 'ALL',
  };
  const json = await postGraphql<any>(searchGql, variables, 10000);
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
  const variables: Record<string, unknown> = { showId };
  const json = await postGraphql<any>(gql, variables, 10000);
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
  const episodeCandidates = Array.from(
    new Set([
      String(episodeString),
      String(episodeString).replace(/\.0+$/, ''),
      /^\d+$/.test(String(episodeString)) ? `${episodeString}.0` : String(episodeString),
    ].filter(Boolean))
  );
  const modeCandidates = Array.from(new Set<TranslationMode>([mode, 'sub', 'dub']));
  let lastNonEmpty: EpisodeSource[] = [];

  for (const chosenMode of modeCandidates) {
    for (const chosenEpisode of episodeCandidates) {
      const sources = await fetchEpisodeSourcesOnce(showId, chosenEpisode, chosenMode);
      if (sources.length > 0) {
        return sources;
      }
      lastNonEmpty = sources;
    }
  }

  if (lastNonEmpty.length === 0) {
    throw new Error('No playable sources from upstream provider.');
  }
  return lastNonEmpty;
}

async function fetchEpisodeSourcesOnce(
  showId: string,
  episodeString: string,
  mode: TranslationMode
): Promise<EpisodeSource[]> {
  const gql =
    'query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) { episode( showId: $showId translationType: $translationType episodeString: $episodeString ) { episodeString sourceUrls }}';
  const variables: Record<string, unknown> = { showId, translationType: mode, episodeString };
  const rawResponseText = await fetchRetry(
    `${allanimeApi}/api`,
    {
      method: 'POST',
      timeoutMs: 12000,
      headers: {
        Referer: allanimeReferer,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: gql, variables }),
    },
    'text'
  );
  console.log('[AllAnime] sources raw length:', rawResponseText.length);

  const items: EpisodeSource[] = [];
  let sourcePayload = rawResponseText;
  const tobeparsedMatch = rawResponseText.match(/"tobeparsed":"([^"]+)"/);
  if (tobeparsedMatch?.[1]) {
    const decoded = await decodeToBeParsed(tobeparsedMatch[1]);
    if (decoded) {
      sourcePayload = decoded;
    }
  }

  const parsedPairs = parseEpisodeSourcePairs(rawResponseText);
  const extractedPairs = parsedPairs.length > 0 ? parsedPairs : extractSourcePairs(sourcePayload);
  const providers: { name: string; embedUrl: string }[] = [];
  for (const pair of extractedPairs) {
    const decodedPath = resolveProviderPath(pair.sourceUrl);
    if (!decodedPath) continue;
    const absolute = normalizeUrl(decodedPath);
    console.log('[AllAnime] candidate:', pair.sourceName, absolute);
    providers.push({ name: pair.sourceName, embedUrl: absolute });
  }

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

  await Promise.allSettled(
    providers.map(async (p) => {
      try {
        console.log('[AllAnime] fetch embed:', p.embedUrl);
        const r = (await fetchRetry(
          p.embedUrl,
          { headers: { Referer: allanimeReferer, 'User-Agent': randomUserAgent() }, timeoutMs: 8000 },
          'response'
        )) as Response;
        if (!r.ok) { console.log('[AllAnime] embed http', r.status); return; }
        const body = await r.text();
        const normalizedBody = body.replace(/\\u002F/g, '/').replace(/\\/g, '');
        const mp4Matches = [...normalizedBody.matchAll(/link":"([^"]*)".*?resolutionStr":"([^"]*)"/g)];
        for (const m of mp4Matches) {
          const url = m[1];
          const label = m[2];
          if (/^https?:\/\//.test(url)) items.push({ label, url, type: 'mp4', requiresReferer: true });
        }
        const hlsMatches = [...normalizedBody.matchAll(/hls","url":"([^"]*)".*?hardsub_lang":"en-US"/g)];
        for (const m of hlsMatches) {
          const url = m[1];
          if (/^https?:\/\//.test(url)) items.push({ label: 'HLS', url, type: 'hls', requiresReferer: true });
        }
      } catch (e: any) {
        console.log('[AllAnime] embed error:', e?.message ?? String(e));
      }
    })
  );

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

