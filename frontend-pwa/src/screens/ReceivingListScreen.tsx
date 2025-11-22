import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getMyActiveReceivings, startReceiving } from '../lib/apiClient';
import PwaHeader from '../../components/PwaHeader';
import PwaBackButton from '../../components/PwaBackButton';

export default function ReceivingListScreen() {
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);

  const load = async () => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/'); return; }
    const meRes = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (meRes.status === 401) { localStorage.removeItem('token'); router.push('/'); return; }
    const meJson = await meRes.json(); setMe(meJson);
    const data = await getMyActiveReceivings();
    setList(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const go = async (doc: any) => {
    if (doc.status === 'on_hold') { setToast('Ovaj prijem je trenutno pauziran'); return; }
    if (doc.status === 'completed') { setToast('Prijem je završen'); return; }
    // Nema više ručnog prihvatanja – zadaci su odmah aktivni
    router.push(`/pwa/receiving/${doc.id}`);
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #05070d 0%, #020304 100%)' }}>
      <PwaHeader name={me?.name || me?.username || ''} onLogout={()=>{ localStorage.removeItem('token'); router.push('/'); }} />
      <div style={{ padding: '16px' }}>
        <div style={{ marginBottom: 16 }}>
          <PwaBackButton />
        </div>
        <div style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, marginBottom: 16, background: 'linear-gradient(135deg,#ffd400 0%,#ffaa00 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em' }}>Moji prijemni nalozi</div>
      {toast && (
        <div className="px-4 py-2 text-white" style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 12, marginBottom: 16, padding: '12px 16px', color: '#f87171' }} onClick={()=>setToast(null)}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>{toast}</div>
            <div style={{ background:'rgba(15,23,42,0.5)', borderRadius:8, padding:'2px 6px', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <img src="/logo-white.svg" alt="Alta WMS" style={{ height: 14 }} />
            </div>
          </div>
        </div>
      )}
        {list.length===0 ? (
          <div style={{ color:'rgba(255,255,255,0.6)', fontSize: 14, padding: 20, textAlign: 'center' }}>Nema aktivnih prijema.</div>
        ) : (
          <div style={{ display:'grid', gap: 16 }}>
            {list.map((d:any) => (
              <div key={d.id} style={{ background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85), rgba(2, 6, 23, 0.85))', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 20, padding: 20, boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)' }}>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color:'#fde68a' }}>{d.document_number}</div>
                {d.supplier_name && (
                  <div style={{ color:'rgba(255,255,255,0.9)', marginBottom: 8, fontSize: 14 }}>{d.supplier_name}</div>
                )}
                <div style={{ color:'rgba(255,255,255,0.6)', marginBottom: 12, fontSize: 13 }}>Status: {(d.status||'').toUpperCase()}</div>
                <button onClick={()=>go(d)} style={{ width:'100%', background:'rgba(250,204,21,0.1)', color:'#fde68a', border:'1px solid rgba(250,204,21,0.35)', padding: 12, borderRadius: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(250,204,21,0.15)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(250,204,21,0.1)'; }}>Otvori</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
