import { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';

interface ReceivingDocument {
  id: number;
  document_number: string;
  supplier: { name: string };
  status: string;
  created_at: string;
  items: Array<{
    id: number;
    item: { name: string; sku: string };
    expected_quantity: number;
    received_quantity: number;
    location_id: number;
    quantity_uom: string;
    condition_notes: string;
  }>;
}

export default function MojiPrijemi() {
  const [documents, setDocuments] = useState<ReceivingDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<ReceivingDocument | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
    // Lokacije onemogućene: ne učitavamo /stock/locations
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/receiving/documents');
      // Filter samo "in_progress" prijme za magacionera
      const inProgressDocs = data.filter((doc: any) => doc.status === 'in_progress');
      setDocuments(inProgressDocs);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      // Use stock service to derive active locations list
      const flat = await apiClient.get('/stock/locations');
      // Deduplicate by location_id
      const byId = new Map<number, { id: number; code: string }>();
      (flat || []).forEach((row: any) => {
        const id = Number(row.location_id);
        const code = row.location_code;
        if (id && code && !byId.has(id)) byId.set(id, { id, code });
      });
      setLocations(Array.from(byId.values()));
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const handleUpdateQuantity = async (
    itemId: number,
    receivedQuantity: number,
    reason: string
  ) => {
    try {
      await apiClient.patch(`/receiving/items/${itemId}`, {
        received_quantity: receivedQuantity,
        condition_notes: reason,
        status: receivedQuantity > 0 && receivedQuantity < 999999 ? 'scanned' : undefined,
      });
      alert('Količina ažurirana!');
      fetchDocuments();
      if (selectedDocument) {
        setSelectedDocument(null);
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
      alert('Greška pri ažuriranju količine');
    }
  };

  const handleCompleteReceipt = async (documentId: number) => {
    // Ne tražimo lokacije za završetak (privremeno)

    if (!confirm('Da li ste sigurni da želite da završite ovaj prijem?')) {
      return;
    }

    try {
      await apiClient.post(`/receiving/documents/${documentId}/complete`);
      alert('Prijem je uspešno završen!');
      fetchDocuments();
      setSelectedDocument(null);
    } catch (error) {
      console.error('Error completing receipt:', error);
      alert('Greška pri završavanju prijema');
    }
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Učitavanje...</div>;

  if (!selectedDocument) {
    return (
      <div style={{ padding: '20px' }}>
        <h2 style={{ marginBottom: '20px', color: '#000', fontSize: '24px' }}>Moji Prijemi</h2>
        
        {documents.length === 0 ? (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center', 
            backgroundColor: '#f9f9f9', 
            borderRadius: '8px',
            border: '2px dashed #ddd' 
          }}>
            <p style={{ fontSize: '18px', color: '#666' }}>Nemate dodeljene prijeme u toku.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '15px' }}>
            {documents.map(doc => (
              <div 
                key={doc.id}
                onClick={() => setSelectedDocument(doc)}
                style={{
                  padding: '20px',
                  backgroundColor: '#fff',
                  border: '2px solid #ffc107',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#000', fontSize: '18px', fontWeight: 'bold' }}>
                      {doc.document_number}
                    </h3>
                    <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '14px' }}>
                      {doc.supplier.name}
                    </p>
                  </div>
                  <div style={{ 
                    backgroundColor: '#FFC107', 
                    color: '#000',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}>
                    {doc.items.length} stavki
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Detail view
  return (
    <div style={{ padding: '20px' }}>
      {/* expose current doc id for upload helper */}
      <script dangerouslySetInnerHTML={{__html:`window.currentDocId=${selectedDocument.id};`}} />
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: '#000', fontSize: '24px' }}>
          {selectedDocument.document_number}
        </h2>
        <button 
          onClick={() => setSelectedDocument(null)}
          style={{
            backgroundColor: '#666',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          ← Nazad
        </button>
      </div>

      <div style={{ 
        padding: '15px',
        backgroundColor: '#f9f9f9',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <p style={{ margin: '5px 0', fontSize: '14px' }}>
          <strong>Dobavljač:</strong> {selectedDocument.supplier.name}
        </p>
        <p style={{ margin: '5px 0', fontSize: '14px' }}>
          <strong>Datum:</strong> {new Date(selectedDocument.created_at).toLocaleDateString('sr-Latn-RS')}
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        {selectedDocument.items.map(item => (
          <ItemFormCard
            key={item.id}
            item={item}
            locations={locations}
            onUpdate={(receivedQuantity, reason) => 
              handleUpdateQuantity(item.id, receivedQuantity, reason)
            }
          />
        ))}
      </div>

      <button
        onClick={() => handleCompleteReceipt(selectedDocument.id)}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e0ac00')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffc107')}
        style={{
          width: '100%',
          backgroundColor: '#ffc107',
          color: '#fff',
          border: 'none',
          padding: '15px',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          transition: 'background-color 0.15s ease-in-out',
        }}
      >
        Završi prijem
      </button>

      {/* Dodaj sliku (dokaz) za dokument - jednostavan unos URL-a */}
      <button
        onClick={async () => {
          const url = window.prompt('Unesite URL slike (dokaz):');
          if (!url) return;
          try {
            await apiClient.post(`/receiving/documents/${selectedDocument.id}/photos`, {
              photo_url: url,
              user_id: 4,
              caption: 'PWA upload'
            });
            alert('Slika je uspešno dodata.');
          } catch (e) {
            alert('Greška pri dodavanju slike');
          }
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e0ac00')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffc107')}
        style={{
          marginTop: '10px',
          width: '100%',
          backgroundColor: '#ffc107',
          color: '#fff',
          border: 'none',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          transition: 'background-color 0.15s ease-in-out',
        }}
      >
        Dodaj sliku
      </button>
    </div>
  );
}

interface ItemFormCardProps {
  item: ReceivingDocument['items'][0];
  locations: any[];
  onUpdate: (quantity: number, reason: string) => void;
}

function ItemFormCard({ item, locations, onUpdate }: ItemFormCardProps) {
  const [receivedQuantity, setReceivedQuantity] = useState(item.received_quantity || 0);
  const [reason, setReason] = useState(item.condition_notes || '');
  const [selectedLocationId, setSelectedLocationId] = useState(0);
  const [locationCodeInput, setLocationCodeInput] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showReason, setShowReason] = useState(false);

  useEffect(() => {
    const isDifferent = receivedQuantity !== item.expected_quantity;
    setShowReason(isDifferent);
    if (!isDifferent) {
      setReason('');
    }
  }, [receivedQuantity, item.expected_quantity]);

  const handleSave = () => {
    if (!selectedLocationId) {
      alert('Molimo izaberite lokaciju!');
      return;
    }
    if (receivedQuantity !== item.expected_quantity && !reason) {
      alert('Molimo unesite razlog razlike!');
      return;
    }
    onUpdate(receivedQuantity, reason);
  };

  const isDifferent = receivedQuantity !== item.expected_quantity;

  return (
    <div style={{ 
      padding: '20px',
      backgroundColor: '#fff',
      border: '2px solid #ffc107',
      borderRadius: '8px',
      marginBottom: '15px',
    }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#000', fontSize: '16px', fontWeight: 'bold' }}>
        {item.item.name}
      </h3>
      <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
        SKU: {item.item.sku}
      </p>
      <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
        Očekivano: <strong>{item.expected_quantity} {item.quantity_uom}</strong>
      </p>

      <div style={{ marginTop: '15px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>
          Primljeno ({item.quantity_uom}):
        </label>
        <input
          type="number"
          value={receivedQuantity}
          onChange={(e) => setReceivedQuantity(parseFloat(e.target.value) || 0)}
          style={{
            width: '100%',
            padding: '12px',
            border: '2px solid #ddd',
            borderRadius: '4px',
            fontSize: '16px',
          }}
          min="0"
          step="0.01"
        />
      </div>

      {/* Lokacija: privremeno onemogućeno */}

      {showReason && (
        <div style={{ marginTop: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold', color: '#d32f2f' }}>
            Razlog razlike (obavezan):
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Npr: Oštećena roba, manjak na fakturi..."
            style={{
              width: '100%',
              padding: '12px',
              border: '2px solid #d32f2f',
              borderRadius: '4px',
              fontSize: '14px',
              minHeight: '60px',
            }}
          />
        </div>
      )}

      <button
        onClick={handleSave}
        style={{
          marginTop: '15px',
          width: '100%',
          backgroundColor: '#ffc107',
          color: '#000',
          border: 'none',
          padding: '12px',
          borderRadius: '4px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
        }}
      >
        Sačuvaj stavku
      </button>

      {isDifferent && (
        <div style={{
          marginTop: '10px',
          padding: '10px',
          backgroundColor: '#ffebee',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#d32f2f',
        }}>
          ⚠️ Razlika: {receivedQuantity - item.expected_quantity} {item.quantity_uom}
        </div>
      )}

      {/* Dodaj sliku (stavka/dokument) upload fajla */}
      <div style={{ marginTop: '10px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>
          Dodaj sliku (dokaz):
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const form = new FormData();
              form.append('file', file);
              form.append('caption', `Stavka ${item.item.sku}`);
              const token = localStorage.getItem('token') || '';
              const res = await fetch(`http://localhost:8000/receiving/documents/${(window as any).currentDocId}/photos/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: (()=>{ form.append('item_id', String(item.id)); return form; })(),
              });
              if (!res.ok) throw new Error(`Greska upload: ${res.status}`);
              alert('Slika uspešno upload-ovana');
            } catch (err) {
              console.error(err);
              alert('Greška pri upload-u slike');
            }
          }}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}
