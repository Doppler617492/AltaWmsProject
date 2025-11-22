import { useEffect, useState } from 'react';

interface Props {
  name: string;
  onLogout: () => void;
}

export default function PwaHeader({ name, onLogout }: Props) {
  const [installReady, setInstallReady] = useState(false);

  useEffect(() => {
    const s = localStorage.getItem('pwa_font_scale') as 'md'|'lg'|null;
    document.documentElement.style.fontSize = s === 'lg' ? '18px' : '16px';
    const onAvail = () => setInstallReady(true);
    window.addEventListener('pwa-install-available', onAvail);
    if ((window as any).__pwaInstallPrompt) setInstallReady(true);
    return () => window.removeEventListener('pwa-install-available', onAvail);
  }, []);

  async function install() {
    const promptEvt = (window as any).__pwaInstallPrompt;
    if (!promptEvt) return;
    try { await promptEvt.prompt(); await promptEvt.userChoice; } catch {}
    (window as any).__pwaInstallPrompt = null;
    setInstallReady(false);
  }

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(2, 6, 23, 0.95))',
        backdropFilter: 'blur(10px)',
        color: '#fff',
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: 64,
        borderBottom: '1px solid rgba(148,163,184,0.25)',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
      }}
    >
      {/* Left logo */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ background:'rgba(15,23,42,0.5)', borderRadius:12, padding:'4px 8px', border:'1px solid rgba(255,212,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.2)' }}>
          <img src="/logo-white.svg" alt="Alta WMS" style={{ height: 24 }} />
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        {/* User info chip */}
        <div style={{ background:'rgba(148,163,184,0.15)', border:'1px solid rgba(148,163,184,0.4)', color:'rgba(255,255,255,0.9)', borderRadius: 999, padding:'6px 14px', fontSize: 13, fontWeight: 600, lineHeight: 1 }}>
          {name || 'Nije prijavljen'}
        </div>
        {installReady && (
          <button
            onClick={install}
            className="focus-ring"
            style={{ background:'rgba(250,204,21,0.1)', color:'#fde68a', border:'1px solid rgba(250,204,21,0.35)', padding:'8px 16px', borderRadius:12, fontWeight:600, cursor:'pointer' }}
          >
            Instaliraj
          </button>
        )}
        <button
          onClick={onLogout}
          className="focus-ring"
          aria-label="Odjava"
          title="Odjava"
          style={{ background: 'rgba(250,204,21,0.1)', color: '#fde68a', border: '1px solid rgba(250,204,21,0.35)', padding: 8, borderRadius: 12, fontWeight: 600, cursor: 'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
        >
          <img src="/icons/logout.svg" alt="Odjava" style={{ width: 20, height: 20 }} />
        </button>
      </div>
    </div>
  );
}
