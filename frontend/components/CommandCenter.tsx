import React, { useEffect, useState } from 'react';
import { colors } from '../src/theme/colors';
import { apiClient } from '../lib/apiClient';

type Exception = {
  id: string;
  type: string;
  severity: 'info' | 'medium' | 'high' | 'critical';
  since_min: number;
  status: string;
  title: string;
  details: string;
  assigned_worker?: {
    id: number;
    name: string;
    shift: string;
    online: boolean;
  } | null;
  zone?: string;
  actions: string[];
  document_id?: number;
  shipping_order_id?: number;
  location_code?: string;
  location_id?: number;
  putaway_task_id?: number;
  cycle_count_task_id?: number;
  user_id?: number;
};

type Recommendation = {
  exception_id: string;
  type: string;
  severity: string;
  title: string;
  proposed_action: string;
  explanation: string;
  target_user?: any;
  target_location?: any;
  cta_label: string;
  cta_api: {
    method: string;
    url: string;
    body: any;
  };
  sla_state: {
    age_min: number;
    sla_min: number;
    breach_in_min: number;
  };
};

const SEVERITY_LABELS: Record<Exception['severity'], string> = {
  info: 'INFO',
  medium: 'SREDNJI',
  high: 'VISOK',
  critical: 'KRITIČNO',
};

const translateSeverity = (value: string) => {
  if (!value) return value;
  const normalized = value.toLowerCase();
  switch (normalized) {
    case 'critical':
      return 'KRITIČNO';
    case 'high':
      return 'VISOK';
    case 'medium':
      return 'SREDNJI';
    case 'info':
      return 'INFO';
    case 'low':
      return 'NIZAK';
    default:
      return value;
  }
};

export default function CommandCenter() {
  const [activeTab, setActiveTab] = useState<'command' | 'optimization'>('command');
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedException, setSelectedException] = useState<Exception | null>(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<Exception | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<any>(null);
  const [executedActions, setExecutedActions] = useState<Set<string>>(new Set());
  const [teams, setTeams] = useState<any[]>([]);
  
  // Relayout data
  const [pressureMap, setPressureMap] = useState<any[]>([]);
  const [relayoutRecommendations, setRelayoutRecommendations] = useState<any[]>([]);
  const [selectedRecommendation, setSelectedRecommendation] = useState<any>(null);
  const [highlightedRack, setHighlightedRack] = useState<string | null>(null);
  const [overview, setOverview] = useState<any | null>(null);
  const [slaStats, setSlaStats] = useState<any | null>(null);

  const loadData = async () => {
    try {
      const [excs, wrks, recs, ov, sla, teamsData] = await Promise.all([
        apiClient.get('/exceptions/active').catch(() => []),
        apiClient.get('/workforce/overview').catch(() => []),
        apiClient.get('/orchestration/recommendations').catch(() => []),
        apiClient.get('/dashboard/overview').catch(() => null),
        apiClient.get('/sla/stats').catch(() => null),
        apiClient.get('/teams').catch(() => []),
      ]);
      setExceptions(Array.isArray(excs) ? excs : []);
      setWorkers(Array.isArray(wrks) ? wrks : []);
      setRecommendations(Array.isArray(recs) ? recs : []);
      setOverview(ov);
      setSlaStats(sla);
      setTeams(Array.isArray(teamsData) ? teamsData : []);
    } catch (e: any) {
      console.error('Command Center load error:', e);
      setExceptions([]);
      setWorkers([]);
      setRecommendations([]);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRelayoutData = async () => {
    try {
      const [pressure, recommendations] = await Promise.all([
        apiClient.get('/relayout/pressure-map').catch(() => []),
        apiClient.get('/relayout/recommendations').catch(() => []),
      ]);
      setPressureMap(Array.isArray(pressure) ? pressure : []);
      setRelayoutRecommendations(Array.isArray(recommendations) ? recommendations : []);
    } catch (e: any) {
      console.error('Relayout load error:', e);
    }
  };

  useEffect(() => {
    loadData();
    loadRelayoutData();
    const interval = setInterval(() => {
      loadData();
      if (activeTab === 'optimization') {
        loadRelayoutData();
      }
    }, 10000); // 10s refresh
    return () => clearInterval(interval);
  }, [activeTab]);


  const handleExecuteRecommendation = async (rec: Recommendation) => {
    try {
      await apiClient.post('/orchestration/execute', {
        exception_id: rec.exception_id,
        action_type: rec.proposed_action,
        payload: rec.cta_api.body,
      });
      setExecutedActions(new Set(Array.from(executedActions).concat(rec.exception_id)));
      setTimeout(() => loadData(), 2000); // Refresh after 2s
    } catch (e: any) {
      alert('Greška: ' + (e.message || 'Neuspešno izvršavanje akcije'));
    }
  };

  const handleAction = async (exception: Exception, action: string) => {
    if (action === 'ASSIGN_OTHER' || action === 'REASSIGN_PICK') {
      setReassignTarget(exception);
      setShowReassignModal(true);
    } else if (action === 'UNHOLD') {
      try {
        await apiClient.patch(`/exceptions/${exception.id}/unhold`);
        alert('Hold status je uspešno uklonjen.');
        loadData();
      } catch (e: any) {
        alert('Greška: ' + (e.message || 'Neuspešno uklanjanje hold statusa'));
      }
    } else if (action === 'OPEN_DOCUMENT') {
      // Navigate to receiving page with document ID
      if (exception.document_id) {
        try {
          localStorage.setItem('OPEN_RECEIVING_DOCUMENT_ID', String(exception.document_id));
        } catch {}
        window.location.href = `/receiving`;
      } else {
        alert('Dokument ID nije dostupan');
      }
    } else if (action === 'OPEN_SHIP_ORDER') {
      // Navigate to shipping page with order ID
      if (exception.shipping_order_id) {
        try {
          localStorage.setItem('OPEN_ORDER_ID', String(exception.shipping_order_id));
        } catch {}
        window.location.href = `/shipping`;
      } else {
        // Try to find order by exception ID
        const orderMatch = exception.id.match(/SHIP-(.+)/);
        if (orderMatch) {
          try {
            localStorage.setItem('OPEN_ORDER_NUMBER', orderMatch[1]);
          } catch {}
          window.location.href = `/shipping`;
        } else {
          alert('Nalog ID nije dostupan');
        }
      }
    } else if (action === 'OPEN_LOCATION') {
      if (exception.location_code) {
        window.location.href = `/stock?location=${exception.location_code}`;
      } else {
        alert('Lokacija nije dostupna');
      }
    } else if (action === 'PRIORITIZE') {
      try {
        const result = await apiClient.patch(`/exceptions/${exception.id}/ack`);
        alert(result?.message || 'Izuzetak je označen kao prioritet. Radnik je obavešten.');
        loadData();
      } catch (e: any) {
        alert('Greška pri označavanju prioriteta: ' + (e.message || 'Neuspešno'));
      }
    }
  };

  const handleReassign = async (targetUserId?: number, teamId?: number) => {
    if (!reassignTarget) return;
    if (!targetUserId && !teamId) {
      alert('Morate izabrati radnika ili tim');
      return;
    }
    try {
      const result = await apiClient.patch(`/exceptions/${reassignTarget.id}/reassign`, {
        target_user_id: targetUserId,
        team_id: teamId,
      });
      alert(result?.message || 'Zadatak je uspešno preusmeren.');
      setShowReassignModal(false);
      setReassignTarget(null);
      loadData();
    } catch (e: any) {
      alert('Greška: ' + (e.message || 'Neuspešno preusmeravanje'));
    }
  };

  if (loading) {
    return <div style={{ padding: 24, color: colors.textPrimary }}>Učitavanje komandnog centra...</div>;
  }

  const criticalCount = exceptions.filter(e => e.severity === 'critical').length;
  const highCount = exceptions.filter(e => e.severity === 'high').length;

  return (
    <div style={{ background: "linear-gradient(180deg,#05070d 0%,#020304 100%)", minHeight: '100vh', padding: "2rem clamp(1.5rem,2vw,3rem)", boxSizing: 'border-box', color:'#f8fafc', display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'space-between', gap:16 }}>
        <div>
          <div style={{ textTransform:'uppercase', letterSpacing:3, fontSize:12, color:'rgba(255,255,255,0.45)' }}>Komandni centar</div>
          <h1 style={{ margin:'6px 0 8px', fontSize:32, fontWeight:700 }}>Operativni nadzor</h1>
          <p style={{ color:'rgba(255,255,255,0.6)', maxWidth:520 }}>AI signalizacija izuzetaka, status radnika i optimizacija skladišta u jednoj konzoli.</p>
        </div>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <StatusChip label="Kritično" value={criticalCount} />
          <StatusChip label="Visok rizik" value={highCount} />
          <StatusChip label="Aktivni izuzeci" value={exceptions.length} />
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
        {(['command','optimization'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab === 'optimization') loadRelayoutData();
            }}
            style={{
              padding: '10px 22px',
              background: activeTab === tab ? colors.brandYellow : 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: 999,
              color: activeTab === tab ? '#111' : '#f3f4f6',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              letterSpacing: 0.5,
            }}
          >
            {tab === 'command' ? 'Komandni centar' : 'Optimizacija skladišta'}
          </button>
        ))}
      </div>

      {activeTab === 'optimization' ? (
        <RelayoutOptimizationTab
          pressureMap={pressureMap}
          recommendations={relayoutRecommendations}
          selectedRecommendation={selectedRecommendation}
          highlightedRack={highlightedRack}
          onSelectRecommendation={(rec) => {
            setSelectedRecommendation(rec);
            // Extract rack from recommendation
            if (rec.current_locations && rec.current_locations.length > 0) {
              // Try to extract rack code from location (format: 1A0007 -> RACK-1A)
              const locationCode = rec.current_locations[0];
              const rackMatch = locationCode.match(/([0-9]+[A-Z]+)/);
              if (rackMatch) {
                setHighlightedRack(`RACK-${rackMatch[1]}`);
              }
            } else if (rec.location_code) {
              const rackMatch = rec.location_code.match(/([0-9]+[A-Z]+)/);
              if (rackMatch) {
                setHighlightedRack(`RACK-${rackMatch[1]}`);
              }
            }
          }}
          onHighlightRack={(rack) => setHighlightedRack(rack)}
        />
      ) : (
        <>
      {/* AI PREPORUČUJE Panel - Top Bar */}
      {recommendations.length > 0 && (
        <div style={{ background: 'linear-gradient(180deg,#111522,#090b14)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: 20, boxShadow:'0 20px 40px rgba(0,0,0,0.45)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 22 }}>⚡</span>
            <h2 style={{ color: colors.brandYellow, fontSize: 20, fontWeight: 600, margin: 0 }}>
              AI PREPORUČUJE
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {recommendations.map(rec => (
              <RecommendationCard
                key={rec.exception_id}
                recommendation={rec}
                onExecute={() => handleExecuteRecommendation(rec)}
                isExecuted={executedActions.has(rec.exception_id)}
              />
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* LIVE CRITICAL ISSUES */}
          <div style={{ background: 'linear-gradient(180deg,#111522,#090b14)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: 20, boxShadow:'0 20px 40px rgba(0,0,0,0.45)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ color: colors.brandYellow, fontSize: 18, fontWeight: 600, margin:0 }}>
                KRITIČNE STAVKE UŽIVO
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {criticalCount > 0 && (
                  <span style={{ background: colors.statusErr, color: '#000', padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>
                    {criticalCount} KRITIČNO
                  </span>
                )}
                {highCount > 0 && (
                  <span style={{ background: colors.statusWarn, color: '#000', padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>
                    {highCount} VISOK
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '100%', overflowY: 'auto' }}>
              {exceptions.length === 0 ? (
                <div style={{ color: colors.textSecondary, padding: 24, textAlign: 'center' }}>
                  Nema otvorenih kritičnih stavki u ovom trenutku ✅
                </div>
              ) : (
                exceptions.map(exc => (
                  <ExceptionCard
                    key={exc.id}
                    exception={exc}
                    onAction={(action) => handleAction(exc, action)}
                  />
                ))
              )}
            </div>
          </div>

          {/* WORKER LOAD */}
          <div style={{ background: 'linear-gradient(180deg,#111522,#090b14)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: 20, boxShadow:'0 20px 40px rgba(0,0,0,0.45)', flex: '1 1 40%' }}>
            <h2 style={{ color: colors.brandYellow, fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
              OPTEREĆENJE RADNIKA
            </h2>
            <WorkerLoadSection
              workers={workers}
              exceptions={exceptions}
              onReassign={(workerId) => {
                // Find exception for this worker
                const exc = exceptions.find(e => e.assigned_worker?.id === workerId || e.user_id === workerId);
                if (exc) {
                  setReassignTarget(exc);
                  setShowReassignModal(true);
                } else {
                  alert('Nema aktivnih izuzetaka za ovog radnika');
                }
              }}
            />
          </div>
        </div>

        {/* Right Column - MANAGEMENT BRIEF */}
        <ExecutiveBriefPanel
          overview={overview}
          slaStats={slaStats}
          exceptions={exceptions}
          recommendations={recommendations}
        />
      </div>
      </>
      )}

      {/* Reassign Modal */}
      {showReassignModal && reassignTarget && (
        <ReassignModal
          exception={reassignTarget}
          workers={workers}
          teams={teams}
          onClose={() => { setShowReassignModal(false); setReassignTarget(null); }}
          onConfirm={handleReassign}
        />
      )}

      {/* Detail Modals */}
      {showDetailModal && (
        <DetailModal
          modal={showDetailModal}
          onClose={() => setShowDetailModal(null)}
        />
      )}
    </div>
  );
}

function ExceptionCard({ exception, onAction }: { exception: Exception; onAction: (action: string) => void }) {
  const severityColor = exception.severity === 'critical' ? colors.statusErr :
                        exception.severity === 'high' ? colors.statusWarn :
                        exception.severity === 'medium' ? colors.brandYellow :
                        colors.textSecondary;
  
  const typeIcon = exception.type === 'RECEIVING_DELAY' ? '📦' :
                   exception.type === 'CAPACITY_OVERLOAD' ? '🏗️' :
                   exception.type === 'LATE_SHIPMENT' ? '🚚' :
                   exception.type === 'WORKER_GAP' ? '👷' :
                   exception.type === 'PUTAWAY_BLOCKED' ? '⛔' :
                   '🔍';

  return (
    <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          borderLeft: `4px solid ${severityColor}`,
          borderRadius: 14,
          padding: 16,
          cursor: 'pointer',
          transition: 'transform 0.2s, box-shadow 0.2s',
          border: exception.severity === 'critical' ? `2px solid ${severityColor}` : 'none',
          boxShadow: exception.severity === 'critical' ? `0 0 8px ${severityColor}80` : 'none',
        }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)';
        (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 12px ${severityColor}40`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontSize: 24 }}>{typeIcon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              background: severityColor,
              color: '#000',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
            }}>
              {SEVERITY_LABELS[exception.severity] ?? exception.severity}
            </span>
            <span style={{ color: colors.textSecondary, fontSize: 11 }}>
              {exception.since_min}min
            </span>
          </div>
          <div style={{ color: colors.textPrimary, fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
            {exception.title}
          </div>
          <div style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>
            {exception.details}
          </div>
          {exception.assigned_worker && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: exception.assigned_worker.online ? colors.statusOk : colors.statusErr,
                display: 'inline-block',
              }} />
              <span style={{ color: colors.textSecondary, fontSize: 11 }}>
                {exception.assigned_worker.name} · {exception.assigned_worker.shift}
                {!exception.assigned_worker.online && (
                  <span style={{ color: colors.statusErr, marginLeft: 4 }}>VAN MREŽE</span>
                )}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {exception.actions.map(action => (
              <button
                key={action}
                onClick={() => onAction(action)}
                style={{
                  padding: '4px 10px',
                  background: colors.bgBody,
                  border: `1px solid ${colors.borderDefault}`,
                  color: colors.brandYellow,
                  borderRadius: 4,
                  fontSize: 11,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {action === 'ASSIGN_OTHER' ? 'Preusmeri' :
                 action === 'REASSIGN_PICK' ? 'Preusmeri' :
                 action === 'UNHOLD' ? 'Skini HOLD' :
                 action === 'PRIORITIZE' ? 'Prioritizuj' :
                 action === 'OPEN_DOCUMENT' ? 'Otvori prijem' :
                 action === 'OPEN_SHIP_ORDER' ? 'Otvori nalog' :
                 action === 'OPEN_LOCATION' ? 'Otvori lokaciju' :
                 action}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkerLoadSection({ workers, exceptions, onReassign }: { workers: any[]; exceptions: Exception[]; onReassign: (id: number) => void }) {
  const workersWithExceptions = workers.map(w => {
    const hasException = exceptions.some(e => 
      e.assigned_worker?.id === w.user_id && 
      (e.type === 'RECEIVING_DELAY' || e.type === 'LATE_SHIPMENT' || e.type === 'WORKER_GAP')
    );
    const isOfflineWithTask = exceptions.some(e => 
      e.assigned_worker?.id === w.user_id && 
      e.type === 'WORKER_GAP'
    );
    return { ...w, hasException, isOfflineWithTask };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '100%', overflowY: 'auto' }}>
      {workersWithExceptions.map(w => {
        const shiftLabel = w.shift_type || 'n/d';
        const statusLabel = w.online_status === 'ONLINE'
          ? 'PRISUTAN'
          : w.online_status === 'OFFLINE'
            ? 'VAN MREŽE'
            : w.online_status || 'VAN MREŽE';
        return (
          <div
            key={w.user_id}
            style={{
              background: w.isOfflineWithTask ? 'rgba(220,53,69,0.2)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${w.isOfflineWithTask ? colors.statusErr : 'rgba(255,255,255,0.05)'}`,
              borderRadius: 14,
              padding: 12,
              display: 'grid',
              gridTemplateColumns: '1fr auto auto',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ color: colors.textPrimary, fontWeight: 600, fontSize: 13 }}>
                {w.full_name || w.username}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: w.online_status === 'ONLINE' ? colors.statusOk : colors.statusOffline,
                  display: 'inline-block',
                }} />
                <span style={{ color: colors.textSecondary, fontSize: 11 }}>
                  {shiftLabel} · {statusLabel}
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: colors.textSecondary }}>
              <div>Prijemi: {w.open_tasks_count || 0}</div>
              <div>Otpreme: {w.open_shipping_orders || 0}</div>
              <div>SKART: {w.open_skart_count || 0}</div>
              <div>Povraćaj: {w.open_povracaj_count || 0}</div>
            </div>
            {(w.hasException || w.isOfflineWithTask) && (
              <button
                onClick={() => onReassign(w.user_id)}
                style={{
                  padding: '6px 12px',
                  background: colors.brandYellow,
                  border: 'none',
                  color: '#111',
                  borderRadius: 999,
                  fontSize: 11,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Preusmeri
              </button>
            )}
          </div>
        );
      })}
      {workersWithExceptions.length === 0 && (
        <div style={{ color: colors.textSecondary, padding: 24, textAlign: 'center' }}>
          Nema podataka o radnicima
        </div>
      )}
    </div>
  );
}

function ExecutiveBriefPanel({
  overview,
  slaStats,
  exceptions,
  recommendations,
}: {
  overview: any;
  slaStats: any;
  exceptions: Exception[];
  recommendations: Recommendation[];
}) {
  const receiving = overview?.receivingSummary || {};
  const shipping = overview?.shippingSummary || {};
  const skart = overview?.skartSummary || {};
  const povracaj = overview?.povracajSummary || {};
  const workforce = overview?.workforceSummary || {};

  const criticalCount = exceptions.filter(e => e.severity === 'critical').length;
  const highCount = exceptions.filter(e => e.severity === 'high').length;
  const mediumCount = exceptions.filter(e => e.severity === 'medium').length;

  const statCard = (label: string, value: string | number, accent?: string) => (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      borderRadius: 14,
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{label}</span>
      <span style={{ color: accent ?? '#fff', fontSize: 20, fontWeight: 700 }}>{value}</span>
    </div>
  );

  const complianceColor =
    typeof slaStats?.compliance_score === 'number'
      ? slaStats.compliance_score >= 90
        ? colors.statusOk
        : slaStats.compliance_score >= 70
          ? colors.statusWarn
          : colors.statusErr
      : colors.borderDefault;

  return (
    <div style={{ background: 'linear-gradient(180deg,#111522,#090b14)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: 20, boxShadow:'0 20px 40px rgba(0,0,0,0.45)', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ color: colors.brandYellow, fontSize: 18, fontWeight: 600, margin: 0 }}>
          IZVEŠTAJ ZA MENADŽMENT
        </h2>
        <p style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
          Sažetak trenutnih performansi i rizika
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {statCard('Prijemi završeni danas', receiving.completed_today ?? '—', colors.statusOk)}
        {statCard('Otpreme završene danas', shipping.completed_today ?? '—', colors.statusOk)}
        {statCard('SKART završeni danas', skart.completed_today ?? '—', colors.statusOk)}
        {statCard('SKART čekaju prijem', skart.submitted ?? '—', skart.submitted > 0 ? colors.statusWarn : colors.statusOk)}
        {statCard('Povraćaj završeni danas', povracaj.completed_today ?? '—', colors.statusOk)}
        {statCard('Povraćaj čekaju prijem', povracaj.submitted ?? '—', povracaj.submitted > 0 ? colors.statusWarn : colors.statusOk)}
        {statCard('Prosek prijema (min)', receiving.avg_close_time_min ?? '—')}
        {statCard('Prosek otpreme (min)', shipping.avg_close_time_min ?? '—')}
        {statCard('Prosek SKART (min)', skart.avg_close_time_min ?? '—')}
        {statCard('Prosek Povraćaj (min)', povracaj.avg_close_time_min ?? '—')}
        {statCard('Online radnici', `${workforce.online_now ?? '—'} / ${workforce.total_workers ?? '—'}`)}
        {statCard('SLA usklađenost', slaStats?.compliance_score != null ? `${slaStats.compliance_score}%` : '—', complianceColor)}
        {statCard('SLA prekoračenja', slaStats?.total_breaches ?? '—', slaStats?.total_breaches > 0 ? colors.statusErr : colors.statusOk)}
        {statCard('AI preporuke', recommendations.length, colors.brandYellow)}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14 }}>
        <div style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>Aktivni rizici</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ background: colors.statusErr, color: '#000', padding: '4px 10px', borderRadius: 999, fontWeight: 700 }}>
            Kritično: {criticalCount}
          </span>
          <span style={{ background: colors.statusWarn, color: '#000', padding: '4px 10px', borderRadius: 999, fontWeight: 700 }}>
            Visoko: {highCount}
          </span>
          <span style={{ background: colors.brandYellowDim, color: colors.textPrimary, padding: '4px 10px', borderRadius: 999, fontWeight: 700 }}>
            Srednje: {mediumCount}
          </span>
          <span style={{ background: colors.bgBody, color: colors.textSecondary, padding: '4px 10px', borderRadius: 999, fontWeight: 700 }}>
            Ukupno izuzetaka: {exceptions.length}
          </span>
        </div>
      </div>

      {slaStats && (
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, display: 'grid', gap: 8 }}>
          <div style={{ color: colors.textSecondary, fontSize: 12 }}>SLA detalji</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: colors.textPrimary, fontSize: 13 }}>
            <span>Prosek rešavanja: <strong>{slaStats.avg_resolution_min ?? '—'} min</strong></span>
            <span>Top tipovi problema: <strong>{(slaStats.top_issue_types || []).map((t: any) => `${t.type} (${t.count})`).join(', ') || '—'}</strong></span>
            <span>Najrizičnije zone: <strong>{(slaStats.top_zones || []).map((z: any) => `${z.zone} (${z.breaches})`).join(', ') || '—'}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:'10px 16px', minWidth:140 }}>
      <div style={{ fontSize:12, textTransform:'uppercase', letterSpacing:1, color:'rgba(255,255,255,0.5)' }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:700, color:'#fff' }}>{value}</div>
    </div>
  );
}

function ReassignModal({ exception, workers, teams, onClose, onConfirm }: any) {
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [assignType, setAssignType] = useState<'worker' | 'team'>('worker');

  const workerList = workers.filter((w: any) => w.online_status === 'ONLINE' || w.online_status !== 'OFFLINE');

  const canSave = assignType === 'worker' ? selectedWorkerId : selectedTeamId;

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
          background: 'linear-gradient(180deg,#111522,#090b14)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: 24,
          width: '90%',
          maxWidth: 500,
          boxShadow:'0 25px 55px rgba(0,0,0,0.6)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ color: colors.brandYellow, fontSize: 20, fontWeight: 700 }}>
            Preusmeri zadatak
          </h2>
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

        <div style={{ marginBottom: 16 }}>
          <div style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Zadatak:</div>
          <div style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 600 }}>{exception.title}</div>
        </div>

        {/* Assignment Type Selection */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => { setAssignType('worker'); setSelectedTeamId(null); }}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: assignType === 'worker' ? colors.brandYellow : 'rgba(255,255,255,0.05)',
              border: `1px solid ${assignType === 'worker' ? colors.brandYellow : colors.borderDefault}`,
              color: assignType === 'worker' ? '#000' : colors.textPrimary,
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Radnik
          </button>
          <button
            onClick={() => { setAssignType('team'); setSelectedWorkerId(null); }}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: assignType === 'team' ? colors.brandYellow : 'rgba(255,255,255,0.05)',
              border: `1px solid ${assignType === 'team' ? colors.brandYellow : colors.borderDefault}`,
              color: assignType === 'team' ? '#000' : colors.textPrimary,
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Tim
          </button>
        </div>

        {assignType === 'worker' ? (
          <>
            <label style={{ display: 'block', marginBottom: 8, color: colors.textPrimary, fontWeight: 600 }}>
              Dodeli radniku:
            </label>
            <select
              value={selectedWorkerId || ''}
              onChange={(e) => setSelectedWorkerId(parseInt(e.target.value) || null)}
              style={{
                width: '100%',
                padding: 10,
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: 6,
                background: colors.bgBody,
                color: colors.textPrimary,
                fontSize: 14,
              }}
            >
              <option value="" disabled>— Izaberi radnika —</option>
              {workerList.map((w: any) => (
                <option key={w.user_id} value={w.user_id}>
                  {w.full_name || w.username} · {w.shift_type || 'n/d'} · {w.open_tasks_count || 0} aktivnih
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label style={{ display: 'block', marginBottom: 8, color: colors.textPrimary, fontWeight: 600 }}>
              Dodeli timu:
            </label>
            <select
              value={selectedTeamId || ''}
              onChange={(e) => setSelectedTeamId(parseInt(e.target.value) || null)}
              style={{
                width: '100%',
                padding: 10,
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: 6,
                background: colors.bgBody,
                color: colors.textPrimary,
                fontSize: 14,
              }}
            >
              <option value="" disabled>— Izaberi tim —</option>
              {teams.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.members?.length || 0} članova
                </option>
              ))}
            </select>
          </>
        )}

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
            onClick={() => onConfirm(selectedWorkerId, selectedTeamId)}
            disabled={!canSave}
            style={{
              padding: '8px 16px',
              background: canSave ? colors.brandYellow : colors.borderCard,
              border: 'none',
              color: canSave ? '#000' : colors.textSecondary,
              borderRadius: 6,
              cursor: canSave ? 'pointer' : 'not-allowed',
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

function DetailModal({ modal, onClose }: { modal: any; onClose: () => void }) {
  if (!modal) return null;

  if (modal.type === 'receiving') {
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
            background: 'linear-gradient(180deg,#111522,#090b14)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24,
            padding: 24,
            width: '90%',
            maxWidth: 800,
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow:'0 25px 55px rgba(0,0,0,0.6)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ color: colors.brandYellow, fontSize: 20, fontWeight: 700 }}>
              Pregled prijema: {modal.data.document_number}
            </h2>
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
          <div style={{ color: colors.textSecondary, marginBottom: 16 }}>
            Dobavljač: <strong style={{ color: colors.textPrimary }}>{modal.data.supplier?.name}</strong>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.borderDefault}` }}>
                <th style={{ ...detailThStyle }}>SKU</th>
                <th style={detailThStyle}>Artikal</th>
                <th style={detailThStyle}>Očekivano</th>
                <th style={detailThStyle}>Primljeno</th>
                <th style={detailThStyle}>Lokacija</th>
              </tr>
            </thead>
            <tbody>
              {(modal.data.items || []).map((it: any) => (
                <tr key={it.id}>
                  <td style={detailTdStyle}>{it.item?.sku}</td>
                  <td style={detailTdStyle}>{it.item?.name}</td>
                  <td style={detailTdStyle}>{it.expected_quantity}</td>
                  <td style={detailTdStyle}>{it.received_quantity}</td>
                  <td style={detailTdStyle}>{it.location?.code || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (modal.type === 'location') {
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
            background: 'linear-gradient(180deg,#111522,#090b14)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24,
            padding: 24,
            width: '90%',
            maxWidth: 600,
            boxShadow:'0 25px 55px rgba(0,0,0,0.6)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ color: colors.brandYellow, fontSize: 20, fontWeight: 700 }}>
              Lokacija {modal.code}
            </h2>
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
          <div style={{ color: colors.textPrimary }}>
            Pretraži zalihe za lokaciju {modal.code} na stranici Zalihe.
          </div>
        </div>
      </div>
    );
  }

  return null;
}

const detailThStyle = {
  padding: '12px 8px',
  color: 'rgba(255,255,255,0.6)',
  fontSize: 12,
  fontWeight: 600,
  textAlign: 'left' as const,
  borderBottom:'1px solid rgba(255,255,255,0.08)'
};

const detailTdStyle = {
  padding: '12px 8px',
  color: '#f3f4f6',
  fontSize: 13,
  borderBottom:'1px solid rgba(255,255,255,0.05)'
};

function RelayoutOptimizationTab({ 
  pressureMap, 
  recommendations, 
  selectedRecommendation,
  highlightedRack,
  onSelectRecommendation,
  onHighlightRack 
}: { 
  pressureMap: any[];
  recommendations: any[];
  selectedRecommendation: any;
  highlightedRack: string | null;
  onSelectRecommendation: (rec: any) => void;
  onHighlightRack: (rack: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, minHeight: '60vh' }}>
      {/* Left: Recommendations List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
        <div style={{ background: 'linear-gradient(180deg,#111522,#090b14)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: 20, boxShadow:'0 20px 40px rgba(0,0,0,0.45)' }}>
          <h2 style={{ color: colors.brandYellow, fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
            Preporuke za optimizaciju
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '100%', overflowY: 'auto' }}>
            {recommendations.length === 0 ? (
              <div style={{ color: colors.textSecondary, padding: 24, textAlign: 'center' }}>
                Nema preporuka za optimizaciju u ovom trenutku ✅
              </div>
            ) : (
              recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  onClick={() => onSelectRecommendation(rec)}
                  style={{
                    background: selectedRecommendation === rec ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selectedRecommendation === rec ? colors.brandYellow : 'rgba(255,255,255,0.05)'}`,
                    borderRadius: 14,
                    padding: 16,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{
                      background: rec.action === 'PREMESTI SKU' ? colors.statusWarn :
                                 rec.action === 'ZATVORI LOKACIJU' ? colors.statusErr :
                                 colors.brandYellow,
                      color: '#000',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 700,
                    }}>
                      {rec.action}
                    </span>
                  </div>
                  <div style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                    {rec.sku ? `SKU: ${rec.sku}` : rec.location_code ? `Lokacija: ${rec.location_code}` : rec.action}
                  </div>
                  <div style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>
                    {rec.reason}
                  </div>
                  {rec.suggest_new_zone && (
                    <div style={{ color: colors.brandYellow, fontSize: 11, marginBottom: 4 }}>
                      → Preporuka: {rec.suggest_new_zone}
                    </div>
                  )}
                  {rec.impact && (
                    <div style={{ color: colors.statusOk, fontSize: 11 }}>
                      {rec.impact}
                    </div>
                  )}
                  {rec.current_locations && rec.current_locations.length > 0 && (
                    <div style={{ color: colors.textSecondary, fontSize: 10, marginTop: 8 }}>
                      Trenutne lokacije: {rec.current_locations.slice(0, 3).join(', ')}
                      {rec.current_locations.length > 3 && ` +${rec.current_locations.length - 3}`}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right: Pressure Map Heatmap */}
      <div style={{ background: 'linear-gradient(180deg,#111522,#090b14)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: 20, overflow: 'hidden', boxShadow:'0 20px 40px rgba(0,0,0,0.45)' }}>
        <h2 style={{ color: colors.brandYellow, fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
          Toplotna mapa prostora
        </h2>
        <div style={{ height: 'calc(100% - 50px)', overflow: 'auto' }}>
          {pressureMap.length === 0 ? (
            <div style={{ color: colors.textSecondary, padding: 24, textAlign: 'center' }}>
              Učitavanje toplotne mape...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pressureMap.map((item, idx) => {
                const riskColor = item.risk === 'CRITICAL' ? colors.statusErr :
                                 item.risk === 'UNDERUTILIZED' ? colors.statusWarn :
                                 colors.statusOk;
                const isHighlighted = highlightedRack && item.rack === highlightedRack;
                
                return (
                  <div
                    key={idx}
                    onClick={() => onHighlightRack(item.rack)}
                    style={{
                      background: isHighlighted ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isHighlighted ? colors.brandYellow : 'rgba(255,255,255,0.05)'}`,
                      borderRadius: 14,
                      padding: 14,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div>
                        <div style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 600 }}>
                          {item.zone || 'n/d'} · {item.aisle || 'n/d'} · {item.rack}
                        </div>
                        <div style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                          Iskorišćenost: {item.utilization_pct.toFixed(1)}% · Brzopokretna roba: {item.fast_movers_inside_pct.toFixed(1)}%
                        </div>
                      </div>
                      <span style={{
                        background: riskColor,
                        color: '#000',
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                      }}>
                        {item.risk}
                      </span>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: colors.textSecondary, marginBottom: 4 }}>
                        <span>Kapacitet: {item.capacity_total.toLocaleString()}</span>
                        <span>Iskorišćeno: {item.capacity_used.toLocaleString()}</span>
                      </div>
                      <div style={{ 
                        background: colors.bgBody, 
                        height: 8, 
                        borderRadius: 4, 
                        overflow: 'hidden',
                        border: `1px solid ${colors.borderDefault}`,
                      }}>
                        <div style={{
                          background: riskColor,
                          height: '100%',
                          width: `${Math.min(item.utilization_pct, 100)}%`,
                          transition: 'width 0.3s',
                        }} />
                      </div>
                    </div>
                    {item.split_sku_count > 0 && (
                      <div style={{ color: colors.statusWarn, fontSize: 10, marginTop: 6 }}>
                        ⚠️ {item.split_sku_count} SKU splitovano na više lokacija
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({ recommendation, onExecute, isExecuted }: { recommendation: Recommendation; onExecute: () => void; isExecuted: boolean }) {
  const severityColor = recommendation.severity === 'critical' ? colors.statusErr :
                        recommendation.severity === 'high' ? colors.statusWarn :
                        recommendation.severity === 'medium' ? colors.brandYellow :
                        colors.textSecondary;

  const slaBreached = recommendation.sla_state.breach_in_min <= 0;
  const slaUrgent = recommendation.sla_state.breach_in_min <= 5 && !slaBreached;

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid rgba(255,255,255,0.08)`,
        borderLeft: `4px solid ${severityColor}`,
        borderRadius: 16,
        padding: 16,
        position: 'relative',
        boxShadow:'0 14px 28px rgba(0,0,0,0.35)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontSize: 24, opacity: 0.7 }}>⚡</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{
              background: severityColor,
              color: '#000',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
            }}>
              {translateSeverity(recommendation.severity)}
            </span>
            {slaBreached && (
              <span style={{
                background: colors.statusErr,
                color: '#fff',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
              }}>
                SLA PREKORAČEN
              </span>
            )}
            {slaUrgent && !slaBreached && (
              <span style={{
                background: colors.statusWarn,
                color: '#000',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
              }}>
                HITNO ({recommendation.sla_state.breach_in_min}min)
              </span>
            )}
          </div>
          <div style={{ color: colors.textPrimary, fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
            {recommendation.title}
          </div>
          <div style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>
            {recommendation.explanation}
          </div>
          {isExecuted ? (
            <div style={{ color: colors.textSecondary, fontSize: 11, fontStyle: 'italic' }}>
              Naredba poslata · {new Date().toLocaleTimeString()}
            </div>
          ) : (
            <button
              onClick={onExecute}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: severityColor,
                border: 'none',
                color: '#000',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {recommendation.cta_label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
