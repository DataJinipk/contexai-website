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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
      return corsPreflight(request);
    }

    if (url.pathname === '/api/apply' && request.method === 'POST') {
      return handleSubmission(request, env, 'applications');
    }

    if (url.pathname === '/api/post-position' && request.method === 'POST') {
      return handleSubmission(request, env, 'positions');
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

async function getEmployerQuota(env, email) {
  if (!env.QUOTA_KV) {
    // KV not yet bound — degrade gracefully: treat everyone as having free posts available
    return { free_used: 0, paid_credits: 0, total_posts: 0, kv_unavailable: true };
  }
  const key = `employer:${email.toLowerCase().trim()}`;
  const data = await env.QUOTA_KV.get(key, 'json');
  return data || { free_used: 0, paid_credits: 0, total_posts: 0 };
}

async function setEmployerQuota(env, email, quota) {
  if (!env.QUOTA_KV) return;
  const key = `employer:${email.toLowerCase().trim()}`;
  await env.QUOTA_KV.put(key, JSON.stringify(quota));
}

async function consumePostQuota(env, email) {
  const q = await getEmployerQuota(env, email);
  if (q.kv_unavailable) {
    // KV not configured yet; allow post and skip tracking
    return { ok: true, used: 'free', remaining_free: FREE_POST_LIMIT, kv_unavailable: true };
  }
  if (q.free_used < FREE_POST_LIMIT) {
    q.free_used += 1;
    q.total_posts += 1;
    q.last_post_at = new Date().toISOString();
    await setEmployerQuota(env, email, q);
    return { ok: true, used: 'free', remaining_free: FREE_POST_LIMIT - q.free_used, paid_credits: q.paid_credits };
  }
  if (q.paid_credits > 0) {
    q.paid_credits -= 1;
    q.total_posts += 1;
    q.last_post_at = new Date().toISOString();
    await setEmployerQuota(env, email, q);
    return { ok: true, used: 'paid', remaining_credits: q.paid_credits };
  }
  return { ok: false, requires_payment: true, free_used: q.free_used, paid_credits: 0 };
}

async function handleQuotaCheck(request, env) {
  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  const origin = request.headers.get('origin') || '';
  if (!email) return jsonResponse({ ok: false, error: 'email parameter required' }, 400, origin);
  const q = await getEmployerQuota(env, email);
  return jsonResponse({
    ok: true,
    free_used: q.free_used,
    free_remaining: Math.max(0, FREE_POST_LIMIT - q.free_used),
    paid_credits: q.paid_credits,
    total_posts: q.total_posts,
    can_post_free: q.free_used < FREE_POST_LIMIT,
    can_post_paid: q.paid_credits > 0,
  }, 200, origin);
}

// ─── Submission handler (applications + positions) ───────────────────────────

async function handleSubmission(request, env, prefix) {
  const origin = request.headers.get('origin') || '';
  const isPosition = prefix === 'positions';

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

    // First pass: collect text fields so we can do quota check before storing files
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
    } else {
      if (!fields.full_name || !fields.email) {
        return jsonResponse({ ok: false, error: 'Name and email are required' }, 400, origin);
      }
    }

    // Quota check for positions only — applications are unmetered
    let quotaResult = null;
    if (isPosition) {
      quotaResult = await consumePostQuota(env, fields.contact_email);
      if (!quotaResult.ok && quotaResult.requires_payment) {
        return jsonResponse({
          ok: false,
          requires_payment: true,
          free_used: quotaResult.free_used,
          message: `You've used all ${FREE_POST_LIMIT} free posts. Choose a package to continue posting.`,
          packages: Object.entries(PACKAGES).map(([key, p]) => ({
            key,
            credits: p.credits,
            label: p.label,
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

    const message = isPosition
      ? `Position received. Our Web Expert Agents will review and publish approved roles within 2 business days.`
      : 'Application received. Our Web Expert Agents will review and respond within 5 business days.';

    return jsonResponse({
      ok: true,
      submissionId,
      message,
      quota: isPosition ? {
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
    const { email, package: pkg } = body;

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

    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('success_url', 'https://contexai.org/post-position?session_id={CHECKOUT_SESSION_ID}&payment=success');
    params.set('cancel_url', 'https://contexai.org/post-position?payment=canceled');
    params.set('customer_email', email);
    params.set('line_items[0][price]', priceId);
    params.set('line_items[0][quantity]', '1');
    params.set('metadata[employer_email]', email.toLowerCase().trim());
    params.set('metadata[package]', pkg);
    params.set('payment_intent_data[metadata][employer_email]', email.toLowerCase().trim());
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
    const email = session.metadata?.employer_email || session.customer_email;
    const pkg = session.metadata?.package;

    if (!email) {
      console.error('Webhook: no email in completed session');
      return new Response('OK', { status: 200 }); // Stripe retries on non-2xx
    }

    let credits = 0;
    if (pkg && PACKAGES[pkg]) {
      credits = PACKAGES[pkg].credits;
    } else {
      // Fallback: derive from amount_total
      const amount = session.amount_total;
      if (amount === PACKAGES.starter.amountCents) credits = PACKAGES.starter.credits;
      else if (amount === PACKAGES.pro.amountCents) credits = PACKAGES.pro.credits;
    }

    if (credits > 0) {
      const q = await getEmployerQuota(env, email);
      q.paid_credits = (q.paid_credits || 0) + credits;
      q.last_purchase_at = new Date().toISOString();
      q.last_purchase_pkg = pkg || 'unknown';
      await setEmployerQuota(env, email, q);
      console.log(`Granted ${credits} credits to ${email} via package ${pkg}`);

      // Log purchase to R2 for audit trail
      const purchaseKey = `purchases/${new Date().toISOString().split('T')[0]}/${session.id}.json`;
      await env.APPLICATIONS.put(
        purchaseKey,
        JSON.stringify({
          stripe_session_id: session.id,
          email,
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
