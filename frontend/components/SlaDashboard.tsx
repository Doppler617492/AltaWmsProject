import React, { useEffect, useState } from 'react';
import { colors } from '../src/theme/colors';
import { apiClient } from '../lib/apiClient';

type SlaEvent = {
  exception_id: string;
  type: string;
  severity: string;
  sla_limit_min: number;
  duration_min: number | null;
  breached: boolean;
  started_at: string;
  resolved_at: string | null;
  resolved_by: number | null;
  executed_action: string | null;
  zone: string | null;
  location_code: string | null;
  item_sku: string | null;
  worker: string | null;
  comments: string | null;
};

type SlaStats = {
  total_issues: number;
  total_breaches: number;
  compliance_score: number;
  avg_resolution_min: number;
  top_issue_types: Array<{ type: string; count: number }>;
  top_zones: Array<{ zone: string; breaches: number }>;
  best_workers: Array<{ user_id: number; resolved: number; avg_time: number; breaches?: number }>;
  worst_workers: Array<{ user_id: number; resolved?: number; avg_time?: number; breaches: number }>;
};

type Trends = {
  dates: string[];
  compliance_scores: number[];
  avg_resolution_times: number[];
  breach_counts: number[];
};

export default function SlaDashboard() {
  const [stats, setStats] = useState<SlaStats | null>(null);
  const [events, setEvents] = useState<SlaEvent[]>([]);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
    type: '',
  });
  const [selectedWorker, setSelectedWorker] = useState<number | null>(null);
  const [commentModal, setCommentModal] = useState<{ exceptionId: string; currentComment: string } | null>(null);
  const [userNames, setUserNames] = useState<Map<number, string>>(new Map());

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, eventsData, trendsData] = await Promise.all([
        apiClient.get('/sla/stats'),
        apiClient.get(`/sla/history?from=${filters.from}&to=${filters.to}${filters.type ? `&type=${filters.type}` : ''}`),
        apiClient.get('/sla/trends?period=30d'),
      ]);
      setStats(statsData);
      setEvents(eventsData || []);
      setTrends(trendsData);

      // Load user names for resolved_by
      const userIds = new Set<number>();
      eventsData?.forEach((e: SlaEvent) => {
        if (e.resolved_by) userIds.add(e.resolved_by);
      });
      if (userIds.size > 0) {
        try {
          const users = await apiClient.get('/users');
          const nameMap = new Map<number, string>();
          (users || []).forEach((u: any) => {
            if (userIds.has(u.id)) {
              nameMap.set(u.id, u.full_name || u.name || u.username);
            }
          });
          setUserNames(nameMap);
        } catch {}
      }
    } catch (e: any) {
      console.error('SLA Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // 60s refresh
    return () => clearInterval(interval);
  }, [filters]);

  const handleAddComment = async (exceptionId: string, comment: string) => {
    try {
      await apiClient.post('/sla/comment', { exception_id: exceptionId, comment });
      setCommentModal(null);
      loadData();
    } catch (e: any) {
      alert('Greška: ' + (e.message || 'Neuspešno dodavanje komentara'));
    }
  };

  if (loading && !stats) {
    return <div style={{ padding: 24, color: colors.textPrimary }}>Učitavanje SLA usklađenosti...</div>;
  }

  const complianceColor = (score: number) => {
    if (score >= 90) return colors.statusOk;
    if (score >= 70) return colors.brandYellow;
    return colors.statusErr;
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ maxWidth: 1800, margin: '0 auto' }}>
        <h1 style={{ color: colors.brandYellow, fontSize: 28, fontWeight: 700, marginBottom: 24 }}>
          Izveštaj o SLA usklađenosti
        </h1>

        {/* Overview Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
          <OverviewCard
            title="SLA skor"
            value={`${stats?.compliance_score || 0}%`}
            color={complianceColor(stats?.compliance_score || 0)}
          />
          <OverviewCard
            title="SLA prekoračenja"
            value={`${stats?.total_breaches || 0} / ${stats?.total_issues || 0}`}
            color={stats && stats.total_breaches > 0 ? colors.statusErr : colors.statusOk}
          />
          <OverviewCard
            title="Prosečno rešavanje (min)"
            value={`${stats?.avg_resolution_min || 0} min`}
            color={colors.brandYellow}
          />
        </div>

        {/* Filters */}
        <div style={{ background: colors.bgPanel, borderRadius: 8, padding: 16, marginBottom: 24, border: `1px solid ${colors.borderDefault}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div>
              <label style={{ display: 'block', color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Od</label>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                style={{ width: '100%', padding: 8, background: colors.bgBody, border: `1px solid ${colors.borderDefault}`, borderRadius: 4, color: colors.textPrimary }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Do</label>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                style={{ width: '100%', padding: 8, background: colors.bgBody, border: `1px solid ${colors.borderDefault}`, borderRadius: 4, color: colors.textPrimary }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Tip problema</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                style={{ width: '100%', padding: 8, background: colors.bgBody, border: `1px solid ${colors.borderDefault}`, borderRadius: 4, color: colors.textPrimary }}
              >
                <option value="">Svi tipovi</option>
                <option value="RECEIVING_DELAY">Kašnjenje u prijemu</option>
                <option value="CAPACITY_OVERLOAD">Preopterećenje kapaciteta</option>
                <option value="LATE_SHIPMENT">Kasna otprema</option>
                <option value="WORKER_GAP">Nedostatak radnika</option>
                <option value="PUTAWAY_BLOCKED">Blokirano odlaganje</option>
              </select>
            </div>
            {/* Zona filter uklonjen */}
          </div>
        </div>

        {/* Charts Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>
          {/* Trend Chart */}
          <TrendChart trends={trends} />

          {/* Najčešći tipovi problema */}
          <TopIssueTypesChart
            data={stats?.top_issue_types || []}
            onBarClick={(type) => setFilters({ ...filters, type })}
          />
        </div>

        {/* Main Content: Events Table + Side Panel */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 24 }}>
          {/* SLA Events Table */}
          <div style={{ background: colors.bgPanel, borderRadius: 8, padding: 16, border: `1px solid ${colors.borderDefault}` }}>
            <h2 style={{ color: colors.brandYellow, fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
              Istorija SLA događaja
            </h2>
            <SlaEventsTable
              events={events}
              userNames={userNames}
              onCommentClick={(exceptionId, currentComment) => setCommentModal({ exceptionId, currentComment })}
            />
          </div>

          {/* Best/Worst Workers */}
          <div style={{ background: colors.bgPanel, borderRadius: 8, padding: 16, border: `1px solid ${colors.borderDefault}` }}>
            <h2 style={{ color: colors.brandYellow, fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
              Učinak radnika
            </h2>
            <WorkersPanel
              best={stats?.best_workers || []}
              worst={stats?.worst_workers || []}
              userNames={userNames}
              onWorkerClick={setSelectedWorker}
            />
          </div>
        </div>

        {/* Zone Heatmap uklonjena */}

        {/* Comment Modal */}
        {commentModal && (
          <CommentModal
            exceptionId={commentModal.exceptionId}
            currentComment={commentModal.currentComment || ''}
            onSave={(comment) => handleAddComment(commentModal.exceptionId, comment)}
            onClose={() => setCommentModal(null)}
          />
        )}

        {/* Worker Details Modal */}
        {selectedWorker && (
          <WorkerDetailsModal
            workerId={selectedWorker}
            onClose={() => setSelectedWorker(null)}
          />
        )}
      </div>
    </div>
  );
}

function OverviewCard({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div
      style={{
        background: colors.bgPanelAlt,
        border: `2px solid ${color}`,
        borderRadius: 8,
        padding: 20,
        textAlign: 'center',
        transition: 'transform 0.2s',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
      }}
    >
      <div style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8, fontWeight: 600 }}>{title}</div>
      <div style={{ color: color, fontSize: 32, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function TrendChart({ trends }: { trends: Trends | null }) {
  if (!trends || trends.dates.length === 0) {
    return (
      <div style={{ background: colors.bgPanel, borderRadius: 8, padding: 16, border: `1px solid ${colors.borderDefault}`, height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary }}>
        Nema podataka za trend
      </div>
    );
  }

  // Simple line chart rendering (placeholder - would use ECharts in production)
  const maxScore = Math.max(...trends.compliance_scores, 100);
  const maxTime = Math.max(...trends.avg_resolution_times, 60);

  return (
    <div style={{ background: colors.bgPanel, borderRadius: 8, padding: 16, border: `1px solid ${colors.borderDefault}` }}>
      <h3 style={{ color: colors.brandYellow, fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
        Trend usklađenosti (30 dana)
      </h3>
      <div style={{ height: 250, position: 'relative', background: colors.bgBody, borderRadius: 4, padding: 16 }}>
        <svg width="100%" height="100%" viewBox="0 0 800 200" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(y => (
            <line key={y} x1="0" y1={200 - (y * 1.6)} x2="800" y2={200 - (y * 1.6)} stroke={colors.borderCard} strokeWidth="1" opacity={0.3} />
          ))}
          {/* Compliance Score line */}
          <polyline
            points={trends.dates.map((_, i) => {
              const x = (i / (trends.dates.length - 1)) * 800;
              const y = 200 - ((trends.compliance_scores[i] / 100) * 160);
              return `${x},${y}`;
            }).join(' ')}
            fill="none"
            stroke={colors.statusOk}
            strokeWidth="2"
          />
          {/* Resolution Time line */}
          <polyline
            points={trends.dates.map((_, i) => {
              const x = (i / (trends.dates.length - 1)) * 800;
              const y = 200 - ((trends.avg_resolution_times[i] / maxTime) * 160);
              return `${x},${y}`;
            }).join(' ')}
            fill="none"
            stroke={colors.brandYellow}
            strokeWidth="2"
          />
        </svg>
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 2, background: colors.statusOk }} />
            <span style={{ color: colors.textSecondary, fontSize: 11 }}>SLA skor (%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 2, background: colors.brandYellow }} />
            <span style={{ color: colors.textSecondary, fontSize: 11 }}>Prosek rešavanja (min)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopIssueTypesChart({ data, onBarClick }: { data: Array<{ type: string; count: number }>; onBarClick: (type: string) => void }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div style={{ background: colors.bgPanel, borderRadius: 8, padding: 16, border: `1px solid ${colors.borderDefault}` }}>
      <h3 style={{ color: colors.brandYellow, fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
        Najčešći tipovi problema
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: 250 }}>
        {data.map(item => (
          <div key={item.type} style={{ cursor: 'pointer' }} onClick={() => onBarClick(item.type)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 600 }}>{item.type.replace(/_/g, ' ')}</span>
              <span style={{ color: colors.textSecondary, fontSize: 12 }}>{item.count}</span>
            </div>
            <div style={{ width: '100%', height: 8, background: colors.borderCard, borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(item.count / maxCount) * 100}%`,
                  height: '100%',
                  background: colors.brandYellow,
                  borderRadius: 4,
                  transition: 'width 0.3s',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlaEventsTable({ events, userNames, onCommentClick }: { events: SlaEvent[]; userNames: Map<number, string>; onCommentClick: (exceptionId: string, currentComment: string) => void }) {
  const getStatusColor = (event: SlaEvent) => {
    if (event.breached) return colors.statusErr;
    if (event.duration_min && (event.duration_min / event.sla_limit_min) >= 0.8) return colors.statusWarn;
    return colors.statusOk;
  };

  const getStatusLabel = (event: SlaEvent) => {
    if (event.breached) return 'PREKORAČENJE';
    if (!event.resolved_at) return 'AKTIVNO';
    if (event.duration_min && (event.duration_min / event.sla_limit_min) >= 0.8) return 'BLIZU PREKORAČENJA';
    return 'REŠENO';
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${colors.borderDefault}` }}>
            <th style={thStyle}>Datum</th>
            <th style={thStyle}>Tip</th>
            <th style={thStyle}>Radnik</th>
            <th style={thStyle}>Akcija</th>
            <th style={thStyle}>Trajanje</th>
            <th style={thStyle}>SLA (min)</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Rešio</th>
            <th style={thStyle}>Komentar</th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr>
              <td colSpan={11} style={{ ...tdStyle, textAlign: 'center', padding: 24, color: colors.textSecondary }}>
                Nema SLA događaja za odabrani period
              </td>
            </tr>
          ) : (
            events.map((event, idx) => {
              const statusColor = getStatusColor(event);
              return (
                <tr key={idx} style={{ borderBottom: `1px solid ${colors.borderCard}` }}>
                  <td style={tdStyle}>{new Date(event.started_at).toLocaleDateString()}</td>
                  <td style={tdStyle}>{event.type.replace(/_/g, ' ')}</td>
                  {/* Lokacija kolona privremeno uklonjena */}
                  <td style={tdStyle}>{event.worker || '-'}</td>
                  <td style={tdStyle}>{event.executed_action?.replace(/_/g, ' ') || '-'}</td>
                  <td style={tdStyle}>{event.duration_min !== null ? `${event.duration_min} min` : '-'}</td>
                  <td style={tdStyle}>{event.sla_limit_min}</td>
                  <td style={tdStyle}>
                    <span style={{
                      background: statusColor,
                      color: '#000',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 700,
                    }}>
                      {getStatusLabel(event)}
                    </span>
                  </td>
                  <td style={tdStyle}>{event.resolved_by ? (userNames.get(event.resolved_by) || `User ${event.resolved_by}`) : '-'}</td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => onCommentClick(event.exception_id, event.comments || '')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: colors.brandYellow,
                        cursor: 'pointer',
                        fontSize: 16,
                      }}
                      title={event.comments || 'Dodaj komentar'}
                    >
                      {event.comments ? '📝' : '💬'}
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function WorkersPanel({ best, worst, userNames, onWorkerClick }: { best: any[]; worst: any[]; userNames: Map<number, string>; onWorkerClick: (id: number) => void }) {
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.substring(0, 2).toUpperCase();
  };

  return (
    <div>
      {best.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: colors.statusOk, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Top 3 izvođača</div>
          {best.map((w, idx) => (
            <div
              key={w.user_id}
              onClick={() => onWorkerClick(w.user_id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                background: colors.bgPanelAlt,
                borderRadius: 6,
                marginBottom: 8,
                cursor: 'pointer',
                border: `1px solid ${colors.borderDefault}`,
              }}
            >
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: colors.brandYellow,
                color: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 14,
              }}>
                {getInitials(userNames.get(w.user_id) || `User ${w.user_id}`)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: colors.textPrimary, fontWeight: 600, fontSize: 14 }}>
                  {userNames.get(w.user_id) || `User ${w.user_id}`}
                  {idx === 0 && <span style={{ marginLeft: 4 }}>🏆</span>}
                </div>
                <div style={{ color: colors.textSecondary, fontSize: 11 }}>
                  Rešeno: {w.resolved} · Prosek: {w.avg_time} min
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {worst.length > 0 && (
        <div>
          <div style={{ color: colors.statusErr, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Potrebno unapređenje</div>
          {worst.map((w) => (
            <div
              key={w.user_id}
              onClick={() => onWorkerClick(w.user_id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                background: colors.bgPanelAlt,
                borderRadius: 6,
                marginBottom: 8,
                cursor: 'pointer',
                border: `1px solid ${colors.borderDefault}`,
              }}
            >
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: colors.statusErr,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 14,
              }}>
                {getInitials(userNames.get(w.user_id) || `User ${w.user_id}`)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: colors.textPrimary, fontWeight: 600, fontSize: 14 }}>
                  {userNames.get(w.user_id) || `User ${w.user_id}`}
                </div>
                <div style={{ color: colors.textSecondary, fontSize: 11 }}>
                  Breaches: {w.breaches} · Avg: {w.avg_time || 0}min
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ZoneHeatmap({ zones }: { zones: Array<{ zone: string; breaches: number }> }) {
  const maxBreaches = Math.max(...zones.map(z => z.breaches), 1);

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {zones.map(zone => {
        const ratio = zone.breaches / maxBreaches;
        const color = ratio === 0 ? colors.statusOk : ratio < 0.5 ? colors.statusWarn : colors.statusErr;
        return (
          <div
            key={zone.zone}
            style={{
              background: color,
              color: '#000',
              padding: '12px 20px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'center',
            }}
            title={`${zone.breaches} breach-eva u zoni ${zone.zone}`}
          >
            <div>{zone.zone}</div>
            <div style={{ fontSize: 18, marginTop: 4 }}>{zone.breaches}</div>
          </div>
        );
      })}
    </div>
  );
}

function CommentModal({ exceptionId, currentComment, onSave, onClose }: { exceptionId: string; currentComment: string; onSave: (comment: string) => void; onClose: () => void }) {
  const [comment, setComment] = useState(currentComment);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: colors.bgPanel,
          border: `1px solid ${colors.borderStrong}`,
          borderRadius: 12,
          padding: 24,
          width: '90%',
          maxWidth: 500,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ color: colors.brandYellow, fontSize: 20, fontWeight: 700 }}>Komentar za {exceptionId}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: colors.textSecondary,
              fontSize: 24,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Dodaj komentar..."
          style={{
            width: '100%',
            minHeight: 100,
            padding: 12,
            background: colors.bgBody,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: 6,
            color: colors.textPrimary,
            fontSize: 14,
            resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: colors.bgPanelAlt,
              border: `1px solid ${colors.borderDefault}`,
              color: colors.textSecondary,
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Otkaži
          </button>
          <button
            onClick={() => onSave(comment)}
            style={{
              padding: '8px 16px',
              background: colors.brandYellow,
              border: 'none',
              color: '#000',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Sačuvaj
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkerDetailsModal({ workerId, onClose }: { workerId: number; onClose: () => void }) {
  const [events, setEvents] = useState<SlaEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiClient.get(`/sla/history?worker_id=${workerId}`);
        setEvents(data || []);
      } catch {}
      finally {
        setLoading(false);
      }
    })();
  }, [workerId]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: colors.bgPanel,
          border: `1px solid ${colors.borderStrong}`,
          borderRadius: 12,
          padding: 24,
          width: '90%',
          maxWidth: 800,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ color: colors.brandYellow, fontSize: 20, fontWeight: 700 }}>Worker SLA Details</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: colors.textSecondary,
              fontSize: 24,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
        {loading ? (
          <div style={{ color: colors.textSecondary }}>Učitavanje...</div>
        ) : events.length === 0 ? (
          <div style={{ color: colors.textSecondary }}>Nema SLA istorije za ovog radnika</div>
        ) : (
          <SlaEventsTable events={events} userNames={new Map()} onCommentClick={() => {}} />
        )}
      </div>
    </div>
  );
}

const thStyle = {
  padding: '12px 8px',
  color: colors.brandYellow,
  fontSize: 12,
  fontWeight: 600,
  textAlign: 'left' as const,
  borderBottom: `2px solid ${colors.borderDefault}`,
};

const tdStyle = {
  padding: '12px 8px',
  color: colors.textSecondary,
  fontSize: 13,
};
