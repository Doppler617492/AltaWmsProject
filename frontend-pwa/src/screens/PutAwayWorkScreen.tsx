import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { apiClient } from '../lib/apiClient';
import PutAwayCard from '../components/PutAwayCard';
import PwaBackButton from '../../components/PwaBackButton';

export default function PutAwayWorkScreen() {
  const router = useRouter();
  const { receivingDocumentId } = router.query as { receivingDocumentId?: string };
  const [receivingDoc, setReceivingDoc] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alternativesOpen, setAlternativesOpen] = useState(false);

  useEffect(() => {
    if (receivingDocumentId) {
      loadDocument();
    }
  }, [receivingDocumentId]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      const doc = await apiClient.get(`/receiving/documents/${receivingDocumentId}`);
      setReceivingDoc(doc);

      // Get items that still need placement
      const remainingItems = (doc.items || []).filter((it: any) => {
        const remaining = Math.max(0, (it.expected_quantity || 0) - (it.received_quantity || 0));
        return remaining > 0;
      });
      setItems(remainingItems);
      setCurrentItemIndex(0);
    } catch (e: any) {
      setError(e?.message || 'Greška pri učitavanju dokumenta');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (locationCode: string) => {
    if (!items[currentItemIndex]) return;

    const currentItem = items[currentItemIndex];
    
    try {
      // Resolve location code to location_id
      let locationId = 0;
      try {
        const location = await apiClient.get(`/warehouse/locations/by-code/${locationCode}`);
        locationId = location.id;
      } catch {
        // Try alternative endpoint
        const locations = await apiClient.get('/warehouse/locations');
        const found = Array.isArray(locations) 
          ? locations.find((l: any) => l.code === locationCode)
          : null;
        if (found) locationId = found.id;
      }

      if (!locationId) {
        throw new Error(`Lokacija ${locationCode} nije pronađena`);
      }

      // Update receiving item
      const remainingQty = Math.max(0, (currentItem.expected_quantity || 0) - (currentItem.received_quantity || 0));
      await apiClient.patch(`/receiving/items/${currentItem.id}`, {
        location_id: locationId,
        received_quantity: (currentItem.received_quantity || 0) + remainingQty,
      });

      // Reload document
      await loadDocument();

      // If no more items, show completion
      const newRemaining = items.filter((it: any) => {
        const rem = Math.max(0, (it.expected_quantity || 0) - (it.received_quantity || 0));
        return rem > 0;
      });

      if (newRemaining.length === 0) {
        // Complete document
        await apiClient.patch(`/receiving/documents/${receivingDocumentId}/complete`);
        router.push('/pwa/receiving');
      }
    } catch (e: any) {
      throw new Error(e?.message || 'Greška pri potvrdi odlaganja');
    }
  };

  const handleAlternativeLocation = () => {
    setAlternativesOpen(true);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '24px' }}>Učitavanje...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '24px' }}>
        <div style={{ alignSelf: 'stretch', marginBottom: 24 }}>
          <PwaBackButton />
        </div>
        <div style={{ fontSize: '24px', marginBottom: '16px' }}>Greška</div>
        <div style={{ fontSize: '16px', color: '#ff9800', marginBottom: '24px' }}>{error}</div>
        <button
          onClick={() => router.push('/pwa/receiving')}
          style={{
            padding: '16px 32px',
            fontSize: '18px',
            fontWeight: 'bold',
            background: '#ffc107',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          NAZAD NA LISTU PRIJEMA
        </button>
      </div>
    );
  }

  if (!items[currentItemIndex]) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '24px' }}>
        <div style={{ alignSelf: 'stretch', marginBottom: 24 }}>
          <PwaBackButton />
        </div>
        <div style={{ fontSize: '32px', marginBottom: '16px', color: '#4CAF50' }}>Prijem završen</div>
        <div style={{ fontSize: '18px', marginBottom: '32px', opacity: 0.8 }}>Sve stavke su raspoređene</div>
        <button
          onClick={() => router.push('/pwa/receiving')}
          style={{
            padding: '16px 32px',
            fontSize: '18px',
            fontWeight: 'bold',
            background: '#ffc107',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          NAZAD NA LISTU PRIJEMA
        </button>
      </div>
    );
  }

  const currentItem = items[currentItemIndex];

  return (
    <>
      <div style={{ padding: '16px 16px 0' }}>
        <PwaBackButton />
      </div>
      <PutAwayCard
        receivingItemId={currentItem.id}
        itemSku={currentItem.item?.sku || 'N/A'}
        itemName={currentItem.item?.name || 'N/A'}
        quantity={Math.max(0, (currentItem.expected_quantity || 0) - (currentItem.received_quantity || 0))}
        uom={currentItem.quantity_uom || 'KOM'}
        onConfirm={handleConfirm}
        onAlternativeLocation={handleAlternativeLocation}
      />

      {/* Alternatives Modal */}
      {alternativesOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
        }}>
          <div style={{
            background: '#1a1a1a',
            padding: '24px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>Druge lokacije</div>
              <button
                onClick={() => setAlternativesOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: '32px',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Load alternatives from recommendation */}
              {(() => {
                // This would be loaded from recommendation, but for now we'll show placeholder
                return ['Lokacija A-01-02-02', 'Lokacija A-01-03-01', 'Lokacija A-01-04-01'].map((loc, idx) => (
                  <button
                    key={idx}
                    onClick={async () => {
                      // Extract code from text (simplified)
                      const code = loc.replace('Lokacija ', '');
                      await handleConfirm(code);
                      setAlternativesOpen(false);
                    }}
                    style={{
                      padding: '16px',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      background: '#ffc107',
                      color: '#000',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {loc}
                  </button>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
