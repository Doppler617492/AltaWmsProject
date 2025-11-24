import { useEffect, useState } from 'react';
import PwaHeader from '../../components/PwaHeader';
import PwaBackButton from '../../components/PwaBackButton';

export default function PopisWorkScreen({ taskId }: { taskId: number }){
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const apiBase = typeof window !== 'undefined' ? `${window.location.origin}/api/fresh` : 'http://localhost:8000';
  const token = typeof window !== 'undefined' ? localStorage.getItem('token')||'' : '';
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' } as any;

  const load = async ()=>{ setLoading(true); try{ const r = await fetch(`${apiBase}/cycle-count/task/${taskId}`, { headers: auth }); const d = await r.json(); setTask(d);} catch{} finally{ setLoading(false);} };
  useEffect(()=>{ load(); },[taskId]);

  const updateLine = async (line:any, val:number)=>{ await fetch(`${apiBase}/cycle-count/line/${line.id}`, { method:'PATCH', headers: auth, body: JSON.stringify({ counted_qty: val }) }); load(); };
  const complete = async ()=>{ await fetch(`${apiBase}/cycle-count/task/${taskId}/complete`, { method:'PATCH', headers: auth }); setDone(true); };

  if (done) return (
    <div className="min-h-screen bg-white p-8 text-center">
      <div className="text-2xl font-bold mb-4">Popis predat šefu magacina.</div>
      <a href="/pwa/popis" className="px-4 py-2 rounded" style={{ background:'#ffc107', color:'#000' }}>Nazad na moje popise</a>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <PwaHeader name={''} onLogout={()=>{ localStorage.removeItem('token'); window.location.href='/'; }} />
      <div style={{ padding: '12px 16px 0' }}>
        <PwaBackButton />
      </div>
      <div className="w-full px-4 py-2 flex items-center justify-between" style={{ background:'#0a0a0a', color:'#ffc107', borderBottom:'1px solid rgba(255,195,0,0.4)' }}>
        <a href="/pwa/popis" className="font-bold" style={{ color:'#ffc107' }}>← Nazad</a>
        <div className="font-bold">POPIS #{taskId}</div>
        <div />
      </div>
      <div className="p-4">
        {loading || !task ? <div>Učitavanje…</div> : (
          <div>
            <div className="text-lg font-bold mb-2">{task.scope} · {task.target_code}</div>
            <div className="mb-3">Status: {task.status}</div>
            <table className="w-full" style={{ borderCollapse:'collapse' }}>
              <thead><tr><th className="text-left p-2 border-b">Artikal</th><th className="text-left p-2 border-b">Sistem</th><th className="text-left p-2 border-b">Uneto</th><th className="text-left p-2 border-b">Razlika</th></tr></thead>
              <tbody>
                {(task.lines||[]).map((l:any)=>(
                  <tr key={l.id}>
                    <td className="p-2 border-b">{l.item_id}</td>
                    <td className="p-2 border-b">{l.system_qty}</td>
                    <td className="p-2 border-b">
                      <input type="number" defaultValue={l.counted_qty||''} onBlur={(e)=>{ const v=parseFloat(e.target.value||'0'); updateLine(l, v); }} className="border p-2 rounded w-24" />
                    </td>
                    <td className="p-2 border-b" style={{ color: Math.abs(parseFloat(l.difference||'0'))>10?'#dc2626':'#111' }}>{l.difference||'-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 text-center">
              <button className="px-4 py-3 rounded font-bold" style={{ background:'#ffc107', color:'#000' }} onClick={complete}>Završi popis</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
