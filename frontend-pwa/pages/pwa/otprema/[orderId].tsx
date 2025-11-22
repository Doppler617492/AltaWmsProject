import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import PwaHeader from '../../../components/PwaHeader';
import { apiClient } from '../../../lib/apiClient';

export default function ShippingWorkScreen() {
  const router = useRouter();
  const { orderId } = router.query as { orderId?: string };
  const [user, setUser] = useState<any|null>(null);
  const [order, setOrder] = useState<any|null>(null);
  const [loading, setLoading] = useState(true);
  // No manual location entry in PWA: we keep backend-suggested location implicitly
  const [pick, setPick] = useState<{ lineId: number; qty: string; req: number; reason: string; defaultLoc?: string }|null>(null);

  useEffect(()=>{
    const token = localStorage.getItem('token');
    if (!token) { router.push('/'); return; }
    const payload = JSON.parse(atob(token.split('.')[1]));
    setUser({ id: payload.sub, username: payload.username, role: payload.role });
  },[]);

  useEffect(()=>{ if (!orderId) return; load(); }, [orderId]);
  async function load(){
    if (!orderId) return;
    try {
      setLoading(true);
      const detail = await apiClient.get(`/shipping/order/${orderId}`);
      setOrder(detail || null);
    } catch (err:any) {
      console.error('Greška pri učitavanju otpreme', err);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  async function submitPick() {
    if (!pick) return;
    const qtyNum = Number(pick.qty ?? '0');
    if (Number.isNaN(qtyNum) || qtyNum < 0) { alert('Unesite validnu količinu'); return; }
    if (qtyNum !== pick.req && !(pick.reason || '').trim()) { alert('Unesite razlog odstupanja'); return; }
    try {
      await apiClient.patch(`/shipping/line/${pick.lineId}/pick`, { picked_qty: qtyNum, from_location_code: pick.defaultLoc, reason: pick.reason || undefined });
      setPick(null);
      await load();
    } catch(e:any) {
      alert(e?.message||'Greška');
    }
  }

  if (!user) return null;
  if (loading) return <div style={{ padding:12 }}>Učitavanje…</div>;
  if (!order) return <div style={{ padding:12 }}>Nalog nije pronađen</div>;
 
  const isLineComplete = (ln: any) => {
    const picked = Number(ln.picked_qty || 0);
    const requested = Number(ln.requested_qty || 0);
    if (!Number.isFinite(picked) || !Number.isFinite(requested)) return false;
    if (picked >= requested) return true;
    return Boolean(ln.has_discrepancy);
  };

  const sortedLines = [...(order.lines||[])].sort((a:any,b:any)=>{
    const aDone = isLineComplete(a);
    const bDone = isLineComplete(b);
    if (aDone === bDone) return 0;
    return aDone ? 1 : -1;
  });
  const allPicked = sortedLines.every((l:any)=> isLineComplete(l));

  async function finishOrder(){
  if (!allPicked) { alert('Potvrdi sve stavke pre završetka.'); return; }
    try {
    await apiClient.patch(`/shipping/order/${orderId}/finish-pwa`, {});
    alert('Nalog postavljen na rampu.');
      router.push('/pwa/otprema');
  } catch(e:any){ alert(e?.message||'Greška pri završavanju'); }
  }

  return (
    <div>
      <PwaHeader name={user.username} onLogout={()=>{ localStorage.removeItem('token'); router.push('/'); }} />
      <div style={{ padding: 12 }}>
        <button onClick={()=>router.back()} style={{ background:'transparent', color:'#FFC300', border:'1px solid #FFC300', padding:'8px 12px', borderRadius:8, marginBottom: 8 }}>← Nazad</button>
        <div style={{ fontWeight:'bold', fontSize: 18, marginBottom: 4, color:'#FFC300' }}>{order.order_number}</div>
        <div style={{ color:'#fff', marginBottom: 12 }}>{order.customer_name} · Status: {order.status}</div>

        {/* Modern grid cards (dark on dark, yellow only for buttons) */}
        <div style={{ display:'grid', gap: 14, gridTemplateColumns: '1fr', paddingBottom: 8 }}>
          {sortedLines.map((ln:any)=> {
            const isCompleted = isLineComplete(ln);
            const currentPicked = Number(ln.picked_qty || 0);
            return (
            <div key={ln.line_id} style={{ background: isCompleted ? '#14321d' : '#222222', borderRadius: 12, padding: 14, border: isCompleted ? '2px solid #2ecc71' : 'none' }}>
              <div style={{ fontWeight:800, fontSize: 16, color:'#ffffff' }}>{ln.item_sku} — {ln.item_name}</div>
              <div style={{ color:'#9ca3af', marginTop: 6, fontSize: 13 }}>Traženo: {ln.requested_qty} {ln.uom} · Pokupio: {ln.picked_qty||0}</div>
              {isCompleted && (
                <div style={{ marginTop: 6, fontSize: 12, color: ln.has_discrepancy ? '#f97316' : '#2ecc71' }}>
                  {ln.has_discrepancy ? 'Zabeležena razlika' : 'Linija završena'}
                  {ln.condition_notes ? ` · Napomena: ${ln.condition_notes}` : ''}
                </div>
              )}
              <button
                onClick={()=>setPick({ 
                  lineId: ln.line_id, 
                  qty: isCompleted ? String(currentPicked) : (currentPicked ? String(currentPicked) : ''), 
                  req: ln.requested_qty, 
                  reason: ln.condition_notes || '', 
                  defaultLoc: ln.pick_from_location_code 
                })}
                style={{ 
                  width:'100%', 
                  background: isCompleted ? '#1f6f3f' : '#FFC300', 
                  color: isCompleted ? '#fff' : '#000', 
                  border:'none', 
                  padding: 12, 
                  borderRadius: 10, 
                  fontWeight:'bold', 
                  marginTop: 10 
                }}>
                {isCompleted ? 'Izmeni količinu' : (currentPicked > 0 ? 'Ažuriraj količinu' : 'Potvrdi preuzimanje')}
              </button>
            </div>
          )})}
        </div>

      <div style={{ marginTop: 16 }}>
        <button 
          onClick={finishOrder} 
          disabled={!allPicked}
          style={{ 
            width:'100%', 
            background: allPicked ? '#FFC300' : '#555', 
            color: allPicked ? '#000' : '#ccc', 
            border:'none', 
            padding: 12, 
            borderRadius: 10, 
            fontWeight:'bold',
            opacity: allPicked ? 1 : 0.6 
          }}>
          Završi nalog
        </button>
      </div>
      </div>

      {pick && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex: 1000 }}>
          <div style={{ background:'#000', border:'2px solid #FFC300', borderRadius: 12, padding: 16, width:'100%', maxWidth: 380 }}>
            <div style={{ fontWeight:'bold', marginBottom: 8, color:'#FFC300' }}>Ukupno odabrano</div>
            <input value={pick.qty} onChange={e=>setPick({ ...pick, qty: e.target.value })} placeholder="Unesite ukupnu količinu" style={{ width:'100%', padding:12, border:'1px solid #333', background:'#111', color:'#fff', borderRadius:10, marginBottom: 12 }} />
            <div style={{ color:'#9ca3af', fontSize: 12, marginBottom: 8 }}>Traženo: {pick.req}</div>
            {Number(pick.qty||'0') !== pick.req && (
              <textarea value={pick.reason} onChange={e=>setPick({ ...pick, reason: e.target.value })} placeholder="Razlog odstupanja (obavezno)" rows={2} style={{ width:'100%', padding:12, border:'1px solid #333', background:'#111', color:'#fff', borderRadius:10, marginBottom: 12, resize:'none' }} />
            )}
            <div style={{ display:'flex', gap: 8 }}>
              <button onClick={()=>setPick(null)} style={{ flex:1, background:'transparent', color:'#FFC300', border:'1px solid #FFC300', padding:12, borderRadius:10 }}>Otkaži</button>
              <button onClick={submitPick} style={{ flex:1, background:'#FFC300', color:'#000', border:'none', padding:12, borderRadius:10 }}>Potvrdi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
