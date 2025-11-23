export async function fetchOverview() {
  // Always go through same-origin proxy to avoid CORS on TV
  const ts = Date.now();
  const token = process.env.NEXT_PUBLIC_TV_KIOSK_TOKEN || '';
  const res = await fetch(`/api/proxy/performance/overview?__ts=${ts}&kioskToken=${encodeURIComponent(token)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load overview');
  return res.json();
}
