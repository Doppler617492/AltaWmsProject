import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';

interface PutAwayCardProps {
  receivingItemId: number;
  itemSku: string;
  itemName: string;
  quantity: number;
  uom: string;
  onConfirm: (locationCode: string) => Promise<void>;
  onAlternativeLocation: () => void;
}

export default function PutAwayCard({
  receivingItemId,
  itemSku,
  itemName,
  quantity,
  uom,
  onConfirm,
  onAlternativeLocation,
}: PutAwayCardProps) {
  const [recommendation, setRecommendation] = useState<any>(null);
  const [locationDetails, setLocationDetails] = useState<any>(null);
  const [scanCode, setScanCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRecommendation();
  }, [receivingItemId]);

  const loadRecommendation = async () => {
    try {
      const rec = await apiClient.get(`/receiving/items/${receivingItemId}/recommend-location`);
      setRecommendation(rec);

      if (rec.recommended_location) {
        loadLocationDetails(rec.recommended_location);
      }
    } catch (e: any) {
      setError(e?.message || 'Greška pri učitavanju preporuke');
    }
  };

  const loadLocationDetails = async (locationCode: string) => {
    try {
      const details = await apiClient.get(`/labels/location/${locationCode}`);
      setLocationDetails(details);
      
      // If label is not placed, show modal
      if (details.status !== 'PLACED') {
        setShowLabelModal(true);
      }
    } catch (e: any) {
      // Location might not have label yet, that's OK
      setLocationDetails(null);
    }
  };

  const handleScan = async () => {
    const code = scanCode.trim().toUpperCase();
    if (!code) return;

    try {
      const details = await apiClient.get(`/labels/location/${code}`);
      setLocationDetails(details);
      setScanCode('');
      setShowManualInput(false);

      // Check if label is placed
      if (details.status !== 'PLACED') {
        setShowLabelModal(true);
      }
    } catch (e: any) {
      setError('Lokacija nije pronađena: ' + code);
    }
  };

  const handleConfirm = async () => {
    if (!recommendation?.recommended_location && !locationDetails?.location_code) {
      setError('Unesite lokaciju pre potvrde');
      return;
    }

    setIsProcessing(true);
    try {
      const locationCode = locationDetails?.location_code || recommendation?.recommended_location;
      await onConfirm(locationCode);
      // Success handled by parent
    } catch (e: any) {
      setError(e?.message || 'Greška pri potvrdi odlaganja');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkLabelAsPlaced = async () => {
    try {
      await apiClient.patch(`/labels/location/${recommendation?.recommended_location || locationDetails?.location_code}/placed`);
      await loadLocationDetails(recommendation?.recommended_location || locationDetails?.location_code);
      setShowLabelModal(false);
    } catch (e: any) {
      setError('Greška pri označavanju etikete');
    }
  };

  const currentLocation = locationDetails?.location_code || recommendation?.recommended_location || '';
  const currentLocationText = locationDetails?.human_text || currentLocation;

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#000', 
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
    }}>
      {/* Status Bar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px',
        fontSize: '14px',
      }}>
        <span>ONLINE</span>
        <span style={{ color: '#ffc107', fontWeight: 700 }}>AKTIVNO</span>
      </div>

      {/* Item Info */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '12px' }}>
          {itemSku}
        </div>
        <div style={{ fontSize: '20px', opacity: 0.9, marginBottom: '8px' }}>
          {itemName}
        </div>
        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ffc107' }}>
          KOL: {quantity} {uom}
        </div>
      </div>

      {/* Location Code - ENORMOUS */}
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '32px',
        padding: '24px',
        background: '#1a1a1a',
        borderRadius: '12px',
        border: '3px solid #ffc107',
      }}>
        <div style={{ 
          fontSize: '64px', 
          fontWeight: '900',
          letterSpacing: '8px',
          color: '#ffc107',
          textShadow: '0 0 20px #ffc107, 0 0 40px #ffc107',
          marginBottom: '16px',
        }}>
          {currentLocation || 'SKENIRAJ LOKACIJU'}
        </div>
        <div style={{ fontSize: '16px', opacity: 0.8, marginBottom: '8px' }}>
          {currentLocationText}
        </div>
        {locationDetails?.status === 'PLACED' && (
          <div style={{ color: '#4CAF50', fontSize: '14px', fontWeight: 'bold' }}>
            ETIKETA POSTAVLJENA
          </div>
        )}
        {locationDetails && locationDetails.status !== 'PLACED' && (
          <div style={{ color: '#ff9800', fontSize: '14px', fontWeight: 'bold' }}>
            ETIKETA NEMA – PRIJAVI ŠEFU
          </div>
        )}
      </div>

      {/* Safety Badges */}
      {recommendation?.safety && recommendation.safety.length > 0 && (
        <div style={{ 
          background: '#d32f2f', 
          padding: '16px', 
          borderRadius: '8px',
          marginBottom: '24px',
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>OPREZ</div>
          {recommendation.safety.map((s: string, idx: number) => (
            <div key={idx} style={{ fontSize: '14px', marginBottom: '4px' }}>
              • {s}
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'flex-end' }}>
        <button
          onClick={handleConfirm}
          disabled={!currentLocation || isProcessing}
          style={{
            width: '100%',
            padding: '20px',
            fontSize: '24px',
            fontWeight: 'bold',
            background: currentLocation && !isProcessing ? '#ffc107' : '#666',
            color: '#000',
            border: 'none',
            borderRadius: '12px',
            cursor: currentLocation && !isProcessing ? 'pointer' : 'not-allowed',
            minHeight: '60px',
          }}
        >
          {isProcessing ? 'OBRADA...' : 'POTVRDI ODLAGANJE'}
        </button>

        <button
          onClick={onAlternativeLocation}
          style={{
            width: '100%',
            padding: '16px',
            fontSize: '18px',
            fontWeight: 'bold',
            background: 'transparent',
            color: '#fff',
            border: '2px solid #ffc107',
            borderRadius: '12px',
            cursor: 'pointer',
          }}
        >
          DRUGA LOKACIJA
        </button>

        <button
          onClick={() => setShowManualInput(!showManualInput)}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            fontWeight: 'normal',
            background: 'transparent',
            color: '#999',
            border: '1px solid #444',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          RUČNI UNOS / SKENIRAJ
        </button>
      </div>

      {/* Manual Input Modal */}
      {showManualInput && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#1a1a1a',
            padding: '32px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '400px',
          }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
              Skeniraj lokaciju
            </div>
            <input
              type="text"
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && handleScan()}
              placeholder="SKENIRAJ BAR KOD..."
              autoFocus
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '24px',
                textAlign: 'center',
                background: '#000',
                color: '#fff',
                border: '2px solid #ffc107',
                borderRadius: '8px',
                marginBottom: '16px',
              }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleScan}
                style={{
                  flex: 1,
                  padding: '16px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  background: '#ffc107',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                SKENIRAJ
              </button>
              <button
                onClick={() => {
                  setShowManualInput(false);
                  setScanCode('');
                }}
                style={{
                  flex: 1,
                  padding: '16px',
                  fontSize: '18px',
                  background: 'transparent',
                  color: '#fff',
                  border: '2px solid #666',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                OTVORI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Label Not Placed Modal */}
      {showLabelModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
        }}>
          <div style={{
            background: '#1a1a1a',
            padding: '24px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '400px',
            border: '2px solid #ff9800',
          }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#ff9800' }}>
              OPREZ: ETIKETA NIJE POSTAVLJENA
            </div>
            <div style={{ fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>
              Nalepnica za ovu lokaciju nije registrovana kao postavljena. Zalepi etiketu fizički na regal i skeniraj kod, ili obavesti šefa.
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleMarkLabelAsPlaced}
                style={{
                  flex: 1,
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  background: '#ffc107',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                OZNAČI KAO POSTAVLJENO
              </button>
              <button
                onClick={() => setShowLabelModal(false)}
                style={{
                  flex: 1,
                  padding: '16px',
                  fontSize: '16px',
                  background: 'transparent',
                  color: '#fff',
                  border: '2px solid #666',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                NASTAVI BEZ ETIKETE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '24px',
          right: '24px',
          background: '#d32f2f',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
          fontSize: '14px',
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ paddingRight: 8 }}>{error}</div>
            <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
              <div style={{ background:'#000', borderRadius:8, padding:'2px 6px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <img src="/logo-white.svg" alt="Alta WMS" style={{ height: 14 }} />
              </div>
              <button
                onClick={() => setError(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: '20px',
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
                aria-label="Zatvori"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
