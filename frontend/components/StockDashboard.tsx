import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { colors } from '../src/theme/colors';
import CycleCountDashboard from './CycleCountDashboard';
import { IconStock } from '../src/components/icons/IconStock';
import { IconSearch } from '../src/components/icons/IconSearch';

export default function StockDashboard() {
  const [activeTab, setActiveTab] = useState<'inventar' | 'item' | 'location' | 'moves' | 'popis'>('inventar');
  const [hotspots, setHotspots] = useState<any>({ overloaded: [], negative: [], recent_conflicts: [] });
  const [loadingHS, setLoadingHS] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingCatalog, setSyncingCatalog] = useState(false);

  const loadHotspots = async () => {
    try { setLoadingHS(true); const hs = await apiClient.get('/stock/hotspots'); setHotspots(hs); } catch { } finally { setLoadingHS(false); }
  };
  useEffect(() => { loadHotspots(); }, []);
  useEffect(() => {
    const onSet = (e: any) => { const tab = e?.detail?.tab as any; if (tab) setActiveTab(tab); };
    window.addEventListener('stock:setTab', onSet as any);
    return () => window.removeEventListener('stock:setTab', onSet as any);
  }, []);

  const negCount = hotspots?.negative?.length || 0;
  const overCount = hotspots?.overloaded?.length || 0;
  const confCount = hotspots?.recent_conflicts?.length || 0;
  // Emit risk for header badge
  useEffect(() => {
    const risk = (negCount + overCount + confCount) > 0;
    window.dispatchEvent(new CustomEvent('dashboard:risk', { detail: { risk } }));
  }, [negCount, overCount, confCount]);

  const runManualSync = async () => {
    try {
      setSyncing(true);
      const result = await apiClient.post('/integrations/cungu/sync', {
        stocks: { warehouse: 'Veleprodajni' },
      });
      alert(
        `Sinhronizacija završena.\nZalihe: ${result?.stockCount ?? 0}\nPrijema: ${
          result?.receivingCount ?? 0
        }\nOtprema: ${result?.shippingCount ?? 0}`,
      );
      await loadHotspots();
    } catch (err: any) {
      alert(err?.message || 'Greška pri sinhronizaciji.');
    } finally {
      setSyncing(false);
    }
  };

  const runCatalogSync = async () => {
    try {
      setSyncingCatalog(true);
      const result = await apiClient.post('/stock/sync-catalog', { full: true });
      if (result?.skipped) {
        alert('Katalog je nedavno sinhronizovan. Nema novih podataka.');
      } else {
        alert(
          `Sinhronizacija kataloga završena.\nObrađeno: ${result?.processed ?? 0}\nUčitano: ${result?.upserted ?? 0} artikala`,
        );
      }
    } catch (err: any) {
      alert(err?.message || 'Greška pri sinhronizaciji kataloga.');
    } finally {
      setSyncingCatalog(false);
    }
  };

  return (
    <div>
      {/* Hero Section */}
      <div style={{ marginBottom: "2.5rem" }}>
        <h1
          style={{
            fontSize: "clamp(2rem,4vw,3.5rem)",
            fontWeight: 800,
            margin: "0 0 0.75rem",
            background: "linear-gradient(135deg,#ffd400 0%,#ffaa00 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.02em",
          }}
        >
          Zalihe & Popis
        </h1>
        <p
          style={{
            fontSize: "1.125rem",
            color: "rgba(255,255,255,0.6)",
            margin: 0,
            lineHeight: 1.6,
            maxWidth: "600px",
          }}
        >
          Pregled zaliha, inventara i kretanja robe u skladištu.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
          {negCount > 0 && <StatusChip label="Negativne" value={String(negCount)} status="error" />}
          {overCount > 0 && <StatusChip label="Preopterećene" value={String(overCount)} status="warn" />}
          {confCount > 0 && <StatusChip label="Konflikti" value={String(confCount)} status="warn" />}
        </div>
      </div>

      <div style={{ background: 'rgba(15,23,42,0.75)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 16, padding: 20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconStock size={20} color={colors.brandYellow} />
            <h3 style={{ margin: 0, color: colors.brandYellow, fontSize: 18, fontWeight: 700 }}>ZALIHE</h3>
          </div>
        <div style={{ display:'flex', gap: 8, alignItems: 'center' }}>
          {negCount > 0 && <span style={pill(colors.statusErr + '40', colors.statusErr)}>Negativne: {negCount}</span>}
          {overCount > 0 && <span style={pill(colors.statusWarn + '40', colors.statusWarn)}>Preopterećene: {overCount}</span>}
          {confCount > 0 && <span style={pill(colors.statusWarn + '40', colors.statusWarn)}>Konflikti: {confCount}</span>}
          <button
            style={refreshBtn}
            onClick={runCatalogSync}
            disabled={syncingCatalog}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = colors.bgPanelAlt;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            {syncingCatalog ? 'Sinhronišem…' : 'Sinhroniši Katalog'}
          </button>
          <button
            style={refreshBtn}
            onClick={runManualSync}
            disabled={syncing}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = colors.bgPanelAlt;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            {syncing ? 'Sinhronišem…' : 'Sinhroniši (Cungu)'}
          </button>
          <button 
            style={refreshBtn} 
            onClick={loadHotspots}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = colors.bgPanelAlt;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            {loadingHS?'...':'Osveži'}
          </button>
        </div>
      </div>

        <div style={{ display:'flex', gap:8, borderBottom:'1px solid rgba(148,163,184,0.25)', marginBottom: 12, paddingBottom: 12 }}>
          <TabButton active={activeTab==='inventar'} onClick={()=>setActiveTab('inventar')}>Inventar (Pantheon)</TabButton>
          <TabButton active={activeTab==='item'} onClick={()=>setActiveTab('item')}>Po artiklu</TabButton>
          <TabButton active={activeTab==='location'} onClick={()=>setActiveTab('location')}>Po lokaciji</TabButton>
          <TabButton active={activeTab==='moves'} onClick={()=>setActiveTab('moves')}>Kretanje</TabButton>
          <TabButton active={activeTab==='popis'} onClick={()=>setActiveTab('popis')}>Popis</TabButton>
        </div>

        {activeTab==='inventar' && <PantheonInventory />}
        {activeTab==='item' && <ByItem />}
        {activeTab==='location' && <ByLocation />}
        {activeTab==='moves' && <Movements />}
        {activeTab==='popis' && <CycleCountDashboard />}
      </div>
    </div>
  );
}

// StatusChip component for hero section
function StatusChip({ label, value, status }: { label: string; value: string; status?: 'ok' | 'error' | 'warn' }) {
  const bg = status === 'ok' ? 'rgba(40,167,69,0.15)' : status === 'error' ? 'rgba(220,53,69,0.15)' : status === 'warn' ? 'rgba(250,204,21,0.15)' : 'rgba(148,163,184,0.15)';
  const border = status === 'ok' ? 'rgba(40,167,69,0.4)' : status === 'error' ? 'rgba(220,53,69,0.4)' : status === 'warn' ? 'rgba(250,204,21,0.4)' : 'rgba(148,163,184,0.4)';
  const text = status === 'ok' ? '#4ade80' : status === 'error' ? '#f87171' : status === 'warn' ? '#fde68a' : 'rgba(255,255,255,0.7)';
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 999, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: text }}>{value}</span>
    </div>
  );
}

function ByItem() {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<any|null>(null);
  const load = async () => {
    setLoading(true);
    try {
      if (query.trim()) {
        const d = await apiClient.get(`/stock/by-item?sku=${encodeURIComponent(query.trim())}`);
        setDetail(d);
        setData([]);
      } else {
        const d = await apiClient.get('/stock/by-item?limit=200');
        setData(Array.isArray(d)?d:[]);
        setDetail(null);
      }
    } catch { } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom: 8 }}>
        <input placeholder="Pretraži po SKU" value={query} onChange={e=>setQuery(e.target.value)} style={input} />
        <button style={btn} onClick={load}>Traži</button>
      </div>
      {loading ? <div>Učitavanje…</div> : detail ? (
        <div>
          <h4>{detail.sku} · {detail.naziv} (Ukupno: {detail.total_qty})</h4>
          <table style={table}><thead><tr><th style={th}>Lokacija</th><th style={th}>Zona</th><th style={th}>Količina</th></tr></thead>
            <tbody>
            {(detail.locations||[]).map((l:any,idx:number)=>(
              <tr 
                key={idx}
                onMouseEnter={(e) => (e.currentTarget.style.background = colors.bgPanelAlt)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={td}>
                  <button
                    type="button"
                    onClick={()=>{ /* placeholder action; reserved for future deep-link */ }}
                    style={{ background:'transparent', border:'none', color: colors.brandYellow, cursor:'pointer', textDecoration:'underline' }}
                  >
                    {l.location_code}
                  </button>
                </td>
                <td style={td}>{l.zone || '-'}</td>
                <td style={td}>{l.qty}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table style={table}>
            <thead><tr><th style={th}>SKU</th><th style={th}>Naziv</th><th style={th}>Ukupno</th><th style={th}>Lokacije</th></tr></thead>
            <tbody>
              {data.map((r:any,idx:number)=>{
                const total = r.total_qty;
                return (
                  <tr 
                    key={idx}
                    onMouseEnter={(e) => (e.currentTarget.style.background = colors.bgPanelAlt)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={td}>
                      <button
                        type="button"
                        onClick={()=>{ setQuery(r.sku); setTimeout(load,0); }}
                        style={{ background:'transparent', border:'none', color: colors.brandYellow, cursor:'pointer', textDecoration:'underline' }}
                      >
                        {r.sku}
                      </button>
                    </td>
                    <td style={td}>{r.naziv}</td>
                    <td style={td}>{total}</td>
                    <td style={td}>{(r.locations||[]).slice(0,3).map((l:any)=>l.location_code).join(', ')}{(r.locations||[]).length>3?'…':''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ByLocation() {
  const [loc, setLoc] = useState('');
  const [res, setRes] = useState<any|null>(null);
  const [loading, setLoading] = useState(false);
  const [movesOpen, setMovesOpen] = useState(false);
  const load = async () => { setLoading(true); try{ if(loc.trim()){ const d = await apiClient.get(`/stock/by-location?location_code=${encodeURIComponent(loc.trim())}`); setRes(d); } } catch{} finally{ setLoading(false);} };
  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom: 8 }}>
        <input placeholder="Unesite lokaciju npr 1A001001" value={loc} onChange={e=>setLoc(e.target.value)} style={input} />
        <button style={btn} onClick={load}>Traži</button>
      </div>
      {loading ? <div style={{ padding: 20, textAlign: 'center', color: colors.textSecondary }}>Učitavanje…</div> : res && (
        <div style={{ border:`1px solid ${colors.borderDefault}`, borderRadius:8, padding:16, marginBottom: 8, backgroundColor: colors.bgPanelAlt }}>
          <div style={{ fontWeight:600, marginBottom: 8, color: colors.brandYellow, fontSize: 16 }}>Lokacija: {res.location_code}</div>
          <div style={{ color:colors.textSecondary, marginBottom: 8, fontSize: 13 }}>Zona: {res.zone||'-'} · Aisle: {res.aisle||'-'} · Regal: {res.rack||'-'} · Polica: {res.shelf||'-'}</div>
          <div style={{ marginBottom: 12, fontSize: 13, color: colors.textPrimary }}>Capacity: {res.capacity||'-'} · Korišćeno: {res.used_capacity} {res.fill_percent!=null?`(${res.fill_percent}%)`:''}</div>
          <Progress value={res.fill_percent||0} />
          <div style={{ marginTop: 12 }}>
            <a href={`/warehouse-map?focusLocation=${encodeURIComponent(res.location_code)}`} style={{ color: colors.brandYellow, textDecoration: 'none', fontSize: 13 }}>Prikaži na mapi →</a>
          </div>
          <div style={{ marginTop: 12, overflowX:'auto' }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>SKU</th>
                  <th style={th}>Naziv</th>
                  <th style={th}>Količina</th>
                </tr>
              </thead>
              <tbody>
                {(res.items||[]).map((it:any, idx:number)=>(
                  <tr 
                    key={idx}
                    onMouseEnter={(e) => (e.currentTarget.style.background = colors.bgPanel)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={td}>{it.sku}</td>
                    <td style={td}>{it.naziv}</td>
                    <td style={td}>{it.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12 }}>
            <button style={btn} onClick={()=>setMovesOpen(true)}>Istorija kretanja</button>
          </div>
          {movesOpen && <MovementsModal onClose={()=>setMovesOpen(false)} locationCode={res.location_code} />}
        </div>
      )}
    </div>
  );
}

function Movements() {
  const [since, setSince] = useState('7d');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const load = async () => { setLoading(true); try { const params = new URLSearchParams({ since }); if(q.trim()){ if(/^[A-Za-z]/.test(q)) params.set('item_sku', q.trim()); else params.set('location_code', q.trim()); } const d = await apiClient.get(`/stock/movements?${params.toString()}`); setRows(Array.isArray(d)?d:[]);} catch{} finally{ setLoading(false);} };
  useEffect(() => { load(); }, []);
  const exportCsv = async () => {
    try {
      setDownloading(true);
      const params = new URLSearchParams({ since });
      if(q.trim()){ if(/^[A-Za-z]/.test(q)) params.set('item_sku', q.trim()); else params.set('location_code', q.trim()); }
      const token = localStorage.getItem('token') || '';
      const base = (process.env.NEXT_PUBLIC_API_URL as string) || `${window.location.protocol}//${window.location.hostname}:8000`;
      const resp = await fetch(`${base}/stock/movements/export?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` }});
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'movements.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch {} finally { setDownloading(false); }
  };
  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom: 8 }}>
        <select value={since} onChange={e=>setSince(e.target.value)} style={input}><option value="24h">24h</option><option value="7d">7d</option><option value="30d">30d</option></select>
        <input placeholder="Filtriraj po SKU ili lokaciji" value={q} onChange={e=>setQ(e.target.value)} style={input} />
        <button style={btn} onClick={load}>Osvježi</button>
        <button style={btn} onClick={exportCsv} disabled={downloading}>{downloading?'Preuzimam…':'Export CSV'}</button>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Datum</th>
              <th style={th}>Radnik</th>
              <th style={th}>Artikal</th>
              <th style={th}>Razlog</th>
              <th style={th}>Lokacija</th>
              <th style={th}>Količina</th>
              <th style={th}>Dokument</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r:any, idx:number)=>(
              <tr 
                key={idx}
                style={{ background: idx % 2 === 0 ? 'rgba(255,193,7,0.04)' : 'transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = colors.bgPanelAlt)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={td}>{new Date(r.timestamp).toLocaleString()}</td>
                <td style={td}>{r.user_full_name||'-'}</td>
                <td style={td}>{r.item_sku} · {r.item_name}</td>
                <td style={td}>{r.reason}</td>
                <td style={td}>{r.to_location_code || r.from_location_code || '-'}</td>
                <td style={td}>{r.quantity_change}</td>
                <td style={td}>{r.reference_document_number || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MovementsModal({ onClose, locationCode }: { onClose: ()=>void; locationCode: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { (async()=>{ try{ const d = await apiClient.get(`/stock/movements?since=30d&location_code=${encodeURIComponent(locationCode)}`); setRows(Array.isArray(d)?d:[]);} catch{} })(); }, [locationCode]);
  return (
    <Modal title={`Kretanje · ${locationCode}`} onClose={onClose}>
      <div style={{ overflowX:'auto' }}>
        <table style={table}><thead><tr><th style={th}>Datum</th><th style={th}>Radnik</th><th style={th}>Artikal</th><th style={th}>Razlog</th><th style={th}>Iz</th><th style={th}>U</th><th style={th}>Količina</th><th style={th}>Dokument</th></tr></thead>
          <tbody>
            {rows.map((r:any, idx:number)=>(
              <tr 
                key={idx}
                style={{ background: idx % 2 === 0 ? 'rgba(255,193,7,0.04)' : 'transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = colors.bgPanelAlt)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={td}>{new Date(r.timestamp).toLocaleString()}</td>
                <td style={td}>{r.user_full_name||'-'}</td>
                <td style={td}>{r.item_sku}</td>
                <td style={td}>{r.reason}</td>
                <td style={td}>{r.from_location_code||'-'}</td>
                <td style={td}>{r.to_location_code||'-'}</td>
                <td style={td}>{r.quantity_change}</td>
                <td style={td}>{r.reference_document_number||'-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function PantheonInventory() {
  const [query, setQuery] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [total, setTotal] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [refreshTick, setRefreshTick] = useState(0);
  const [stores, setStores] = useState<any[]>([]);
  const [activeStoreTab, setActiveStoreTab] = useState<number | null>(null);
  const [loadingStores, setLoadingStores] = useState(false);
  const [syncingStores, setSyncingStores] = useState(false);
  const [syncingInventory, setSyncingInventory] = useState(false);
  const [syncId, setSyncId] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<any>(null);
  const [storeItemCounts, setStoreItemCounts] = useState<Record<number, number>>({});
  const pageSize = 50;

  // Load stores on mount
  useEffect(() => {
    const fetchStores = async () => {
      try {
        setLoadingStores(true);
        const storeList = await apiClient.get('/stock/stores');
        setStores(storeList || []);
        
        // Fetch article counts for each store
        const counts: Record<number, number> = {};
        for (const store of (storeList || [])) {
          try {
            const inventory = await apiClient.get(`/stock/by-store/${store.id}`);
            counts[store.id] = inventory?.items?.length || 0;
          } catch (err) {
            counts[store.id] = 0;
          }
        }
        setStoreItemCounts(counts);
      } catch (error) {
        console.error('Error fetching stores:', error);
      } finally {
        setLoadingStores(false);
      }
    };
    fetchStores();
  }, []);

  const syncStoresFromCungu = async () => {
    try {
      setSyncingStores(true);
      const result = await apiClient.post('/stores/sync-from-stock-api', {});
      alert(`Sinhronizacija prodavnica iz Stock API završena.\nKreirano: ${result.created}\nAžurirano: ${result.updated}\nUkupno: ${result.total}\n\nProdavnice sada koriste originalna Pantheon imena.`);
      // Reload stores and counts
      const storeList = await apiClient.get('/stock/stores');
      setStores(storeList || []);
      
      // Refresh article counts
      const counts: Record<number, number> = {};
      for (const store of (storeList || [])) {
        try {
          const inventory = await apiClient.get(`/stock/by-store/${store.id}`);
          counts[store.id] = inventory?.items?.length || 0;
        } catch (err) {
          counts[store.id] = 0;
        }
      }
      setStoreItemCounts(counts);
    } catch (err: any) {
      alert(err?.message || 'Greška pri sinhronizaciji prodavnica.');
    } finally {
      setSyncingStores(false);
    }
  };

  const syncAllStoreInventory = async () => {
    try {
      setSyncingInventory(true);
      const newSyncId = `sync_${Date.now()}`;
      setSyncId(newSyncId);
      setSyncProgress(null);
      
      // Start sync
      const startResult = await apiClient.post('/stock/sync-all-store-inventory', { syncId: newSyncId });
      
      // Poll for progress
      const pollInterval = setInterval(async () => {
        try {
          const progress = await apiClient.get(`/stock/sync-progress/${newSyncId}`);
          setSyncProgress(progress);
          
          if (progress.status === 'completed') {
            clearInterval(pollInterval);
            setSyncingInventory(false);
            setSyncId(null);
            alert(`Sinhronizacija zaliha završena.\n` +
              `Prodavnica: ${progress.result.total_stores}\n` +
              `Kreirano: ${progress.result.total_created}\n` +
              `Ažurirano: ${progress.result.total_updated}\n` +
              (progress.result.errors ? `\nGreške: ${progress.result.errors.join('; ')}` : '')
            );
            setSyncProgress(null);
            
            // Refresh article counts after sync
            const storeList = await apiClient.get('/stock/stores');
            const counts: Record<number, number> = {};
            for (const store of (storeList || [])) {
              try {
                const inventory = await apiClient.get(`/stock/by-store/${store.id}`);
                counts[store.id] = inventory?.items?.length || 0;
              } catch (err) {
                counts[store.id] = 0;
              }
            }
            setStoreItemCounts(counts);
          } else if (progress.status === 'cancelled') {
            clearInterval(pollInterval);
            setSyncingInventory(false);
            setSyncId(null);
            alert('Sinhronizacija otkazana.');
            setSyncProgress(null);
          } else if (progress.status === 'error') {
            clearInterval(pollInterval);
            setSyncingInventory(false);
            setSyncId(null);
            alert(`Greška: ${progress.error || 'Nepoznata greška'}`);
            setSyncProgress(null);
          }
        } catch (err) {
          console.error('Error polling progress:', err);
        }
      }, 1000); // Poll every second
      
    } catch (err: any) {
      alert(err?.message || 'Greška pri sinhronizaciji zaliha.');
      setSyncingInventory(false);
      setSyncId(null);
      setSyncProgress(null);
    }
  };

  const cancelSync = async () => {
    if (!syncId) return;
    try {
      await apiClient.post(`/stock/sync-cancel/${syncId}`, {});
    } catch (err: any) {
      console.error('Error cancelling sync:', err);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      setCommittedQuery(query.trim());
    }, 400);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('limit', String(pageSize));
        params.set('offset', String((page - 1) * pageSize));
        if (committedQuery && committedQuery.trim()) {
          params.set('search', committedQuery.trim());
        }
        const url = `/stock/pantheon/items?${params.toString()}`;
        console.log('[PantheonInventory] Fetching:', url, 'committedQuery:', committedQuery);
        const res = await apiClient.get(url);
        if (cancelled) return;
        console.log('[PantheonInventory] Response:', {
          itemsCount: Array.isArray(res?.items) ? res.items.length : 0,
          total: res?.total,
          firstItem: res?.items?.[0],
        });
        const list = Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res)
          ? res
          : [];
        setItems(list);
        setTotal(res?.total ?? list.length ?? 0);
        setLastSync(res?.lastSyncedAt || res?.lastSync || null);
      } catch (error) {
        console.error('[PantheonInventory] Error:', error);
        if (!cancelled) {
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, committedQuery, refreshTick]);

  const triggerSync = async (full?: boolean) => {
    try {
      setSyncing(true);
      const res = await apiClient.post('/stock/pantheon/sync', full ? { full: true } : {});
      if (res?.lastSyncedAt) {
        setLastSync(res.lastSyncedAt);
      }
      if (res?.skipped) {
        alert('Sinhronizacija je već nedavno izvršena. Sačekajte pre nove sinhronizacije.');
      } else {
        setRefreshTick((tick) => tick + 1);
        alert(`Sinhronizacija završena. Obradjeno ${res?.processed ?? 0} artikala.`);
      }
    } catch (err: any) {
      alert(err?.message || 'Greška pri sinhronizaciji.');
    } finally {
      setSyncing(false);
    }
  };

  const formattedLastSync = useMemo(() => {
    if (!lastSync) return '—';
    try {
      return new Date(lastSync).toLocaleString('sr-Latn-RS');
    } catch {
      return lastSync;
    }
  }, [lastSync]);

  // Render store inventory if a store tab is selected
  if (activeStoreTab !== null) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, borderBottom: `1px solid ${colors.borderDefault}`, paddingBottom: 8 }}>
          <button
            style={{
              ...btn,
              background: activeStoreTab === null ? colors.brandYellow : 'transparent',
              color: activeStoreTab === null ? '#000' : colors.textSecondary,
            }}
            onClick={() => setActiveStoreTab(null)}
          >
            Veleprodajni Magacin
          </button>
          {stores.map((store) => (
            <button
              key={store.id}
              style={{
                ...btn,
                background: activeStoreTab === store.id ? colors.brandYellow : 'transparent',
                color: activeStoreTab === store.id ? '#000' : colors.textSecondary,
              }}
              onClick={() => setActiveStoreTab(store.id)}
            >
              {store.name}
            </button>
          ))}
        </div>
        <StoreInventoryView storeId={activeStoreTab} onBack={() => setActiveStoreTab(null)} />
      </div>
    );
  }

  return (
    <div>
      {/* Store tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, borderBottom: `1px solid ${colors.borderDefault}`, paddingBottom: 8, flexWrap: 'wrap' }}>
        <button
          style={{
            ...btn,
            background: activeStoreTab === null ? colors.brandYellow : 'transparent',
            color: activeStoreTab === null ? '#000' : colors.textSecondary,
          }}
          onClick={() => setActiveStoreTab(null)}
        >
          Veleprodajni Magacin
        </button>
        {loadingStores ? (
          <span style={{ padding: '8px 16px', fontSize: 13, color: colors.textSecondary }}>Učitavam prodavnice...</span>
        ) : (
          stores.map((store) => (
            <button
              key={store.id}
              style={{
                ...btn,
                background: activeStoreTab === store.id ? colors.brandYellow : 'transparent',
                color: activeStoreTab === store.id ? '#000' : colors.textSecondary,
              }}
              onClick={() => setActiveStoreTab(store.id)}
            >
              {store.name} {storeItemCounts[store.id] ? `(${storeItemCounts[store.id]})` : ''}
            </button>
          ))
        )}
        <button 
          style={{
            ...btn,
            background: syncingStores ? colors.bgPanelAlt : colors.brandYellow,
            color: '#000',
            fontWeight: 600,
          }} 
          onClick={syncStoresFromCungu} 
          disabled={syncingStores}
        >
          {syncingStores ? 'Sinhronišem...' : 'Sinhroniši Prodavnice'}
        </button>
        <button 
          style={{
            ...btn,
            background: syncingInventory ? colors.bgPanelAlt : colors.brandYellow,
            color: '#000',
            fontWeight: 600,
          }} 
          onClick={syncAllStoreInventory} 
          disabled={syncingInventory}
        >
          {syncingInventory ? (syncProgress ? `Sinhronišem (${syncProgress.current}/${syncProgress.total})...` : 'Sinhronišem...') : 'Sinhroniši Zalihe'}
        </button>
        {syncingInventory && (
          <button 
            style={{
              ...btn,
              background: colors.statusErr,
              color: '#fff',
              fontWeight: 600,
            }} 
            onClick={cancelSync}
          >
            Otkaži
          </button>
        )}
      </div>

      {/* Progress indicator */}
      {syncingInventory && syncProgress && (
        <div style={{
          background: colors.bgPanelAlt,
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: colors.textPrimary, fontWeight: 600 }}>
              {syncProgress.message}
            </span>
            <span style={{ fontSize: 13, color: colors.brandYellow }}>
              {syncProgress.current}/{syncProgress.total}
            </span>
          </div>
          <div style={{ height: 8, background: colors.borderCard, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ 
              width: `${(syncProgress.current / syncProgress.total) * 100}%`, 
              height: '100%', 
              background: colors.brandYellow,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      <div style={{ 
        background: 'rgba(100,150,200,0.1)', 
        border: `1px solid rgba(100,150,200,0.3)`, 
        borderRadius: 8, 
        padding: 12, 
        marginBottom: 12,
        fontSize: 12,
        color: colors.textSecondary
      }}>
        <strong>ℹ️ Veleprodajni Magacin (Pantheon katalog):</strong> Sadrži sve dostupne artikle sa imenima i specifikacijama. Sinhronizuje se automatski iz Cungu `getIdent` API kada kliknete "Sinhroniši Katalog" gore. Kada je katalizirana sinhronizovan, kliknite "Sinhroniši Zalihe" da popunite zalihe za sve prodavnice sa imenima iz ovog kataloga.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input
          placeholder="Pretraži Pantheon SKU / naziv / barkod"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={input}
        />
        <button style={btn} onClick={() => setRefreshTick((tick) => tick + 1)}>
          Osvježi
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: colors.textSecondary }}>
          Poslednja sinhronizacija: {formattedLastSync} · Ukupno artikala: {total.toLocaleString('sr-Latn-RS')}
        </span>
      </div>
      {loading ? (
        <div style={{ padding: 20 }}>Učitavanje Pantheon artikala…</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Šifra</th>
                <th style={th}>Naziv</th>
                <th style={th}>Dobavljač</th>
                <th style={th}>Klasifikacija</th>
                <th style={th}>JM</th>
                <th style={th}>Barkodovi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, idx: number) => (
                <tr
                  key={item.ident || idx}
                  style={{
                    background: idx % 2 === 0 ? 'rgba(255,193,7,0.04)' : 'transparent',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = colors.bgPanelAlt)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? 'rgba(255,193,7,0.04)' : 'transparent')}
                >
                  <td style={td}>{item.ident}</td>
                  <td style={td}>{item.naziv}</td>
                  <td style={td}>{item.supplier_name || item.supplier_code || '-'}</td>
                  <td style={td}>{item.primary_classification || '-'}</td>
                  <td style={td}>{item.unit || '-'}</td>
                  <td style={td}>{Array.isArray(item.barcodes) && item.barcodes.length ? item.barcodes.join(', ') : '-'}</td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={6} style={{ ...td, textAlign: 'center', color: colors.textSecondary }}>
                    Nema podataka. Pokušajte da pokrenete sinhronizaciju.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <div style={{ color: colors.textSecondary, fontSize: 12 }}>
              Prikazano {items.length ? (page - 1) * pageSize + 1 : 0}–{(page - 1) * pageSize + items.length} od {total}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={{ ...btn, opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Prethodna
              </button>
              <div style={{ alignSelf: 'center', fontSize: 12, color: colors.textSecondary }}>
                Stranica {page} / {Math.max(1, Math.ceil(total / pageSize))}
              </div>
              <button
                style={{ ...btn, opacity: page * pageSize >= total ? 0.4 : 1, cursor: page * pageSize >= total ? 'not-allowed' : 'pointer' }}
                disabled={page * pageSize >= total}
                onClick={() => setPage((p) => (p * pageSize >= total ? p : p + 1))}
              >
                Sledeća →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: any) {
  return (
    <button 
      onClick={onClick} 
      style={{
        padding:'8px 16px',
        borderBottom: active?`2px solid ${colors.brandYellow}`:'2px solid transparent',
        fontWeight: active?700:500,
        color: active ? colors.brandYellow : colors.textSecondary,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: 13,
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = colors.textPrimary;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = colors.textSecondary;
        }
      }}
    >
      {children}
    </button>
  );
}

function Modal({ title, children, onClose }: any) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:colors.bgPanel, border:`1px solid ${colors.borderStrong}`, borderRadius:12, width:'95%', maxWidth:1000, maxHeight:'90vh', overflow:'auto' }}>
        <div style={{ padding:16, background:colors.brandYellow, color:'#000', borderTopLeftRadius:12, borderTopRightRadius:12, fontWeight:700, fontSize:16 }}>{title}</div>
        <div style={{ padding:16 }}>{children}</div>
        <div style={{ padding:12, borderTop:`1px solid ${colors.borderDefault}`, textAlign:'right' }}>
          <button 
            style={modalCloseBtn} 
            onClick={onClose}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = colors.bgPanelAlt;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            Zatvori
          </button>
        </div>
      </div>
    </div>
  );
}

function Progress({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value||0));
  const color = v < 80 ? colors.statusWarn : colors.statusOk;
  return (
    <div style={{ height: 10, background:colors.borderCard, borderRadius: 999, overflow:'hidden' }}>
      <div style={{ width: `${v}%`, height:'100%', background: color }} />
    </div>
  );
}

const btn = { background:colors.bgPanelAlt, border:`1px solid ${colors.borderDefault}`, padding:'8px 16px', borderRadius:6, cursor:'pointer', color: colors.textPrimary, fontSize:13, fontWeight:600, transition:'all 0.2s' } as const;
const refreshBtn = { background:'transparent', border:`1px solid ${colors.borderDefault}`, padding:'8px 16px', borderRadius:6, cursor:'pointer', color: colors.brandYellow, fontSize:13, fontWeight:600, transition:'all 0.2s' } as const;
const modalCloseBtn = { background:'transparent', border:`1px solid ${colors.borderDefault}`, padding:'8px 16px', borderRadius:6, cursor:'pointer', color: colors.textSecondary, fontSize:14, fontWeight:600, transition:'all 0.2s' } as const;
const input = { padding:'8px 12px', border:`1px solid ${colors.borderDefault}`, borderRadius:6, backgroundColor: colors.bgPanelAlt, color: colors.textPrimary, fontSize:13 } as const;
const table = { width:'100%', borderCollapse:'collapse', color: colors.textPrimary } as const;
const th = { textAlign: 'left' as const, padding: '12px 16px', borderBottom: `1px solid ${colors.borderDefault}`, backgroundColor: colors.bgPanelAlt, color: colors.brandYellow, fontSize: 12, fontWeight: 600, textTransform: 'uppercase' as const } as const;
const td = { padding: '12px 16px', borderBottom: `1px solid ${colors.borderCard}`, fontSize: 13, color: colors.textSecondary } as const;
const pill = (bg:string, color:string) => ({ background:bg, color, borderRadius:999, padding:'6px 12px', fontSize:12, fontWeight:600 } as const);

// Store inventory view component
function StoreInventoryView({ storeId, onBack }: { storeId: number; onBack: () => void }) {
  const [inventory, setInventory] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStoreInventory = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get(`/stock/by-store/${storeId}`);
      setInventory(data);
    } catch (error) {
      console.error('Error fetching store inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStoreInventory();
  }, [storeId]);

  if (loading) {
    return <div style={{ padding: 20 }}>Učitavanje zaliha za prodavnicu...</div>;
  }

  if (!inventory) {
    return <div style={{ padding: 20, color: colors.statusErr }}>Greška pri učitavanju zaliha.</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: colors.brandYellow, fontSize: 18, fontWeight: 700 }}>
          {inventory.store_name} {inventory.store_code ? `(${inventory.store_code})` : ''}
        </h3>
        <div style={{ marginTop: 8, fontSize: 13, color: colors.textSecondary }}>
          Ukupno artikala: {inventory.total_items || 0}
          {inventory.last_synced && ` · Poslednja sinhronizacija: ${new Date(inventory.last_synced).toLocaleString('sr-Latn-RS')}`}
        </div>
        {inventory.error && (
          <div style={{ marginTop: 8, padding: 12, background: 'rgba(220,53,69,0.15)', border: `1px solid rgba(220,53,69,0.4)`, borderRadius: 6, color: colors.statusErr, fontSize: 13 }}>
            ⚠️ Greška: {inventory.error}
          </div>
        )}
        {inventory.message && !inventory.error && (
          <div style={{ marginTop: 8, padding: 12, background: colors.bgPanelAlt, border: `1px solid ${colors.borderDefault}`, borderRadius: 6, color: colors.textSecondary, fontSize: 13, whiteSpace: 'pre-wrap' }}>
            ℹ️ {inventory.message}
          </div>
        )}
      </div>
      {inventory.items && inventory.items.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Šifra</th>
                <th style={th}>Naziv</th>
                <th style={th}>Količina</th>
                <th style={th}>JM</th>
                {inventory.items.some((i: any) => i.last_updated) && <th style={th}>Ažurirano</th>}
              </tr>
            </thead>
            <tbody>
              {inventory.items.map((item: any, idx: number) => (
                <tr
                  key={idx}
                  style={{ background: idx % 2 === 0 ? 'rgba(255,193,7,0.04)' : 'transparent' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = colors.bgPanelAlt)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? 'rgba(255,193,7,0.04)' : 'transparent')}
                >
                  <td style={td}>{item.sku}</td>
                  <td style={td}>{item.name}</td>
                  <td style={td}>{item.quantity}</td>
                  <td style={td}>{item.uom}</td>
                  {inventory.items.some((i: any) => i.last_updated) && (
                    <td style={td}>{item.last_updated ? new Date(item.last_updated).toLocaleDateString('sr-Latn-RS') : '-'}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: 20, textAlign: 'center', color: colors.textSecondary }}>
          {inventory.error ? 'Nema dostupnih podataka zbog greške.' : 'Nema dostupnih zaliha za ovu prodavnicu.'}
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <button style={btn} onClick={onBack}>
          ← Nazad na Veleprodajni Magacin
        </button>
      </div>
    </div>
  );
}
