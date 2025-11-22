import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { apiClient } from '../../../lib/apiClient';

interface SlotDto { slotCode: string; wmsLocationCode: string; hasStock: boolean; totalQty: number }
interface RackLevelDto { levelName: string; slots: SlotDto[] }
interface RackBlockDto { rackLabel: string; levels: RackLevelDto[] }
interface AisleDto {
  aisleCode: string;
  displayName: string;
  flow: { arrowsSideA: string[]; arrowsSideB: string[]; startPointLabel?: string };
  sideA: RackBlockDto[];
  sideB: RackBlockDto[];
}
interface LiveStockEntry {
  slot_code: string;
  location_code: string;
  fill_percent: number;
  capacity: number;
  total_qty: number;
  status: string;
}

export default function AisleDetailPage() {
  const router = useRouter();
  const { aisleCode } = router.query as { aisleCode?: string };
  const [data, setData] = useState<AisleDto | null>(null);
  const [slotPanel, setSlotPanel] = useState<{ code: string; items: any[] } | null>(null);
  const [liveStock, setLiveStock] = useState<Record<string, LiveStockEntry>>({});
  const [hoverSlot, setHoverSlot] = useState<string | null>(null);

  useEffect(() => {
    if (!aisleCode) return;
    (async () => {
      const d = await apiClient.get(`/warehouse/map/aisle/${aisleCode}`);
      setData(d);
    })();
  }, [aisleCode]);

  useEffect(() => {
    const pollLiveStock = () => {
      apiClient.get('/warehouse/map/live-stock').then(data => {
        const stockMap: Record<string, LiveStockEntry> = {};
        data.forEach((e: LiveStockEntry) => {
          stockMap[e.slot_code || e.location_code] = e;
        });
        setLiveStock(stockMap);
      }).catch(console.error);
    };
    pollLiveStock();
    const interval = setInterval(pollLiveStock, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadSlot = async (locCode: string) => {
    const d = await apiClient.get(`/warehouse/location/${encodeURIComponent(locCode)}/stock`);
    setSlotPanel({ code: locCode, items: d?.items || [] });
  };

  const navTo = (delta: number) => {
    if (!data) return;
    const idx = parseInt(data.aisleCode.replace('PROLAZ_', '')) || 1;
    const nextIdx = Math.min(8, Math.max(1, idx + delta));
    router.push(`/map/prolaz/PROLAZ_${nextIdx}`);
  };

  if (!data) return <div style={styles.loading}>Učitavanje...</div>;

  const getSlotColor = (wmsCode: string, hasStock: boolean) => {
    const stock = liveStock[wmsCode];
    if (!stock) return hasStock ? '#FFD400' : '#000';
    const pct = stock.fill_percent;
    if (pct === 0) return '#000';
    if (pct <= 25) return '#444';
    if (pct <= 75) return '#FFD400';
    if (pct <= 100) return '#FF9E00';
    return '#FF3131';
  };

  const renderRack = (r: RackBlockDto) => (
    <div key={r.rackLabel} style={styles.rackContainer}>
      <div style={styles.rackHeader}>{r.rackLabel}</div>
      <div style={styles.levels}>
        {r.levels.map((lvl) => (
          <div key={lvl.levelName} style={styles.levelRow}>
            <div style={styles.levelLabel}>{lvl.levelName}</div>
            <div style={styles.slotRow}>
              {lvl.slots.map((s) => {
                const stock = liveStock[s.wmsLocationCode];
                const bgColor = getSlotColor(s.wmsLocationCode, s.hasStock);
                const isHighFill = stock && stock.fill_percent > 100;
                return (
                  <div
                    key={s.wmsLocationCode}
                    style={{
                      ...styles.slot,
                      background: bgColor,
                      color: stock && stock.fill_percent > 25 ? '#000' : '#FFD400',
                      border: `2px solid #FFD400`,
                      animation: isHighFill ? 'blink 1s infinite' : 'none'
                    }}
                    onMouseEnter={() => setHoverSlot(s.wmsLocationCode)}
                    onMouseLeave={() => setHoverSlot(null)}
                    onClick={() => loadSlot(s.wmsLocationCode)}
                  >
                    {s.slotCode}
                    {hoverSlot === s.wmsLocationCode && stock && (
                      <div style={{
                        position:'absolute',
                        top:'100%',
                        left:0,
                        background:'#000',
                        border:'2px solid #FFD400',
                        padding:8,
                        zIndex:999,
                        fontSize:12,
                        fontFamily:'monospace',
                        whiteSpace:'nowrap'
                      }}>
                        <div>Lokacija: {stock.location_code}</div>
                        <div>Popunjenost: {stock.fill_percent}%</div>
                        <div>Količina: {stock.total_qty}</div>
                        <div>Kapacitet: {stock.capacity}</div>
                        <div style={{color:'#aaa'}}>Status: {stock.status}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      <div style={styles.root}>
      <div style={styles.header}>
        <button style={styles.startButton}>→ Početna tačka kretanja</button>
        <div style={styles.pathBar}><span style={styles.forkliftIcon} /></div>
        <div style={styles.sides}>
          <div style={styles.sideText}>STRANA B</div>
          <div style={styles.sideText}>STRANA A</div>
        </div>
        <div style={styles.aislePillar}>
          <div style={styles.aisleText}>{data.displayName}</div>
          <div style={{display:'flex', flexDirection:'column', gap:6}}>
            <button style={styles.navBtn} onClick={() => navTo(-1)}>↑</button>
            <button style={styles.navBtn} onClick={() => navTo(1)}>↓</button>
          </div>
        </div>
        <button style={styles.backBtn} onClick={() => router.push('/map')}>← Nazad</button>
      </div>

      <div style={styles.body}>
        <div style={styles.sideB}>{data.sideB.map(renderRack)}</div>
        <div style={styles.walkway}></div>
        <div style={styles.sideA}>{data.sideA.map(renderRack)}</div>
      </div>

      {/* Mini-Map */}
      <div style={styles.miniMap}>
        {[1,2,3,4,5,6,7,8].map((i) => {
          const curAisle = parseInt(aisleCode?.replace('PROLAZ_','') || '1');
          const isActive = curAisle === i;
          return (
            <div
              key={i}
              onClick={() => router.push(`/map/prolaz/PROLAZ_${i}`)}
              style={{
                ...styles.miniAisle,
                background: isActive ? '#FFD400' : '#4a505a',
                cursor: 'pointer',
                fontSize:12,
                fontWeight: 'bold',
                display:'flex',
                alignItems:'center',
                justifyContent:'center'
              }}
            >
              {i}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={styles.legendBox}>
        <div style={styles.legendItem}><div style={{...styles.legendColor, background:'#000'}}></div> Prazan</div>
        <div style={styles.legendItem}><div style={{...styles.legendColor, background:'#444'}}></div> 1-25%</div>
        <div style={styles.legendItem}><div style={{...styles.legendColor, background:'#FFD400'}}></div> 26-75%</div>
        <div style={styles.legendItem}><div style={{...styles.legendColor, background:'#FF9E00'}}></div> 76-100%</div>
        <div style={styles.legendItem}><div style={{...styles.legendColor, background:'#FF3131', animation:'blink 1s infinite'}}></div> OVERLOADED</div>
      </div>

      {slotPanel && (
        <div style={styles.sidebar}>
          <button style={styles.close} onClick={() => setSlotPanel(null)}>✕</button>
          <h3 style={styles.panelTitle}>Na lokaciji {slotPanel.code} nalaze se sledeći artikli:</h3>
          {slotPanel.items?.length ? (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>PALETA</th>
                  <th style={styles.th}>ARTIKAL</th>
                  <th style={styles.th}>KOLIČINA</th>
                  <th style={styles.th}>KOLIČINA U MAGACINU</th>
                </tr>
              </thead>
              <tbody>
                {slotPanel.items.map((it: any, idx: number) => (
                  <tr key={idx}>
                    <td style={styles.td}>{it.pallet_id}</td>
                    <td style={styles.td}>{it.name || it.sku}</td>
                    <td style={styles.td}>{it.qty}</td>
                    <td style={styles.td}>{it.total_in_warehouse}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{color:'#aaa'}}>Nema artikala na ovoj lokaciji.</p>
          )}
        </div>
      )}
    </div>
    </>
  );
}

const styles: { [k:string]: React.CSSProperties } = {
  root: { background:'#000', minHeight:'100vh', color:'#fff' },
  header: { position:'sticky', top:0, zIndex:10, display:'flex', gap:12, alignItems:'center', padding:'12px 16px', background:'#3F454F', borderBottom:'2px solid #FFD400' },
  startButton: { background:'#2A27FF', color:'#fff', fontWeight:'bold', border:'none', padding:'8px 12px', borderRadius:6, cursor:'pointer' },
  pathBar: { flex:1, background:'#2B2B2B', height:36, position:'relative', borderRadius:4 },
  forkliftIcon: { position:'absolute', right:8, top:6, width:16, height:16, background:'#FFD400', borderRadius:2 },
  sides: { display:'flex', gap:20, alignItems:'center', justifyContent:'center' },
  sideText: { color:'#FFD400', fontWeight:'bold', fontSize:18 },
  aislePillar: { background:'#FFD400', color:'#000', padding:'6px 10px', borderRadius:6, display:'flex', alignItems:'center', gap:10 },
  aisleText: { writingMode:'vertical-lr' as any, textOrientation:'mixed' as any, fontWeight:'bold' },
  navBtn: { background:'#000', color:'#FFD400', border:'1px solid #FFD400', cursor:'pointer', padding:'2px 8px' },
  backBtn: { background:'#FFE04A', color:'#000', border:'none', padding:'8px 12px', borderRadius:6, cursor:'pointer', fontWeight:'bold' },
  body: { display:'grid', gridTemplateRows:'1fr 40px 1fr', gap:8, padding:16, height:'calc(100vh - 64px)', overflow:'auto' },
  sideB: { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:12 },
  sideA: { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:12 },
  walkway: { background:'#4a505a', borderTop:'2px solid #FFD400', borderBottom:'2px solid #FFD400' },
  rackContainer: { background:'#1a1a1a', border:'1px solid #444', borderRadius:6, padding:12 },
  rackHeader: { color:'#FFD400', fontWeight:'bold', marginBottom:8 },
  levels: { display:'flex', flexDirection:'column', gap:8 },
  levelRow: { display:'flex', flexDirection:'column', gap:6 },
  levelLabel: { color:'#888', fontSize:12 },
  slotRow: { display:'flex', gap:6, flexWrap:'wrap' },
  slot: { padding:'6px 10px', borderRadius:3, minWidth:56, textAlign:'center', fontWeight:'bold', cursor:'pointer', transition:'box-shadow .15s', position:'relative' },
  sidebar: { position:'fixed', right:0, top:0, bottom:0, width:380, background:'#111', borderLeft:'3px solid #FFD400', padding:16, zIndex:20, overflowY:'auto' },
  close: { position:'absolute', top:10, right:10, background:'transparent', border:'none', color:'#fff', fontSize:24, cursor:'pointer' },
  panelTitle: { color:'#FFD400', fontWeight:'bold', margin:'24px 0 12px' },
  table: { width:'100%', borderCollapse:'collapse' },
  th: { background:'#FFD400', color:'#000', textAlign:'left', padding:8 },
  td: { borderBottom:'1px solid #333', padding:8 },
  miniMap: { position:'fixed', top:80, right:20, display:'flex', flexDirection:'column', gap:4, zIndex:30 },
  miniAisle: { width:32, height:32, border:'1px solid #FFD400', borderRadius:3 },
  legendBox: { position:'fixed', bottom:20, left:20, background:'#111', border:'2px solid #FFD400', padding:12, borderRadius:6, zIndex:30 },
  legendItem: { display:'flex', gap:8, alignItems:'center', fontSize:12, color:'#FFD400', fontWeight:'bold' },
  legendColor: { width:16, height:16, border:'1px solid #FFD400' }
};


