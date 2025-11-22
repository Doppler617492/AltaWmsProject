import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PwaHeader from '../../components/PwaHeader';
import PwaBackButton from '../../components/PwaBackButton';

export default function PopisListScreen(){
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const apiBase = (process.env.NEXT_PUBLIC_API_URL as string) || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8000` : 'http://localhost:8000');
  const load = async ()=>{
    setLoading(true);
    try {
      const token = localStorage.getItem('token')||'';
      const r = await fetch(`${apiBase}/cycle-count/my-tasks`, { headers: { Authorization: `Bearer ${token}` }});
      const d = await r.json(); setRows(Array.isArray(d)?d:[]);
    } catch{} finally{ setLoading(false);} };
  useEffect(()=>{ load(); },[]);
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #05070d 0%, #020304 100%)' }}>
      <PwaHeader name={''} onLogout={()=>{ localStorage.removeItem('token'); router.push('/'); }} />
      <div style={{ padding: '16px' }}>
        <div style={{ marginBottom: 16 }}>
          <PwaBackButton />
        </div>
        <div style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, marginBottom: 16, background: 'linear-gradient(135deg,#ffd400 0%,#ffaa00 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em' }}>Moji popisi</div>
        {loading? <div style={{ color: 'rgba(255,255,255,0.6)', padding: 20, textAlign: 'center' }}>Učitavanje…</div> : rows.length===0 ? <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, padding: 20, textAlign: 'center' }}>Nema zadataka.</div> : (
          <div style={{ display: 'grid', gap: 16 }}>
            {rows.map((t:any)=>(
              <button key={t.id} style={{ background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85), rgba(2, 6, 23, 0.85))', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 20, padding: 20, textAlign: 'left', color: '#fff', cursor: 'pointer', transition: 'all 0.2s' }} onClick={()=>router.push(`/pwa/popis/${t.id}`)} onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,212,0,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: '#fde68a' }}>{t.scope} · {t.target_code}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Status: {t.status}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
