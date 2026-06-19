#!/usr/bin/env node
// Pre-deploy / post-deploy smoke test.
// Hits each canonical route and asserts:
//   1. HTTP 200
//   2. Response body has length > 4 KB (filters out empty/error shells)
//   3. Body ends with </html> (catches truncation like the if(!a) retu bug)
//   4. Body contains the top-nav marker (catches missing layout)
//
// Usage:
//   node scripts/smoke.mjs                         # checks https://contexai.org
//   node scripts/smoke.mjs https://staging.tld     # custom base
//   BASE_URL=https://x node scripts/smoke.mjs      # via env

const BASE = process.argv[2] || process.env.BASE_URL || 'https://contexai.org';

const ROUTES = [
  '/',
  '/practices',
  '/practices/banking',
  '/practices/real-estate',
  '/practices/energy',
  '/practices/accreditation',
  '/team',
  '/case-studies',
  '/insights',
  '/economy',
  '/positions',
  '/contact',
  '/apply',
  '/post-position',
  '/privacy',
  '/terms',
];

const NAV_MARKER = 'topnav__in';      // every page should have the site-wide top nav
const MIN_BYTES  = 4096;
const TRUNCATION_RE = /(retu|retur)\s*$|<\/body>\s*$|<\/head>\s*$/m;

let failed = 0;
const start = Date.now();

for (const route of ROUTES) {
  const url = BASE.replace(/\/$/, '') + route;
  let status, body;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    status = res.status;
    body = await res.text();
  } catch (err) {
    console.error(`✗ ${route}  FETCH ERROR: ${err.message}`);
    failed++;
    continue;
  }

  const checks = [];
  if (status !== 200) checks.push(`status=${status}`);
  if (body.length < MIN_BYTES) checks.push(`tooShort=${body.length}b`);
  if (!body.includes('</html>')) checks.push('missing </html>');
  if (TRUNCATION_RE.test(body)) checks.push('truncated');
  if (!body.includes(NAV_MARKER)) checks.push('no top-nav');

  if (checks.length === 0) {
    console.log(`✓ ${route.padEnd(28)} ${status}  ${(body.length/1024).toFixed(1)}KB`);
  } else {
    console.error(`✗ ${route.padEnd(28)} ${status}  ${checks.join(', ')}`);
    failed++;
  }
}

const dur = ((Date.now() - start) / 1000).toFixed(1);
if (failed > 0) {
  console.error(`\n✗ SMOKE FAILED — ${failed}/${ROUTES.length} route(s) broken (${dur}s)`);
  process.exit(1);
}
console.log(`\n✓ SMOKE PASSED — ${ROUTES.length} routes, ${dur}s`);
