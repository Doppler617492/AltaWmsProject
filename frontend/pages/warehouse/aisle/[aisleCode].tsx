import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { MainLayout } from '../../../src/components/layout/MainLayout';
import { fetchAisleDetail, AisleDetailResponse } from '../../../services/warehouse';
import { colors } from '../../../src/theme/colors';

export default function AisleDrilldownPage() {
  const router = useRouter();
  const aisleCode = typeof router.query.aisleCode === 'string' ? router.query.aisleCode : '';
  const [data, setData] = useState<AisleDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!aisleCode) return;
    let mounted = true;
    (async () => {
      try {
        const d = await fetchAisleDetail(aisleCode);
        if (mounted) setData(d);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [aisleCode]);

  return (
    <MainLayout breadcrumb={["Mapa skladišta", aisleCode || 'Prolaz']}>
      <div style={{ padding: '1rem', background: colors.bgBody, color: colors.textPrimary }}>
        {loading && <div>Učitavanje…</div>}
        {!loading && data && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {data.racks.map((rack, rIdx) => (
              <div key={rack.rack_code} style={{ border: `1px solid ${colors.borderDefault}`, borderRadius: 8, padding: '0.75rem' }}>
                <div style={{ color: colors.brandYellow, fontWeight: 600, marginBottom: 8 }}>{rack.rack_code}</div>
                <div style={{ display: 'grid', rowGap: 8 }}>
                  {rack.slots.map((level, lIdx) => (
                    <div key={lIdx} style={{ display: 'grid', gridTemplateColumns: `repeat(${level.length}, 28px)`, gap: 6, alignItems: 'center' }}>
                      {level.map((slot, sIdx) => (
                        <div key={sIdx} title={slot.label}
                          style={{ width: 28, height: 22, borderRadius: 2, border: `1px solid ${colors.borderDefault}`, background: colorFromStatus(slot.statusColor) }} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function colorFromStatus(status?: string) {
  switch (status) {
    case 'empty': return '#2d2f36';
    case 'ok': return '#1f6f3f';
    case 'warn': return '#8a6d1a';
    case 'over': return '#7a1f1f';
    default: return '#333642';
  }
}


