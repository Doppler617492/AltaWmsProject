import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { colors } from '../src/theme/colors';
import { IconCycleCount } from '../src/components/icons/IconCycleCount';

export default function CycleCountDashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState<any|null>(null);

  const load = async () => { setLoading(true); try { const d = await apiClient.get('/cycle-count/tasks'); setTasks(Array.isArray(d)?d:[]);} catch{} finally{ setLoading(false);} };
  useEffect(() => { load(); }, []);

  const statusCounts = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconCycleCount size={20} color={colors.brandYellow} />
          <h3 style={{ margin: 0, color: colors.brandYellow, fontSize: 18, fontWeight: 700 }}>POPIS</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {statusCounts['IN_PROGRESS'] > 0 && <span style={pill(colors.statusWarn + '40', colors.statusWarn)}>{statusCounts['IN_PROGRESS']} u toku</span>}
          {statusCounts['COMPLETED'] > 0 && <span style={pill(colors.statusOk + '40', colors.statusOk)}>{statusCounts['COMPLETED']} završeno</span>}
          <button 
            onClick={()=>setShowNew(true)} 
            style={createBtn}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = colors.brandYellowDim;
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = colors.brandYellow;
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            }}
          >
            Novi popis
          </button>
        </div>
      </div>
      {loading ? <div style={{ padding: 24, textAlign: 'center', color: colors.textSecondary }}>Učitavanje…</div> : tasks.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: colors.textSecondary }}>
          <IconCycleCount size={48} color={colors.textSecondary} />
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary, marginTop: 16 }}>Nema popisa</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>Kliknite na &quot;Novi popis&quot; da kreirate prvi zadatak</div>
        </div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>ID</th>
                <th style={th}>Tip</th>
                <th style={th}>Target</th>
                <th style={th}>Dodeljeno</th>
                <th style={th}>Status</th>
                <th style={th}>Akcije</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t:any, idx:number)=>(
                <tr 
                  key={t.id} 
                  style={{ ...trStyle, background: idx % 2 === 0 ? 'rgba(255,193,7,0.04)' : 'transparent' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = colors.bgPanelAlt)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={td}>{t.id}</td>
                  <td style={td}>
                    <span style={badgeStyle(t.scope === 'LOKACIJA' ? colors.brandBlueDock : colors.brandOrange)}>
                      {t.scope}
                    </span>
                  </td>
                  <td style={{...td, fontWeight: 600, color: colors.brandYellow}}>{t.target_code}</td>
                  <td style={td}>{t.assigned_to_user_id||'-'}</td>
                  <td style={td}>
                    <StatusBadge status={t.status} />
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button 
                        style={actionBtn} 
                        onClick={async()=>{ const d=await apiClient.get(`/cycle-count/task/${t.id}`); setDetail(d); }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = colors.brandYellow + '20';
                          (e.currentTarget as HTMLElement).style.borderColor = colors.brandYellow;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                          (e.currentTarget as HTMLElement).style.borderColor = colors.borderDefault;
                        }}
                      >
                        Pregled
                      </button>
                      {t.status==='COMPLETED' && (
                        <button 
                          style={{...actionBtn, backgroundColor: colors.statusOk + '20', borderColor: colors.statusOk, color: colors.statusOk}} 
                          onClick={async()=>{ await apiClient.post(`/cycle-count/task/${t.id}/reconcile`); load(); }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = colors.statusOk + '40';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = colors.statusOk + '20';
                          }}
                        >
                          Knjizi
                        </button>
                      )}
                      {(t.status==='OPEN') && (
                        <button
                          style={{ ...actionBtn, backgroundColor: colors.brandYellow, borderColor: colors.brandYellow, color: '#fff', fontWeight:700 }}
                          onClick={async()=>{ if(!confirm('Obrisati zadatak popisa?')) return; await apiClient.delete(`/cycle-count/task/${t.id}`); load(); }}
                        >
                          Izbriši
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && <NewTaskModal onClose={(ok?:boolean)=>{ setShowNew(false); if(ok) load(); }} />}
      {detail && <TaskDetailModal task={detail} onClose={()=>setDetail(null)} onReconcile={async()=>{ await apiClient.post(`/cycle-count/task/${detail.id}/reconcile`); setDetail(null); load(); }} />}
    </div>
  );
}

function NewTaskModal({ onClose }: { onClose: (ok?:boolean)=>void }) {
  const [scope, setScope] = useState<'LOKACIJA'|'ZONA'>('LOKACIJA');
  const [target, setTarget] = useState('');
  const [assign, setAssign] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [workers, setWorkers] = useState<any[]>([]);
  useEffect(() => { (async()=>{ try{ const d = await apiClient.get('/workforce/overview'); setWorkers(Array.isArray(d)?d:[]);} catch{} })(); }, []);
  const submit = async () => {
    setSubmitting(true);
    try {
      await apiClient.post('/cycle-count/task', { scope, target_code: target, assign_to_user_id: assign?parseInt(assign):undefined });
      onClose(true);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Modal title="Novi popis" onClose={()=>onClose()}>
      <div style={{ display:'grid', gap: 16 }}>
        <div>
          <label style={labelStyle}>Tip popisa</label>
          <select value={scope} onChange={e=>setScope(e.target.value as any)} style={input}>
            <option value="LOKACIJA">LOKACIJA</option>
            <option value="ZONA">ZONA</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Target code</label>
          <input value={target} onChange={e=>setTarget(e.target.value)} style={input} placeholder={scope==='LOKACIJA'?'npr 1A001001':'npr Zona A'} />
        </div>
        <div>
          <label style={labelStyle}>Kome dodijeliti</label>
          <select value={assign} onChange={e=>setAssign(e.target.value)} style={input}>
            <option value="">(nije obavezno)</option>
            {workers.map(w=><option key={w.user_id} value={w.user_id}>{w.full_name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button 
            style={cancelBtn} 
            onClick={()=>onClose()} 
            disabled={submitting}
            onMouseEnter={(e) => {
              if (!submitting) {
                (e.currentTarget as HTMLElement).style.backgroundColor = colors.bgPanelAlt;
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            Otkaži
          </button>
          <button 
            style={createBtn} 
            onClick={submit} 
            disabled={submitting || !target.trim()}
            onMouseEnter={(e) => {
              if (!submitting && target.trim()) {
                (e.currentTarget as HTMLElement).style.backgroundColor = colors.brandYellowDim;
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = colors.brandYellow;
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            }}
          >
            {submitting ? 'Kreiranje...' : 'Kreiraj'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TaskDetailModal({ task, onClose, onReconcile }: { task:any; onClose:()=>void; onReconcile:()=>void }) {
  const lines = task.lines || [];
  const totalDifferences = lines.reduce((sum: number, l: any) => sum + Math.abs(parseFloat(l.difference || '0')), 0);
  const hasDiscrepancies = totalDifferences > 0;
  
  return (
    <Modal title={`Popis #${task.id}`} onClose={onClose}>
      <div style={{ marginBottom: 16, padding: 12, background: colors.bgPanelAlt, borderRadius: 8 }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>Tip</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary }}>{task.scope}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>Target</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: colors.brandYellow }}>{task.target_code}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>Status</div>
            <div style={{ marginTop: 4 }}><StatusBadge status={task.status} /></div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>Ukupno razlika</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: hasDiscrepancies ? colors.statusWarn : colors.textPrimary }}>
              {totalDifferences}
            </div>
          </div>
        </div>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>SKU</th>
              <th style={th}>System</th>
              <th style={th}>Counted</th>
              <th style={th}>Razlika</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l:any, idx:number)=>(
              <tr 
                key={l.id} 
                style={{ ...trStyle, background: idx % 2 === 0 ? 'rgba(255,193,7,0.04)' : 'transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = colors.bgPanelAlt)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{...td, fontWeight: 600}}>{l.item_id}</td>
                <td style={td}>{l.system_qty}</td>
                <td style={td}>{l.counted_qty||'-'}</td>
                <td style={{...td, fontWeight: 600, color: diffColor(parseFloat(l.difference||'0'))}}>{l.difference||'-'}</td>
                <td style={td}><StatusBadge status={l.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {task.status==='COMPLETED' && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button 
            style={createBtn} 
            onClick={onReconcile}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = colors.brandYellowDim;
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = colors.brandYellow;
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            }}
          >
            Knjizi razlike
          </button>
        </div>
      )}
    </Modal>
  );
}

function Modal({ title, children, onClose }: any) {
  return (
    <div 
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
      onClick={onClose}
    >
      <div 
        style={{ background:colors.bgPanel, border:`1px solid ${colors.borderStrong}`, borderRadius:12, width:'95%', maxWidth:900, maxHeight:'90vh', overflow:'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding:16, background:colors.brandYellow, color:'#000', borderTopLeftRadius:12, borderTopRightRadius:12, fontWeight:700, fontSize:18 }}>{title}</div>
        <div style={{ padding:24 }}>{children}</div>
        <div style={{ padding:12, borderTop:`1px solid ${colors.borderDefault}`, textAlign:'right' }}>
          <button 
            style={cancelBtn} 
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

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { bg: string; color: string }> = {
    'CREATED': { bg: colors.bgPanelAlt + '40', color: colors.textSecondary },
    'IN_PROGRESS': { bg: colors.statusWarn + '40', color: colors.statusWarn },
    'COMPLETED': { bg: colors.statusOk + '40', color: colors.statusOk },
    'RECONCILED': { bg: colors.brandYellow + '40', color: colors.brandYellow },
  };
  const cfg = statusConfig[status] || statusConfig['CREATED'];
  
  return (
    <span style={{
      padding: '4px 10px',
      borderRadius: 999,
      fontWeight: 600,
      fontSize: 11,
      textTransform: 'uppercase',
      backgroundColor: cfg.bg,
      color: cfg.color,
    }}>
      {status.replace('_', ' ')}
    </span>
  );
}

function diffColor(v:number) { 
  if (Math.abs(v) > 10) return colors.statusErr;
  if (Math.abs(v) > 0) return colors.statusWarn;
  return colors.textPrimary;
}

const table = { width:'100%', borderCollapse:'collapse', color: colors.textPrimary } as const;
const th = { 
  textAlign: 'left' as const, 
  padding: '12px 16px', 
  borderBottom: `1px solid ${colors.borderDefault}`, 
  backgroundColor: colors.bgPanelAlt,
  color: colors.brandYellow,
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase' as const
} as const;
const td = { 
  padding: '12px 16px', 
  borderBottom: `1px solid ${colors.borderCard}`, 
  fontSize: 14,
  color: colors.textSecondary
} as const;
const trStyle = {
  transition: 'background 0.2s',
  cursor: 'pointer'
} as const;
const actionBtn = { 
  background: 'transparent',
  border:`1px solid ${colors.borderDefault}`, 
  color: colors.brandYellow,
  padding:'6px 12px', 
  borderRadius:6, 
  cursor:'pointer',
  fontSize: 13,
  fontWeight: 600,
  transition: 'all 0.2s'
};
const createBtn = { 
  background: colors.brandYellow, 
  border: `1px solid ${colors.brandYellow}`,
  color: '#000',
  padding:'10px 20px', 
  borderRadius:6, 
  cursor:'pointer',
  fontSize: 14,
  fontWeight: 700,
  transition: 'all 0.2s'
};
const cancelBtn = {
  background: 'transparent',
  border: `1px solid ${colors.borderDefault}`,
  color: colors.textSecondary,
  padding: '8px 16px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 600,
  transition: 'all 0.2s'
};
const input = { 
  padding:'10px 12px', 
  border:`1px solid ${colors.borderDefault}`, 
  borderRadius:6, 
  width:'100%',
  backgroundColor: colors.bgPanelAlt,
  color: colors.textPrimary,
  fontSize: 14
} as const;
const labelStyle = {
  display: 'block',
  marginBottom: 8,
  color: colors.textSecondary,
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase' as const
} as const;
const pill = (bg: string, color: string) => ({ 
  background: bg,
  color, 
  borderRadius:999, 
  padding:'6px 12px', 
  fontSize:12, 
  fontWeight:600 
} as const);
const badgeStyle = (color: string) => ({
  padding: '4px 10px',
  borderRadius: 999,
  fontWeight: 600,
  fontSize: 11,
  backgroundColor: color + '40',
  color: color,
  textTransform: 'uppercase' as const
} as const);
