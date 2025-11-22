import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from "../src/components/layout/MainLayout";
import { apiClient } from "../lib/apiClient";
import { colors } from "../src/theme/colors";
import { TeamAssignModal } from "../src/components/TeamAssignModal";

type Team = { id: number; name: string; members: { id:number; team_id:number; user_id:number; }[] };
type User = { id:number; full_name?:string; name?:string; username:string; role:string };

export default function TeamsPage(){
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [capacityInfo, setCapacityInfo] = useState<Record<number, number>>({});
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [rank, setRank] = useState<any[]>([]);
  const [recActiveCount, setRecActiveCount] = useState<number>(0);
  const [shipActiveCount, setShipActiveCount] = useState<number>(0);
  const [assignOpen, setAssignOpen] = useState<boolean>(false);
  const [assignType, setAssignType] = useState<'RECEIVING'|'SHIPPING'>('RECEIVING');
  const [assignTeamId, setAssignTeamId] = useState<number|undefined>(undefined);
  const [assignList, setAssignList] = useState<any[]>([]);
  const [assignSelectedId, setAssignSelectedId] = useState<number|undefined>(undefined);
  const [assignSaving, setAssignSaving] = useState<boolean>(false);
  const downloadTeamsCSV = () => {
    const header = ['team_id','team_name','members','assigned','completed','percent','items_total','items_completed','items_percent','refresh_period'];
    const period = `${from||''}->${to||''}`;
    const lines = [header.join(',')].concat(rank.map((t:any)=> [
      t.team_id,
      csv(t.team_name||t.team),
      csv((t.members||[]).join(' / ')),
      t.assigned,
      t.completed,
      t.percent,
      t.items_total,
      t.items_completed,
      t.items_percent,
      csv(period),
    ].join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='teams_ranking.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|undefined>();

  const load = async () => {
    try {
      setLoading(true);
      const [t, u] = await Promise.all([
        apiClient.get('/teams'),
        apiClient.get('/users')
      ]);
      setTeams(Array.isArray(t)?t:[]);
      // samo magacioneri prikaz
      const onlyWorkers = (Array.isArray(u)?u:[]).filter((x:any)=> String(x.role||'').toLowerCase()==='magacioner');
      setUsers(onlyWorkers);
      setError(undefined);
    } catch(e:any){ setError(e?.message||'Greška pri učitavanju'); } finally { setLoading(false);}    
  };

  const loadRank = async () => {
    try {
      const qs = (from || to) ? `?from=${from||''}&to=${to||''}` : '';
      const r = await apiClient.get(`/workforce/analytics/teams${qs}`);
      setRank(Array.isArray(r) ? r : []);
    } catch { setRank([]); }
  };

  useEffect(()=>{ load(); },[]);
  useEffect(()=>{ loadRank(); }, [from, to]);
  useEffect(()=>{ (async()=>{
    try {
      const [r, s] = await Promise.all([
        apiClient.get('/receiving/active').catch(()=>[]),
        apiClient.get('/shipping/active').catch(()=>[]),
      ]);
      setRecActiveCount(Array.isArray(r)? r.length : 0);
      setShipActiveCount(Array.isArray(s)? s.length : 0);
    } catch { setRecActiveCount(0); setShipActiveCount(0); }
  })(); }, []);

  const openTeamAssign = async (teamId:number, type:'RECEIVING'|'SHIPPING') => {
    setAssignType(type); setAssignTeamId(teamId); setAssignOpen(true); setAssignSelectedId(undefined);
    try {
      const list = await apiClient.get(type==='RECEIVING' ? '/receiving/active' : '/shipping/active');
      setAssignList(Array.isArray(list)? list : []);
    } catch { setAssignList([]); }
  };
  const submitTeamAssign = async () => {
    if (!assignTeamId || !assignSelectedId) return;
    setAssignSaving(true);
    try {
      await apiClient.post('/workforce/assign-task', { type: assignType, task_id: assignSelectedId, team_id: assignTeamId, policy: 'ANY_DONE' });
      setAssignOpen(false);
      await Promise.all([loadRank()]);
    } catch (e:any) { alert(e?.message||'Greška'); } finally { setAssignSaving(false); }
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    try { await apiClient.post('/teams', { name: newTeamName.trim() }); setNewTeamName(""); load(); } catch(e:any){ alert(e?.message||'Greška'); }
  };

  const addMember = async (team:Team, userId:number, move=false) => {
    if ((team.members||[]).length >= 2) { alert('Tim već ima 2 člana.'); return; }
    try {
      const res = await apiClient.post(`/teams/${team.id}/members`, { user_ids:[userId], move });
      if (res && typeof res.capacity_remaining === 'number') {
        setCapacityInfo(prev => ({ ...prev, [team.id]: res.capacity_remaining }));
      }
      load();
    } catch(e:any){
      const msg = e?.message || '';
      if (/Dodajte sa move=true|već članovi drugih timova/i.test(msg)) {
        if (confirm('Korisnik je već u drugom timu. Premjestiti ga u tim '+team.name+'?')) {
          try {
            const res2 = await apiClient.post(`/teams/${team.id}/members`, { user_ids:[userId], move: true });
            if (res2 && typeof res2.capacity_remaining === 'number') {
              setCapacityInfo(prev => ({ ...prev, [team.id]: res2.capacity_remaining }));
            }
            load();
            return;
          } catch(e2:any){ alert(e2?.message||'Greška'); }
        }
      } else {
        alert(msg || 'Greška');
      }
    }
  };

  const removeMember = async (team:Team, userId:number) => {
    try { await apiClient.delete(`/teams/${team.id}/members/${userId}`); load(); } catch(e:any){ alert(e?.message||'Greška'); }
  };

  const renameTeam = async (team:Team) => {
    const name = prompt('Novi naziv tima:', team.name);
    if (!name || name.trim()===team.name) return;
    try { await apiClient.patch(`/teams/${team.id}`, { name: name.trim() }); load(); } catch(e:any){ alert(e?.message||'Greška'); }
  };

  const deleteTeam = async (team:Team) => {
    if (!confirm(`Ukloniti tim ${team.name}?`)) return;
    try { await apiClient.delete(`/teams/${team.id}`); load(); } catch(e:any){ alert(e?.message||'Greška'); }
  };

  return (
    <MainLayout breadcrumb={["Timovi"]} statusInfo={{ receivingActive: undefined, shippingActive: undefined, onlineWorkers: undefined }}>
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
            Timovi
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
            Upravljanje timovima magacionera, dodela zadataka i praćenje performansi.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
            <StatusChip label="Aktivni prijemi" value={String(recActiveCount)} />
            <StatusChip label="Aktivne otpreme" value={String(shipActiveCount)} />
            <StatusChip label="Timova" value={String(teams.length)} />
          </div>
        </div>
        {/* Top timovi (KPI traka) */}
        <div style={{ background:'rgba(15,23,42,0.75)', border:'1px solid rgba(148,163,184,0.25)', borderRadius:16, padding:20, marginBottom: 20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontWeight:700, color: colors.textPrimary }}>Top timovi (period)</div>
            <button onClick={downloadTeamsCSV} style={{ background:'rgba(250,204,21,0.1)', color:'#fde68a', border:'1px solid rgba(250,204,21,0.35)', padding:'8px 16px', borderRadius:12, fontWeight:600, cursor:'pointer' }}>CSV</button>
          </div>
          {rank.length===0 ? (
            <div style={{ color: colors.textPrimary, marginTop:6 }}>— Nema podataka —</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16, marginTop:16 }}>
              {rank.slice(0,6).map((t:any, i:number)=> (
                <div key={t.team_id} style={{ background: 'rgba(15,23,42,0.75)', border:'1px solid rgba(148,163,184,0.25)', borderRadius:16, padding:16, boxShadow:'0 4px 6px rgba(0,0,0,0.1)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                    {i<3 && <span style={{ width:12, height:12, borderRadius:999, background:'linear-gradient(135deg,#ffd400 0%,#ffaa00 100%)', display:'inline-block', boxShadow:'0 0 8px rgba(255,212,0,0.5)' }} />}
                    <div style={{ fontWeight:700, color: colors.textPrimary, fontSize:16 }}>{t.team_name||t.team}</div>
                  </div>
                  <div style={{ fontSize:13, color: colors.textSecondary, marginTop:4, marginBottom:8 }}>Zadaci: {t.completed}/{t.assigned} ({t.percent}%)</div>
                  <div style={{ height: 8, background:'rgba(148,163,184,0.15)', borderRadius: 999, overflow:'hidden', marginBottom:12 }}>
                    <div style={{ width:`${Math.max(0,Math.min(100,t.percent||0))}%`, height:'100%', background:'linear-gradient(90deg,#ffd400 0%,#ffaa00 100%)', borderRadius:999 }} />
                  </div>
                  <div style={{ fontSize:13, color: colors.textSecondary, marginTop:6, marginBottom:8 }}>Stavke: {t.items_completed}/{t.items_total} ({t.items_percent}%)</div>
                  <div style={{ height: 8, background:'rgba(148,163,184,0.15)', borderRadius: 999, overflow:'hidden' }}>
                    <div style={{ width:`${Math.max(0,Math.min(100,t.items_percent||0))}%`, height:'100%', background:'linear-gradient(90deg,#ffd400 0%,#ffaa00 100%)', borderRadius:999 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ background:'rgba(15,23,42,0.75)', border:'1px solid rgba(148,163,184,0.25)', borderRadius:16, padding:20, marginBottom: 20 }}>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <input value={newTeamName} onChange={e=>setNewTeamName(e.target.value)} placeholder="Naziv tima (npr. T1)" style={{ padding:'10px 14px', background:'rgba(15,23,42,0.5)', border:'1px solid rgba(148,163,184,0.3)', borderRadius:12, color: colors.textPrimary, fontSize:14 }} />
            <button onClick={createTeam} style={{ background:'rgba(250,204,21,0.1)', color:'#fde68a', border:'1px solid rgba(250,204,21,0.35)', padding:'10px 18px', borderRadius:12, fontWeight:600, cursor:'pointer' }}>Kreiraj tim</button>
            <span style={{ marginLeft:16, color: colors.textSecondary }}>Period (za KPI):</span>
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{ padding:'8px 12px', background:'rgba(15,23,42,0.5)', border:'1px solid rgba(148,163,184,0.3)', borderRadius:12, color: colors.textPrimary }} />
            <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{ padding:'8px 12px', background:'rgba(15,23,42,0.5)', border:'1px solid rgba(148,163,184,0.3)', borderRadius:12, color: colors.textPrimary }} />
            <button onClick={loadRank} style={{ background:'rgba(250,204,21,0.1)', color:'#fde68a', border:'1px solid rgba(250,204,21,0.35)', padding:'8px 16px', borderRadius:12, fontWeight:600, cursor:'pointer' }}>Primeni</button>
          </div>
        </div>

        {error && <div style={{ color: colors.statusErr, background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.3)', borderRadius:12, padding:'12px 16px', marginBottom:20 }}>{error}</div>}
        {loading ? <div style={{ color: colors.textPrimary, padding: 40, textAlign: 'center' }}>Učitavanje…</div> : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px,1fr))', gap:20 }}>
            {(() => {
              // globalno zauzeti korisnici (ne dozvoliti u više timova)
              const used = new Set<number>();
              (teams||[]).forEach((tm:any)=> (tm.members||[]).forEach((m:any)=> used.add(m.user_id)));
              const availableUsers = users.filter(u => !used.has(u.id));
              const findMetric = (name:string) => rank.find((x:any)=> (x.team_name||x.team) === name);
              return teams.map(t => (
                <div key={t.id} style={{ background: 'rgba(15,23,42,0.75)', border:'1px solid rgba(148,163,184,0.25)', borderRadius:16, padding:20, boxShadow:'0 4px 6px rgba(0,0,0,0.1)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ fontWeight:700, color: colors.textPrimary }}>{t.name}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <button onClick={()=>renameTeam(t)} style={{ background:'rgba(250,204,21,0.1)', color:'#fde68a', border:'1px solid rgba(250,204,21,0.35)', padding:'6px 12px', borderRadius:10, fontSize:12, cursor:'pointer' }}>Preimenuj</button>
                      <button onClick={()=>deleteTeam(t)} style={{ background:'rgba(220,38,38,0.1)', color:'#f87171', border:'1px solid rgba(220,38,38,0.35)', padding:'6px 12px', borderRadius:10, fontSize:12, cursor:'pointer' }}>Ukloni tim</button>
                      <div style={{ color: colors.brandYellow, fontSize:12, fontWeight:600 }}>{(t.members||[]).length}/2{typeof capacityInfo[t.id]==='number' ? ` · preostalo ${capacityInfo[t.id]}` : ''}</div>
                    </div>
                  </div>
                  <div style={{ marginTop:8 }}>
                    {(t.members||[]).length === 0 ? <div style={{ color: colors.textPrimary }}>Nema članova</div> : (
                      <ul style={{ margin:0, paddingLeft:18, color: colors.textPrimary }}>
                        {t.members.map((m:any) => {
                          const u = users.find(x=>x.id===m.user_id);
                          const nm = (u?.full_name||u?.name||u?.username||`#${m.user_id}`);
                          return (
                            <li key={m.id}>
                              {nm}
                              <button onClick={()=>removeMember(t, m.user_id)} style={{ marginLeft:8, background:'#ffc107', color:'#000', border:'1px solid #e0ac00', padding:'2px 8px', borderRadius:6, fontSize:12 }}>Ukloni</button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {(() => {
                    const m = findMetric(t.name);
                    if (!m) return null;
                    const pct = (v:number)=> Math.max(0, Math.min(100, v||0));
                    return (
                      <div style={{ marginTop:10 }}>
                        <div style={{ fontSize:12, color: colors.textPrimary }}>Zadaci: {m.completed}/{m.assigned} ({m.percent}%)</div>
                        <div style={{ height: 8, background:'#2B2B2B', borderRadius: 6, overflow:'hidden' }}>
                          <div style={{ width:`${pct(m.percent)}%`, height:'100%', background:'#FFC107' }} />
                        </div>
                        <div style={{ fontSize:12, color: colors.textPrimary, marginTop:6 }}>Stavke: {m.items_completed}/{m.items_total} ({m.items_percent}%)</div>
                        <div style={{ height: 8, background:'#2B2B2B', borderRadius: 6, overflow:'hidden' }}>
                          <div style={{ width:`${pct(m.items_percent)}%`, height:'100%', background:'#FFC107' }} />
                        </div>
                      </div>
                    );
                  })()}
                  <div style={{ marginTop:16 }}>
                    <div style={{ fontWeight:600, color: colors.textPrimary, marginBottom:8, fontSize:14 }}>Dodaj člana (max 2)</div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
                      {availableUsers
                        .filter(u => !(t.members||[]).some((m:any) => m.user_id === u.id))
                        .slice(0,6)
                        .map(u => {
                          const atCap = (t.members||[]).length >= 2;
                          return (
                            <button
                              key={u.id}
                              onClick={()=>addMember(t, u.id)}
                              disabled={atCap}
                              style={{
                                background: atCap ? 'rgba(107,114,128,0.1)' : 'rgba(15,23,42,0.5)',
                                color: atCap ? 'rgba(255,255,255,0.3)' : colors.brandYellow,
                                border:`1px solid ${atCap ? 'rgba(107,114,128,0.2)' : 'rgba(148,163,184,0.3)'}`,
                                borderRadius:10,
                                padding:'8px 12px',
                                fontSize:13,
                                cursor: atCap ? 'not-allowed' : 'pointer',
                                transition:'all 0.2s'
                              }}
                            >
                              {(u.full_name||u.name||u.username)}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, marginTop:16, flexWrap:'wrap' }}>
                    <button
                      style={{ background:'rgba(250,204,21,0.1)', color:'#fde68a', border:'1px solid rgba(250,204,21,0.35)', padding:'8px 16px', borderRadius:12, fontWeight:600, cursor:'pointer', flex:1 }}
                      onClick={()=>openTeamAssign(t.id,'RECEIVING')}
                    >
                      Dodijeli prijem
                    </button>
                    <button
                      style={{ background:'rgba(250,204,21,0.1)', color:'#fde68a', border:'1px solid rgba(250,204,21,0.35)', padding:'8px 16px', borderRadius:12, fontWeight:600, cursor:'pointer', flex:1 }}
                      onClick={()=>openTeamAssign(t.id,'SHIPPING')}
                    >
                      Dodijeli otpremu
                    </button>
                  </div>
                </div>
              ));
            })()}
          </div>
        )}

        {assignOpen && (
          <TeamAssignModal
            open={assignOpen}
            type={assignType}
            teamId={assignTeamId}
            onClose={()=>setAssignOpen(false)}
            onAssigned={async()=>{ await loadRank(); }}
            apiClient={apiClient as any}
          />
        )}
      </div>
    </MainLayout>
  );
}

// StatusChip component for hero section
function StatusChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(148,163,184,0.15)', border: '1px solid rgba(148,163,184,0.4)', borderRadius: 999, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{value}</span>
    </div>
  );
}

function csv(v:any){
  if (v==null) return '';
  const s = String(v).replace(/"/g,'""');
  return `"${s}"`;
}
