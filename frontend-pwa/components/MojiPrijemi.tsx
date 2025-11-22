import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { startHeartbeat } from '../lib/heartbeat';

export default function MojiPrijemi() {
  const [docs, setDocs] = useState<any[]>([]);
  const [sel, setSel] = useState<any | null>(null);
  const [selDoc, setSelDoc] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<any | null>(null);
  const [photos, setPhotos] = useState<any[]>([]);

  useEffect(() => {
    startHeartbeat();
    loadMe();
    loadList();
    const t = setInterval(loadList, 10000);
    return () => clearInterval(t);
  }, []);

  async function loadMe() {
    try { const data = await apiClient.get('/auth/me'); setMe(data); } catch {}
  }

  async function loadList() {
    setLoading(true);
    try {
      const data = await apiClient.get('/receiving/my-active');
      setDocs(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }

  async function openDetail(docId: number) {
    const d = await apiClient.get(`/receiving/documents/${docId}`);
    setSelDoc(d);
    // immediate heartbeat when opening a receiving
    try { await apiClient.patch('/pwa/heartbeat', { device_id: 'zebra-local' }); } catch {}
    try {
      const ph = await apiClient.get(`/receiving/documents/${docId}/photos`);
      setPhotos(Array.isArray(ph) ? ph : []);
    } catch { setPhotos([]); }
  }

  async function start(docId: number) {
    try { await apiClient.patch(`/receiving/documents/${docId}/start`, {}); await loadList(); } catch (e:any) { alert(e?.message || 'Ne može start'); }
  }

  async function saveItem(itemId: number, qty: number, reason: string, locationCode: string) {
    // Resolve location via backend endpoint
    let location_id: number | null = null;
    try {
      const loc = await apiClient.get(`/warehouse/location/${encodeURIComponent(locationCode)}`);
      location_id = loc?.location_id || loc?.id || null;
    } catch {}
    if (!location_id) { alert('Lokacija ne postoji'); return; }
    await apiClient.patch(`/receiving/items/${itemId}`, { received_quantity: qty, condition_notes: reason, location_id, status: qty>0?'scanned':undefined });
    alert('Sačuvano');
    if (selDoc) { await openDetail(selDoc.id); }
  }

  const [confirmData, setConfirmData] = useState<any[] | null>(null);
  const [errorMissing, setErrorMissing] = useState<any[] | null>(null);
  async function complete(docId: number) {
    if (!confirm('Da li ste sigurni da želite da završite prijem?')) return;
    try {
      await apiClient.patch(`/receiving/documents/${docId}/complete`);
      try {
        const impact = await apiClient.get(`/stock/inventory/by-document/${docId}`);
        setConfirmData(impact || []);
      } catch { setConfirmData([]); }
    } catch (e: any) {
      try {
        const data = JSON.parse(e.message);
        if (data && data.missingLocations) {
          setErrorMissing(data.missingLocations);
          return;
        }
      } catch {}
      alert(e?.message || 'Greška pri završetku');
    }
  }

  if (loading) return <div style={{ padding: 16 }}>Učitavanje...</div>;
  if (!selDoc && !confirmData && !errorMissing) return (
    <div style={{ padding: 16 }}>
      <Header me={me} />
      {docs.length === 0 ? <div style={{ padding: 16, textAlign: 'center' }}>Nema dodeljenih prijema.</div> : (
        <div style={{ display: 'grid', gap: 12 }}>
          {docs.map((d: any) => (
            <div key={d.id} style={{ background: '#fff', border: '2px solid #ffc107', borderRadius: 8, padding: 16 }}>
              <div style={{ fontWeight: 'bold', fontSize: 18 }}>{d.document_number}</div>
              <div style={{ color: '#555', marginBottom: 8 }}>{d.supplier_name}</div>
              <ProgressBar percent={d.progress || 0} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {d.status === 'draft' && (
                  <button onClick={() => start(d.id)} style={styles.primaryBtn}>Započni prijem</button>
                )}
                {(d.status === 'in_progress' || d.status === 'on_hold') && (
                  <button onClick={() => openDetail(d.id)} style={styles.secondaryBtn}>Nastavi prijem</button>
                )}
                {(d.status !== 'completed' && (d.progress || 0) === 100) && (
                  <button onClick={() => complete(d.id)} style={styles.primaryBtn}>Završi prijem</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (confirmData) return (
    <div style={{ padding: 16 }}>
      <div style={{ fontWeight: 'bold', fontSize: 22, marginBottom: 6, color: '#2e7d32' }}>PRIJEM ZAVRŠEN</div>
      <div style={{ marginBottom: 12 }}>Zalihe su ažurirane u magacinu.</div>
      <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8 }}>
        {(confirmData || []).map((r: any, i: number) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, borderBottom: '1px solid #eee' }}>
            <div style={{ fontWeight: 'bold' }}>{r.sku}</div>
            <div>{r.lokacija}</div>
            <div>{r.primljeno}</div>
          </div>
        ))}
      </div>
      <button onClick={()=>{ setConfirmData(null); loadList(); }} onMouseEnter={(e)=>e.currentTarget.style.backgroundColor='#e0ac00'} onMouseLeave={(e)=>e.currentTarget.style.backgroundColor='#ffc107'} style={{ width: '100%', marginTop: 12, background: '#ffc107', color: '#fff', border: 'none', padding: 14, borderRadius: 8, fontWeight: 'bold' }}>Nazad na moje prijeme</button>
    </div>
  );

  if (errorMissing) return (
    <div style={{ padding: 16 }}>
      <div style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8, color: '#dc3545' }}>Nedostaje lokacija</div>
      <div style={{ marginBottom: 12 }}>Unesite lokaciju za sve stavke pre završetka.</div>
      <div style={{ background: '#fff', border: '2px solid #dc3545', borderRadius: 8 }}>
        {errorMissing.map((r: any, i: number) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, borderBottom: '1px solid #eee' }}>
            <div style={{ fontWeight: 'bold' }}>{r.sku}</div>
            <div>{r.naziv}</div>
          </div>
        ))}
      </div>
      <button onClick={()=>{ setErrorMissing(null); }} onMouseEnter={(e)=>e.currentTarget.style.backgroundColor='#e0ac00'} onMouseLeave={(e)=>e.currentTarget.style.backgroundColor='#ffc107'} style={{ width: '100%', marginTop: 12, background: '#ffc107', color: '#fff', border: 'none', padding: 14, borderRadius: 8, fontWeight: 'bold' }}>Razumem</button>
    </div>
  );

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontWeight: 'bold' }}>{selDoc?.document_number}</div>
        <button onClick={() => setSelDoc(null)} style={{ background: '#666', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 8, fontWeight: 'bold' }}>Nazad</button>
      </div>
      {(selDoc?.items || []).map((it: any) => (
        <ItemCard key={it.id} item={it} onSave={saveItem} onUpload={async (file: File, note: string) => {
          if (!selDoc) return;
          const fd = new FormData();
          fd.append('file', file);
          fd.append('item_id', String(it.id));
          if (note) fd.append('caption', note);
          try {
            await apiClient.postForm(`/receiving/documents/${selDoc.id}/photos/upload`, fd);
            // refresh photo list
            const ph = await apiClient.get(`/receiving/documents/${selDoc.id}/photos`);
            setPhotos(Array.isArray(ph) ? ph : []);
            alert('Slika sačuvana.');
          } catch (e:any) {
            alert(e?.message || 'Greška pri uploadu slike. Pokušajte ponovo.');
          }
        }}
        itemPhotos={(photos || []).filter(p => p.receiving_item && p.receiving_item.id === it.id)}
        />
      ))}
      <button onClick={() => complete(selDoc!.id)} onMouseEnter={(e)=>e.currentTarget.style.backgroundColor='#e0ac00'} onMouseLeave={(e)=>e.currentTarget.style.backgroundColor='#ffc107'} style={{ width: '100%', background: '#ffc107', color: '#fff', border: 'none', padding: 14, borderRadius: 8, fontWeight: 'bold' }}>Završi prijem</button>
    </div>
  );
}

function ItemCard({ item, onSave, onUpload, itemPhotos }: { item: any; onSave: (id: number, qty: number, reason: string, locationCode: string) => void; onUpload: (file: File, note: string) => void; itemPhotos: any[]; }) {
  const [qty, setQty] = useState<number>(item.received_quantity || 0);
  const [reason, setReason] = useState<string>(item.condition_notes || '');
  const [loc, setLoc] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState<string>('');
  return (
    <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
      <div style={{ fontWeight: 'bold' }}>{item.item?.name} — {item.item?.sku}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input type="number" value={qty} onChange={(e)=>setQty(parseFloat(e.target.value)||0)} style={{ flex: 1, padding: 10, border: '1px solid #ddd', borderRadius: 6 }} placeholder="Količina" />
        <input type="text" value={loc} onChange={(e)=>setLoc(e.target.value)} style={{ flex: 1, padding: 10, border: '1px solid #ddd', borderRadius: 6 }} placeholder="Lokacija (kod)" />
      </div>
      <textarea value={reason} onChange={(e)=>setReason(e.target.value)} placeholder="Razlog razlike (opciono)" style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, marginTop: 8 }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={()=>onSave(item.id, qty, reason, loc)} onMouseEnter={(e)=>e.currentTarget.style.backgroundColor='#e0ac00'} onMouseLeave={(e)=>e.currentTarget.style.backgroundColor='#ffc107'} style={{ flex: 1, background: '#ffc107', color: '#fff', border: 'none', padding: 10, borderRadius: 8, fontWeight: 'bold' }}>Sačuvaj</button>
        <label style={{ flex: 1, background: '#ffc107', color: '#fff', border: 'none', padding: 10, borderRadius: 8, fontWeight: 'bold', textAlign: 'center', cursor: 'pointer' }}>
          + Dodaj sliku
          <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e)=>{ const f=e.target.files?.[0]||null; setFile(f); }} />
        </label>
      </div>
      {file && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ fontSize: 12 }}>Izabrana slika: {file.name}</div>
          <input type="text" value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Napomena (opciono)" style={{ flex: 1, padding: 8, border: '1px solid #ddd', borderRadius: 6 }} />
          <button onClick={()=>{ if(file){ onUpload(file, note); setFile(null); setNote(''); } }} style={{ background: '#222', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 8, fontWeight: 'bold' }}>Sačuvaj sliku</button>
        </div>
      )}
      {Array.isArray(itemPhotos) && itemPhotos.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Foto evidencija</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {itemPhotos.map((p:any, idx:number) => (
              <a key={idx} href={p.file_path} target="_blank" rel="noreferrer" style={{ width: 80, height: 80, border: '1px solid #ccc', borderRadius: 6, overflow: 'hidden', position: 'relative', display: 'inline-block' }}>
                <img src={p.file_path} alt={p.note || 'foto'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {p.note && (<span style={{ position: 'absolute', left: 2, top: 2, background: '#ffc107', color: '#000', fontSize: 10, padding: '1px 3px', borderRadius: 3 }}>{String(p.note).split(' ')[0]}</span>)}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Header({ me }: { me: any }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <div style={{ fontWeight: 'bold' }}>Alta WMS</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div>{me?.name || ''}</div>
        <button onClick={()=>{ localStorage.removeItem('token'); location.reload(); }} style={{ background: '#666', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 8, fontWeight: 'bold' }}>Odjava</button>
      </div>
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div style={{ width: '100%', height: 10, background: '#eee', borderRadius: 6 }}>
      <div style={{ width: `${Math.min(100, Math.max(0, percent))}%`, height: '100%', background: '#ffc107', borderRadius: 6 }} />
    </div>
  );
}

const styles = {
  primaryBtn: { flex: 1, background: '#ffc107', color: '#fff', border: 'none', padding: 12, borderRadius: 8, fontWeight: 'bold' },
  secondaryBtn: { flex: 1, background: '#222', color: '#fff', border: 'none', padding: 12, borderRadius: 8, fontWeight: 'bold' },
} as const;
