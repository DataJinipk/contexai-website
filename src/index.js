// ContexAi Worker — serves static assets and handles application form POSTs.
// Application submissions land in R2 bucket APPLICATIONS as JSON + uploaded files.

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight for the application endpoint
    if (url.pathname === '/api/apply' && request.method === 'OPTIONS') {
      return corsPreflight();
    }

    // Application form POST handler
    if (url.pathname === '/api/apply' && request.method === 'POST') {
      return handleApplication(request, env);
    }

    // Everything else: defer to the static assets binding
    return env.ASSETS.fetch(request);
  },
};

const ALLOWED_ORIGINS = [
  'https://contexai.org',
  'https://www.contexai.org',
  'https://contexai-website.amir-wahmed.workers.dev',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : 'https://contexai.org';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

async function handleApplication(request, env) {
  const origin = request.headers.get('origin') || '';

  try {
    const ct = request.headers.get('content-type') || '';
    if (!ct.includes('multipart/form-data') && !ct.includes('application/x-www-form-urlencoded')) {
      return jsonResponse({ ok: false, error: 'Expected form data' }, 400, origin);
    }

    // Cap total request body at 25 MB to keep R2 usage predictable
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > 25 * 1024 * 1024) {
      return jsonResponse({ ok: false, error: 'Request too large (max 25 MB total)' }, 413, origin);
    }

    const formData = await request.formData();

    // Identifiers
    const submissionId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const dateFolder = timestamp.split('T')[0]; // YYYY-MM-DD

    // Sort entries into text fields and files
    const fields = {};
    const files = [];
    const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file

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
        const r2Key = `${dateFolder}/${submissionId}/${safeName}`;

        await env.APPLICATIONS.put(r2Key, value.stream(), {
          httpMetadata: {
            contentType: value.type || 'application/octet-stream',
          },
          customMetadata: {
            originalName: value.name,
            submissionId,
            uploadedAt: timestamp,
            applicantName: String(formData.get('full_name') || ''),
          },
        });

        files.push({
          name: value.name,
          size: value.size,
          contentType: value.type,
          r2Key,
        });
      } else if (typeof value === 'string') {
        fields[key] = value;
      }
    }

    // Quick required-field gate
    if (!fields.full_name || !fields.email) {
      return jsonResponse({ ok: false, error: 'Name and email are required' }, 400, origin);
    }

    // Build submission record
    const submission = {
      id: submissionId,
      timestamp,
      type: fields.application_type || 'unknown',
      fields,
      files,
      meta: {
        ipCountry: request.headers.get('cf-ipcountry') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        referer: request.headers.get('referer') || '',
      },
    };

    // Save submission JSON
    const submissionKey = `${dateFolder}/${submissionId}/submission.json`;
    await env.APPLICATIONS.put(
      submissionKey,
      JSON.stringify(submission, null, 2),
      {
        httpMetadata: { contentType: 'application/json' },
        customMetadata: {
          submissionId,
          applicantName: fields.full_name,
          applicantEmail: fields.email,
          applicationType: submission.type,
        },
      },
    );

    return jsonResponse(
      {
        ok: true,
        submissionId,
        message:
          "Application received. Our Web Expert Agents will review and respond within 5 business days.",
      },
      200,
      origin,
    );
  } catch (err) {
    console.error('Application handler error:', err);
    return jsonResponse(
      {
        ok: false,
        error:
          'Something went wrong on our side. Please try again, or email amir.wahmed@contexai.org directly.',
      },
      500,
      origin,
    );
  }
}
