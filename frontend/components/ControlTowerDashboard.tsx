import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

export default function ControlTowerDashboard(){
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|undefined>();

  const load = async ()=>{
    try { setLoading(true); const d = await apiClient.get('/dashboard/overview'); setData(d); setError(undefined); }
    catch(e:any){ setError(e?.message||'Greška pri učitavanju'); }
    finally { setLoading(false); }
  };
  useEffect(()=>{ load(); const t = setInterval(load, 15000); return ()=>clearInterval(t); },[]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>PREGLED</h3>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => { window.dispatchEvent(new CustomEvent('dash:navigate',{ detail:{ tab:'PRIJEM' } })); window.dispatchEvent(new CustomEvent('prijem:setSub',{ detail:{ tab:'Aktivni prijemi' } })); }} style={btn}>Aktivni prijemi</button>
          <button onClick={load} style={btn}>Osveži sad</button>
        </div>
      </div>
      {error && <div style={{ color:'#dc2626', marginBottom: 8 }}>{error}</div>}
      {loading && !data ? <div>Učitavanje…</div> : (
        <div style={grid}>
          <Card title="PRIJEMI DANAS">
            <Metric label="Ukupno danas" value={data?.receivingSummary?.total_today||0} />
            <div style={{ display:'flex', gap:12 }}>
              <Metric label="U toku" value={data?.receivingSummary?.in_progress||0} />
              <Metric label="Na čekanju" value={data?.receivingSummary?.on_hold||0} />
            </div>
            <Metric label="Završeno danas" value={data?.receivingSummary?.completed_today||0} />
            <Metric label="Prosek trajanja (min)" value={data?.receivingSummary?.avg_close_time_min||0} />
            <SmallLinkButton onClick={(e:any)=>{ window.dispatchEvent(new CustomEvent('dash:navigate',{ detail:{ tab:'PRIJEM' } })); }}>Prikaži aktivne prijeme</SmallLinkButton>
          </Card>

          <Card title="RADNA SNAGA">
            <div style={{ marginBottom: 6 }}>Radnika prisutno: {data?.workforceSummary?.online_now||0} / {data?.workforceSummary?.total_workers||0}</div>
            {(data?.workforceSummary?.by_shift||[]).map((r:any,idx:number)=>(
              <div key={idx} style={{ color:'#e5e7eb' }}>{r.shift_type}: {r.count} (busy {r.busy})</div>
            ))}
            <div style={{ marginTop: 6, fontWeight:600, color:'#e5e7eb' }}>Najopterećeniji</div>
            <div>
              {(data?.workforceSummary?.top_busy_workers||[]).slice(0,3).map((w:any, idx:number)=>(
                <div key={idx} style={{ display:'flex', justifyContent:'space-between', color:'#f9fafb' }}>
                  <span>{w.full_name}</span>
                  <span style={{ color:'#fde047' }}>R:{w.open_receivings} / P:{w.open_cycle_counts}</span>
                  <span style={{ color:'#9ca3af' }}>{w.last_activity_min_ago ?? '-'} min</span>
                </div>
              ))}
            </div>
            <SmallLinkButton onClick={(e:any)=>{ window.dispatchEvent(new CustomEvent('dash:navigate',{ detail:{ tab:'RADNA SNAGA' } })); }}>Upravljaj radnom snagom</SmallLinkButton>
          </Card>

          <Card title="ZALIHE / RIZICI">
            <Metric label="Ukupno artikala" value={data?.inventorySummary?.total_sku||0} />
            <Metric label="Ukupna količina" value={data?.inventorySummary?.total_qty||0} />
            <div style={{ marginTop:6, color:'#f9fafb' }}>Rizične lokacije:</div>
            <div style={{ color:'#e5e7eb' }}>Preopterećene: {data?.inventorySummary?.hotspots?.over_capacity||0}</div>
            <div style={{ color:'#e5e7eb' }}>Negativno stanje: {data?.inventorySummary?.hotspots?.negative_stock||0}</div>
            <div style={{ color:'#e5e7eb' }}>Konflikti: {data?.inventorySummary?.hotspots?.recent_conflicts||0}</div>
            <SmallLinkButton onClick={(e:any)=>{ window.dispatchEvent(new CustomEvent('dash:navigate',{ detail:{ tab:'ZALIHE' } })); }}>Otvori Zalihe</SmallLinkButton>
          </Card>

          <Card title="POPIS / TAČNOST">
            <div style={{ display:'flex', gap:12 }}>
              <Metric label="Otvoreni" value={data?.cycleCountSummary?.open_tasks||0} />
              <Metric label="U toku" value={data?.cycleCountSummary?.in_progress||0} />
            </div>
            <div style={{ display:'flex', gap:12 }}>
              <Metric label="Čeka knjiženje" value={data?.cycleCountSummary?.waiting_reconcile||0} />
              <Metric label="Reconciled danas" value={data?.cycleCountSummary?.reconciled_today||0} />
            </div>
            <Metric label="Procena tačnosti (%)" value={data?.cycleCountSummary?.accuracy_estimate_pct ?? 100} highlight={true} />
            <SmallLinkButton onClick={(e:any)=>{ window.dispatchEvent(new CustomEvent('dash:navigate',{ detail:{ tab:'ZALIHE' } })); setTimeout(()=>{ window.dispatchEvent(new CustomEvent('stock:setTab',{ detail:{ tab:'popis' } })); }, 0); }}>Upravljaj popisom</SmallLinkButton>
          </Card>
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: any){
  return (
    <div style={{ background:'#111827', border:'1px solid #1f2937', borderRadius:12, padding: 16 }}>
      <div style={{ fontWeight:700, color:'#f9fafb', marginBottom: 8 }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: number; highlight?: boolean }){
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ color:'#9ca3af', fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight:800, fontSize: 22, color: highlight?'#fde047':'#f9fafb' }}>{value}</div>
    </div>
  );
}

function SmallLinkButton({ onClick, children }:{ onClick: (e:any)=>void; children:any }){
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background:'transparent', border:'none', color:'#fde047', textDecoration:'underline', fontSize:12, cursor:'pointer' }}
    >
      {children}
    </button>
  );
}

const grid = { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 } as const;
const btn = { background:'#f3f4f6', border:'1px solid #e5e7eb', padding:'6px 10px', borderRadius:6, cursor:'pointer' } as const;
