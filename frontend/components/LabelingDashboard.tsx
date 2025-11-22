import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';
import { colors } from '../src/theme/colors';

export default function LabelingDashboard() {
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());
  const [barcodeType, setBarcodeType] = useState<'CODE128' | 'QR'>('CODE128');
  const [layout, setLayout] = useState<'SMALL' | 'LARGE'>('SMALL');
  const [mapData, setMapData] = useState<any[]>([]);
  const [selectedLocationDetail, setSelectedLocationDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    loadMapData();
    const interval = setInterval(() => {
      loadData();
      loadMapData();
    }, 30000); // 30s refresh
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const data = await apiClient.get('/labels/locations?unlabeledOnly=true');
      setLocations(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Failed to load locations:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadMapData = async () => {
    try {
      const data = await apiClient.get('/warehouse/map/live-stock');
      setMapData(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Failed to load map:', e);
    }
  };

  const handlePrint = async () => {
    if (selectedLocations.size === 0) {
      alert('Izaberite lokacije za štampu');
      return;
    }

    try {
      const result = await apiClient.post('/labels/locations/print', {
        locations: Array.from(selectedLocations),
        barcodeType,
        layout,
      });

      // Download PDF
      if (result.pdf && result.pdf !== 'TODO_PDF_GENERATION') {
        // Convert base64 to blob (browser-safe)
        const byteCharacters = atob(result.pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `labels_${Date.now()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert('PDF generator će biti implementiran u produkciji');
      }

      alert('Etikete su generisane');
      setSelectedLocations(new Set());
      await loadData();
    } catch (e: any) {
      alert('Greška pri štampi: ' + (e.message || ''));
    }
  };

  const handleMarkPlaced = async (locationCode: string) => {
    try {
      await apiClient.patch(`/labels/location/${locationCode}/placed`);
      await loadData();
      await loadMapData();
    } catch (e: any) {
      alert('Greška: ' + (e.message || ''));
    }
  };

  const getLabelStatusColor = (status: string) => {
    if (status === 'PLACED') return colors.statusOk;
    if (status === 'PRINTED') return colors.statusWarn;
    return '#666'; // NEW
  };

  return (
    <div>
      {/* Hero Section */}
      <div style={{ marginBottom: "2.5rem" }}>
        <h1
          style={{
            fontSize: "clamp(2rem,4vw,3.5rem)",
            fontWeight: 800,
            margin: "0 0 0.75rem",
            background: "linear-gradient(135deg,#ffd400 0%,#ffaa00 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.02em",
          }}
        >
          Etikete
        </h1>
        <p
          style={{
            fontSize: "1.125rem",
            color: "rgba(255,255,255,0.6)",
            margin: 0,
            lineHeight: 1.6,
            maxWidth: "600px",
          }}
        >
          Upravljanje etiketama za lokacije, regale i paletna mesta u skladištu.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
          <StatusChip label="Lokacija bez etikete" value={String(locations.length)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left: Unlabeled Locations Table */}
        <div style={{ background: 'rgba(15,23,42,0.75)', borderRadius: 16, padding: 24, border: '1px solid rgba(148,163,184,0.25)', boxShadow:'0 4px 6px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ color: colors.brandYellow, fontSize: 20, fontWeight: 600 }}>
              Lokacije bez etikete
            </h2>
            <span style={{ color: colors.textSecondary, fontSize: 14 }}>
              {locations.length} lokacija
            </span>
          </div>

          {/* Batch Print Controls */}
          <div style={{ marginBottom: 16, padding: 16, background: 'rgba(15,23,42,0.5)', borderRadius: 12, border: '1px solid rgba(148,163,184,0.2)' }}>
            <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
              <label style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 600 }}>
                Tip barcode:
              </label>
              <select
                value={barcodeType}
                onChange={(e) => setBarcodeType(e.target.value as any)}
                style={{
                  padding: '8px 12px',
                  border: `1px solid ${colors.borderDefault}`,
                  borderRadius: 6,
                  background: colors.bgBody,
                  color: colors.textPrimary,
                }}
              >
                <option value="CODE128">CODE128</option>
                <option value="QR">QR</option>
              </select>
              <select
                value={layout}
                onChange={(e) => setLayout(e.target.value as any)}
                style={{
                  padding: '8px 12px',
                  border: `1px solid ${colors.borderDefault}`,
                  borderRadius: 6,
                  background: colors.bgBody,
                  color: colors.textPrimary,
                }}
              >
                <option value="SMALL">Mali format</option>
                <option value="LARGE">Veliki format</option>
              </select>
            </div>
            <button
              onClick={handlePrint}
              disabled={selectedLocations.size === 0}
              style={{
                width: '100%',
                padding: '12px',
                background: selectedLocations.size > 0 ? colors.brandYellow : colors.borderCard,
                color: selectedLocations.size > 0 ? '#000' : colors.textSecondary,
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 700,
                cursor: selectedLocations.size > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              ŠTAMPAJ ODABRANO ({selectedLocations.size})
            </button>
          </div>

          {/* Table */}
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: colors.textSecondary }}>
                Učitavanje...
              </div>
            ) : locations.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: colors.textSecondary }}>
                ✅ Sve lokacije su označene
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${colors.borderDefault}` }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>
                      <input
                        type="checkbox"
                        checked={selectedLocations.size === locations.length && locations.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLocations(new Set(locations.map(l => l.location_code)));
                          } else {
                            setSelectedLocations(new Set());
                          }
                        }}
                      />
                    </th>
                    <th style={{ padding: '8px', textAlign: 'left', color: colors.brandYellow, fontSize: 12, fontWeight: 600 }}>
                      Lokacija
                    </th>
                    <th style={{ padding: '8px', textAlign: 'left', color: colors.brandYellow, fontSize: 12, fontWeight: 600 }}>
                      Status
                    </th>
                    <th style={{ padding: '8px', textAlign: 'left', color: colors.brandYellow, fontSize: 12, fontWeight: 600 }}>
                      Akcija
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((loc, idx) => (
                    <tr
                      key={loc.id}
                      style={{
                        borderBottom: `1px solid ${colors.borderCard}`,
                        cursor: 'pointer',
                        background: idx % 2 === 0 ? 'rgba(255,193,7,0.04)' : 'transparent',
                      }}
                      onClick={() => {
                        const newSet = new Set(selectedLocations);
                        if (newSet.has(loc.location_code)) {
                          newSet.delete(loc.location_code);
                        } else {
                          newSet.add(loc.location_code);
                        }
                        setSelectedLocations(newSet);
                      }}
                    >
                      <td style={{ padding: '12px 8px' }}>
                        <input
                          type="checkbox"
                          checked={selectedLocations.has(loc.location_code)}
                          onChange={(e) => {
                            e.stopPropagation();
                            const newSet = new Set(selectedLocations);
                            if (e.target.checked) {
                              newSet.add(loc.location_code);
                            } else {
                              newSet.delete(loc.location_code);
                            }
                            setSelectedLocations(newSet);
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px 8px', color: colors.textPrimary, fontWeight: 600 }}>
                        {loc.location_code}
                        {loc.zone_code && (
                          <span style={{ color: colors.textSecondary, fontSize: 11, marginLeft: 8 }}>
                            · {loc.zone_code}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{
                          background: getLabelStatusColor(loc.status),
                          color: '#000',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                        }}>
                          {loc.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', display:'flex', gap:8 }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkPlaced(loc.location_code);
                          }}
                          style={{
                            padding: '6px 12px',
                            background: colors.bgBody,
                            border: `1px solid ${colors.borderStrong}`,
                            color: colors.brandYellow,
                            borderRadius: 4,
                            fontSize: 11,
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          Označi postavljeno
                        </button>
                        {(loc.status==='NEW' || loc.status==='PRINTED') && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!confirm('Obrisati etiketu za lokaciju?')) return;
                              await apiClient.delete(`/labels/location/${loc.location_code}`);
                              // refresh list
                              const newList = locations.filter(l=>l.location_code!==loc.location_code);
                              setLocations(newList);
                            }}
                            style={{
                              padding: '6px 12px',
                              background: colors.brandYellow,
                              border: `1px solid ${colors.borderDefault}`,
                              color: '#fff',
                              borderRadius: 4,
                              fontSize: 11,
                              cursor: 'pointer',
                              fontWeight: 700,
                            }}
                          >
                            Izbriši
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Map Snapshot */}
        <div style={{ background: colors.bgPanel, borderRadius: 12, padding: 24, border: `1px solid ${colors.borderDefault}` }}>
          <h2 style={{ color: colors.brandYellow, fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
            Status na mapi skladišta
          </h2>
          
          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, padding: 12, background: colors.bgPanelAlt, borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 20, height: 20, background: '#666', borderRadius: 4 }} />
              <span style={{ color: colors.textSecondary, fontSize: 12 }}>NEW</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 20, height: 20, background: colors.statusWarn, borderRadius: 4 }} />
              <span style={{ color: colors.textSecondary, fontSize: 12 }}>PRINTED</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 20, height: 20, background: colors.statusOk, borderRadius: 4 }} />
              <span style={{ color: colors.textSecondary, fontSize: 12 }}>PLACED</span>
            </div>
          </div>

          {/* Map Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
            gap: 8,
            maxHeight: '600px',
            overflowY: 'auto',
            padding: 8,
          }}>
            {mapData.slice(0, 200).map((slot: any, idx: number) => {
              const labelStatus = slot.label_status || 'NEW';
              const color = labelStatus === 'PLACED' ? colors.statusOk :
                           labelStatus === 'PRINTED' ? colors.statusWarn :
                           '#666';
              
              return (
                <div
                  key={idx}
                  onClick={() => {
                    // Load location details
                    setSelectedLocationDetail(slot);
                  }}
                  style={{
                    background: color,
                    padding: '8px',
                    borderRadius: 6,
                    fontSize: 10,
                    textAlign: 'center',
                    cursor: 'pointer',
                    border: `2px solid ${slot.location_code === selectedLocationDetail?.location_code ? colors.brandYellow : 'transparent'}`,
                    transition: 'border 0.2s',
                  }}
                  title={`${slot.location_code}: ${labelStatus} (${slot.fill_percent}% pun)`}
                >
                  <div style={{ color: '#000', fontWeight: 600, fontSize: 9 }}>
                    {slot.location_code || slot.slot_code}
                  </div>
                  <div style={{ color: '#000', fontSize: 8 }}>
                    {slot.fill_percent}%
                  </div>
                </div>
              );
            })}
          </div>

          {/* Location Detail Panel */}
          {selectedLocationDetail && (
            <div style={{
              marginTop: 16,
              padding: 16,
              background: colors.bgPanelAlt,
              borderRadius: 8,
              border: `1px solid ${colors.borderStrong}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ color: colors.textPrimary, fontSize: 16, fontWeight: 600 }}>
                  Lokacija {selectedLocationDetail.location_code || selectedLocationDetail.slot_code}
                </h3>
                <button
                  onClick={() => setSelectedLocationDetail(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: colors.textSecondary,
                    fontSize: 20,
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ color: colors.textSecondary, fontSize: 12 }}>Status etikete:</div>
                <span style={{
                  background: getLabelStatusColor(selectedLocationDetail.label_status || 'NEW'),
                  color: '#000',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  {selectedLocationDetail.label_status || 'NEW'}
                </span>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ color: colors.textSecondary, fontSize: 12 }}>Trenutna količina:</div>
                <div style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 600 }}>
                  {selectedLocationDetail.total_qty || 0} / {selectedLocationDetail.capacity || 0}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => {
                    const loc = selectedLocationDetail.location_code || selectedLocationDetail.slot_code;
                    const newSet = new Set(selectedLocations);
                    newSet.add(loc);
                    setSelectedLocations(newSet);
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: colors.brandYellow,
                    color: '#000',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Štampaj etiketu
                </button>
                <button
                  onClick={() => {
                    const loc = selectedLocationDetail.location_code || selectedLocationDetail.slot_code;
                    handleMarkPlaced(loc);
                    setSelectedLocationDetail(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: colors.bgBody,
                    color: colors.brandYellow,
                    border: `1px solid ${colors.borderStrong}`,
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Označi postavljeno
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// StatusChip component for hero section
function StatusChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(148,163,184,0.15)', border: '1px solid rgba(148,163,184,0.4)', borderRadius: 999, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{value}</span>
    </div>
  );
}
