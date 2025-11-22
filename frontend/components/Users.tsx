import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { colors } from '../src/theme/colors';

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success'|'error'; text: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [resetUser, setResetUser] = useState<any | null>(null);
  const [deleteUser, setDeleteUser] = useState<any | null>(null);
  const [actorRole, setActorRole] = useState<string>('');
  const [stores, setStores] = useState<any[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const list = await apiClient.get('/users');
      setUsers(Array.isArray(list) ? list : []);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || 'Greška pri učitavanju korisnika');
    } finally { setLoading(false); }
  };
  const loadStores = async () => {
    try {
      const list = await apiClient.get('/stores');
      setStores(Array.isArray(list) ? list : []);
    } catch {
      setStores([]);
    }
  };
  useEffect(() => {
    load();
    loadStores();
    // fetch current actor role to drive UI permissions
    (async () => {
      try { const me = await apiClient.get('/auth/me'); setActorRole((me?.role || '').toLowerCase()); } catch {}
    })();
  }, []);

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
          Administracija
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
          Upravljanje korisnicima sistema, ulogama i dozvolama.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
          <StatusChip label="Korisnika" value={String(users.length)} />
        </div>
      </div>

      <div style={{ background: 'rgba(15,23,42,0.75)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ color: colors.brandYellow, margin: 0, fontSize: 20, fontWeight: 700 }}>Korisnici</h3>
          <button style={{ background: 'rgba(250,204,21,0.1)', color: '#fde68a', border: '1px solid rgba(250,204,21,0.35)', padding: '10px 18px', borderRadius: 12, fontWeight: 600, cursor: 'pointer' }} onClick={()=>setShowCreate(true)}>Novi korisnik</button>
        </div>
        {toast && (
          <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 6, color: toast.type==='success'?'#155724':'#721c24', background: toast.type==='success'?'#d4edda':'#f8d7da', border: `1px solid ${toast.type==='success'?'#c3e6cb':'#f5c6cb'}` }}>
            {toast.text}
          </div>
        )}
        {loading ? <div style={{ color: colors.textPrimary, padding: 40, textAlign: 'center' }}>Učitavanje…</div> : err ? <div style={{ color: colors.statusErr, background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.3)', borderRadius:12, padding:'12px 16px', marginBottom:20 }}>{err}</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', color: colors.textPrimary }}>
          <thead>
            <tr>
              <th style={th}>Ime</th>
              <th style={th}>Username</th>
              <th style={th}>Uloga</th>
              <th style={th}>Prodavnica</th>
              <th style={th}>Smena</th>
              <th style={th}>Aktivnost</th>
              <th style={th}>Otvorenih prijema</th>
              <th style={th}>Akcije</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,193,7,0.04)' : 'transparent' }}>
                <td style={td}>{u.full_name}</td>
                <td style={td}>{u.username}</td>
                <td style={td}><span style={badge}>{formatRole(u.role)}</span></td>
                <td style={td}>{u.store_name || '—'}</td>
                <td style={td}>{u.shift}</td>
                <td style={td}>
                  {!u.active ? (<span style={{ ...badge, background:'#dc3545', color:'#fff' }}>NEAKTIVAN</span>) : (
                    u.last_heartbeat_at && (Date.now() - new Date(u.last_heartbeat_at).getTime())/60000 < 2
                      ? <span style={{ ...badge, background:'#28a745', color:'#fff' }}>ONLINE</span>
                      : <span style={{ ...badge, background:'#9ca3af', color:'#111' }}>OFFLINE</span>
                  )}
                </td>
                <td style={td}>{u.open_tasks_count}</td>
                <td style={td}>
                  <button style={btn} onClick={()=>setEditUser(u)}>Izmeni</button>
                  <button style={{ ...btn, marginLeft: 8 }} onClick={()=>setResetUser(u)}>Reset lozinke</button>
                  {actorRole === 'admin' && (
                    <button style={{ ...btn, marginLeft: 8, background:'#fee2e2', borderColor:'#ef4444', color:'#991b1b' }} onClick={()=>setDeleteUser(u)}>Obriši</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        )}
        {showCreate && <CreateUserModal stores={stores} onClose={(ok?:boolean)=>{ setShowCreate(false); if (ok) setToast({ type:'success', text:'Korisnik kreiran' }); load(); }} onError={(m:string)=>setToast({ type:'error', text:m })} />}
        {editUser && <EditUserModal stores={stores} user={editUser} onClose={(ok?:boolean)=>{ setEditUser(null); if (ok) setToast({ type:'success', text:'Korisnik izmenjen' }); load(); }} onError={(m:string)=>setToast({ type:'error', text:m })} />}
        {resetUser && <ResetPasswordModal user={resetUser} onClose={()=>{ setResetUser(null); }} onDone={()=>{ setToast({ type:'success', text:'Lozinka resetovana' }); load(); }} onError={(m:string)=>setToast({ type:'error', text:m })} />}
        {deleteUser && (
          <DeleteConfirmModal 
            user={deleteUser}
            onCancel={() => setDeleteUser(null)}
            onConfirm={async () => {
              try {
                await apiClient.delete(`/users/${deleteUser.id}`);
                setDeleteUser(null);
                setToast({ type:'success', text:'Korisnik obrisan' });
                load();
              } catch (e:any) {
                setToast({ type:'error', text: e?.message || 'Greška pri brisanju' });
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onError, stores }: { onClose: (ok?:boolean)=>void; onError: (m:string)=>void; stores: any[]; }) {
  const [form, setForm] = useState({ full_name:'', username:'', password:'', role:'magacioner', store_id:'' });
  const requiresStore = form.role === 'sef_prodavnice';
  const storeOptions = [{ value:'', label:'Bez prodavnice' }, ...stores.map((s:any)=>({ value:String(s.id), label:s.name }))];
  const save = async () => {
    if (requiresStore && !form.store_id) {
      onError('Šef prodavnice mora imati dodeljenu prodavnicu.');
      return;
    }
    try { 
      await apiClient.post('/users', {
        ...form,
        store_id: form.store_id ? Number(form.store_id) : null,
      }); 
      onClose(true); 
    } catch (e:any) { onError(e?.message||'Greška'); }
  };
  return (
    <Modal title="Novi korisnik" onClose={onClose}>
      <Input label="Ime i prezime" value={form.full_name} onChange={v=>setForm({ ...form, full_name:v })} />
      <Input label="Username" value={form.username} onChange={v=>setForm({ ...form, username:v })} />
      <Input label="Lozinka" type="password" value={form.password} onChange={v=>setForm({ ...form, password:v })} />
      <Select label="Uloga" value={form.role} onChange={v=>setForm({ ...form, role:v })} options={[ 'admin','menadzer','sef_magacina','magacioner','sef_prodavnice','logistika','komercijalista' ]} />
      <Select label="Prodavnica" value={form.store_id} onChange={v=>setForm({ ...form, store_id:v })} options={storeOptions} />
      <div style={{ marginTop: 10, textAlign:'right' }}>
        <button style={{ ...btn, background:'#ffc107', color:'#000' }} onClick={save}>Sačuvaj</button>
        <button style={{ ...btn, marginLeft: 8 }} onClick={()=>onClose()}>Otkaži</button>
      </div>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onError, stores }: { user:any; onClose: (ok?:boolean)=>void; onError: (m:string)=>void; stores: any[]; }) {
  const [form, setForm] = useState({ full_name: user.full_name, role: user.role, active: user.active, store_id: user.store_id ? String(user.store_id) : '' });
  const requiresStore = form.role === 'sef_prodavnice';
  const storeOptions = [{ value:'', label:'Bez prodavnice' }, ...stores.map((s:any)=>({ value:String(s.id), label:s.name }))];
  const save = async () => {
    if (requiresStore && !form.store_id) {
      onError('Šef prodavnice mora imati dodeljenu prodavnicu.');
      return;
    }
    try { 
      await apiClient.patch(`/users/${user.id}`, {
        ...form,
        store_id: form.store_id ? Number(form.store_id) : null,
      }); 
      onClose(true); 
    } catch (e:any) { onError(e?.message||'Greška'); }
  };
  return (
    <Modal title={`Izmena korisnika: ${user.username}`} onClose={onClose}>
      <Input label="Ime i prezime" value={form.full_name} onChange={v=>setForm({ ...form, full_name:v })} />
      <Select label="Uloga" value={form.role} onChange={v=>setForm({ ...form, role:v })} options={[ 'admin','menadzer','sef_magacina','magacioner','sef_prodavnice','logistika','komercijalista' ]} />
      <Select label="Prodavnica" value={form.store_id} onChange={v=>setForm({ ...form, store_id:v })} options={storeOptions} />
      <div style={{ margin: '10px 0' }}>
        <label><input type="checkbox" checked={form.active} onChange={e=>setForm({ ...form, active: e.target.checked })} /> Active</label>
      </div>
      <div style={{ marginTop: 10, textAlign:'right' }}>
        <button style={{ ...btn, background:'#ffc107', color:'#000' }} onClick={save}>Sačuvaj izmene</button>
        <button style={{ ...btn, marginLeft: 8 }} onClick={()=>onClose()}>Otkaži</button>
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose, onDone, onError }: { user:any; onClose: () => void; onDone: () => void; onError: (m:string)=>void; }) {
  const [password, setPassword] = useState('');
  const submit = async () => {
    try { await apiClient.post(`/users/${user.id}/reset-password`, { new_password: password }); onClose(); onDone(); } catch (e:any) { onError(e?.message||'Greška'); }
  };
  return (
    <Modal title={`Reset lozinke: ${user.username}`} onClose={onClose}>
      <Input label="Nova lozinka" type="password" value={password} onChange={setPassword} />
      <div style={{ marginTop: 10, textAlign:'right' }}>
        <button style={{ ...btn, background:'#ffc107', color:'#000' }} onClick={submit}>Resetuj lozinku</button>
        <button style={{ ...btn, marginLeft: 8 }} onClick={onClose}>Otkaži</button>
      </div>
    </Modal>
  );
}

function DeleteConfirmModal({ user, onCancel, onConfirm }: { user:any; onCancel: () => void; onConfirm: () => void; }) {
  return (
    <Modal title="Brisanje korisnika" onClose={onCancel}>
      <p>Da li ste sigurni da želite da obrišete korisnika <strong>{user.username}</strong>?</p>
      <div style={{ marginTop: 12, textAlign:'right' }}>
        <button style={{ ...btn, background:'#fee2e2', borderColor:'#ef4444', color:'#991b1b' }} onClick={onConfirm}>Da, obriši</button>
        <button style={{ ...btn, marginLeft: 8 }} onClick={onCancel}>Otkaži</button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: any) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#0a0a0a', color:'#fff', border:'1px solid #ffc107', borderRadius:8, width:'90%', maxWidth:600 }}>
        <div style={{ padding:12, background:'#ffc107', color:'#000', borderTopLeftRadius:8, borderTopRightRadius:8, fontWeight:'bold' }}>{title}</div>
        <div style={{ padding:16 }}>{children}</div>
        <div style={{ padding:12, textAlign:'right' }}>
          <button style={btn} onClick={onClose}>Zatvori</button>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type='text' }: any) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display:'block', fontWeight:'bold', marginBottom:6 }}>{label}</label>
      <input type={type} value={value} onChange={(e)=>onChange(e.target.value)} style={{ width:'100%', padding:10, border:'1px solid #444', background:'#0a0a0a', color:'#fff', borderRadius:6 }} />
    </div>
  );
}

function Select({ label, value, onChange, options }: any) {
  const normalized = (options || []).map((op: any) => {
    if (typeof op === 'string') return { value: op, label: formatRoleLabel(op) };
    return { value: op.value, label: op.label ?? formatRoleLabel(op.value) };
  });
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display:'block', fontWeight:'bold', marginBottom:6 }}>{label}</label>
      <select value={value ?? ''} onChange={(e)=>onChange(e.target.value)} style={{ width:'100%', padding:10, border:'1px solid #444', background:'#0a0a0a', color:'#fff', borderRadius:6 }}>
        {normalized.map((op:any)=>(<option key={op.value ?? op.label} value={op.value}>{op.label}</option>))}
      </select>
    </div>
  );
}

const th = { textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${colors.borderDefault}`, backgroundColor: colors.bgPanelAlt, color: colors.brandYellow, fontWeight: 600 } as const;
const td = { padding: '8px 12px', borderBottom: `1px solid ${colors.borderCard}`, color: colors.textPrimary } as const;
const badge = { padding: '2px 8px', borderRadius: 6, background: colors.bgPanel, color: colors.textPrimary, fontSize: '0.75rem' } as const;
const btn = { background: colors.bgPanel, border:`1px solid ${colors.borderDefault}`, color: colors.brandYellow, padding:'8px 12px', borderRadius:6, cursor:'pointer', fontSize: '0.875rem' } as const;

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  menadzer: 'Menadžer',
  sef_magacina: 'Šef magacina',
  magacioner: 'Magacioner',
  sef_prodavnice: 'Šef prodavnice',
  logistika: 'Logistika',
  komercijalista: 'Komercijalista',
  manager: 'Menadžer',
  store: 'Prodavnica',
  prodavnica: 'Prodavnica',
};

function formatRole(role: string) {
  if (!role) return '';
  const normalized = role.toLowerCase();
  if (ROLE_LABELS[normalized]) return ROLE_LABELS[normalized];
  return normalized.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatRoleLabel(value: string) {
  return formatRole(value);
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
