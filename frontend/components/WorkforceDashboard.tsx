import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { colors } from '../src/theme/colors';
import { TeamAssignModal } from '../src/components/TeamAssignModal';

type Worker = {
  user_id: number;
  full_name: string;
  username: string;
  role: string;
  shift_type: string;
  online_status: 'ONLINE'|'OFFLINE'|'NEAKTIVAN'|string;
  open_tasks_count: number;
  open_putaways?: number;
  oldest_putaway_age?: number;
  open_shipping_orders?: number;
  shipping_oldest_age?: number;
  active_shipping_orders?: { id: number; order_number: string; customer_name: string; status: string; percent_complete: number; started_at: string }[];
  open_skart_count?: number;
  open_povracaj_count?: number;
  active_receivings: { document_number: string; status: string; supplier_name: string; percent_complete: number; started_at: string }[];
  active_skart_documents?: { id: number; uid: string; status: string; store_name: string | null; created_at: string; age_minutes: number }[];
  active_povracaj_documents?: { id: number; uid: string; status: string; store_name: string | null; created_at: string; age_minutes: number }[];
  last_heartbeat_at?: string;
};

export default function WorkforceDashboard() {
  const [data, setData] = useState<Worker[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [teamsRank, setTeamsRank] = useState<any[]>([]);
  const [teamFrom, setTeamFrom] = useState<string>('');
  const [teamTo, setTeamTo] = useState<string>('');
  const [recActiveCount, setRecActiveCount] = useState<number>(0);
  const [shipActiveCount, setShipActiveCount] = useState<number>(0);
  const [povracajActiveCount, setPovracajActiveCount] = useState<number>(0);
  const [assignOpen, setAssignOpen] = useState<boolean>(false);
  const [assignType, setAssignType] = useState<'RECEIVING'|'SHIPPING'|'SKART'|'POVRACAJ'>('RECEIVING');
  const [assignTeamId, setAssignTeamId] = useState<number|undefined>(undefined);
  const [assignList, setAssignList] = useState<any[]>([]);
  const [assignSelectedId, setAssignSelectedId] = useState<number|undefined>(undefined);
  const [assignSaving, setAssignSaving] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'SVE'|'PRVA'|'DRUGA'|'OFF'|'NEDODELJEN'>('SVE');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [me, setMe] = useState<any>(null);
  const [teamTasksModal, setTeamTasksModal] = useState<{ teamId: number; teamName: string } | null>(null);
  const [teamTasksData, setTeamTasksData] = useState<any | null>(null);
  const [teamTasksLoading, setTeamTasksLoading] = useState<boolean>(false);
  const [teamTasksError, setTeamTasksError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'individuals' | 'teams'>('individuals');

  const load = async () => {
    try {
      setLoading(true);
      const [meRes, list] = await Promise.all([
        apiClient.get('/auth/me').catch(() => null),
        apiClient.get('/workforce/overview'),
      ]);
      if (meRes) setMe(meRes);
      setData(Array.isArray(list) ? list : []);
      setUpdatedAt(new Date());
      setError(null);
    } catch (e:any) {
      setError(e?.message || 'Greška pri učitavanju');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(()=>{ 
    (async()=>{ 
      try{ 
        const t = await apiClient.get('/teams'); 
        setTeams(Array.isArray(t)?t:[]); 
      } catch { 
        setTeams([]);
      } 
    })(); 
  }, []);
  const loadTeamsRank = async () => {
    try {
      const qs = (teamFrom || teamTo) ? `?from=${teamFrom||''}&to=${teamTo||''}` : '';
      const r = await apiClient.get(`/workforce/analytics/teams${qs}`);
      setTeamsRank(Array.isArray(r)?r:[]);
    } catch { setTeamsRank([]); }
  };
  useEffect(()=>{ loadTeamsRank(); }, []);
  const top3Names = (()=>{
    const arr = [...(teamsRank||[])].sort((a:any,b:any)=> (b.percent||0)-(a.percent||0)).slice(0,3);
    return new Set(arr.map((t:any)=> t.team_name||t.team));
  })();

  const downloadTeamsCSV = () => {
    const header = ['team_id','team_name','members','assigned','completed','percent','items_total','items_completed','items_percent','refresh_period'];
    const period = `${teamFrom||''}->${teamTo||''}`;
    const lines = [header.join(',')].concat((teamsRank||[]).map((t:any)=> [
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
    const a = document.createElement('a'); a.href=url; a.download='workforce_teams_kpi.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const loadActivesCounts = async () => {
    try {
      const [r, s, p] = await Promise.all([
        apiClient.get('/receiving/active').catch(()=>[]),
        apiClient.get('/shipping/active').catch(()=>[]),
        apiClient.getPovracajDocuments({ status: 'SUBMITTED' }).catch(()=>[]),
      ]);
      setRecActiveCount(Array.isArray(r)? r.length : 0);
      setShipActiveCount(Array.isArray(s)? s.length : 0);
      setPovracajActiveCount(Array.isArray(p?.data) ? p.data.length : (Array.isArray(p) ? p.length : 0));
    } catch { setRecActiveCount(0); setShipActiveCount(0); setPovracajActiveCount(0); }
  };
  useEffect(()=>{ loadActivesCounts(); const t = setInterval(loadActivesCounts, 15000); return ()=>clearInterval(t); }, []);

  const fetchTeamTasks = async (teamId: number, fallbackName: string) => {
    setTeamTasksLoading(true);
    setTeamTasksError(null);
    try {
      const res = await apiClient.get(`/workforce/team/${teamId}/tasks`);
      setTeamTasksData(res);
      const responseName = res?.team?.name || fallbackName;
      if (responseName) {
        setTeamTasksModal(prev => (prev && prev.teamId === teamId ? { ...prev, teamName: responseName } : prev));
      }
    } catch (e: any) {
      setTeamTasksError(e?.message || 'Greška pri učitavanju zadataka');
      setTeamTasksData(null);
    } finally {
      setTeamTasksLoading(false);
    }
  };

  const openTeamTasks = (team: any) => {
    if (!team?.id) return;
    const label = team.name || `Tim ${team.id}`;
    setTeamTasksModal({ teamId: team.id, teamName: label });
    setTeamTasksData(null);
    fetchTeamTasks(team.id, label);
  };

  const refreshTeamTasks = () => {
    if (!teamTasksModal) return;
    fetchTeamTasks(teamTasksModal.teamId, teamTasksModal.teamName);
  };

  const closeTeamTasks = () => {
    setTeamTasksModal(null);
    setTeamTasksData(null);
    setTeamTasksError(null);
  };

  const openTeamAssign = async (teamId:number, type:'RECEIVING'|'SHIPPING'|'SKART'|'POVRACAJ') => {
    setAssignType(type); setAssignTeamId(teamId); setAssignOpen(true); setAssignSelectedId(undefined);
    try {
      let list: any[] = [];
      if (type==='RECEIVING') {
        list = await apiClient.get('/receiving/active');
      } else if (type==='SHIPPING') {
        list = await apiClient.get('/shipping/active');
      } else if (type==='SKART') {
        const result = await apiClient.getSkartDocuments({ status: 'SUBMITTED' });
        list = Array.isArray(result) ? result : (result?.data || []);
      } else if (type==='POVRACAJ') {
        const result = await apiClient.getPovracajDocuments({ status: 'SUBMITTED' });
        list = Array.isArray(result) ? result : (result?.data || []);
      }
      setAssignList(Array.isArray(list)? list : []);
    } catch { setAssignList([]); }
  };
  const submitTeamAssign = async () => {
    if (!assignTeamId || !assignSelectedId) return;
    setAssignSaving(true);
    try {
      await apiClient.post('/workforce/assign-task', { type: assignType, task_id: assignSelectedId, team_id: assignTeamId, policy: 'ANY_DONE' });
      setAssignOpen(false);
      await Promise.all([loadTeamsRank(), loadActivesCounts()]);
    } catch (e:any) { alert(e?.message||'Greška'); } finally { setAssignSaving(false); }
  };

  const filtered = useMemo(() => {
    let result = data;
    
    // Filter by shift
    if (filter !== 'SVE') {
      result = result.filter(w => (w.shift_type || 'NEDODELJEN') === filter);
    }
    
    // Filter by view mode (teams vs individuals)
    // Individual workers are in teams with only 1 member OR not in any team
    // Team workers are in teams with 2 members
    const individualWorkerIds = new Set(
      teams
        .filter(team => (team.members || []).length === 1)
        .flatMap(team => (team.members || []).map((m: any) => m.user_id))
    );
    
    const teamWorkerIds = new Set(
      teams
        .filter(team => (team.members || []).length === 2)
        .flatMap(team => (team.members || []).map((m: any) => m.user_id))
    );
    
    // Workers not in any team should also be individuals
    const allTeamMemberIds = new Set(
      teams.flatMap(team => (team.members || []).map((m: any) => m.user_id))
    );
    
    if (viewMode === 'individuals') {
      // Show workers in single-member teams OR not in any team at all
      result = result.filter(w => !teamWorkerIds.has(w.user_id));
    } else {
      // Show only workers in 2-member teams
      result = result.filter(w => teamWorkerIds.has(w.user_id));
    }
    
    return result;
  }, [data, filter, viewMode, teams]);

  const onlineWorkers = data.filter(w => w.online_status === 'ONLINE').length;

  return (
    <div style={{ background: "linear-gradient(180deg,#05070d 0%,#020304 100%)", minHeight: '100vh', padding: "2rem clamp(1.5rem,2vw,3rem)", boxSizing: 'border-box', color:'#f8fafc', display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'space-between', gap:16 }}>
        <div>
          <div style={{ textTransform:'uppercase', letterSpacing:3, fontSize:12, color:'rgba(255,255,255,0.45)' }}>Radna snaga · live</div>
          <h1 style={{ margin:'6px 0 8px', fontSize:32, fontWeight:700 }}>Ops centar za ekipe</h1>
          <p style={{ color:'rgba(255,255,255,0.6)', maxWidth:520 }}>
            Prati opterećenje timova, rebalansiraj prijeme i otpreme i reaguj pre nego što nastane zastoj.
          </p>
        </div>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <StatusChip label="Online radnici" value={`${onlineWorkers}/${data.length}`} />
          <StatusChip label="Aktivni prijemi" value={recActiveCount} />
          <StatusChip label="Aktivne otpreme" value={shipActiveCount} />
          <StatusChip label="Aktivni povraćaji" value={povracajActiveCount} />
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', background:'rgba(255,255,255,0.03)', borderRadius:20, padding:'12px 16px' }}>
        <select value={filter} onChange={e=>setFilter(e.target.value as any)} style={sel}>
          <option value="SVE">Sve</option>
          <option value="PRVA">Prva</option>
          <option value="DRUGA">Druga</option>
          <option value="OFF">OFF</option>
          <option value="NEDODELJEN">Nedodeljen</option>
        </select>
        <button style={btn} onClick={load}>Osvježi</button>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize:13 }}>Auto-refresh: 15s · Zadnje: {updatedAt ? updatedAt.toLocaleTimeString() : '-'}</span>
        <div style={{ flex:1 }} />
        <AssignLauncher type='RECEIVING' label='Dodijeli prijem' onAssigned={load} />
        <AssignLauncher type='SHIPPING' label='Dodijeli otpremu' onAssigned={load} />
        <AssignPovracajLauncher onAssigned={load} />
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8 }}>
        <button
          onClick={() => setViewMode('individuals')}
          style={{
            background: viewMode === 'individuals' ? 'linear-gradient(135deg,#FFD700,#FFA500)' : 'transparent',
            color: viewMode === 'individuals' ? '#000' : 'rgba(255,255,255,0.6)',
            border: 'none',
            padding: '10px 24px',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            textTransform: 'uppercase',
            letterSpacing: 1
          }}
        >
          Magacioneri
        </button>
        <button
          onClick={() => setViewMode('teams')}
          style={{
            background: viewMode === 'teams' ? 'linear-gradient(135deg,#FFD700,#FFA500)' : 'transparent',
            color: viewMode === 'teams' ? '#000' : 'rgba(255,255,255,0.6)',
            border: 'none',
            padding: '10px 24px',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            textTransform: 'uppercase',
            letterSpacing: 1
          }}
        >
          Timovi
        </button>
      </div>

      {/* Timovi Section - Only show when in teams view */}
      {viewMode === 'teams' && (
      <div style={{ background: 'linear-gradient(180deg,#111522,#090b14)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 24, padding: 20, boxShadow:'0 18px 35px rgba(0,0,0,0.45)', display:'flex', flexDirection:'column', gap:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:12, alignItems:'center' }}>
          <div>
            <div style={{ textTransform:'uppercase', letterSpacing:2, fontSize:12, color:'rgba(255,255,255,0.5)' }}>Timovi</div>
            <h2 style={{ margin:0, color:'#fff', fontSize:22, fontWeight:600 }}>Operativne grupe</h2>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ color:'rgba(255,255,255,0.6)', fontSize:13 }}>Period</span>
            <input type="date" value={teamFrom} onChange={e=>setTeamFrom(e.target.value)} style={sel} />
            <input type="date" value={teamTo} onChange={e=>setTeamTo(e.target.value)} style={sel} />
            <button style={btn} onClick={loadTeamsRank}>Primeni</button>
            <button style={btn} onClick={downloadTeamsCSV}>CSV</button>
          </div>
        </div>
        {teams.filter(t => (t.members || []).length === 2).length === 0 ? <div style={{ color: colors.textPrimary }}>Nema kreiranih timova sa 2 člana.</div> : (
          <div style={{ ...grid }}>
            {teams.filter(tm => (tm.members || []).length === 2).map((tm:any)=> {
              const metric = teamsRank.find((x:any)=> (x.team_name||x.team) === tm.name);
              const memberNames = (tm.members||[]).map((m:any)=>{
                const u = data.find(x=> x.user_id===m.user_id);
                return (u?.full_name || u?.username || `#${m.user_id}`);
              }).join(', ') || '—';
              const recActive = metric ? Math.max(0, (metric.rec_assigned||0) - (metric.rec_completed||0)) : 0;
              const shipActive = metric ? Math.max(0, (metric.ship_assigned||0) - (metric.ship_completed||0)) : 0;
              // Calculate SKART count for team members
              const teamMemberIds = (tm.members||[]).map((m:any)=> m.user_id);
              const skartActive = data
                .filter((w:Worker) => teamMemberIds.includes(w.user_id))
                .reduce((sum:number, w:Worker) => sum + (w.open_skart_count || 0), 0);
              const povracajActive = data
                .filter((w:Worker) => teamMemberIds.includes(w.user_id))
                .reduce((sum:number, w:Worker) => sum + (w.open_povracaj_count || 0), 0);
              const recPercent = (()=>{
                if (metric && typeof metric.rec_assigned==='number' && metric.rec_assigned>0) {
                  return Math.round(100 * (metric.rec_completed||0) / metric.rec_assigned);
                }
                return Math.max(0, Math.min(100, metric?.percent || 0));
              })();
              const shipPercent = (()=>{
                if (metric && typeof metric.ship_assigned==='number' && metric.ship_assigned>0) {
                  return Math.round(100 * (metric.ship_completed||0) / metric.ship_assigned);
                }
                return Math.max(0, Math.min(100, metric?.percent || 0));
              })();
              return (
                <div key={tm.id} style={{ ...card }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {top3Names.has(tm.name) && <span style={{ width:10, height:10, borderRadius:999, background:'#FFD700', display:'inline-block' }} />}
                    <div style={{ fontWeight:'bold', fontSize: 18, color: colors.textPrimary }}>{tm.name}</div>
                  </div>
                  <div style={{ color: colors.textPrimary, marginTop: 6 }}>Članovi: {memberNames}</div>
                  <div style={{ color: colors.textPrimary, marginTop: 6 }}>Smena: NEDODELJEN</div>
                  <div>
                    <span style={{ background: colors.statusOffline, color: '#111', borderRadius: 999, padding:'2px 10px', fontSize:12, fontWeight:600 }}>OFFLINE</span>
                    <span style={{ color: colors.textPrimary, marginLeft: 8, fontSize: 12 }}>Poslednji signal: —</span>
                  </div>
                  <div style={{ marginTop: 8 }}>Aktivnih prijema: {recActive}</div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ ...receivingBadge() }}>Prijem: {recActive}</span>
                    <div style={{ height: 4, background: colors.borderCard, borderRadius: 999, overflow:'hidden', marginTop:4, maxWidth: 180 }}>
                      <div style={{ width: `${recPercent}%`, height:'100%', background: colors.brandYellow }} />
                    </div>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ ...receivingBadge() }}>Otprema: {shipActive}</span>
                    <div style={{ height: 4, background: colors.borderCard, borderRadius: 999, overflow:'hidden', marginTop:4, maxWidth: 180 }}>
                      <div style={{ width: `${shipPercent}%`, height:'100%', background: colors.brandYellow }} />
                    </div>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ ...receivingBadge() }}>SKART: {skartActive}</span>
                    <div style={{ height: 4, background: 'rgb(47, 47, 47)', borderRadius: 999, overflow: 'hidden', marginTop: 4, maxWidth: 180 }}>
                      <div style={{ width: skartActive > 0 ? '100%' : '0%', height: '100%', background: 'rgb(255, 212, 0)' }} />
                    </div>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ ...receivingBadge() }}>Povracaj: {povracajActive}</span>
                    <div style={{ height: 4, background: 'rgb(47, 47, 47)', borderRadius: 999, overflow: 'hidden', marginTop: 4, maxWidth: 180 }}>
                      <div style={{ width: povracajActive > 0 ? '100%' : '0%', height: '100%', background: 'rgb(255, 212, 0)' }} />
                    </div>
                  </div>
                  {metric && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize:12, color: colors.textPrimary }}>Zadaci: {metric.completed}/{metric.assigned} ({metric.percent}%)</div>
                      <Progress value={metric.percent||0} />
                      <div style={{ fontSize:12, color: colors.textPrimary, marginTop:6 }}>Stavke: {metric.items_completed}/{metric.items_total} ({metric.items_percent}%)</div>
                      <Progress value={metric.items_percent||0} />
                    </div>
                  )}
                  <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
                    <button style={btn} onClick={()=>openTeamTasks(tm)}>Zadaci</button>
                    <button style={btn} onClick={()=>openTeamAssign(tm.id, 'RECEIVING')}>Prijem</button>
                    <button style={btn} onClick={()=>openTeamAssign(tm.id, 'SHIPPING')}>Otprema</button>
                    <button style={btn} onClick={()=>openTeamAssign(tm.id, 'SKART')}>SKART</button>
                    <button style={btn} onClick={()=>openTeamAssign(tm.id, 'POVRACAJ')}>Povraćaj</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {assignOpen && (
          <TeamAssignModal
            open={assignOpen}
            type={assignType}
            teamId={assignTeamId}
            onClose={()=>setAssignOpen(false)}
            onAssigned={async()=>{ await Promise.all([loadTeamsRank(), loadActivesCounts(), load()]); }}
            apiClient={apiClient as any}
          />
        )}
        {teamTasksModal && (
          <TeamTasksModal
            team={teamTasksModal}
            data={teamTasksData}
            loading={teamTasksLoading}
            error={teamTasksError}
            onRefresh={refreshTeamTasks}
            onClose={closeTeamTasks}
          />
        )}
      </div>
      )}

      {/* Worker Cards - Show based on view mode */}
      {loading ? <div style={{ color: colors.textPrimary, padding: '1rem' }}>Učitavanje…</div> : error ? <div style={{ color: colors.statusErr, padding: '1rem' }}>{error}</div> : (
        <div style={{ ...grid }}>
          {filtered.map(w => (
            <WorkerCard key={w.user_id} w={w} me={me} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkerCard({ w, me, onRefresh }: { w: Worker; me: any; onRefresh: () => void }) {
  const [showTasks, setShowTasks] = useState(false);
  const [showShift, setShowShift] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const inShift = ['PRVA','DRUGA'].includes(w.shift_type);
  const bg = w.online_status === 'ONLINE'
    ? 'linear-gradient(180deg,#151922,#090b14)'
    : 'rgba(255,255,255,0.04)';
  const normalizedRole = (me?.role || '').toLowerCase();
  const canAssignShift = me && ['admin','sef_magacina','menadzer'].includes(normalizedRole);
  const canAssignTask = me && me.role && w.online_status !== 'NEAKTIVAN' && w.shift_type !== 'OFF';

  return (
    <div style={{ ...card, background: bg }}>
      <div style={{ fontWeight:'bold', fontSize: 18, color: colors.textPrimary }}>{w.full_name}</div>
      <div style={{ color: colors.textPrimary, margin: '4px 0' }}>Smena: {labelForShift(w.shift_type)}</div>
      <div>
        {badge(w.online_status)}
        <span style={{ color: colors.textPrimary, marginLeft: 8, fontSize: 12 }}>Poslednji signal: {ago(w.last_heartbeat_at)}</span>
      </div>
      <div style={{ marginTop: 8 }}>Aktivnih prijema: {w.open_tasks_count}</div>
      <div style={{ marginTop: 6 }}>
        <span style={{ ...receivingBadge() }}>Prijem: {w.open_tasks_count || 0}</span>
        {w.active_receivings.length > 0 && (() => {
          const avgProgress = Math.round(w.active_receivings.reduce((sum, r) => sum + (r.percent_complete || 0), 0) / w.active_receivings.length);
          return (
            <div style={{ height: 4, background: 'rgb(47, 47, 47)', borderRadius: 999, overflow: 'hidden', marginTop: 4, maxWidth: 180 }}>
              <div style={{ width: `${avgProgress}%`, height: '100%', background: 'rgb(255, 212, 0)' }} />
            </div>
          );
        })()}
      </div>
      <div style={{ marginTop: 6 }}>
        <span style={{ ...receivingBadge() }}>Otprema: {w.open_shipping_orders || 0}</span>
        {w.active_shipping_orders && w.active_shipping_orders.length > 0 && (() => {
          const avgProgress = Math.round(w.active_shipping_orders.reduce((sum, o) => sum + (o.percent_complete || 0), 0) / w.active_shipping_orders.length);
          return (
            <div style={{ height: 4, background: 'rgb(47, 47, 47)', borderRadius: 999, overflow: 'hidden', marginTop: 4, maxWidth: 180 }}>
              <div style={{ width: `${avgProgress}%`, height: '100%', background: 'rgb(255, 212, 0)' }} />
            </div>
          );
        })()}
      </div>
      <div style={{ marginTop: 6 }}>
        <span style={{ ...receivingBadge() }}>SKART: {w.open_skart_count || 0}</span>
        {w.active_skart_documents && w.active_skart_documents.length > 0 && (
          <div style={{ height: 4, background: 'rgb(47, 47, 47)', borderRadius: 999, overflow: 'hidden', marginTop: 4, maxWidth: 180 }}>
            <div style={{ width: '100%', height: '100%', background: 'rgb(255, 212, 0)' }} />
          </div>
        )}
      </div>
      <div style={{ marginTop: 6 }}>
        <span style={{ ...receivingBadge() }}>Povracaj: {w.open_povracaj_count || 0}</span>
        {w.active_povracaj_documents && w.active_povracaj_documents.length > 0 && (
          <div style={{ height: 4, background: 'rgb(47, 47, 47)', borderRadius: 999, overflow: 'hidden', marginTop: 4, maxWidth: 180 }}>
            <div style={{ width: '100%', height: '100%', background: 'rgb(255, 212, 0)' }} />
          </div>
        )}
      </div>
      {w.open_tasks_count > 0 && (
        <div style={{ marginTop: 8 }}>
          {w.active_receivings.map((r, idx) => (
            <div key={idx} style={{ marginBottom: 6 }}>
              <div style={{ fontWeight: 600 }}>{r.document_number} · {r.supplier_name}</div>
              <Progress value={r.percent_complete} />
              <div style={{ fontSize: 12, color: colors.textPrimary }}>{r.status.toUpperCase()}</div>
            </div>
          ))}
        </div>
      )}
      {w.open_skart_count > 0 && w.active_skart_documents && (
        <div style={{ marginTop: 8 }}>
          {w.active_skart_documents.map((skart, idx) => (
        <div key={idx} style={{ marginBottom: 6, padding: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: `1px solid rgba(255,255,255,0.05)` }}>
              <div style={{ fontWeight: 600, color: colors.brandYellow }}>{skart.uid}</div>
              <div style={{ fontSize: 12, color: colors.textPrimary, marginTop: 4 }}>
                {skart.store_name || '—'} · {skart.status === 'SUBMITTED' ? 'SUBMITOVANO' : 'PRIMLJENO'}
              </div>
              <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                Starost: {skart.age_minutes} min
              </div>
            </div>
          ))}
        </div>
      )}
      {w.open_povracaj_count > 0 && w.active_povracaj_documents && (
        <div style={{ marginTop: 8 }}>
          {w.active_povracaj_documents.map((povracaj, idx) => (
        <div key={idx} style={{ marginBottom: 6, padding: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: `1px solid rgba(255,255,255,0.05)` }}>
              <div style={{ fontWeight: 600, color: colors.brandYellow }}>{povracaj.uid}</div>
              <div style={{ fontSize: 12, color: colors.textPrimary, marginTop: 4 }}>
                {povracaj.store_name || '—'} · {povracaj.status === 'SUBMITTED' ? 'SUBMITOVANO' : 'PRIMLJENO'}
              </div>
              <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                Starost: {povracaj.age_minutes} min
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display:'flex', gap: 8, marginTop: 10, flexWrap:'wrap' }}>
        <button style={btn} onClick={()=>setShowTasks(true)}>Zadaci</button>
        {canAssignShift && <button style={btn} onClick={()=>setShowShift(true)}>Promeni smenu</button>}
        {canAssignTask && <button style={btn} onClick={()=>setShowAssign(true)}>Dodijeli prijem</button>}
        {canAssignTask && <AssignShippingLauncher userId={w.user_id} onAssigned={onRefresh} />}
        {canAssignTask && <AssignSkartLauncher userId={w.user_id} onAssigned={onRefresh} />}
        {canAssignTask && <AssignPovracajLauncher userId={w.user_id} onAssigned={onRefresh} />}
      </div>

      {showTasks && <WorkforceTasksModal worker={w} onClose={()=>setShowTasks(false)} />}
      {showShift && <ShiftAssignModal userId={w.user_id} onClose={()=>{ setShowShift(false); onRefresh(); }} />}
      {showAssign && <AssignTaskModal userId={w.user_id} onClose={()=>{ setShowAssign(false); onRefresh(); }} />}
    </div>
  );
}

function WorkforceTasksModal({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  return (
    <Modal title={`Zadaci · ${worker.full_name}`} onClose={onClose}>
      {worker.active_receivings.length === 0 ? <div>Nema aktivnih prijema.</div> : (
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Document #</th>
              <th style={th}>Dobavljač</th>
              <th style={th}>Status</th>
              <th style={th}>Progres</th>
              <th style={th}>Tim</th>
            </tr>
          </thead>
          <tbody>
            {worker.active_receivings.map((r, idx) => (
              <tr key={idx}>
                <td style={td}>{r.document_number}</td>
                <td style={td}>{r.supplier_name}</td>
                <td style={td}>{r.status.toUpperCase()}</td>
                <td style={td}><Progress value={r.percent_complete} /></td>
                <td style={td}>
                  <AssigneesButton type="RECEIVING" id={extractDocId(r)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

const RECEIVING_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nacrt',
  IN_PROGRESS: 'U toku',
  COMPLETED: 'Završeno',
  ON_HOLD: 'Na čekanju',
  CANCELLED: 'Otkazano',
};

const SHIPPING_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nacrt',
  PICKING: 'U prikupljanju',
  STAGED: 'Na rampi',
  LOADED: 'Utovareno',
  COMPLETED: 'Završeno',
  CLOSED: 'Zatvoreno',
  ON_HOLD: 'Na čekanju',
  CANCELLED: 'Otkazano',
};

const ASSIGNEE_STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Dodijeljen',
  IN_PROGRESS: 'U toku',
  DONE: 'Završio',
};

const POLICY_LABELS: Record<string, string> = {
  ANY_DONE: 'Prvi koji završi',
  ALL_DONE: 'Svi moraju završiti',
};

function translateReceivingStatus(status: string) {
  if (!status) return '—';
  const key = String(status).toUpperCase();
  return RECEIVING_STATUS_LABELS[key] || status;
}

function translateShippingStatus(status: string) {
  if (!status) return '—';
  const key = String(status).toUpperCase();
  return SHIPPING_STATUS_LABELS[key] || status;
}

function translateAssigneeStatus(status: string) {
  if (!status) return '—';
  const key = String(status).toUpperCase();
  return ASSIGNEE_STATUS_LABELS[key] || status;
}

function translatePolicy(policy: string) {
  if (!policy) return '—';
  const key = String(policy).toUpperCase();
  return POLICY_LABELS[key] || policy;
}

function statusBadgeStyles(type: 'RECEIVING'|'SHIPPING', rawStatus: string) {
  const status = String(rawStatus || '').toUpperCase();
  if (['COMPLETED', 'CLOSED', 'STAGED', 'LOADED'].includes(status)) {
    return { background: colors.statusOk, color: '#fff' };
  }
  if (['IN_PROGRESS', 'PICKING'].includes(status)) {
    return { background: colors.statusWarn, color: '#000' };
  }
  if (['ON_HOLD'].includes(status)) {
    return { background: colors.statusWarn, color: '#000' };
  }
  if (['CANCELLED'].includes(status)) {
    return { background: colors.statusErr, color: '#fff' };
  }
  return { background: colors.borderCard, color: colors.textPrimary };
}

function TeamTasksModal({
  team,
  data,
  loading,
  error,
  onRefresh,
  onClose,
}: {
  team: { teamId: number; teamName: string };
  data: any | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const summary = data?.summary || { total: 0, receiving: 0, shipping: 0, skart: 0, povracaj: 0 };
  const members: Array<{ user_id: number; full_name: string }> = data?.members || [];
  const receiving: any[] = data?.receiving || [];
  const shipping: any[] = data?.shipping || [];
  const skart: any[] = data?.skart || [];
  const povracaj: any[] = data?.povracaj || [];

  const membersLabel = members.length ? members.map(m => m.full_name).join(', ') : '—';

  // Calculate average progress for all assigned documents
  const allTasks = [...receiving, ...shipping, ...skart, ...povracaj];
  const tasksWithProgress = allTasks.filter(t => typeof t.percent_complete === 'number');
  const avgProgress = tasksWithProgress.length > 0
    ? Math.round(tasksWithProgress.reduce((sum, t) => sum + (t.percent_complete || 0), 0) / tasksWithProgress.length)
    : 0;

  return (
    <Modal title={`Zadaci · ${team.teamName}`} onClose={onClose}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12, marginBottom:12 }}>
        <div style={{ color: colors.textPrimary, fontSize:13, lineHeight:1.6 }}>
          <div><strong>Tim:</strong> {team.teamName}</div>
          <div><strong>Ukupno zadataka:</strong> {summary.total} (Prijem: {summary.receiving} · Otprema: {summary.shipping} · SKART: {summary.skart || 0} · Povracaj: {summary.povracaj || 0})</div>
          {allTasks.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Prosečan progres: {avgProgress}%</div>
              <Progress value={avgProgress} />
            </div>
          )}
          <div><strong>Članovi:</strong> {membersLabel}</div>
        </div>
        <button style={btn} onClick={onRefresh} disabled={loading}>
          {loading ? 'Učitavanje…' : 'Osvježi'}
        </button>
      </div>
      {error && <div style={{ color: colors.statusErr, marginBottom: 12 }}>{error}</div>}
      {loading && !data && !error ? (
        <div style={{ color: colors.textSecondary }}>Učitavanje zadataka…</div>
      ) : (
        <>
          <TeamTasksSection title="Prijem" type="RECEIVING" emptyMessage="Nema dodeljenih prijema." tasks={receiving} />
          <TeamTasksSection title="Otprema" type="SHIPPING" emptyMessage="Nema dodeljenih otprema." tasks={shipping} />
          <TeamTasksSection title="SKART" type="SKART" emptyMessage="Nema dodeljenih SKART naloga." tasks={skart} />
          <TeamTasksSection title="Povracaj" type="POVRACAJ" emptyMessage="Nema dodeljenih Povracaj naloga." tasks={povracaj} />
        </>
      )}
    </Modal>
  );
}

function TeamTasksSection({
  title,
  type,
  emptyMessage,
  tasks,
}: {
  title: string;
  type: 'RECEIVING'|'SHIPPING'|'SKART'|'POVRACAJ';
  emptyMessage: string;
  tasks: any[];
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 700, color: colors.brandYellow, marginBottom: 8 }}>{title}</div>
      {!tasks || tasks.length === 0 ? (
        <div style={{ color: colors.textSecondary, fontSize: 13 }}>{emptyMessage}</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {tasks.map(task => (
            <TeamTaskCard key={`${type}-${task.id}`} type={type} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamTaskCard({ type, task }: { type: 'RECEIVING'|'SHIPPING'|'SKART'|'POVRACAJ'; task: any }) {
  if (type === 'SKART' || type === 'POVRACAJ') {
    const age = typeof task.age_min === 'number' ? `${task.age_min} min` : '—';
    const statusLabel = task.status === 'SUBMITTED' ? 'SUBMITOVANO' : 'PRIMLJENO';
    const statusColor = task.status === 'RECEIVED' ? '#15803d' : '#ca8a04';
    const typeLabel = type === 'SKART' ? 'SKART' : 'POVRACAJ';
    
    return (
      <div style={{ border: `1px solid ${colors.brandYellow}`, borderRadius: 8, padding: 12, background: colors.bgPanelAlt }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <div style={{ color: colors.brandYellow, fontWeight: 600 }}>{typeLabel} {task.uid || task.id}</div>
          <span style={{ background: statusColor, color: '#fff', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>
            {statusLabel}
          </span>
        </div>
        {task.store_name && <div style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>Prodavnica: {task.store_name}</div>}
        <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginTop:8, fontSize:12, color: colors.textPrimary }}>
          <div>Trajanje: <strong>{age}</strong></div>
          {task.assigned_to_user_id && <div>Dodeljeno korisniku: <strong>ID #{task.assigned_to_user_id}</strong></div>}
        </div>
        <div style={{ marginTop: 8, color: colors.textSecondary, fontSize: 11 }}>
          Kreirano: {task.created_at ? new Date(task.created_at).toLocaleString() : '—'}
        </div>
      </div>
    );
  }
  
  const badgeStyle = statusBadgeStyles(type, task.status);
  const progress = typeof task.percent_complete === 'number' ? `${task.percent_complete}%` : '—';
  const amountLabel =
    type === 'RECEIVING'
      ? `${task.received_qty ?? 0} / ${task.expected_qty ?? 0}`
      : `${task.picked_qty ?? 0} / ${task.requested_qty ?? 0}`;
  const title =
    type === 'RECEIVING'
      ? `Prijem ${task.document_number || task.id}`
      : `Otprema ${task.order_number || task.id}`;
  const partner =
    type === 'RECEIVING'
      ? task.supplier_name
      : task.customer_name;
  const age = typeof task.age_min === 'number' ? `${task.age_min} min` : '—';
  const assignees: any[] = task.assignees || [];

  return (
    <div style={{ border: `1px solid rgba(255,255,255,0.05)`, borderRadius: 14, padding: 14, background: 'rgba(255,255,255,0.04)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <div style={{ color: colors.textPrimary, fontWeight: 600 }}>{title}</div>
        <span style={{ ...badgeStyle, borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>
          {type === 'RECEIVING' ? translateReceivingStatus(task.status) : translateShippingStatus(task.status)}
        </span>
      </div>
      {partner && <div style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>{partner}</div>}
      <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginTop:8, fontSize:12, color: colors.textPrimary }}>
        <div>Napredak: <strong>{progress}</strong></div>
        <div>Količina: <strong>{amountLabel}</strong></div>
        <div>Politika: <strong>{translatePolicy(task.policy)}</strong></div>
        <div>Trajanje: <strong>{age}</strong></div>
        <div>Aktivni članovi: <strong>{task.active_assignees_count ?? 0}</strong></div>
      </div>
      {assignees.length > 0 ? (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {assignees.map(a => (
            <span key={a.id} style={{ background: colors.bgPanel, color: colors.textPrimary, borderRadius: 999, padding: '3px 8px', fontSize: 11 }}>
              {a.user_name} · {translateAssigneeStatus(a.status)}
            </span>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 8, color: colors.textSecondary, fontSize: 12 }}>Nema dodeljenih članova.</div>
      )}
      <div style={{ marginTop: 8, color: colors.textSecondary, fontSize: 11 }}>
        Dodeljeno: {task.assigned_at ? new Date(task.assigned_at).toLocaleString() : '—'}
      </div>
    </div>
  );
}

function extractDocId(r:any): number | undefined {
  // This modal receives pre-aggregated entries; backend does not include id.
  // For now, leave undefined so button is disabled when id missing.
  return (r && (r as any).id) ? Number((r as any).id) : undefined;
}

function AssigneesButton({ type, id }: { type: 'RECEIVING'|'SHIPPING'|'PUTAWAY'; id?: number }) {
  const [open, setOpen] = useState(false);
  if (!id) return <span style={{ color: colors.textSecondary, fontSize:12 }}>—</span>;
  return (
    <>
      <button style={btn} onClick={()=>setOpen(true)}>Vidi</button>
      {open && <AssigneesModal type={type} id={id} onClose={()=>setOpen(false)} />}
    </>
  );
}

function AssigneesModal({ type, id, onClose }: { type: 'RECEIVING'|'SHIPPING'|'PUTAWAY'; id: number; onClose: () => void }) {
  const [data, setData] = useState<any|null>(null);
  useEffect(() => { (async()=>{ try{ const d = await apiClient.get(`/workforce/task-assignees/${type}/${id}`); setData(d);} catch{} })(); }, [type, id]);
  return (
    <Modal title={`Članovi zadatka · ${type} #${id}`} onClose={onClose}>
      {!data ? <div>Učitavanje…</div> : (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, color: colors.textPrimary }}>
            <span>Policy: {data.policy}</span>
            <button style={btn} onClick={()=>downloadAssigneesCSV(type, id, data)}>CSV</button>
            <button style={btn} onClick={()=>printAssignees(type, id, data)}>Štampaj</button>
          </div>
          {(!data.assignees || data.assignees.length===0) ? <div>Nema dodeljenih članova.</div> : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Korisnik</th>
                  <th style={th}>Status</th>
                  <th style={th}>Start</th>
                  <th style={th}>Kraj</th>
                </tr>
              </thead>
              <tbody>
                {data.assignees.map((a:any)=> (
                  <tr key={a.id}>
                    <td style={td}>{a.user_name}</td>
                    <td style={td}>{a.status}</td>
                    <td style={td}>{a.started_at ? new Date(a.started_at).toLocaleString() : '—'}</td>
                    <td style={td}>{a.completed_at ? new Date(a.completed_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Modal>
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

function ShiftAssignModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [types, setTypes] = useState<{ value: string; label: string }[]>([]);
  const [selType, setSelType] = useState<string>('PRVA');
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState<'ANY_DONE'|'ALL_DONE'>('ANY_DONE');
  useEffect(() => { (async()=>{ try{ const t = await apiClient.get('/workforce/shift-types'); setTypes(t); } catch{} })(); }, []);
  const submit = async () => { setSaving(true); try{ await apiClient.post('/workforce/shift-assign', { user_id: userId, shift_type: selType }); onClose(); } catch{} finally{ setSaving(false);} };
  return (
    <Modal title="Promeni smenu" onClose={onClose}>
      <div style={{ marginBottom: 10 }}>
        {types.map(t => (
          <label key={t.value} style={{ display:'block', marginBottom: 6 }}>
            <input type="radio" name="shift" value={t.value} checked={selType===t.value} onChange={()=>setSelType(t.value)} /> {t.label}
          </label>
        ))}
      </div>
      <div style={{ textAlign:'right' }}>
        <button style={btn} onClick={submit} disabled={saving}>{saving ? 'Čuvanje…' : 'Sačuvaj smenu'}</button>
      </div>
    </Modal>
  );
}

function AssignTaskModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [assignedInfo, setAssignedInfo] = useState<Record<number, any>>({});
  useEffect(() => { (async()=>{
    try{
      const lst = await apiClient.get('/receiving/active');
      setDocs(lst || []);
      // Load assignment info per document (best-effort)
      if (Array.isArray(lst)) {
        const entries = await Promise.all(lst.map(async (d:any)=>{
          try {
            const info = await apiClient.get(`/workforce/task-assignees/RECEIVING/${d.id}`);
            return [d.id, info];
          } catch { return [d.id, null]; }
        }));
        const map: Record<number, any> = {};
        for (const [id, info] of entries) { if (id) map[Number(id)] = info; }
        setAssignedInfo(map);
      }
    } catch{}
  })(); }, []);
  const reassign = async (docId:number) => {
    try{
      const info = assignedInfo[docId];
      if (info && ((Array.isArray(info.assignees) && info.assignees.length>0) || info.team_id)){
        let msg = 'Ovaj prijem je već dodeljen';
        const who = info.team_name ? ` timu: ${info.team_name}` : (info.assignees && info.assignees.length? ` korisnicima: ${(info.assignees||[]).map((a:any)=>a.user_name).join(', ')}` : '');
        msg += who ? ` (${who})` : '';
        msg += '\nŽelite li da prebacite dodelu na ovog radnika?';
        if (!confirm(msg)) return;
      }
      await apiClient.patch(`/receiving/documents/${docId}/reassign`, { assigned_to_user_id: userId });
      onClose();
    } catch{}
  };
  return (
    <Modal title="Dodijeli prijem" onClose={onClose}>
      {docs.length === 0 ? <div>Nema aktivnih prijema.</div> : (
        <div>
          {docs.map((d:any) => {
            const ai = assignedInfo[d.id];
            const assignedChip = ai && ((ai.team_name) || (Array.isArray(ai.assignees) && ai.assignees.length>0))
              ? <span style={{ marginLeft:8, background: colors.textSecondary, color: '#111', borderRadius:999, padding:'2px 8px', fontSize:12, fontWeight:600 }}>DODELJEN</span>
              : null;
            const meta = ai?.team_name || (ai?.assignees ? (ai.assignees.map((x:any)=>x.user_name).join(', ')) : '');
            return (
              <div key={d.id} style={{ borderBottom:`1px solid ${colors.borderCard}`, padding:'8px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:600 }}>{d.document_number} {assignedChip}</div>
                  <div style={{ color: colors.textPrimary, fontSize:12 }}>{d.supplier_name || d.supplier?.name || ''}{meta ? ` · ${meta}` : ''}</div>
                </div>
                <button style={btn} onClick={()=>reassign(d.id)}>Dodijeli ovom radniku</button>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function AssignShippingLauncher({ userId, onAssigned }: { userId: number; onAssigned: () => void }){
  const [open, setOpen] = useState(false);
  return (
    <>
      <button style={btn} onClick={()=>setOpen(true)}>Dodijeli otpremu</button>
      {open && <AssignShippingModal userId={userId} onClose={()=>{ setOpen(false); onAssigned(); }} />}
    </>
  );
}

function AssignSkartLauncher({ userId, onAssigned }: { userId: number; onAssigned: () => void }){
  const [open, setOpen] = useState(false);
  return (
    <>
      <button style={btn} onClick={()=>setOpen(true)}>Dodijeli SKART</button>
      {open && <AssignSkartModal userId={userId} onClose={()=>{ setOpen(false); onAssigned(); }} />}
    </>
  );
}

function AssignPovracajLauncher({ userId, onAssigned }: { userId?: number; onAssigned?: () => void }){
  const [open, setOpen] = useState(false);
  return (
    <>
      <button style={btn} onClick={()=>setOpen(true)}>Dodijeli povracaj</button>
      {open && <AssignPovracajModal userId={userId} onClose={()=>{ setOpen(false); onAssigned?.(); }} />}
    </>
  );
}

function AssignShippingModal({ userId, onClose }: { userId: number; onClose: () => void }){
  const [orders, setOrders] = useState<any[]>([]);
  const [assignedInfo, setAssignedInfo] = useState<Record<number, any>>({});
  useEffect(() => { (async()=>{ try{ const lst = await apiClient.get('/shipping/active'); setOrders(Array.isArray(lst)?lst:[]);
    if (Array.isArray(lst)){
      const entries = await Promise.all(lst.map(async (o:any)=>{ try{ const info = await apiClient.get(`/workforce/task-assignees/SHIPPING/${o.id}`); return [o.id, info]; } catch { return [o.id, null]; } }));
      const map: Record<number, any> = {}; for (const [id, info] of entries) { if (id) map[Number(id)] = info; } setAssignedInfo(map);
    }
  } catch{} })(); }, []);
  const assign = async (orderId:number) => { try{
    const info = assignedInfo[orderId];
    if (info && ((Array.isArray(info.assignees) && info.assignees.length>0) || info.team_id)){
      let msg = 'Ovaj nalog je već dodeljen';
      const who = info.team_name ? ` timu: ${info.team_name}` : (info.assignees && info.assignees.length? ` korisnicima: ${(info.assignees||[]).map((a:any)=>a.user_name).join(', ')}` : '');
      msg += who ? ` (${who})` : '';
      msg += '\nŽelite li da prebacite dodelu na ovog radnika?';
      if (!confirm(msg)) return;
    }
    await apiClient.patch(`/shipping/order/${orderId}/start`, { assigned_user_id: userId }); onClose(); } catch{} };
  return (
    <Modal title="Dodijeli otpremu" onClose={onClose}>
      {orders.length === 0 ? <div>Nema aktivnih otprema.</div> : (
        <div>
          {orders.map((o:any) => {
            const ai = assignedInfo[o.id];
            const assignedChip = ai && ((ai.team_name) || (Array.isArray(ai.assignees) && ai.assignees.length>0))
              ? <span style={{ marginLeft:8, background: colors.textSecondary, color: '#111', borderRadius:999, padding:'2px 8px', fontSize:12, fontWeight:600 }}>DODELJEN</span>
              : null;
            const meta = ai?.team_name || (ai?.assignees ? (ai.assignees.map((x:any)=>x.user_name).join(', ')) : '');
            return (
              <div key={o.id} style={{ borderBottom:`1px solid ${colors.borderCard}`, padding:'8px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:600 }}>{o.order_number} · {o.customer_name || ''} {assignedChip}</div>
                  <div style={{ fontSize:12, color: colors.textPrimary }}>{String(o.status||'').toUpperCase()}{meta ? ` · ${meta}` : ''}</div>
                </div>
                <button style={btn} onClick={()=>assign(o.id)}>Dodijeli ovom radniku</button>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function AssignSkartModal({ userId, onClose }: { userId: number; onClose: () => void }){
  const [skartDocs, setSkartDocs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [workersMap, setWorkersMap] = useState<Map<number, string>>(new Map());
  
  useEffect(() => { 
    (async()=>{ 
      try{ 
        const [docsResult, workersResult] = await Promise.all([
          apiClient.getSkartDocuments({ status: 'SUBMITTED' }),
          apiClient.get('/receiving/warehouse-workers').catch(() => [])
        ]);
        const docsList = Array.isArray(docsResult?.data)
          ? docsResult.data
          : (Array.isArray(docsResult) ? docsResult : []);
        setSkartDocs(docsList);
        setWorkers(Array.isArray(workersResult) ? workersResult : []);
        
        // Create map for quick lookup
        const map = new Map<number, string>();
        workersResult.forEach((w: any) => {
          const name = w.full_name || w.name || w.username || `ID ${w.id}`;
          map.set(w.id, name);
        });
        setWorkersMap(map);
      } catch(e) {
        console.error('Error loading SKART documents:', e);
      }
    })(); 
  }, []);
  
  const assign = async (uid: string, currentAssignedTo: number | null | undefined) => { 
    try{
      if (currentAssignedTo && currentAssignedTo !== userId) {
        const currentName = workersMap.get(currentAssignedTo) || `ID #${currentAssignedTo}`;
        let msg = 'Ovaj SKART nalog je već dodeljen';
        msg += ` korisniku ${currentName}`;
        msg += '\nŽelite li da prebacite dodelu na ovog radnika?';
        if (!confirm(msg)) return;
      }
      await apiClient.assignSkartDocument(uid, userId); 
      onClose(); 
    } catch(e) {
      console.error('Error assigning SKART document:', e);
    }
  };
  
  return (
    <Modal title="Dodijeli SKART" onClose={onClose}>
      {skartDocs.length === 0 ? <div>Nema aktivnih SKART naloga (SUBMITTED).</div> : (
        <div>
          {skartDocs.map((doc:any) => {
            const isAssigned = doc.assignedToUserId && doc.assignedToUserId !== null;
            const assignedChip = isAssigned
              ? <span style={{ marginLeft:8, background: colors.textSecondary, color: '#111', borderRadius:999, padding:'2px 8px', fontSize:12, fontWeight:600 }}>DODELJEN</span>
              : null;
            const statusLabel = doc.status === 'SUBMITTED' ? 'SUBMITOVANO' : 'PRIMLJENO';
            const assignedName = isAssigned ? (workersMap.get(doc.assignedToUserId) || `ID #${doc.assignedToUserId}`) : '';
            return (
              <div key={doc.uid} style={{ borderBottom:`1px solid ${colors.borderCard}`, padding:'8px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:600 }}>{doc.uid} {assignedChip}</div>
                  <div style={{ fontSize:12, color: colors.textPrimary }}>
                    {doc.storeName || '—'} · {statusLabel}
                    {isAssigned && assignedName ? ` · ${assignedName}` : ''}
                  </div>
                </div>
                <button style={btn} onClick={()=>assign(doc.uid, doc.assignedToUserId)}>Dodijeli ovom radniku</button>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function AssignPovracajModal({ userId, onClose }: { userId?: number; onClose: () => void }){
  const [povracajDocs, setPovracajDocs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [workersMap, setWorkersMap] = useState<Map<number, string>>(new Map());
  
  useEffect(() => { 
    (async()=>{ 
      try{ 
        const [docsResult, workersResult] = await Promise.all([
          apiClient.getPovracajDocuments({ status: 'SUBMITTED' }),
          apiClient.get('/receiving/warehouse-workers').catch(() => [])
        ]);
        const lst = Array.isArray(docsResult?.data) ? docsResult.data : (Array.isArray(docsResult) ? docsResult : []);
        setPovracajDocs(lst);
        setWorkers(Array.isArray(workersResult) ? workersResult : []);
        
        // Create map for quick lookup
        const map = new Map<number, string>();
        workersResult.forEach((w: any) => {
          const name = w.full_name || w.name || w.username || `ID ${w.id}`;
          map.set(w.id, name);
        });
        setWorkersMap(map);
      } catch(e) {
        console.error('Error loading Povracaj documents:', e);
      }
    })(); 
  }, []);
  
  const assign = async (uid: string, currentAssignedTo: number | null | undefined) => { 
    try{
      if (userId && currentAssignedTo && currentAssignedTo !== userId) {
        const currentName = workersMap.get(currentAssignedTo) || `ID #${currentAssignedTo}`;
        let msg = 'Ovaj Povracaj nalog je već dodeljen';
        msg += ` korisniku ${currentName}`;
        msg += '\nŽelite li da prebacite dodelu na ovog radnika?';
        if (!confirm(msg)) return;
      }
      await apiClient.assignPovracajDocument(uid, userId || null); 
      onClose(); 
    } catch(e) {
      console.error('Error assigning Povracaj document:', e);
      alert(e instanceof Error ? e.message : 'Greška pri dodeli');
    }
  };
  
  return (
    <Modal title="Dodijeli povracaj" onClose={onClose}>
      {povracajDocs.length === 0 ? <div>Nema aktivnih Povracaj naloga (SUBMITTED).</div> : (
        <div>
          {povracajDocs.map((doc:any) => {
            const isAssigned = doc.assignedToUserId && doc.assignedToUserId !== null;
            const assignedChip = isAssigned
              ? <span style={{ marginLeft:8, background: colors.textSecondary, color: '#111', borderRadius:999, padding:'2px 8px', fontSize:12, fontWeight:600 }}>DODELJEN</span>
              : null;
            const statusLabel = doc.status === 'SUBMITTED' ? 'SUBMITOVANO' : 'PRIMLJENO';
            const assignedName = isAssigned ? (workersMap.get(doc.assignedToUserId) || `ID #${doc.assignedToUserId}`) : '';
            return (
              <div key={doc.uid} style={{ borderBottom:`1px solid ${colors.borderCard}`, padding:'8px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:600 }}>{doc.uid} {assignedChip}</div>
                  <div style={{ fontSize:12, color: colors.textPrimary }}>
                    {doc.storeName || '—'} · {statusLabel}
                    {isAssigned && assignedName ? ` · ${assignedName}` : ''}
                  </div>
                </div>
                <button style={btn} onClick={()=>assign(doc.uid, doc.assignedToUserId)}>
                  {userId ? 'Dodijeli ovom radniku' : 'Dodijeli'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function AssignLauncher({ type, label, onAssigned }: { type: 'RECEIVING'|'SHIPPING'|'PUTAWAY'; label: string; onAssigned: () => void }){
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={()=>setOpen(true)} style={btn}>{label}</button>
      {open && <MultiAssignModal initialType={type} onClose={()=>{ setOpen(false); onAssigned(); }} />}
    </>
  );
}

function MultiAssignModal({ onClose, initialType }: { onClose: () => void; initialType?: 'RECEIVING'|'SHIPPING'|'PUTAWAY' }) {
  const [taskType, setTaskType] = useState<'RECEIVING'|'SHIPPING'|'PUTAWAY'>(initialType || 'RECEIVING');
  const [policy, setPolicy] = useState<'ANY_DONE'|'ALL_DONE'>('ANY_DONE');
  const [teams, setTeams] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [q, setQ] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<number|undefined>(undefined);
  const [selectedTaskId, setSelectedTaskId] = useState<number|undefined>(undefined);
  const [saving, setSaving] = useState(false);
  useEffect(() => { (async()=>{ try{ const t = await apiClient.get('/teams'); setTeams(Array.isArray(t)?t:[]);} catch{} })(); }, []);
  useEffect(() => { (async()=>{ try{ let lst:any[]=[]; if(taskType==='RECEIVING'){ lst=await apiClient.get('/receiving/active'); } else if(taskType==='SHIPPING'){ lst=await apiClient.get('/shipping/active'); } else { lst=await apiClient.get('/putaway/tasks/active'); } setTasks(Array.isArray(lst)?lst:[]); setSelectedTaskId(undefined);} catch{} })(); }, [taskType]);

  const submit = async () => {
    if (!selectedTaskId) return;
    const payload: any = { type: taskType, task_id: selectedTaskId };
    if (!selectedTeamId) return;
    payload.team_id = selectedTeamId;
    payload.policy = policy;
    setSaving(true);
    try {
      // Conflict detect and optional reassign
      try {
        const info = await apiClient.get(`/workforce/task-assignees/${taskType}/${selectedTaskId}`);
        const hasAssignees = info && Array.isArray(info.assignees) && info.assignees.length > 0;
        const otherTeamId = (info && typeof info.team_id === 'number') ? info.team_id : undefined;
        if (hasAssignees || (otherTeamId && otherTeamId !== selectedTeamId)) {
          let msg = 'Zadatak je već dodeljen.';
          if (otherTeamId && otherTeamId !== selectedTeamId) msg += ` (trenutni tim: #${otherTeamId})`;
          msg += '\nDa li želite da prebacite dodelu na izabrani tim?';
          const ok = confirm(msg);
          if (!ok) { setSaving(false); return; }
        }
      } catch {}
      await apiClient.post('/workforce/assign-task', payload);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(()=>{
    const qq = (q||'').toLowerCase();
    if (!qq) return tasks;
    const pick = (t:any) => [
      t.document_number,
      t.order_number,
      t.pallet_id,
      t.supplier_name,
      t?.supplier?.name,
      t.customer_name,
      t.customer?.name,
    ].filter(Boolean).map((x:any)=>String(x).toLowerCase()).some((s:string)=> s.includes(qq));
    return (tasks||[]).filter(pick);
  }, [tasks, q]);

  const statusBadge = (s:string) => {
    const ss = String(s||'').toUpperCase();
    let bg = colors.textSecondary, fg = '#111';
    if (['IN_PROGRESS','PICKING'].includes(ss)) { bg = colors.statusWarn; fg = '#000'; }
    if (['LOADED','CLOSED','DONE','COMPLETED'].includes(ss)) { bg = colors.statusOk; fg = colors.textPrimary; }
    return <span style={{ background:bg, color:fg, borderRadius:999, padding:'2px 8px', fontSize:12, fontWeight:600 }}>{ss||'STATUS'}</span>;
  };

  return (
    <Modal title="Dodjela zadatka timu" onClose={onClose}>
      <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
        <div style={{ flex:'1 1 220px' }}>
          <div style={{ fontWeight:600, marginBottom:6 }}>Vrsta zadatka</div>
          <select style={sel} value={taskType} onChange={e=>setTaskType(e.target.value as any)}>
            <option value="RECEIVING">Prijem</option>
            <option value="SHIPPING">Otprema</option>
            {/* Put-away hidden per request */}
          </select>

          <div style={{ fontWeight:600, marginTop:12, marginBottom:6 }}>Zadatak</div>
          <input
            value={q}
            onChange={e=>setQ(e.target.value)}
            placeholder="Pretraga (broj/partner)"
            style={{ ...sel, width:'100%', marginBottom:8 }}
          />
          <div style={{ maxHeight:260, overflow:'auto', border:`1px solid ${colors.borderCard}`, borderRadius:6 }}>
            {filtered.length === 0 ? <div style={{ padding:8, color: colors.textPrimary }}>Nema aktivnih.</div> : filtered.map((t:any)=> (
              <label key={t.id} style={{ display:'block', padding:'6px 8px', borderBottom:`1px solid ${colors.borderCard}` }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600 }}>
                      <input type="radio" name="task" checked={selectedTaskId===t.id} onChange={()=>setSelectedTaskId(t.id)} />{' '}
                      {t.document_number || t.order_number || t.pallet_id || `#${t.id}`}
                    </div>
                    <div style={{ fontSize:12, color: colors.textPrimary }}>
                      {(t.supplier_name || t?.supplier?.name || t.customer_name || t?.customer?.name || '')}
                    </div>
                  </div>
                  <div>
                    {statusBadge(t.status)}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div style={{ flex:'1 1 220px' }}>
          <div style={{ fontWeight:600, marginTop:12, marginBottom:6 }}>Policy završetka</div>
          <label style={{ display:'block', marginBottom:6 }}>
            <input type="radio" name="pol" checked={policy==='ANY_DONE'} onChange={()=>setPolicy('ANY_DONE')} /> ANY_DONE (prvi koji završi)
          </label>
          <label style={{ display:'block', marginBottom:6 }}>
            <input type="radio" name="pol" checked={policy==='ALL_DONE'} onChange={()=>setPolicy('ALL_DONE')} /> ALL_DONE (svi članovi)
          </label>
          <div>
            <div style={{ fontWeight:600, marginTop:12, marginBottom:6 }}>Tim</div>
            <select style={sel} value={selectedTeamId || ''} onChange={e=>setSelectedTeamId(Number(e.target.value))}>
              <option value="">— izaberi tim —</option>
              {teams.map((t:any)=> <option key={t.id} value={t.id}>{t.name} ({(t.members||[]).length})</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={{ marginTop:16, textAlign:'right' }}>
        <button style={btn} onClick={submit} disabled={saving || !selectedTaskId}>{saving ? 'Dodjeljivanje…' : 'Dodijeli'}</button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: any) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background: 'linear-gradient(180deg,#111522,#090b14)', color: colors.textPrimary, border:'1px solid rgba(255,255,255,0.08)', borderRadius:24, width:'95%', maxWidth:900, boxShadow:'0 25px 55px rgba(0,0,0,0.65)' }}>
        <div style={{ padding:16, display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontWeight:700, fontSize:18 }}>{title}</div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#fff', fontSize:22, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ padding:20 }}>{children}</div>
        <div style={{ padding:16, textAlign:'right', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
          <button style={btn} onClick={onClose}>Zatvori</button>
        </div>
      </div>
    </div>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div style={{ height: 8, background:'rgba(255,255,255,0.08)', borderRadius: 999, overflow:'hidden', marginTop:4, marginBottom:4 }}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height:'100%', background: colors.brandYellow }} />
    </div>
  );
}

function badge(status: string) {
  const map: any = { ONLINE: { bg:'#28a745', color:'#fff' }, OFFLINE: { bg:'#9ca3af', color:'#111' }, NEAKTIVAN: { bg:'#dc3545', color:'#fff' } };
  const s = map[status] || { bg:'#9ca3af', color:'#111' };
  return <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding:'2px 10px', fontSize:12, fontWeight:600 }}>{status}</span>;
}

function putawayBadge(ageMinutes: number) {
  let bg: string = colors.statusOk;
  let color: string = colors.textPrimary;
  if (ageMinutes > 30) { bg = colors.statusErr; }
  else if (ageMinutes > 15) { bg = colors.statusWarn; }
  return { padding: '2px 8px', borderRadius: 6, background: bg, color, fontSize: '0.75rem', fontWeight: 600 } as const;
}

function shippingBadgeFixed() {
  // Keep shipping badge visually identical to requested green pill
  return { padding: '2px 8px', borderRadius: 6, background: '#28a745', color: '#ffffff', fontSize: '0.75rem', fontWeight: 600 } as const;
}

function receivingBadge() {
  // Fixed visual per request (green pill, white text)
  return { padding: '2px 8px', borderRadius: 6, background: '#28a745', color: '#ffffff', fontSize: '0.75rem', fontWeight: 600 } as const;
}

function labelForShift(v?: string) {
  if (v === 'PRVA') return 'PRVA (08-15)';
  if (v === 'DRUGA') return 'DRUGA (12-19)';
  if (v === 'OFF') return 'OFF';
  return 'NEDODELJEN';
}

function ago(ts?: string | Date | null) {
  if (!ts) return '—';
  const t = typeof ts === 'string' ? new Date(ts).getTime() : (ts as any).getTime();
  const diff = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diff < 60) return `${diff}s`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

const grid = { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 } as const;
const card = { border:'1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: 20, boxShadow:'0 18px 35px rgba(0,0,0,0.45)', background:'linear-gradient(180deg,#111522,#090b14)', display:'flex', flexDirection:'column', gap:8, color:'#f8fafc' } as const;
const btn = { background: colors.brandYellow, color:'#111', border:'none', padding:'8px 14px', borderRadius:999, cursor:'pointer', fontWeight:600, letterSpacing:0.5 } as const;
const th = { textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 12, color:'rgba(255,255,255,0.65)', textTransform:'uppercase' as const } as const;
const td = { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 13, color:'#f8fafc' } as const;
const sel = { padding:'8px 14px', border:'1px solid rgba(255,255,255,0.1)', borderRadius:999, background:'rgba(255,255,255,0.05)', color:'#f8fafc' } as const;

function StatusChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:'10px 16px', minWidth:140 }}>
      <div style={{ fontSize:12, textTransform:'uppercase', letterSpacing:1, color:'rgba(255,255,255,0.5)' }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:700, color:'#fff' }}>{value}</div>
    </div>
  );
}
