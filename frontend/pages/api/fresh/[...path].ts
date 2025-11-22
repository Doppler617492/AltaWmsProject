import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: false, // Disable body parsing for file uploads
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const bases = [
    process.env.API_BASE_URL || '',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://host.docker.internal:8000',
    'http://backend:8000',
    'http://alta-wms-backend:8000',
  ].filter(Boolean);
  const pathSegs = (req.query.path as string[] || []).filter(Boolean);
  const relPath = pathSegs.join('/');
  
  // Prikupi query parametre iz originalnog zahteva (osim 'path')
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key !== 'path' && key !== '__ts' && value) {
      if (Array.isArray(value)) {
        value.forEach(v => queryParams.append(key, String(v)));
      } else {
        queryParams.append(key, String(value));
      }
    }
  }
  const queryString = queryParams.toString();
  const errors: any[] = [];
  
  // Check if this is a multipart form upload
  const isMultipart = req.headers['content-type']?.includes('multipart/form-data');
  
  let headers: Record<string,string> = {};
  let requestBody: any = undefined;

  async function readRawBody(r: NextApiRequest): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      (r as any).on('data', (chunk: Buffer) => chunks.push(chunk));
      (r as any).on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      (r as any).on('error', reject);
    });
  }
  
  if (isMultipart) {
    // Stream the original multipart request directly to backend.
    // Avoid parsing/rewrapping; this preserves streaming and removes dependency on formidable/form-data.
    requestBody = req as any;
    // Forward only necessary headers
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string' && ['authorization','content-type','x-api-key'].includes(k)) headers[k] = v;
    }
  } else {
    // Regular request handling
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string' && ['authorization','content-type','x-api-key'].includes(k)) headers[k] = v;
    }
    // Parse request body if present (but not for DELETE without body)
    if (!['GET', 'HEAD', 'DELETE'].includes(req.method || '')) {
      if (req.body) {
        requestBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      } else {
        // bodyParser is disabled for this route; manually read raw body
        try {
          const raw = await readRawBody(req);
          requestBody = raw && raw.length ? raw : undefined;
        } catch {}
      }
    } else if (req.method === 'DELETE') {
      // DELETE requests typically don't have a body
      requestBody = undefined;
    }
  }
  
  for (const base of bases) {
    const url = `${base}/${relPath}${queryString ? `?${queryString}` : ''}`;
    try {
      const init: any = {
        method: req.method,
        headers,
        cache: 'no-store',
      };
      // Only include body if it exists (not for DELETE without body)
      if (requestBody !== undefined && requestBody !== null) {
        init.body = requestBody;
      }
      // When streaming a request body (Readable), Node's fetch requires duplex: 'half'
      if (isMultipart && requestBody) init.duplex = 'half';
      let r = await fetch(url, init);
      if (r.status === 304) {
        const bustUrl = `${url}${url.includes('?') ? '&' : '?'}__ts=${Date.now()}`;
        r = await fetch(bustUrl, init);
      }
      const ct = r.headers.get('content-type') || '';
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
  return res.status(502).json({ error: 'Proxy error', tried: bases, errors });
}
