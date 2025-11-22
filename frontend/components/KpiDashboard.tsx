import React, { useEffect, useState } from 'react';
import { colors } from '../src/theme/colors';
import { apiClient } from '../lib/apiClient';
import { IconReceiving } from '../src/components/icons/IconReceiving';
import { IconShipping } from '../src/components/icons/IconShipping';
import { IconCycleCount } from '../src/components/icons/IconCycleCount';
import { IconWorkers } from '../src/components/icons/IconWorkers';
import { IconCapacity } from '../src/components/icons/IconCapacity';
import { IconSkart } from '../src/components/icons/IconSkart';
import { IconPovracaj } from '../src/components/icons/IconPovracaj';

export default function KpiDashboard() {
  const [overview, setOverview] = useState<any>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [heatmap, setHeatmap] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<any>(null);

  const loadData = async () => {
    try {
      const [ov, wr, hm, tl] = await Promise.all([
        apiClient.get('/kpi/overview'),
        apiClient.get('/kpi/workers').catch(() => []),
        apiClient.get('/kpi/warehouse-heatmap').catch(() => []),
        apiClient.get('/kpi/timeline').catch(() => []),
      ]);
      setOverview(ov);
      setWorkers(wr || []);
      setHeatmap(hm || []);
      setTimeline(Array.isArray(tl) && tl.length > 0 ? tl : []);
    } catch (e: any) {
      console.error('KPI load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // 30s refresh
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div style={{ padding: 24, color: colors.textPrimary }}>Učitavanje KPI dashboard-a...</div>;
  }

  return (
    <div style={{ background: "linear-gradient(180deg,#05070d 0%,#020304 100%)", minHeight: '100vh', padding: "2rem clamp(1.5rem,2vw,3rem)", boxSizing: 'border-box', color:'#f8fafc', display:'flex', flexDirection:'column', gap:'1.75rem' }}>
      <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'space-between', gap:16 }}>
        <div>
          <div style={{ textTransform:'uppercase', letterSpacing:3, fontSize:12, color:'rgba(255,255,255,0.45)' }}>KPI nadzor</div>
          <h1 style={{ margin:'6px 0 8px', fontSize:32, fontWeight:700 }}>Centar performansi</h1>
          <p style={{ color:'rgba(255,255,255,0.6)', maxWidth:520 }}>Podaci o prijemu, otpremi, radnicima i skladištu u realnom vremenu.</p>
        </div>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <StatusChip label="Prijemi danas" value={overview?.receivings_today ?? '—'} />
          <StatusChip label="Otpreme danas" value={overview?.shipments_today ?? '—'} />
          <StatusChip label="Aktivni radnici" value={overview?.active_workers ?? '—'} />
        </div>
      </div>

      {/* Top KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <KpiCard
            icon={<IconReceiving size={24} color={colors.brandYellow} />}
            label="Prijemi danas"
            value={overview?.receivings_today || 0}
            trend="up"
            onClick={() => window.location.href = '/receiving'}
          />
          {/* Put-away card removed per request */}
          <KpiCard
            icon={<IconShipping size={24} color={colors.brandYellow} />}
            label="Otpreme danas"
            value={overview?.shipments_today || 0}
            trend="neutral"
            onClick={() => window.location.href = '/shipping'}
          />
          <KpiCard
            icon={<IconCycleCount size={24} color={colors.brandYellow} />}
            label="Popisi"
            value={overview?.cycle_counts_today || 0}
            trend="neutral"
          />
          <KpiCard
            icon={<IconSkart size={24} color={colors.brandYellow} />}
            label="SKART danas"
            value={overview?.skart_today || 0}
            trend="neutral"
            onClick={() => window.location.href = '/skart'}
          />
          <KpiCard
            icon={<IconPovracaj size={24} color={colors.brandYellow} />}
            label="Povraćaj danas"
            value={overview?.povracaj_today || 0}
            trend="neutral"
            onClick={() => window.location.href = '/povracaj'}
          />
          <KpiCard
            icon={<IconWorkers size={24} color={colors.brandYellow} />}
            label="Aktivni radnici"
            value={overview?.active_workers || 0}
            trend="up"
            onClick={() => window.location.href = '/workforce'}
          />
          <KpiCard
            icon={<IconCapacity size={24} color={colors.brandYellow} />}
            label="Iskorišćenost skladišta"
            value={`${Math.round((overview?.warehouse_fill_ratio || 0) * 100)}%`}
            trend="neutral"
            onClick={() => window.location.href = '/warehouse-map'}
          />
      </div>

      {/* Heatmap + Timeline Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 18 }}>
        {/* Warehouse Heatmap */}
        <div style={{ background: 'linear-gradient(180deg,#111522,#090b14)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: 20, boxShadow:'0 20px 40px rgba(0,0,0,0.45)' }}>
            <h2 style={{ color: colors.brandYellow, fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
              Toplotna mapa skladišta
            </h2>
            <WarehouseHeatmap data={heatmap} />
          </div>

          {/* Timeline Chart */}
        <div style={{ background: 'linear-gradient(180deg,#111522,#090b14)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: 20, boxShadow:'0 20px 40px rgba(0,0,0,0.45)' }}>
            <h2 style={{ color: colors.brandYellow, fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
              Aktivnost kroz dan
            </h2>
            <TimelineChart data={timeline} />
          </div>
      </div>

      {/* Workers Table + Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
        {/* Workers Performance Table */}
        <div style={{ background: 'linear-gradient(180deg,#111522,#090b14)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: 20, boxShadow:'0 20px 40px rgba(0,0,0,0.45)' }}>
            <h2 style={{ color: colors.brandYellow, fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
              Performanse radnika
            </h2>
            <WorkersTable workers={workers} onRowClick={(w) => setSelectedWorker(w)} />
          </div>

          {/* Alerts */}
        <div style={{ background: 'linear-gradient(180deg,#111522,#090b14)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: 20, boxShadow:'0 20px 40px rgba(0,0,0,0.45)' }}>
            <h2 style={{ color: colors.brandYellow, fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
              Upozorenja i izuzeci
            </h2>
            <AlertsSection alerts={overview?.alerts} />
          </div>
      </div>

      {/* Worker Detail Modal */}
      {selectedWorker && (
        <WorkerDetailModal
          worker={selectedWorker}
          onClose={() => setSelectedWorker(null)}
        />
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  trend,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend: 'up' | 'down' | 'neutral';
  onClick?: () => void;
}) {
  const trendColor = trend === 'up' ? colors.statusOk : trend === 'down' ? colors.statusErr : 'rgba(255,255,255,0.6)';
  return (
    <div style={{
      background: "linear-gradient(175deg,#151922 0%,#090b11 100%)",
      borderRadius: "18px",
      border: "1px solid rgba(255,255,255,0.05)",
      padding: "1.25rem",
      color: "#f8fafc",
      boxShadow: "0 18px 35px rgba(0,0,0,0.55)",
      cursor: onClick ? 'pointer' : 'default',
      transition:'transform 0.2s ease'
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    } : undefined}
    >
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
        <div style={{ width:42, height:42, borderRadius:12, background:'rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'center' }}>{icon}</div>
      </div>
      <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginBottom: 10 }}>{label}</div>
      <div style={{ color: '#fff', fontSize: 30, fontWeight: 700 }}>{value}</div>
      <div style={{ color: trendColor, fontSize: 12, marginTop: 6 }}>
        {trend === 'up' && '↑ +12%'} {trend === 'down' && '↓ -5%'} {trend === 'neutral' && '→ 0%'}
      </div>
    </div>
  );
}

function WarehouseHeatmap({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ color: colors.textSecondary, padding: 24, textAlign: 'center' }}>
        Nema podataka za heatmap. Proverite da li postoje zone u skladištu.
      </div>
    );
  }

  const maxFill = Math.max(...(data.map(d => d.fillRatio || 0)), 0.01);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.map((item, idx) => {
        const fillRatio = item.fillRatio || 0;
        const fillPercent = Math.min(100, Math.round((fillRatio / maxFill) * 100));
        const color = fillRatio >= 0.9 ? colors.statusErr :
                     fillRatio >= 0.7 ? colors.statusWarn :
                     fillRatio >= 0.5 ? colors.brandYellow :
                     colors.statusOk;
        
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 60, color: colors.textPrimary, fontWeight: 600 }}>Zona {item.zone}</div>
            <div style={{
              flex: 1,
              height: 32,
              background: colors.borderCard,
              borderRadius: 4,
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer',
            }}
            title={`Fill: ${Math.round(fillRatio * 100)}%`}
            onClick={() => window.location.href = `/warehouse-map?zone=${item.zone}`}
            >
              <div style={{
                width: `${fillPercent}%`,
                height: '100%',
                background: color,
                transition: 'width 0.3s',
              }} />
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.textPrimary,
                fontSize: 12,
                fontWeight: 600,
              }}>
                {Math.round(fillRatio * 100)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimelineChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ color: colors.textSecondary, padding: 24, textAlign: 'center' }}>
        Nema podataka za timeline. Podaci će se prikazati kako se aktivnosti obavljaju.
      </div>
    );
  }

  const safeData = data.map((d, idx) => {
    const hour = typeof d.hour === 'number' && Number.isFinite(d.hour) ? d.hour : (idx + 7);
    return {
      hour,
      putaway: Number(d.putaway) || 0,
      pick: Number(d.pick) || 0,
      popis: Number(d.popis) || 0,
      prijem: Number(d.prijem) || 0,
      skart: Number(d.skart) || 0,
      povracaj: Number(d.povracaj) || 0,
    };
  });

  const maxValue = Math.max(...safeData.flatMap(d => [d.putaway, d.pick, d.popis, d.prijem, d.skart, d.povracaj]), 1);
  const width = 600;
  const height = 200;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = {
    putaway: safeData.map(d => ({
      x: ((d.hour - 7) / 12) * chartWidth + padding,
      y: height - padding - (d.putaway / maxValue) * chartHeight,
    })),
    pick: safeData.map(d => ({
      x: ((d.hour - 7) / 12) * chartWidth + padding,
      y: height - padding - (d.pick / maxValue) * chartHeight,
    })),
    popis: safeData.map(d => ({
      x: ((d.hour - 7) / 12) * chartWidth + padding,
      y: height - padding - (d.popis / maxValue) * chartHeight,
    })),
    prijem: safeData.map(d => ({
      x: ((d.hour - 7) / 12) * chartWidth + padding,
      y: height - padding - (d.prijem / maxValue) * chartHeight,
    })),
    skart: safeData.map(d => ({
      x: ((d.hour - 7) / 12) * chartWidth + padding,
      y: height - padding - (d.skart / maxValue) * chartHeight,
    })),
    povracaj: safeData.map(d => ({
      x: ((d.hour - 7) / 12) * chartWidth + padding,
      y: height - padding - (d.povracaj / maxValue) * chartHeight,
    })),
  };

  const path = (pts: any[]) => {
    if (pts.length === 0) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  };

  return (
    <div>
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(v => (
          <line
            key={v}
            x1={padding}
            y1={padding + v * chartHeight}
            x2={width - padding}
            y2={padding + v * chartHeight}
            stroke={colors.borderCard}
            strokeWidth={1}
          />
        ))}
        
        {/* Put-away line removed per request */}
        <path d={path(points.pick)} fill="none" stroke={colors.brandBlueDock} strokeWidth={2} />
        <path d={path(points.popis)} fill="none" stroke={colors.textSecondary} strokeWidth={2} />
        <path d={path(points.prijem)} fill="none" stroke={colors.brandYellow} strokeWidth={2} />
        <path d={path(points.skart)} fill="none" stroke="#FF6B6B" strokeWidth={2} strokeDasharray="4 4" />
        <path d={path(points.povracaj)} fill="none" stroke="#9B59B6" strokeWidth={2} strokeDasharray="4 4" />

        {/* X-axis labels */}
        {data.filter((_, i) => i % 2 === 0).map((d, i) => (
          <text
            key={i}
            x={points.putaway[i * 2]?.x || padding}
            y={height - 10}
            fill={colors.textSecondary}
            fontSize={10}
            textAnchor="middle"
          >
            {d.hour}:00
          </text>
        ))}
      </svg>
      
      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12 }}>
        <LegendItem color={colors.brandBlueDock} label="Pick" />
        <LegendItem color={colors.textSecondary} label="Popis" />
        <LegendItem color={colors.brandYellow} label="Prijem" />
        <LegendItem color="#FF6B6B" label="SKART" dash={true} />
        <LegendItem color="#9B59B6" label="Povraćaj" dash={true} />
      </div>
    </div>
  );
}

function LegendItem({ color, label, dash }: { color: string; label: string; dash?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 16, height: 2, background: dash ? 'transparent' : color, borderTop: dash ? `2px dashed ${color}` : undefined }} />
      <span style={{ color: colors.textSecondary }}>{label}</span>
    </div>
  );
}

function WorkersTable({ workers, onRowClick }: { workers: any[]; onRowClick: (w: any) => void }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${colors.borderDefault}` }}>
            <th style={{ ...thStyle, textAlign: 'left' }}>Radnik</th>
            <th style={thStyle}>Uloga</th>
            <th style={thStyle}>Smena</th>
            <th style={thStyle}>Prijemi</th>
            {/* Put-away column removed */}
            <th style={thStyle}>Otpreme</th>
            <th style={thStyle}>Popisi</th>
            <th style={thStyle}>SKART</th>
            <th style={thStyle}>Povraćaj</th>
            <th style={thStyle}>Efikasnost</th>
            <th style={thStyle}>Online</th>
          </tr>
        </thead>
        <tbody>
          {workers.map((w, idx) => (
            <tr
              key={idx}
              style={{
                borderBottom: `1px solid ${colors.borderCard}`,
                background: idx % 2 === 0 ? 'rgba(255,193,7,0.04)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = colors.bgPanelAlt)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => onRowClick(w)}
            >
              <td style={{ ...tdStyle, color: colors.textPrimary, fontWeight: 600 }}>
                {w.worker_name}
              </td>
              <td style={tdStyle}>{w.role}</td>
              <td style={tdStyle}>{w.shift}</td>
              <td style={tdStyle}>{w.receivings_done}</td>
              {/* Put-away cell removed */}
              <td style={tdStyle}>{w.shipments_done}</td>
              <td style={tdStyle}>{w.cycle_counts_done}</td>
              <td style={tdStyle}>{w.skart_done || 0}</td>
              <td style={tdStyle}>{w.povracaj_done || 0}</td>
              <td style={tdStyle}>
                <EfficiencyBar score={w.efficiency_score} />
              </td>
              <td style={tdStyle}>
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: w.online ? colors.statusOk : colors.statusOffline,
                  display: 'inline-block',
                }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {workers.length === 0 && (
        <div style={{ color: colors.textSecondary, padding: 24, textAlign: 'center' }}>
          Nema podataka o radnicima
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: '12px 10px',
  color: 'rgba(255,255,255,0.6)',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  borderBottom:'1px solid rgba(255,255,255,0.08)'
};

const tdStyle = {
  padding: '12px 10px',
  color: '#f3f4f6',
  fontSize: 13,
  borderBottom:'1px solid rgba(255,255,255,0.04)'
};

function EfficiencyBar({ score }: { score: number }) {
  const color = score >= 80 ? colors.statusOk :
                score >= 60 ? colors.statusWarn :
                colors.statusErr;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 80,
        height: 8,
        background: colors.borderCard,
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${score}%`,
          height: '100%',
          background: color,
        }} />
      </div>
      <span style={{ color: colors.textPrimary, fontSize: 12, minWidth: 35 }}>
        {score}%
      </span>
    </div>
  );
}

function AlertsSection({ alerts }: { alerts: any }) {
  if (!alerts) return <div style={{ color: colors.textSecondary }}>Nema alertova</div>;
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AlertCard
        icon="🚨"
        label="Preopterećene lokacije"
        count={alerts.overloaded_locations}
        color={colors.statusErr}
        onClick={() => window.location.href = '/stock?filter=overloaded'}
      />
      <AlertCard
        icon="⛔"
        label="Blokirani put-away"
        count={alerts.blocked_putaways}
        color={colors.statusWarn}
        onClick={() => window.location.href = '/putaway?status=BLOCKED'}
      />
      <AlertCard
        icon="🕐"
        label="Zastali nalozi"
        count={alerts.stalled_orders}
        color={colors.statusWarn}
        onClick={() => window.location.href = '/shipping?status=PICKING&stalled=true'}
      />
    </div>
  );
}

function AlertCard({ icon, label, count, color, onClick }: any) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 14,
        padding: 16,
        cursor: 'pointer',
        transition: 'transform 0.2s, background 0.2s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
      }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 600 }}>{label}</div>
          <div style={{ color: color, fontSize: 24, fontWeight: 700, marginTop: 6 }}>{count}</div>
        </div>
      </div>
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

function WorkerDetailModal({ worker, onClose }: { worker: any; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTask, setExpandedTask] = useState<number | null>(null);

  useEffect(() => {
    if (worker?.user_id) {
      setLoading(true);
      apiClient.get(`/kpi/workers/${worker.user_id}`)
        .then(data => {
          setDetail(data);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [worker]);

  const formatDuration = (minutes: number | null) => {
    if (minutes === null) return '—';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}min`;
  };

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleString('sr-RS', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
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
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 24,
          padding: 24,
          width: '95%',
          maxWidth: 1200,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow:'0 25px 55px rgba(0,0,0,0.65)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, alignItems:'center' }}>
          <div>
            <div style={{ textTransform:'uppercase', letterSpacing:2, fontSize:12, color:'rgba(255,255,255,0.55)' }}>Radnik</div>
            <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 700, margin:0 }}>
              {worker.worker_name}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              color: '#fff',
              fontSize: 24,
              cursor: 'pointer',
              width:40,
              height:40,
              borderRadius:12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {loading ? (
          <div style={{ color: colors.textSecondary, padding: 40, textAlign: 'center' }}>Učitavanje...</div>
        ) : detail ? (
          <div>
            {/* Overall Statistics */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: 16, 
              marginBottom: 24 
            }}>
              <StatCard label="Ukupno zadataka" value={detail.total_tasks || 0} />
              <StatCard label="Završeno zadataka" value={detail.completed_tasks || 0} />
              <StatCard label="Ukupno stavki" value={detail.total_items || 0} />
              <StatCard label="Završeno stavki" value={detail.total_items_completed || 0} />
              <StatCard label="Prosečno vreme zadatka" value={formatDuration(detail.avg_task_time_min)} />
              <StatCard label="Prosečno vreme stavke" value={formatDuration(detail.avg_item_time_min)} />
            </div>

            {/* Hourly Tasks Chart */}
            {detail.hourly_tasks && detail.hourly_tasks.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ color: colors.brandYellow, fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
                  Zadaci po satu
                </h3>
                <div style={{ height: 200, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 16 }}>
                  {detail.hourly_tasks.map((ht: any, i: number) => {
                    const maxCount = Math.max(...detail.hourly_tasks.map((h: any) => h.count), 1);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 50, color: colors.textSecondary, fontSize: 12 }}>
                          {ht.hour}:00
                        </div>
                        <div style={{
                          flex: 1,
                          height: 20,
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: 6,
                          position: 'relative',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${(ht.count / maxCount) * 100}%`,
                            height: '100%',
                            background: colors.brandYellow,
                            borderRadius: 6,
                            transition: 'width 0.3s',
                          }} />
                        </div>
                        <span style={{ color: colors.textPrimary, fontSize: 12, minWidth: 30, textAlign: 'right' }}>
                          {ht.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Detailed Tasks List */}
            <div>
              <h3 style={{ color: colors.brandYellow, fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
                Detaljna analiza zadataka
              </h3>
              {detail.tasks && detail.tasks.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {detail.tasks.map((task: any, idx: number) => {
                    const isExpanded = expandedTask === idx;
                    const taskTypeLabel = task.task_type === 'RECEIVING' ? 'Prijem' :
                                         task.task_type === 'SHIPPING' ? 'Otprema' :
                                         task.task_type === 'SKART' ? 'SKART' :
                                         task.task_type === 'POVRACAJ' ? 'Povraćaj' : task.task_type;
                    const taskIdentifier = task.document_number || task.order_number || task.uid || `#${task.task_id}`;
                    const items = task.items || task.lines || [];
                    
                    return (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          borderRadius: 12,
                          padding: 16,
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            marginBottom: isExpanded ? 12 : 0,
                          }}
                          onClick={() => setExpandedTask(isExpanded ? null : idx)}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                              <span style={{
                                padding: '4px 12px',
                                borderRadius: 6,
                                background: task.task_type === 'RECEIVING' ? 'rgba(34,197,94,0.15)' :
                                          task.task_type === 'SHIPPING' ? 'rgba(59,130,246,0.15)' :
                                          task.task_type === 'SKART' ? 'rgba(250,204,21,0.15)' :
                                          'rgba(239,68,68,0.15)',
                                color: task.task_type === 'RECEIVING' ? '#34d399' :
                                       task.task_type === 'SHIPPING' ? '#60a5fa' :
                                       task.task_type === 'SKART' ? '#fde68a' :
                                       '#f87171',
                                fontSize: 12,
                                fontWeight: 600,
                              }}>
                                {taskTypeLabel}
                              </span>
                              <span style={{ color: colors.textPrimary, fontWeight: 600, fontSize: 14 }}>
                                {taskIdentifier}
                              </span>
                              {task.supplier_name && (
                                <span style={{ color: colors.textSecondary, fontSize: 13 }}>
                                  {task.supplier_name}
                                </span>
                              )}
                              {task.customer_name && (
                                <span style={{ color: colors.textSecondary, fontSize: 13 }}>
                                  {task.customer_name}
                                </span>
                              )}
                              {task.store_name && (
                                <span style={{ color: colors.textSecondary, fontSize: 13 }}>
                                  {task.store_name}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: colors.textSecondary }}>
                              <span>Započeto: {formatDateTime(task.started_at)}</span>
                              {task.completed_at && (
                                <span>Završeno: {formatDateTime(task.completed_at)}</span>
                              )}
                              <span>Trajanje: {formatDuration(task.duration_min)}</span>
                              <span>Stavki: {task.items_completed || task.lines_completed || 0}/{task.items_count || task.lines_count || 0}</span>
                              {task.avg_item_time_min !== null && (
                                <span>Prosek stavke: {formatDuration(task.avg_item_time_min)}</span>
                              )}
                            </div>
                          </div>
                          <span style={{ color: colors.textSecondary, fontSize: 20 }}>
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        </div>

                        {isExpanded && items.length > 0 && (
                          <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                              gap: 12,
                              marginBottom: 12,
                              paddingBottom: 8,
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                            }}>
                              <div style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 600 }}>Stavka</div>
                              <div style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 600 }}>Količina</div>
                              <div style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 600 }}>Započeto</div>
                              <div style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 600 }}>Završeno</div>
                              <div style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 600 }}>Vreme</div>
                            </div>
                            {items.map((item: any, itemIdx: number) => (
                              <div
                                key={itemIdx}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                                  gap: 12,
                                  padding: '8px 0',
                                  borderBottom: itemIdx < items.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                                }}
                              >
                                <div>
                                  <div style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 500 }}>
                                    {item.sku || item.code || '—'}
                                  </div>
                                  <div style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                                    {item.name || '—'}
                                  </div>
                                </div>
                                <div style={{ color: colors.textPrimary, fontSize: 13 }}>
                                  {item.received_qty !== undefined ? `${item.received_qty}/${item.expected_qty || item.qty}` :
                                   item.picked_qty !== undefined ? `${item.picked_qty}/${item.requested_qty}` :
                                   '—'}
                                </div>
                                <div style={{ color: colors.textSecondary, fontSize: 12 }}>
                                  {formatDateTime(item.started_at)}
                                </div>
                                <div style={{ color: colors.textSecondary, fontSize: 12 }}>
                                  {formatDateTime(item.completed_at)}
                                </div>
                                <div style={{ color: colors.brandYellow, fontSize: 13, fontWeight: 600 }}>
                                  {formatDuration(item.duration_min)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: colors.textSecondary, padding: 40, textAlign: 'center' }}>
                  Nema zadataka za prikaz
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ color: colors.textSecondary, padding: 40, textAlign: 'center' }}>
            Nema podataka o radniku
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      borderRadius: 12,
      padding: 16,
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ color: colors.brandYellow, fontSize: 24, fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );
}
