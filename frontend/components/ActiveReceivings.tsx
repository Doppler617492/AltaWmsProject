import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { useToast } from './Toast';

interface ActiveDoc {
  id: number;
  document_number: string;
  supplier_name: string;
  assigned_user_name: string;
  status: 'in_progress' | 'on_hold';
  started_at: string;
  total_items: number;
  received_items_count: number;
  percent_complete: number;
  on_hold_reason?: string | null;
  has_in_progress_items?: boolean;
  all_items_placed?: boolean;
  is_completed?: boolean;
  recent_activity?: boolean;
}

export default function ActiveReceivings() {
  const [docs, setDocs] = useState<ActiveDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailDoc, setDetailDoc] = useState<any | null>(null);
  const [assignOpenFor, setAssignOpenFor] = useState<ActiveDoc | null>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null);
  const { showToast } = useToast();

  const fetchActive = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/receiving/active/');
      setDocs(data);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Greška pri učitavanju');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActive();
    // Preload workers to show workload/shift badges on cards
    (async () => {
      try {
        const list = await apiClient.get('/receiving/warehouse-workers');
        setWorkers(list);
      } catch {}
    })();
    const id = setInterval(fetchActive, 10000);
    return () => clearInterval(id);
  }, []);

  const openAssign = async (doc: ActiveDoc) => {
    try {
      const list = await apiClient.get('/receiving/warehouse-workers');
      setWorkers(list);
      setSelectedWorkerId(null);
      setAssignOpenFor(doc);
    } catch (e: any) {
      alert('Greška pri učitavanju liste radnika');
    }
  };

  const saveAssign = async () => {
    if (!assignOpenFor || !selectedWorkerId) return;
    try {
      await apiClient.patch(`/receiving/documents/${assignOpenFor.id}/reassign`, { assigned_to_user_id: selectedWorkerId });
      setAssignOpenFor(null);
      fetchActive();
      showToast?.('Prijem je uspešno preusmeren.', 'success');
    } catch (e: any) {
      showToast?.('Greška: Nije moguće preusmeriti prijem.', 'error');
    }
  };

  const toggleHold = async (doc: ActiveDoc) => {
    try {
      const path = doc.status === 'on_hold' ? `/receiving/documents/${doc.id}/release` : `/receiving/documents/${doc.id}/hold`;
      if (doc.status === 'on_hold') {
        await apiClient.patch(path, {});
      } else {
        const reason = window.prompt('Razlog stavljanja na HOLD:');
        await apiClient.patch(path, { reason: reason || '' });
      }
      fetchActive();
    } catch (e: any) {
      alert(e.message || 'Greška prilikom promene statusa');
    }
  };

  const reassign = async (doc: ActiveDoc) => {
    const userId = prompt('Unesite ID korisnika za dodelu (npr. 2)');
    if (!userId) return;
    try {
      await apiClient.patch(`/receiving/documents/${doc.id}/start`, { assigned_to_user_id: parseInt(userId) });
      fetchActive();
    } catch (e: any) {
      alert(e.message || 'Greška pri dodeli');
    }
  };

  const openDetail = async (doc: ActiveDoc) => {
    try {
      const data = await apiClient.get(`/receiving/documents/${doc.id}`);
      setDetailDoc(data);
    } catch (e: any) {
      alert('Greška pri učitavanju detalja');
    }
  };

  // Shift configuration (static; no DB changes)
  const shiftConfig: Record<string, { label: string; time: string }> = {
    'Magacioner': { label: 'Druga smena', time: '12:00–19:00 (pauza 14:00–14:30)' },
    'System Admin': { label: 'Prva smena', time: '08:00–15:00 (pauza 10:00–10:30)' },
    'Menadžer Skladišta': { label: 'Prva smena', time: '08:00–15:00 (pauza 10:00–10:30)' },
    'Šef Skladišta': { label: 'Druga smena', time: '12:00–19:00 (pauza 14:00–14:30)' },
  };
  const getShiftFor = (name?: string) => {
    if (!name) return { label: 'Prva smena', time: '08:00–15:00 (pauza 10:00–10:30)' };
    return shiftConfig[name] || { label: 'Prva smena', time: '08:00–15:00 (pauza 10:00–10:30)' };
  };

  const closeDetail = () => setDetailDoc(null);

  if (loading) return <div>Učitavanje...</div>;
  if (error) return <div style={{ color: 'red' }}>Greška: {error}</div>;

  return (
    <div>
      <h2 style={{ marginBottom: 15 }}>Aktivni prijemi</h2>
      <div style={styles.grid}>
        {docs.map((d) => (
          <div key={d.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.docNumber}>{d.document_number}</div>
              <span style={{
                ...styles.badge,
                background: d.status === 'on_hold' ? '#dc3545' : '#ffc107',
                color: d.status === 'on_hold' ? '#fff' : '#000'
              }}>
                {d.status === 'on_hold' ? 'NA ČEKANJU' : 'U TOKU'}
              </span>
            </div>
            <div style={styles.subtle}>Dobavljač: <strong>{d.supplier_name}</strong></div>
            {(() => {
              const name = d.assigned_user_name || '';
              // Count active by same assignee from current docs list
              const workload = name ? docs.filter(x => x.assigned_user_name === name).length : 0;
              const shift = getShiftFor(name);
              const busyText = workload > 0 ? `${workload} aktivna prijema` : 'slobodan';
              return (
                <div style={styles.subtle} title={shift.time}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: d.recent_activity ? '#28a745' : '#aaa', display: 'inline-block' }} />
                    Dodeljeno: <strong>{name || 'Nedodeljeno'}</strong>
                  </span>
                  {name && <> (<span style={styles.shiftBadge}>{shift.label}</span> · {busyText})</>}
                </div>
              );
            })()}

            {d.on_hold_reason && (
              <div style={{ ...styles.subtle, color: '#dc3545' }}>
                Razlog HOLD: {d.on_hold_reason}
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <div style={styles.progressBarWrapper}>
                <div style={{
                  ...styles.progressBar,
                  width: `${d.percent_complete}%`,
                  background: d.percent_complete >= 80 ? '#28a745' : '#ffc107',
                }} />
              </div>
              <div style={styles.progressText}>{d.received_items_count}/{d.total_items} ({d.percent_complete}%)</div>
              <div style={{ ...styles.progressText, color: d.is_completed ? '#28a745' : (d.all_items_placed ? '#ffc107' : '#555') }}>
                {d.is_completed ? 'Status: ZATVORENO' : (d.all_items_placed ? 'Status: ČEKA POTVRDU' : 'Status: U TOKU')}
              </div>
            </div>

            <div style={styles.actions}>
              <button style={styles.button} onClick={() => openAssign(d)}>Preusmeri</button>
              <button style={styles.button} onClick={() => openDetail(d)}>Pregled</button>
              <button style={{ ...styles.button, background: d.status === 'on_hold' ? '#28a745' : '#dc3545', color: '#fff' }} onClick={() => toggleHold(d)}>
                {d.status === 'on_hold' ? 'Skini čekanje' : 'Stavi na čekanje'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {detailDoc && (
        <div style={styles.modalOverlay} onClick={closeDetail}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3>Pregled prijema: {detailDoc.document_number}</h3>
              <button style={styles.closeBtn} onClick={closeDetail}>×</button>
            </div>
            <div>
              <div style={{ marginBottom: 10 }}>Dobavljač: <strong>{detailDoc.supplier?.name}</strong></div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    <th style={styles.th}>SKU</th>
                    <th style={styles.th}>Artikal</th>
                    <th style={styles.th}>Očekivano</th>
                    <th style={styles.th}>Primljeno</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailDoc.items || []).map((it: any) => (
                    <tr key={it.id}>
                      <td style={styles.td}>{it.item?.sku}</td>
                      <td style={styles.td}>{it.item?.name}</td>
                      <td style={styles.td}>{it.expected_quantity}</td>
                      <td style={styles.td}>{it.received_quantity}</td>
                      <td style={styles.td}>{(it.status || '').toUpperCase()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {assignOpenFor && (
        <div style={styles.modalOverlay} onClick={() => setAssignOpenFor(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3>Preusmeri prijem</h3>
              <button style={styles.closeBtn} onClick={() => setAssignOpenFor(null)}>×</button>
            </div>
            <div style={{ marginBottom: 12, fontSize: 14 }}>
              <div><strong>Dobavljač:</strong> {assignOpenFor.supplier_name}</div>
              <div><strong>Status:</strong> {assignOpenFor.status.toUpperCase()}</div>
            </div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>Dodeli radniku</label>
            <select value={selectedWorkerId ?? ''} onChange={e => setSelectedWorkerId(parseInt(e.target.value))} style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6 }}>
              <option value="" disabled>— Izaberi radnika —</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>{w.name} · {w.shift} · {w.active_receivings} aktivnih</option>
              ))}
            </select>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button style={styles.button} onClick={() => setAssignOpenFor(null)}>Otkaži</button>
              <button style={{ ...styles.button, background: '#ffc107' }} onClick={saveAssign} disabled={!selectedWorkerId}>Sačuvaj</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: any = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px',
  },
  card: {
    border: '1px solid #ffc107',
    borderRadius: 8,
    padding: 16,
    background: '#0a0a0a',
    color: '#fff',
    boxShadow: '0 2px 4px rgba(255,193,7,0.15)'
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  docNumber: { fontWeight: 'bold', fontSize: 18, color: '#ffc107' },
  badge: { padding: '4px 8px', borderRadius: 4, fontWeight: 'bold', fontSize: 12 },
  subtle: { color: '#ddd', fontSize: 14, marginTop: 4 },
  progressBarWrapper: { height: 10, background: 'rgba(255,255,255,0.15)', borderRadius: 6, overflow: 'hidden' },
  progressBar: { height: 10 },
  progressText: { fontSize: 12, color: '#bbb', marginTop: 6 },
  actions: { display: 'flex', gap: 8, marginTop: 12 },
  button: { padding: '8px 12px', borderWidth: '1px', borderStyle: 'solid', borderColor: '#ccc', background: '#f0f0f0', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal: { width: '80%', maxWidth: 900, background: '#0a0a0a', color:'#fff', border: '1px solid #ffc107', borderRadius: 8, padding: 16 },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  closeBtn: { fontSize: 24, lineHeight: 1, background: 'transparent', border: 'none', cursor: 'pointer' },
  th: { padding: 8, textAlign: 'left', borderBottom: '1px solid #ddd' },
  td: { padding: 8, borderBottom: '1px solid #f1f1f1' },
};
