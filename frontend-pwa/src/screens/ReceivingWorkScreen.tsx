import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { completeReceiving, getReceivingDetail, patchReceivingItem, resolveLocation, getStockImpactByDocument, getRecommendedLocationsBySku, startReceiving } from '../lib/apiClient';
import { apiClient } from '../lib/apiClient';
import PwaHeader from '../../components/PwaHeader';
import PwaBackButton from '../../components/PwaBackButton';
import PreostaleStavkeModal from '../components/modals/PreostaleStavkeModal';
import UspesnoZaprimljenoModal from '../components/modals/UspesnoZaprimljenoModal';

export default function ReceivingWorkScreen() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const [doc, setDoc] = useState<any>(null);
  const [me, setMe] = useState<{ id: number; username: string; role: string } | null>(null);
  const [currentLoc, setCurrentLoc] = useState<{ id: number; code: string } | null>(null);
  const [scanCode, setScanCode] = useState('');
  const [preostaleOpen, setPreostaleOpen] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ name: string; qty: number; loc: string } | null>(null);
  const [errorMissing, setErrorMissing] = useState<any[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [successList, setSuccessList] = useState<any[] | null>(null);
  const [recommended, setRecommended] = useState<Array<{ id?: number; code: string }>>([]);
  const [recommendedIndex, setRecommendedIndex] = useState(0);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [docMeta, setDocMeta] = useState<{ document_date?: string | null; store_name?: string | null; responsible_person?: string | null; invoice_number?: string | null; created_by_name?: string | null } | null>(null);

  const loadAiSuggestion = async () => {
    // AI i lokacione preporuke su privremeno isključene
    setAiSuggestion(null);
  };

  useEffect(() => {
    // Load logged in user from token
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setMe({ id: payload.sub, username: payload.username, role: payload.role });
      }
    } catch {}
  }, []);

  const applyAiSuggestion = async (itemId: number, locationCode: string, quantity: number) => {
    try {
      const result = await apiClient.post('/putaway/apply', {
        receiving_item_id: itemId,
        location_code: locationCode,
        quantity,
      });

      setSuccessInfo({
        name: `${aiSuggestion?.item?.name || ''} (${aiSuggestion?.item?.sku || ''})`,
        qty: result.applied_qty,
        loc: locationCode,
      });

      // Reload document
      await load();
      
      // If remaining quantity, load next suggestion
      if (result.remaining_qty > 0) {
        await loadAiSuggestion();
      } else {
        setAiSuggestion(null);
      }
    } catch (e: any) {
      setToast(e?.message || 'Greška pri primeni predloga');
    }
  };

  const load = async () => {
    if (!id) return;
    const resp = await getReceivingDetail(Number(id));
    setDoc(resp);
    setDocMeta({
      document_date: resp.document_date,
      store_name: resp.store_name,
      responsible_person: resp.responsible_person,
      invoice_number: resp.invoice_number,
      created_by_name: resp.createdBy?.full_name || resp.createdBy?.name || resp.createdBy?.username || null,
    });
    // Try to pull recommendations based on first remaining item SKU
    try {
      const firstRemaining = (resp?.items || []).find((it: any) => ((it.expected_quantity || 0) - (it.received_quantity || 0)) > 0);
      if (firstRemaining?.item?.sku) {
        const rec = await getRecommendedLocationsBySku(firstRemaining.item.sku);
        // Try to normalize: expect either rec.recommendedLocations or array of codes
        let list: Array<{ code: string }> = [];
        if (Array.isArray(rec)) {
          list = rec.map((x: any) => ({ code: x.code || x }));
        } else if (rec?.recommendedLocations && Array.isArray(rec.recommendedLocations)) {
          list = rec.recommendedLocations.map((x: any) => ({ code: x.code || x }));
        }
        if (list.length > 0) {
          setRecommended(list);
          if (!currentLoc) setCurrentLoc({ id: 0, code: list[0].code });
        }
      }
    } catch {
      // Fallback
      const fallback = [{ code: '1A001001' }, { code: '1A001002' }];
      setRecommended(fallback);
      if (!currentLoc) setCurrentLoc({ id: 0, code: fallback[0].code });
    }
  };

  useEffect(() => {
    if (doc && remainingItems.length > 0 && remainingItems[0]?.raw) {
      loadAiSuggestion();
    } else {
      setAiSuggestion(null);
    }
  }, [doc]);

  useEffect(() => { load(); }, [id]);

  const remainingItems = useMemo(() => {
    const items = doc?.items || [];
    return items
      .map((it: any) => ({ name: `${it.item?.name} (${it.item?.sku})`, remaining: Math.max(0, (it.expected_quantity || 0) - (it.received_quantity || 0)), raw: it }))
      .filter((r: any) => r.remaining > 0);
  }, [doc]);

  // State za direktan unos količine na svakoj kartici
  const [itemInputs, setItemInputs] = useState<Record<number, { qty: string; reason: string }>>({});
  
  const updateItemInput = (itemId: number, field: 'qty' | 'reason', value: string) => {
    setItemInputs(prev => ({
      ...prev,
      [itemId]: { 
        qty: prev[itemId]?.qty || '', 
        reason: prev[itemId]?.reason || '',
        [field]: value 
      }
    }));
  };
  
  const submitItemInput = async (itemId: number, expected: number, received: number) => {
    const input = itemInputs[itemId] || { qty: '', reason: '' };
    const qtyNum = Number(input.qty || '0');
    
    if (isNaN(qtyNum) || qtyNum <= 0) { 
      setToast('Unesite validnu količinu'); 
      return; 
    }
    
    const remaining = Math.max(0, expected - received);
    const isDifferent = qtyNum !== remaining;
    
    if (isDifferent && !(input.reason || '').trim()) { 
      setToast('Obavezno unesite razlog odstupanja!'); 
      return; 
    }
    
    try {
      await patchReceivingItem(itemId, {
        received_quantity: received + qtyNum,
        status: 'scanned',
        condition_notes: isDifferent ? input.reason : undefined,
      });
      
      // Clear input for this item
      setItemInputs(prev => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });
      
      setSuccessInfo({ 
        name: `Uspešno zaprimljeno`, 
        qty: qtyNum, 
        loc: '' 
      });
      
      await load();
    } catch (e:any) { 
      setToast(e?.message || 'Greška pri čuvanju'); 
    }
  };
  
  // Keep old modal for compatibility
  const [edit, setEdit] = useState<{ itemId: number; expected: number; received: number; qty: string; reason: string } | null>(null);
  async function submitEdit() {
    if (!edit) return;
    const qtyNum = Number(edit.qty || '0');
    if (Number.isNaN(qtyNum) || qtyNum < 0) { setToast('Unesite validnu količinu'); return; }
    const shouldExplain = qtyNum !== edit.expected;
    if (shouldExplain && !edit.reason.trim()) { setToast('Unesite razlog odstupanja'); return; }
    try {
      await patchReceivingItem(edit.itemId, {
        received_quantity: qtyNum,
        status: 'scanned',
        condition_notes: shouldExplain ? (edit.reason || undefined) : undefined,
      });
      setEdit(null);
      await load();
    } catch (e:any) { setToast(e?.message || 'Greška pri čuvanju'); }
  }

  const onPlus = async () => {
    try {
      const text = (scanCode || '').trim();
      if (!text) return;
      const items = doc?.items || [];
      const match = items.find((it: any) => it.item?.sku === text || it.item?.barcode === text || it.item?.name?.toLowerCase().includes(text.toLowerCase()));
      if (!match) { setToast('Artikal ne pripada ovom prijemu'); return; }
      const remaining = Math.max(0, (match.expected_quantity || 0) - (match.received_quantity || 0));
      let qty = 1;
      let reason = '';
      const currentReceived = Number(match.received_quantity || 0);
      const expected = Number(match.expected_quantity || 0);
      // Ako je već ispunjeno ili unos vodi u over‑receive, zahtevaj potvrdu i razlog
      if (remaining <= 0 || (currentReceived + qty) !== expected) {
        if (!confirm('Količina odstupa od tražene. Želite li da nastavite?')) return;
        reason = prompt('Razlog odstupanja (obavezno):') || '';
        if (!reason.trim()) { setToast('Razlog odstupanja je obavezan'); return; }
      }
      await patchReceivingItem(match.id, { received_quantity: currentReceived + qty, status: 'scanned', condition_notes: reason || undefined });
      setSuccessInfo({ name: `${match.item?.name} (${match.item?.sku})`, qty, loc: '' });
      setScanCode('');
      await load();
    } catch (e: any) {
      setToast(e?.message || 'Greška prilikom čuvanja');
    }
  };

  const finish = async () => {
    // Proveri da li postoje preostale stavke (manjak)
    if (remainingItems.length > 0) {
      const confirmMsg = `⚠️ UPOZORENJE!\n\nPreostalo je ${remainingItems.length} stavki koje nisu u potpunosti primljene.\n\nDa li želite da završite prijem sa manjkom?`;
      if (!confirm(confirmMsg)) {
        return;
      }
    }
    
    // Proveri da li postoje višak (received > expected)
    const itemsWithOverage = (doc?.items || []).filter((it: any) => {
      const expected = Number(it.expected_quantity || 0);
      const received = Number(it.received_quantity || 0);
      return received > expected;
    });
    
    if (itemsWithOverage.length > 0) {
      const confirmMsg = `⚠️ UPOZORENJE!\n\nNeke stavke imaju VIŠAK količine (primljeno više nego traženo).\n\nDa li želite da nastavite?`;
      if (!confirm(confirmMsg)) {
        return;
      }
    }
    
    try {
      await completeReceiving(Number(id));
      
      // Prijem je uspešno završen - prikazujemo success screen i redirect-ujemo
      setToast('✓ Prijem uspešno završen!');
      
      // Nakon 2 sekunde automatski vrati na listu
      setTimeout(() => {
        router.push('/pwa/receiving');
      }, 2000);
      
    } catch (e: any) {
      try {
        const data = JSON.parse(e.message);
        if (data && data.missingLocations) { setErrorMissing(data.missingLocations); return; }
      } catch {}
      setToast(e?.message || 'Greška prilikom završetka');
    }
  };

  return (
    <div className="min-h-screen" style={{ background:'#0F0F0F' }}>
      {/* Success Modal - Modernizovan */}
      {successList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)', color: '#fff' }}>
              <div className="text-center">
                <div style={{ fontSize: 48, marginBottom: 8 }}>✓</div>
                <div className="font-bold text-xl">Prijem Završen</div>
                <div className="text-sm opacity-90 mt-1">Zalihe su uspešno ažurirane</div>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4 font-bold text-lg" style={{ color: '#1a1a1a' }}>Sažetak prijema:</div>
              <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 20 }}>
                {successList.map((r: any, idx: number) => (
                  <div key={idx} className="mb-3 p-4 rounded-xl" style={{ background: '#f8f9fa', border: '2px solid #e9ecef' }}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold" style={{ color: '#1a1a1a', fontSize: 15 }}>{r.sku}</div>
                      <div className="font-black text-xl" style={{ color: '#28a745' }}>+{r.primljeno}</div>
                    </div>
                    <div className="text-sm" style={{ color: '#6c757d' }}>Lokacija: {r.lokacija}</div>
                  </div>
                ))}
              </div>
              <button 
                onClick={()=>{ setSuccessList(null); router.push('/pwa/receiving'); }} 
                className="w-full py-4 rounded-xl font-bold text-lg"
                style={{ background: '#FFC300', color: '#000', border: 'none', boxShadow: '0 4px 12px rgba(255, 195, 0, 0.3)' }}
              >
                Nazad na Moje Prijeme
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <PwaHeader name={me?.username || ''} onLogout={()=>{ localStorage.removeItem('token'); router.push('/'); }} />
      <div style={{ padding: '12px 16px 0' }}>
        <PwaBackButton />
      </div>
      
      {/* Document Header - Čist profesionalan dizajn */}
      <div className="w-full px-4 py-3" style={{ 
        background: 'linear-gradient(180deg, #1a1a1a 0%, #0F0F0F 100%)', 
        borderBottom: '2px solid #FFC300',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 10 }}>
          {(() => {
            const status = (doc?.status || '').toLowerCase();
            let statusBg, statusColor, statusBorder, statusText;
            
            if (status === 'on_hold') {
              statusBg = 'linear-gradient(135deg, #dc3545, #c82333)';
              statusColor = '#fff';
              statusBorder = '2px solid #dc3545';
              statusText = '⏸ NA ČEKANJU';
            } else if (status === 'in_progress' || status === 'u_toku') {
              statusBg = 'linear-gradient(135deg, rgba(255, 195, 0, 0.2), rgba(255, 215, 0, 0.15))';
              statusColor = '#FFC300';
              statusBorder = '2px solid #FFC300';
              statusText = '⚡ U TOKU';
            } else if (status === 'completed' || status === 'zavrseno') {
              statusBg = 'linear-gradient(135deg, rgba(40, 167, 69, 0.2), rgba(32, 201, 151, 0.15))';
              statusColor = '#28a745';
              statusBorder = '2px solid #28a745';
              statusText = '✓ ZAVRŠENO';
            } else {
              statusBg = 'rgba(108, 117, 125, 0.15)';
              statusColor = '#6c757d';
              statusBorder = '2px solid rgba(108, 117, 125, 0.5)';
              statusText = (doc?.status || '').toUpperCase();
            }
            
            return (
              <span 
                className="px-3 py-2 font-bold flex items-center gap-1" 
                style={{ 
                  background: statusBg,
                  color: statusColor,
                  fontSize: 11,
                  letterSpacing: '0.8px',
                  border: statusBorder,
                  borderRadius: 12,
                  boxShadow: `0 2px 6px ${statusColor}33`
                }}
              >
                {statusText}
              </span>
            );
          })()}
        </div>
        <div className="font-bold text-center" style={{ color: '#FFC300', fontSize: 18, letterSpacing: 0.5 }}>
          {doc?.document_number || ''}
        </div>
      </div>

      {/* Toast Notification - Modernizovan */}
      {toast && (() => {
        const isSuccess = toast.includes('✓') || toast.includes('uspešno') || toast.includes('Uspešno');
        return (
          <div 
            className="mx-4 mt-4 p-4 rounded-xl" 
            style={{ 
              background: isSuccess 
                ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                : 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)', 
              border: '2px solid #FFC300',
              boxShadow: isSuccess 
                ? '0 4px 16px rgba(40, 167, 69, 0.4)'
                : '0 4px 16px rgba(220, 53, 69, 0.4)',
              color: '#fff'
            }} 
            onClick={()=>setToast(null)}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>{toast}</div>
              <div style={{ 
                background: 'rgba(0,0,0,0.3)', 
                borderRadius: 10, 
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 'bold',
                color: '#FFC300'
              }}>
                Tapni za zatvori
              </div>
            </div>
          </div>
        );
      })()}

      {docMeta && (
        <div className="mx-4 mt-2 text-sm text-gray-300 space-y-1">
          {docMeta.document_date && <div><span className="font-semibold">Datum:</span> {new Date(docMeta.document_date).toLocaleDateString('sr-Latn-RS')}</div>}
          {docMeta.store_name && <div><span className="font-semibold">Trgovina:</span> {docMeta.store_name}</div>}
          {docMeta.responsible_person && <div><span className="font-semibold">Odgovorna osoba:</span> {docMeta.responsible_person}</div>}
          {docMeta.invoice_number && <div><span className="font-semibold">Račun:</span> {docMeta.invoice_number}</div>}
          {docMeta.created_by_name && <div><span className="font-semibold">Kreirao:</span> {docMeta.created_by_name}</div>}
        </div>
      )}

      <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 60px)' }}>
        {/* Progress bar - Ultra moderan */}
        {doc && (
          <div className="mx-4 mt-3 p-4" style={{ 
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
            borderRadius: '18px',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Decorative glow */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '100%',
              background: 'radial-gradient(circle at top left, rgba(255, 195, 0, 0.15), transparent 60%)',
              pointerEvents: 'none'
            }} />
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="flex justify-between items-center gap-4" style={{ margin: '12px 0 18px' }}>
                <div style={{ textAlign: 'center', flex: '1 1 40%' }}>
                  <div style={{ 
                    color: '#FFC300', 
                    fontSize: 11, 
                    fontWeight: 800, 
                    marginBottom: 6,
                    letterSpacing: '1px',
                    textTransform: 'uppercase'
                  }}>
                    Napredak
                  </div>
                  <div style={{ color: '#fff', fontSize: 18, fontWeight: 800, letterSpacing: '0.6px' }}>
                    {doc.items?.length - remainingItems.length} / {doc.items?.length || 0}
                  </div>
                </div>
                {doc.started_at && (() => {
                  const sinceMin = Math.floor((Date.now() - new Date(doc.started_at).getTime()) / 60000);
                  let slaStatus = 'U ROKU';
                  let slaColor = '#28a745';
                  let slaBg = 'linear-gradient(135deg, rgba(40, 167, 69, 0.2), rgba(32, 201, 151, 0.15))';
                  let slaIcon = '✓';
                  
                  if (sinceMin > 30) {
                    slaStatus = 'HITNO';
                    slaColor = '#dc3545';
                    slaBg = 'linear-gradient(135deg, rgba(220, 53, 69, 0.2), rgba(200, 35, 51, 0.15))';
                    slaIcon = '⚠';
                  } else if (sinceMin > 20) {
                    slaStatus = 'PAŽNJA';
                    slaColor = '#ffc107';
                    slaBg = 'linear-gradient(135deg, rgba(255, 193, 7, 0.2), rgba(255, 179, 0, 0.15))';
                    slaIcon = '⏱';
                  }
                  
                  return (
                    <div className="px-3 py-2 font-bold flex items-center gap-2" style={{ 
                      background: slaBg,
                      color: slaColor,
                      border: `2px solid ${slaColor}`,
                      fontSize: 11,
                      letterSpacing: '0.8px',
                      borderRadius: 12,
                      boxShadow: `0 2px 8px ${slaColor}33`
                    }}>
                      <span style={{ fontSize: 14 }}>{slaIcon}</span>
                      {slaStatus}
                    </div>
                  );
                })()}
              </div>
              
              {/* Modern progress bar */}
              <div>
                <div
                  style={{
                    position: 'relative',
                    background: 'rgba(0, 0, 0, 0.55)',
                    height: 14,
                    borderRadius: 999,
                    overflow: 'hidden',
                    border: '1px solid rgba(255, 195, 0, 0.25)',
                    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.4)',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      pointerEvents: 'none',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0))',
                    }}
                  />
                  <div
                    style={{
                      height: '100%',
                      width: `${((doc.items?.length - remainingItems.length) / (doc.items?.length || 1)) * 100}%`,
                      background: 'linear-gradient(90deg, #FFC300 0%, #FF9800 60%, #FF5722 100%)',
                      borderRadius: 999,
                      boxShadow: '0 0 18px rgba(255, 195, 0, 0.45)',
                      transition: 'width 0.35s ease-in-out',
                    }}
                  />
                </div>
                <div
                  style={{
                    marginTop: 8,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.6px',
                    color: '#b5b5b5',
                    padding: '0 6px',
                  }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.75)' }}>0%</span>
                  <span style={{ color: '#FFC300', fontSize: 13 }}>
                    {Math.round(((doc.items?.length - remainingItems.length) / (doc.items?.length || 1)) * 100)}%
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.75)' }}>100%</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-2">
                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, paddingLeft: 6 }}>
                  {remainingItems.length === 0 ? 'Sve primljeno!' : `Preostalo stavki: ${remainingItems.length}`}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* CSS animation */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes shine {
            0% { left: -100%; }
            50%, 100% { left: 200%; }
          }
        `}} />

        {/* AI Put-Away Task Card */}
        {aiSuggestion && remainingItems.length > 0 && (
          <div className="flex-1 flex items-center justify-center p-6" style={{ background: '#000' }}>
            <div className="w-full max-w-md">
              {/* Main Location Code */}
              <div className="text-center mb-6">
                <div className="text-white text-6xl font-black mb-2" style={{ 
                  textShadow: '0 0 20px #ffc107, 0 0 40px #ffc107',
                  letterSpacing: '4px',
                }}>
                  {aiSuggestion.best_choice}
                </div>
                <div className="text-white text-sm opacity-80 mb-1">
                  {aiSuggestion.candidates[0]?.zone || 'N/A'} · Prolaz {aiSuggestion.candidates[0]?.rack?.replace('RACK-', '') || 'N/A'} · Regal {aiSuggestion.candidates[0]?.rack || 'N/A'} · Nivo {aiSuggestion.candidates[0]?.level || 'N/A'}
                </div>
              </div>

              {/* QR Code placeholder */}
              <div className="mb-6 flex justify-center">
                <div style={{ 
                  width: 200, 
                  height: 200, 
                  background: '#fff', 
                  padding: 10,
                  borderRadius: 8,
                }}>
                  <div className="text-black text-xs text-center pt-16">
                    QR CODE<br/>
                    {aiSuggestion.best_choice}
                  </div>
                </div>
              </div>

              {/* Task Info Card */}
              <div className="mb-6 p-6 rounded-lg" style={{ background: '#1a1a1a', border: '3px solid #ffc107' }}>
                <div className="text-white text-center mb-4">
                  <div className="text-3xl font-bold mb-2">OSTAVI {aiSuggestion.item.qty_to_place} {aiSuggestion.item.uom}</div>
                  <div className="text-xl opacity-90">{aiSuggestion.item.name}</div>
                  <div className="text-sm opacity-70 mt-2">{aiSuggestion.item.sku}</div>
                  {aiSuggestion.item.class && (
                    <div className="text-xs mt-2" style={{ color: '#ffc107' }}>
                      {aiSuggestion.item.class} · {aiSuggestion.item.turn_class}
                    </div>
                  )}
                </div>

                {/* Reasons */}
                <div className="mt-4 space-y-1">
                  {aiSuggestion.candidates[0]?.reasons?.map((r: string, idx: number) => (
                    <div key={idx} className="text-white text-xs opacity-70">• {r}</div>
                  ))}
                </div>
              </div>

              {/* Safety Warning */}
              {aiSuggestion.candidates[0]?.safety_flag && (
                <div className="mb-6 p-4 rounded-lg bg-red-900 border-2 border-red-500">
                  <div className="text-white font-bold text-lg mb-2">OPREZ</div>
                  <div className="text-white text-sm">{aiSuggestion.candidates[0].safety_flag}</div>
                  <div className="text-white text-xs mt-2 opacity-80">Potrebna dodatna pažnja pri postavljanju</div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    if (aiSuggestion.candidates[0]?.safety_flag) {
                      if (!confirm('Potvrđujete da ste razumeli safety upozorenje i nastavljate na sopstvenu odgovornost?')) {
                        return;
                      }
                    }
                    const item = remainingItems[0].raw;
                    applyAiSuggestion(item.id, aiSuggestion.best_choice, aiSuggestion.item.qty_to_place);
                  }}
                  className="w-full py-6 rounded-lg font-black text-xl text-black"
                  style={{ background: '#ffc107', minHeight: '60px' }}
                >
                  POTVRDI ODLAGANJE OVDE
                </button>
                <button
                  onClick={() => setShowAllSuggestions(true)}
                  className="w-full py-4 rounded-lg font-bold text-white border-2"
                  style={{ borderColor: '#ffc107', background: 'transparent' }}
                >
                  DRUGE LOKACIJE
                </button>
                <button
                  onClick={() => {
                    const manualLoc = prompt('Unesite lokaciju ručno:');
                    if (manualLoc && manualLoc.trim()) {
                      const item = remainingItems[0].raw;
                      applyAiSuggestion(item.id, manualLoc.trim().toUpperCase(), aiSuggestion.item.qty_to_place);
                    }
                  }}
                  className="w-full py-3 rounded-lg font-semibold text-white opacity-60 text-sm"
                >
                  RUČNI UNOS LOKACIJE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista stavki - Modernizovano */}
        {doc && (
          <div className="px-4 py-6">
            <div className="mb-4" style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              color: '#FFC300'
            }}>
              <div style={{ fontSize: 18, fontWeight: 'black', letterSpacing: 0.5 }}>
                ARTIKLI ({doc.items?.length || 0})
              </div>
            </div>
            <div style={{ display:'grid', gap:16, gridTemplateColumns:'1fr' }}>
              {(doc.items||[]).map((it:any) => {
                const expected = it.expected_quantity || 0;
                const received = it.received_quantity || 0;
                const remaining = Math.max(0, expected - received);
                const isComplete = remaining === 0;
                
                return (
                  <div 
                    key={it.id} 
                    style={{ 
                      background: isComplete 
                        ? 'linear-gradient(135deg, rgba(40, 167, 69, 0.15) 0%, rgba(32, 201, 151, 0.1) 100%)'
                        : 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
                      borderRadius: '16px',
                      padding: '16px',
                      border: isComplete ? '2px solid #28a745' : '2px solid rgba(255, 195, 0, 0.4)',
                      boxShadow: isComplete 
                        ? '0 4px 16px rgba(40, 167, 69, 0.2)'
                        : '0 4px 16px rgba(0,0,0,0.3)',
                      position: 'relative',
                      overflow: 'hidden',
                      wordBreak: 'break-word',
                      lineHeight: 1.4
                    }}
                  >
                    {isComplete && (
                      <div style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        background: '#28a745',
                        color: '#fff',
                        borderRadius: '50%',
                        width: 32,
                        height: 32,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        fontWeight: 'bold',
                        boxShadow: '0 2px 8px rgba(40, 167, 69, 0.4)'
                      }}>
                        ✓
                      </div>
                    )}
                    
                    {/* SKU + Naziv */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 16,
                      }}
                    >
                      <span
                        style={{
                          background: 'rgba(255, 195, 0, 0.2)',
                          color: '#FFC300',
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 14,
                          fontWeight: 'bold',
                          letterSpacing: 0.5,
                          border: '1px solid rgba(255, 195, 0, 0.4)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {it.item?.sku}
                      </span>
                      <div
                        style={{
                          fontWeight: 'bold',
                          color: isComplete ? '#28a745' : '#ffffff',
                          fontSize: 17,
                          lineHeight: 1.4,
                          flex: '1 1 200px',
                          minWidth: 160,
                        }}
                      >
                        {it.item?.name}
                      </div>
                    </div>
                    
                    {/* Količine */}
                    <div
                      className="mb-4"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                        gap: 12,
                        padding: 12,
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: 12,
                        border: '1px solid rgba(255, 195, 0, 0.1)',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textAlign: 'center' }}>
                        <div style={{ color: '#9ca3af', fontSize: 12 }}>Traženo</div>
                        <div style={{ color: '#fff', fontSize: 18, fontWeight: '900', lineHeight: 1 }}>{expected}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textAlign: 'center' }}>
                        <div style={{ color: '#9ca3af', fontSize: 12 }}>Primljeno</div>
                        <div style={{ color: isComplete ? '#28a745' : '#FFC300', fontSize: 18, fontWeight: '900', lineHeight: 1 }}>{received}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textAlign: 'center' }}>
                        <div style={{ color: '#9ca3af', fontSize: 12 }}>Preostalo</div>
                        <div
                          style={{
                            color: remaining === 0 ? '#28a745' : remaining > 0 ? '#ffc107' : '#dc3545',
                            fontSize: 18,
                            fontWeight: '900',
                            lineHeight: 1,
                          }}
                        >
                          {remaining}
                        </div>
                      </div>
                    </div>
                    
                    {/* Direktan unos količine */}
                    {!isComplete && (() => {
                      const input = itemInputs[it.id] || { qty: '', reason: '' };
                      const qtyNum = Number(input.qty || '0');
                      const isDifferent = input.qty && qtyNum !== remaining;
                      const needsReason = isDifferent && !(input.reason || '').trim();
                      
                      return (
                        <div>
                          {/* Količina input */}
                          <div className="mb-3">
                            <label style={{ 
                              display: 'block', 
                              fontSize: 12, 
                              fontWeight: 'bold', 
                              color: '#6c757d',
                              marginBottom: 6,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Količina za prijem
                            </label>
                            <input
                              type="number"
                              inputMode="decimal"
                              value={input.qty}
                              onChange={(e) => updateItemInput(it.id, 'qty', e.target.value)}
                              placeholder={`Potrebno: ${remaining}`}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                fontSize: 18,
                                fontWeight: 'bold',
                                border: isDifferent ? '2px solid #ffc107' : '2px solid #dee2e6',
                                borderRadius: 10,
                                background: '#fff',
                                color: isDifferent ? '#ffc107' : '#000',
                                boxShadow: isDifferent ? '0 0 0 3px rgba(255, 193, 7, 0.1)' : 'none',
                                transition: 'all 0.2s ease'
                              }}
                            />
                            {input.qty && (
                              <div style={{ 
                                marginTop: 6, 
                                fontSize: 11, 
                                color: isDifferent ? '#ffc107' : '#28a745',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                              }}>
                                {isDifferent ? (
                                  <>⚠ Odstupanje: {qtyNum > remaining ? '+' : ''}{qtyNum - remaining}</>
                                ) : (
                                  <>✓ Tačna količina</>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Razlog (prikazuje se samo ako je količina drugačija) */}
                          {isDifferent && (
                            <div className="mb-3">
                              <label style={{ 
                                display: 'block', 
                                fontSize: 12, 
                                fontWeight: 'bold', 
                                color: needsReason ? '#dc3545' : '#6c757d',
                                marginBottom: 6,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>
                                {needsReason ? '⚠ Razlog (obavezno)' : 'Razlog odstupanja'}
                              </label>
                              <textarea
                                value={input.reason}
                                onChange={(e) => updateItemInput(it.id, 'reason', e.target.value)}
                                placeholder="Npr: Oštećena roba, manjak na paleti..."
                                rows={2}
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  fontSize: 14,
                                  border: needsReason ? '2px solid #dc3545' : '2px solid #dee2e6',
                                  borderRadius: 10,
                                  background: '#fff',
                                  resize: 'none',
                                  boxShadow: needsReason ? '0 0 0 3px rgba(220, 53, 69, 0.1)' : 'none',
                                  transition: 'all 0.2s ease'
                                }}
                              />
                            </div>
                          )}

                          {/* Dugme za potvrdu */}
                          <button
                            onClick={() => submitItemInput(it.id, expected, received)}
                            className="w-full font-bold"
                            disabled={!input.qty || needsReason}
                            style={{ 
                              background: (!input.qty || needsReason) 
                                ? 'linear-gradient(135deg, #6c757d, #5a6268)'
                                : 'linear-gradient(135deg, #FFC300 0%, #FFD700 100%)',
                              color: (!input.qty || needsReason) ? '#fff' : '#000',
                              padding: '12px 18px',
                              fontSize: 14,
                              border: 'none',
                              borderRadius: '10px',
                              boxShadow: (!input.qty || needsReason) 
                                ? '0 2px 6px rgba(0,0,0,0.15)'
                                : '0 3px 10px rgba(255, 195, 0, 0.3)',
                              transition: 'all 0.2s ease',
                              letterSpacing: '0.5px',
                              fontWeight: '700',
                              textTransform: 'uppercase',
                              opacity: (!input.qty || needsReason) ? 0.6 : 1,
                              cursor: (!input.qty || needsReason) ? 'not-allowed' : 'pointer'
                            }}
                            onTouchStart={(e) => {
                              if (!input.qty || needsReason) return;
                              e.currentTarget.style.transform = 'scale(0.97)';
                              e.currentTarget.style.boxShadow = '0 2px 6px rgba(255, 195, 0, 0.2)';
                            }}
                            onTouchEnd={(e) => {
                              if (!input.qty || needsReason) return;
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.boxShadow = '0 3px 10px rgba(255, 195, 0, 0.3)';
                            }}
                          >
                            {!input.qty ? 'Unesite količinu' : needsReason ? 'Unesite razlog' : 'ZAPRIMI'}
                          </button>
                        </div>
                      );
                    })()}
                    {isComplete && (
                      <div className="text-center py-3" style={{ display:'grid', gap: 8 }}>
                        <div className="font-bold" style={{ color: '#28a745', fontSize: 14 }}>
                        Kompletno zaprimljeno
                        </div>
                        <button
                          onClick={()=>setEdit({ itemId: it.id, expected, received, qty: String(received), reason: it.condition_notes || '' })}
                          style={{
                            background: '#1f6f3f',
                            color: '#fff',
                            border: 'none',
                            padding: '10px 14px',
                            borderRadius: 10,
                            fontWeight: 'bold',
                            fontSize: 13
                          }}
                        >
                          Ispravi količinu
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Završetak dokumenta - Modernizovan */}
        {doc && (remainingItems.length === 0) && (
          <div className="px-4 pb-6">
            <button
              onClick={async()=>{ try{ await completeReceiving(Number(id)); alert('Dokument završen'); router.push('/pwa/receiving'); } catch(e:any){ setToast(e?.message||'Greška pri završavanju'); } }}
              className="w-full rounded-2xl font-black"
              style={{ 
                background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                color: '#fff',
                padding: '18px',
                fontSize: 18,
                border: 'none',
                boxShadow: '0 6px 20px rgba(40, 167, 69, 0.4)',
                letterSpacing: 1
              }}
            >
              ✓ ZAVRŠI DOKUMENT
            </button>
          </div>
        )}

        {/* All Suggestions Modal */}
        {showAllSuggestions && aiSuggestion && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-auto">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-lg">Sve preporučene lokacije</h3>
                <button onClick={() => setShowAllSuggestions(false)} className="text-2xl">×</button>
              </div>
              <div className="p-4 space-y-3">
                {aiSuggestion.candidates.map((cand: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => {
                      const item = remainingItems[0].raw;
                      applyAiSuggestion(item.id, cand.location_code, aiSuggestion.item.qty_to_place);
                      setShowAllSuggestions(false);
                    }}
                    className="border-2 rounded-lg p-3 cursor-pointer hover:bg-gray-50"
                    style={{ borderColor: idx === 0 ? '#4CAF50' : '#ddd' }}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold">{cand.location_code}</span>
                      <span className="px-2 py-1 rounded text-sm font-bold" style={{ background: idx === 0 ? '#4CAF50' : '#ddd', color: idx === 0 ? '#fff' : '#000' }}>
                        {cand.score}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mb-1">
                      {cand.zone} / {cand.rack} / nivo {cand.level || 'N/A'}
                    </div>
                    <div className="text-xs space-y-1">
                      {(cand.reasons || []).map((r: string, i: number) => (
                        <div key={i}>• {r}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Preostale stavke - Kompaktno */}
        <div className="px-4 pb-3">
          <button 
            onClick={()=>setPreostaleOpen(true)} 
            className="w-full rounded-lg font-bold"
            style={{ 
              background: 'rgba(255, 195, 0, 0.1)', 
              color: '#FFC300',
              border: '2px solid rgba(255, 195, 0, 0.5)',
              fontSize: 13,
              padding: '10px 16px',
              boxShadow: '0 2px 8px rgba(255, 195, 0, 0.15)',
              letterSpacing: '0.5px'
            }}
          >
            Pregled preostalog ({remainingItems.length})
          </button>
        </div>

        {/* Završi prijem - Kompaktno */}
        <div className="px-4 pb-5">
          <button 
            onClick={finish} 
            className="w-full font-bold"
            style={{ 
              background: remainingItems.length === 0 
                ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                : 'linear-gradient(135deg, #FFC300 0%, #FFD700 100%)',
              color: remainingItems.length === 0 ? '#fff' : '#000',
              padding: '14px 20px',
              fontSize: 15,
              border: 'none',
              borderRadius: '10px',
              boxShadow: remainingItems.length === 0 
                ? '0 3px 12px rgba(40, 167, 69, 0.3)'
                : '0 3px 12px rgba(255, 195, 0, 0.3)',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              transition: 'all 0.2s ease',
              fontWeight: '700'
            }}
            onTouchStart={(e) => {
              e.currentTarget.style.transform = 'scale(0.97)';
              e.currentTarget.style.boxShadow = remainingItems.length === 0 
                ? '0 2px 6px rgba(40, 167, 69, 0.2)'
                : '0 2px 6px rgba(255, 195, 0, 0.2)';
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = remainingItems.length === 0 
                ? '0 3px 12px rgba(40, 167, 69, 0.3)'
                : '0 3px 12px rgba(255, 195, 0, 0.3)';
            }}
          >
            {remainingItems.length === 0 
              ? 'ZAVRŠI PRIJEM'
              : `ZAVRŠI PRIJEM (${remainingItems.length} preostalo)`
            }
          </button>
        </div>
      </div>

      {/* Modal za edit - Čist dizajn */}
      {edit && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-5 py-4" style={{ background: 'linear-gradient(135deg, #FFC300 0%, #FFD700 100%)', borderBottom: '2px solid rgba(0,0,0,0.1)' }}>
              <h3 className="font-bold" style={{ color: '#000', letterSpacing: 0.5, fontSize: 16 }}>UNOS KOLIČINE</h3>
            </div>
            <div className="p-5">
              <div className="mb-4">
                <label className="block font-bold mb-2" style={{ color: '#1a1a1a', fontSize: 13 }}>Količina</label>
                <input 
                  type="number" 
                  value={edit.qty} 
                  onChange={(e)=>setEdit({...edit, qty:e.target.value})} 
                  className="w-full px-4 py-3 rounded-lg font-bold"
                  style={{ 
                    border: '2px solid #e0e0e0',
                    fontSize: 16,
                    background: '#f8f9fa'
                  }}
                  placeholder={`Traženo: ${edit.expected}`}
                  autoFocus
                />
                <div className="mt-2" style={{ color: '#6c757d', fontSize: 12 }}>
                  Očekivano: {edit.expected} • Već primljeno: {edit.received}
                </div>
              </div>
              <div className="mb-5">
                <label className="block font-bold mb-2" style={{ color: '#1a1a1a', fontSize: 13 }}>Razlog odstupanja</label>
                <textarea 
                  value={edit.reason} 
                  onChange={(e)=>setEdit({...edit, reason:e.target.value})} 
                  className="w-full px-4 py-3 rounded-lg"
                  style={{ 
                    border: '2px solid #e0e0e0',
                    fontSize: 14,
                    background: '#f8f9fa',
                    resize: 'none'
                  }}
                  rows={3} 
                  placeholder="Razlog odstupanja (obavezno ako količina ne odgovara)"
                />
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={()=>setEdit(null)} 
                  className="flex-1 py-3 rounded-lg font-bold"
                  style={{ 
                    background: '#f8f9fa', 
                    color: '#000',
                    border: '2px solid #e0e0e0',
                    fontSize: 14
                  }}
                >
                  Otkaži
                </button>
                <button 
                  onClick={submitEdit} 
                  className="flex-1 py-3 rounded-lg font-bold"
                  style={{ 
                    background: 'linear-gradient(135deg, #FFC300 0%, #FFD700 100%)',
                    color: '#000',
                    border: 'none',
                    fontSize: 14,
                    boxShadow: '0 4px 12px rgba(255, 195, 0, 0.3)'
                  }}
                >
                  Sačuvaj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {preostaleOpen && (
        <PreostaleStavkeModal items={remainingItems} onClose={()=>setPreostaleOpen(false)} />
      )}
      {successInfo && (
        <UspesnoZaprimljenoModal itemName={successInfo.name} qty={successInfo.qty} location={successInfo.loc} onClose={()=>setSuccessInfo(null)} />
      )}
      {/* Error Modal - Modernizovan */}
      {errorMissing && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)', zIndex: 60 }}>
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)', color: '#fff' }}>
              <div className="text-center">
                <div style={{ fontSize: 48, marginBottom: 8 }}>⚠️</div>
                <div className="font-bold text-xl">Nedostaje Lokacija</div>
                <div className="text-sm opacity-90 mt-1">Potrebno je uneti lokacije</div>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4" style={{ color: '#1a1a1a', fontSize: 15, textAlign: 'center' }}>
                Unesite lokaciju za sve stavke pre završetka prijema.
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 20 }}>
                {errorMissing.map((r:any, idx:number) => (
                  <div 
                    key={idx} 
                    className="mb-3 p-4 rounded-xl"
                    style={{ background: '#fff5f5', border: '2px solid #fecaca' }}
                  >
                    <div className="font-bold" style={{ color: '#dc3545', fontSize: 15 }}>{r.sku}</div>
                    <div className="text-sm" style={{ color: '#6c757d', marginTop: 4 }}>{r.naziv}</div>
                  </div>
                ))}
              </div>
              <button 
                onClick={()=>setErrorMissing(null)} 
                className="w-full py-4 rounded-xl font-bold"
                style={{ 
                  background: 'linear-gradient(135deg, #FFC300 0%, #FFD700 100%)',
                  color: '#000',
                  border: 'none',
                  fontSize: 16,
                  boxShadow: '0 4px 12px rgba(255, 195, 0, 0.3)'
                }}
              >
                ✓ Razumem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
