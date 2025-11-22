import { useEffect, useMemo, useState } from 'react';
import { fetchOverview } from '../../src/lib/api';
import { perfSocket } from '../../src/lib/socket';

type Split = { box_assigned:number; box_completed:number; items_assigned:number; items_completed:number };
type Worker = { name:string; team:string; shift?: string|null; receiving: Split; shipping: Split };
type Team = { team:string; box_assigned?:number; box_completed?:number; invoices_completed?:number; sku_completed?:number; putaway?:number; replenishment?:number; full_palets?:number; total_palets?:number };

export default function Wallboard(){
  const [data, setData] = useState<{ workers: Worker[]; teams: Team[]; refresh_interval: number; server_time: string }|null>(null);
  const [countdown, setCountdown] = useState(0);
  const [socketOk, setSocketOk] = useState(false);

  useEffect(()=>{
    let mounted = true;
    (async()=>{
      try{ const snap = await fetchOverview(); if(mounted){ setData(snap); setCountdown(snap.refresh_interval); } } catch{}
    })();
    const onUpdate = (snap:any)=>{ setData(snap); setCountdown(snap.refresh_interval); };
    perfSocket.on('connect', ()=> setSocketOk(true));
    perfSocket.on('disconnect', ()=> setSocketOk(false));
    perfSocket.on('performance:update', onUpdate);
    const t = setInterval(()=> setCountdown(c=> Math.max(0, c-1)), 1000);
    return ()=>{ mounted=false; perfSocket.off('performance:update', onUpdate); clearInterval(t); };
  },[]);

  // Dve radne tabele: levo prijem, desno otprema

  // Totals for header badges
  const sum = (rows: Worker[], accessor: (w: Worker)=>Split) => {
    const s = rows.reduce((acc, w)=>{
      const sp = accessor(w);
      acc.box_assigned += (sp.box_assigned||0);
      acc.box_completed += (sp.box_completed||0);
      acc.items_assigned += (sp.items_assigned||0);
      acc.items_completed += (sp.items_completed||0);
      return acc;
    }, { box_assigned:0, box_completed:0, items_assigned:0, items_completed:0 });
    return s as Split;
  };
  const recTotals = sum(data?.workers||[], w=>w.receiving);
  const shipTotals = sum(data?.workers||[], w=>w.shipping);
  const combinedTotals = useMemo(() => {
    const stats = { ordersAssigned: 0, ordersDone: 0, itemsAssigned: 0, itemsDone: 0 };
    (data?.workers || []).forEach(w => {
      stats.ordersAssigned += (w.receiving.box_assigned || 0) + (w.shipping.box_assigned || 0);
      stats.ordersDone += (w.receiving.box_completed || 0) + (w.shipping.box_completed || 0);
      stats.itemsAssigned += (w.receiving.items_assigned || 0) + (w.shipping.items_assigned || 0);
      stats.itemsDone += (w.receiving.items_completed || 0) + (w.shipping.items_completed || 0);
    });
    return stats;
  }, [data?.workers]);

  return (
    <div style={styles.root}>
      <TopHero countdown={countdown} socketOk={socketOk} serverTime={data?.server_time} />

      <div style={styles.summaryRow}>
        <SummaryCard
          title="Ukupno završeni nalozi"
          primary={`${fmt0(recTotals.box_completed + shipTotals.box_completed)}`}
          secondary={`od ${fmt0(recTotals.box_assigned + shipTotals.box_assigned)}`}
          accent="#facc15"
        />
        <SummaryCard
          title="Ukupno završene stavke"
          primary={`${fmt0(recTotals.items_completed + shipTotals.items_completed)}`}
          secondary={`od ${fmt0(recTotals.items_assigned + shipTotals.items_assigned)}`}
          accent="#34d399"
        />
        <SummaryCard
          title="Aktivni zadaci"
          primary={`${fmt0(Math.max(0, combinedTotals.ordersAssigned - combinedTotals.ordersDone))}`}
          secondary="trenutno u radu"
          accent="#38bdf8"
        />
        <SummaryCard
          title="Auto-refresh"
          primary={`${countdown}s`}
          secondary="do sledećeg osveženja"
          accent="#a855f7"
        />
      </div>

      <div style={styles.boardGrid}>
        <div style={{ ...styles.leaderboardPanel, maxWidth: 620 }}>
          <SectionTitle label="Rang lista magacionera" />
          <div style={styles.sectionCaption}>Rezultati se resetuju svakog 1. dana u mesecu.</div>
          <IndividualLeaderboard rows={data?.workers || []} />
        </div>
        <div style={styles.leaderboardPanel}>
          <SectionTitle label="Aktivni zadaci" />
          <WorkInProgressTable rows={data?.workers || []} />
        </div>
      </div>

      <FooterStatus serverTime={data?.server_time} socketOk={socketOk} />
    </div>
  );
}

function FooterStatus({ serverTime, socketOk }:{ serverTime?:string; socketOk:boolean }){
  return (
    <div style={{ position:'fixed', right: 16, bottom: 12, color:'#aaa', fontSize: 12, display:'flex', alignItems:'center', gap:12 }}>
      <span>Poslednje ažuriranje: {serverTime ? new Date(serverTime).toLocaleTimeString() : '-'}</span>
      <span>Veza: <span style={{ color: socketOk ? '#22c55e' : '#9ca3af' }}>●</span></span>
      <span style={{ opacity:.8 }}>Smena: PRVA 08:00–15:00 (pauza 10:00–10:30) · DRUGA 12:00–19:00 (pauza 14:00–14:30)</span>
    </div>
  );
}

const styles = {
  root: {
    background: 'radial-gradient(circle at top, #1f2937 0%, #0b0b0b 55%)',
    color: '#fff',
    minHeight: '100vh',
    padding: '32px 40px 120px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  } as const,
  heroBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 24,
  } as const,
  heroTitle: {
    fontSize: 36,
    fontWeight: 800,
    letterSpacing: 2,
  } as const,
  heroSubtitle: {
    marginTop: 8,
    fontSize: 15,
    color: '#cbd5f5',
    opacity: 0.85,
  } as const,
  heroStats: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  } as const,
  heroChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(20,31,54,0.75)',
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,0.3)',
    padding: '10px 18px',
    fontWeight: 600,
    letterSpacing: 1,
  } as const,
  heroClock: {
    fontWeight: 700,
    fontSize: 24,
    fontVariantNumeric: 'tabular-nums',
  } as const,
  summaryRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 18,
    marginTop: 28,
  } as const,
  boardGrid: {
    marginTop: 32,
    display: 'grid',
    gridTemplateColumns: 'minmax(380px, 0.85fr) minmax(320px, 1fr)',
    gap: 24,
    alignItems: 'flex-start',
  } as const,
  leaderboardPanel: {
    background: 'linear-gradient(135deg, rgba(17,24,39,0.92), rgba(3,7,18,0.92))',
    border: '1px solid rgba(148,163,184,0.25)',
    borderRadius: 18,
    padding: 28,
    boxShadow: '0 18px 65px rgba(0,0,0,0.38)',
  } as const,
  summaryCard: {
    position: 'relative',
    borderRadius: 18,
    padding: '20px 24px',
    background: 'linear-gradient(145deg, rgba(31,41,55,0.8), rgba(17,24,39,0.9))',
    border: '1px solid rgba(148,163,184,0.2)',
    boxShadow: '0 12px 30px rgba(15,23,42,0.4)',
    overflow: 'hidden',
  } as const,
  summaryAccent: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 120,
    height: 120,
    filter: 'blur(70px)',
    opacity: 0.6,
  } as const,
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 1,
    marginBottom: 18,
    textTransform: 'uppercase',
  } as const,
  sectionCaption: {
    fontSize: 13,
    color: '#94a3b8',
    opacity: 0.85,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: -6,
    marginBottom: 14,
  } as const,
  rankingTableWrapper: {
    marginTop: 12,
    borderRadius: 20,
    border: '1px solid rgba(148,163,184,0.15)',
    background: 'rgba(15,23,42,0.75)',
    overflow: 'hidden',
  } as const,
  rankTable: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
  } as const,
  rankHeaderPos: {
    width: '8%',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 600,
    padding: '16px 18px',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#94a3b8',
    background: 'rgba(10,12,24,0.6)',
  } as const,
  rankHeaderName: {
    textAlign: 'left',
    fontSize: 16,
    fontWeight: 600,
    padding: '16px 18px',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#94a3b8',
    background: 'rgba(10,12,24,0.6)',
  } as const,
  rankHeaderMetric: {
    width: '18%',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 600,
    padding: '16px 18px',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#94a3b8',
    background: 'rgba(10,12,24,0.6)',
  } as const,
  rankRow: {
    borderBottom: '1px solid rgba(148,163,184,0.1)',
    background: 'rgba(15,23,42,0.35)',
  } as const,
  rankRowGold: {
    borderBottom: '1px solid rgba(148,163,184,0.12)',
    background: 'linear-gradient(90deg, rgba(250,204,21,0.18), rgba(15,23,42,0.35))',
  } as const,
  rankRowSilver: {
    borderBottom: '1px solid rgba(148,163,184,0.12)',
    background: 'linear-gradient(90deg, rgba(148,163,184,0.24), rgba(15,23,42,0.35))',
  } as const,
  rankRowBronze: {
    borderBottom: '1px solid rgba(148,163,184,0.12)',
    background: 'linear-gradient(90deg, rgba(251,191,36,0.16), rgba(15,23,42,0.35))',
  } as const,
  rankCellPos: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 800,
    padding: '16px',
    color: '#f8fafc',
  } as const,
  rankCellName: {
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  } as const,
  rankCellMetric: {
    textAlign: 'center',
    fontSize: 26,
    fontWeight: 800,
    padding: '16px',
    color: '#f1f5f9',
  } as const,
  rankName: {
    fontSize: 26,
    fontWeight: 900,
    lineHeight: 1.1,
    color: '#f8fafc',
  } as const,
  rankTeam: {
    fontSize: 14,
    color: '#94a3b8',
    letterSpacing: 1,
    textTransform: 'uppercase',
  } as const,
  progressTrack: {
    height: 8,
    width: '100%',
    borderRadius: 999,
    background: 'rgba(100,116,139,0.25)',
    overflow: 'hidden',
    marginTop: 6,
  } as const,
  progressFill: {
    height: '100%',
    borderRadius: 999,
    background: 'linear-gradient(90deg, #22c55e, #38bdf8)',
    transition: 'width 0.4s ease',
  } as const,
  progressLabel: {
    fontSize: 11,
    color: '#cbd5f5',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  } as const,
  wipTable: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
  } as const,
  wipRow: {
    borderBottom: '1px solid rgba(148,163,184,0.12)',
  } as const,
  wipNameCell: {
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  } as const,
  wipMetricsCell: {
    padding: '14px 16px',
    minWidth: 120,
    textAlign: 'right',
    color: '#e2e8f0',
    fontWeight: 700,
    fontSize: 18,
  } as const,
  wipSub: {
    fontSize: 13,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  } as const,
  wipBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(59,130,246,0.12)',
    color: '#60a5fa',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  } as const,
};

// Simple keyframes for subtle top‑3 entrance
if (typeof document !== 'undefined') {
  const id = 'tv-anim-keyframes';
  if (!document.getElementById(id)) {
    const s = document.createElement('style');
    s.id = id;
    s.innerHTML = `@keyframes fadeInUp{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:translateY(0)}}`;
    document.head.appendChild(s);
  }
}

// Per‑team totals table (Receiving/Shipping)
function IndividualLeaderboard({ rows }: { rows: Worker[] }) {
  const ranking = rows
    .map((w) => {
      const ordersAssigned = (w.receiving.box_assigned || 0) + (w.shipping.box_assigned || 0);
      const ordersDone = (w.receiving.box_completed || 0) + (w.shipping.box_completed || 0);
      const itemsDone = (w.receiving.items_completed || 0) + (w.shipping.items_completed || 0);
      const progress = ordersAssigned > 0 ? Math.min(1, ordersDone / ordersAssigned) : 0;
      return {
        name: w.name,
        team: w.team,
        ordersDone,
        itemsDone,
        ordersAssigned,
        progress,
      };
    })
    .filter(r => r.ordersDone > 0 || r.itemsDone > 0)
    .sort((a, b) => {
      if (b.ordersDone !== a.ordersDone) return b.ordersDone - a.ordersDone;
      if (b.itemsDone !== a.itemsDone) return b.itemsDone - a.itemsDone;
      return a.name.localeCompare(b.name || '');
    });

  if (!ranking.length) {
    return <div style={{ color: '#9ca3af', fontSize: 18, padding: 24 }}>Nema podataka</div>;
  }

  return (
    <div style={styles.rankingTableWrapper}>
      <table style={styles.rankTable}>
        <thead>
          <tr>
            <th style={styles.rankHeaderPos}>#</th>
            <th style={styles.rankHeaderName}>Magacioner</th>
            <th style={styles.rankHeaderMetric}>Završeni nalozi</th>
            <th style={styles.rankHeaderMetric}>Završeni artikli</th>
            <th style={styles.rankHeaderMetric}>Progres</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((row, idx) => {
            const highlight =
              idx === 0 ? styles.rankRowGold :
              idx === 1 ? styles.rankRowSilver :
              idx === 2 ? styles.rankRowBronze :
              styles.rankRow;

            const pct = Math.round((row.progress || 0) * 100);

            return (
              <tr key={row.name} style={highlight}>
                <td style={styles.rankCellPos}>{idx + 1}</td>
                <td style={styles.rankCellName}>
                  <span style={styles.rankName}>{row.name}</span>
                  <span style={styles.rankTeam}>{row.team}</span>
                </td>
                <td style={styles.rankCellMetric}>{fmt0(row.ordersDone)}</td>
                <td style={styles.rankCellMetric}>{fmt0(row.itemsDone)}</td>
                <td style={{ ...styles.rankCellMetric, padding: '14px 16px' }}>
                  <span style={{ fontSize: 18 }}>{pct}%</span>
                  <div style={styles.progressTrack}>
                    <div style={{ ...styles.progressFill, width: `${pct}%` }} />
                  </div>
                  <div style={styles.progressLabel}>
                    {row.ordersAssigned > 0
                      ? `${fmt0(row.ordersDone)} / ${fmt0(row.ordersAssigned)}`
                      : 'Nema zadataka'}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const nf0 = new Intl.NumberFormat('sr-Latn-RS', { maximumFractionDigits: 0 });
function fmt0(value: number) {
  if (!Number.isFinite(value)) return '0';
  return nf0.format(Math.round(value));
}

function WorkInProgressTable({ rows }: { rows: Worker[] }) {
  const tasks = rows
    .map((w) => {
      const ordersAssigned = (w.receiving.box_assigned || 0) + (w.shipping.box_assigned || 0);
      const ordersDone = (w.receiving.box_completed || 0) + (w.shipping.box_completed || 0);
      const itemsAssigned = (w.receiving.items_assigned || 0) + (w.shipping.items_assigned || 0);
      const itemsDone = (w.receiving.items_completed || 0) + (w.shipping.items_completed || 0);
      const activeOrders = Math.max(0, ordersAssigned - ordersDone);
      const remainingItems = Math.max(0, itemsAssigned - itemsDone);
      const progress = ordersAssigned > 0 ? Math.min(1, ordersDone / ordersAssigned) : 0;
      return {
        name: w.name,
        team: w.team,
        activeOrders,
        remainingItems,
        progress,
      };
    })
    .filter(t => t.activeOrders > 0 || t.remainingItems > 0)
    .sort((a, b) => {
      if (b.activeOrders !== a.activeOrders) return b.activeOrders - a.activeOrders;
      if (b.remainingItems !== a.remainingItems) return b.remainingItems - a.remainingItems;
      return a.name.localeCompare(b.name);
    });

  if (!tasks.length) {
    return <div style={{ color: '#9ca3af', fontSize: 16, padding: 24 }}>Trenutno nema aktivnih zadataka.</div>;
  }

  return (
    <table style={styles.wipTable}>
      <tbody>
        {tasks.map((row, idx) => {
          const pct = Math.round((row.progress || 0) * 100);
          return (
            <tr key={row.name} style={styles.wipRow}>
              <td style={styles.wipNameCell}>
                <span style={styles.rankName}>{row.name}</span>
                <span style={styles.rankTeam}>{row.team}</span>
                <span style={styles.wipBadge}>
                  {row.activeOrders} naloga • {row.remainingItems} artikala
                </span>
              </td>
              <td style={styles.wipMetricsCell}>
                <div style={{ fontSize: 22 }}>{pct}%</div>
                <div style={styles.progressTrack}>
                  <div style={{ ...styles.progressFill, width: `${pct}%` }} />
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Završeno</div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TopHero({ countdown, socketOk, serverTime }: { countdown: number; socketOk: boolean; serverTime?: string }) {
  const clock = serverTime ? new Date(serverTime).toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--';
  return (
    <div style={styles.heroBar}>
      <div>
        <div style={styles.heroTitle}>KONTROLNA TABLA UČINKA</div>
        <div style={styles.heroSubtitle}>Reakcija magacionera u realnom vremenu · Auto-refresh svakih {countdown}s</div>
      </div>
      <div style={styles.heroStats}>
        <div style={styles.heroChip}>
          <span style={{ color: socketOk ? '#22c55e' : '#f97316' }}>●</span>
          <span>{socketOk ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
        <div style={styles.heroClock}>{clock}</div>
      </div>
    </div>
  );
}

function SummaryCard({ title, primary, secondary, accent }: { title: string; primary: string; secondary: string; accent: string }) {
  return (
    <div style={styles.summaryCard}>
      <div style={{ ...styles.summaryAccent, background: accent }} />
      <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1.2, color: '#cbd5f5', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: 800 }}>{primary}</div>
      <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 6 }}>{secondary}</div>
    </div>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <div style={styles.sectionTitle}>
      <span>{label}</span>
    </div>
  );
}
