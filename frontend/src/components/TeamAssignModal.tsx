import { useEffect, useState } from 'react';

type AssignType = 'RECEIVING'|'SHIPPING'|'SKART'|'POVRACAJ';

export function TeamAssignModal({
  open,
  type,
  teamId,
  onClose,
  onAssigned,
  apiClient,
}: {
  open: boolean;
  type: AssignType;
  teamId: number | undefined;
  onClose: () => void;
  onAssigned: () => Promise<void> | void;
  apiClient: { 
    get: (p:string)=>Promise<any>; 
    post: (p:string,b:any)=>Promise<any>;
    getSkartDocuments?: (params?: { status?: string; limit?: number; offset?: number }) => Promise<any>;
    getPovracajDocuments?: (params?: { status?: string; limit?: number; offset?: number }) => Promise<any>;
  };
}){
  const [list, setList] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number|undefined>();
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(()=>{
    if (!open) return;
    (async()=>{
      try{
        let r: any;
        if (type==='RECEIVING') {
          r = await apiClient.get('/receiving/active');
        } else if (type==='SHIPPING') {
          r = await apiClient.get('/shipping/active');
        } else if (type==='SKART') {
          if (apiClient.getSkartDocuments) {
            r = await apiClient.getSkartDocuments({ status: 'SUBMITTED' });
            r = Array.isArray(r) ? r : (r?.data || []);
          } else {
            r = [];
          }
        } else if (type==='POVRACAJ') {
          if (apiClient.getPovracajDocuments) {
            r = await apiClient.getPovracajDocuments({ status: 'SUBMITTED' });
            r = Array.isArray(r) ? r : (r?.data || []);
          } else {
            r = [];
          }
        }
        setList(Array.isArray(r)? r : []);
      }catch{ setList([]); }
    })();
  }, [open, type, apiClient]);

  const submit = async () => {
    if (!teamId || !selectedId) return;
    setSaving(true);
    try{
      // Conflict detect: check existing assignees/team for this task
      try {
        const info = await apiClient.get(`/workforce/task-assignees/${type}/${selectedId}`);
        const hasAssignees = info && Array.isArray(info.assignees) && info.assignees.length > 0;
        const otherTeamId = (info && typeof info.team_id === 'number') ? info.team_id : undefined;
        if (hasAssignees) {
          let msg = 'Zadatak je već dodeljen.';
          if (otherTeamId && otherTeamId !== teamId) msg += ` (trenutni tim: #${otherTeamId})`;
          msg += '\nDa li želite da prebacite dodelu na izabrani tim?';
          const ok = confirm(msg);
          if (!ok) { setSaving(false); return; }
          // Proceed – backend će obrisati prethodne assignee zapise i postaviti nove
        }
      } catch { /* ako upit padne, nastavi sa dodelom */ }

      await apiClient.post('/workforce/assign-task', { type, task_id: selectedId, team_id: teamId, policy: 'ANY_DONE' });
      await onAssigned();
      onClose();
    }catch(e:any){ alert(e?.message||'Greška'); } finally { setSaving(false); }
  };

  if (!open) return null;

  const badgeFor = (st:string) => {
    const up = String(st||'').toUpperCase();
    const isWarn = /IN_PROGRESS|PICKING/.test(up);
    const isErr = /LOADED|CLOSED/.test(up);
    const bg = isErr ? '#dc3545' : isWarn ? '#ffc107' : '#6b7280';
    const fg = isErr ? '#fff' : isWarn ? '#000' : '#fff';
    const border = isWarn ? '#e0ac00' : isErr ? '#a00' : '#555';
    return { up, bg, fg, border };
  };

  const timeDesc = (it:any) => {
    const tsRaw = it.completed_at || it.started_at || it.created_at || it.updated_at || it.loaded_at || it.closed_at;
    if (!tsRaw) return '';
    const ts = new Date(tsRaw).getTime();
    const diff = Math.max(0, Date.now() - ts);
    const d = Math.floor(diff / (24*60*60*1000));
    if (d === 0) return 'danas';
    if (d === 1) return 'od juče';
    return `pre ${d}d`;
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'#0a0a0a', color:'#fff', border:'1px solid #ffc107', borderRadius:8, width:'95%', maxWidth:700 }}>
        <div style={{ padding:12, background:'#ffc107', color:'#000', borderTopLeftRadius:8, borderTopRightRadius:8, fontWeight:'bold' }}>
          Dodjela {type==='RECEIVING'?'prijema':type==='SHIPPING'?'otpreme':type==='SKART'?'SKART':'povraćaja'} timu
        </div>
        <div style={{ padding:16 }}>
          <div style={{ marginBottom: 8, display:'flex', gap:8 }}>
            <input
              type="text"
              placeholder={
                type==='RECEIVING' ? 'Pretraga (broj dokumenta, dobavljač)' :
                type==='SHIPPING' ? 'Pretraga (broj naloga, kupac)' :
                type==='SKART' ? 'Pretraga (UID, prodavnica)' :
                'Pretraga (UID, prodavnica)'
              }
              value={query}
              onChange={e=>setQuery(e.target.value)}
              style={{ flex:1, padding:'6px 8px', border:'1px solid #e5e7eb', borderRadius:6, color:'#111' }}
            />
          </div>
          {list.length === 0 ? (
            <div>Nema aktivnih {type==='RECEIVING'?'prijema':type==='SHIPPING'?'otprema':type==='SKART'?'SKART naloga':'Povraćaj naloga'}.</div>
          ) : (
            <div style={{ maxHeight: 300, overflow:'auto', border:'1px solid #eee', borderRadius:6 }}>
              {list.filter((it:any)=>{
                let label: string;
                let meta: string;
                if (type==='RECEIVING') {
                  label = it.document_number || `#${it.id}`;
                  meta = it.supplier_name || it.supplier?.name || '';
                } else if (type==='SHIPPING') {
                  label = it.order_number || `#${it.id}`;
                  meta = it.customer_name || '';
                } else if (type==='SKART') {
                  label = it.uid || `#${it.id}`;
                  meta = it.storeName || it.store_name || '';
                } else { // POVRACAJ
                  label = it.uid || `#${it.id}`;
                  meta = it.storeName || it.store_name || '';
                }
                const q = query.trim().toLowerCase();
                if (!q) return true;
                return label.toLowerCase().includes(q) || meta.toLowerCase().includes(q);
              }).map((it:any)=>{
                let label: string;
                let meta: string;
                let taskId: number;
                if (type==='RECEIVING') {
                  label = it.document_number || `#${it.id}`;
                  meta = it.supplier_name || it.supplier?.name || '';
                  taskId = it.id;
                } else if (type==='SHIPPING') {
                  label = it.order_number || `#${it.id}`;
                  meta = it.customer_name || '';
                  taskId = it.id;
                } else if (type==='SKART') {
                  label = it.uid || `#${it.id}`;
                  meta = it.storeName || it.store_name || '';
                  taskId = it.id;
                } else { // POVRACAJ
                  label = it.uid || `#${it.id}`;
                  meta = it.storeName || it.store_name || '';
                  taskId = it.id;
                }
                const st = String(it.status || it.status_per_line || it.order_status || '').toUpperCase();
                const b = badgeFor(st);
                const desc = timeDesc(it);
                return (
                  <label key={taskId} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 8px', borderBottom:'1px solid #f3f4f6' }}>
                    <span>
                      <input type="radio" name="teamAssign" checked={selectedId===taskId} onChange={()=>setSelectedId(taskId)} />{' '}
                      {label} {meta && <span style={{ color:'#9ca3af', fontSize:12 }}>· {meta}</span>}
                    </span>
                    {st && (
                      <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                        <span style={{ padding:'2px 8px', borderRadius:999, fontSize:12, background:b.bg, color:b.fg, border:`1px solid ${b.border}` }}>{b.up}</span>
                        {desc && <span style={{ fontSize:11, color:'#9ca3af' }}>{desc}</span>}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
          <div style={{ marginTop:12, textAlign:'right' }}>
            <button style={{ background:'#ffc107', color:'#000', border:'1px solid #e0ac00', padding:'6px 10px', borderRadius:6, fontWeight:600 }} onClick={onClose}>Zatvori</button>
            <button style={{ background:'#ffc107', color:'#000', border:'1px solid #e0ac00', padding:'6px 10px', borderRadius:6, fontWeight:600, marginLeft:8 }} disabled={!selectedId || saving} onClick={submit}>{saving? 'Dodjeljivanje…' : 'Dodijeli'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
