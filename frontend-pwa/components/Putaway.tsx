import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

interface PutawayTask {
  id: number;
  pallet_id: string;
  item_sku: string;
  item_name: string;
  quantity: number;
  uom: string;
  from: string;
  to: string;
  status: 'ASSIGNED' | 'IN_PROGRESS';
}

export default function Putaway() {
  const [tasks, setTasks] = useState<PutawayTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<number | null>(null);
  const [showComplete, setShowComplete] = useState<number | null>(null);
  const [locInput, setLocInput] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    try {
      const data = await apiClient.get('/putaway/my-tasks');
      setTasks(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Load tasks error:', e);
      // Mock fallback
      setTasks([
        { id: 79, pallet_id: 'PAL-00022', item_sku: 'LIM-2MM', item_name: 'LIM 2mm ČELIK', quantity: 12, uom: 'PAL', from: 'STAGING-B', to: '1B0004', status: 'ASSIGNED' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function start(taskId: number) {
    try {
      await apiClient.patch(`/putaway/task/${taskId}/start`, {});
      await load();
    } catch (e: any) {
      alert(e?.message || 'Ne može start');
    }
  }

  async function complete(taskId: number) {
    setCompleting(taskId);
    try {
      await apiClient.patch(`/putaway/task/${taskId}/complete`, {
        actual_location_code: locInput.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setShowComplete(null);
      setLocInput('');
      setNotes('');
      await load();
      alert('Put-away završen!');
    } catch (e: any) {
      alert(e?.message || 'Problem sa odlaganjem');
    } finally {
      setCompleting(null);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: 'center', fontSize: 18, color: '#000' }}>
        Učitavanje…
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: 'center', fontSize: 18, color: '#000' }}>
        Nema aktivnih put-away zadataka
      </div>
    );
  }

  return (
    <div style={{ padding: 8 }}>
      <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12, color: '#000' }}>
        Put-away zadaci ({tasks.length})
      </div>

      {tasks.map((t) => (
        <div
          key={t.id}
          style={{
            border: '2px solid #ffc107',
            borderRadius: 8,
            padding: 12,
            marginBottom: 12,
            background: '#fff',
          }}
        >
          <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8, color: '#000' }}>
            {t.pallet_id}
          </div>
          <div style={{ fontSize: 14, marginBottom: 4, color: '#333' }}>
            <strong>{t.item_name}</strong> ({t.item_sku})
          </div>
          <div style={{ fontSize: 13, marginBottom: 4, color: '#666' }}>
            Količina: {t.quantity} {t.uom}
          </div>
          <div style={{ fontSize: 13, marginBottom: 4, color: '#666' }}>
            Od: <strong>{t.from}</strong>
          </div>
          <div style={{ fontSize: 13, marginBottom: 8, color: '#666' }}>
            Na: <strong>{t.to}</strong>
          </div>
          <div
            style={{
              padding: 4,
              borderRadius: 4,
              background: t.status === 'IN_PROGRESS' ? '#ffc107' : '#fff3cd',
              color: '#000',
              fontSize: 12,
              marginBottom: 8,
              textAlign: 'center',
            }}
          >
            {t.status === 'ASSIGNED' ? 'DODELJEN' : 'U TOKU'}
          </div>

          {t.status === 'ASSIGNED' ? (
            <button
              onClick={() => start(t.id)}
              style={{
                width: '100%',
                background: '#ffc107',
                color: '#000',
                border: 'none',
                padding: 12,
                borderRadius: 6,
                fontSize: 16,
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Započni
            </button>
          ) : (
            <button
              onClick={() => setShowComplete(t.id)}
              style={{
                width: '100%',
                background: '#28a745',
                color: '#fff',
                border: 'none',
                padding: 12,
                borderRadius: 6,
                fontSize: 16,
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Završi
            </button>
          )}
        </div>
      ))}

      {/* Complete modal */}
      {showComplete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: 20,
              width: '100%',
              maxWidth: 400,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#000' }}>
              Potvrdi odlaganje
            </div>
            <div style={{ marginBottom: 12, fontSize: 14, color: '#666' }}>
              Lokacija: {tasks.find((x) => x.id === showComplete)?.to}
            </div>
            <input
              type="text"
              placeholder="Skeniraj ili upiši finalnu lokaciju"
              value={locInput}
              onChange={(e) => setLocInput(e.target.value)}
              style={{
                width: '100%',
                padding: 12,
                border: '1px solid #ddd',
                borderRadius: 6,
                fontSize: 16,
                marginBottom: 8,
              }}
              autoFocus
            />
            <input
              type="text"
              placeholder="Napomena (opciono)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%',
                padding: 12,
                border: '1px solid #ddd',
                borderRadius: 6,
                fontSize: 14,
                marginBottom: 12,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  setShowComplete(null);
                  setLocInput('');
                  setNotes('');
                }}
                style={{
                  flex: 1,
                  background: '#ccc',
                  color: '#000',
                  border: 'none',
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 16,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Otkaži
              </button>
              <button
                onClick={() => complete(showComplete)}
                disabled={completing === showComplete}
                style={{
                  flex: 1,
                  background: completing === showComplete ? '#ccc' : '#28a745',
                  color: '#fff',
                  border: 'none',
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 16,
                  fontWeight: 'bold',
                  cursor: completing === showComplete ? 'not-allowed' : 'pointer',
                }}
              >
                {completing === showComplete ? 'Sačuvava…' : 'Potvrdi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

