import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { colors } from '../src/theme/colors';

export default function ControlCenter() {
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const d = await apiClient.get('/receiving/active/dashboard');
      setData(d);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Greška pri učitavanju');
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  if (!data && !error) return <div>Učitavanje...</div>;
  if (error) return <div style={{ color: '#c00' }}>Greška: {error}</div>;

  const workers = data?.workers || [];
  const receivings = data?.receivings || [];

  const activeCount = receivings.length;
  const onHold = receivings.filter((r: any) => r.status === 'on_hold').length;
  const idleWorkers = workers.filter((w: any) => w.status === 'IDLE').length;
  const avgProgress = receivings.length > 0 ? Math.round(receivings.reduce((s: number, r: any) => s + (r.percent_complete || 0), 0) / receivings.length) : 0;

  return (
    <div>
      <h2>Kontrolni centar – Prijem</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, margin: '12px 0' }}>
        <SummaryCard title="Aktivni prijemi" value={activeCount} />
        <SummaryCard title="Na čekanju" value={onHold} />
        <SummaryCard title="Radnici na terenu" value={workers.length} />
        <SummaryCard title="Idle radnici" value={idleWorkers} />
        <SummaryCard title="Prosečan progres" value={`${avgProgress}%`} />
      </div>

      <h3>Radnici</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginTop: 8 }}>
        {workers.map((w: any, idx: number) => (
          <div key={idx} style={{ border: `1px solid ${colors.brandYellow}`, borderRadius: 8, padding: 12, background: '#0a0a0a', color:'#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, color: colors.brandYellow }}>{w.name}</div>
              <span style={{ background: '#ffc107', color: '#000', fontSize: 12, padding: '2px 6px', borderRadius: 6 }}>{w.shift || 'Smena'}</span>
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: '#ddd' }}>Aktivnih prijema: <strong style={{ color:'#fff' }}>{w.active_receivings}</strong></div>
            <div style={{ marginTop: 6, height: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 6 }}>
              <div style={{ height: 8, width: `${w.percent_total || 0}%`, background: (w.percent_total || 0) >= 80 ? '#28a745' : '#ffc107', borderRadius: 6 }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: '#bbb' }}>Poslednja aktivnost: {w.last_activity ? new Date(w.last_activity).toLocaleTimeString('sr-Latn-RS') : '—'}</div>
            <div style={{ marginTop: 6 }}>
              <StatusPill status={w.status} />
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ marginTop: 16 }}>Aktivni prijemi</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, marginTop: 8 }}>
        {receivings.map((r: any, idx: number) => (
          <div key={idx} style={{ border: `1px solid ${colors.brandYellow}`, borderRadius: 8, padding: 12, background: '#0a0a0a', color:'#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, color: colors.brandYellow }}>{r.document_number}</div>
              <span style={{ fontSize: 12, color: r.status === 'on_hold' ? '#dc3545' : '#ffc107' }}>{(r.status || '').toUpperCase()}</span>
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: '#ddd' }}>{r.supplier_name}</div>
            <div style={{ marginTop: 4, fontSize: 13, color: '#ddd' }}>Radnik: <strong style={{ color:'#fff' }}>{r.assigned_user_name}</strong></div>
            <div style={{ marginTop: 6, height: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 6 }}>
              <div style={{ height: 8, width: `${r.percent_complete || 0}%`, background: r.percent_complete >= 80 ? '#28a745' : '#ffc107', borderRadius: 6 }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: '#bbb' }}>Proteklo: {r.elapsed_minutes} min</div>
            {r.on_hold_reason && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#dc3545' }}>Na čekanju: {r.on_hold_reason}</div>
            )}
            {(r.warnings?.slow_progress || r.warnings?.blocked) && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#c77d00' }}>Upozorenje: {r.warnings?.slow_progress ? 'Zastoj' : ''} {r.warnings?.blocked ? 'Blokada' : ''}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: any }) {
  return (
    <div style={{ border: `1px solid ${colors.brandYellow}`, borderRadius: 8, padding: 12, background: '#0a0a0a', color:'#fff' }}>
      <div style={{ fontSize: 13, color: colors.brandYellow }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color:'#fff' }}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: 'ACTIVE'|'BUSY'|'IDLE'|string }) {
  const color = status === 'IDLE' ? '#aaa' : (status === 'BUSY' ? '#28a745' : '#22a6b3');
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ width: 8, height: 8, borderRadius: 99, background: color, display: 'inline-block' }} />
      {status}
    </span>
  );
}
