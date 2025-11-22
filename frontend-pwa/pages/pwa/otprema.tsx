import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PwaHeader from '../../components/PwaHeader';
import { apiClient } from '../../lib/apiClient';
import PwaBackButton from '../../components/PwaBackButton';

export default function PwaShippingList() {
  const router = useRouter();
  const [user, setUser] = useState<any|null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    const token = localStorage.getItem('token');
    if (!token) { router.push('/'); return; }
    const payload = JSON.parse(atob(token.split('.')[1]));
    setUser({ id: payload.sub, username: payload.username, role: payload.role });
    load();
  },[]);

  async function load() {
    try { setLoading(true); const d = await apiClient.get('/shipping/my-orders'); setRows(Array.isArray(d)?d:[]);} finally { setLoading(false); }
  }

  if (!user) return null;

  return (
    <div style={{ background: 'linear-gradient(180deg, #05070d 0%, #020304 100%)', minHeight: '100vh' }}>
      <PwaHeader name={user.username} onLogout={()=>{ localStorage.removeItem('token'); router.push('/'); }} />
      <div style={{ padding: '16px' }}>
        <div style={{ marginBottom: 16 }}>
          <PwaBackButton />
        </div>
        <div style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, marginBottom: 16, background: 'linear-gradient(135deg,#ffd400 0%,#ffaa00 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em' }}>Moji nalozi za otpremu</div>
        {loading ? <div style={{ color: 'rgba(255,255,255,0.6)', padding: 20, textAlign: 'center' }}>Učitavanje…</div> : rows.length===0 ? <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, padding: 20, textAlign: 'center' }}>Nema aktivnih naloga.</div> : (
          <div style={{ display:'grid', gap: 16 }}>
            {rows.map((r:any)=> (
              <div key={r.order_id} style={{ background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85), rgba(2, 6, 23, 0.85))', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 20, padding: 20, boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)' }}>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color:'#fde68a' }}>{r.order_number}</div>
                <div style={{ color:'rgba(255,255,255,0.9)', marginBottom: 8, fontSize: 14 }}>{r.customer_name}</div>
                <div style={{ color:'rgba(255,255,255,0.6)', marginBottom: 12, fontSize: 13 }}>Status: {r.status}</div>
                <button onClick={()=>router.push(`/pwa/otprema/${r.order_id}`)} style={{ width:'100%', background:'rgba(250,204,21,0.1)', color:'#fde68a', border:'1px solid rgba(250,204,21,0.35)', padding: 12, borderRadius: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(250,204,21,0.15)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(250,204,21,0.1)'; }}>Otvori</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

