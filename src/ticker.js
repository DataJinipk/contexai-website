// Live data for the two home-page tickers (Economic Vibes markets + ContexAi News).
//
//   GET /api/ticker/markets  -> { ok, kind, asOf, stale, items: [{ key, label, value, changePct, decimals, prefix, suffix }] }
//   GET /api/ticker/news     -> { ok, kind, asOf, stale, items: [{ title, source, url, ts }] }
//
// Design rules:
//   * Free sources only, no API keys. Every source can fail on its own; the ticker
//     shows whatever succeeded and skips the rest.
//   * Results are cached at the edge (markets 5 min, news 15 min), so visitors never
//     hit the upstream sources directly and the sources see at most ~1 request per TTL.
//   * The last good result is kept in KV. If every source fails, that is served with
//     stale:true. If there is nothing at all, the API returns 503 and the page keeps the
//     morning snapshot that is already in the HTML (offline fallback).
//   * Values are sanity-checked; an implausible number is dropped, never shown.

export const MARKETS_TTL_S = 300;
export const NEWS_TTL_S = 900;
const UPSTREAM_TIMEOUT_MS = 6000;
const UA = 'Mozilla/5.0 (compatible; ContexAiTicker/1.0; +https://contexai.org)';

// Yahoo Finance chart endpoint (public, delayed quotes). Order = display order.
export const YAHOO_INSTRUMENTS = [
  { key: 'spx', symbol: '^GSPC', label: 'S&P 500', decimals: 0 },
  { key: 'dow', symbol: '^DJI', label: 'Dow', decimals: 0 },
  { key: 'ndq', symbol: '^IXIC', label: 'Nasdaq', decimals: 0 },
  { key: 'us10y', symbol: '^TNX', label: 'US 10Y', decimals: 2, suffix: '%', isYield: true },
  { key: 'brent', symbol: 'BZ=F', label: 'Brent', decimals: 1, prefix: '$' },
  { key: 'wti', symbol: 'CL=F', label: 'WTI', decimals: 1, prefix: '$' },
  { key: 'gold', symbol: 'GC=F', label: 'Gold', decimals: 0, prefix: '$' },
  { key: 'usdpkr', symbol: 'PKR=X', label: 'USD/PKR', decimals: 2 },
];

// Broad plausibility bands: a value outside its band is a bad feed, not news.
const BANDS = {
  kse100: [20000, 1000000], spx: [1000, 50000], dow: [5000, 300000], ndq: [2000, 200000],
  us10y: [0, 20], brent: [5, 500], wti: [5, 500], gold: [300, 50000], usdpkr: [50, 1000],
};
const MAX_ABS_CHANGE_PCT = 25;

export const NEWS_FEEDS = [
  { source: 'Dawn', url: 'https://www.dawn.com/feeds/business' },
  { source: 'Business Recorder', url: 'https://www.brecorder.com/feeds/latest-news' },
  { source: 'Profit', url: 'https://profit.pakistantoday.com.pk/feed/' },
  { source: 'BBC', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
];
const NEWS_MAX_ITEMS = 10;
const NEWS_MAX_AGE_MS = 48 * 3600 * 1000;

// ─── helpers ────────────────────────────────────────────────────────────────

async function fetchWithTimeout(fetchImpl, url, init = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Return a cleaned item, or null if the numbers are missing or implausible. */
export function checkItem(item) {
  const { key, value, prev } = item;
  if (!Number.isFinite(value) || value <= 0) return null;
  const band = BANDS[key];
  if (band && (value < band[0] || value > band[1])) return null;
  let changePct = null;
  if (Number.isFinite(prev) && prev > 0) {
    changePct = ((value - prev) / prev) * 100;
    if (Math.abs(changePct) > MAX_ABS_CHANGE_PCT) return null;
  }
  const out = { ...item, changePct };
  delete out.prev;
  return out;
}

// ─── markets ────────────────────────────────────────────────────────────────

/** One Yahoo chart quote: { value, prev, ts } or null. */
export async function fetchYahoo(fetchImpl, inst) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(inst.symbol)}?range=1d&interval=1d`;
  const res = await fetchWithTimeout(fetchImpl, url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) return null;
  const j = await res.json();
  const meta = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
  if (!meta) return null;
  let value = Number(meta.regularMarketPrice);
  let prev = Number(meta.chartPreviousClose ?? meta.previousClose);
  // ^TNX has been quoted both as the yield and as yield x 10; normalise to percent.
  if (inst.isYield && value > 20) { value /= 10; prev /= 10; }
  return { value, prev, ts: Number(meta.regularMarketTime) * 1000 || null };
}

/** KSE-100 from the PSX data portal: latest intraday print vs the previous session's close. */
export async function fetchKse100(fetchImpl) {
  const headers = { 'User-Agent': UA, Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
  const [intRes, eodRes] = await Promise.all([
    fetchWithTimeout(fetchImpl, 'https://dps.psx.com.pk/timeseries/int/KSE100', { headers }),
    fetchWithTimeout(fetchImpl, 'https://dps.psx.com.pk/timeseries/eod/KSE100', { headers }),
  ]);
  if (!eodRes.ok) return null;
  const eod = await eodRes.json();
  const eodRows = (eod && Array.isArray(eod.data) ? eod.data : [])
    .filter((r) => Array.isArray(r) && Number.isFinite(Number(r[0])) && Number.isFinite(Number(r[1])))
    .map((r) => ({ ts: Number(r[0]) * 1000, close: Number(r[1]) }))
    .sort((a, b) => b.ts - a.ts);
  if (!eodRows.length) return null;

  let latest = null;
  if (intRes.ok) {
    const intra = await intRes.json().catch(() => null);
    const rows = (intra && Array.isArray(intra.data) ? intra.data : [])
      .filter((r) => Array.isArray(r) && Number.isFinite(Number(r[0])) && Number.isFinite(Number(r[1])))
      .map((r) => ({ ts: Number(r[0]) * 1000, value: Number(r[1]) }))
      .sort((a, b) => b.ts - a.ts);
    if (rows.length) latest = rows[0];
  }
  const pkDay = (ms) => new Date(ms + 5 * 3600 * 1000).toISOString().slice(0, 10); // PKT calendar day
  if (latest) {
    const day = pkDay(latest.ts);
    const prevRow = eodRows.find((r) => pkDay(r.ts) < day);
    return { value: latest.value, prev: prevRow ? prevRow.close : null, ts: latest.ts };
  }
  // No intraday data (weekend / holiday): last close vs the one before it.
  return { value: eodRows[0].close, prev: eodRows[1] ? eodRows[1].close : null, ts: eodRows[0].ts };
}

/** Fetch every instrument in parallel; failed or implausible ones are skipped. */
export async function fetchMarkets(fetchImpl) {
  const jobs = [
    fetchKse100(fetchImpl).then((q) => q && { key: 'kse100', label: 'KSE-100', decimals: 0, ...q }),
    ...YAHOO_INSTRUMENTS.map((inst) =>
      fetchYahoo(fetchImpl, inst).then((q) => q && {
        key: inst.key, label: inst.label, decimals: inst.decimals,
        prefix: inst.prefix || '', suffix: inst.suffix || '', ...q,
      })),
  ];
  const settled = await Promise.allSettled(jobs);
  return settled
    .map((s) => (s.status === 'fulfilled' && s.value ? checkItem(s.value) : null))
    .filter(Boolean);
}

// ─── news ───────────────────────────────────────────────────────────────────

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeText(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENTITIES ? ENTITIES[n.toLowerCase()] : m))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse RSS 2.0 <item>s (and Atom <entry>s) into { title, url, ts }. */
export function parseFeed(xml) {
  const out = [];
  const blocks = String(xml).match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  for (const b of blocks) {
    const pick = (tag) => {
      const m = b.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? m[1] : '';
    };
    const title = decodeText(pick('title'));
    let url = decodeText(pick('link'));
    if (!url) {
      const m = b.match(/<link\b[^>]*href="([^"]+)"/i);
      url = m ? m[1] : '';
    }
    const ts = Date.parse(decodeText(pick('pubDate') || pick('published') || pick('updated') || pick('dc:date')));
    if (title && /^https:\/\//i.test(url)) out.push({ title, url, ts: Number.isFinite(ts) ? ts : null });
  }
  return out;
}

/** Latest headlines across feeds: newest first, at most 3 per source, de-duplicated. */
export async function fetchNews(fetchImpl, now = Date.now()) {
  const settled = await Promise.allSettled(
    NEWS_FEEDS.map(async (f) => {
      const res = await fetchWithTimeout(fetchImpl, f.url, {
        headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' },
      });
      if (!res.ok) return [];
      return parseFeed(await res.text()).map((it) => ({ ...it, source: f.source }));
    }),
  );
  const all = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));
  const seen = new Set();
  const perSource = {};
  return all
    .filter((it) => it.ts && now - it.ts < NEWS_MAX_AGE_MS && it.ts <= now + 3600 * 1000)
    .sort((a, b) => b.ts - a.ts)
    .filter((it) => {
      const k = it.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k);
      perSource[it.source] = (perSource[it.source] || 0) + 1;
      return perSource[it.source] <= 3;
    })
    .slice(0, NEWS_MAX_ITEMS)
    .map((it) => ({ title: it.title.slice(0, 140), source: it.source, url: it.url, ts: it.ts }));
}

// ─── HTTP handler ───────────────────────────────────────────────────────────

function json(body, status, maxAge) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${maxAge}`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/**
 * GET /api/ticker/markets | /api/ticker/news
 * Edge cache first; on a miss, refresh from the sources; on total failure, last-good from KV.
 */
export async function handleTicker(request, env, ctx, kind, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const cache = deps.cache !== undefined ? deps.cache : (typeof caches !== 'undefined' ? caches.default : null);
  const kv = env && env.QUOTA_KV;
  const ttl = kind === 'markets' ? MARKETS_TTL_S : NEWS_TTL_S;
  const minItems = kind === 'markets' ? 3 : 3;
  const cacheKey = new Request(new URL(`/api/ticker/${kind}`, request.url).toString(), { method: 'GET' });

  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  let items = [];
  try {
    items = kind === 'markets' ? await fetchMarkets(fetchImpl) : await fetchNews(fetchImpl);
  } catch (_) {
    items = [];
  }

  let res;
  if (items.length >= minItems) {
    const body = { ok: true, kind, asOf: new Date().toISOString(), stale: false, items };
    if (kv) {
      const write = kv.put(`ticker:${kind}`, JSON.stringify(body)).catch(() => {});
      if (ctx && ctx.waitUntil) ctx.waitUntil(write); else await write;
    }
    res = json(body, 200, ttl);
  } else {
    const last = kv ? await kv.get(`ticker:${kind}`, 'json').catch(() => null) : null;
    if (last && Array.isArray(last.items) && last.items.length) {
      res = json({ ...last, stale: true }, 200, 60);
    } else {
      return json({ ok: false, kind, items: [] }, 503, 60);
    }
  }
  if (cache) {
    const put = cache.put(cacheKey, res.clone()).catch(() => {});
    if (ctx && ctx.waitUntil) ctx.waitUntil(put); else await put;
  }
  return res;
}
