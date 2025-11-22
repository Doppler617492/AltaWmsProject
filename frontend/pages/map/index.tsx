import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { apiClient } from '../../lib/apiClient';

interface WarehouseStructureDto {
  aisles: { aisleCode: string; displayName: string }[];
  zones: {
    virtualZone: { zoneCode: string; pallets: any[] };
    shippingZone: { zoneCode: string; pallets: any[] };
    materialStorage: { zoneCode: string; pallets: any[] };
    ramp: { zoneCode: string; pallets: any[] };
  };
}

export default function WarehouseOverviewPage() {
  const router = useRouter();
  const [data, setData] = useState<WarehouseStructureDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await apiClient.get('/warehouse/map/overview-structure');
        setData(d);
      } catch (e: any) {
        setError(e?.message || 'Greška');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={styles.loading}>Učitavanje mape...</div>;
  if (error) return <div style={styles.loading}>Greška: {error}</div>;
  if (!data) return null;

  return (
    <div style={styles.root}>
      <div style={styles.legend}>
        <div style={styles.legendItem}><div style={{...styles.legendBox, background: '#464C57'}}></div> PROLAZ</div>
        <div style={styles.legendItem}><div style={{...styles.legendBox, background: '#F47C20'}}></div> OTPREMNA</div>
        <div style={styles.legendItem}><div style={{...styles.legendBox, background: '#000', border: '2px solid #FFD400'}}></div> VIRTUELNA</div>
        <div style={styles.legendItem}><div style={{...styles.legendBox, background: '#000', border: '2px solid #FFD400'}}></div> SLOT</div>
        <div style={styles.legendItem}><div style={{...styles.legendBox, background: '#2A27FF'}}></div> RAMPA</div>
      </div>

      <div style={styles.layout}>
        <div style={styles.rampa} onClick={() => {}}>
          <div style={{fontSize:'28px', color:'#fff'}}>▼</div>
          <div style={{color:'#fff', fontWeight:'bold'}}>RAMPA</div>
        </div>

        <div style={styles.aisles}>
          {data.aisles.map((a) => (
            <div key={a.aisleCode} style={styles.aisleBox} onClick={() => router.push(`/map/prolaz/${a.aisleCode}`)}>
              {a.displayName}
            </div>
          ))}
        </div>

        <div style={styles.zonesColumn}>
          <div style={styles.shipping} onClick={() => alert('OTPREMNA ZONA')}>
            <div style={{fontWeight:'bold', fontSize:24, marginBottom:4}}>OTPREMNA ZONA</div>
            <div style={{fontSize:14}}>Paleta: {data.zones.shippingZone.pallets.length}</div>
          </div>
          <div style={styles.virtual} onClick={() => alert('VIRTUELNA ZONA')}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(6, 12px)', gap:6, justifyContent:'center', marginBottom:8 }}>
              {Array.from({ length: data.zones.virtualZone.pallets.length || 12 }).map((_, i) => (
                <div key={i} style={{ width:12, height:12, background:'#333', border:'1px solid #FFD400' }} />
              ))}
            </div>
            <div style={{fontWeight:'bold', marginBottom:4}}>VIRTUELNA ZONA</div>
            <div style={{fontSize:14}}>Paleta: {data.zones.virtualZone.pallets.length}</div>
          </div>
          <div style={styles.materials}>
            <div style={{fontWeight:'bold'}}>MAGACIN MATERIJALA</div>
            <div style={{fontSize:14}}>Paleta: {data.zones.materialStorage.pallets.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: { [k:string]: any } = {
  root: { background:'#0F0F0F', minHeight:'100vh', padding:20, color:'#fff' },
  legend: { display:'flex', gap:16, marginBottom:20, background:'#1a1a1a', padding:10, borderRadius:6 },
  legendItem: { display:'flex', gap:8, alignItems:'center', color:'#FFD400', fontWeight:'bold' },
  legendBox: { width:18, height:18, border:'1px solid #FFD400' },
  layout: { display:'grid', gridTemplateColumns:'1fr 2fr 1fr', gap:20, alignItems:'start' },
  rampa: { background:'#2A27FF', border:'3px solid #FFD400', borderRadius:8, padding:20, textAlign:'center', cursor:'pointer' },
  aisles: { display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12 },
  aisleBox: { background:'#3F454F', color:'#FFD400', border:'2px solid #FFD400', borderRadius:6, padding:20, textAlign:'center', fontWeight:'bold', cursor:'pointer', transition:'box-shadow .2s' },
  zonesColumn: { display:'grid', gap:12 },
  shipping: { background:'#F47C20', color:'#000', fontWeight:'bold', borderRadius:8, padding:20, textAlign:'center', cursor:'pointer' },
  virtual: { background:'#000', color:'#FFD400', border:'2px solid #FFD400', borderRadius:8, padding:20, textAlign:'center', cursor:'pointer' },
  materials: { background:'#FFE04A', color:'#000', fontWeight:'bold', borderRadius:8, padding:20, textAlign:'center' },
  loading: { padding:40, textAlign:'center', color:'#fff' }
};


