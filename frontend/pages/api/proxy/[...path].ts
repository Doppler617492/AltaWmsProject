import type { NextApiRequest, NextApiResponse } from 'next';

// Disable body parsing - we'll handle it manually to preserve raw body for proxy
export const config = {
  api: {
    bodyParser: true, // Enable JSON parsing
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Force no-cache on proxy to avoid 304/ETag issues from Next.js layer
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const bases = [
    // Prefer Docker host gateway first for dev containers
    'http://host.docker.internal:8000',
    // Then service DNS and container name
    'http://backend:8000',
    'http://alta-wms-backend:8000',
    // For local dev (non-Docker frontend), try localhost
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    // Final fallback: env override if provided
    process.env.API_BASE_URL || ''
  ].filter(Boolean);
  const pathSegs = (req.query.path as string[] || []).filter(Boolean);
  const relPath = pathSegs.join('/');
  const errors: any[] = [];
  const headers: Record<string,string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    // Forward only safe headers; drop conditional cache validators to avoid 304
    if (typeof v === 'string' && ['authorization','content-type','x-api-key'].includes(k)) headers[k] = v;
  }
  
  // Parse request body if present
  let requestBody: any = undefined;
  if (!['GET', 'HEAD'].includes(req.method || '')) {
    if (req.body) {
      requestBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }
  }
  
  for (const base of bases) {
    const url = `${base}/${relPath}`;
    try {
      let r = await fetch(url, {
        method: req.method,
        headers,
        cache: 'no-store',
        body: requestBody,
      });
      // If upstream returned 304 (due to some intermediary cache), force a re-fetch bypassing caches
      if (r.status === 304) {
        const bustUrl = `${url}${url.includes('?') ? '&' : '?'}__ts=${Date.now()}`;
        r = await fetch(bustUrl, {
          method: req.method,
          headers,
          cache: 'no-store',
          body: requestBody,
        });
      }
      const ct = r.headers.get('content-type') || '';
      // Ensure ETag is not propagated to avoid client 304s
      try { res.removeHeader('ETag'); } catch {}
      res.status(r.status);
      if (ct.includes('application/json')) {
        const json = await r.json();
        res.setHeader('Content-Type','application/json');
        return res.send(json);
      }
      const buf = Buffer.from(await r.arrayBuffer());
      res.setHeader('Content-Type', ct || 'application/octet-stream');
      return res.send(buf);
    } catch (e:any) {
      errors.push({ base, error: e?.message || String(e) });
    }
  }
  // Graceful health response: avoid breaking UI when backend is down
  if (relPath === 'health') {
    return res.status(200).json({ ok: false, tried: bases, errors });
  }
  return res.status(502).json({ error: 'Proxy error', tried: bases, errors });
}
