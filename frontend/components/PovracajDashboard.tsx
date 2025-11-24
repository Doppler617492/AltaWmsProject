import { useEffect, useMemo, useState } from 'react';
import PovracajModal from './PovracajModal';
import { apiClient } from '../lib/apiClient';

interface PovracajDashboardProps {
  user: any;
}

function translatePovracajStatus(status: string): string {
  const map: Record<string, string> = {
    'SUBMITTED': 'SUBMITOVANO',
    'RECEIVED': 'PRIMLJENO',
    'submitted': 'SUBMITOVANO',
    'received': 'PRIMLJENO',
  };
  return map[status] || status;
}

export default function PovracajDashboard({ user }: PovracajDashboardProps) {
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{ mode: 'view' | 'create'; document?: any } | null>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);

  const canCreate = ['admin', 'store', 'prodavnica', 'menadzer', 'sef', 'sef_magacina', 'sef_prodavnice'].includes(user?.role);
  const canReceive = ['admin', 'magacioner', 'warehouse', 'sef', 'menadzer', 'sef_magacina'].includes(user?.role);
  const canDelete = ['admin', 'menadzer', 'sef', 'sef_magacina'].includes(user?.role);
  const canAssign = ['admin', 'menadzer', 'sef', 'sef_magacina'].includes(user?.role);

  useEffect(() => {
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    if (!summary) return { submitted: 0, received: 0 };
    return {
      submitted: summary.totalSubmitted || 0,
      received: summary.totalReceived || 0,
    };
  }, [summary]);

  async function refreshData() {
    setLoading(true);
    setError(null);
    try {
      const [docs, sum, anomaly] = await Promise.all([
        apiClient.getPovracajDocuments({ status: 'ALL', limit: 50 }),
        apiClient.getPovracajSummary({ window: 'today' }),
        apiClient.getPovracajAnomalies({ window: 'today' }),
      ]);
      setDocuments(Array.isArray(docs?.data) ? docs.data : []);
      setSummary(sum);
      setAnomalies(Array.isArray(anomaly) ? anomaly : []);
    } catch (e: any) {
      setError(e?.message || 'Neuspešno učitavanje POVRAĆAJ podataka.');
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setModalState({ mode: 'create' });
  }

  function openViewModal(doc: any) {
    setModalState({ mode: 'view', document: doc });
  }

  async function handleDownload(uid: string) {
    try {
      const blob = await apiClient.downloadPovracajPdf(uid);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e: any) {
      setError(e?.message || 'Preuzimanje PDF dokumenta nije uspelo.');
    }
  }

  function exportCsv(doc: any) {
    const rows = [
      ['UID', doc.uid],
      ['Prodavnica', doc.storeName || ''],
      ['Status', doc.status],
      ['Napomena', doc.note || ''],
      [],
      ['Šifra', 'Naziv', 'Količina', 'Razlog', 'Primljeno', 'Napomena'],
      ...(doc.items || []).map((item: any) => [
        item.code,
        item.name,
        Number(item.qty || 0),
        item.reason || '',
        item.receivedQty !== null && item.receivedQty !== undefined
          ? Number(item.receivedQty)
          : (item.received_qty !== null && item.received_qty !== undefined ? Number(item.received_qty) : ''),
        item.note || '',
      ]),
    ];
    const content = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `POVRAĆAJ_${doc.uid}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  }

  async function handleDelete(uid: string) {
    if (!window.confirm('Da li ste sigurni da želite da obrišete ovaj POVRAĆAJ dokument? Ova akcija je nepovratna.')) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiClient.deletePovracajDocument(uid);
      setError(null);
      await refreshData();
    } catch (e: any) {
      setError(e?.message || 'Brisanje dokumenta nije uspelo.');
    } finally {
      setLoading(false);
    }
  }

  const storeData = useMemo(() => {
    if (!summary?.byStore) return [];
    const max = Math.max(...summary.byStore.map((s: any) => s.submitted || 0), 1);
    return summary.byStore.map((store: any) => ({
      name: store.storeName,
      submitted: store.submitted,
      received: store.received,
      width: Math.max((store.submitted / max) * 100, 4),
    }));
  }, [summary]);

  const reasonData = useMemo(() => {
    if (!summary?.byReason) return [];
    const max = Math.max(...summary.byReason.map((r: any) => r.qty || 0), 1);
    return summary.byReason.map((row: any) => ({
      reason: row.reason,
      qty: row.qty,
      width: Math.max((row.qty / max) * 100, 4),
    }));
  }, [summary]);

  const topItems = summary?.topItems || [];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>POVRAĆAJ nadzor</h1>
          <p style={styles.subtitle}>Potpuna evidencija o oštećenoj ili istekloj robi, u realnom vremenu.</p>
        </div>
        {canCreate && (
          <button style={styles.createBtn} onClick={openCreateModal}>
            + Kreiraj POVRAĆAJ
          </button>
        )}
      </div>

      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>SUBMITOVANO DANAS</div>
          <div style={styles.statValue}>{totals.submitted}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>PRIMLJENO DANAS</div>
          <div style={styles.statValue}>{totals.received}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>AKTIVNI ZAPISI</div>
          <div style={styles.statValue}>{documents.filter((d) => d.status === 'SUBMITTED').length}</div>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {anomalies.length > 0 && (
        <div style={styles.warning}>
          <strong>Upozorenje:</strong> {anomalies.map((a) => `${a.storeName} (${Math.round(a.share * 100)}%)`).join(', ')} prelaze prag od 30% povracaja za izabrani period.
        </div>
      )}

      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <h2 style={styles.sectionTitle}>Dokumenti</h2>
          <button style={styles.refreshBtn} onClick={refreshData} disabled={loading}>
            {loading ? 'Osvežavanje...' : 'Osveži'}
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>UID</th>
                <th style={styles.th}>Prodavnica</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Kreirano</th>
                <th style={styles.th}>Primljeno</th>
                <th style={{ ...styles.th, textAlign: 'center' as const }}>Akcije</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td style={styles.td}>{doc.uid}</td>
                  <td style={styles.td}>{doc.storeName || '-'}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.statusBadge, background: doc.status === 'RECEIVED' ? '#15803d' : '#ca8a04' }}>
                      {translatePovracajStatus(doc.status)}
                    </span>
                  </td>
                  <td style={styles.td}>{formatDate(doc.createdAt)}</td>
                  <td style={styles.td}>{doc.receivedAt ? formatDate(doc.receivedAt) : '-'}</td>
                  <td style={{ ...styles.td, ...styles.actionCell }}>
                    <button style={styles.actionBtn} onClick={() => openViewModal(doc)}>Pregled</button>
                    <button style={styles.actionBtn} onClick={() => handleDownload(doc.uid)}>QR PDF</button>
                    <button style={styles.actionBtn} onClick={() => exportCsv(doc)}>Export CSV</button>
                    {canDelete && (
                      <button
                        style={{ ...styles.actionBtn, background: '#dc2626', color: '#fff' }}
                        onClick={() => handleDelete(doc.uid)}
                        disabled={loading}
                      >
                        Obriši
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {documents.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} style={styles.emptyState}>Nema dostupnih POVRAĆAJ dokumenata.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={styles.analyticsGrid}>
        <div style={styles.analyticsCard}>
          <h3 style={styles.sectionTitle}>Povracaj po prodavnici</h3>
          <div style={styles.list}>
            {storeData.length === 0 && <div style={styles.meta}>Nema podataka.</div>}
            {storeData.map((store) => (
              <div key={store.name} style={styles.progressRow}>
                <div style={styles.progressLabel}>{store.name}</div>
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progressFill, width: `${store.width}%` }} />
                </div>
                <div style={styles.progressMeta}>
                  {store.submitted} / {store.received}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.analyticsCard}>
          <h3 style={styles.sectionTitle}>Top 10 artikala</h3>
          <div style={styles.list}>
            {topItems.length === 0 && <div style={styles.meta}>Nema podataka.</div>}
            {topItems.map((item: any, idx: number) => (
              <div key={item.code} style={styles.topItem}>
                <span style={styles.rank}>{idx + 1}</span>
                <div>
                  <div style={styles.topItemName}>{item.name}</div>
                  <div style={styles.meta}>{item.code}</div>
                </div>
                <div style={styles.topItemQty}>{Number(item.qty).toLocaleString('sr-Latn-RS')}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.analyticsCard}>
          <h3 style={styles.sectionTitle}>Povracaj po razlogu</h3>
          <div style={styles.list}>
            {reasonData.length === 0 && <div style={styles.meta}>Nema podataka.</div>}
            {reasonData.map((row) => (
              <div key={row.reason} style={styles.progressRow}>
                <div style={styles.progressLabel}>{row.reason}</div>
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progressFillSecondary, width: `${row.width}%` }} />
                </div>
                <div style={styles.progressMeta}>{Number(row.qty).toLocaleString('sr-Latn-RS')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {modalState && (
        <PovracajModal
          mode={modalState.mode}
          document={modalState.document}
          canReceive={canReceive}
          canCreate={canCreate}
          canDelete={canDelete}
          canAssign={canAssign}
          userRole={user?.role}
          onClose={() => setModalState(null)}
          onSaved={refreshData}
        />
      )}
    </div>
  );
}

function formatDate(value: string | Date) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString('sr-Latn-RS');
}

const styles: Record<string, any> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    color: '#e2e8f0',
    background: 'linear-gradient(180deg,#05070d 0%,#020304 100%)',
    borderRadius: 28,
    padding: '2rem clamp(1.5rem,2vw,3rem)',
    boxShadow: '0 30px 60px rgba(0,0,0,0.45)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 20,
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    color: '#facc15',
  },
  subtitle: {
    margin: '6px 0 0',
    fontSize: 14,
    color: '#94a3b8',
  },
  createBtn: {
    background: '#facc15',
    color: '#0f172a',
    borderRadius: 14,
    padding: '12px 18px',
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
  },
  statCard: {
    background: 'rgba(15,23,42,0.75)',
    border: '1px solid rgba(148,163,184,0.25)',
    borderRadius: 16,
    padding: '18px 24px',
  },
  statLabel: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#94a3b8',
  },
  statValue: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: 800,
    color: '#f8fafc',
  },
  error: {
    background: 'rgba(220,38,38,0.2)',
    border: '1px solid rgba(220,38,38,0.35)',
    borderRadius: 12,
    padding: '12px 20px',
    color: '#fecaca',
  },
  warning: {
    background: 'rgba(250,204,21,0.12)',
    border: '1px solid rgba(250,204,21,0.35)',
    borderRadius: 12,
    padding: '12px 18px',
    color: '#fde68a',
  },
  tableCard: {
    background: 'rgba(15,23,42,0.75)',
    borderRadius: 16,
    border: '1px solid rgba(148,163,184,0.25)',
    padding: 20,
  },
  tableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: '#facc15',
  },
  refreshBtn: {
    background: 'rgba(250,204,21,0.1)',
    border: '1px solid rgba(250,204,21,0.35)',
    color: '#fde68a',
    borderRadius: 12,
    padding: '8px 16px',
    cursor: 'pointer',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  th: {
    textAlign: 'left' as const,
    padding: '12px 16px',
    borderBottom: '2px solid rgba(148,163,184,0.3)',
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  td: {
    padding: '12px 16px',
    borderBottom: '1px solid rgba(148,163,184,0.15)',
    color: '#e2e8f0',
    fontSize: 14,
    verticalAlign: 'middle' as const,
  },
  statusBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: 999,
    color: '#0f172a',
    fontWeight: 700,
    fontSize: 12,
  },
  actionCell: {
    display: 'flex',
    gap: 8,
  },
  actionBtn: {
    background: 'rgba(148,163,184,0.12)',
    border: '1px solid rgba(148,163,184,0.3)',
    color: '#e2e8f0',
    borderRadius: 8,
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: 12,
  },
  emptyState: {
    padding: '18px 0',
    textAlign: 'center' as const,
    color: '#94a3b8',
  },
  analyticsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 20,
  },
  analyticsCard: {
    background: 'rgba(15,23,42,0.75)',
    borderRadius: 16,
    border: '1px solid rgba(148,163,184,0.25)',
    padding: 20,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  progressRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 3fr auto',
    gap: 12,
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 13,
    color: '#cbd5f5',
  },
  progressBar: {
    background: 'rgba(148,163,184,0.15)',
    borderRadius: 999,
    height: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #facc15, #f97316)',
  },
  progressFillSecondary: {
    height: '100%',
    background: 'linear-gradient(90deg, #38bdf8, #1d4ed8)',
  },
  progressMeta: {
    fontSize: 12,
    color: '#94a3b8',
  },
  topItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'rgba(15,23,42,0.55)',
    borderRadius: 12,
    padding: '10px 12px',
  },
  rank: {
    background: '#1e293b',
    color: '#facc15',
    borderRadius: 999,
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
  },
  topItemName: {
    fontSize: 14,
    fontWeight: 600,
  },
  topItemQty: {
    marginLeft: 'auto',
    fontWeight: 700,
    color: '#f8fafc',
  },
  meta: {
    fontSize: 12,
    color: '#94a3b8',
  },
};


