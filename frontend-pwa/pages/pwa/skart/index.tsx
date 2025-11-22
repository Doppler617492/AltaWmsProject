import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PwaHeader from '../../../components/PwaHeader';
import PwaBackButton from '../../../components/PwaBackButton';
import { getSkartSummary, listSkartDocuments } from '../../../src/lib/apiClient';

export default function SkartHomePage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/'); return; }
    fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (res) => {
      if (res.status === 401) {
        localStorage.removeItem('token');
        router.push('/');
        return;
      }
      const json = await res.json();
      setMe(json);
    });

    getSkartSummary('today').then(setSummary).catch((e) => {
      setToast(e?.message || 'Neuspešno učitavanje SKART statistike.');
    });
    loadDocuments();
  }, [router]);

  async function loadDocuments() {
    try {
      setLoadingDocs(true);
      const response = await listSkartDocuments({ status: 'ALL' });
      if (Array.isArray(response?.data)) {
        setDocuments(response.data);
      } else if (Array.isArray(response)) {
        setDocuments(response);
      } else {
        setDocuments([]);
      }
    } catch (e: any) {
      setToast(e?.message || 'Neuspešno učitavanje dokumenata.');
    } finally {
      setLoadingDocs(false);
    }
  }

  const submitted = summary?.totalSubmitted ?? 0;
  const received = summary?.totalReceived ?? 0;
  const role = (me?.role || '').toLowerCase();
  const canCreate = ['sef_prodavnice', 'prodavnica', 'store'].includes(role);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #05070d 0%, #020304 100%)', color: '#fff' }}>
      <PwaHeader
        name={me?.name || me?.username || ''}
        onLogout={() => { localStorage.removeItem('token'); router.push('/'); }}
      />
      <div style={{ padding: '16px' }}>
        <div style={{ marginBottom: 16 }}>
          <PwaBackButton />
        </div>

        <div style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, marginBottom: 8, background: 'linear-gradient(135deg,#ffd400 0%,#ffaa00 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em' }}>SKART modul</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 24, lineHeight: 1.6 }}>
          Digitalno evidentiraj oštećenu ili isteklu robu – skeniraj dokument, dodaj fotografije i završi predaju.
        </div>

        {toast && (
          <div style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', padding: 12, borderRadius: 12, marginBottom: 16, color: '#f87171' }} onClick={() => setToast(null)}>
            {toast}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85), rgba(2, 6, 23, 0.85))', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,212,0,0.3)', borderRadius: 16, padding: 20, boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)' }}>
            <div style={{ fontSize: 12, letterSpacing: 1, color: 'rgba(255,255,255,0.6)' }}>SUBMITOVANO DANAS</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fde68a', marginTop: 6 }}>{submitted}</div>
          </div>
          <div style={{ background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85), rgba(2, 6, 23, 0.85))', backdropFilter: 'blur(10px)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 16, padding: 20, boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)' }}>
            <div style={{ fontSize: 12, letterSpacing: 1, color: 'rgba(255,255,255,0.6)' }}>PRIMLJENO DANAS</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#4ade80', marginTop: 6 }}>{received}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {canCreate && (
            <button
              onClick={() => router.push('/pwa/skart/create')}
              style={{
                width: '100%',
                background: 'rgba(34,197,94,0.15)',
                color: '#4ade80',
                border: '1px solid rgba(34,197,94,0.35)',
                padding: 18,
                borderRadius: 16,
                fontWeight: 700,
                fontSize: 18,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34,197,94,0.2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(34,197,94,0.15)'; }}
            >
              Novi SKART nalog
            </button>
          )}
          <button
            onClick={() => router.push('/pwa/skart/scan')}
            style={{
              width: '100%',
              background: 'rgba(250,204,21,0.1)',
              color: '#fde68a',
              border: '1px solid rgba(250,204,21,0.35)',
              padding: 18,
              borderRadius: 16,
              fontWeight: 700,
              fontSize: 18,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(250,204,21,0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(250,204,21,0.1)'; }}
          >
            Skeniraj QR kod
          </button>
          <button
            onClick={() => router.push('/pwa/skart/scan')}
            style={{
              width: '100%',
              background: 'rgba(15, 23, 42, 0.5)',
              color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(148,163,184,0.3)',
              padding: 18,
              borderRadius: 16,
              fontWeight: 600,
              fontSize: 18,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(15, 23, 42, 0.7)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(15, 23, 42, 0.5)'; }}
          >
            Unesi UID ručno
          </button>
        </div>

        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fde68a' }}>Moji SKART dokumenti</div>
            <button
              onClick={loadDocuments}
              style={{ background: 'rgba(15, 23, 42, 0.5)', color: '#fde68a', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 12, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Osveži
            </button>
          </div>
          {loadingDocs ? (
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, padding: 20, textAlign: 'center' }}>Učitavanje...</div>
          ) : documents.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, padding: 20, textAlign: 'center' }}>Još uvek nema SKART prijava za tvoju prodavnicu.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {documents.slice(0, 8).map((doc: any) => (
                <button
                  key={doc.uid}
                  onClick={() => router.push(`/pwa/skart/${encodeURIComponent(doc.uid)}`)}
                  style={{
                    background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85), rgba(2, 6, 23, 0.85))',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 16,
                    padding: 16,
                    textAlign: 'left',
                    color: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,212,0,0.3)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#fde68a' }}>{doc.uid}</div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: doc.status === 'RECEIVED' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                        border: doc.status === 'RECEIVED' ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(245,158,11,0.35)',
                        color: doc.status === 'RECEIVED' ? '#4ade80' : '#fbbf24',
                      }}
                    >
                      {doc.status === 'RECEIVED' ? 'PRIMLJENO' : 'SUBMITOVANO'}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                    Kreirano: {formatDate(doc.createdAt || doc.created_at)} · Stavki: {(doc.items || []).length}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(input: string | Date | undefined) {
  if (!input) return '-';
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('sr-Latn-RS', { hour12: false });
}



