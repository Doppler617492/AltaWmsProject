import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PwaHeader from '../../components/PwaHeader';
import PwaBackButton from '../../components/PwaBackButton';

export default function SkartScanScreen() {
  const router = useRouter();
  const [manualUid, setManualUid] = useState('');
  const [me, setMe] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);

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
  }, [router]);

  useEffect(() => {
    let scanner: any;
    let active = true;
    async function initScanner() {
      try {
        const module = await import('html5-qrcode');
        if (!active) return;
        const { Html5QrcodeScanner } = module as any;
        scanner = new Html5QrcodeScanner('skart-scanner', { fps: 10, qrbox: 240 }, false);
        scanner.render(onScanSuccess, () => {});
      } catch (e: any) {
        console.error('Scanner error', e);
        setError('Skeniranje nije dostupno na ovom uređaju.');
      }
    }
    initScanner();
    return () => {
      active = false;
      try {
        scanner?.clear?.();
        scanner?.stop?.();
      } catch {}
    };
  }, []);

  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  const onScanSuccess = (decodedText: string) => {
    if (!decodedText) return;
    const trimmed = decodedText.trim();
    if (!trimmed.startsWith('SK-')) {
      setError('Nepoznat QR kod.');
      return;
    }
    router.push(`/pwa/skart/${encodeURIComponent(trimmed)}`);
  };

  const handleManualSubmit = () => {
    const trimmed = manualUid.trim().toUpperCase();
    if (!trimmed) {
      setError('Unesite ispravan UID.');
      return;
    }
    router.push(`/pwa/skart/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="min-h-screen" style={{ background: '#000', color: '#fff' }}>
      <PwaHeader
        name={me?.name || me?.username || ''}
        onLogout={() => { localStorage.removeItem('token'); router.push('/'); }}
      />
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <PwaBackButton />
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, color: '#FFC300' }}>Skeniraj SKART dokument</div>
        <div style={{ marginBottom: 20, fontSize: 14, opacity: 0.85 }}>
          Usmeri kameru u QR kod dokumenta ili unesi UID ručno.
        </div>

        {offline && (
          <div style={{ background: '#b91c1c', padding: 12, borderRadius: 10, marginBottom: 16 }}>
            <strong>Upozorenje:</strong> Nema internet konekcije. Skeniranje i prijem neće raditi dok se veza ne vrati.
          </div>
        )}

        {error && (
          <div
            style={{ background: '#d97706', padding: 12, borderRadius: 10, marginBottom: 16, cursor: 'pointer' }}
            onClick={() => setError(null)}
          >
            {error}
          </div>
        )}

        <div id="skart-scanner" style={{ width: '100%', background: '#111', borderRadius: 12, overflow: 'hidden' }} />

        <div style={{ marginTop: 24, background: '#111', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#FFC300', marginBottom: 8 }}>Ručno unesi UID</div>
          <input
            value={manualUid}
            onChange={(e) => setManualUid(e.target.value)}
            placeholder="npr. SK-ABCD1234"
            style={{
              width: '100%',
              background: '#000',
              color: '#fff',
              border: '2px solid #333',
              borderRadius: 10,
              padding: 14,
              fontSize: 18,
              marginBottom: 12,
              textTransform: 'uppercase',
            }}
          />
          <button
            onClick={handleManualSubmit}
            style={{
              width: '100%',
              background: '#FFC300',
              color: '#000',
              border: 'none',
              padding: 16,
              borderRadius: 12,
              fontWeight: 800,
              fontSize: 18,
            }}
          >
            Nastavi
          </button>
        </div>
      </div>
    </div>
  );
}


