export async function fetchOverview() {
  // Always go through same-origin proxy to avoid CORS on TV
  const ts = Date.now();
  const res = await fetch(`/api/proxy/performance/overview?__ts=${ts}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load overview');
  return res.json();
}
