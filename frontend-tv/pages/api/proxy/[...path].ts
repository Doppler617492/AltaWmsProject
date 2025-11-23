import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: { bodyParser: true },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // No caching at proxy level
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const bases = [
    process.env.NEXT_PUBLIC_BACKEND_URL || '',
    'http://host.docker.internal:8000',
    'http://backend:8000',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
  ].filter(Boolean);

  const segs = (req.query.path as string[] || []).filter(Boolean);
  const relPath = segs.join('/');
  // Get token from env or from query parameter passed by client
  let token = process.env.NEXT_PUBLIC_TV_KIOSK_TOKEN || process.env.TV_KIOSK_TOKEN || '';
  // If no token in env, try to get from query params (client might pass it)
  if (!token && typeof req.query.kioskToken === 'string') {
    token = req.query.kioskToken;
  }
  const headers: Record<string,string> = { 'x-kiosk-token': token };
  const ct = req.headers['content-type'];
  if (typeof ct === 'string') headers['content-type'] = ct;

  let body: any = undefined;
  if (!['GET','HEAD'].includes(req.method || '')) {
    body = req.body ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) : undefined;
  }

  const errors: any[] = [];
  for (const base of bases) {
    const url = `${base}/${relPath}`;
    try {
      const r = await fetch(url, { method: req.method, headers, body, cache: 'no-store' as RequestCache });
      const respCt = r.headers.get('content-type') || '';
      res.status(r.status);
      if (respCt.includes('application/json')) {
        const json = await r.json();
        res.setHeader('Content-Type','application/json');
        return res.send(json);
      }
      const buf = Buffer.from(await r.arrayBuffer());
      res.setHeader('Content-Type', respCt || 'application/octet-stream');
      return res.send(buf);
    } catch (e:any) {
      errors.push({ base, error: e?.message || String(e) });
    }
  }
  return res.status(502).json({ error: 'Proxy error', errors, tried: bases });
}

