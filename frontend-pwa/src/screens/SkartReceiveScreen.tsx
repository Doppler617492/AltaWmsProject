import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import PwaHeader from '../../components/PwaHeader';
import PwaBackButton from '../../components/PwaBackButton';
import { getSkartDocumentByUid, receiveSkartDocument, uploadSkartDocumentPhoto } from '../lib/apiClient';

interface ReceiveItem {
  code: string;
  receivedQty: number;
}

function translateSkartStatus(status: string): string {
  const map: Record<string, string> = {
    'SUBMITTED': 'SUBMITOVANO',
    'RECEIVED': 'PRIMLJENO',
    'submitted': 'SUBMITOVANO',
    'received': 'PRIMLJENO',
  };
  return map[status] || status;
}

export default function SkartReceiveScreen({ uid }: { uid: string }) {
  const router = useRouter();
  const [doc, setDoc] = useState<any>(null);
  const [quantities, setQuantities] = useState<ReceiveItem[]>([]);
  const [note, setNote] = useState('');
  const [me, setMe] = useState<any>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const role = (me?.role || '').toLowerCase();
  const canReceive = ['admin', 'magacioner', 'sef', 'menadzer', 'warehouse'].includes(role);

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
    if (!uid) return;
    loadDocument();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  async function loadDocument() {
    try {
      setLoading(true);
      const response = await getSkartDocumentByUid(uid);
      setDoc(response);
      setNote(response.note || '');
      setQuantities(
        (response.items || []).map((item: any) => ({
          code: item.code,
          receivedQty: item.receivedQty !== null && item.receivedQty !== undefined
            ? Number(item.receivedQty)
            : (item.received_qty !== null && item.received_qty !== undefined
              ? Number(item.received_qty)
              : Number(item.qty) || 0),
        })),
      );
    } catch (e: any) {
      setToast(e?.message || 'Neuspešno učitavanje SKART dokumenta.');
    } finally {
      setLoading(false);
    }
  }

  const totals = useMemo(() => {
    if (!doc) return { declared: 0, received: 0 };
    const declared = (doc.items || []).reduce((acc: number, item: any) => acc + (Number(item.qty) || 0), 0);
    const received = quantities.reduce((acc, item) => acc + (Number(item.receivedQty) || 0), 0);
    return { declared, received };
  }, [doc, quantities]);

  function updateQuantity(index: number, value: string) {
    const numeric = Number(value);
    const next = [...quantities];
    next[index] = { ...next[index], receivedQty: Number.isNaN(numeric) ? 0 : numeric };
    setQuantities(next);
  }

  async function handleFinish() {
    if (!canReceive) {
      setToast('Nemate dozvolu za završetak prijema.');
      return;
    }
    setToast(null);
    if (doc?.status === 'RECEIVED') {
      setToast('Dokument je već primljen.');
      return;
    }
    try {
      setLoading(true);
      await receiveSkartDocument(uid, {
        note: note || undefined,
        items: quantities.map((item) => ({ code: item.code, receivedQty: Number(item.receivedQty) || 0 })),
      });
      setSuccess(true);
      await loadDocument();
    } catch (e: any) {
      setToast(e?.message || 'Zavrsetak nije uspeo.');
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    if (!canReceive) {
      setToast('Samo magacin može dodavati fotografije.');
      event.target.value = '';
      return;
    }
    if (!doc?.uid) return;
    const files = event.target.files;
    if (!files || !files.length) return;
    setUploading(true);
    setToast(null);
    try {
      await uploadSkartDocumentPhoto(doc.uid, files[0]);
      await loadDocument();
      setToast('Fotografija je sačuvana.');
    } catch (e: any) {
      setToast(e?.message || 'Otpremanje nije uspelo.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  if (!doc) {
    return (
      <div className="min-h-screen" style={{ background: '#000', color: '#fff' }}>
        <PwaHeader name={me?.name || me?.username || ''} onLogout={() => { localStorage.removeItem('token'); router.push('/'); }} />
        <div style={{ padding: 16 }}>
          <PwaBackButton />
          <div style={{ marginTop: 40, textAlign: 'center', color: '#FFC300' }}>Učitavanje podataka...</div>
        </div>
      </div>
    );
  }

  if (success && doc.status === 'RECEIVED') {
    return (
      <div className="min-h-screen" style={{ background: '#000', color: '#fff' }}>
        <PwaHeader name={me?.name || me?.username || ''} onLogout={() => { localStorage.removeItem('token'); router.push('/'); }} />
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <PwaBackButton />
          <div style={{ textAlign: 'center', background: '#14532d', borderRadius: 16, padding: 24, border: '2px solid #22c55e' }}>
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 12, color: '#22c55e' }}>Skart primljen uspešno!</div>
            <div style={{ fontSize: 16, marginBottom: 20 }}>UID: {doc.uid}</div>
            <button
              onClick={() => router.push('/pwa/skart')}
              style={{ width: '100%', background: '#FFC300', color: '#000', border: 'none', padding: 16, borderRadius: 12, fontWeight: 800 }}
            >
              Nazad na SKART meni
            </button>
          </div>
        </div>
      </div>
    );
  }

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

        <div style={{ border: '2px solid #FFC300', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#FFC300', marginBottom: 6 }}>{doc.uid}</div>
          <div style={{ color: '#ccc', marginBottom: 4 }}>Prodavnica: {doc.storeName || '-'}</div>
          <div style={{ color: '#ccc', marginBottom: 4 }}>Status: {translateSkartStatus(doc.status)}</div>
          <div style={{ color: '#ccc' }}>Ukupno: {totals.declared.toLocaleString('sr-Latn-RS')} / Primljeno: {totals.received.toLocaleString('sr-Latn-RS')}</div>
        </div>

        {toast && (
          <div style={{ background: '#d97706', padding: 12, borderRadius: 12, marginBottom: 12 }} onClick={() => setToast(null)}>
            {toast}
          </div>
        )}

        <div style={{ background: '#111', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#FFC300', marginBottom: 12 }}>Stavke</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(doc.items || []).map((item: any, index: number) => (
              <div key={item.code} style={{ border: '1px solid #333', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{item.name}</div>
                <div style={{ fontSize: 14, color: '#ccc' }}>Šifra: {item.code}</div>
                <div style={{ fontSize: 14, color: '#ccc' }}>Razlog: {item.reason}</div>
                <div style={{ marginTop: 8 }}>
                  <label style={{ fontSize: 12, color: '#ccc', display: 'block', marginBottom: 4 }}>Primljena količina</label>
                  <input
                    type="number"
                    min="0"
                    value={quantities[index]?.receivedQty ?? 0}
                    onChange={(e) => updateQuantity(index, e.target.value)}
                    disabled={!canReceive}
                    style={{
                      width: '100%',
                      background: '#000',
                      color: '#fff',
                      border: '2px solid #333',
                      borderRadius: 10,
                      padding: 12,
                      fontSize: 18,
                      opacity: canReceive ? 1 : 0.6,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: '#ccc', marginBottom: 6 }}>Napomena (opciono)</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!canReceive}
            style={{
              width: '100%',
              minHeight: 100,
              background: '#111',
              color: '#fff',
              border: '2px solid #333',
              borderRadius: 12,
              padding: 12,
              fontSize: 16,
              opacity: canReceive ? 1 : 0.6,
            }}
          />
        </label>

        <div style={{ background: '#111', borderRadius: 16, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#FFC300', marginBottom: 12 }}>Dokaži skart</div>
          {canReceive ? (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#FFC300',
                color: '#000',
                padding: 14,
                borderRadius: 12,
                fontWeight: 700,
                cursor: 'pointer',
                marginBottom: 16,
              }}
            >
              {uploading ? 'Otpremanje...' : '+ Dodaj fotografiju'}
              <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading} onChange={handleUploadPhoto} />
            </label>
          ) : (
            <div style={{ background: '#1f2937', color: '#94a3b8', padding: 12, borderRadius: 10, marginBottom: 16 }}>
              Fotografije može dodavati samo tim u magacinu.
            </div>
          )}
          {doc.photos && doc.photos.length > 0 ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {doc.photos.map((photo: any) => (
                <a key={photo.id} href={photo.path} target="_blank" rel="noreferrer" style={{ border: '1px solid #333', borderRadius: 12, overflow: 'hidden' }}>
                  <img src={photo.path} alt="SKART" style={{ width: '100%', height: 160, objectFit: 'cover' }} />
                  <div style={{ padding: 8, fontSize: 12, color: '#ccc' }}>{new Date(photo.uploadedAt).toLocaleString('sr-Latn-RS')}</div>
                </a>
              ))}
            </div>
          ) : (
            <div style={{ color: '#777' }}>Nema fotografija.</div>
          )}
        </div>

        {canReceive && (
          <button
            onClick={handleFinish}
            disabled={loading}
            style={{
              width: '100%',
              background: '#FFC300',
              color: '#000',
              border: 'none',
              padding: 18,
              borderRadius: 14,
              fontWeight: 800,
              fontSize: 18,
            }}
          >
            {loading ? 'Slanje...' : 'Završi prijem'}
          </button>
        )}
      </div>
    </div>
  );
}


