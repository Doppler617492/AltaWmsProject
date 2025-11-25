import { CSSProperties, useEffect, useState } from 'react';
import { colors } from '../src/theme/colors';
import { fetchActiveOrders, fetchOrderDetail, createOrder, startOrder, stageOrder, loadOrder, closeOrder, importFromExcel, importFromExcelPreview, deleteOrdersBulk } from '../services/shipping';
import { apiClient } from '../lib/apiClient';

const PREDEFINED_STORES = [
  'Mp Bar',
  'Mp Bar Centar',
  'Mp Bijelo Polje',
  'Mp Berane',
  'Mp Budva',
  'Mp Kotor',
  'Mp Herceg Novi',
  'Mp Sutorina',
  'Mp Niksic',
  'Mp Podgorica',
  'Mp Podgorica Centar',
  'Mp Ulcinj',
  'Mp Ulcinj Centar',
  'Veleprodajni Magacin',
  'Carinsko Skladiste',
];

const shippingStatusMetaMap: Record<string, { label: string; bg: string; color: string }> = {
  DRAFT: { label: 'NACRT', bg: '#475569', color: '#f8fafc' },
  PENDING: { label: 'ČEKA', bg: '#38bdf8', color: '#0f172a' },
  PICKING: { label: 'U ODBIRU', bg: '#f59e0b', color: '#1f2937' },
  PICKED: { label: 'ODABRANO', bg: '#4ade80', color: '#064e3b' },
  STAGED: { label: 'PRIPREMLJENO', bg: '#a855f7', color: '#fdf4ff' },
  LOADED: { label: 'UTOVARENO', bg: '#0ea5e9', color: '#022c4b' },
  CLOSED: { label: 'ZATVORENO', bg: '#94a3b8', color: '#0f172a' },
  CANCELLED: { label: 'OTKAZANO', bg: '#f87171', color: '#fff' },
};

const getShippingStatusMeta = (status: string | null | undefined) => {
  const key = (status || '').toUpperCase();
  return (
    shippingStatusMetaMap[key] || {
      label: key || 'NEPOZNATO',
      bg: '#475569',
      color: '#f8fafc',
    }
  );
};

const renderShippingStatusBadge = (status: string | null | undefined) => {
  const meta = getShippingStatusMeta(status);
  return (
    <span
      style={{
        backgroundColor: meta.bg,
        color: meta.color,
        padding: '4px 10px',
        borderRadius: 999,
        fontWeight: 700,
        fontSize: 12,
        letterSpacing: '0.5px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 90,
        textAlign: 'center',
        textTransform: 'uppercase',
      }}
    >
      {meta.label}
    </span>
  );
};

const panelStyle: CSSProperties = {
  background: 'linear-gradient(180deg,#111522,#0a0e18)',
  borderRadius: 24,
  border: '1px solid rgba(255,255,255,0.05)',
  padding: 20,
  boxShadow: '0 18px 35px rgba(0,0,0,0.45)',
};

export default function ShippingDashboard() {
  const [tab, setTab] = useState<'active'|'create'|'staging'>('active');
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 18 }}>
      <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ textTransform:'uppercase', letterSpacing:3, fontSize:12, color:'rgba(255,255,255,0.5)' }}>Outbound orchestration</div>
          <h1 style={{ margin:'6px 0 8px', fontSize:30, fontWeight:700, color:'#fff' }}>Otprema · kontrolna zona</h1>
          <p style={{ color:'rgba(255,255,255,0.6)', margin:0, maxWidth:520 }}>Upravlja aktivnim nalozima, staging zonom i kreiraj nove otpreme bez napuštanja panela.</p>
        </div>
      </div>

      <div style={{ display:'flex', gap: 10, flexWrap:'wrap' }}>
        <TabBtn active={tab==='active'} onClick={()=>setTab('active')}>Aktivni nalozi</TabBtn>
        <TabBtn active={tab==='create'} onClick={()=>setTab('create')}>Kreiraj nalog</TabBtn>
        <TabBtn active={tab==='staging'} onClick={()=>setTab('staging')}>Staging zona</TabBtn>
      </div>

      <div style={panelStyle}>
        {tab==='active' && <ActiveOrders />}
        {tab==='create' && <CreateOrder onShowActive={(orderId?:number)=>{ try{ if(orderId) localStorage.setItem('OPEN_ORDER_ID', String(orderId)); }catch{} setTab('active'); }} />}
        {tab==='staging' && <StagingZone />}
      </div>
    </div>
  );
}

function ActiveOrders() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string|null>(null);
  const [detail, setDetail] = useState<any|null>(null);
  const [detailData, setDetailData] = useState<any|null>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [assignUserId, setAssignUserId] = useState<number|''>('');
  const [actorRole, setActorRole] = useState<string>('');
  const [syncing, setSyncing] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const printDetail = () => {
    const d = detailData || detail;
    if (!d) return;
    const html = `<!doctype html><html><head><meta charset="utf-8" />
    <title>Otprema ${d.order_number}</title>
    <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial;padding:16px;}h1{font-size:18px;margin:0 0 8px;}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f5f5f5}.ok{background:#e8f5e9}.diff{background:#fff4e5}</style>
    </head><body>
    <h1>Otprema ${d.order_number} · ${d.customer_name}</h1>
    <div style="margin:4px 0 10px;color:#555">Progres: ${d.progress_pct || 0}% · Stavki: ${d.lines_total || (d.lines?.length||0)} · Završeno: ${d.lines_picked || 0}</div>
    <table><thead><tr><th>Red. br.</th><th>Šifra</th><th>Naziv</th><th>Traženo</th><th>Odabrano</th><th>Razlika</th><th>Status</th><th>Napomena</th></tr></thead>
    <tbody>${(d.lines||[]).map((l:any,i:number)=>{
      const diff = Number(l.picked_qty||0) - Number(l.requested_qty||0);
      const cls = diff === 0 ? 'ok' : 'diff';
      return `<tr class="${cls}"><td>${i+1}</td><td>${l.item_sku}</td><td>${l.item_name}</td><td>${l.requested_qty}</td><td>${l.picked_qty}</td><td>${diff}</td><td>${l.status_per_line}</td><td>${l.condition_notes || ''}</td></tr>`;
    }).join('')}</tbody></table>
    </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('Omogućite popup prozor za štampu.'); return; }
    w.document.write(html); w.document.close(); w.focus(); w.print(); setTimeout(()=>{ try{ w.close(); }catch{} }, 500);
  };

  // Enterprise print template with logo + totals
  const printDetailPro = () => {
    const d = detailData || detail;
    if (!d) return;
    const logo = (typeof window!== 'undefined' && (localStorage.getItem('PRINT_LOGO_MARK_URL') || '/logo-mark.svg')) || '/logo-mark.svg';
    const totalReq = (d.lines||[]).reduce((s:number,l:any)=> s + Number(l.requested_qty||0), 0);
    const totalPic = (d.lines||[]).reduce((s:number,l:any)=> s + Number(l.picked_qty||0), 0);
    const totalDiff = totalPic - totalReq;
    const html = `<!doctype html><html><head><meta charset="utf-8" />
    <title>Otprema ${d.order_number}</title>
    <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial; padding:24px; color:#111}.header{display:flex; align-items:center; justify-content:space-between; margin-bottom:16px}.brand{display:flex; align-items:center; gap:10px}.brand img{height:36px}.brand .tt{font-size:18px; font-weight:800; letter-spacing:.5px}.docTitle{font-size:16px; font-weight:700}.meta{display:grid; grid-template-columns:repeat(2,1fr); gap:8px; font-size:12px; margin:12px 0 14px}table{width:100%; border-collapse:collapse; font-size:12px}th,td{border:1px solid #cfd4dc; padding:8px; text-align:left}th{background:#f6f7f9}.ok{background:#eafbea}.diff{background:#fff3e0}</style>
    </head><body>
    <div class="header"><div class="brand"><img src="${logo}" onerror="this.style.display='none'"/><span class="tt">Alta WMS</span></div><div class="docTitle">Dokument: Otprema ${d.order_number}</div></div>
    <div class="meta"><div><b>Progres:</b> ${d.progress_pct || 0}%</div><div><b>Stavki:</b> ${d.lines_total || (d.lines?.length||0)} · Završeno: ${d.lines_picked || 0}</div><div><b>Količina:</b> ${totalPic}/${totalReq}</div><div><b>Razlika:</b> ${totalDiff}</div><div><b>Datum štampe:</b> ${new Date().toLocaleString()}</div><div><b>Napomena:</b> ${d.notes || ''}</div></div>
    <table><thead><tr><th>Red. br.</th><th>Šifra</th><th>Naziv</th><th>Traženo</th><th>Odabrano</th><th>Razlika</th><th>Status</th><th>Napomena</th></tr></thead>
    <tbody>${(d.lines||[]).map((l:any,i:number)=>{
      const diff = Number(l.picked_qty||0) - Number(l.requested_qty||0);
      const cls = diff === 0 ? 'ok' : 'diff';
      const note = l.condition_notes ? String(l.condition_notes).replace(/</g,'&lt;') : '';
      return `<tr class="${cls}"><td>${i+1}</td><td>${l.item_sku}</td><td>${l.item_name}</td><td>${l.requested_qty}</td><td>${l.picked_qty}</td><td>${diff}</td><td>${l.status_per_line}</td><td>${note}</td></tr>`;
    }).join('')}</tbody>
    <tfoot><tr><td colspan="3">Ukupno</td><td>${totalReq}</td><td>${totalPic}</td><td>${totalDiff}</td><td colspan="2"></td></tr></tfoot></table>
    </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('Omogućite popup prozor za štampu.'); return; }
    w.document.write(html); w.document.close(); w.focus(); w.print(); setTimeout(()=>{ try{ w.close(); }catch{} }, 500);
  };

  const load = async ()=>{
    try{ setLoading(true); const d = await fetchActiveOrders(); const arr = Array.isArray(d)?d:[]; setRows(arr); setErr(null);
      try{
        const openId = localStorage.getItem('OPEN_ORDER_ID');
        if (openId) {
          const idNum = Number(openId);
          const found = arr.find((x:any)=>x.id===idNum);
          if (found) { setDetail(found); const dd = await fetchOrderDetail(found.id); setDetailData(dd); }
          localStorage.removeItem('OPEN_ORDER_ID');
        }
        const openOrderNumber = localStorage.getItem('OPEN_ORDER_NUMBER');
        if (openOrderNumber) {
          const found = arr.find((x:any)=>x.order_number===openOrderNumber);
          if (found) { setDetail(found); const dd = await fetchOrderDetail(found.id); setDetailData(dd); }
          localStorage.removeItem('OPEN_ORDER_NUMBER');
        }
      }catch{}
    }catch(e:any){ setErr(e?.message||'Greška'); }finally{ setLoading(false); }
  };
  useEffect(()=>{ load(); }, []);
  useEffect(()=>{ try{ const token=localStorage.getItem('token')||''; const p=JSON.parse(atob(token.split('.')[1])); setActorRole((p.role||'').toLowerCase()); }catch{} },[]);

  const reloadDetail = async (id: number) => {
    const d = await fetchOrderDetail(id);
    setDetailData(d);
    return d;
  };

  const handleStageCurrent = async () => {
    if (!detail) return;
    try {
      await stageOrder(detail.id);
      await reloadDetail(detail.id);
      await load();
    } catch (e:any) {
      alert(e?.message || 'Greška pri označavanju naloga kao PRIPREMLJENO');
    }
  };

  const handleLoadCurrent = async () => {
    if (!detail) return;
    try {
      await loadOrder(detail.id);
      await reloadDetail(detail.id);
      await load();
    } catch (e:any) {
      alert(e?.message || 'Greška pri označavanju naloga kao UTOVARENO');
    }
  };

  const handleCloseCurrent = async () => {
    if (!detail) return;
    if (!confirm('Zatvoriti ovaj nalog otpreme?')) return;
    try {
      await closeOrder(detail.id);
      await reloadDetail(detail.id);
      await load();
    } catch (e:any) {
      alert(e?.message || 'Greška pri zatvaranju naloga');
    }
  };

  const summaryValue = (value: any, fallback: string = '—') => {
    if (value === null || value === undefined || value === '') return fallback;
    return value;
  };

  const formatNumber = (value: number) => {
    if (!Number.isFinite(value)) return '—';
    return value.toLocaleString('sr-Latn-RS', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const runManualSync = async () => {
    // Sync only last 1 day
    const since = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    
    try {
      setSyncing(true);
      const result = await apiClient.post('/integrations/cungu/sync', {
        shipping: {
          dateFrom: since,
          dateTo: today,
          // Only these warehouses
          warehouses: ['Veleprodajni Magacin', 'Tranzitno skladiste'],
        },
        persist: true, // Auto-import documents
      });
      
      const imported = result?.shippingImported ?? 0;
      const total = result?.shippingCount ?? 0;
      
      if (imported > 0) {
        alert(
          `✅ Sinhronizacija uspešna!\n\n` +
          `📦 Uvezeno novih otpremnica: ${imported}\n` +
          `📋 Ukupno pronađeno: ${total}\n\n` +
          `Otpremnice su sada vidljive u sistemu.`
        );
      } else if (total > 0) {
        alert(
          `ℹ️ Sve otpremnice su već u sistemu.\n\n` +
          `📋 Pronađeno: ${total}\n` +
          `📦 Novih: 0\n\n` +
          `Nema novih dokumenata za uvoz.`
        );
      } else {
        alert(
          `ℹ️ Nema novih otpremnica.\n\n` +
          `Provereno je poslednjih 24 sata.\n` +
          `Skladišta: Veleprodajni Magacin, Tranzitno skladiste\n\n` +
          `Ako očekujete nove dokumente, proverite:\n` +
          `• Da li su kreirani u Pantheon sistemu\n` +
          `• Da li je datum dokumenta u poslednjih 24 sata\n` +
          `• Da li su iz pravih skladišta`
        );
      }
      
      await load(); // Refresh list
    } catch (err: any) {
      const errorMsg = err?.message || 'Greška pri sinhronizaciji.';
      alert(
        `❌ Greška pri sinhronizaciji\n\n` +
        `${errorMsg}\n\n` +
        `Proverite:\n` +
        `• Internet konekciju\n` +
        `• Pantheon server status\n` +
        `• Kontaktirajte administratora ako problem opstaje`
      );
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  const renderDetailModal = () => {
    if (!detail) return null;
    const summary: any = detailData || detail;
    const statusMeta = getShippingStatusMeta(summary?.status || detail.status);
    const progressPct = Math.max(
      0,
      Math.min(100, Math.round(summary?.progress_pct ?? detail.progress_pct ?? 0))
    );
    const linesList =
      (detailData && Array.isArray(detailData.lines) ? detailData.lines : undefined) ||
      (Array.isArray((detail as any)?.lines) ? (detail as any).lines : []);
    const linesTotal =
      summary?.lines_total ??
      detail.lines_total ??
      (Array.isArray(linesList) ? linesList.length : 0);
    const linesPicked = summary?.lines_picked ?? detail.lines_picked ?? 0;
    const totalRequested = Array.isArray(linesList)
      ? linesList.reduce((sum: number, ln: any) => sum + Number(ln.requested_qty || 0), 0)
      : 0;
    const totalPicked = Array.isArray(linesList)
      ? linesList.reduce(
          (sum: number, ln: any) => sum + Number(ln.picked_qty ?? (ln.requested_qty ?? 0)),
          0
        )
      : 0;
    const totalDiff = totalPicked - totalRequested;
    const assignedName =
      summary?.assigned_user_name ||
      summary?.assigned_to_name ||
      detail.assigned_user_name ||
      detail.assigned_to_name ||
      '';
    const teamName = summary?.team_name || detail.team_name || '';
    const ageMinutes = summary?.age_minutes ?? detail.age_minutes;
    const notes = summary?.notes ?? detail.notes;
    const ageDisplay = Number.isFinite(ageMinutes) ? `${ageMinutes} min` : '—';
    const hasDiscrepancy =
      Array.isArray(linesList) &&
      linesList.some((ln: any) => {
        const requested = Number(ln.requested_qty || 0);
        const picked = Number(ln.picked_qty ?? requested);
        return requested !== picked || Boolean(ln.has_discrepancy);
      });
    const createdAt = detail.created_at ? new Date(detail.created_at) : null;
    const documentDate = detail.document_date ? new Date(detail.document_date) : null;

  return (
      <div style={shippingModalStyles.backdrop}>
        <div style={shippingModalStyles.wrapper}>
          <div style={shippingModalStyles.header}>
    <div>
              <div style={{ color: colors.brandYellow, fontSize: 12, letterSpacing: '1px' }}>
                Pregled otpreme
              </div>
              <h3 style={{ margin: '4px 0 0', color: '#fff' }}>Otprema {detail.order_number}</h3>
              <div style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                Kupac: {summaryValue(detail.customer_name)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={printDetailPro} style={shippingModalStyles.actionGhostButton}>
                Štampaj
              </button>
              {actorRole === 'admin' && (summary?.status || detail.status) && (
                <button
                  onClick={async () => {
                    if (!confirm('Obrisati ovaj nalog otpreme?')) return;
                    try {
                      await apiClient.delete(`/shipping/order/${detail.id}`);
                      setDetail(null);
                      setDetailData(null);
                      await load();
                    } catch (e:any) {
                      alert(e?.message || 'Greška pri brisanju');
                    }
                  }}
                  style={{
                    ...shippingModalStyles.actionGhostButton,
                    background: '#ff4d4f',
                    borderColor: '#ff4d4f',
                    color: '#fff',
                  }}
                >
                  Izbriši
                </button>
              )}
              <button
                onClick={() => {
                  setDetail(null);
                  setDetailData(null);
                }}
                style={shippingModalStyles.closeButton}
              >
                ×
              </button>
            </div>
          </div>
          <div style={shippingModalStyles.body}>
            <aside style={shippingModalStyles.sidebar}>
              <div style={shippingModalStyles.sectionCard}>
                <div style={shippingModalStyles.sectionTitle}>Opšte informacije</div>
                <div style={shippingModalStyles.sectionRow}>
                  <span>Kupac</span>
                  <strong>{summaryValue(detail.customer_name)}</strong>
                </div>
                <div style={shippingModalStyles.sectionRow}>
                  <span>Status</span>
                  <span
                    style={{
                      ...shippingModalStyles.sectionStatusBadge,
                      backgroundColor: `${statusMeta.bg}1F`,
                      borderColor: `${statusMeta.color}40`,
                      color: statusMeta.color,
                    }}
                  >
                    {statusMeta.label}
                  </span>
                </div>
                <div style={shippingModalStyles.sectionRow}>
                  <span>Kreirao</span>
                  <strong>{summaryValue(summary?.created_by_name || detail.created_by_name)}</strong>
                </div>
                {(assignedName || teamName) && (
                  <div style={shippingModalStyles.sectionRow}>
                    <span>Dodeljeno</span>
                    <strong>{assignedName || teamName || '—'}</strong>
                  </div>
                )}
                {teamName && assignedName && (
                  <div style={shippingModalStyles.sectionRow}>
                    <span>Tim</span>
                    <strong>{teamName}</strong>
                  </div>
                )}
                {Number.isFinite(ageMinutes) && (
                  <div style={shippingModalStyles.sectionRow}>
                    <span>Starost</span>
                    <strong>{ageDisplay}</strong>
                  </div>
                )}
                <div style={shippingModalStyles.sectionDivider} />
                <div style={shippingModalStyles.sectionStatGrid}>
                  <div style={shippingModalStyles.sectionStatCard}>
                    <div style={shippingModalStyles.sectionStatLabel}>Broj dokumenta</div>
                    <div style={shippingModalStyles.sectionStatValue}>{detail.order_number}</div>
                  </div>
                  <div style={shippingModalStyles.sectionStatCard}>
                    <div style={shippingModalStyles.sectionStatLabel}>Datum dokumenta</div>
                    <div style={shippingModalStyles.sectionStatValue}>
                      {documentDate ? documentDate.toLocaleDateString('sr-Latn-RS') : '—'}
                    </div>
                  </div>
                  <div style={shippingModalStyles.sectionStatCard}>
                    <div style={shippingModalStyles.sectionStatLabel}>Kreirano</div>
                    <div style={shippingModalStyles.sectionStatValue}>
                      {createdAt ? createdAt.toLocaleString('sr-Latn-RS') : '—'}
                    </div>
                  </div>
                  <div style={shippingModalStyles.sectionStatCard}>
                    <div style={shippingModalStyles.sectionStatLabel}>Ukupno stavki</div>
                    <div style={shippingModalStyles.sectionStatValue}>{linesTotal}</div>
                  </div>
                  <div style={shippingModalStyles.sectionStatCard}>
                    <div style={shippingModalStyles.sectionStatLabel}>Očekivano</div>
                    <div style={shippingModalStyles.sectionStatValue}>{formatNumber(totalRequested)}</div>
                  </div>
                  <div style={shippingModalStyles.sectionStatCard}>
                    <div style={shippingModalStyles.sectionStatLabel}>Primljeno</div>
                    <div style={shippingModalStyles.sectionStatValue}>{formatNumber(totalPicked)}</div>
                  </div>
                  <div style={shippingModalStyles.sectionStatCard}>
                    <div style={shippingModalStyles.sectionStatLabel}>Napredak</div>
                    <div style={shippingModalStyles.sectionStatValueHighlight}>{progressPct}%</div>
                  </div>
                  <div style={shippingModalStyles.sectionStatCard}>
                    <div style={shippingModalStyles.sectionStatLabel}>Starost</div>
                    <div style={shippingModalStyles.sectionStatValue}>{ageDisplay}</div>
                  </div>
                </div>
                {hasDiscrepancy && (
                  <div style={shippingModalStyles.sectionBadgeWarn}>
                    ⚠️ Detektovano neslaganje u stavkama
                  </div>
                )}
                {notes && (
                  <div style={shippingModalStyles.notesBox}>
                    <div style={{ fontSize: 11, letterSpacing: '0.5px', color: colors.brandYellow }}>
                      Napomena
                    </div>
                    <div style={{ fontSize: 12, color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                      {notes}
                    </div>
                  </div>
                )}
              </div>
              <div style={shippingModalStyles.sectionCard}>
                <div style={shippingModalStyles.sectionTitle}>Napredak</div>
                <div style={shippingModalStyles.progressTrack}>
                  <div
                    style={{
                      ...shippingModalStyles.progressValue,
                      width: `${progressPct}%`,
                    }}
                  />
                </div>
                <div style={shippingModalStyles.progressMeta}>
                  <span>{progressPct}% kompletirano</span>
                  <span>
                    Stavki: {linesPicked}/{linesTotal}
                  </span>
                </div>
                <div style={shippingModalStyles.progressMeta}>
                  <span>Traženo: {totalRequested}</span>
                  <span>Odabrano: {totalPicked}</span>
                </div>
                <div style={shippingModalStyles.progressMeta}>
                  <span>Razlika</span>
                  <strong style={{ color: totalDiff === 0 ? '#22c55e' : colors.statusWarn }}>
                    {totalDiff}
                  </strong>
                </div>
              </div>
              <div style={shippingModalStyles.sectionCard}>
                <div style={shippingModalStyles.sectionTitle}>Akcije</div>
                <div style={shippingModalStyles.assignRow}>
                  <select
                    value={assignUserId}
                    onChange={e => setAssignUserId(Number(e.target.value) || '')}
                    style={shippingModalStyles.input}
                  >
                    <option value="">Dodeli magacioneru...</option>
                    {workers.map((u:any)=> (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.name || u.username}
                      </option>
                    ))}
                  </select>
                  <button
                    style={shippingModalStyles.primaryActionButton}
                    onClick={async()=>{
                      if(!assignUserId){alert('Odaberite magacionera'); return;}
                      try{
                        await startOrder(detail.id, Number(assignUserId));
                        await reloadDetail(detail.id);
                        setAssignUserId('');
                        await load();
                      }catch(e:any){ alert(e?.message||'Greška pri dodeli'); }
                    }}
                  >
                    Dodeli
                  </button>
                </div>
                <div style={shippingModalStyles.actionsStack}>
                  <button style={shippingModalStyles.ghostActionButton} onClick={handleStageCurrent}>
                    Označi PRIPREMLJENO
                  </button>
                  <button style={shippingModalStyles.ghostActionButton} onClick={handleLoadCurrent}>
                    Označi UTOVARENO
                  </button>
                  <button style={shippingModalStyles.dangerActionButton} onClick={handleCloseCurrent}>
                    Zatvori nalog
                  </button>
                </div>
              </div>
            </aside>
            <section style={shippingModalStyles.contentArea}>
              <div style={shippingModalStyles.contentCard}>
                <div style={shippingModalStyles.contentHeader}>
                  <div style={shippingModalStyles.sectionTitle}>Stavke otpreme</div>
                  <div style={{ color: colors.textSecondary, fontSize: 12 }}>
                    Progres: {progressPct}% · Stavki: {linesTotal} · Završeno: {linesPicked}
                  </div>
                </div>
                <div style={shippingModalStyles.tableWrapper}>
                  <table style={shippingModalStyles.itemsTable}>
                    <thead>
                      <tr>
                        <th style={shippingModalStyles.tableHeadCell}>Šifra</th>
                        <th style={shippingModalStyles.tableHeadCell}>Naziv</th>
                        <th style={shippingModalStyles.tableHeadCell}>Traženo</th>
                        <th style={shippingModalStyles.tableHeadCell}>Odabrano</th>
                        <th style={shippingModalStyles.tableHeadCell}>Status</th>
                        <th style={shippingModalStyles.tableHeadCell}>Napomena</th>
                        <th style={shippingModalStyles.tableHeadCell}>Akcija</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(linesList) && linesList.length > 0 ? (
                        linesList.map((ln:any, idx:number)=> {
                          const requested = Number(ln.requested_qty || 0);
                          const picked = Number(ln.picked_qty ?? 0);
                          const hasDiff = picked !== requested;
                          const rowStyle = hasDiff
                            ? { background: 'rgba(234, 179, 8, 0.12)' }
                            : picked >= requested
                              ? { background: 'rgba(34, 197, 94, 0.12)' }
                              : { background: idx % 2 === 0 ? 'rgba(148, 163, 184, 0.08)' : 'transparent' };
                          return (
                            <tr key={idx} style={rowStyle}>
                              <td style={shippingModalStyles.tableCell}>{ln.item_sku}</td>
                              <td style={shippingModalStyles.tableCell}>{ln.item_name}</td>
                              <td style={{ ...shippingModalStyles.tableCell, textAlign: 'right' }}>{requested}</td>
                              <td
                                style={{
                                  ...shippingModalStyles.tableCell,
                                  textAlign: 'right',
                                  fontWeight: hasDiff ? 700 : 400,
                                  color: hasDiff ? colors.statusWarn : '#f1f5f9',
                                }}
                              >
                                {picked}
                              </td>
                              <td style={{ ...shippingModalStyles.tableCell, textAlign: 'center' }}>
                                {renderShippingStatusBadge(ln.status_per_line)}
                              </td>
                              <td style={{ ...shippingModalStyles.tableCell, color: hasDiff ? colors.statusWarn : colors.textSecondary }}>
                                {ln.condition_notes || (hasDiff ? 'Bez napomene' : '')}
                              </td>
                              <td style={{ ...shippingModalStyles.tableCell, textAlign: 'center' }}>
                                {actorRole==='admin' && (
                                  <button
                                    style={shippingModalStyles.smallDangerButton}
                                    onClick={async()=>{ if(!confirm('Obrisati stavku iz otpreme?')) return; try{ await apiClient.delete(`/shipping/line/${ln.line_id}`); await reloadDetail(detail.id); await load(); }catch(e:any){ alert(e?.message||'Greška pri brisanju stavke'); } }}
                                  >
                                    Izbriši
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td style={shippingModalStyles.tableCell} colSpan={7}>
                            Nema stavki za prikaz.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  };

  const handleToggleSelect = (orderId: number) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedOrders.size === rows.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(rows.map((r: any) => r.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedOrders.size === 0) {
      alert('Niste odabrali nijedan nalog za brisanje');
      return;
    }

    const count = selectedOrders.size;
    if (!confirm(`Da li ste sigurni da želite da obrišete ${count} ${count === 1 ? 'nalog' : 'naloga'}?`)) {
      return;
    }

    try {
      setDeleting(true);
      const orderIds = Array.from(selectedOrders);
      const result = await deleteOrdersBulk(orderIds);
      
      if (result.deleted > 0) {
        alert(`Uspešno obrisano ${result.deleted} ${result.deleted === 1 ? 'nalog' : 'naloga'}.${result.skipped > 0 ? ` Preskočeno: ${result.skipped}` : ''}`);
        setSelectedOrders(new Set());
        await load();
      } else {
        alert(`Nijedan nalog nije obrisan.${result.errors.length > 0 ? '\n' + result.errors.join('\n') : ''}`);
      }
    } catch (e: any) {
      alert(e?.message || 'Greška pri brisanju naloga');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {selectedOrders.size > 0 && (
            <>
              <span style={{ color: colors.textSecondary, fontSize: 12 }}>
                Odabrano: {selectedOrders.size}
              </span>
              <button
                style={{
                  background: colors.statusErr,
                  border: 'none',
                  color: '#fff',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.6 : 1,
                }}
                onClick={handleBulkDelete}
                disabled={deleting}
              >
                {deleting ? 'Brišem…' : `Obriši ${selectedOrders.size} ${selectedOrders.size === 1 ? 'nalog' : 'naloga'}`}
              </button>
            </>
          )}
        </div>
        <button
          style={{
            background: syncing 
              ? 'transparent'
              : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            border: syncing ? `1px solid ${colors.borderDefault}` : 'none',
            color: syncing ? colors.textSecondary : '#000',
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: syncing ? 'not-allowed' : 'pointer',
            opacity: syncing ? 0.6 : 1,
            boxShadow: syncing ? 'none' : '0 4px 12px rgba(251, 191, 36, 0.3)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
          onClick={runManualSync}
          disabled={syncing}
          title="Uvuci nove otpremnice iz Pantheon sistema (samo iz Veleprodajni Magacin i Tranzitno skladiste, poslednji 1 dan)"
        >
          <span style={{ fontSize: 16 }}>{syncing ? '⏳' : '🔄'}</span>
          {syncing ? 'Sinhronizacija u toku…' : 'Sinhroniši Pantheon'}
        </button>
      </div>
      {loading ? <div style={{ color: colors.textPrimary }}>Učitavanje…</div> : err ? <div style={{ color: colors.statusErr }}>{err}</div> : (
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selectedOrders.size === rows.length}
                  onChange={handleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={th}>Broj</th>
              <th style={th}>Kupac</th>
              <th style={th}>Status</th>
              <th style={th}>Kreirao</th>
              <th style={th}>Radnik</th>
              <th style={th}>Progres</th>
              <th style={th}>Starost</th>
              <th style={th}>Tim</th>
              <th style={th}>Akcije</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r:any, idx:number)=> (
              <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,193,7,0.04)' : 'transparent' }}>
                <td style={td}>
                  <input
                    type="checkbox"
                    checked={selectedOrders.has(r.id)}
                    onChange={() => handleToggleSelect(r.id)}
                    style={{ cursor: 'pointer' }}
                  />
                </td>
                <td style={td}>{r.order_number}</td>
                <td style={td}>{r.customer_name}</td>
                <td style={td}>{renderShippingStatusBadge(r.status)}</td>
                <td style={td}>{r.created_by_name||'-'}</td>
                <td style={td}>{r.assigned_user_name||'-'}</td>
                <td style={td}><ProgressBar v={r.progress_pct} /></td>
                <td style={td}>{r.age_minutes} min</td>
                <td style={td}><AssigneesButton type="SHIPPING" id={r.id} /></td>
                <td style={td}>
                  <button style={btn} onClick={async()=>{ 
                    setDetail(r); 
                    try{ 
                      await reloadDetail(r.id);
                      // load workers for assignment
                      try { const users = await apiClient.get('/users'); setWorkers((users||[]).filter((u:any)=>['magacioner','magacioner','sef'].includes((u.role||'').toLowerCase()))); } catch {}
                    }catch(e:any){alert(e?.message||'Greška');}
                  }}>Pregled</button>
                  <button style={btn} onClick={()=>stageOrder(r.id).then(load)}>Označi PRIPREMLJENO</button>
                  <button style={btn} onClick={()=>loadOrder(r.id).then(load)}>Označi UTOVARENO</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {renderDetailModal()}
      <AssigneesModalContainer />
    </div>
  );
}

// Lightweight global modal state for assignees
let _setAssigneesState: any = null;
function AssigneesModalContainer() {
  const [state, setState] = useState<{ open: boolean; type?: 'RECEIVING'|'SHIPPING'|'PUTAWAY'; id?: number }|null>(null);
  useEffect(()=>{ _setAssigneesState = setState; return ()=>{ _setAssigneesState = null; }; }, []);
  if (!state?.open || !state?.type || !state?.id) return null;
  return <AssigneesModal type={state.type} id={state.id} onClose={()=>setState(null)} />;
}
function AssigneesButton({ type, id }: { type: 'RECEIVING'|'SHIPPING'|'PUTAWAY'; id: number }) {
  return <button style={btn} onClick={()=>{ _setAssigneesState && _setAssigneesState({ open:true, type, id }); }}>Vidi</button>;
}
function AssigneesModal({ type, id, onClose }: { type: 'RECEIVING'|'SHIPPING'|'PUTAWAY'; id: number; onClose: () => void }) {
  const [data, setData] = useState<any|null>(null);
  useEffect(() => { (async()=>{ try{ const d = await apiClient.get(`/workforce/task-assignees/${type}/${id}`); setData(d);} catch{} })(); }, [type, id]);
  return (
    <div style={modalOverlay}>
      <div style={modalContent}>
        <div style={modalHeader}>Članovi zadatka · {type} #{id}</div>
        {!data ? <div style={{ padding:8 }}>Učitavanje…</div> : (
          <div style={{ padding: 8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, color:'#6b7280' }}>
              <span>Policy: {data.policy} {data.all_done_at ? `· ALL_DONE @ ${new Date(data.all_done_at).toLocaleString()}` : ''}</span>
              <button style={btn} onClick={()=>downloadAssigneesCSV(type, id, data)}>CSV</button>
              <button style={btn} onClick={()=>printAssignees(type, id, data)}>Štampaj</button>
            </div>
            {(!data.assignees || data.assignees.length===0) ? <div>Nema dodeljenih članova.</div> : (
              <table style={table}>
                <thead><tr><th style={th}>Korisnik</th><th style={th}>Status</th><th style={th}>Start</th><th style={th}>Kraj</th></tr></thead>
                <tbody>
                  {data.assignees.map((a:any)=> (
                    <tr key={a.id}><td style={td}>{a.user_name}</td><td style={td}>{a.status}</td><td style={td}>{a.started_at ? new Date(a.started_at).toLocaleString() : '—'}</td><td style={td}>{a.completed_at ? new Date(a.completed_at).toLocaleString() : '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding: 8 }}>
          <button style={btn} onClick={onClose}>Zatvori</button>
        </div>
      </div>
    </div>
  );
}

function downloadAssigneesCSV(type: string, id: number, data: any) {
  const header = ['task_type','task_id','user_name','status','started_at','completed_at'];
  const lines = [header.join(',')].concat(
    (data?.assignees||[]).map((a:any)=> [
      type,
      String(id),
      csv(a.user_name),
      a.status,
      a.started_at ? new Date(a.started_at).toISOString() : '',
      a.completed_at ? new Date(a.completed_at).toISOString() : ''
    ].join(','))
  );
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const el = document.createElement('a');
  el.href = url; el.download = `assignees_${type}_${id}.csv`;
  document.body.appendChild(el); el.click(); document.body.removeChild(el);
}

function printAssignees(type: string, id: number, data: any) {
  const rows = (data?.assignees||[]);
  const html = `<!doctype html><html><head><meta charset="utf-8" />
  <title>Članovi zadatka ${type} #${id}</title>
  <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial;padding:16px;}h1{font-size:18px;margin:0 0 8px;}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f5f5f5}</style>
  </head><body>
  <h1>Članovi zadatka ${type} #${id}</h1>
  <div style="margin:4px 0 10px;color:#555">Policy: ${data?.policy || ''} ${data?.all_done_at ? '· ALL_DONE @ '+new Date(data.all_done_at).toLocaleString() : ''}</div>
  <table><thead><tr><th>Korisnik</th><th>Status</th><th>Start</th><th>Kraj</th></tr></thead>
  <tbody>${rows.map((a:any)=>`<tr><td>${escapeHtml(a.user_name||'')}</td><td>${escapeHtml(a.status||'')}</td><td>${a.started_at ? new Date(a.started_at).toLocaleString() : ''}</td><td>${a.completed_at ? new Date(a.completed_at).toLocaleString() : ''}</td></tr>`).join('')}</tbody></table>
  </body></html>`;
  const w = window.open('', '_blank'); if (!w) return;
  w.document.write(html); w.document.close(); w.focus(); w.print(); setTimeout(()=>{ try{ w.close(); }catch{} }, 500);
}

function csv(v:any){
  if (v==null) return '';
  const s = String(v).replace(/\"/g,'\"\"');
  return `"${s}"`;
}
function escapeHtml(s:string){
  return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c] as string));
}

function CreateOrder({ onShowActive }: { onShowActive?: (orderId?: number)=>void }) {
  const [storeName, setStoreName] = useState('');
  const [order_number, setOrderNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Array<any>>([]);
  const [allItems, setAllItems] = useState<Array<any>>([]);
  const [activeSearchIdx, setActiveSearchIdx] = useState<number | null>(null);
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<any|null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const data = await apiClient.get('/items');
      setAllItems(Array.isArray(data) ? data : []);
    } catch (e) {}
  };

  const addLine = () => setLines(prev=>[...prev, { item_id: '', item_name: '', item_sku: '', item_barcode: '', requested_qty: '', uom: 'KOM' }]);
  const removeLine = (i:number) => setLines(prev=>prev.filter((_,idx)=>idx!==i));

  const handleItemSelect = (item: any, lineIdx: number) => {
    const v = [...lines];
    v[lineIdx].item_id = item.id;
    v[lineIdx].item_name = item.name;
    v[lineIdx].item_sku = item.sku;
    v[lineIdx].item_barcode = item.barcode || '';
    setLines(v);
    setActiveSearchIdx(null);
    setActiveSearchTerm('');
  };

  const filteredItemsForCurrentSearch = activeSearchIdx !== null && activeSearchTerm.length >= 2
    ? allItems.filter((item: any) => 
        item.name?.toLowerCase().includes(activeSearchTerm.toLowerCase()) ||
        item.sku?.toLowerCase().includes(activeSearchTerm.toLowerCase()) ||
        item.barcode?.toLowerCase().includes(activeSearchTerm.toLowerCase())
      )
    : [];

  const handleImport = async () => {
    if (!importFile) {
      alert('Morate odabrati fajl za import');
      return;
    }
    if (!storeName) {
      alert('Morate odabrati prodavnicu');
      return;
    }
    try {
      setImporting(true);
      const result = await importFromExcelPreview(importFile, storeName);
      setPreviewData(result);
    } catch (e: any) {
      alert(e?.message || 'Greška pri importovanju');
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = async () => {
    if (!importFile) return;
    if (!storeName) return;
    try {
      setImporting(true);
      // Prefer JSON import when preview was successful
      if (previewData?.preview) {
        const payload = { ...previewData, customer_name: storeName, overwrite: true };
        const result = await apiClient.post('/shipping/import-json', payload);
        alert(result.message || 'Importovanje uspešno!');
        try{ if (result?.id) localStorage.setItem('OPEN_ORDER_ID', String(result.id)); }catch{}
        onShowActive?.(result?.id);
      } else {
        const result = await importFromExcel(importFile, storeName);
        alert(result.message || 'Importovanje uspešno!');
        try{ if (result?.id) localStorage.setItem('OPEN_ORDER_ID', String(result.id)); }catch{}
        onShowActive?.(result?.id);
      }
      setPreviewData(null);
      setImportFile(null);
      setStoreName('');
    } catch (e: any) {
      alert(e?.message || 'Greška pri snimanju importa');
    } finally {
      setImporting(false);
    }
  };

  const printPreview = () => {
     if (!previewData) return;
     const lines = Array.isArray(previewData.lines) ? previewData.lines : [];
     const totalReq = lines.reduce((s:number, l:any)=> s + Number(l.requested_qty||0), 0);
     const totalPic = lines.reduce((s:number, l:any)=> s + Number(l.picked_qty ?? (l.requested_qty ?? 0)), 0);
     const totalDiff = totalPic - totalReq;
     const html = `<!doctype html>
     <html><head><meta charset="utf-8" />
     <title>Otprema ${previewData.order_number}</title>
     <style>
       body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial; padding:16px;}
       h1{font-size:18px; margin:0 0 8px;}
       .meta{display:grid; grid-template-columns:repeat(2,1fr); gap:6px; font-size:12px; margin-bottom:10px}
       table{width:100%; border-collapse:collapse; font-size:12px}
       th,td{border:1px solid #ccc; padding:6px; text-align:left}
       th{background:#f5f5f5}
       td.num{text-align:right}
       .ok{background:#eafbea}
       .diff{background:#fff3e0}
     </style></head>
     <body>
       <h1>Otprema ${previewData.order_number}</h1>
       <div class="meta">
         <div><b>Primalac:</b> ${previewData.customer_name || ''}</div>
         <div><b>Izdavalac:</b> ${previewData.issuer_name || ''}</div>
         <div><b>Datum:</b> ${previewData.document_date || ''}</div>
         <div><b>Odgovorna osoba:</b> ${previewData.responsible_person || ''}</div>
         <div><b>Stavki:</b> ${lines.length}</div>
         <div><b>Traženo:</b> ${totalReq}</div>
         <div><b>Spakovano:</b> ${totalPic}</div>
         <div><b>Razlika:</b> ${totalDiff}</div>
       </div>
       <table>
         <thead><tr><th>Red. br.</th><th>Šifra</th><th>Naziv</th><th>Traženo</th><th>Odabrano</th><th>Razlika</th><th>JMJ</th><th>Napomena</th></tr></thead>
         <tbody>
           ${lines.map((ln:any, idx:number)=> {
             const req = Number(ln.requested_qty||0);
            const pic = Number(ln.picked_qty ?? (ln.requested_qty ?? 0));
             const diff = pic - req;
             const cls = diff === 0 ? 'ok' : 'diff';
             return `<tr class="${cls}"><td>${idx+1}</td><td>${ln.item_sku||''}</td><td>${ln.item_name||''}</td><td class="num">${req}</td><td class="num">${pic}</td><td class="num">${diff}</td><td>${ln.uom||''}</td><td>${ln.condition_notes||''}</td></tr>`;
           }).join('')}
         </tbody>
         <tfoot><tr><td colspan="3">Ukupno</td><td class="num">${totalReq}</td><td class="num">${totalPic}</td><td class="num">${totalDiff}</td><td colspan="2"></td></tr></tfoot>
       </table>
     </body></html>`;
     const w = window.open('', '_blank');
     if (!w) { alert('Omogućite popup prozor za štampu.'); return; }
     w.document.write(html);
     w.document.close();
     w.focus();
     w.print();
     setTimeout(()=>{ try{ w.close(); }catch{} }, 500);
   };

  // Enterprise preview print (branded header + totals)
  const printPreviewPro = () => {
    if (!previewData) return;
    const lines = Array.isArray(previewData.lines) ? previewData.lines : [];
    const totalReq = lines.reduce((s:number, l:any)=> s + Number(l.requested_qty||0), 0);
    const totalPic = lines.reduce((s:number, l:any)=> s + Number(l.picked_qty ?? (l.requested_qty ?? 0)), 0);
    const totalDiff = totalPic - totalReq;
    const logo = (typeof window!== 'undefined' && (localStorage.getItem('PRINT_LOGO_MARK_URL') || '/logo-mark.svg')) || '/logo-mark.svg';
    const html = `<!doctype html><html><head><meta charset="utf-8" />
    <title>Otprema ${previewData.order_number}</title>
    <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial; padding:24px; color:#111}.header{display:flex; align-items:center; justify-content:space-between; margin-bottom:16px}.brand{display:flex; alignments:center; gap:10px}.brand img{height:36px}.brand .tt{font-size:18px; font-weight:800; letter-spacing:.5px}.docTitle{font-size:16px; font-weight:700}.meta{display:grid; grid-template-columns:repeat(2,1fr); gap:8px; font-size:12px; margin:12px 0 14px}table{width:100%; border-collapse:collapse; font-size:min(12px,3vw)}th,td{border:1px solid #cfd4dc; padding:8px; text-align:left}th{background:#f6f7f9}.ok{background:#eafbea}.diff{background:#fff3e0}tfoot td{font-weight:700}</style></head>
    <body>
      <div class="header"><div class="brand"><img src="${logo}" onerror="this.style.display='none'"/><span class="tt">Alta WMS</span></div><div class="docTitle">Dokument: Otprema ${previewData.order_number}</div></div>
      <div class="meta"><div><b>Primalac:</b> ${previewData.customer_name || ''}</div><div><b>Izdavalac:</b> ${previewData.issuer_name || ''}</div><div><b>Datum:</b> ${previewData.document_date || ''}</div><div><b>Odgovorna osoba:</b> ${previewData.responsible_person || ''}</div><div><b>Stavki:</b> ${lines.length}</div><div><b>Traženo:</b> ${totalReq}</div><div><b>Spakovano:</b> ${totalPic}</div><div><b>Razlika:</b> ${totalDiff}</div></div>
      <table><thead><tr><th>Red. br.</th><th>Šifra</th><th>Naziv</th><th>Traženo</th><th>Odabrano</th><th>Razlika</th><th>JMJ</th><th>Napomena</th></tr></thead>
      <tbody>${lines.map((ln:any, idx:number)=>{
        const req = Number(ln.requested_qty||0);
        const pic = Number(ln.picked_qty ?? (ln.requested_qty ?? 0));
        const diff = pic - req;
        const cls = diff === 0 ? 'ok' : 'diff';
        const note = ln.condition_notes ? String(ln.condition_notes).replace(/</g,'&lt;') : '';
        return `<tr class="${cls}"><td>${idx+1}</td><td>${ln.item_sku||''}</td><td>${ln.item_name||''}</td><td>${req}</td><td>${pic}</td><td>${diff}</td><td>${ln.uom||''}</td><td>${note}</td></tr>`;
      }).join('')}</tbody>
      <tfoot><tr><td colspan="3">Ukupno</td><td>${totalReq}</td><td>${totalPic}</td><td>${totalDiff}</td><td colspan="2"></td></tr></tfoot></table>
    </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('Omogućite popup prozor za štampu.'); return; }
    w.document.write(html); w.document.close(); w.focus(); w.print(); setTimeout(()=>{ try{ w.close(); }catch{} }, 500);
  };

  const submit = async ()=>{
    try{
      if (!storeName) {
        alert('Morate odabrati prodavnicu');
        return;
      }
      if (lines.length === 0) {
        alert('Morate dodati najmanje jedan artikal');
        return;
      }
      await createOrder({ 
        order_number, 
        customer_name: storeName,
        store_name: storeName,
        notes, 
        lines: lines.map(l => ({
          item_id: l.item_id,
          requested_qty: l.requested_qty,
          uom: l.uom,
          pick_from_location_code: '' // komercialista doesn't approve locations
        }))
      });
      alert('Kreiran nalog');
      setStoreName(''); setOrderNumber(''); setNotes(''); setLines([]);
    }catch(e:any){ alert(e?.message||'Greška'); }
  };

  return (
    <div>
      <div style={{ display:'grid', gap: 8, marginBottom: 12 }}>
        <div>
          <select value={storeName} onChange={e=>setStoreName(e.target.value)} style={input}>
            <option value="">Odaberi prodavnicu...</option>
            {PREDEFINED_STORES.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'end' }}>
          <div>
            <input type="file" accept=".xls,.xlsx" onChange={(e) => setImportFile(e.target.files?.[0] || null)} style={{ display: 'none' }} id="importFile" />
            <label htmlFor="importFile" style={{ ...btn, display: 'inline-block', cursor: 'pointer', marginBottom: 0 }}>
              Odaberi Excel fajl (Pantheon)
            </label>
            {importFile && <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>{importFile.name}</div>}
          </div>
          {importFile && (
            <button onClick={handleImport} disabled={importing || !storeName} style={{...btn, background: colors.brandYellow, color: '#000', fontWeight: 700}}>
              {importing ? 'Importuje...' : 'Importuj'}
            </button>
          )}
        </div>
        <input value={order_number} onChange={e=>setOrderNumber(e.target.value)} placeholder="Broj naloga (Pantheon)" style={input} />
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Napomena" style={{ ...input, height: 60 }} />
        <div>
          <div style={{ color: colors.brandYellow, fontWeight: 600, marginBottom: 8 }}>Artikli</div>
          {lines.map((ln, idx)=> (
            <div key={idx} style={{ marginBottom: 8, padding: 12, background: colors.bgBody, borderRadius: 6, border: `1px solid ${colors.borderDefault}` }}>
              <div style={{ marginBottom: 8, position: 'relative' }}>
                <input 
                  value={activeSearchIdx === idx ? activeSearchTerm : (ln.item_name ? `${ln.item_name} (${ln.item_sku})` : '')} 
                  onChange={e => {
                    setActiveSearchIdx(idx);
                    setActiveSearchTerm(e.target.value);
                  }}
                  onFocus={() => {
                    setActiveSearchIdx(idx);
                    if (!ln.item_name) {
                      setActiveSearchTerm('');
                    }
                  }}
                  placeholder="Pretraži artikal (naziv, SKU, barkod)" 
                  style={input} 
                />
                {activeSearchIdx === idx && filteredItemsForCurrentSearch.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: colors.bgPanel, border: `1px solid ${colors.borderStrong}`, borderRadius: 6, marginTop: 2, maxHeight: 200, overflow: 'auto' }}>
                    {filteredItemsForCurrentSearch.map((item: any) => (
                      <div 
                        key={item.id} 
                        onClick={() => handleItemSelect(item, idx)}
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${colors.borderDefault}` }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = colors.bgBody; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: colors.textSecondary }}>SKU: {item.sku} {item.barcode ? ` | Barcode: ${item.barcode}` : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap: 8 }}>
                <input value={ln.requested_qty} onChange={e=>{ const v=[...lines]; v[idx].requested_qty=Number(e.target.value)||''; setLines(v); }} placeholder="Količina" style={input} />
                <input value={ln.uom} onChange={e=>{ const v=[...lines]; v[idx].uom=e.target.value; setLines(v); }} placeholder="UOM" style={input} />
                <button onClick={()=>removeLine(idx)} style={btn}>Ukloni</button>
              </div>
            </div>
          ))}
          <button onClick={addLine} style={btn}>+ Dodaj artikal</button>
        </div>
        <div>
          <button onClick={submit} style={{...btn, background: colors.brandYellow, color: '#000', fontWeight: 700}}>Kreiraj nalog</button>
        </div>
      </div>
      {previewData && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <div style={modalHeader}>Pregled dokumenta · {previewData.order_number}</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8, fontSize:12, marginBottom:8 }}>
              <div><b>Primalac:</b> {previewData.customer_name || storeName || '-'}</div>
              <div><b>Iz­davalac:</b> {previewData.issuer_name || '-'}</div>
              <div><b>Datum:</b> {previewData.document_date || '-'}</div>
              <div><b>Odgovorna osoba:</b> {previewData.responsible_person || '-'}</div>
              <div><b>Broj stavki:</b> {(previewData.lines||[]).length}</div>
              <div><b>Ukupna količina:</b> {(previewData.lines||[]).reduce((s:number,l:any)=>s+Number(l.requested_qty||0),0)}</div>
            </div>
            <div style={{ color: colors.textSecondary, marginBottom: 8 }}>
              Detektovane kolone — Šifra: {previewData.detected_columns?.sku}, Naziv: {previewData.detected_columns?.name}, Količina: {previewData.detected_columns?.qty}, JMJ: {previewData.detected_columns?.uom}
            </div>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Šifra</th>
                  <th style={th}>Naziv</th>
                  <th style={th}>Količina</th>
                  <th style={th}>JMJ</th>
                </tr>
              </thead>
              <tbody>
                {(previewData.lines||[]).map((ln:any, idx:number)=> (
                  <tr key={idx}>
                    <td style={td}>{ln.item_sku}</td>
                    <td style={td}>{ln.item_name}</td>
                    <td style={td}>{ln.requested_qty}</td>
                    <td style={td}>{ln.uom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop: 12 }}>
              <button style={btn} onClick={()=>setPreviewData(null)}>Otkaži</button>
              <button style={btn} onClick={printPreviewPro}>Štampaj</button>
              <button style={{...btn, background: colors.brandYellow, color: '#000', fontWeight: 700}} onClick={confirmImport} disabled={importing}>
                {importing ? 'Snimam…' : 'Potvrdi i sačuvaj'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StagingZone() {
  const [rows, setRows] = useState<any[]>([]);
  const load = async ()=>{ try{ const d = await fetchActiveOrders(); setRows((d||[]).filter((x:any)=>x.status==='STAGED' || x.status==='LOADED')); }catch{} };
  useEffect(()=>{ load(); }, []);
  // (Removed cross‑component detail polling here; detail belongs to ActiveOrders.)
  return (
    <div>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Broj</th>
            <th style={th}>Kupac</th>
            <th style={th}>Status</th>
            <th style={th}>Akcije</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r:any, idx:number)=> (
            <tr key={idx}>
              <td style={td}>{r.order_number}</td>
              <td style={td}>{r.customer_name}</td>
              <td style={td}>{renderShippingStatusBadge(r.status)}</td>
              <td style={td}>
                <button style={btn} onClick={()=>loadOrder(r.id).then(load)}>UTOVARENO</button>
                <button style={btn} onClick={()=>closeOrder(r.id).then(load)}>ZATVORENO</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabBtn({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        border: 'none',
        background: active ? colors.brandYellow : 'rgba(255,255,255,0.08)',
        color: active ? '#111' : 'rgba(255,255,255,0.7)',
        borderRadius: 999,
        padding: '10px 18px',
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: active ? '0 12px 25px rgba(250,204,21,0.35)' : 'none',
        transition: 'all 0.2s ease',
      }}
    >
      {children}
    </button>
  );
}

function ProgressBar({ v }:{ v:number }) {
  return (
    <div style={{ width: 120, height: 8, background: colors.borderCard, borderRadius: 4 }}>
      <div style={{ width: `${v}%`, height:'100%', background: colors.brandYellow, borderRadius: 4 }} />
    </div>
  );
}


const table = { width:'100%', borderCollapse:'collapse', background: colors.bgBody, color: colors.textPrimary, fontSize: 13 } as const;
const th = { textAlign:'left', padding:'8px', borderBottom:`1px solid ${colors.borderDefault}`, color: colors.brandYellow, fontSize: 13 } as const;
const td = { padding:'8px', borderBottom:`1px solid ${colors.borderCard}`, fontSize: 13 } as const;
const btn = { background: colors.bgPanel, border:`1px solid ${colors.borderDefault}`, color: colors.brandYellow, padding:'6px 10px', borderRadius:6, cursor:'pointer', fontSize: 12 } as const;
const input = { padding:'8px 10px', border:`1px solid ${colors.borderDefault}`, borderRadius:6, background: colors.bgBody, color: colors.textPrimary } as const;
const shippingModalStyles = {
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.65)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  wrapper: {
    backgroundColor: '#101215',
    borderRadius: 16,
    width: '95%',
    maxWidth: 1440,
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 24px 72px rgba(0,0,0,0.45)',
  },
  header: {
    padding: '20px 24px',
    background: 'linear-gradient(90deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.95) 100%)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  actionGhostButton: {
    background: 'transparent',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.2)',
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  closeButton: {
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.2)',
    width: 36,
    height: 36,
    borderRadius: '50%',
    fontSize: 20,
    fontWeight: 700,
    cursor: 'pointer',
  },
  body: {
    display: 'grid',
    gridTemplateColumns: '360px minmax(0, 1fr)',
    gap: 24,
    padding: 24,
    overflow: 'auto',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  sectionCard: {
    background: 'rgba(15,23,42,0.7)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '16px 18px',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
    color: colors.brandYellow,
  },
  sectionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    fontSize: 13,
    color: colors.textSecondary,
    flexWrap: 'wrap' as const,
  },
  sectionDivider: {
    height: 1,
    background: 'rgba(255,255,255,0.08)',
    margin: '4px 0',
  },
  sectionStatGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 10,
    width: '100%',
  },
  sectionStatCard: {
    background: 'rgba(15,23,42,0.5)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  sectionStatLabel: {
    fontSize: 11,
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
    color: colors.textSecondary,
  },
  sectionStatValue: {
    fontSize: 14,
    fontWeight: 600,
    color: '#f8fafc',
  },
  sectionStatValueHighlight: {
    fontSize: 16,
    fontWeight: 700,
    color: colors.brandYellow,
  },
  sectionBadgeWarn: {
    marginTop: 6,
    padding: '6px 10px',
    borderRadius: 8,
    background: 'rgba(251, 191, 36, 0.18)',
    border: '1px solid rgba(251, 191, 36, 0.35)',
    color: colors.statusWarn,
    fontSize: 12,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  sectionStatusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.25)',
    background: 'transparent',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: '0.5px',
    minWidth: 90,
    textAlign: 'center' as const,
  },
  notesBox: {
    background: 'rgba(148,163,184,0.12)',
    border: '1px solid rgba(148,163,184,0.28)',
    borderRadius: 10,
    padding: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressValue: {
    height: '100%',
    background: 'linear-gradient(90deg, #4ade80, #22c55e)',
    borderRadius: 999,
  },
  progressMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    color: colors.textSecondary,
  },
  assignRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  input: {
    flex: 1,
    padding: '8px 10px',
    border: '1px solid rgba(148,163,184,0.4)',
    borderRadius: 8,
    background: '#0f172a',
    color: '#f8fafc',
    minWidth: 0,
  },
  primaryActionButton: {
    background: '#ffc107',
    color: '#000',
    border: 'none',
    padding: '8px 14px',
    borderRadius: 8,
    fontWeight: 600,
    cursor: 'pointer',
  },
  actionsStack: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  ghostActionButton: {
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.12)',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
  dangerActionButton: {
    background: '#ff4d4f',
    color: '#fff',
    border: '1px solid #ff4d4f',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
  contentArea: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 20,
  },
  contentCard: {
    background: 'rgba(15,23,42,0.65)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 18,
    color: '#fff',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  contentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  tableWrapper: {
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 10,
    overflow: 'hidden',
    maxHeight: '55vh',
    overflowY: 'auto' as const,
  },
  itemsTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 13,
  },
  tableHeadCell: {
    padding: '10px 12px',
    textAlign: 'left' as const,
    background: 'rgba(15,23,42,0.9)',
    color: colors.brandYellow,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    position: 'sticky' as const,
    top: 0,
    zIndex: 1,
  },
  tableCell: {
    padding: '10px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    color: '#f1f5f9',
    fontSize: 13,
  },
  smallDangerButton: {
    background: '#ff4d4f',
    color: '#fff',
    border: 'none',
    padding: '6px 10px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
};

const modalOverlay = { position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 } as const;
const modalContent = { background: colors.bgPanel, border:`1px solid ${colors.borderStrong}`, borderRadius:8, padding: 16, width:'90%', maxWidth: 700 } as const;
const modalHeader = { color: colors.brandYellow, fontWeight: 700, marginBottom: 8 } as const;
