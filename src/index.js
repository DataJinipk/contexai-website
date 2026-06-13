// ContexAi Worker — static asset routing + form submissions + Stripe payments.
//
// Endpoints:
//   POST /api/apply           — Subject Matter Expert / AI Builder applications
//   POST /api/post-position   — Employer position postings (gated by quota)
//   POST /api/checkout-session — Create Stripe Checkout session for paid packages
//   POST /api/stripe-webhook  — Stripe webhook receiver (HMAC-verified)
//   GET  /api/quota           — Inspect remaining quota for an email
//
// Storage:
//   R2 bucket APPLICATIONS — submission JSON + uploaded files
//                            applications/YYYY-MM-DD/<uuid>/...
//                            positions/YYYY-MM-DD/<uuid>/...
//   KV namespace QUOTA_KV  — per-employer quota counters
//                            employer:<email-lowercased> -> {free_used, paid_credits, total_posts, ...}
//
// Required env vars (set as wrangler secrets):
//   STRIPE_SECRET_KEY        — sk_test_... or sk_live_...
//   STRIPE_WEBHOOK_SECRET    — whsec_... (from Stripe webhook endpoint)
//   STRIPE_PRICE_STARTER     — price_... ($10/5 posts)
//   STRIPE_PRICE_PRO         — price_... ($25/20 posts)

const FREE_POST_LIMIT = 3;
const PACKAGES = {
  starter: { credits: 5, label: '5 posts for $10', amountCents: 1000 },
  pro: { credits: 20, label: '20 posts for $25', amountCents: 2500 },
};
const ALLOWED_ORIGINS = [
  'https://contexai.org',
  'https://www.contexai.org',
  'https://contexai-website.amir-wahmed.workers.dev',
];

// Origins permitted to call /api/admin/*. Includes Cowork artifact iframe + the
// Worker's own domains. Token auth (ADMIN_TOKEN) is the real gate; CORS is a defense-in-depth.
const ADMIN_ALLOWED_ORIGINS_REGEX = [
  /^https:\/\/contexai\.org$/,
  /^https:\/\/www\.contexai\.org$/,
  /^https:\/\/[a-z0-9-]+\.workers\.dev$/,
  /^https:\/\/[a-z0-9-]+\.claude\.ai$/,
  /^https:\/\/claude\.ai$/,
  /^null$/, // sandboxed iframes ship Origin: null
];

const GITHUB_REPO = 'DataJinipk/contexai-website';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
      if (url.pathname.startsWith('/api/admin/')) {
        return new Response(null, {
          status: 204,
          headers: adminCors(request.headers.get('origin') || ''),
        });
      }
      return corsPreflight(request);
    }

    if (url.pathname === '/api/apply' && request.method === 'POST') {
      return handleSubmission(request, env, 'applications');
    }

    if (url.pathname === '/api/post-position' && request.method === 'POST') {
      return handleSubmission(request, env, 'positions');
    }

    if (url.pathname === '/api/apply-position' && request.method === 'POST') {
      return handleSubmission(request, env, 'position-applications');
    }

    if (url.pathname === '/api/contact' && request.method === 'POST') {
      return handleSubmission(request, env, 'contact-messages');
    }

    if (url.pathname === '/api/newsletter' && request.method === 'POST') {
      return handleSubmission(request, env, 'newsletter-subscribers');
    }

    if (url.pathname === '/api/checkout-session' && request.method === 'POST') {
      return handleCheckoutSession(request, env);
    }

    if (url.pathname === '/api/stripe-webhook' && request.method === 'POST') {
      return handleStripeWebhook(request, env);
    }

    if (url.pathname === '/api/quota' && request.method === 'GET') {
      return handleQuotaCheck(request, env);
    }

    // ─── Admin endpoints (dashboard) ──────────────────────────────────────
    if (url.pathname.startsWith('/api/admin/') && request.method === 'GET') {
      return handleAdminRoute(request, env, url);
    }

    return env.ASSETS.fetch(request);
  },
};

// ─── CORS helpers ────────────────────────────────────────────────────────────

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : 'https://contexai.org';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function corsPreflight(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request?.headers?.get('origin') || ''),
  });
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin || ''),
    },
  });
}

// ─── Quota tracking (Cloudflare KV) ──────────────────────────────────────────

// Quota is tracked per (role, email) where role is 'employer' or 'applicant'.
// Both share the same FREE_POST_LIMIT and same paid packages, but counters are independent.

function quotaKey(role, email) {
  return `${role}:${email.toLowerCase().trim()}`;
}

async function getQuota(env, role, email) {
  if (!env.QUOTA_KV) {
    return { free_used: 0, paid_credits: 0, total_posts: 0, kv_unavailable: true };
  }
  const data = await env.QUOTA_KV.get(quotaKey(role, email), 'json');
  return data || { free_used: 0, paid_credits: 0, total_posts: 0 };
}

async function setQuota(env, role, email, quota) {
  if (!env.QUOTA_KV) return;
  await env.QUOTA_KV.put(quotaKey(role, email), JSON.stringify(quota));
}

async function consumeQuota(env, role, email) {
  const q = await getQuota(env, role, email);
  if (q.kv_unavailable) {
    return { ok: true, used: 'free', remaining_free: FREE_POST_LIMIT, kv_unavailable: true };
  }
  if (q.free_used < FREE_POST_LIMIT) {
    q.free_used += 1;
    q.total_posts += 1;
    q.last_post_at = new Date().toISOString();
    await setQuota(env, role, email, q);
    return { ok: true, used: 'free', remaining_free: FREE_POST_LIMIT - q.free_used, paid_credits: q.paid_credits };
  }
  if (q.paid_credits > 0) {
    q.paid_credits -= 1;
    q.total_posts += 1;
    q.last_post_at = new Date().toISOString();
    await setQuota(env, role, email, q);
    return { ok: true, used: 'paid', remaining_credits: q.paid_credits };
  }
  return { ok: false, requires_payment: true, free_used: q.free_used, paid_credits: 0 };
}

async function handleQuotaCheck(request, env) {
  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  const role = url.searchParams.get('role') || 'employer';
  const origin = request.headers.get('origin') || '';
  if (!email) return jsonResponse({ ok: false, error: 'email parameter required' }, 400, origin);
  if (role !== 'employer' && role !== 'applicant') {
    return jsonResponse({ ok: false, error: 'role must be employer or applicant' }, 400, origin);
  }
  const q = await getQuota(env, role, email);
  return jsonResponse({
    ok: true,
    role,
    free_used: q.free_used,
    free_remaining: Math.max(0, FREE_POST_LIMIT - q.free_used),
    paid_credits: q.paid_credits,
    total_posts: q.total_posts,
    can_proceed_free: q.free_used < FREE_POST_LIMIT,
    can_proceed_paid: q.paid_credits > 0,
  }, 200, origin);
}

// ─── Submission handler (applications + positions) ───────────────────────────

async function handleSubmission(request, env, prefix) {
  const origin = request.headers.get('origin') || '';
  const isPosition = prefix === 'positions';
  const isPositionApplication = prefix === 'position-applications';
  // Roles that pay quota: employer (posting) and applicant (applying to a position)
  const role = isPosition ? 'employer' : (isPositionApplication ? 'applicant' : null);
  const meteredEmailField = isPosition ? 'contact_email' : 'email';

  try {
    const ct = request.headers.get('content-type') || '';
    if (!ct.includes('multipart/form-data') && !ct.includes('application/x-www-form-urlencoded')) {
      return jsonResponse({ ok: false, error: 'Expected form data' }, 400, origin);
    }

    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > 25 * 1024 * 1024) {
      return jsonResponse({ ok: false, error: 'Request too large (max 25 MB total)' }, 413, origin);
    }

    const formData = await request.formData();

    const fields = {};
    const files = [];
    const MAX_FILE_BYTES = 10 * 1024 * 1024;

    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        fields[key] = value;
      }
    }

    // Required-field gates differ by submission type
    if (isPosition) {
      if (!fields.company_name || !fields.contact_email || !fields.role_title) {
        return jsonResponse(
          { ok: false, error: 'Company name, contact email, and role title are required' },
          400,
          origin,
        );
      }
    } else if (isPositionApplication) {
      if (!fields.full_name || !fields.email || !fields.position_id) {
        return jsonResponse(
          { ok: false, error: 'Name, email, and position ID are required' },
          400,
          origin,
        );
      }
    } else {
      if (!fields.full_name || !fields.email) {
        return jsonResponse({ ok: false, error: 'Name and email are required' }, 400, origin);
      }
    }

    // Quota check for metered submissions only (positions + position applications)
    let quotaResult = null;
    if (role) {
      const meteredEmail = fields[meteredEmailField];
      quotaResult = await consumeQuota(env, role, meteredEmail);
      if (!quotaResult.ok && quotaResult.requires_payment) {
        const noun = role === 'employer' ? 'posts' : 'applications';
        return jsonResponse({
          ok: false,
          requires_payment: true,
          role,
          free_used: quotaResult.free_used,
          message: `You've used all ${FREE_POST_LIMIT} free ${noun}. Choose a package to continue.`,
          packages: Object.entries(PACKAGES).map(([key, p]) => ({
            key,
            credits: p.credits,
            label: role === 'employer' ? p.label : p.label.replace('posts', 'applications'),
            amountCents: p.amountCents,
          })),
        }, 402, origin);
      }
    }

    // Second pass: now store files (we know the quota allows posting)
    const submissionId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const dateFolder = timestamp.split('T')[0];

    for (const [key, value] of formData.entries()) {
      if (value instanceof File && value.size > 0) {
        if (value.size > MAX_FILE_BYTES) {
          return jsonResponse(
            { ok: false, error: `File "${value.name}" exceeds 10 MB limit` },
            413,
            origin,
          );
        }

        const safeName = value.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
        const r2Key = `${prefix}/${dateFolder}/${submissionId}/${safeName}`;

        await env.APPLICATIONS.put(r2Key, value.stream(), {
          httpMetadata: { contentType: value.type || 'application/octet-stream' },
          customMetadata: {
            originalName: value.name,
            submissionId,
            uploadedAt: timestamp,
            submitterName: String(formData.get('full_name') || formData.get('contact_name') || ''),
          },
        });

        files.push({ name: value.name, size: value.size, contentType: value.type, r2Key });
      }
    }

    const submission = {
      id: submissionId,
      timestamp,
      kind: isPosition ? 'position' : 'application',
      type: fields.application_type || (isPosition ? 'open_position' : 'unknown'),
      fields,
      files,
      quota: quotaResult,
      meta: {
        ipCountry: request.headers.get('cf-ipcountry') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        referer: request.headers.get('referer') || '',
      },
    };

    const submissionKey = `${prefix}/${dateFolder}/${submissionId}/submission.json`;
    await env.APPLICATIONS.put(submissionKey, JSON.stringify(submission, null, 2), {
      httpMetadata: { contentType: 'application/json' },
      customMetadata: {
        submissionId,
        submissionKind: submission.kind,
        submitterName: fields.full_name || fields.company_name || '',
        submitterEmail: fields.email || fields.contact_email || '',
      },
    });

    let message;
    if (isPosition) {
      message = 'Position received. Our Web Expert Agents will review and publish approved roles within 2 business days.';
    } else if (isPositionApplication) {
      message = 'Application sent. The hiring contact has been notified, and you should hear back within 5 business days.';
    } else if (prefix === 'contact-messages') {
      message = 'Thanks for reaching out. Your message has reached the ContexAi team and we will respond within 2 business days.';
    } else {
      message = 'Application received. Our Web Expert Agents will review and respond within 5 business days.';
    }

    return jsonResponse({
      ok: true,
      submissionId,
      message,
      quota: role ? {
        used: quotaResult.used,
        remaining_free: quotaResult.remaining_free,
        remaining_credits: quotaResult.remaining_credits,
      } : null,
    }, 200, origin);
  } catch (err) {
    console.error('Submission handler error:', err);
    return jsonResponse(
      {
        ok: false,
        error: 'Something went wrong on our side. Please try again, or email amir.wahmed@contexai.org directly.',
      },
      500,
      origin,
    );
  }
}

// ─── Stripe Checkout ─────────────────────────────────────────────────────────

async function handleCheckoutSession(request, env) {
  const origin = request.headers.get('origin') || '';

  if (!env.STRIPE_SECRET_KEY) {
    return jsonResponse(
      { ok: false, error: 'Payments not yet configured. Please contact amir.wahmed@contexai.org' },
      503,
      origin,
    );
  }

  try {
    const body = await request.json();
    const { email, package: pkg, role: roleRaw } = body;
    const role = roleRaw === 'applicant' ? 'applicant' : 'employer'; // default to employer for backward compat

    if (!email || !email.includes('@')) {
      return jsonResponse({ ok: false, error: 'Valid email required' }, 400, origin);
    }
    if (!PACKAGES[pkg]) {
      return jsonResponse({ ok: false, error: 'Unknown package' }, 400, origin);
    }

    const priceMap = {
      starter: env.STRIPE_PRICE_STARTER,
      pro: env.STRIPE_PRICE_PRO,
    };
    const priceId = priceMap[pkg];

    if (!priceId) {
      return jsonResponse(
        { ok: false, error: 'Stripe price IDs not configured for this package' },
        503,
        origin,
      );
    }

    // Return path differs by role: employer -> /post-position, applicant -> /apply-position
    const returnPath = role === 'applicant' ? '/apply-position' : '/post-position';
    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('success_url', `https://contexai.org${returnPath}?session_id={CHECKOUT_SESSION_ID}&payment=success`);
    params.set('cancel_url', `https://contexai.org${returnPath}?payment=canceled`);
    params.set('customer_email', email);
    params.set('line_items[0][price]', priceId);
    params.set('line_items[0][quantity]', '1');
    params.set('metadata[email]', email.toLowerCase().trim());
    params.set('metadata[role]', role);
    params.set('metadata[package]', pkg);
    params.set('payment_intent_data[metadata][email]', email.toLowerCase().trim());
    params.set('payment_intent_data[metadata][role]', role);
    params.set('payment_intent_data[metadata][package]', pkg);

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await res.json();

    if (session.error) {
      console.error('Stripe checkout error:', session.error);
      return jsonResponse(
        { ok: false, error: session.error.message || 'Payment setup failed' },
        500,
        origin,
      );
    }

    return jsonResponse({ ok: true, checkout_url: session.url, session_id: session.id }, 200, origin);
  } catch (err) {
    console.error('Checkout session error:', err);
    return jsonResponse({ ok: false, error: 'Failed to create checkout session' }, 500, origin);
  }
}

// ─── Stripe webhook handler ──────────────────────────────────────────────────

async function handleStripeWebhook(request, env) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Webhook secret not configured', { status: 503 });
  }

  const sig = request.headers.get('stripe-signature') || '';
  const rawBody = await request.text();

  const verified = await verifyStripeSignature(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!verified) {
    return new Response('Invalid signature', { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (_) {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    // Backward-compat: older sessions used "employer_email"; new ones use "email" + "role"
    const email = session.metadata?.email || session.metadata?.employer_email || session.customer_email;
    const role = session.metadata?.role === 'applicant' ? 'applicant' : 'employer';
    const pkg = session.metadata?.package;

    if (!email) {
      console.error('Webhook: no email in completed session');
      return new Response('OK', { status: 200 });
    }

    let credits = 0;
    if (pkg && PACKAGES[pkg]) {
      credits = PACKAGES[pkg].credits;
    } else {
      const amount = session.amount_total;
      if (amount === PACKAGES.starter.amountCents) credits = PACKAGES.starter.credits;
      else if (amount === PACKAGES.pro.amountCents) credits = PACKAGES.pro.credits;
    }

    if (credits > 0) {
      const q = await getQuota(env, role, email);
      q.paid_credits = (q.paid_credits || 0) + credits;
      q.last_purchase_at = new Date().toISOString();
      q.last_purchase_pkg = pkg || 'unknown';
      await setQuota(env, role, email, q);
      console.log(`Granted ${credits} ${role} credits to ${email} via package ${pkg}`);

      // Log purchase to R2 for audit trail
      const purchaseKey = `purchases/${new Date().toISOString().split('T')[0]}/${session.id}.json`;
      await env.APPLICATIONS.put(
        purchaseKey,
        JSON.stringify({
          stripe_session_id: session.id,
          email,
          role,
          package: pkg,
          credits_granted: credits,
          amount_total: session.amount_total,
          currency: session.currency,
          completed_at: new Date().toISOString(),
        }, null, 2),
        { httpMetadata: { contentType: 'application/json' } },
      );
    }
  }

  return new Response('OK', { status: 200 });
}

async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader || !secret) return false;

  const parts = sigHeader.split(',');
  const tPart = parts.find((p) => p.startsWith('t='));
  if (!tPart) return false;
  const timestamp = tPart.slice(2);
  const v1Sigs = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (v1Sigs.length === 0) return false;

  // Reject if timestamp is older than 5 minutes (replay protection)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expected = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return v1Sigs.some((sig) => timingSafeEqual(sig, expected));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ─── Admin / Dashboard endpoints ─────────────────────────────────────────────
//
// Read-only views over R2 (applications, positions, purchases, engagements registry),
// KV (quota), and GitHub (commit history). Gated by Bearer ADMIN_TOKEN.

function adminCors(origin) {
  const allowed = ADMIN_ALLOWED_ORIGINS_REGEX.some((re) => re.test(origin || '')) ? origin : 'null';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function adminJson(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...adminCors(origin) },
  });
}

function isAdminAuthed(request, env) {
  if (!env.ADMIN_TOKEN) return false;
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return false;
  const supplied = auth.slice('Bearer '.length).trim();
  if (supplied.length !== env.ADMIN_TOKEN.length) return false;
  return timingSafeEqual(supplied, env.ADMIN_TOKEN);
}

async function handleAdminRoute(request, env, url) {
  const origin = request.headers.get('origin') || '';

  if (!isAdminAuthed(request, env)) {
    return adminJson({ ok: false, error: 'Unauthorized' }, 401, origin);
  }

  try {
    const path = url.pathname.replace(/^\/api\/admin\//, '');
    switch (path) {
      case 'applications': return await adminApplications(request, env, url, origin);
      case 'quota':        return await adminQuota(request, env, url, origin);
      case 'stripe-summary': return await adminStripeSummary(request, env, url, origin);
      case 'engagements':  return await adminEngagements(request, env, url, origin);
      case 'github-snapshot': return await adminGithubSnapshot(request, env, url, origin);
      default:
        return adminJson({ ok: false, error: 'Unknown admin route' }, 404, origin);
    }
  } catch (err) {
    console.error('Admin route error:', err);
    return adminJson({ ok: false, error: String(err?.message || err) }, 500, origin);
  }
}

// ─── /api/admin/applications ────────────────────────────────────────────────

async function adminApplications(request, env, url, origin) {
  const kind = url.searchParams.get('kind') || 'all'; // applications | positions | position-applications | contact-messages | all
  const since = url.searchParams.get('since'); // YYYY-MM-DD
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 500);

  const prefixes = kind === 'all'
    ? ['applications/', 'positions/', 'position-applications/', 'contact-messages/']
    : [`${kind}/`];

  const items = [];
  for (const prefix of prefixes) {
    let cursor;
    const pageMax = 1000;
    let pagesScanned = 0;
    while (pagesScanned < 3) { // hard ceiling for v1
      const list = await env.APPLICATIONS.list({ prefix, cursor, limit: pageMax });
      pagesScanned++;
      for (const obj of list.objects) {
        // Only the canonical submission.json carries the full record
        if (!obj.key.endsWith('/submission.json')) continue;
        if (since && obj.uploaded && obj.uploaded.toISOString().slice(0, 10) < since) continue;

        const meta = obj.customMetadata || {};
        items.push({
          id: meta.submissionId || obj.key.split('/').slice(-2)[0],
          kind: meta.submissionKind || prefix.replace('/', ''),
          key: obj.key,
          submitted_at: obj.uploaded ? obj.uploaded.toISOString() : null,
          submitter_name: meta.submitterName || '',
          submitter_email: meta.submitterEmail || '',
          size: obj.size,
        });
        if (items.length >= limit) break;
      }
      if (items.length >= limit) break;
      if (!list.truncated) break;
      cursor = list.cursor;
    }
    if (items.length >= limit) break;
  }

  items.sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''));

  return adminJson({ ok: true, count: items.length, items }, 200, origin);
}

// ─── /api/admin/quota ───────────────────────────────────────────────────────

async function adminQuota(request, env, url, origin) {
  if (!env.QUOTA_KV) {
    return adminJson({ ok: false, error: 'QUOTA_KV binding not available' }, 503, origin);
  }
  const roleFilter = url.searchParams.get('role') || 'all'; // employer | applicant | all

  const rows = [];
  let cursor;
  let pages = 0;
  while (pages < 5) {
    const list = await env.QUOTA_KV.list({ cursor, limit: 1000 });
    pages++;
    for (const k of list.keys) {
      const [role, ...emailParts] = k.name.split(':');
      if (role !== 'employer' && role !== 'applicant') continue;
      if (roleFilter !== 'all' && roleFilter !== role) continue;
      const data = await env.QUOTA_KV.get(k.name, 'json');
      if (!data) continue;
      rows.push({
        role,
        email: emailParts.join(':'),
        free_used: data.free_used || 0,
        paid_credits: data.paid_credits || 0,
        total_posts: data.total_posts || 0,
        last_post_at: data.last_post_at || null,
        last_purchase_at: data.last_purchase_at || null,
        last_purchase_pkg: data.last_purchase_pkg || null,
      });
    }
    if (list.list_complete || !list.cursor) break;
    cursor = list.cursor;
  }

  rows.sort((a, b) => (b.last_post_at || '').localeCompare(a.last_post_at || ''));

  const totals = {
    tracked_emails: rows.length,
    free_exhausted: rows.filter((r) => r.free_used >= FREE_POST_LIMIT).length,
    paid_active: rows.filter((r) => r.paid_credits > 0).length,
    total_posts_all_time: rows.reduce((s, r) => s + r.total_posts, 0),
  };

  return adminJson({ ok: true, totals, rows }, 200, origin);
}

// ─── /api/admin/stripe-summary ──────────────────────────────────────────────

async function adminStripeSummary(request, env, url, origin) {
  const days = Math.min(parseInt(url.searchParams.get('days') || '30', 10), 365);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const recent = [];
  let cursor;
  let pages = 0;
  while (pages < 3) {
    const list = await env.APPLICATIONS.list({ prefix: 'purchases/', cursor, limit: 1000 });
    pages++;
    for (const obj of list.objects) {
      if (obj.uploaded && obj.uploaded < cutoff) continue;
      const text = await env.APPLICATIONS.get(obj.key);
      if (!text) continue;
      try {
        const data = await text.json();
        recent.push({
          session_id: data.stripe_session_id,
          email: data.email,
          role: data.role,
          package: data.package,
          amount: data.amount_total,
          currency: data.currency,
          credits: data.credits_granted,
          at: data.completed_at,
        });
      } catch (_) { /* ignore malformed entries */ }
    }
    if (!list.truncated) break;
    cursor = list.cursor;
  }

  recent.sort((a, b) => (b.at || '').localeCompare(a.at || ''));

  const totals = {
    window_days: days,
    total_revenue_cents: recent.reduce((s, r) => s + (r.amount || 0), 0),
    successful_checkouts: recent.length,
    currency: recent[0]?.currency || 'usd',
    by_package: recent.reduce((acc, r) => { acc[r.package] = (acc[r.package] || 0) + 1; return acc; }, {}),
  };

  return adminJson({ ok: true, ...totals, recent }, 200, origin);
}

// ─── /api/admin/engagements ─────────────────────────────────────────────────

async function adminEngagements(request, env, url, origin) {
  const obj = await env.APPLICATIONS.get('engagements/registry.json');
  if (!obj) {
    return adminJson({
      ok: true,
      items: [],
      note: "Registry not yet created. PUT engagements/registry.json to R2 with shape: { items: [...] }",
    }, 200, origin);
  }
  try {
    const data = await obj.json();
    const items = Array.isArray(data) ? data : data.items || [];
    return adminJson({ ok: true, items }, 200, origin);
  } catch (err) {
    return adminJson({ ok: false, error: 'engagements/registry.json is not valid JSON' }, 500, origin);
  }
}

// ─── /api/admin/github-snapshot ─────────────────────────────────────────────

async function adminGithubSnapshot(request, env, url, origin) {
  const headers = { 'User-Agent': 'ContexAi-Dashboard/1.0', 'Accept': 'application/vnd.github+json' };
  if (env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${env.GITHUB_TOKEN}`;

  const [commitsRes, prsRes, issuesRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${GITHUB_REPO}/commits?per_page=15`, { headers }),
    fetch(`https://api.github.com/repos/${GITHUB_REPO}/pulls?state=open`, { headers }),
    fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues?state=open`, { headers }),
  ]);

  if (!commitsRes.ok) {
    return adminJson({ ok: false, error: `GitHub: ${commitsRes.status}` }, 502, origin);
  }

  const commits = await commitsRes.json();
  const prs = prsRes.ok ? await prsRes.json() : [];
  const issuesAll = issuesRes.ok ? await issuesRes.json() : [];
  // GitHub returns PRs in the issues list too; filter them out
  const issues = issuesAll.filter((i) => !i.pull_request);

  return adminJson({
    ok: true,
    repo: GITHUB_REPO,
    latest_commits: commits.map((c) => ({
      sha: c.sha?.slice(0, 7),
      message: c.commit?.message?.split('\n')[0] || '',
      author: c.commit?.author?.name || c.author?.login || 'unknown',
      at: c.commit?.author?.date,
      url: c.html_url,
    })),
    open_prs: prs.length,
    open_issues: issues.length,
    pr_list: prs.map((p) => ({ number: p.number, title: p.title, author: p.user?.login, at: p.created_at, url: p.html_url })),
    issue_list: issues.map((i) => ({ number: i.number, title: i.title, author: i.user?.login, at: i.created_at, url: i.html_url })),
  }, 200, origin);
}
