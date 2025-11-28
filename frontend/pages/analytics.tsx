import React, { useEffect, useMemo, useState } from 'react';
import { MainLayout } from "../src/components/layout/MainLayout";
import { apiClient } from "../lib/apiClient";
import { colors } from "../src/theme/colors";

export default function AnalyticsPage() {
  // Use UTC dates to prevent hydration mismatch
  const getCurrentMonth = () => {
    const now = new Date();
    return now.getUTCMonth() + 1;
  };
  const getCurrentYear = () => {
    const now = new Date();
    return now.getUTCFullYear();
  };
  
  const [month, setMonth] = useState<number>(0); // Initialize to 0, will be set in useEffect
  const [year, setYear] = useState<number>(0); // Initialize to 0, will be set in useEffect
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState<boolean>(false);
  const [everySec, setEverySec] = useState<number>(30);
  const [nextTick, setNextTick] = useState<number>(everySec);
  const [facts, setFacts] = useState<any[]>([]);
  const [factsLoading, setFactsLoading] = useState<boolean>(false);
  const [factsLimit, setFactsLimit] = useState<number>(50);
  const [pushStatus, setPushStatus] = useState<{push_url_configured:boolean; last_push_at?:string; last_error?:string} | null>(null);
  const [filterType, setFilterType] = useState<'ALL'|'RECEIVING'|'SHIPPING'|'SKART'|'POVRACAJ'>('ALL');
  const [filterUserId, setFilterUserId] = useState<number|''>('');
  const [filterTeamId, setFilterTeamId] = useState<number|''>('');
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [teamsRank, setTeamsRank] = useState<any[]>([]);
  const [showGrafana, setShowGrafana] = useState<boolean>(false);
  const [activeGrafanaDashboard, setActiveGrafanaDashboard] = useState<string>('worker-productivity');

  // Initialize month/year after mount to prevent hydration mismatch
  useEffect(() => {
    setMonth(getCurrentMonth());
    setYear(getCurrentYear());
    setMounted(true);
  }, []);

  const range = useMemo(() => {
    if (!mounted || month === 0 || year === 0) {
      // Return a safe default during SSR and initial render
      const now = new Date();
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth() + 1;
      const from = new Date(Date.UTC(y, m - 1, 1));
      const to = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
      return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
    }
    // Use UTC dates consistently
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const f = from.toISOString().slice(0, 10);
    const t = to.toISOString().slice(0, 10);
    return { from: f, to: t };
  }, [month, year, mounted]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get(`/workforce/analytics/summary?from=${range.from}&to=${range.to}`);
      setRows(Array.isArray(data)?data:[]);
    } catch (e) {
      setRows([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [range.from, range.to]);

  // Auto-refresh logic with simple countdown
  useEffect(() => {
    if (!auto) return;
    setNextTick(everySec);
    const t = setInterval(() => {
      setNextTick((n) => {
        if (n <= 1) {
          load();
          loadFacts();
          loadPushStatus();
          return everySec;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [auto, everySec, range.from, range.to]);

  const loadFacts = async () => {
    setFactsLoading(true);
    try {
      const data = await apiClient.get(`/workforce/analytics/facts?from=${range.from}&to=${range.to}`);
      const arr = Array.isArray(data)?data:[];
      // Sort by completed_at DESC, then started_at
      arr.sort((a:any,b:any)=> new Date(b.completed_at||b.started_at||0).getTime() - new Date(a.completed_at||a.started_at||0).getTime());
      setFacts(arr.slice(0, Math.max(1, Math.min(1000, factsLimit))));
    } catch (e) {
      setFacts([]);
    } finally { setFactsLoading(false); }
  };

  useEffect(()=>{ loadFacts(); }, [range.from, range.to, factsLimit]);

  const loadPushStatus = async () => {
    try {
      const s = await apiClient.get('/workforce/analytics/status');
      if (s && s.last_push_at) s.last_push_at = new Date(s.last_push_at).toLocaleString();
      setPushStatus(s);
    } catch { setPushStatus(null); }
  };
  useEffect(()=>{ loadPushStatus(); }, []);
  useEffect(() => { (async()=>{ try{ const u = await apiClient.get('/users'); setUsers(Array.isArray(u)?u:[]);} catch{} })(); }, []);
  useEffect(() => { (async()=>{ try{ const t = await apiClient.get('/teams'); setTeams(Array.isArray(t)?t:[]);} catch{} })(); }, []);
  useEffect(() => { (async()=>{ try{ const r = await apiClient.get(`/workforce/analytics/teams?from=${range.from}&to=${range.to}`); setTeamsRank(Array.isArray(r)?r:[]);} catch{} })(); }, [range.from, range.to]);

  const toCSV = () => {
    const header = ['user_id','user_name','RECEIVING','SHIPPING','SKART','POVRACAJ','TOTAL'];
    // Apply team filter to summary: include only users in selected team
    const memberIds = new Set<number>(
      (teams.find((t:any)=> t.id === filterTeamId)?.members || []).map((m:any)=> m.user_id)
    );
    const rowsFiltered = rows.filter((r:any)=> filterTeamId ? memberIds.has(r.user_id) : true);
    const typed = rowsFiltered.map((r:any) => {
      if (filterType === 'ALL') return r;
      const v = { ...r } as any;
      const keep = v[filterType] || 0;
      v.RECEIVING = filterType==='RECEIVING'? keep : 0;
      v.SHIPPING  = filterType==='SHIPPING' ? keep : 0;
      v.SKART = filterType==='SKART' ? keep : 0;
      v.POVRACAJ = filterType==='POVRACAJ' ? keep : 0;
      v.TOTAL = keep;
      return v;
    });
    const lines = [header.join(',')].concat(typed.map((r:any)=> [r.user_id, csv(r.user_name), r.RECEIVING||0, r.SHIPPING||0, r.SKART||0, r.POVRACAJ||0, r.TOTAL||0].join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `analytics_${year}-${String(month).padStart(2,'0')}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const downloadFactsCSV = async () => {
    const data = await apiClient.get(`/workforce/analytics/facts?from=${range.from}&to=${range.to}`);
    const header = ['assignee_id','task_type','task_id','user_id','user_name','started_at','completed_at','policy','team_id','document_number','order_number','pallet_id'];
    let arr = Array.isArray(data)?data:[];
    // Apply filters
    if (filterType !== 'ALL') arr = arr.filter((r:any)=> r.task_type === filterType);
    if (filterUserId) arr = arr.filter((r:any)=> Number(r.user_id) === Number(filterUserId));
    if (filterTeamId) arr = arr.filter((r:any)=> Number(r.team_id) === Number(filterTeamId));
    const lines = [header.join(',')].concat(arr.map((r:any) => [
      r.assignee_id,
      r.task_type,
      r.task_id,
      r.user_id,
      csv(r.user_name),
      r.started_at ? new Date(r.started_at).toISOString() : '',
      r.completed_at ? new Date(r.completed_at).toISOString() : '',
      r.policy || '',
      r.team_id || '',
      csv(r.document_number || ''),
      csv(r.order_number || ''),
      csv(r.pallet_id || '')
    ].join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `analytics_facts_${year}-${String(month).padStart(2,'0')}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const downloadTeamsCSV = () => {
    const header = ['team_id','team_name','members','assigned','completed','percent','items_total','items_completed','items_percent'];
    const lines = [header.join(',')].concat(teamsRank.map((t:any)=> [
      t.team_id,
      csv(t.team_name),
      csv((t.members||[]).join(' / ')),
      t.assigned,
      t.completed,
      t.percent,
      t.items_total,
      t.items_completed,
      t.items_percent,
    ].join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `teams_${year}-${String(month).padStart(2,'0')}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const printSummary = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8" />
    <title>Analitika ${year}-${String(month).padStart(2,'0')}</title>
    <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial;padding:16px;}h1{font-size:18px;margin:0 0 8px;}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f5f5f5}</style></head>
    <body><h1>Analitika ${year}-${String(month).padStart(2,'0')}</h1>
    <div style="margin:4px 0 10px;color:#555">Period: ${range.from} → ${range.to}</div>
    <table><thead><tr><th>Radnik</th><th>Prijem</th><th>Otprema</th><th>SKART</th><th>Povraćaj</th><th>Ukupno</th></tr></thead>
    <tbody>${rows.map(r=>`<tr><td>${escapeHtml(r.user_name||'')}</td><td>${r.RECEIVING||0}</td><td>${r.SHIPPING||0}</td><td>${r.SKART||0}</td><td>${r.POVRACAJ||0}</td><td><b>${r.TOTAL||0}</b></td></tr>`).join('')}</tbody></table>
    </body></html>`;
    const w = window.open('', '_blank'); if (!w) return; w.document.write(html); w.document.close(); w.focus(); w.print(); setTimeout(()=>{ try{ w.close(); }catch{} }, 500);
  };

  return (
    <MainLayout breadcrumb={["Analitika"]}>
      <div
        style={{
          background: "linear-gradient(180deg,#05070d 0%,#020304 100%)",
          minHeight: "100%",
          padding: "2rem clamp(1.5rem,2vw,3rem)",
          boxSizing: "border-box",
          color: "#f8fafc",
        }}
      >
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
            Analitika
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
            Detaljna analiza performansi radnika i timova, sa kompletnim pregledom aktivnosti i metrika.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
            <StatusChip label="Push URL" value={pushStatus?.push_url_configured ? 'Postavljen' : 'Nije postavljen'} status={pushStatus?.push_url_configured ? 'ok' : 'error'} />
            <StatusChip label="Poslednji push" value={pushStatus?.last_push_at || '—'} />
            <StatusChip label="Period" value={`${range.from} → ${range.to}`} />
          </div>
        </div>

        {/* Grafana Dashboards Section */}
        <div style={{ background:'rgba(15,23,42,0.75)', border:'1px solid rgba(148,163,184,0.25)', borderRadius:16, padding:20, marginBottom: 20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:12 }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 4px', color: '#fbbf24' }}>Grafana Dashboard Analitika</h2>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>Real-time vizualizacije i metrike u stvarnom vremenu</p>
            </div>
            <button onClick={()=>setShowGrafana(!showGrafana)} style={{...btn, fontSize: '1rem', padding: '10px 20px'}}>
              {showGrafana ? '▼ Sakrij dashboard' : '▶ Prikaži dashboard'}
            </button>
          </div>
          
          {showGrafana && (
            <>
              {/* Dashboard tabs */}
              <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
                <button 
                  onClick={()=>setActiveGrafanaDashboard('worker-productivity')}
                  style={{...btn, background: activeGrafanaDashboard === 'worker-productivity' ? 'rgba(250,204,21,0.25)' : 'rgba(250,204,21,0.1)'}}
                >
                  Produktivnost Radnika
                </button>
                <button 
                  onClick={()=>setActiveGrafanaDashboard('receiving-operations')}
                  style={{...btn, background: activeGrafanaDashboard === 'receiving-operations' ? 'rgba(250,204,21,0.25)' : 'rgba(250,204,21,0.1)'}}
                >
                  Operacije Prijema
                </button>
                <button 
                  onClick={()=>setActiveGrafanaDashboard('shipping-dispatch')}
                  style={{...btn, background: activeGrafanaDashboard === 'shipping-dispatch' ? 'rgba(250,204,21,0.25)' : 'rgba(250,204,21,0.1)'}}
                >
                  Otprema / Dispatch
                </button>
              </div>

              {/* Grafana iframe */}
              <div style={{ position:'relative', width:'100%', height:'800px', background:'rgba(0,0,0,0.3)', borderRadius:12, overflow:'hidden', border:'1px solid rgba(148,163,184,0.2)' }}>
                <iframe
                  src={`https://admin.cungu.com/grafana/d/${activeGrafanaDashboard}?orgId=1&from=now-7d&to=now&timezone=Europe%2FPodgorica&refresh=30s&kiosk=tv`}
                  width="100%"
                  height="100%"
                  style={{ border:'none' }}
                  title="Grafana Dashboard"
                  allowFullScreen
                />
              </div>
              
              <div style={{ marginTop:12, padding:'12px 16px', background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:8 }}>
                <div style={{ fontSize:'0.85rem', color:'#93c5fd', marginBottom:4 }}>💡 <strong>Saveti:</strong></div>
                <ul style={{ margin:0, paddingLeft:20, fontSize:'0.85rem', color:'rgba(255,255,255,0.7)' }}>
                  <li>Dashboards se automatski osvježavaju svakih 30 sekundi</li>
                  <li>Kliknite na grafiku da vidite više detalja</li>
                  <li>Koristite time range kontrole za promenu perioda (gore desno)</li>
                  <li>Dashboard je u TV režimu - optimizovan za prikaz bez interakcije</li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Health panel */}
        <div style={{ background: 'rgba(15,23,42,0.75)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontWeight:700, color: colors.textPrimary }}>Analytics zdravlje</span>
            </div>
            <div>
              <button onClick={()=>{ load(); loadFacts(); loadPushStatus(); }} style={btn}>Osvježi sve</button>
            </div>
          </div>
          {pushStatus?.last_error && (
            <div style={{ color:'#ffb4b4', marginBottom:8, padding: '10px 14px', background: 'rgba(220,38,38,0.1)', borderRadius: 8, border: '1px solid rgba(220,38,38,0.3)' }}>Greška zadnjeg push‑a: {pushStatus.last_error}</div>
          )}
        </div>
        <div style={{ background: 'rgba(15,23,42,0.75)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom: 12, flexWrap:'wrap' }}>
          <select value={month} onChange={e=>setMonth(Number(e.target.value))}>
            {Array.from({length:12}).map((_,i)=> <option key={i+1} value={i+1}>{i+1}</option>)}
          </select>
          <input type="number" value={year} onChange={e=>setYear(Number(e.target.value)||new Date().getFullYear())} style={{ width:100 }} />
          <button onClick={load} style={btn}>Osvježi</button>
          <button onClick={toCSV} style={btn}>Preuzmi CSV (sažetak)</button>
          <button onClick={downloadFactsCSV} style={btn}>Preuzmi CSV (detalji)</button>
          <button onClick={printSummary} style={btn}>Štampaj</button>
          <span style={{ color:'#9ca3af' }}>Period: {range.from} → {range.to}</span>
          {/* CSV Filters */}
          <span style={{ marginLeft:16, color:'#9ca3af' }}>Filteri:</span>
          <select value={filterType} onChange={e=>setFilterType(e.target.value as any)}>
            <option value='ALL'>Sve vrste</option>
            <option value='RECEIVING'>Prijem</option>
            <option value='SHIPPING'>Otprema</option>
            <option value='SKART'>SKART</option>
            <option value='POVRACAJ'>Povraćaj</option>
          </select>
          <select value={filterUserId} onChange={e=>setFilterUserId(e.target.value ? Number(e.target.value) : '')}>
            <option value=''>Svi korisnici</option>
            {users.map((u:any)=> <option key={u.id} value={u.id}>{u.full_name || u.name || u.username}</option>)}
          </select>
          <select value={filterTeamId} onChange={e=>setFilterTeamId(e.target.value ? Number(e.target.value) : '')}>
            <option value=''>Svi timovi</option>
            {teams.map((t:any)=> <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <label style={{ marginLeft:16 }}>
            <input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)} /> Auto-refresh
          </label>
          <span style={{ color:'#9ca3af' }}>svakih</span>
          <input type="number" min={5} max={600} value={everySec} onChange={(e)=>setEverySec(Math.max(5, Math.min(600, Number(e.target.value)||30)))} style={{ width:64 }} />
          <span style={{ color:'#9ca3af' }}>sek · sledeće za {auto ? nextTick : '-'}s</span>
        </div>
          {loading ? <div style={{ color: colors.textPrimary, padding: 20 }}>Učitavanje…</div> : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Radnik</th>
                  <th style={th}>Prijem</th>
                  <th style={th}>Otprema</th>
                  <th style={th}>SKART</th>
                  <th style={th}>Povraćaj</th>
                  <th style={th}>Ukupno</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r:any, i:number)=> (
                  <tr key={r.user_id} style={{ background: i % 2 === 0 ? 'rgba(255,212,0,0.04)' : 'transparent' }}>
                    <td style={td}>{r.user_name}</td>
                    <td style={td}>{r.RECEIVING||0}</td>
                    <td style={td}>{r.SHIPPING||0}</td>
                    <td style={td}>{r.SKART||0}</td>
                    <td style={td}>{r.POVRACAJ||0}</td>
                    <td style={td}><b>{r.TOTAL||0}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent facts */}
        <div style={{ background:'rgba(15,23,42,0.75)', border:'1px solid rgba(148,163,184,0.25)', borderRadius:16, padding:20, marginBottom: 20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ fontWeight:700 }}>Poslednji događaji (facts)</div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ color:'#9ca3af' }}>Prikaži</span>
            <input type="number" min={10} max={1000} value={factsLimit} onChange={(e)=>setFactsLimit(Math.max(10, Math.min(1000, Number(e.target.value)||50)))} style={{ width:80 }} />
            <span style={{ color:'#9ca3af' }}>redova</span>
            <button onClick={loadFacts} style={btn}>Osvježi</button>
          </div>
        </div>
          {factsLoading ? <div style={{ color: colors.textPrimary, padding: 20 }}>Učitavanje…</div> : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Vreme</th>
                  <th style={th}>Tip</th>
                  <th style={th}>Task ID</th>
                  <th style={th}>Korisnik</th>
                  <th style={th}>Status</th>
                  <th style={th}>Dok/Nalog/Paleta</th>
                  <th style={th}>Trajanje (s)</th>
                </tr>
              </thead>
              <tbody>
                {facts.map((r:any, i:number)=> {
                  const when = r.completed_at || r.started_at;
                  const ref = r.document_number || r.order_number || r.pallet_id || '';
                  const dur = r.started_at && r.completed_at ? Math.max(0, Math.floor((new Date(r.completed_at).getTime() - new Date(r.started_at).getTime())/1000)) : '';
                  return (
                    <tr key={`${r.assignee_id}-${i}`} style={{ background: i % 2 === 0 ? 'rgba(255,212,0,0.04)' : 'transparent' }}>
                      <td style={td}>{when ? new Date(when).toLocaleString() : '—'}</td>
                      <td style={td}>{r.task_type}</td>
                      <td style={td}>{r.task_id}</td>
                      <td style={td}>{r.user_name}</td>
                      <td style={td}>{r.status || 'DONE'}</td>
                      <td style={td}>{ref}</td>
                      <td style={td}>{dur}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Teams ranking */}
        <div style={{ background:'rgba(15,23,42,0.75)', border:'1px solid rgba(148,163,184,0.25)', borderRadius:16, padding:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ fontWeight:700 }}>Teams ranking</div>
          <button style={btn} onClick={downloadTeamsCSV}>CSV</button>
        </div>
          {teamsRank.length === 0 ? (
            <div style={{ color: colors.textSecondary, padding: 20, textAlign: 'center' }}>— Nema podataka —</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>Tim</th>
                  <th style={th}>Članovi</th>
                  <th style={th}>Zadataka</th>
                  <th style={th}>Završeno</th>
                  <th style={th}>%</th>
                  <th style={th}>Stavki</th>
                  <th style={th}>Završenih stavki</th>
                  <th style={th}>% stavki</th>
                </tr>
              </thead>
              <tbody>
                {teamsRank.map((t:any, i:number)=> (
                  <tr key={t.team_id} style={{ background: i % 2 === 0 ? 'rgba(255,212,0,0.04)' : 'transparent' }}>
                    <td style={td}>{i+1}</td>
                    <td style={td}>{t.team_name}</td>
                    <td style={td}>{(t.members||[]).join(', ')}</td>
                    <td style={td}>{t.assigned}</td>
                    <td style={td}>{t.completed}</td>
                    <td style={td}>{t.percent}%</td>
                    <td style={td}>{t.items_total}</td>
                    <td style={td}>{t.items_completed}</td>
                    <td style={td}>{t.items_percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

// StatusChip component for hero section
function StatusChip({ label, value, status }: { label: string; value: string; status?: 'ok' | 'error' | 'warn' }) {
  const bg = status === 'ok' ? 'rgba(40,167,69,0.15)' : status === 'error' ? 'rgba(220,53,69,0.15)' : 'rgba(148,163,184,0.15)';
  const border = status === 'ok' ? 'rgba(40,167,69,0.4)' : status === 'error' ? 'rgba(220,53,69,0.4)' : 'rgba(148,163,184,0.4)';
  const text = status === 'ok' ? '#4ade80' : status === 'error' ? '#f87171' : 'rgba(255,255,255,0.7)';
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 999, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: text }}>{value}</span>
    </div>
  );
}

function csv(v:any){
  if (v==null) return '';
  const s = String(v).replace(/"/g,'""');
  return `"${s}"`;
}

const th = { textAlign: 'left' as const, padding: '12px 16px', borderBottom: '2px solid rgba(148,163,184,0.3)', color: '#cbd5e1', fontSize: 13, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px' } as const;
const td = { padding: '12px 16px', borderBottom: '1px solid rgba(148,163,184,0.15)', color: '#e2e8f0', fontSize: 14 } as const;
const btn = { background:'rgba(250,204,21,0.1)', color:'#fde68a', border:'1px solid rgba(250,204,21,0.35)', padding:'8px 16px', borderRadius:12, cursor:'pointer', fontWeight:600, transition:'all 0.2s' } as const;
function escapeHtml(s:any){ return String(s||'').replace(/[&<>]/g, (c)=> ({'&':'&amp;','<':'&lt;','>':'&gt;'} as any)[c]); }
