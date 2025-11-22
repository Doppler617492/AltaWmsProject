import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { apiClient } from '../lib/apiClient';
import { colors } from '../src/theme/colors';
import { fetchWarehouseRuntime, fetchSlotInfo, RuntimeElement } from '../services/warehouse';
import { fetchActivePutawayTasks, PutawayTask } from '../services/putaway';

interface Flow {
  startPointLabel: string;
  showForklift: boolean;
  arrowsSideA: string[];
  arrowsSideB: string[];
  laneLabelTop: string;
  laneLabelBottom: string;
}

interface Slot {
  slot_code: string;
  display: string;
  hasStock: boolean;
  level: number;
}

interface Level {
  levelIndex: number;
  slots: Slot[];
}

interface Rack {
  rackLabel: string;
  levels: Level[];
}

interface AisleData {
  code: string;
  label: string;
  flow: Flow;
  nav: { prev: string | null; next: string | null };
  sideA: Rack[];
  sideB: Rack[];
}

interface SlotItem {
  pallet_id: string;
  sku: string;
  name: string;
  qty: string;
  total_in_warehouse: string;
}

interface SlotDetails {
  slot_code: string;
  items: SlotItem[];
}

export default function WarehouseMapScreen({ user }: { user: any }) {
  const router = useRouter();
  // Runtime elements for heatmap view
  const [runtime, setRuntime] = useState<RuntimeElement[] | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const WORLD_W = 1600;
  const WORLD_H = 1000;
  const MIN_Z = 0.6;
  const MAX_Z = 3;
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const [drag, setDrag] = useState<{ active: boolean; sx: number; sy: number; ox: number; oy: number }>({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });
  const [view, setView] = useState<'overview' | 'aisle'>('overview');
  const [currentAisle, setCurrentAisle] = useState<string>('');
  const [aisleData, setAisleData] = useState<AisleData | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [slotDetails, setSlotDetails] = useState<any | null>(null);
  const [activeTasks, setActiveTasks] = useState<PutawayTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<PutawayTask | null>(null);
  const [showAssignees, setShowAssignees] = useState(false);
  const [slotTab, setSlotTab] = useState<'content' | 'movements'>('content');
  const [loading, setLoading] = useState(false);
  const [overviewData, setOverviewData] = useState<any>(null);

  // Load runtime map + optional focusLocation deep link
  const focusLocation = typeof router.query.focusLocation === 'string' ? router.query.focusLocation : null;
  useEffect(() => {
    let mounted = true;
    (async () => {
      const data = await fetchWarehouseRuntime();
      if (!mounted) return;
      setRuntime(data);
      // load active putaway tasks in parallel
      try { const t = await fetchActivePutawayTasks(); if (mounted) setActiveTasks(t); } catch {}
      if (focusLocation) {
        const target = data.find(e => e.type === 'RACK_SLOT' && e.location_code === focusLocation);
        if (target) {
          setViewport(v => ({ ...v, x: Math.max(0, target.x - 200), y: Math.max(0, target.y - 150), zoom: 1.5 }));
          setSelectedSlot(focusLocation);
          const info = await fetchSlotInfo(focusLocation);
          setSlotDetails(info as any);
        }
      }
    })();
    return () => { mounted = false; };
  }, [focusLocation]);

  const viewBox = useMemo(() => `0 0 ${WORLD_W} ${WORLD_H}`, []);
  const groupTransform = `translate(${-viewport.x}, ${-viewport.y}) scale(${viewport.zoom})`;

  const onWheel: React.WheelEventHandler<SVGSVGElement> = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const nz = clamp(viewport.zoom + delta, MIN_Z, MAX_Z);
    setViewport(v => ({ ...v, zoom: nz }));
  };

  const onMouseDown: React.MouseEventHandler<SVGSVGElement> = (e) => {
    setDrag({ active: true, sx: e.clientX, sy: e.clientY, ox: viewport.x, oy: viewport.y });
  };
  const onMouseMove: React.MouseEventHandler<SVGSVGElement> = (e) => {
    if (!drag.active) return;
    const dx = (e.clientX - drag.sx) / viewport.zoom;
    const dy = (e.clientY - drag.sy) / viewport.zoom;
    setViewport(v => ({ ...v, x: clamp(drag.ox - dx, 0, WORLD_W - WORLD_W / v.zoom), y: clamp(drag.oy - dy, 0, WORLD_H - WORLD_H / v.zoom) }));
  };
  const endDrag = () => setDrag(d => ({ ...d, active: false }));

  const colorFor = (el: RuntimeElement) => {
    if (el.type === 'RACK_SLOT') {
      switch (el.statusColor) {
        case 'empty': return '#2d2f36';
        case 'ok': return '#1f6f3f';
        case 'warn': return '#8a6d1a';
        case 'over': return '#7a1f1f';
        default: return '#333642';
      }
    }
    if (el.type === 'AISLE') return '#151922';
    if (el.type === 'RACK_BLOCK') return '#12151c';
    if (el.type === 'DOCK') return '#3A26FF';
    if (el.type === 'STAGING') return '#1a1a1a';
    if (el.type === 'OTPREMA') return '#E67E22';
    if (el.type === 'VIRTUAL_ZONE') return '#000000';
    if (el.type === 'MATERIAL_STORAGE') return '#F8E04E';
    return '#0f1117';
  };

  // Old loadOverview removed - we use runtime data now

  const loadAisle = async (code: string) => {
    setLoading(true);
    try {
      const data = await apiClient.get(`/warehouse/structure/aisle/${encodeURIComponent(code)}`);
      setAisleData(data);
      setCurrentAisle(code);
      setView('aisle');
    } catch (e) {
      console.error('Error loading aisle:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadSlotDetails = async (slotCode: string) => {
    try {
      const data = await apiClient.get(`/warehouse/slot/${encodeURIComponent(slotCode)}/stock`);
      setSlotDetails(data);
    } catch (e) {
      console.error('Error loading slot details:', e);
    }
  };

  if (loading) {
    return <div style={styles.loading}>Učitavanje...</div>;
  }

  if (view === 'overview') {
    return (
      <div style={{ position: 'relative', background: '#0f1117', height: '100%', minHeight: 'calc(100vh - 120px)' }}>
        {/* Legend */}
        <div style={{ position: 'absolute', right: 12, bottom: 12, background: 'rgba(0,0,0,0.6)', border: `1px solid ${colors.borderDefault}`, borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 12, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: '#1f6f3f', display: 'inline-block' }} /> Zelena: ok</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: '#8a6d1a', display: 'inline-block' }} /> Žuta: skoro puno</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: '#7a1f1f', display: 'inline-block' }} /> Crvena: puno</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: '#2d2f36', display: 'inline-block' }} /> Siva: prazno</div>
        </div>

        {/* Main SVG */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <svg
            viewBox={viewBox}
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
            style={{ background: '#0f1117' }}
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
          >
            <g transform={groupTransform}>
              {(runtime || []).map(el => (
              <g key={el.id}>
                <rect
                  x={el.x}
                  y={el.y}
                  width={el.w}
                  height={el.h}
                  rx={el.type === 'RACK_SLOT' ? 2 : 4}
                  fill={colorFor(el)}
                  stroke={colors.borderDefault}
                  strokeWidth={el.type === 'RACK_SLOT' ? 0.5 : 1}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (el.type === 'AISLE' && el.aisle_code) {
                      router.push(`/warehouse/aisle/${el.aisle_code}`);
                    }
                    if (el.type === 'RACK_SLOT' && el.location_code) {
                      setSelectedSlot(el.location_code);
                      loadSlotDetails(el.location_code);
                    }
                  }}
                />
                {el.label && (el.type === 'AISLE' || el.type === 'STAGING' || el.type === 'DOCK' || el.type === 'VIRTUAL_ZONE' || el.type === 'OTPREMA' || el.type === 'MATERIAL_STORAGE') && (
                  <text
                    x={el.x + el.w / 2}
                    y={el.y + el.h / 2}
                    fill={el.type === 'AISLE' ? "#aaa" : "#fff"}
                    fontSize={el.type === 'AISLE' ? 11 : 14}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontWeight={el.type === 'AISLE' ? 400 : 600}
                  >
                    {el.label}
                  </text>
                )}
              </g>
            ))}
            {/* Put-away markers disabled per request */}
            </g>
          </svg>
        </div>

        {/* Mini-map */}
        <div style={{ position: 'absolute', right: 12, top: 12, background: 'rgba(0,0,0,0.5)', border: `1px solid ${colors.borderDefault}`, borderRadius: 6, padding: 6 }}>
          <svg width={180} height={112} viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
            onClick={(e) => {
              const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const mx = ((e.clientX - rect.left) / rect.width) * WORLD_W;
              const my = ((e.clientY - rect.top) / rect.height) * WORLD_H;
              // center viewport around clicked point
              const vw = WORLD_W / viewport.zoom;
              const vh = WORLD_H / viewport.zoom;
              setViewport(v => ({ ...v, x: clamp(mx - vw / 2, 0, WORLD_W - vw), y: clamp(my - vh / 2, 0, WORLD_H - vh) }));
            }}
            style={{ cursor: 'pointer' }}
          >
            <rect x={0} y={0} width={WORLD_W} height={WORLD_H} fill="#0f1117" stroke={colors.borderDefault} strokeWidth={2} />
            {(runtime || []).map(el => (
              <rect key={`m-${el.id}`} x={el.x} y={el.y} width={el.w} height={el.h} fill="none" stroke="#444" strokeWidth={1} />
            ))}
            {/* viewport frame */}
            {(() => {
              const vw = WORLD_W / viewport.zoom;
              const vh = WORLD_H / viewport.zoom;
              return <rect x={viewport.x} y={viewport.y} width={vw} height={vh} fill="none" stroke={colors.brandYellow} strokeWidth={4} />;
            })()}
          </svg>
          </div>

        {/* Side panel for selected task */}
        {false && selectedTask && !slotDetails && (
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 340, background: '#111319', borderLeft: `1px solid ${colors.borderDefault}`, padding: 12, color: '#fff', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: colors.brandYellow }}>Put-away zadatak</div>
              <button onClick={() => setSelectedTask(null)} style={{ background: 'transparent', border: `1px solid ${colors.borderDefault}`, color: '#fff', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>Zatvori</button>
            </div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
              Paleta: <strong style={{ color: colors.brandYellow }}>{selectedTask.pallet_id}</strong>
            </div>
            <div style={{ fontSize: 13, marginBottom: 4, color: colors.textPrimary }}>
              <strong>{selectedTask.item_name}</strong> ({selectedTask.item_sku})
            </div>
            <div style={{ fontSize: 12, marginBottom: 4, color: colors.textSecondary }}>
              Količina: {selectedTask.quantity} {selectedTask.uom}
            </div>
            <div style={{ fontSize: 12, marginBottom: 4, color: colors.textSecondary }}>
              Od: <strong>{selectedTask.from}</strong>
            </div>
            <div style={{ fontSize: 12, marginBottom: 8, color: colors.textSecondary }}>
              Na: <strong style={{ color: colors.brandYellow }}>{selectedTask.to}</strong>
            </div>
            <div style={{ fontSize: 12, marginBottom: 8, color: colors.textSecondary }}>
              Radnik: {selectedTask.assigned_user || 'Nedodeljen'}
              <span> · </span>
              <button onClick={()=>setShowAssignees(true)} style={{ background: 'transparent', color: '#FFD400', border: '1px solid #FFD400', borderRadius: 6, padding: '2px 6px', cursor: 'pointer' }}>Tim</button>
            </div>
            <div style={{ fontSize: 12, marginBottom: 12, color: colors.textSecondary }}>
              Status: <span style={{ color: selectedTask.status === 'IN_PROGRESS' ? colors.statusWarn : colors.textSecondary }}>{selectedTask.status}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={async () => {
                  const newUserId = prompt('Unesite ID novog radnika:');
                  if (!newUserId) return;
                  try {
                    await apiClient.patch(`/putaway/task/${selectedTask.id}/reassign`, { assigned_user_id: Number(newUserId) });
                    alert('Preusmereno');
                    await fetchActivePutawayTasks().then(setActiveTasks).catch(() => {});
                    setSelectedTask(null);
                  } catch (e: any) {
                    alert(e?.message || 'Greška');
                  }
                }}
                style={{ background: colors.bgPanel, border: `1px solid ${colors.borderDefault}`, color: colors.brandYellow, padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
              >
                Reassign
              </button>
              <button
                onClick={async () => {
                  const reason = prompt('Razlog blokiranja:');
                  if (!reason) return;
                  try {
                    await apiClient.patch(`/putaway/task/${selectedTask.id}/block`, { reason });
                    alert('Blokirano');
                    await fetchActivePutawayTasks().then(setActiveTasks).catch(() => {});
                    setSelectedTask(null);
                  } catch (e: any) {
                    alert(e?.message || 'Greška');
                  }
                }}
                style={{ background: colors.statusErr, border: `1px solid ${colors.statusErr}`, color: colors.textPrimary, padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
              >
                Blokiraj
              </button>
              <a href={`/warehouse-map?focusLocation=${encodeURIComponent(selectedTask.to)}`} style={{ color: colors.brandYellow, textDecoration: 'none', fontSize: 13, textAlign: 'center', marginTop: 4 }}>Prikaži slot na mapi →</a>
              <a href={`/stock?loc=${encodeURIComponent(selectedTask.to)}`} style={{ color: colors.brandYellow, textDecoration: 'none', fontSize: 13, textAlign: 'center' }}>Otvori u Zalihe →</a>
        </div>
        {false && showAssignees && selectedTask && (
          <AssigneesModal type='PUTAWAY' id={selectedTask.id} onClose={()=>setShowAssignees(false)} />
        )}
      </div>
        )}

        {/* Side panel for selected slot */}
        {slotDetails && (
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 340, background: '#111319', borderLeft: `1px solid ${colors.borderDefault}`, padding: 12, color: '#fff', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: colors.brandYellow }}>{slotDetails.locationCode || selectedSlot}</div>
              <button onClick={() => { setSlotDetails(null); setSlotTab('content'); }} style={{ background: 'transparent', border: `1px solid ${colors.borderDefault}`, color: '#fff', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>Zatvori</button>
            </div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
              {slotDetails.zone || ''} {slotDetails.aisle_code || ''} {slotDetails.rack_code || ''}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: colors.textSecondary, fontSize: 12 }}>Kapacitet / Popunjenost</div>
              <div style={{ fontSize: 14 }}>{slotDetails.capacity != null ? slotDetails.capacity : '—'} · {slotDetails.fillRatio != null ? Math.round(slotDetails.fillRatio * 100) + '%' : '—'}</div>
            </div>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, borderBottom: `1px solid ${colors.borderCard}` }}>
              <button
                onClick={() => setSlotTab('content')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: slotTab === 'content' ? `2px solid ${colors.brandYellow}` : '2px solid transparent',
                  color: slotTab === 'content' ? colors.brandYellow : colors.textSecondary,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Sadržaj
              </button>
              <button
                onClick={() => setSlotTab('movements')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: slotTab === 'movements' ? `2px solid ${colors.brandYellow}` : '2px solid transparent',
                  color: slotTab === 'movements' ? colors.brandYellow : colors.textSecondary,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Kretanja
              </button>
            </div>
            {/* Tab content */}
            {slotTab === 'content' ? (
              <div style={{ marginBottom: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr><th style={{ textAlign: 'left', color: colors.textSecondary }}>SKU</th><th style={{ textAlign: 'left', color: colors.textSecondary }}>Naziv</th><th style={{ textAlign: 'right', color: colors.textSecondary }}>Količina</th></tr></thead>
                  <tbody>
                    {(slotDetails.items || []).map((it: any, idx: number) => (
                      <tr key={idx}><td>{it.sku}</td><td>{it.name}</td><td style={{ textAlign: 'right' }}>{it.qty}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'grid', rowGap: 8, fontSize: 12 }}>
                  {(slotDetails.movements || []).map((m: any, idx: number) => (
                    <div key={idx} style={{ padding: '8px', background: colors.bgPanel, borderRadius: 4, border: `1px solid ${colors.borderCard}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: colors.brandYellow, fontWeight: 600 }}>{m.reason || '—'}</span>
                        <span style={{ color: colors.textSecondary }}>{m.qty > 0 ? '+' : ''}{m.qty}</span>
                      </div>
                      <div style={{ fontSize: 11, color: colors.textSecondary }}>
                        {m.at ? new Date(m.at).toLocaleString('sr-Latn-RS') : '—'}
                        {m.by && <span> · {m.by}</span>}
                      </div>
                    </div>
                  ))}
                  {(!slotDetails.movements || slotDetails.movements.length === 0) && (
                    <div style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center', padding: '16px' }}>Nema kretanja</div>
                  )}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <a href={`/stock?loc=${encodeURIComponent(selectedSlot)}`} style={{ color: colors.brandYellow, textDecoration: 'none' }}>Otvori u Zalihe →</a>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'aisle' && aisleData) {
    return (
      <div style={styles.aisleContainer}>
        {/* Fixed Header Bar */}
        <div style={styles.headerBar}>
          <div style={styles.startPointBox}>
            <div style={styles.startPointArrow}>→</div>
            {aisleData.flow.startPointLabel}
          </div>
          
          <div style={styles.aisleColumn}>
            {aisleData.flow.showForklift && <div style={styles.forkliftIconBox} />}
            <div style={styles.aisleLabel}>{aisleData.label}</div>
            <div style={styles.navButtons}>
              {aisleData.nav.prev && (
                <button style={styles.navButton} onClick={() => aisleData.nav.prev && loadAisle(aisleData.nav.prev)}>↑</button>
              )}
              {aisleData.nav.next && (
                <button style={styles.navButton} onClick={() => aisleData.nav.next && loadAisle(aisleData.nav.next)}>↓</button>
              )}
            </div>
          </div>

          <div style={styles.sideLabelsContainer}>
            <div style={styles.sideLabelTop}>{aisleData.flow.laneLabelTop}</div>
            <div style={styles.sideLabelBottom}>{aisleData.flow.laneLabelBottom}</div>
          </div>

          <button style={styles.backButton} onClick={() => setView('overview')}>
            ← Nazad
          </button>
        </div>

        {/* Content Area */}
        <div style={styles.contentArea}>
          {/* Side B (Top) */}
          <div style={styles.sideBSection}>
            {aisleData.sideB.map((rack, rackIdx) => (
              <div key={rackIdx} style={styles.rackContainer}>
                <div style={styles.rackHeader}>{rack.rackLabel}</div>
                <div style={styles.levelsContainer}>
                  {rack.levels.sort((a, b) => b.levelIndex - a.levelIndex).map((level, lidx) => (
                    <div key={lidx} style={styles.levelRow}>
                      <div style={styles.levelLabel}>Nivo {level.levelIndex + 1}</div>
                      <div style={styles.slotGrid}>
                        {level.slots.map((slot, sidx) => (
                          <div 
                            key={sidx} 
                            style={{
                              ...styles.slotBox,
                              background: slot.hasStock ? '#FFD400' : '#111',
                              color: slot.hasStock ? '#000' : '#FFD400',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.boxShadow = '0 0 8px #fff';
                              e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.boxShadow = 'none';
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                            onClick={() => { 
                              setSelectedSlot(slot.slot_code); 
                              loadSlotDetails(slot.slot_code); 
                            }}
                          >
                            {slot.display}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Walkway (Middle) */}
          <div style={styles.walkway}>
            <div style={styles.walkwayLine}></div>
          </div>

          {/* Side A (Bottom) */}
          <div style={styles.sideASection}>
            {aisleData.sideA.map((rack, rackIdx) => (
              <div key={rackIdx} style={styles.rackContainer}>
                <div style={styles.rackHeader}>{rack.rackLabel}</div>
                <div style={styles.levelsContainer}>
                  {rack.levels.sort((a, b) => b.levelIndex - a.levelIndex).map((level, lidx) => (
                    <div key={lidx} style={styles.levelRow}>
                      <div style={styles.levelLabel}>Nivo {level.levelIndex + 1}</div>
                      <div style={styles.slotGrid}>
                        {level.slots.map((slot, sidx) => (
                          <div 
                            key={sidx} 
                            style={{
                              ...styles.slotBox,
                              background: slot.hasStock ? '#FFD400' : '#111',
                              color: slot.hasStock ? '#000' : '#FFD400',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.boxShadow = '0 0 8px #fff';
                              e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.boxShadow = 'none';
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                            onClick={() => { 
                              setSelectedSlot(slot.slot_code); 
                              loadSlotDetails(slot.slot_code); 
                            }}
                          >
                            {slot.display}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mini-Map */}
        <div style={styles.miniMap}>
          {['PROLAZ 1', 'PROLAZ 2', 'PROLAZ 3', 'PROLAZ 4'].map((p, idx) => (
            <div 
              key={p} 
              style={{
                ...styles.miniMapAisle,
                background: currentAisle === `PROLAZ_${idx + 1}` ? '#FFD400' : '#4a505a',
                cursor: 'pointer'
              }}
              onClick={() => loadAisle(`PROLAZ_${idx + 1}`)}
            >
              {idx + 1}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={styles.aisleLegend}>
          <div style={styles.legendItem}><div style={{...styles.legendBoxSmall, background: '#FFD400'}}></div> Pun</div>
          <div style={styles.legendItem}><div style={{...styles.legendBoxSmall, background: '#111'}}></div> Prazan</div>
        </div>

        {/* Sidebar */}
        {slotDetails && (
          <div style={styles.sidebar}>
            <button style={styles.closeButton} onClick={() => { setSlotDetails(null); setSelectedSlot(''); }}>✕</button>
            <h3 style={styles.sidebarTitle}>Na lokaciji {selectedSlot} nalaze se sledeći artikli:</h3>
            {slotDetails.items.length > 0 ? (
              <table style={styles.detailsTable}>
                <thead>
                  <tr>
                    <th style={styles.th}>PALETA</th>
                    <th style={styles.th}>ARTIKAL</th>
                    <th style={styles.th}>KOLIČINA</th>
                    <th style={styles.th}>UKUPNO U MAGACINU</th>
                  </tr>
                </thead>
                <tbody>
                  {slotDetails.items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={styles.td}>{item.pallet_id}</td>
                      <td style={styles.td}>{item.name}</td>
                      <td style={styles.td}>{item.qty}</td>
                      <td style={styles.td}>{item.total_in_warehouse}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={styles.noItems}>Nema artikala na ovoj lokaciji.</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return <div style={styles.loading}>Loading...</div>;
}

function AssigneesModal({ type, id, onClose }: { type: 'RECEIVING'|'SHIPPING'|'PUTAWAY'; id: number; onClose: () => void }) {
  const [data, setData] = useState<any|null>(null);
  useEffect(() => { (async()=>{ try{ const d = await apiClient.get(`/workforce/task-assignees/${type}/${id}`); setData(d);} catch{} })(); }, [type, id]);
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'#0a0a0a', color:'#fff', border:'1px solid #ffc107', borderRadius:8, width:'95%', maxWidth:800 }}>
        <div style={{ padding:12, background:'#ffc107', color:'#000', borderTopLeftRadius:8, borderTopRightRadius:8, fontWeight:'bold' }}>Članovi zadatka · {type} #{id}</div>
        <div style={{ padding:16 }}>
          {!data ? <div>Učitavanje…</div> : (
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, color:'#ddd' }}>
                <span>Policy: {data.policy} {data.all_done_at ? `· ALL_DONE @ ${new Date(data.all_done_at).toLocaleString()}` : ''}</span>
                <button onClick={()=>downloadAssigneesCSV(type, id, data)} style={{ background:'#ffc107', color:'#000', border:'1px solid #e0ac00', padding:'6px 10px', borderRadius:6, cursor:'pointer', fontWeight:700 }}>CSV</button>
                <button onClick={()=>printAssignees(type, id, data)} style={{ background:'#ffc107', color:'#000', border:'1px solid #e0ac00', padding:'6px 10px', borderRadius:6, cursor:'pointer', fontWeight:700 }}>Štampaj</button>
              </div>
              {(!data.assignees || data.assignees.length===0) ? <div>Nema dodeljenih članova.</div> : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr><th style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #2c2f36', color:'#ffc107' }}>Korisnik</th><th style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #2c2f36', color:'#ffc107' }}>Status</th><th style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #2c2f36', color:'#ffc107' }}>Start</th><th style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #2c2f36', color:'#ffc107' }}>Kraj</th></tr></thead>
                  <tbody>
                    {data.assignees.map((a:any, idx:number)=> (
                      <tr key={a.id} style={{ background: idx % 2 === 0 ? 'rgba(255,193,7,0.04)' : 'transparent' }}><td style={{ padding:'6px 8px', borderBottom:'1px solid #1a1d24' }}>{a.user_name}</td><td style={{ padding:'6px 8px', borderBottom:'1px solid #1a1d24' }}>{a.status}</td><td style={{ padding:'6px 8px', borderBottom:'1px solid #1a1d24' }}>{a.started_at ? new Date(a.started_at).toLocaleString() : '—'}</td><td style={{ padding:'6px 8px', borderBottom:'1px solid #1a1d24' }}>{a.completed_at ? new Date(a.completed_at).toLocaleString() : '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
        <div style={{ padding:12, textAlign:'right' }}>
          <button onClick={onClose} style={{ background:'#ffc107', color:'#000', border:'1px solid #e0ac00', padding:'8px 12px', borderRadius:6, cursor:'pointer', fontWeight:700 }}>Zatvori</button>
        </div>
      </div>
    </div>
  );
}

function downloadAssigneesCSV(type: string, id: number, data: any) {
  const header = ['task_type','task_id','user_name','status','started_at','completed_at'];
  const lines = [header.join(',')].concat(
    (data?.assignees||[]).map((a:any)=> [
      type,
      String(id),
      csv(a.user_name),
      a.status,
      a.started_at ? new Date(a.started_at).toISOString() : '',
      a.completed_at ? new Date(a.completed_at).toISOString() : ''
    ].join(','))
  );
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const el = document.createElement('a');
  el.href = url; el.download = `assignees_${type}_${id}.csv`;
  document.body.appendChild(el); el.click(); document.body.removeChild(el);
}

function printAssignees(type: string, id: number, data: any) {
  const rows = (data?.assignees||[]);
  const html = `<!doctype html><html><head><meta charset=\"utf-8\" />
  <title>Članovi zadatka ${'${type}'} #${'${id}'}</title>
  <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial;padding:16px;}h1{font-size:18px;margin:0 0 8px;}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f5f5f5}</style>
  </head><body>
  <h1>Članovi zadatka ${'${type}'} #${'${id}'}</h1>
  <div style=\"margin:4px 0 10px;color:#555\">Policy: ${'${data?.policy || \"\"}'} ${'${data?.all_done_at ? ("· ALL_DONE @ "+ new Date(data.all_done_at).toLocaleString()) : ""}'} </div>
  <table><thead><tr><th>Korisnik</th><th>Status</th><th>Start</th><th>Kraj</th></tr></thead>
  <tbody>${'${rows.map((a:any)=>`<tr><td>${escapeHtml(a.user_name||\"\")}</td><td>${escapeHtml(a.status||\"\")}</td><td>${a.started_at ? new Date(a.started_at).toLocaleString() : \"\"}</td><td>${a.completed_at ? new Date(a.completed_at).toLocaleString() : \"\"}</td></tr>`).join("")}'}</tbody></table>
  </body></html>`;
  const w = window.open('', '_blank'); if (!w) return;
  w.document.write(html); w.document.close(); w.focus(); w.print(); setTimeout(()=>{ try{ w.close(); }catch{} }, 500);
}

function csv(v:any){
  if (v==null) return '';
  const s = String(v).replace(/\"/g,'\"\"');
  return `"${s}"`;
}
function escapeHtml(s:string){
  return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c] as string));
}

const styles: { [key: string]: React.CSSProperties } = {
  overviewContainer: {
    background: '#0f0f0f',
    color: '#fff',
    padding: '20px',
    minHeight: 'calc(100vh - 120px)',
  },
  legend: {
    display: 'flex',
    gap: '20px',
    marginBottom: '20px',
    padding: '10px',
    backgroundColor: '#1a1a1a',
    borderRadius: '5px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
  },
  legendBox: {
    width: '20px',
    height: '20px',
    border: '1px solid #FFD400',
  },
  legendBoxSmall: {
    width: '16px',
    height: '16px',
    border: '1px solid #FFD400',
  },
  overviewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
  },
  rampaBox: {
    background: '#2A27FF',
    color: '#fff',
    padding: '40px',
    textAlign: 'center',
    borderRadius: '8px',
    cursor: 'pointer',
    border: '3px solid #FFD400',
  },
  rampaArrow: {
    fontSize: '48px',
    color: '#fff',
  },
  rampaText: {
    marginTop: '10px',
    fontWeight: 'bold',
  },
  prolazBox: {
    background: '#4a505a',
    color: '#FFD400',
    padding: '30px',
    textAlign: 'center',
    borderRadius: '8px',
    cursor: 'pointer',
    border: '2px solid #FFD400',
    fontWeight: 'bold',
    fontSize: '18px',
    transition: 'all 0.3s',
  },
  otpremaBox: {
    background: '#F47C20',
    color: '#fff',
    padding: '30px',
    textAlign: 'center',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  virtualBox: {
    background: '#000',
    color: '#FFD400',
    padding: '30px',
    textAlign: 'center',
    borderRadius: '8px',
    border: '2px solid #FFD400',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  virtualPallets: {
    fontSize: '32px',
    marginBottom: '10px',
  },
  virtualPalletsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 12px)',
    gap: '6px',
    justifyContent: 'center',
    marginBottom: '10px',
  },
  magacinBox: {
    background: '#FFD400',
    color: '#000',
    padding: '30px',
    textAlign: 'center',
    borderRadius: '8px',
    fontWeight: 'bold',
  },
  aisleContainer: {
    background: '#000',
    color: '#fff',
    minHeight: 'calc(100vh - 120px)',
    position: 'relative',
    overflow: 'hidden',
  },
  headerBar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '70px',
    background: '#4a505a',
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '0 20px',
    zIndex: 1000,
    borderBottom: '2px solid #FFD400',
  },
  startPointBox: {
    background: '#2A27FF',
    color: '#fff',
    padding: '10px 15px',
    borderRadius: '5px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  startPointArrow: {
    color: '#fff',
    fontSize: '20px',
  },
  aisleColumn: {
    background: '#FFD400',
    color: '#000',
    padding: '5px 15px',
    borderRadius: '5px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
  },
  forkliftIcon: {
    fontSize: '20px',
    position: 'absolute',
    left: '-25px',
  },
  forkliftIconBox: {
    position: 'absolute',
    right: '20px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '16px',
    height: '16px',
    background: '#FFD400',
    borderRadius: '2px',
  },
  aisleLabel: {
    fontWeight: 'bold',
    fontSize: '16px',
    writingMode: 'vertical-lr',
    textOrientation: 'mixed',
    padding: '5px 0',
  },
  navButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    marginTop: '5px',
  },
  navButton: {
    background: '#000',
    color: '#FFD400',
    border: '1px solid #FFD400',
    padding: '3px 8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '12px',
  },
  sideLabelsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '40px',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    height: '100%',
  },
  sideLabelTop: {
    color: '#FFD400',
    fontWeight: 'bold',
    fontSize: '20px',
  },
  sideLabelBottom: {
    color: '#FFD400',
    fontWeight: 'bold',
    fontSize: '20px',
  },
  backButton: {
    background: '#ffc107',
    color: '#000',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '5px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  contentArea: {
    marginTop: '70px',
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 70px)',
    overflow: 'auto',
  },
  sideBSection: {
    background: '#1a1a1a',
    padding: '20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
  },
  sideASection: {
    background: '#111',
    padding: '20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
  },
  walkway: {
    background: '#4a505a',
    height: '10px',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkwayLine: {
    width: '2px',
    height: '100%',
    background: '#666',
  },
  rackContainer: {
    background: '#222',
    padding: '15px',
    borderRadius: '5px',
    border: '1px solid #444',
  },
  rackHeader: {
    color: '#FFD400',
    fontWeight: 'bold',
    fontSize: '18px',
    marginBottom: '10px',
  },
  levelsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  levelRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  levelLabel: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '5px',
  },
  slotGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  },
  slotBox: {
    border: '1px solid #FFD400',
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 'bold',
    minWidth: '50px',
    textAlign: 'center',
    transition: 'all 0.2s',
    borderRadius: '3px',
  },
  miniMap: {
    position: 'fixed',
    top: '85px',
    right: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    zIndex: 999,
  },
  miniMapAisle: {
    width: '40px',
    height: '40px',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    borderRadius: '3px',
    border: '1px solid #FFD400',
  },
  aisleLegend: {
    position: 'fixed',
    bottom: '20px',
    left: '20px',
    display: 'flex',
    gap: '15px',
    padding: '10px',
    background: '#1a1a1a',
    borderRadius: '5px',
    border: '1px solid #444',
    zIndex: 999,
  },
  sidebar: {
    position: 'fixed',
    right: 0,
    top: '70px',
    bottom: 0,
    width: '400px',
    background: '#1a1a1a',
    padding: '20px',
    overflowY: 'auto',
    zIndex: 100,
    borderLeft: '3px solid #FFD400',
  },
  closeButton: {
    position: 'absolute',
    top: '10px',
    right: '15px',
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: '28px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  sidebarTitle: {
    color: '#FFD400',
    marginTop: '20px',
    marginBottom: '20px',
    fontWeight: 'bold',
    fontSize: '16px',
  },
  detailsTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    background: '#FFD400',
    color: '#000',
    padding: '8px',
    textAlign: 'left',
    fontWeight: 'bold',
    fontSize: '12px',
  },
  td: {
    padding: '8px',
    borderBottom: '1px solid #333',
    color: '#fff',
    fontSize: '12px',
  },
  noItems: {
    color: '#888',
    textAlign: 'center',
    marginTop: '40px',
    fontSize: '16px',
  },
  loading: {
    textAlign: 'center',
    padding: '50px',
    fontSize: '18px',
    color: '#fff',
  },
};
