// ContexAi Worker — serves static assets and handles form POSTs.
// Submissions land in R2 bucket APPLICATIONS:
//   - applications/YYYY-MM-DD/<uuid>/{submission.json, attachments...}
//   - positions/YYYY-MM-DD/<uuid>/{submission.json, attachments...}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
      return corsPreflight(request);
    }

    // Application form POST (Experts / AI Builders)
    if (url.pathname === '/api/apply' && request.method === 'POST') {
      return handleSubmission(request, env, 'applications');
    }

    // Employer position POST
    if (url.pathname === '/api/post-position' && request.method === 'POST') {
      return handleSubmission(request, env, 'positions');
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

async function handleSubmission(request, env, prefix) {
  // prefix is 'applications' (Experts/AI Builders) or 'positions' (Employers)
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

    const submissionId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const dateFolder = timestamp.split('T')[0];

    const fields = {};
    const files = [];
    const MAX_FILE_BYTES = 10 * 1024 * 1024;

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
          httpMetadata: {
            contentType: value.type || 'application/octet-stream',
          },
          customMetadata: {
            originalName: value.name,
            submissionId,
            uploadedAt: timestamp,
            submitterName: String(formData.get('full_name') || formData.get('contact_name') || ''),
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

    const submission = {
      id: submissionId,
      timestamp,
      kind: isPosition ? 'position' : 'application',
      type: fields.application_type || (isPosition ? 'open_position' : 'unknown'),
      fields,
      files,
      meta: {
        ipCountry: request.headers.get('cf-ipcountry') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        referer: request.headers.get('referer') || '',
      },
    };

    const submissionKey = `${prefix}/${dateFolder}/${submissionId}/submission.json`;
    await env.APPLICATIONS.put(
      submissionKey,
      JSON.stringify(submission, null, 2),
      {
        httpMetadata: { contentType: 'application/json' },
        customMetadata: {
          submissionId,
          submissionKind: submission.kind,
          submitterName: fields.full_name || fields.company_name || '',
          submitterEmail: fields.email || fields.contact_email || '',
        },
      },
    );

    const message = isPosition
      ? 'Position received. Our Web Expert Agents will review and publish approved roles within 2 business days.'
      : 'Application received. Our Web Expert Agents will review and respond within 5 business days.';

    return jsonResponse({ ok: true, submissionId, message }, 200, origin);
  } catch (err) {
    console.error('Submission handler error:', err);
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
