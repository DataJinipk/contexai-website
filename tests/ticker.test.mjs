// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkItem, fetchYahoo, fetchKse100, fetchMarkets, parseFeed, fetchNews, decodeText, handleTicker,
  YAHOO_INSTRUMENTS, NEWS_FEEDS,
} from '../src/ticker.js';

const jsonRes = (body, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body, text: async () => JSON.stringify(body) });
const textRes = (body, ok = true) => ({ ok, status: ok ? 200 : 500, text: async () => body, json: async () => JSON.parse(body) });
const yahoo = (price, prev, t = 1762358400) => jsonRes({ chart: { result: [{ meta: { regularMarketPrice: price, chartPreviousClose: prev, regularMarketTime: t } }] } });

const NOW = Date.parse('2026-11-05T16:30:00Z');
const KSE_INT = { status: 1, data: [[NOW / 1000 - 3600, 172900], [NOW / 1000 - 7200, 172500]] };
const KSE_EOD = { status: 1, data: [[Date.parse('2026-11-04T10:00:00Z') / 1000, 172013], [Date.parse('2026-11-03T10:00:00Z') / 1000, 168018]] };

const PRICES = { '^GSPC': [7700, 7689], '^DJI': [52000, 51800], '^IXIC': [25000, 24900], '^TNX': [4.88, 4.9],
  'BZ=F': [95.2, 94.7], 'CL=F': [88.5, 88.1], 'GC=F': [4130, 4125], 'PKR=X': [276.6, 276.7] };

function marketFetch(overrides = {}) {
  return async (url) => {
    if (url.includes('timeseries/int/KSE100')) return overrides.kseInt || jsonRes(KSE_INT);
    if (url.includes('timeseries/eod/KSE100')) return overrides.kseEod || jsonRes(KSE_EOD);
    const sym = decodeURIComponent(url.split('/chart/')[1].split('?')[0]);
    if (overrides[sym]) return overrides[sym];
    const p = PRICES[sym];
    return p ? yahoo(p[0], p[1]) : jsonRes({}, false);
  };
}

test('checkItem drops impossible values and computes change', () => {
  assert.equal(checkItem({ key: 'spx', value: NaN, prev: 1 }), null);
  assert.equal(checkItem({ key: 'spx', value: 10, prev: 9 }), null);              // outside band
  assert.equal(checkItem({ key: 'gold', value: 4000, prev: 2000 }), null);        // +100% in a day
  const ok = checkItem({ key: 'gold', value: 4100, prev: 4000 });
  assert.equal(ok.changePct.toFixed(2), '2.50');
  assert.equal('prev' in ok, false);
  assert.equal(checkItem({ key: 'gold', value: 4100, prev: null }).changePct, null);
});

test('Yahoo 10Y quoted x10 is normalised to percent', async () => {
  const q = await fetchYahoo(async () => yahoo(48.8, 49.0), YAHOO_INSTRUMENTS.find((i) => i.key === 'us10y'));
  assert.ok(Math.abs(q.value - 4.88) < 1e-9);
});

test('KSE-100 uses the latest intraday print against the previous session close', async () => {
  const q = await fetchKse100(marketFetch());
  assert.equal(q.value, 172900);
  assert.equal(q.prev, 172013);
});

test('KSE-100 falls back to last two closes when there is no intraday data', async () => {
  const q = await fetchKse100(marketFetch({ kseInt: jsonRes({}, false) }));
  assert.equal(q.value, 172013);
  assert.equal(q.prev, 168018);
});

test('fetchMarkets returns every instrument in display order, skipping failures', async () => {
  const all = await fetchMarkets(marketFetch());
  assert.deepEqual(all.map((i) => i.key), ['kse100', 'spx', 'dow', 'ndq', 'us10y', 'brent', 'wti', 'gold', 'usdpkr']);
  const some = await fetchMarkets(marketFetch({ 'GC=F': jsonRes({}, false), 'BZ=F': yahoo(9999, 94) }));
  assert.equal(some.find((i) => i.key === 'gold'), undefined);
  assert.equal(some.find((i) => i.key === 'brent'), undefined);   // implausible jump dropped
  assert.equal(some.length, 7);
});

test('a throwing source does not break the others', async () => {
  const f = marketFetch();
  const items = await fetchMarkets(async (url, init) => { if (url.includes('%5EDJI')) throw new Error('boom'); return f(url, init); });
  assert.equal(items.find((i) => i.key === 'dow'), undefined);
  assert.equal(items.length, 8);
});

const RSS = (items) => `<?xml version="1.0"?><rss><channel>${items.map((i) => `<item><title><![CDATA[${i.t}]]></title><link>${i.l}</link><pubDate>${i.d}</pubDate></item>`).join('')}</channel></rss>`;

test('parseFeed reads RSS with CDATA and entities, and rejects non-https links', () => {
  const xml = RSS([
    { t: 'Rupee gains &amp; KSE hits <b>record</b>', l: 'https://example.com/a', d: 'Thu, 05 Nov 2026 14:00:00 +0500' },
    { t: 'Bad link', l: 'javascript:alert(1)', d: 'Thu, 05 Nov 2026 14:00:00 +0500' },
  ]);
  const items = parseFeed(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Rupee gains & KSE hits record');
  assert.equal(decodeText('&#8217;s'), '’s');
});

test('fetchNews sorts newest first, drops stale and duplicate headlines, caps per source', async () => {
  const h = (n) => new Date(NOW - n * 3600 * 1000).toUTCString();
  const feeds = {
    [NEWS_FEEDS[0].url]: RSS([1, 2, 3, 4, 5].map((n) => ({ t: `Dawn story ${n}`, l: `https://dawn.com/${n}`, d: h(n) }))),
    [NEWS_FEEDS[1].url]: RSS([{ t: 'Dawn story 1', l: 'https://br.com/dup', d: h(0.5) }, { t: 'Old news', l: 'https://br.com/old', d: h(100) }]),
  };
  const items = await fetchNews(async (url) => (feeds[url] ? textRes(feeds[url]) : textRes('', false)), NOW);
  assert.equal(items[0].title, 'Dawn story 1');
  assert.equal(items[0].source, 'Business Recorder');                 // newer duplicate wins
  assert.equal(items.filter((i) => i.source === 'Dawn').length, 3);   // per-source cap
  assert.equal(items.find((i) => i.title === 'Old news'), undefined);
});

function memKv() {
  const m = new Map();
  return { m, put: async (k, v) => { m.set(k, v); }, get: async (k, t) => (m.has(k) ? (t === 'json' ? JSON.parse(m.get(k)) : m.get(k)) : null) };
}

test('handleTicker serves fresh data and stores last-good', async () => {
  const kv = memKv();
  const res = await handleTicker(new Request('https://contexai.org/api/ticker/markets'), { QUOTA_KV: kv }, null, 'markets', { fetch: marketFetch(), cache: null });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.stale, false);
  assert.match(res.headers.get('cache-control'), /max-age=300/);
  assert.ok(kv.m.has('ticker:markets'));
});

test('handleTicker falls back to last-good, then to 503', async () => {
  const kv = memKv();
  const dead = async () => jsonRes({}, false);
  const none = await handleTicker(new Request('https://contexai.org/api/ticker/news'), { QUOTA_KV: kv }, null, 'news', { fetch: dead, cache: null });
  assert.equal(none.status, 503);
  await kv.put('ticker:news', JSON.stringify({ ok: true, kind: 'news', asOf: 'x', stale: false, items: [{ title: 'a', source: 'b', url: 'https://c', ts: 1 }] }));
  const stale = await handleTicker(new Request('https://contexai.org/api/ticker/news'), { QUOTA_KV: kv }, null, 'news', { fetch: dead, cache: null });
  assert.equal(stale.status, 200);
  assert.equal((await stale.json()).stale, true);
});
