import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { DashboardTile } from '../src/components/widgets/DashboardTile';
import { getDashboardSnapshot, DashboardSnapshot } from '../services/dashboardData';
import { IconReceiving } from '../src/components/icons/IconReceiving';
import { IconShipping } from '../src/components/icons/IconShipping';
import { IconSkart } from '../src/components/icons/IconSkart';
import { IconPovracaj } from '../src/components/icons/IconPovracaj';
import { IconWorkers } from '../src/components/icons/IconWorkers';
import { IconStock } from '../src/components/icons/IconStock';
import { apiClient } from '../lib/apiClient';
import { colors } from '../src/theme/colors';

// Client-side date component to prevent hydration mismatch
const ClientDate: React.FC<{ date: Date | string }> = ({ date }) => {
  const [mounted, setMounted] = useState(false);
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render UTC date during SSR and initial client render
    return <span>{dateObj.toISOString().split('T')[0]}</span>;
  }

  // After mount, render localized date
  return <span>{dateObj.toLocaleDateString('sr-RS')}</span>;
};

// Client-side time component
const ClientTime: React.FC<{ date: Date | string }> = ({ date }) => {
  const [mounted, setMounted] = useState(false);
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span>{dateObj.toISOString().split('T')[1].split('.')[0]}</span>;
  }

  return <span>{dateObj.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>;
};

export default function DashboardPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  const loadData = async () => {
    try {
      const [data, events] = await Promise.all([
        getDashboardSnapshot(),
        apiClient.get('/dashboard/live-events?limit=50').catch(() => []),
      ]);
      setSnapshot(data);
      setRecentEvents(Array.isArray(events) ? events : []);
    } catch (error: any) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 24, color: colors.textPrimary, textAlign: 'center' }}>
        Učitavanje dashboard-a...
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div style={{ padding: 24, color: colors.textPrimary, textAlign: 'center' }}>
        Greška pri učitavanju podataka.
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #05070d 0%, #020304 100%)',
        minHeight: '100vh',
        padding: '2rem clamp(1.5rem, 2vw, 3rem)',
        boxSizing: 'border-box',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.75rem',
      }}
    >
      {/* Hero Section */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div
            style={{
              textTransform: 'uppercase',
              letterSpacing: 3,
              fontSize: 12,
              color: 'rgba(255,255,255,0.45)',
            }}
          >
            Kontrolna tabla
          </div>
          <h1
            style={{
              margin: '6px 0 8px',
              fontSize: 32,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #ffd400 0%, #ffaa00 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
            }}
          >
            Dashboard
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', maxWidth: 520 }}>
            Pregled aktivnosti u skladištu u realnom vremenu.
          </p>
        </div>
      </div>

      {/* Dashboard Tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
        }}
      >
        <DashboardTile
          title="Prijem"
          icon={<IconReceiving size={24} color={colors.brandYellow} />}
          lines={[
            { label: 'U toku', value: String(snapshot.receiving.inProgress) },
            { label: 'Na čekanju', value: String(snapshot.receiving.waiting) },
            {
              label: 'Završeno danas',
              value: String(snapshot.receiving.completedToday || 0),
              color: colors.brandYellow,
            },
          ]}
          footerActionLabel="Prikaži prijeme"
          onFooterAction={() => router.push('/receiving')}
        />

        <DashboardTile
          title="Otprema"
          icon={<IconShipping size={24} color={colors.brandYellow} />}
          lines={[
            { label: 'Učitavanje', value: String(snapshot.shipping.loadingNow) },
            { label: 'Spremno za otpremu', value: String(snapshot.shipping.stagedReady) },
            {
              label: 'Završeno danas',
              value: String(snapshot.shipping.completedToday || 0),
              color: colors.brandYellow,
            },
          ]}
          footerActionLabel="Prikaži otpreme"
          onFooterAction={() => router.push('/shipping')}
        />

        <DashboardTile
          title="SKART"
          icon={<IconSkart size={24} color={colors.brandYellow} />}
          lines={[
            { label: 'Submitovano danas', value: String(snapshot.skart.submittedToday) },
            { label: 'Primljeno danas', value: String(snapshot.skart.receivedToday) },
            {
              label: 'Razlika',
              value: `${snapshot.skart.differencePercent}%`,
              color: snapshot.skart.differencePercent > 10 ? '#ef4444' : colors.brandYellow,
            },
          ]}
          footerActionLabel="Prikaži SKART"
          onFooterAction={() => router.push('/skart')}
        />

        <DashboardTile
          title="Povraćaj"
          icon={<IconPovracaj size={24} color={colors.brandYellow} />}
          lines={[
            { label: 'Submitovano danas', value: String(snapshot.povracaj.submittedToday) },
            { label: 'Primljeno danas', value: String(snapshot.povracaj.receivedToday) },
            {
              label: 'Razlika',
              value: `${snapshot.povracaj.differencePercent}%`,
              color: snapshot.povracaj.differencePercent > 10 ? '#ef4444' : colors.brandYellow,
            },
          ]}
          footerActionLabel="Prikaži povraćaj"
          onFooterAction={() => router.push('/povracaj')}
        />

        <DashboardTile
          title="Radna snaga"
          icon={<IconWorkers size={24} color={colors.brandYellow} />}
          lines={[
            { label: 'Online', value: String(snapshot.workforce.onlineWorkers) },
            { label: 'Ukupno', value: String(snapshot.workforce.totalWorkers) },
            {
              label: 'Procenat aktivnih',
              value:
                snapshot.workforce.totalWorkers > 0
                  ? `${Math.round(
                      (snapshot.workforce.onlineWorkers / snapshot.workforce.totalWorkers) * 100
                    )}%`
                  : '0%',
              color: colors.brandYellow,
            },
          ]}
          footerActionLabel="Prikaži radnu snagu"
          onFooterAction={() => router.push('/workforce')}
        />

        <DashboardTile
          title="Zalihe"
          icon={<IconStock size={24} color={colors.brandYellow} />}
          lines={[
            { label: 'Hotspot lokacije', value: String(snapshot.stock.hotspotLocations) },
          ]}
          footerActionLabel="Prikaži zalihe"
          onFooterAction={() => router.push('/stock')}
        />
      </div>

      {/* Live Events Table */}
      <div
        style={{
          background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85), rgba(2, 6, 23, 0.85))',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 20,
          padding: 24,
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#fde68a',
              margin: 0,
            }}
          >
            Dnevnik događaja
          </h2>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={loadData}
              style={{
                background: 'rgba(250,204,21,0.1)',
                color: '#fde68a',
                border: '1px solid rgba(250,204,21,0.35)',
                padding: '8px 16px',
                borderRadius: 12,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(250,204,21,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(250,204,21,0.1)';
              }}
            >
              Osveži
            </button>
            <button
              onClick={async () => {
                if (!confirm('Da li ste sigurni da želite da obrišete sve događaje?')) return;
                try {
                  await apiClient.delete('/dashboard/live-events');
                  setRecentEvents([]);
                } catch (err) {
                  alert('Brisanje nije uspelo.');
                }
              }}
              style={{
                background: 'rgba(239,68,68,0.12)',
                color: '#fca5a5',
                border: '1px solid rgba(239,68,68,0.35)',
                padding: '8px 16px',
                borderRadius: 12,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
              }}
            >
              Obriši sve
            </button>
          </div>
        </div>
        {recentEvents.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, padding: 20, textAlign: 'center' }}>
            Nema aktivnosti za prikaz.
          </div>
        ) : (
          <div
            style={{
              overflowX: 'auto',
              borderRadius: 12,
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 12, letterSpacing: 0.5 }}>
                    Vreme
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 12, letterSpacing: 0.5 }}>
                    Korisnik
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 12, letterSpacing: 0.5 }}>
                    Akcija
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 12, letterSpacing: 0.5 }}>
                    Detalji
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((event: any) => (
                  <tr
                    key={event.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                      {event.created_at ? (
                        <div>
                          <div><ClientDate date={event.created_at} /></div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                            <ClientTime date={event.created_at} />
                          </div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#f8fafc' }}>
                      {event.actor ? (
                        <div>
                          <div style={{ fontWeight: 600, color: '#fde68a' }}>
                            {event.actor.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                            {event.actor.role}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#f8fafc', textTransform: 'capitalize' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 6,
                          background: 'rgba(250,204,21,0.15)',
                          border: '1px solid rgba(250,204,21,0.3)',
                          color: '#fde68a',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {event.action}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.8)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {event.team && (
                          <span style={{ fontSize: 20 }}>{event.team.logo}</span>
                        )}
                        <span>{event.description || '—'}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

