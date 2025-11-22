import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import PwaHeader from '../../components/PwaHeader';
import PwaBackButton from '../../components/PwaBackButton';
import { createSkartDocument, searchItems } from '../lib/apiClient';

type DraftItem = {
  code: string;
  name: string;
  qty: number;
  reason: string;
  note: string;
  photos: string[]; // Base64 encoded photos for this item
};

const EMPTY_ITEM: DraftItem = {
  code: '',
  name: '',
  qty: 1,
  reason: '',
  note: '',
  photos: [],
};

const REASON_PRESETS = [
  'Oštećeno',
  'Oštećenje ambalaže',
  'Oštećenje pri transportu',
  'Povrat kupca',
  'Neispravno deklarisano',
];

const SkartCreateScreen = () => {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [items, setItems] = useState<DraftItem[]>([{ ...EMPTY_ITEM }]);
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successDoc, setSuccessDoc] = useState<any>(null);
  const [scannerIndex, setScannerIndex] = useState<number | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannerReady, setScannerReady] = useState(false);
  const [cameraIndex, setCameraIndex] = useState<number | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fetchTimeouts = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }
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

  const isStoreManager = useMemo(() => {
    const role = (me?.role || '').toLowerCase();
    return ['sef_prodavnice', 'prodavnica', 'store'].includes(role);
  }, [me]);

  const storeName = me?.store_name || me?.store?.name || '';

  const autoFillItemDetails = useCallback(
    async (index: number, code: string) => {
      const trimmed = (code || '').trim();
      if (!trimmed || trimmed.length < 2) return; // Minimum 2 karaktera za pretragu
      
      try {
        const results = await searchItems(trimmed);
        if (!Array.isArray(results) || !results.length) {
          // Ako nije pronađeno, ne menjaj ništa - korisnik može da unese custom šifru
          return;
        }
        
        const normalized = trimmed.toUpperCase();
        // Prvo traži tačno poklapanje po ident ili barkodu
        let selected = results.find((entry: any) => {
          const ident = (entry?.ident || '').toUpperCase();
          if (ident === normalized) return true;
          if (Array.isArray(entry?.barcodes)) {
            return entry.barcodes.some((b: string) => (b || '').toUpperCase() === normalized);
          }
          return false;
        });
        
        // Ako nema tačnog poklapanja, probaj da nađeš što je bliže
        // Pretraži rezultate koji počinju sa unesenom šifrom
        if (!selected) {
          selected = results.find((entry: any) => {
            const ident = (entry?.ident || '').toUpperCase();
            return ident.startsWith(normalized) || normalized.startsWith(ident);
          });
        }
        
        // Ako i dalje nema poklapanja, NE uzimaj prvi rezultat automatski
        // Korisnik može da unese custom šifru i naziv
        if (!selected) {
          console.log('Nema tačnog poklapanja za šifru:', trimmed, 'Rezultati:', results.length);
          return; // Ne menjaj ništa - korisnik može da unese naziv ručno
        }
        
        setItems((prev) => {
          if (!prev[index]) return prev;
          const next = [...prev];
          // Zadržava šifru koju je korisnik uneo, ali auto-popunjava naziv iz inventara
          next[index] = {
            ...next[index],
            // code ostaje ono što je korisnik uneo - ne menja se!
            name: selected.naziv || selected.name || next[index].name || '',
          };
          return next;
        });
      } catch (error) {
        console.warn('Neuspešno preuzimanje artikla za šifru', code, error);
        // Ne menjaj ništa ako pretraga ne uspe - korisnik može da unese manualno
      }
    },
    [],
  );

  const scheduleAutoFill = useCallback(
    (index: number, code: string) => {
      if (fetchTimeouts.current[index]) {
        clearTimeout(fetchTimeouts.current[index]);
      }
      const trimmed = (code || '').trim();
      if (!trimmed || trimmed.length < 2) return; // Minimum 2 karaktera
      // Pošalji zahtev nakon 300ms pauze (da korisnik završi unos)
      fetchTimeouts.current[index] = setTimeout(() => {
        autoFillItemDetails(index, trimmed);
      }, 300);
    },
    [autoFillItemDetails],
  );

  useEffect(() => {
    if (scannerIndex === null) {
      setScannerReady(false);
      return;
    }
    let active = true;
    let scanner: any;
    (async () => {
      try {
        const module = await import('html5-qrcode');
        if (!active) return;
        const { Html5QrcodeScanner } = module as any;
        scanner = new Html5QrcodeScanner('skart-item-scanner', { fps: 10, qrbox: 220 }, false);
        scanner.render(
          (decodedText: string) => {
            if (!decodedText) return;
            const normalized = decodedText.trim().toUpperCase();
            const targetIndex = scannerIndex;
            if (targetIndex === null) return;
            setItems((prev) => {
              const next = [...prev];
              if (next[targetIndex]) {
                // Postavi šifru koju je korisnik skenirao
                next[targetIndex] = { ...next[targetIndex], code: normalized };
              }
              return next;
            });
            setScannerError(null);
            setScannerIndex(null);
            // Automatski pokreni pretragu da se popuni naziv iz inventara
            setTimeout(() => {
              autoFillItemDetails(targetIndex, normalized);
            }, 100);
          },
          (_error: unknown) => {},
        );
        setScannerReady(true);
      } catch (err: any) {
        console.error('Scanner init failed', err);
        setScannerError('Skeniranje nije dostupno na ovom uređaju.');
      }
    })();
    return () => {
      active = false;
      try {
        scanner?.clear?.();
        scanner?.stop?.();
      } catch (e) {
        console.warn('Scanner cleanup failed', e);
      }
    };
  }, [scannerIndex, autoFillItemDetails]);

  useEffect(() => {
    return () => {
      Object.values(fetchTimeouts.current).forEach((timer) => clearTimeout(timer));
      fetchTimeouts.current = {};
      // Cleanup camera stream
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  function updateItem(index: number, key: keyof DraftItem, value: string) {
    setItems((prev) => {
      const next = [...prev];
      if (key === 'qty') {
        const numeric = Number(value);
        next[index] = { ...next[index], qty: Number.isNaN(numeric) ? 0 : Math.max(numeric, 0) };
      } else {
        next[index] = { ...next[index], [key]: value };
      }
      return next;
    });
    if (key === 'code') {
      scheduleAutoFill(index, value);
    }
  }

  function applyReason(index: number, reason: string) {
    updateItem(index, 'reason', reason);
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, idx) => idx !== index);
    });
  }

  async function handlePhotoSelection(itemIndex: number, event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const maxPhotos = 6;
    const currentPhotos = items[itemIndex]?.photos || [];
    if (currentPhotos.length + files.length > maxPhotos) {
      setToast(`Možete dodati najviše ${maxPhotos} fotografija po artiklu.`);
      return;
    }
    try {
      const encoded = await Promise.all(files.map((file) => fileToBase64(file)));
      setItems((prev) => {
        const next = [...prev];
        if (next[itemIndex]) {
          next[itemIndex] = {
            ...next[itemIndex],
            photos: [...(next[itemIndex].photos || []), ...encoded.filter(Boolean)],
          };
        }
        return next;
      });
      setToast(null);
    } catch (e) {
      console.error('Photo encode error', e);
      setToast('Nije moguće obraditi fotografiju.');
    } finally {
      event.target.value = '';
    }
  }

  function removePhoto(itemIndex: number, photoIndex: number) {
    if (!confirm('Da li ste sigurni da želite da obrišete ovu fotografiju?')) {
      return;
    }
    setItems((prev) => {
      const next = [...prev];
      if (next[itemIndex]) {
        next[itemIndex] = {
          ...next[itemIndex],
          photos: (next[itemIndex].photos || []).filter((_, idx) => idx !== photoIndex),
        };
      }
      return next;
    });
  }

  async function startCamera(itemIndex: number) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Back camera
        audio: false,
      });
      setCameraStream(stream);
      setCameraIndex(itemIndex);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (error) {
      console.error('Camera error:', error);
      setToast('Ne mogu pristupiti kameri. Proverite dozvole.');
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setCameraIndex(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current || cameraIndex === null) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Kompresuj sliku - maksimalna širina 1280px
    const maxWidth = 1280;
    let width = video.videoWidth;
    let height = video.videoHeight;
    
    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }
    
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(video, 0, 0, width, height);
    
    // Kompresija sa kvalitetom 0.7
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    
    setItems((prev) => {
      const next = [...prev];
      if (next[cameraIndex]) {
        const currentPhotos = next[cameraIndex].photos || [];
        if (currentPhotos.length >= 6) {
          setToast('Možete dodati najviše 6 fotografija po artiklu.');
          return prev;
        }
        next[cameraIndex] = {
          ...next[cameraIndex],
          photos: [...currentPhotos, dataUrl],
        };
      }
      return next;
    });
    
    stopCamera();
    setToast('Fotografija uspešno dodata.');
  }

  async function handleSubmit() {
    if (!me?.store_id) {
      setToast('Vašem nalogu nije dodeljena prodavnica. Obratite se administratoru.');
      return;
    }
    const cleanedItems = items
      .map((item) => ({
        code: item.code.trim(),
        name: item.name.trim(),
        qty: Number(item.qty) || 0,
        reason: item.reason.trim(),
        note: item.note.trim() || undefined,
        photos: item.photos || [],
      }))
      .filter((item) => item.code && item.name && item.qty > 0 && item.reason);
    if (!cleanedItems.length) {
      setToast('Dodajte bar jednu stavku sa šifrom, nazivom, količinom i razlogom.');
      return;
    }
    // Proveri da SVAKI artikal ima bar jednu sliku (obavezno)
    const itemsWithoutPhotos = cleanedItems.filter(item => !item.photos || item.photos.length === 0);
    if (itemsWithoutPhotos.length > 0) {
      const itemIndexes = itemsWithoutPhotos.map((_, idx) => {
        const originalIndex = items.findIndex(i => i.code === itemsWithoutPhotos[idx].code && i.name === itemsWithoutPhotos[idx].name);
        return originalIndex + 1;
      });
      setToast(`Dodajte fotografiju oštećenja za artikal(e) #${itemIndexes.join(', ')}. Fotografija je obavezna za svaki artikal.`);
      return;
    }
    setToast(null);
    setLoading(true);
    try {
      const response = await createSkartDocument({
        storeId: me.store_id,
        note: note.trim() || undefined,
        items: cleanedItems,
      });
      setSuccessDoc(response);
      setItems([{ ...EMPTY_ITEM }]);
      setNote('');
    } catch (e: any) {
      setToast(e?.message || 'Kreiranje nije uspelo.');
    } finally {
      setLoading(false);
    }
  }

  if (!me) {
    return (
      <div className="min-h-screen" style={{ background: '#000', color: '#fff' }}>
        <PwaHeader
          name=""
          onLogout={() => { localStorage.removeItem('token'); router.push('/'); }}
        />
        <div style={{ padding: 16 }}>
          <PwaBackButton />
          <div style={{ marginTop: 40, textAlign: 'center', color: '#FFC300' }}>Učitavanje podataka...</div>
        </div>
      </div>
    );
  }

  if (me && !isStoreManager) {
    return (
      <div className="min-h-screen" style={{ background: '#000', color: '#fff' }}>
        <PwaHeader
          name={me?.name || me?.username || ''}
          onLogout={() => { localStorage.removeItem('token'); router.push('/'); }}
        />
        <div style={{ padding: 16 }}>
          <PwaBackButton />
          <div style={{ marginTop: 40, textAlign: 'center', color: '#f87171', fontWeight: 700 }}>
            Nemate dozvolu za kreiranje SKART naloga.
          </div>
        </div>
      </div>
    );
  }

  if (successDoc) {
    return (
      <div className="min-h-screen" style={{ background: '#000', color: '#fff' }}>
        <PwaHeader
          name={me?.name || me?.username || ''}
          onLogout={() => { localStorage.removeItem('token'); router.push('/'); }}
        />
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PwaBackButton />
          <div style={{ background: '#14532d', border: '2px solid #22c55e', borderRadius: 18, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e', marginBottom: 12 }}>SKART nalog je kreiran!</div>
            <div style={{ fontSize: 16, marginBottom: 12 }}>UID: <strong>{successDoc.uid}</strong></div>
            <div style={{ fontSize: 14, color: '#ccc', marginBottom: 20 }}>Prodavnica: {successDoc.storeName || storeName || '-'}</div>
            <button
              onClick={() => router.push(`/pwa/skart/${encodeURIComponent(successDoc.uid)}`)}
              style={{ width: '100%', background: '#FFC300', color: '#000', border: 'none', padding: 16, borderRadius: 12, fontWeight: 800, marginBottom: 12 }}
            >
              Prikaži dokument
            </button>
            <button
              onClick={() => { setSuccessDoc(null); }}
              style={{ width: '100%', background: '#111', color: '#fff', border: '2px solid #333', padding: 16, borderRadius: 12, fontWeight: 700 }}
            >
              Novi skart nalog
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
      <div style={{ padding: 16, paddingBottom: 32 }}>
        <div style={{ marginBottom: 12 }}>
          <PwaBackButton />
        </div>

        <div style={{ fontSize: 24, fontWeight: 800, color: '#FFC300', marginBottom: 8 }}>Novi SKART nalog</div>
        <div style={{ color: '#bbb', fontSize: 14, marginBottom: 18 }}>
          Prodavnica: <strong>{storeName || '—'}</strong>
        </div>

        {toast && (
          <div
            style={{ background: '#d97706', padding: 12, borderRadius: 12, marginBottom: 16, cursor: 'pointer' }}
            onClick={() => setToast(null)}
          >
            {toast}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
          {items.map((item, index) => (
            <div key={`item-${index}`} style={{ background: '#111', borderRadius: 16, padding: 16, border: '1px solid #333' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#FFC300' }}>Stavka #{index + 1}</div>
                {items.length > 1 && (
                  <button
                    onClick={() => removeItem(index)}
                    style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: 14 }}
                  >
                    Ukloni
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={fieldLabelStyle}>Šifra artikla</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={item.code}
                      onChange={(e) => updateItem(index, 'code', e.target.value.toUpperCase())}
                      placeholder="Unesi ili skeniraj šifru"
                      style={textInputStyle}
                    />
                    <button
                      onClick={() => { setScannerError(null); setScannerIndex(index); }}
                      style={{ ...scanButtonStyle }}
                    >
                      Skeniraj
                    </button>
                  </div>
                </div>
                <div>
                  <label style={fieldLabelStyle}>Naziv artikla</label>
                  <input
                    value={item.name}
                    onChange={(e) => updateItem(index, 'name', e.target.value)}
                    placeholder="Pun naziv artikla"
                    style={textInputStyle}
                  />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Količina</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={item.qty}
                    onChange={(e) => updateItem(index, 'qty', e.target.value)}
                    style={textInputStyle}
                  />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Razlog</label>
                  <input
                    value={item.reason}
                    onChange={(e) => updateItem(index, 'reason', e.target.value)}
                    placeholder="Opis oštećenja / isteka roka"
                    style={textInputStyle}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {REASON_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => applyReason(index, preset)}
                        style={{
                          background: item.reason === preset ? '#FFC300' : '#1f2937',
                          color: item.reason === preset ? '#000' : '#fff',
                          border: 'none',
                          borderRadius: 999,
                          padding: '6px 12px',
                          fontSize: 12,
                        }}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={fieldLabelStyle}>Napomena (opciono)</label>
                  <textarea
                    value={item.note}
                    onChange={(e) => updateItem(index, 'note', e.target.value)}
                    placeholder="Dodatni opis ili zabeleška"
                    style={{ ...textInputStyle, minHeight: 80, resize: 'vertical' }}
                  />
                </div>
                <div>
                  <label style={fieldLabelStyle}>
                    Fotografije artikla <span style={{ color: '#f87171', fontSize: 14 }}>* Obavezno</span>
                  </label>
                  <div style={{ fontSize: 12, color: item.photos?.length ? '#10b981' : '#f87171', marginBottom: 8, fontWeight: item.photos?.length ? 'normal' : 'bold' }}>
                    {item.photos?.length 
                      ? `✓ Dodate fotografije oštećenja (${item.photos.length})`
                      : '⚠ Dodajte fotografiju oštećenja koja pokazuje stanje ovog artikla (obavezno).'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                    {(item.photos || []).map((photo, photoIndex) => (
                      <div key={`photo-${index}-${photoIndex}`} style={{ position: 'relative' }}>
                        <img
                          src={photo}
                          alt={`Dokaz ${photoIndex + 1}`}
                          style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 12, border: '2px solid #333' }}
                        />
                        <button
                          onClick={() => removePhoto(index, photoIndex)}
                          title="Obriši fotografiju"
                          style={{
                            position: 'absolute',
                            top: -8,
                            right: -8,
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            border: '2px solid #fff',
                            background: '#dc2626',
                            color: '#fff',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: 18,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                    <button
                      type="button"
                      onClick={() => startCamera(index)}
                      style={{
                        flex: 1,
                        width: '50%',
                        height: 48,
                        minHeight: 48,
                        maxHeight: 48,
                        background: '#FFC300',
                        color: '#000',
                        border: 'none',
                        borderRadius: 12,
                        padding: 0,
                        textAlign: 'center',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: 14,
                        lineHeight: '48px',
                        boxSizing: 'border-box',
                        display: 'block',
                      }}
                    >
                      Slikaj
                    </button>
                    <label
                      style={{
                        flex: 1,
                        width: '50%',
                        display: 'block',
                        cursor: 'pointer',
                        margin: 0,
                        padding: 0,
                        height: 48,
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: 48,
                          minHeight: 48,
                          maxHeight: 48,
                          background: '#333',
                          color: '#fff',
                          borderRadius: 12,
                          padding: 0,
                          textAlign: 'center',
                          fontWeight: 700,
                          fontSize: 14,
                          lineHeight: '48px',
                          boxSizing: 'border-box',
                          display: 'block',
                        }}
                      >
                        Izaberi iz galerije
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handlePhotoSelection(index, e)}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={addItem}
            style={{
              background: '#111',
              color: '#FFC300',
              border: '2px dashed #333',
              padding: 14,
              borderRadius: 12,
              fontWeight: 700,
            }}
          >
            + Dodaj stavku
          </button>
        </div>

        <div style={{ background: '#111', borderRadius: 16, padding: 16, border: '1px solid #333', marginBottom: 24 }}>
          <label style={fieldLabelStyle}>Napomena za dokument (opciono)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Dodatne informacije za magacin"
            style={{ ...textInputStyle, minHeight: 90, resize: 'vertical' }}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%',
            background: loading ? '#555' : '#FFC300',
            color: loading ? '#bbb' : '#000',
            border: 'none',
            padding: 18,
            borderRadius: 14,
            fontWeight: 800,
            fontSize: 18,
          }}
        >
          {loading ? 'Kreiranje...' : 'Kreiraj SKART nalog'}
        </button>
      </div>

      {cameraIndex !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.95)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
          }}
        >
          <div style={{ width: '100%', maxWidth: 600, background: '#000', borderRadius: 18, padding: 16, border: '1px solid #444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ color: '#FFC300', fontSize: 18, fontWeight: 700 }}>Kamera - Slikaj oštećenje</div>
              <button
                onClick={stopCamera}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Zatvori
              </button>
            </div>
            <div style={{ position: 'relative', width: '100%', background: '#111', borderRadius: 12, overflow: 'hidden', aspectRatio: '4/3' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button
                onClick={stopCamera}
                style={{
                  flex: 1,
                  background: '#333',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  padding: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Otkaži
              </button>
              <button
                onClick={capturePhoto}
                style={{
                  flex: 1,
                  background: '#FFC300',
                  color: '#000',
                  border: 'none',
                  borderRadius: 12,
                  padding: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: 16,
                }}
                >
                  Slikaj
                </button>
            </div>
          </div>
        </div>
      )}

      {scannerIndex !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
          }}
        >
          <div style={{ width: '100%', maxWidth: 420, background: '#000', borderRadius: 18, padding: 16, border: '1px solid #444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#FFC300' }}>Skeniraj šifru artikla</div>
              <button
                onClick={() => setScannerIndex(null)}
                style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: 16 }}
              >
                Zatvori
              </button>
            </div>
            {scannerError && (
              <div style={{ background: '#b91c1c', color: '#fff', padding: 12, borderRadius: 10, marginBottom: 12 }}>
                {scannerError}
              </div>
            )}
            <div id="skart-item-scanner" style={{ width: '100%', minHeight: 260, background: '#111', borderRadius: 12 }} />
            {!scannerReady && !scannerError && (
              <div style={{ textAlign: 'center', color: '#aaa', marginTop: 16 }}>Priprema skenera...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SkartCreateScreen;

async function compressImage(file: File, maxWidth: number = 1280, quality: number = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Skaliraj ako je slika veća od maxWidth
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Konvertuj u JPEG sa kvalitetom
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function fileToBase64(file: File): Promise<string> {
  // Kompresuj sliku pre konverzije
  return compressImage(file, 1280, 0.7);
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: '#9ca3af',
  marginBottom: 6,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
};

const textInputStyle: React.CSSProperties = {
  width: '100%',
  background: '#000',
  color: '#fff',
  border: '2px solid #333',
  borderRadius: 12,
  padding: 12,
  fontSize: 16,
};

const scanButtonStyle: React.CSSProperties = {
  background: '#1f2937',
  color: '#FFC300',
  border: '1px solid #333',
  borderRadius: 12,
  padding: '0 18px',
  fontWeight: 700,
};


