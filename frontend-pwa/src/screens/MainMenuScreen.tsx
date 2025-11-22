import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getMyActiveReceivings, getMyShippingOrders, listSkartDocuments, listPovracajDocuments } from '../lib/apiClient';
import { startHeartbeat } from '../../lib/heartbeat';
import { IconPrijem, IconOtprema, IconPopis, IconPremestaj, IconOpcije } from '../components/icons';

export default function MainMenuScreen() {
  const router = useRouter();
  const [activeCount, setActiveCount] = useState<number>(0);
  const [counts, setCounts] = useState<{ receiving: number; shipping: number; skart: number; povracaj: number }>({ receiving: 0, shipping: 0, skart: 0, povracaj: 0 });
  const [me, setMe] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);

  const load = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/'); return; }
      const meRes = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (meRes.status === 401) { localStorage.removeItem('token'); router.push('/'); return; }
      const meJson = await meRes.json(); setMe(meJson);
      await loadCounts(meJson);
    } catch (err) {
      console.error('PWA main menu load error', err);
    }
  };

  const loadCounts = async (user: any) => {
    try {
      const userId = Number(user?.id);
      const [
        receivings,
        shippingOrders,
        skartRes,
        povracajRes,
      ] = await Promise.all([
        getMyActiveReceivings().catch(() => []),
        getMyShippingOrders().catch(() => []),
        listSkartDocuments({ status: 'SUBMITTED', assignedToUserId: Number.isFinite(userId) ? userId : undefined }).catch(() => ({ data: [] })),
        listPovracajDocuments({ status: 'SUBMITTED', assignedToUserId: Number.isFinite(userId) ? userId : undefined }).catch(() => ({ data: [] })),
      ]);
      const receivingCount = Array.isArray(receivings) ? receivings.length : 0;
      const shippingCount = Array.isArray(shippingOrders) ? shippingOrders.length : 0;
      const skartList = Array.isArray((skartRes as any)?.data) ? (skartRes as any).data : (Array.isArray(skartRes) ? skartRes : []);
      const povracajList = Array.isArray((povracajRes as any)?.data) ? (povracajRes as any).data : (Array.isArray(povracajRes) ? povracajRes : []);
      setActiveCount(receivingCount);
      setCounts({
        receiving: receivingCount,
        shipping: shippingCount,
        skart: skartList.length,
        povracaj: povracajList.length,
      });
    } catch (err) {
      console.error('PWA badge count load error', err);
    }
  };

  useEffect(() => {
    // Start heartbeat when component mounts
    startHeartbeat();
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onInstallAvail = () => setCanInstall(true);
    if (typeof window !== 'undefined') {
      window.addEventListener('pwa-install-available', onInstallAvail);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pwa-install-available', onInstallAvail);
      }
    };
  }, []);

  const triggerInstall = async () => {
    const anyWin = window as any;
    const evt = anyWin.__pwaInstallPrompt;
    if (!evt) return;
    try {
      await evt.prompt();
      await evt.userChoice;
    } finally {
      setCanInstall(false);
      anyWin.__pwaInstallPrompt = null;
    }
  };

  const renderIconWithBadge = (IconComponent: React.ElementType, count: number) => (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <IconComponent />
      {count > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -6,
            right: -8,
            minWidth: 22,
            height: 22,
            borderRadius: 999,
            background: '#f87171',
            border: '1px solid rgba(255,255,255,0.4)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 6px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
          }}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #05070d 0%, #020304 100%)' }}>
      <div className="w-full flex justify-between items-center px-4 py-3" style={{ background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(2, 6, 23, 0.95))', backdropFilter: 'blur(10px)', color: '#fff', borderBottom: '1px solid rgba(148,163,184,0.25)', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
        <div className="flex items-center gap-3">
          <div style={{ background:'rgba(15,23,42,0.5)', borderRadius:12, padding:'4px 8px', border:'1px solid rgba(255,212,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.2)' }}>
            <img src="/logo-white.svg" alt="Alta WMS" style={{ height: 24 }} />
          </div>
          {canInstall && (
            <button onClick={triggerInstall} className="px-3 py-1 rounded text-sm font-bold" style={{ background: 'rgba(250,204,21,0.1)', color: '#fde68a', border: '1px solid rgba(250,204,21,0.35)', borderRadius: 12, padding: '8px 16px', fontWeight: 600 }}>
              Instaliraj
            </button>
          )}
        </div>
        <div className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.9)' }}>{me?.name || ''}</span>
          <button className="ml-2 px-3 py-1 rounded" style={{ background: 'rgba(148,163,184,0.15)', border: '1px solid rgba(148,163,184,0.4)', color: 'rgba(255,255,255,0.9)', borderRadius: 12, padding: '6px 14px', fontWeight: 600, cursor: 'pointer' }} onClick={()=>{ localStorage.removeItem('token'); router.push('/'); }}>Odjava</button>
        </div>
      </div>
      <div className="p-4 grid grid-cols-2 gap-4">
        <button onClick={()=>router.push('/pwa/receiving')} className="rounded-xl p-4 h-[110px] flex flex-col justify-center items-center font-bold text-xl active:scale-95 transition-transform" style={{ background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85), rgba(2, 6, 23, 0.85))', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 20, boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)', color: '#fde68a' }}>
          <div style={{ color: '#ffffff' }}>{renderIconWithBadge(IconPrijem, counts.receiving)}</div>
          <div>Prijem {activeCount > 0 ? `(${activeCount})` : ''}</div>
        </button>
        <button onClick={()=>router.push('/pwa/otprema')} className="rounded-xl p-4 h-[110px] flex flex-col justify-center items-center font-bold text-xl active:scale-95 transition-transform" style={{ background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85), rgba(2, 6, 23, 0.85))', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 20, color: '#fde68a' }}>
          <div style={{ color: '#ffffff' }}>{renderIconWithBadge(IconOtprema, counts.shipping)}</div>
          <div>Otprema {counts.shipping > 0 ? `(${counts.shipping})` : ''}</div>
        </button>
        <button onClick={()=>router.push('/pwa/skart')} className="rounded-xl p-4 h-[110px] flex flex-col justify-center items-center font-bold text-xl active:scale-95 transition-transform" style={{ background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85), rgba(2, 6, 23, 0.85))', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 20, color: '#fde68a' }}>
          <div style={{ color: '#ffffff' }}>{renderIconWithBadge(IconPopis, counts.skart)}</div>
          <div>SKART {counts.skart > 0 ? `(${counts.skart})` : ''}</div>
        </button>
        <button onClick={()=>router.push('/pwa/povracaj')} className="rounded-xl p-4 h-[110px] flex flex-col justify-center items-center font-bold text-xl active:scale-95 transition-transform" style={{ background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85), rgba(2, 6, 23, 0.85))', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 20, color: '#fde68a' }}>
          <div style={{ color: '#ffffff' }}>{renderIconWithBadge(IconPremestaj, counts.povracaj)}</div>
          <div>Povraćaj {counts.povracaj > 0 ? `(${counts.povracaj})` : ''}</div>
        </button>
        <div className="col-span-2 flex justify-center mt-2">
          <button disabled className="rounded-xl px-4 py-3 font-bold" style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 20, color: 'rgba(255,255,255,0.4)' }}>
            <span className="inline-flex items-center gap-2"><IconOpcije /> Dodatne opcije</span>
          </button>
        </div>
      </div>
    </div>
  );
}
