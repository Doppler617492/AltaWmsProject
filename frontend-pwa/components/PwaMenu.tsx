import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { apiClient } from '../lib/apiClient';

const LottiePlayer = 'lottie-player' as any;

export default function PwaMenu() {
  const router = useRouter();
  // Put-away temporarily disabled
  const [putawayCount, setPutawayCount] = useState(0);
  const [shippingCount, setShippingCount] = useState(0);
  const [receivingCount, setReceivingCount] = useState(0);
  const [kpiData, setKpiData] = useState<any>(null);
  const [slaStats, setSlaStats] = useState<any>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        if (!cancelled) {
          setUserId(null);
          setUserRole('');
        }
        return;
      }
      try {
        const me = await apiClient.get('/auth/me');
        if (cancelled) return;
        setUserId(me?.id ?? null);
        setUserRole((me?.role || '').toLowerCase());
      } catch {
        if (!cancelled) {
          setUserId(null);
          setUserRole('');
        }
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const isStoreManager = ['sef_prodavnice', 'prodavnica', 'store'].includes(userRole);

  useEffect(() => {
    const loadAll = () => {
      if (!isStoreManager) {
        loadShippingCount();
        loadReceivingCount();
      } else {
        setShippingCount(0);
        setReceivingCount(0);
      }
      if (userId && !isStoreManager) {
        loadKpiData();
        loadSlaStats();
      } else if (isStoreManager) {
        setKpiData(null);
        setSlaStats(null);
      }
    };

    loadAll();
    const t = setInterval(loadAll, 60000);
    return () => clearInterval(t);
  }, [userId, isStoreManager]);

  // Put-away disabled
  async function loadPutawayCount() { setPutawayCount(0); }

  async function loadShippingCount() {
    try {
      const data = await apiClient.get('/shipping/my-orders');
      setShippingCount(Array.isArray(data) ? data.length : 0);
    } catch {
      setShippingCount(0);
    }
  }

  async function loadReceivingCount() {
    try {
      const data = await apiClient.get('/receiving/my-active');
      setReceivingCount(Array.isArray(data) ? data.length : 0);
    } catch {
      setReceivingCount(0);
    }
  }

  async function loadKpiData() {
    if (!userId) return;
    try {
      const data = await apiClient.get(`/kpi/workers/${userId}`);
      setKpiData(data);
    } catch {
      setKpiData(null);
    }
  }

  async function loadSlaStats() {
    if (!userId) return;
    try {
      const data = await apiClient.get(`/sla/stats?worker_id=${userId}`);
      setSlaStats(data);
    } catch {
      setSlaStats(null);
    }
  }

  const tileStyle: React.CSSProperties = {
    background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85), rgba(2, 6, 23, 0.85))',
    backdropFilter: 'blur(10px)',
    borderRadius: 20,
    padding: 20,
    textAlign: 'center',
    cursor: 'pointer',
    position: 'relative',
    minHeight: 150,
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    transition: 'all 0.3s ease',
  };

  const iconWrap: React.CSSProperties = {
    width: 76,
    height: 76,
    borderRadius: '50%',
    background: 'rgba(255,212,0,0.1)',
    border: '2px solid rgba(255,212,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 12px',
    boxShadow: '0 4px 12px rgba(255,212,0,0.2)',
  };

  const badgeStyle: React.CSSProperties = {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    background: 'rgba(250,204,21,0.15)',
    border: '1px solid rgba(250,204,21,0.4)',
    color: '#fde68a',
    borderRadius: '50%',
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    boxShadow: '0 4px 12px rgba(250,204,21,0.3)',
  };

  const tileCount = isStoreManager ? 2 : 4;
  const gridColumns = tileCount === 2 ? 'repeat(1, 1fr)' : 'repeat(2, 1fr)';

  return (
    <div style={{ padding: '16px', background: 'linear-gradient(180deg, #05070d 0%, #020304 100%)', minHeight: '100vh' }}>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: gridColumns, marginBottom: 12 }}>
        {!isStoreManager && (
          <div 
            onClick={() => router.push('/pwa/receiving')} 
            style={tileStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 40px 0 rgba(0, 0, 0, 0.4)';
              e.currentTarget.style.borderColor = 'rgba(255,212,0,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 32px 0 rgba(0, 0, 0, 0.3)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            {receivingCount > 0 && (
              <div style={badgeStyle}>
                {receivingCount}
              </div>
            )}
            <div style={iconWrap}>
              <LottiePlayer autoplay loop mode="normal" src="/icons/prijem.json" style={{ width: 56, height: 56, filter: 'brightness(0) invert(1)' }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fde68a' }}>Prijem</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
              {kpiData?.receivings_done || 0} danas
            </div>
          </div>
        )}

      {/* Put-away tile disabled per request */}

      {!isStoreManager && (
        <div 
          onClick={() => router.push('/pwa/otprema')} 
          style={tileStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 40px 0 rgba(0, 0, 0, 0.4)';
            e.currentTarget.style.borderColor = 'rgba(255,212,0,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 32px 0 rgba(0, 0, 0, 0.3)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          {shippingCount > 0 && (
            <div style={badgeStyle}>
              {shippingCount}
            </div>
          )}
          <div style={iconWrap}>
            <LottiePlayer autoplay loop mode="normal" src="/icons/otprema.json" style={{ width: 56, height: 56, filter: 'brightness(0) invert(1)' }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fde68a' }}>Otprema</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
            {kpiData?.shipments_done || 0} danas
          </div>
        </div>
      )}

        {/* Inventar (Popis) tile enabled */}
        <div 
          onClick={() => router.push('/pwa/popis')} 
          style={tileStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 40px 0 rgba(0, 0, 0, 0.4)';
            e.currentTarget.style.borderColor = 'rgba(255,212,0,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 32px 0 rgba(0, 0, 0, 0.3)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          <div style={iconWrap}>
            <LottiePlayer autoplay loop mode="normal" src="/icons/inventar.json" style={{ width: 56, height: 56, filter: 'brightness(0) invert(1)' }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fde68a' }}>Inventar</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
          </div>
        </div>

        {/* Skart tile */}
        <div 
          onClick={() => router.push('/pwa/skart')} 
          style={{ ...tileStyle, background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85), rgba(2, 6, 23, 0.85))', border: '1px solid rgba(250,204,21,0.3)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 40px 0 rgba(0, 0, 0, 0.4)';
            e.currentTarget.style.borderColor = 'rgba(255,212,0,0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 32px 0 rgba(0, 0, 0, 0.3)';
            e.currentTarget.style.borderColor = 'rgba(250,204,21,0.3)';
          }}
        >
          <div style={iconWrap}>
            <LottiePlayer autoplay loop mode="normal" src="/icons/skart.json" style={{ width: 56, height: 56, filter: 'brightness(0) invert(1)' }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fde68a' }}>Skart</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
            Evidencija oštećene robe
          </div>
        </div>

        {/* Povraćaj tile */}
        <div 
          onClick={() => router.push('/pwa/povracaj')} 
          style={tileStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 40px 0 rgba(0, 0, 0, 0.4)';
            e.currentTarget.style.borderColor = 'rgba(255,212,0,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 32px 0 rgba(0, 0, 0, 0.3)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          <div style={iconWrap}>
            <LottiePlayer autoplay loop mode="normal" src="/icons/povracaj.json" style={{ width: 56, height: 56, filter: 'brightness(0) invert(1)' }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fde68a' }}>Povraćaj</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
            Evidencija povratne robe
          </div>
        </div>
      </div>

      {/* Zebra‑friendly: bez KPI i SLA panela na PWA (to je na TV) */}
    </div>
  );
}
