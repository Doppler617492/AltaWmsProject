import { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';
import StatusBadge from './StatusBadge';
import { colors } from '../src/theme/colors';
interface ReceivingDocument {
  id: number;
  document_number: string;
  supplier: { name: string };
  status: string;
  created_at: string;
  assigned_to?: number | null;
  assignedUser?: { name?: string | null; full_name?: string | null; username?: string | null } | null;
  created_by?: number | null;
  createdBy?: { id?: number; name?: string | null; full_name?: string | null; username?: string | null } | null;
  document_date?: string | null;
  store_name?: string | null;
  responsible_person?: string | null;
  invoice_number?: string | null;
  notes?: string | null;
  items: Array<{
    id: number;
    item: { name: string; sku: string };
    expected_quantity: number;
    received_quantity: number;
    status: string;
    condition_notes?: string | null;
  }>;
  photos?: Array<{ id:number; photo_url:string; caption?:string; created_at:string }>;
  assigned_summary?: string | null;
  assigned_team_name?: string | null;
  progress_pct?: number | null;
  lines_total?: number | null;
  lines_received?: number | null;
  qty_expected_total?: number | null;
  qty_received_total?: number | null;
  age_minutes?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
}

const translateItemStatus = (status: string): string => {
  const map: Record<string, string> = {
    scanned: 'U RADU',
    placed: 'SLOŽENO',
    verified: 'POTVRĐENO',
    pending: 'U PRIPREMI',
  };
  return map[(status || '').toLowerCase()] || (status?.toUpperCase?.() || 'STATUS');
};

const hasDocumentDiscrepancy = (document: ReceivingDocument): boolean => {
  const items = document.items || [];
  return items.some(item => {
    const expected = Number(item.expected_quantity || 0);
    const received = Number(item.received_quantity || 0);
    const notes = (item.condition_notes || '').trim();
    return expected !== received || notes.length > 0;
  });
};

const getDocumentStatusMeta = (document: ReceivingDocument) => {
  const base = (document.status || '').toLowerCase();
  const items = document.items || [];
  const assigned = Boolean(document.assigned_to ?? document.assignedUser);
  const hasDiscrepancy = hasDocumentDiscrepancy(document);
  const hasProgress = items.some(it => Number(it.received_quantity || 0) > 0);
  const metaMap: Record<string, { label: string; bg: string; color: string }> = {
    NOVO: { label: 'NOVO', bg: '#475569', color: '#f8fafc' },
    DODIJELJEN: { label: 'DODIJELJEN', bg: '#38bdf8', color: '#0f172a' },
    'U OBRADI': { label: 'U OBRADI', bg: '#f59e0b', color: '#1f2937' },
    'NA ČEKANJU': { label: 'NA ČEKANJU', bg: '#fb923c', color: '#1f2937' },
    ZAVRŠENO: { label: 'ZAVRŠENO', bg: '#4ade80', color: '#064e3b' },
    'ZAVRŠENO (SA NAPOMENOM)': { label: 'ZAVRŠENO (SA NAPOMENOM)', bg: '#facc15', color: '#1f2937' },
    OTKAZANO: { label: 'OTKAZANO', bg: '#f87171', color: '#fff' },
  };

  let key = 'NOVO';
  if (base === 'completed') {
    key = hasDiscrepancy ? 'ZAVRŠENO (SA NAPOMENOM)' : 'ZAVRŠENO';
  } else if (base === 'in_progress') {
    key = 'U OBRADI';
  } else if (base === 'on_hold') {
    key = 'NA ČEKANJU';
  } else if (base === 'cancelled') {
    key = 'OTKAZANO';
  } else if (base === 'draft') {
    if (hasProgress) key = 'U OBRADI';
    else key = assigned ? 'DODIJELJEN' : 'NOVO';
  }

  return metaMap[key] || { label: key, bg: '#475569', color: '#f8fafc' };
};

const clampPercentage = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
};

const resolveDocumentProgress = (document: ReceivingDocument): number => {
  if (document.progress_pct !== undefined && document.progress_pct !== null) {
    const parsed = Number(document.progress_pct);
    if (!Number.isNaN(parsed)) {
      return clampPercentage(parsed);
    }
  }
  const items = document.items || [];
  if (!items.length) return 0;
  const completed = items.filter(it => Number(it.received_quantity || 0) > 0).length;
  return clampPercentage((completed / items.length) * 100);
};

const resolveDocumentAgeMinutes = (document: ReceivingDocument): number => {
  if (document.age_minutes !== undefined && document.age_minutes !== null) {
    const parsed = Number(document.age_minutes);
    if (!Number.isNaN(parsed)) {
      return Math.max(0, Math.round(parsed));
    }
  }
  const startIso = document.started_at || document.created_at;
  if (!startIso) return 0;
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return 0;
  const endIso = document.completed_at || new Date().toISOString();
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
};

export default function ReceivingDocuments() {
  const [documents, setDocuments] = useState<ReceivingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<ReceivingDocument | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState({ excelFile: null as File | null, supplier_id: '', supplierSearch: '', assigned_to: '', notes: '' });
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [assignableWorkers, setAssignableWorkers] = useState<any[]>([]);
  const [assignBanner, setAssignBanner] = useState<string>('');
  const [startAssigneeId, setStartAssigneeId] = useState<string>('');
  const [inventoryImpact, setInventoryImpact] = useState<any[] | null>(null);
  const [photos, setPhotos] = useState<any[] | null>(null);
  const [activeTab, setActiveTab] = useState<'items'|'impact'|'photos'|'putaway'>('items');
  const [actorRole, setActorRole] = useState<string>('');
  const [putawaySuggestions, setPutawaySuggestions] = useState<Record<number, any>>({});
  const [syncing, setSyncing] = useState(false);
  const [newDocument, setNewDocument] = useState({
    document_number: '',
    supplier_id: '',
    supplierSearch: '',
    supplier_name: '',
    supplier_country: '',
    pantheon_invoice_number: '',
    assigned_to: '',
    store_name: '',
    notes: '',
    items: [] as any[]
  });
  const [supplierSuggestions, setSupplierSuggestions] = useState<any[]>([]);
  const [itemSuggestionsMap, setItemSuggestionsMap] = useState<Record<number, any[]>>({});

  useEffect(() => {
    fetchDocuments();
    fetchSuppliers();
    fetchItems();
    fetchAssignableWorkers();
    
    // Check if we should open a specific document from localStorage
    try {
      const openDocId = localStorage.getItem('OPEN_RECEIVING_DOCUMENT_ID');
      if (openDocId) {
        const idNum = Number(openDocId);
        if (idNum) {
          // Wait for documents to load, then open the document
          setTimeout(async () => {
            try {
              const doc = await apiClient.get(`/receiving/documents/${idNum}`);
              if (doc) {
                setSelectedDocument(doc);
              }
            } catch (e) {
              console.error('Error opening document:', e);
            }
            localStorage.removeItem('OPEN_RECEIVING_DOCUMENT_ID');
          }, 500);
        }
      }
    } catch {}
  }, []);

  const fetchSuppliers = async () => {
    try {
      const data = await apiClient.get('/suppliers');
      setSuppliers(data);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  const fetchItems = async () => {
    try {
      const data = await apiClient.get('/items');
      setItems(data);
    } catch (err) {
      console.error('Error fetching items:', err);
    }
  };

  const fetchAssignableWorkers = async () => {
    try {
      const data = await apiClient.get('/receiving/warehouse-workers');
      setAssignableWorkers(Array.isArray(data) ? data : []);
    } catch (err) {
      // no-op
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/receiving/documents');
      setDocuments(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (selectedDocument && selectedDocument.status === 'completed') {
        try {
          const impact = await apiClient.get(`/stock/inventory/by-document/${selectedDocument.id}`);
          setInventoryImpact(impact);
        } catch {
          setInventoryImpact([]);
        }
      } else {
        setInventoryImpact(null);
      }
    })();
  }, [selectedDocument?.id, selectedDocument?.status]);

  useEffect(() => {
    (async () => {
      if (selectedDocument && activeTab === 'photos') {
        try {
          const list = await apiClient.get(`/receiving/documents/${selectedDocument.id}/photos`);
          setPhotos(Array.isArray(list) ? list : []);
        } catch {
          setPhotos([]);
        }
      }
    })();
    try {
      const token = localStorage.getItem('token')||'';
      const payload = JSON.parse(atob(token.split('.')[1]));
      setActorRole((payload.role || '').toLowerCase());
    } catch {}
  }, [activeTab, selectedDocument?.id]);

  const handleDeleteDocument = async (docId: number) => {
    if (!confirm('Da li ste sigurni da želite da obrišete ovaj prijem?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:8000/receiving/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      fetchDocuments();
    } catch (err: any) {
      console.error('Error deleting document:', err);
      alert('Greška pri brisanju dokumenta');
    }
  };

  const handlePrintDocument = () => {
    if (!selectedDocument) return;

    const docStatusMeta = getDocumentStatusMeta(selectedDocument);
    const logoUrl = `${window.location.origin}/logo.svg`;

    // Create a print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Prijemni dokument - ${selectedDocument.document_number}</title>
          <style>
            @media print {
              @page { margin: 0.5cm; }
              body { margin: 0; }
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Arial', sans-serif;
              font-size: 12px;
              color: #000;
              background: #fff;
              padding: 20px;
            }
            .header {
              border-bottom: 3px solid #000;
              padding-bottom: 15px;
              margin-bottom: 20px;
            }
            .header h1 {
              font-size: 28px;
              font-weight: bold;
              color: #000;
              margin-bottom: 10px;
            }
            .document-info {
              display: flex;
              justify-content: space-between;
              margin-top: 10px;
            }
            .document-info div {
              font-size: 11px;
            }
            .document-info strong {
              display: block;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .supplier-info {
              margin: 20px 0;
              padding: 15px;
              border: 2px solid #000;
              background: #f9f9f9;
            }
            .supplier-info h3 {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 10px;
              color: #000;
            }
            .table-container {
              margin-top: 20px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            thead {
              background: #000;
              color: #ffc107;
            }
            thead th {
              padding: 12px 8px;
              text-align: left;
              font-weight: bold;
              font-size: 11px;
              border: 1px solid #000;
            }
            tbody td {
              padding: 10px 8px;
              border: 1px solid #ddd;
              font-size: 11px;
            }
            tbody tr:nth-child(even) {
              background: #f9f9f9;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 8px;
              border-radius: 3px;
              font-weight: bold;
              font-size: 10px;
              background: #ffc107;
              color: #000;
            }
            .footer {
              margin-top: 30px;
              padding-top: 15px;
              border-top: 2px solid #000;
              text-align: center;
              font-size: 10px;
              color: #666;
            }
            .totals {
              margin-top: 20px;
              padding: 15px;
              background: #f5f5f5;
              border: 2px solid #000;
            }
            .totals strong {
              font-size: 14px;
              display: block;
              margin-bottom: 8px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <h1>PRIJEMNI DOKUMENT</h1>
              <img src="${logoUrl}" alt="Alta WMS" style="height:42px;" />
            </div>
            <div class="document-info">
              <div>
                <strong>Broj dokumenta:</strong>
                ${selectedDocument.document_number}
              </div>
              <div>
                <strong>Datum:</strong>
                ${new Date(selectedDocument.created_at).toLocaleDateString('sr-Latn-RS')}
              </div>
              <div>
                <strong>Status:</strong>
                <span class="status-badge">${docStatusMeta.label}</span>
              </div>
            </div>
          </div>

          <div class="supplier-info">
            <h3>Podaci o dokumentu</h3>
            <div><strong>Dobavljač:</strong> ${selectedDocument.supplier?.name || '—'}</div>
            ${selectedDocument.store_name ? `<div><strong>Trgovina:</strong> ${selectedDocument.store_name}</div>` : ''}
            ${selectedDocument.responsible_person ? `<div><strong>Odgovorna osoba:</strong> ${selectedDocument.responsible_person}</div>` : ''}
            ${selectedDocument.invoice_number ? `<div><strong>Račun:</strong> ${selectedDocument.invoice_number}</div>` : ''}
            ${docStatusMeta && docStatusMeta.label ? `<div><strong>Status:</strong> ${docStatusMeta.label}</div>` : ''}
            ${selectedDocument.createdBy ? `<div><strong>Kreirao:</strong> ${(selectedDocument.createdBy.full_name || selectedDocument.createdBy.name || selectedDocument.createdBy.username || `ID #${selectedDocument.created_by || ''}`)}</div>` : ''}
            ${selectedDocument.document_date ? `<div><strong>Datum dokumenta:</strong> ${new Date(selectedDocument.document_date).toLocaleDateString('sr-Latn-RS')}</div>` : ''}
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th style="width: 5%;">#</th>
                  <th style="width: 45%;">Artikal</th>
                  <th style="width: 15%;">SKU</th>
                  <th style="width: 12%;">Očekivano</th>
                  <th style="width: 12%;">Primljeno</th>
                  <th style="width: 20%;">Napomena</th>
                  <th style="width: 11%;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${selectedDocument.items.map((item: any, index: number) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td><strong>${item.item.name}</strong></td>
                    <td>${item.item.sku}</td>
                    <td style="text-align: center;">${item.expected_quantity}</td>
                    <td style="text-align: center;">${item.received_quantity}</td>
                    <td style="text-align: left;">${(() => { const exp=Number(item.expected_quantity||0); const rec=Number(item.received_quantity||0); return item.condition_notes ? item.condition_notes.replace(/</g,'&lt;').replace(/>/g,'&gt;') : (exp!==rec ? 'Bez napomene' : ''); })()}</td>
                    <td style="text-align: center;">
                      <span class="status-badge">${translateItemStatus((item as any).computed_status || item.status)}</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="totals">
            <strong>Ukupno stavki: ${selectedDocument.items.length}</strong>
            <strong>Ukupno očekivano: ${selectedDocument.items.reduce((sum: number, item: any) => sum + item.expected_quantity, 0).toFixed(2)} kom</strong>
            <strong>Ukupno primljeno: ${selectedDocument.items.reduce((sum: number, item: any) => sum + item.received_quantity, 0).toFixed(2)} kom</strong>
          </div>

          <div class="footer">
            Alta WMS - Warehouse Management System | Generisano: ${new Date().toLocaleString('sr-Latn-RS')}
          </div>

          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  const backendBase = 'http://localhost:8000';
  const [previewData, setPreviewData] = useState<any|null>(null);

  const handleImportPantheon = async () => {
    if (!importData.excelFile) { alert('Molimo izaberite Excel fajl'); return; }
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', importData.excelFile);
      formData.append('preview','true');
      const response = await fetch(`/api/fresh/receiving/import`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) { const t=await response.text(); throw new Error(t||'Greška pri pregledu'); }
      const data = await response.json();
      setPreviewData(data);
    } catch (err:any) { alert(err?.message||'Greška pri pregledu'); }
  };

  const confirmImportPantheon = async () => {
    if (!previewData) return;
    try {
      const payload = { ...previewData, notes: importData.notes };
      const result = await apiClient.post('/receiving/import-json', payload);
      if (importData.assigned_to) {
        await apiClient.patch(`/receiving/documents/${result.id}/reassign`, { assigned_to_user_id: Number(importData.assigned_to) });
        const worker = assignableWorkers.find(w=> String(w.id) === String(importData.assigned_to));
        if (worker) setAssignBanner(`Dodeljeno: ${worker.name}`);
      }
      alert(result.message || 'Import uspešan');
      // Auto-open created document in Pregled
      try { const doc = await apiClient.get(`/receiving/documents/${result.id}`); setSelectedDocument(doc); } catch {}
      setPreviewData(null);
      setShowImportModal(false);
      setImportData({ excelFile: null, supplier_id: '', supplierSearch: '', assigned_to: '', notes: '' });
      fetchDocuments();
    } catch (e:any) { alert(e?.message||'Greška pri snimanju'); }
  };

  const renderDocumentStatusBadge = (document: ReceivingDocument) => {
    const meta = getDocumentStatusMeta(document);
    return (
      <span style={{
        backgroundColor: meta.bg,
        color: meta.color,
        padding: '4px 10px',
        borderRadius: 999,
        fontWeight: 700,
        fontSize: 12,
        letterSpacing: '0.5px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 90,
        textAlign: 'center' as const,
      }}>
        {meta.label}
      </span>
    );
  };

  const handleCreateDocument = async () => {
    try {
      if (!newDocument.document_number || !newDocument.supplier_id) {
        alert('Molimo unesite broj dokumenta i izaberite dobavljača.');
        return;
      }
      const documentData = {
        document_number: newDocument.document_number,
        supplier_id: parseInt(newDocument.supplier_id),
        pantheon_invoice_number: newDocument.pantheon_invoice_number,
        assigned_to: newDocument.assigned_to ? parseInt(newDocument.assigned_to) : undefined,
        store_name: newDocument.store_name || null,
        notes: newDocument.notes
      };

      const createdDocument = await apiClient.post('/receiving/documents', documentData);
      
      // Add items to document with validation
      for (const item of newDocument.items) {
        const iid = parseInt(item.item_id);
        const qty = parseFloat(item.expected_quantity);
        if (!iid || !Number.isFinite(qty) || qty <= 0) {
          throw new Error('Stavka nije kompletna: izaberite artikal i unesite količinu > 0.');
        }
        await apiClient.post('/receiving/items', {
          document_id: createdDocument.id,
          item_id: iid,
          expected_quantity: qty,
          barcode: item.barcode
        });
      }

      setShowCreateModal(false);
      setNewDocument({
        document_number: '',
        supplier_id: '',
        supplierSearch: '',
        supplier_name: '',
        supplier_country: '',
        pantheon_invoice_number: '',
        assigned_to: '',
        store_name: '',
        notes: '',
        items: []
      });
      fetchDocuments();
    } catch (err: any) {
      console.error('Error creating document:', err);
      alert(err?.message || 'Greška pri kreiranju prijema');
    }
  };

  const handleStartReceiving = async () => {
    if (!selectedDocument) return;
    if (!startAssigneeId) {
      alert('Molimo izaberite magacionera za start prijema.');
      return;
    }
    try {
      await apiClient.patch(`/receiving/documents/${selectedDocument.id}/start`, {
        assigned_to_user_id: parseInt(startAssigneeId),
      });
      alert('Prijem je startovan.');
      setSelectedDocument(null);
      fetchDocuments();
    } catch (e: any) {
      alert(e?.message || 'Greška pri startovanju prijema');
    }
  };

  const addItemToDocument = () => {
    setNewDocument(prev => ({
      ...prev,
      items: [...prev.items, { item_id: '', searchQuery: '', item_name: '', expected_quantity: '', barcode: '' }]
    }));
  };

  const handleSearchItem = async (index: number, query: string) => {
    if (!query || query.length < 2) {
      setItemSuggestionsMap(prev => ({ ...prev, [index]: [] }));
      return;
    }

    try {
      // Search by SKU or barcode and show suggestions
      const foundItems = items.filter(item => 
        item.sku.toLowerCase().includes(query.toLowerCase()) || 
        (item.barcode && item.barcode.toLowerCase().includes(query.toLowerCase()))
      );

      setItemSuggestionsMap(prev => ({ ...prev, [index]: foundItems }));
    } catch (err) {
      console.error('Error searching item:', err);
    }
  };

  const selectItem = (item: any, itemIndex: number) => {
    setNewDocument(prev => ({
      ...prev,
      items: prev.items.map((it, i) => 
        i === itemIndex ? { 
          ...it, 
          item_id: item.id, 
          item_name: item.name, 
          barcode: item.barcode,
          searchQuery: item.sku
        } : it
      )
    }));
    setItemSuggestionsMap(prev => ({ ...prev, [itemIndex]: [] }));
  };

  const handleSearchSupplier = (query: string) => {
    if (!query || query.length < 2) {
      setSupplierSuggestions([]);
      setNewDocument(prev => ({ ...prev, supplier_id: '', supplier_name: '', supplier_country: '' }));
      return;
    }

    try {
      // Search by name and show suggestions
      const foundSuppliers = suppliers.filter(supplier => 
        supplier.name.toLowerCase().includes(query.toLowerCase())
      );

      setSupplierSuggestions(foundSuppliers);
    } catch (err) {
      console.error('Error searching supplier:', err);
    }
  };

  const selectSupplier = (supplier: any) => {
    setNewDocument(prev => ({
      ...prev,
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      supplier_country: supplier.country,
      supplierSearch: supplier.name
    }));
    setSupplierSuggestions([]);
  };

  const removeItemFromDocument = (index: number) => {
    setNewDocument(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItemInDocument = (index: number, field: string, value: string) => {
    setNewDocument(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const selectedStatusMeta = selectedDocument ? getDocumentStatusMeta(selectedDocument) : null;
  const selectedAssigneeSummary = (() => {
    if (!selectedDocument) return null;
    if (selectedDocument.assigned_summary) return selectedDocument.assigned_summary;
    if (selectedDocument.assigned_team_name) return selectedDocument.assigned_team_name;
    if (selectedDocument.assignedUser && (selectedDocument.assignedUser.full_name || selectedDocument.assignedUser.name || selectedDocument.assignedUser.username)) {
      return selectedDocument.assignedUser.full_name || selectedDocument.assignedUser.name || selectedDocument.assignedUser.username;
    }
    if (selectedDocument.assigned_to) return `Korisnik #${selectedDocument.assigned_to}`;
    return null;
  })();

  const selectedDocumentSummary = selectedDocument ? (() => {
    const itemsList = Array.isArray(selectedDocument.items) ? selectedDocument.items : [];
    const totalLines = itemsList.length;
    const expectedQty = itemsList.reduce((sum, item) => sum + Number(item.expected_quantity || 0), 0);
    const receivedQty = itemsList.reduce((sum, item) => sum + Number(item.received_quantity || 0), 0);
    const progress = resolveDocumentProgress(selectedDocument);
    const ageMinutes = resolveDocumentAgeMinutes(selectedDocument);
    const hasDiscrepancy = hasDocumentDiscrepancy(selectedDocument);
    const createdAt = selectedDocument.created_at ? new Date(selectedDocument.created_at) : null;
    const documentDate = selectedDocument.document_date ? new Date(selectedDocument.document_date) : null;
    return {
      totalLines,
      expectedQty,
      receivedQty,
      progress,
      ageMinutes,
      hasDiscrepancy,
      createdAt,
      documentDate,
    };
  })() : null;

  const formatQty = (value: number) => {
    if (!Number.isFinite(value)) return '—';
    return value.toLocaleString('sr-Latn-RS', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const runManualSync = async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    try {
      setSyncing(true);
      const result = await apiClient.post('/integrations/cungu/sync', {
        receiving: {
          dateFrom: since,
          warehouse: 'Veleprodajni',
        },
      });
      alert(
        `Sinhronizacija završena.\nPrijema: ${result?.receivingCount ?? 0}\nOtprema: ${
          result?.shippingCount ?? 0
        }\nZalihe: ${result?.stockCount ?? 0}`,
      );
      await fetchDocuments();
    } catch (err: any) {
      alert(err?.message || 'Greška pri sinhronizaciji.');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div>Učitavanje dokumenata...</div>;
  if (error) return <div style={{ color: 'red' }}>Greška: {error}</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Dokumenti prijema</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={runManualSync}
            style={styles.syncButton}
            disabled={syncing}
          >
            {syncing ? 'Sinhronišem…' : 'Sinhroniši (Cungu)'}
          </button>
          <button 
            onClick={() => setShowImportModal(true)}
            style={styles.importButton}
          >
            Import
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            style={styles.createButton}
          >
            + Novi prijem
          </button>
        </div>
      </div>
      
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '16%' }}>Broj dokumenta</th>
              <th style={{ ...styles.th, width: '20%' }}>Dobavljač</th>
              <th style={{ ...styles.th, width: '14%' }}>Kreirao</th>
              <th style={{ ...styles.th, width: '12%', textAlign: 'center' as const }}>Status</th>
              <th style={{ ...styles.th, width: '14%', textAlign: 'center' as const }}>Progres</th>
              <th style={{ ...styles.th, width: '9%', textAlign: 'center' as const }}>Starost</th>
              <th style={{ ...styles.th, width: '9%', textAlign: 'center' as const }}>Datum</th>
              <th style={{ ...styles.th, width: '16%', textAlign: 'center' as const }}>Akcije</th>
            </tr>
          </thead>
          <tbody>
            {documents.map(doc => {
              const creatorName = doc.createdBy?.full_name || doc.createdBy?.name || doc.createdBy?.username || '—';
              const progressPct = resolveDocumentProgress(doc);
              const ageMinutes = resolveDocumentAgeMinutes(doc);
              return (
              <tr key={doc.id} style={styles.tr}>
                <td style={{ ...styles.td, width: '16%' }}>{doc.document_number}</td>
                <td style={{ ...styles.td, width: '20%' }}>{doc.supplier?.name || '—'}</td>
                <td style={{ ...styles.td, width: '14%' }}>{creatorName}</td>
                <td style={{ ...styles.td, width: '12%', textAlign: 'center' as const }}>{renderDocumentStatusBadge(doc)}</td>
                <td style={{ ...styles.td, width: '14%', textAlign: 'center' as const }}><ProgressMeter value={progressPct} /></td>
                <td style={{ ...styles.td, width: '9%', textAlign: 'center' as const }}>{`${ageMinutes} min`}</td>
                <td style={{ ...styles.td, width: '9%', textAlign: 'center' as const }}>{new Date(doc.created_at).toLocaleDateString('sr-Latn-RS')}</td>
                <td style={{ ...styles.td, width: '16%', textAlign: 'center' as const }}>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button 
                      onClick={() => setSelectedDocument(doc)}
                      style={styles.actionButton}
                    >
                      Pregledaj
                    </button>
                    {(doc.status === 'draft' || actorRole==='admin') && (
                      <button 
                        onClick={() => handleDeleteDocument(doc.id)}
                        style={styles.deleteButton}
                      >
                        Obriši
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>

      {selectedDocument && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalWrapper}>
            <div style={styles.modalHeaderModern}>
              <div>
                <div style={{ color: colors.brandYellow, fontSize: 12, letterSpacing: '1px' }}>Pregled prijema</div>
                <h3 style={{ margin: '4px 0 0', color: '#fff' }}>{selectedDocument.document_number}</h3>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handlePrintDocument} style={styles.actionGhostButton}>Štampaj</button>
                {(actorRole==='admin') && (
                  <button
                    onClick={async()=>{
                      if (!confirm('Da li ste sigurni da želite da obrišete ovaj prijem?')) return;
                      try{ await apiClient.delete(`/receiving/documents/${selectedDocument.id}`); setSelectedDocument(null); fetchDocuments(); }
                      catch(e:any){ alert(e?.message||'Greška pri brisanju'); }
                    }}
                    style={{ ...styles.actionGhostButton, background: '#ff4d4f', borderColor: '#ff4d4f', color: '#fff' }}
                  >
                    Izbriši
                  </button>
                )}
                <button onClick={() => setSelectedDocument(null)} style={styles.modalCloseButton}>×</button>
              </div>
            </div>
            <div style={styles.modalBodyModern}>
              <aside style={styles.modalSidebar}>
                <div style={styles.sectionCard}>
                  <div style={styles.sectionTitle}>Opšte informacije</div>
                  <p><strong>Dobavljač:</strong> {selectedDocument.supplier?.name || '—'}</p>
                  {selectedDocument.store_name && <p><strong>Trgovina:</strong> {selectedDocument.store_name}</p>}
                  {selectedDocument.responsible_person && (
                    <div style={styles.sectionRow}><span>Odgovorna</span><strong>{selectedDocument.responsible_person}</strong></div>
                  )}
                  {selectedDocument.invoice_number && (
                    <div style={styles.sectionRow}><span>Račun</span><strong>{selectedDocument.invoice_number}</strong></div>
                  )}
                  <div style={styles.sectionRow}>
                    <span>Status</span>
                    {selectedStatusMeta ? (
                      <span style={{
                        ...styles.sectionStatusBadge,
                        backgroundColor: selectedStatusMeta.bg,
                        color: selectedStatusMeta.color,
                        borderColor: `${selectedStatusMeta.color}33`
                      }}>
                        {selectedStatusMeta.label}
                      </span>
                    ) : (
                      <span style={styles.sectionStatusBadge}>—</span>
                    )}
                  </div>
                  {selectedDocument.createdBy && (
                    <div style={styles.sectionRow}>
                      <span>Kreirao</span>
                      <strong>{selectedDocument.createdBy.full_name || selectedDocument.createdBy.name || selectedDocument.createdBy.username || `ID #${selectedDocument.created_by}`}</strong>
                    </div>
                  )}
                  {selectedAssigneeSummary && (
                    <div style={styles.sectionRow}><span>Dodeljeno</span><strong>{selectedAssigneeSummary}</strong></div>
                  )}
                  {selectedDocumentSummary && (
                    <>
                      <div style={styles.sectionDivider} />
                      <div style={styles.sectionStatGrid}>
                        <div style={styles.sectionStatCard}>
                          <div style={styles.sectionStatLabel}>Broj dokumenta</div>
                          <div style={styles.sectionStatValue}>{selectedDocument.document_number}</div>
                        </div>
                        <div style={styles.sectionStatCard}>
                          <div style={styles.sectionStatLabel}>Datum dokumenta</div>
                          <div style={styles.sectionStatValue}>
                            {selectedDocumentSummary.documentDate ? selectedDocumentSummary.documentDate.toLocaleDateString('sr-Latn-RS') : '—'}
                          </div>
                        </div>
                        <div style={styles.sectionStatCard}>
                          <div style={styles.sectionStatLabel}>Kreirano</div>
                          <div style={styles.sectionStatValue}>
                            {selectedDocumentSummary.createdAt ? selectedDocumentSummary.createdAt.toLocaleString('sr-Latn-RS') : '—'}
                          </div>
                        </div>
                        <div style={styles.sectionStatCard}>
                          <div style={styles.sectionStatLabel}>Ukupno stavki</div>
                          <div style={styles.sectionStatValue}>{selectedDocumentSummary.totalLines}</div>
                        </div>
                        <div style={styles.sectionStatCard}>
                          <div style={styles.sectionStatLabel}>Očekivano</div>
                          <div style={styles.sectionStatValue}>{formatQty(selectedDocumentSummary.expectedQty)}</div>
                        </div>
                        <div style={styles.sectionStatCard}>
                          <div style={styles.sectionStatLabel}>Primljeno</div>
                          <div style={styles.sectionStatValue}>{formatQty(selectedDocumentSummary.receivedQty)}</div>
                        </div>
                        <div style={styles.sectionStatCard}>
                          <div style={styles.sectionStatLabel}>Napredak</div>
                          <div style={styles.sectionStatValueHighlight}>{selectedDocumentSummary.progress}%</div>
                        </div>
                        <div style={styles.sectionStatCard}>
                          <div style={styles.sectionStatLabel}>Starost</div>
                          <div style={styles.sectionStatValue}>{selectedDocumentSummary.ageMinutes} min</div>
                        </div>
                      </div>
                      {selectedDocumentSummary.hasDiscrepancy && (
                        <div style={styles.sectionBadgeWarn}>
                          ⚠️ Detektovano neslaganje u stavkama
                        </div>
                      )}
                    </>
                  )}
                </div>
                {selectedDocument.status === 'in_progress' && (
                  <div style={styles.sectionCard}>
                    <div style={styles.sectionTitle}>Napredak</div>
                    <div style={styles.progressBarTrack}>
                      <div style={{ ...styles.progressBarValue, width: `${resolveDocumentProgress(selectedDocument)}%` }} />
                    </div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'right', marginTop: 4 }}>
                      {resolveDocumentProgress(selectedDocument)}% potvrđeno
                    </div>
                  </div>
                )}
                {selectedDocument.status === 'completed' && (
                  <div style={{ ...styles.sectionCard, background: '#e6fffb', borderColor: '#87e8de', color: '#006d75' }}>
                    Završeno {(selectedDocument as any).completed_at ? new Date((selectedDocument as any).completed_at).toLocaleString('sr-Latn-RS') : ''}
                  </div>
                )}
                <div style={styles.sectionCard}>
                  <div style={styles.sectionTitle}>Akcije</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedDocument.status === 'draft' && (
                      <button style={styles.primaryActionButton} onClick={handleStartReceiving}>Pokreni prijem</button>
                    )}
                    {selectedDocument.status === 'in_progress' && (
                      <button style={styles.primaryActionButton}
                        onClick={async () => {
                          const hasScanned = selectedDocument.items.some((it:any) => (it.status || '').toLowerCase() === 'scanned');
                          if (hasScanned) {
                            const ok = confirm('Nisu sve stavke potvrđene. Želite li ipak zatvoriti prijem?');
                            if (!ok) return;
                          }
                          try {
                            await apiClient.patch(`/receiving/documents/${selectedDocument.id}/complete`);
                            alert('Prijem zatvoren');
                            setSelectedDocument(null);
                            fetchDocuments();
                          } catch (e:any) {
                            alert(e.message || 'Greška pri zatvaranju prijema');
                          }
                        }}
                      >
                        Zatvori prijem
                      </button>
                    )}
                  </div>
                </div>
              </aside>
              <section style={styles.modalContentArea}>
                <div style={styles.tabHeader}>
                  <button onClick={()=>setActiveTab('items')} style={{ ...styles.tabModern, ...(activeTab==='items'?styles.tabModernActive:{}) }}>Stavke</button>
                  <button onClick={()=>setActiveTab('putaway')} style={{ ...styles.tabModern, ...(activeTab==='putaway'?styles.tabModernActive:{}) }}>Predlog smještanja</button>
                  <button onClick={()=>setActiveTab('impact')} style={{ ...styles.tabModern, ...(activeTab==='impact'?styles.tabModernActive:{}) }}>Uticaj na zalihe</button>
                  <button onClick={()=>setActiveTab('photos')} style={{ ...styles.tabModern, ...(activeTab==='photos'?styles.tabModernActive:{}) }}>Foto evidencija</button>
                </div>
                <div style={styles.tabContent}>
                  {activeTab === 'items' && (
                    <div>
                      <table style={styles.itemsModernTable}>
                        <thead>
                          <tr>
                            <th>Artikal</th>
                            <th>SKU</th>
                            <th style={{ textAlign: 'right' }}>Očekivano</th>
                            <th style={{ textAlign: 'right' }}>Primljeno</th>
                            <th style={{ textAlign: 'left' }}>Napomena</th>
                            <th style={{ textAlign: 'center' }}>Status</th>
                            <th style={{ textAlign: 'center' }}>Akcija</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDocument.items.map(item => {
                            const expected = Number(item.expected_quantity || 0);
                            const received = Number(item.received_quantity || 0);
                            const hasDiscrepancy = expected !== received;
                            return (
                              <tr key={item.id} style={{ background: hasDiscrepancy ? 'rgba(255, 193, 7, 0.08)' : 'transparent' }}>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{item.item.name}</div>
                                </td>
                                <td style={{ textAlign: 'center' }}>{item.item.sku}</td>
                                <td style={{ textAlign: 'right' }}>{expected}</td>
                                <td style={{ textAlign: 'right', color: hasDiscrepancy ? colors.statusErr : colors.textPrimary, fontWeight: hasDiscrepancy ? 700 : 400 }}>{received}</td>
                                <td style={{ color: hasDiscrepancy ? colors.statusWarn : colors.textSecondary }}>
                                  {item.condition_notes ? <div style={{ whiteSpace: 'pre-wrap' }}>{item.condition_notes}</div> : hasDiscrepancy ? <span style={{ fontStyle: 'italic' }}>Bez napomene</span> : <span>—</span>}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <StatusBadge status={translateItemStatus((item as any).computed_status || item.status)} />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {actorRole==='admin' && (
                                    <button
                                      onClick={async()=>{
                                        if (!confirm('Obrisati stavku iz prijema?')) return;
                                        try{ await apiClient.delete(`/receiving/items/${item.id}`); const d = await apiClient.get(`/receiving/documents/${selectedDocument.id}`); setSelectedDocument(d); }
                                        catch(e:any){ alert(e?.message||'Greška pri brisanju stavke'); }
                                      }}
                                      style={styles.smallDangerButton}
                                    >
                                      Izbriši
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {activeTab === 'impact' && (
                    <div>
                      <h4 style={styles.sectionTitle}>Uticaj na zalihe</h4>
                      {selectedDocument.status !== 'completed' ? (
                        <div style={{ color: colors.textSecondary, fontSize: 14 }}>Zalihe će biti vidljive nakon završetka prijema.</div>
                      ) : (
                        <table style={styles.itemsModernTable}>
                          <thead>
                            <tr>
                              <th>SKU</th>
                              <th>Naziv</th>
                              <th>Lokacija</th>
                              <th style={{ textAlign: 'right' }}>Primljeno</th>
                              <th style={{ textAlign: 'right' }}>Stanje posle</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(inventoryImpact || []).map((row: any, idx: number) => (
                              <tr key={idx}>
                                <td>{row.sku}</td>
                                <td>{row.naziv}</td>
                                <td>{row.lokacija}</td>
                                <td style={{ textAlign: 'right' }}>{row.primljeno}</td>
                                <td style={{ textAlign: 'right' }}>{row.stanje_posle}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                  {activeTab === 'putaway' && (
                    <div>
                      <PutawayTab document={selectedDocument} onApplySuggestion={async (itemId, locationCode, quantity) => {
                        try {
                          const result = await apiClient.post('/putaway/apply', {
                            receiving_item_id: itemId,
                            location_code: locationCode,
                            quantity,
                          });
                          alert(result.message || 'Stavka postavljena');
                          fetchDocuments();
                          if (selectedDocument) {
                            const updated = await apiClient.get(`/receiving/documents/${selectedDocument.id}`);
                            setSelectedDocument(updated);
                          }
                        } catch (e: any) {
                          alert('Greška: ' + (e.message || 'Neuspešno'));
                        }
                      }} />
                    </div>
                  )}
                  {activeTab === 'photos' && (
                    <div>
                      <h4 style={styles.sectionTitle}>Foto evidencija</h4>
                      <div style={styles.photoGrid}>
                        {(photos || []).map((p:any, idx:number) => (
                          <div key={idx} style={styles.photoCard}>
                            <img src={p.file_path} alt={p.note || 'foto'} style={styles.photoImage} />
                            <div style={styles.photoInfo}>
                              <div style={{ fontWeight: 700, marginBottom: 4, color:'#ffc107' }}>{p.receiving_item ? `${p.receiving_item.sku} · ${p.receiving_item.name}` : '(ceo tovar)'}</div>
                              {p.note && <div style={{ fontSize: 12, color: '#ddd' }}>NAPOMENA: {p.note}</div>}
                              <div style={{ fontSize: 12, color: '#bbb', marginTop: 4 }}>Snimio: {p.uploaded_by}</div>
                              <div style={{ fontSize: 12, color: '#bbb' }}>{new Date(p.uploaded_at).toLocaleString('sr-Latn-RS')}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3>Import prijema iz Pantheona</h3>
              <button onClick={() => setShowImportModal(false)} style={styles.closeButton}>
                X
              </button>
            </div>
            <div style={styles.modalBody}>
              {previewData && (
                <div style={{ marginBottom: 12, border: `1px solid ${colors.borderDefault}`, borderRadius: 6, padding: 10, background: colors.bgBody }}>
                  <div style={{ fontWeight: 700, marginBottom: 6, color: colors.brandYellow }}>Pregled dokumenta · {previewData.document_number}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6, fontSize:12, marginBottom:8 }}>
                    <div><b>Dobavljač:</b> {previewData.supplier_name||'-'}</div>
                    <div><b>Trgovina:</b> {previewData.store_name||'-'}</div>
                    <div><b>Datum:</b> {previewData.document_date||'-'}</div>
                    <div><b>Odgovorna osoba:</b> {previewData.responsible_person||'-'}</div>
                    <div><b>Račun:</b> {previewData.invoice_number||'-'}</div>
                    <div><b>Stavki:</b> {previewData.items_found||0}</div>
                  </div>
                  <div style={{ maxHeight: 240, overflow:'auto', border:`1px solid ${colors.borderDefault}`, borderRadius: 6 }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign:'left', padding:6, borderBottom:`1px solid ${colors.borderDefault}`, color: colors.brandYellow }}>Šifra</th>
                          <th style={{ textAlign:'left', padding:6, borderBottom:`1px solid ${colors.borderDefault}`, color: colors.brandYellow }}>Naziv</th>
                          <th style={{ textAlign:'right', padding:6, borderBottom:`1px solid ${colors.borderDefault}`, color: colors.brandYellow }}>Količina</th>
                          <th style={{ textAlign:'left', padding:6, borderBottom:`1px solid ${colors.borderDefault}`, color: colors.brandYellow }}>JM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(previewData.lines||[]).map((ln:any, idx:number)=> (
                          <tr key={idx}>
                            <td style={{ padding:6, borderBottom:`1px solid ${colors.borderCard}` }}>{ln.item_sku}</td>
                            <td style={{ padding:6, borderBottom:`1px solid ${colors.borderCard}` }}>{ln.item_name}</td>
                            <td style={{ padding:6, borderBottom:`1px solid ${colors.borderCard}`, textAlign:'right' }}>{ln.requested_qty}</td>
                            <td style={{ padding:6, borderBottom:`1px solid ${colors.borderCard}` }}>{ln.uom}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div style={styles.formGroup}>
                <label style={styles.label}>Excel fajl (xlsx, xls):</label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setImportData(prev => ({ ...prev, excelFile: e.target.files?.[0] || null }))}
                  style={{ ...styles.input, padding: '8px' }}
                />
                <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  Excel fajl mora sadržati: Dobavljač, Prijemnica, Ident (SKU), Naziv, Količina, JM
                </p>
                <p style={{ fontSize: '12px', color: '#4CAF50', marginTop: '5px' }}>
                  ✅ Dobavljač se automatski prepoznaje iz Excela
                  <br />
                  ✅ Korisnik je po default Šef magacina (dodeljuje zadatak magacioneru)
                </p>
              </div>

              {!previewData && (
                <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>
                  Izbor magacionera biće prikazan nakon pregleda dokumenta.
                </div>
              )}
              
                <div style={styles.formGroup}>
                <label style={styles.label}>Napomena:</label>
                  <textarea
                    value={importData.notes}
                    onChange={(e) => setImportData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Dodatne napomene..."
                    style={styles.textarea}
                  />
                </div>
              
              <div style={styles.modalActions}>
                {!previewData ? (
                  <button onClick={handleImportPantheon} style={styles.saveButton}>Pregled</button>
                ) : (
                  <>
                    <div style={{ marginRight: 'auto' }}>
                      <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Dodeli magacioneru:</label>
                      <select value={importData.assigned_to} onChange={e=>setImportData(prev=>({...prev, assigned_to: e.target.value}))} style={styles.input}>
                        <option value="">— Izaberite magacionera —</option>
                        {assignableWorkers.map((w:any)=>(<option key={w.id} value={w.id}>{w.name}</option>))}
                      </select>
                    </div>
                    <button onClick={()=>setPreviewData(null)} style={styles.cancelButton}>Nazad</button>
                    <button onClick={confirmImportPantheon} style={styles.saveButton}>Potvrdi i sačuvaj</button>
                  </>
                )}
                <button onClick={() => setShowImportModal(false)} style={styles.cancelButton}>
                  Otkaži
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3>Novi prijem</h3>
              <button onClick={() => setShowCreateModal(false)} style={styles.closeButton}>
                X
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Broj dokumenta:</label>
                <input
                  type="text"
                  value={newDocument.document_number}
                  onChange={(e) => setNewDocument(prev => ({ ...prev, document_number: e.target.value }))}
                  placeholder="GRN-2025-XXXX"
                  style={styles.input}
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Dobavljač:</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={newDocument.supplierSearch}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewDocument(prev => ({ ...prev, supplierSearch: value }));
                      handleSearchSupplier(value);
                    }}
                    placeholder="Ime dobavljača (autocomplet)"
                    style={styles.input}
                  />
                        {supplierSuggestions.length > 0 && (
                          <div style={styles.suggestionsBox}>
                            {supplierSuggestions.map(supplier => (
                              <div
                                key={supplier.id}
                                onClick={() => selectSupplier(supplier)}
                                style={styles.suggestionItem}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                              >
                                {supplier.name} {supplier.country && `(${supplier.country})`}
                              </div>
                            ))}
                          </div>
                        )}
                </div>
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Broj fakture:</label>
                <input
                  type="text"
                  value={newDocument.pantheon_invoice_number}
                  onChange={(e) => setNewDocument(prev => ({ ...prev, pantheon_invoice_number: e.target.value }))}
                  placeholder="INV-2025-XXXX"
                  style={styles.input}
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Dodeli radniku (opciono):</label>
                <select
                  value={newDocument.assigned_to}
                  onChange={(e) => setNewDocument(prev => ({ ...prev, assigned_to: e.target.value }))}
                  style={styles.input}
                >
                  <option value="">— Izaberite magacionera —</option>
                  {assignableWorkers.map((w:any) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Napomena:</label>
                <textarea
                  value={newDocument.notes}
                  onChange={(e) => setNewDocument(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Dodatne napomene..."
                  style={styles.textarea}
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Prodavnica:</label>
                <select
                  value={newDocument.store_name}
                  onChange={(e) => setNewDocument(prev => ({ ...prev, store_name: e.target.value }))}
                  style={styles.input}
                >
                  <option value="">— Izaberite prodavnicu —</option>
                  {storeOptions.map(store => (
                    <option key={store} value={store}>{store}</option>
                  ))}
                </select>
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Artikli:</label>
                <button onClick={addItemToDocument} style={styles.addItemButton}>
                  + Dodaj stavku
                </button>
                
                {newDocument.items.map((item, index) => (
                  <div key={index} style={styles.itemCard}>
                    <div style={styles.itemRow}>
                      <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
                        <input
                          type="text"
                          value={item.searchQuery}
                          onChange={(e) => {
                            const value = e.target.value;
                            updateItemInDocument(index, 'searchQuery', value);
                            handleSearchItem(index, value);
                          }}
                          placeholder="SKU ili Barcode"
                          style={styles.input}
                        />
                        {itemSuggestionsMap[index] && itemSuggestionsMap[index].length > 0 && (
                          <div style={styles.suggestionsBox}>
                            {itemSuggestionsMap[index].map((suggestion) => (
                              <div
                                key={suggestion.id}
                                onClick={() => selectItem(suggestion, index)}
                                style={styles.suggestionItem}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                              >
                                {suggestion.sku} - {suggestion.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div style={{ marginLeft: '60px' }}>
                        <input
                          type="number"
                          value={item.expected_quantity}
                          onChange={(e) => updateItemInDocument(index, 'expected_quantity', e.target.value)}
                          placeholder="Količina"
                          style={{ ...styles.input, width: '100px', flexShrink: 0 }}
                        />
                      </div>
                      
                      <div style={{ marginLeft: '10px' }}>
                        <button 
                          onClick={() => removeItemFromDocument(index)}
                          style={styles.removeButton}
                        >
                          X
                        </button>
                      </div>
                    </div>
                    
                    {item.item_name && (
                      <div style={styles.itemInfo}>
                        <strong>Artikal:</strong> {item.item_name} {item.barcode && `(Barcode: ${item.barcode})`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div style={styles.modalActions}>
                <button onClick={handleCreateDocument} style={styles.saveButton}>
                  Sačuvaj
                </button>
                <button onClick={() => setShowCreateModal(false)} style={styles.cancelButton}>
                  Otkaži
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: 12,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 700,
    color: colors.brandYellow,
  },
  syncButton: {
    backgroundColor: 'transparent',
    color: colors.brandYellow,
    border: `1px solid ${colors.borderDefault}`,
    padding: '6px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
  },
  createButton: {
    backgroundColor: colors.bgPanel,
    color: colors.brandYellow,
    border: `1px solid ${colors.borderDefault}`,
    padding: '6px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
  },
  printButton: {
    backgroundColor: colors.bgPanel,
    color: colors.brandYellow,
    border: `1px solid ${colors.borderDefault}`,
    padding: '6px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
  },
  importButton: {
    backgroundColor: colors.bgPanel,
    color: colors.brandYellow,
    border: `1px solid ${colors.borderDefault}`,
    padding: '6px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
  },
  tableContainer: {
    backgroundColor: colors.bgBody,
    borderRadius: 8,
    overflow: 'hidden',
    border: `1px solid ${colors.borderDefault}`,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    color: colors.textPrimary,
  },
  th: {
    backgroundColor: colors.bgBody,
    color: colors.brandYellow,
    padding: 8,
    textAlign: 'left' as const,
    borderBottom: `1px solid ${colors.borderDefault}`,
    fontSize: 13,
  },
  tr: {
    borderBottom: `1px solid ${colors.borderCard}`,
  },
  td: {
    padding: 8,
    fontSize: 13,
  },
  actionButton: {
    backgroundColor: colors.bgPanel,
    color: colors.brandYellow,
    border: `1px solid ${colors.borderDefault}`,
    padding: '6px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
  },
  deleteButton: {
    backgroundColor: '#ffc107',
    color: '#fff',
    border: '1px solid #e0ac00',
    padding: '6px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
  },
  modal: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: colors.bgPanel,
    border: `1px solid ${colors.borderStrong}`,
    borderRadius: 8,
    padding: 16,
    width: '80%',
    maxWidth: '900px',
    maxHeight: '85vh',
    overflow: 'auto',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottom: `1px solid ${colors.borderDefault}`,
    backgroundColor: colors.bgBody,
  },
  closeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#666',
    fontWeight: 'bold' as const,
  },
  modalBody: {
    padding: 12,
  },
  itemsTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginTop: '10px',
  },
  // Avoid React shorthand/longhand collision: use explicit border props
  tabBtn: {
    borderStyle: 'solid' as const,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderBottomWidth: 0,
    background: colors.bgBody,
    color: colors.textPrimary,
    padding: '8px 12px',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    cursor: 'pointer',
    fontWeight: 'bold' as const,
  },
  tabBtnActive: {
    background: colors.bgPanel,
    borderStyle: 'solid' as const,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderBottomWidth: 0,
    color: colors.brandYellow,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  formGroup: {
    marginBottom: '15px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    marginBottom: '8px',
    color: '#333',
  },
  input: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    marginTop: '5px',
    fontFamily: 'Arial, sans-serif',
  },
  textarea: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    marginTop: '5px',
    minHeight: '60px',
    resize: 'vertical' as const,
    fontFamily: 'Arial, sans-serif',
  },
  addItemButton: {
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '10px',
  },
  itemCard: {
    backgroundColor: '#f8f9fa',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '10px',
    marginBottom: '10px',
  },
  itemRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    marginBottom: '8px',
  },
  removeButton: {
    backgroundColor: '#F44336',
    color: 'white',
    border: 'none',
    padding: '8px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  itemInfo: {
    backgroundColor: '#e8f5e9',
    padding: '10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    color: '#2e7d32',
    border: '1px solid #4CAF50',
    marginTop: '8px',
    textAlign: 'left' as const,
    wordBreak: 'break-word' as const,
  },
  modalActions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
    marginTop: '20px',
  },
  saveButton: {
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  primaryButton: {
    backgroundColor: '#ffc107',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'background-color 0.15s ease-in-out',
  },
  cancelButton: {
    backgroundColor: '#666',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  suggestionsBox: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '4px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    maxHeight: '200px',
    overflow: 'auto',
    zIndex: 1000,
  },
  suggestionItem: {
    padding: '10px',
    cursor: 'pointer',
    borderBottom: '1px solid #eee',
    fontSize: '14px',
    backgroundColor: 'white',
  },
  modalBackdrop: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.65)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  modalWrapper: {
    backgroundColor: '#101215',
    borderRadius: 16,
    width: '95%',
    maxWidth: 1440,
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 24px 72px rgba(0,0,0,0.45)',
  },
  modalHeaderModern: {
    padding: '20px 24px',
    background: 'linear-gradient(90deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.95) 100%)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  modalCloseButton: {
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.2)',
    width: 36,
    height: 36,
    borderRadius: '50%',
    fontSize: 20,
    fontWeight: 700,
    cursor: 'pointer',
  },
  actionGhostButton: {
    background: 'transparent',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.2)',
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  modalBodyModern: {
    display: 'grid',
    gridTemplateColumns: '360px minmax(0, 1fr)',
    gap: 24,
    padding: 24,
    overflow: 'auto',
  },
  modalSidebar: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  modalContentArea: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 20,
  },
  sectionCard: {
    background: 'rgba(15,23,42,0.7)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '16px 18px',
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
    color: colors.brandYellow,
    marginBottom: 12,
  },
  sectionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
    flexWrap: 'wrap' as const,
  },
  sectionDivider: {
    height: 1,
    background: 'rgba(255,255,255,0.08)',
    margin: '6px 0 4px',
  },
  sectionStatGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 10,
    width: '100%',
  },
  sectionStatCard: {
    background: 'rgba(15,23,42,0.5)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  sectionStatLabel: {
    fontSize: 11,
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
    color: colors.textSecondary,
  },
  sectionStatValue: {
    fontSize: 14,
    fontWeight: 600,
    color: '#f8fafc',
  },
  sectionStatValueHighlight: {
    fontSize: 16,
    fontWeight: 700,
    color: colors.brandYellow,
  },
  sectionBadgeWarn: {
    marginTop: 6,
    padding: '6px 10px',
    borderRadius: 8,
    background: 'rgba(251, 191, 36, 0.18)',
    border: '1px solid rgba(251, 191, 36, 0.35)',
    color: colors.statusWarn,
    fontSize: 12,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  sectionStatusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.25)',
    background: 'transparent',
    color: '#fff',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: '0.5px',
    minWidth: 90,
    textAlign: 'center' as const,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressBarValue: {
    height: '100%',
    background: 'linear-gradient(90deg, #4ade80, #22c55e)',
    borderRadius: 999,
  },
  primaryActionButton: {
    background: '#ffc107',
    color: '#000',
    border: 'none',
    padding: '10px 16px',
    borderRadius: 8,
    fontWeight: 600,
    cursor: 'pointer',
  },
  tabHeader: {
    display: 'flex',
    gap: 10,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    paddingBottom: 4,
  },
  tabModern: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    padding: '8px 14px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  tabModernActive: {
    background: 'rgba(255, 193, 7, 0.12)',
    borderColor: 'rgba(255, 193, 7, 0.6)',
    color: colors.brandYellow,
  },
  tabContent: {
    background: 'rgba(15,23,42,0.65)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 18,
    color: '#fff',
  },
  itemsModernTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  smallDangerButton: {
    background: '#ff4d4f',
    color: '#fff',
    border: 'none',
    padding: '6px 10px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  photoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 12,
  },
  photoCard: {
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    overflow: 'hidden',
    background: 'rgba(15,23,42,0.65)',
  },
  photoImage: {
    width: '100%',
    height: 160,
    objectFit: 'cover' as const,
  },
  photoInfo: {
    padding: 12,
    color: '#fff',
  },
  progressWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  progressTrack: {
    width: 110,
    height: 8,
    backgroundColor: colors.borderCard,
    borderRadius: 4,
    overflow: 'hidden' as const,
  },
  progressValue: {
    height: '100%',
    backgroundColor: colors.brandYellow,
    borderRadius: 4,
    transition: 'width 0.2s ease',
  },
  progressLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    minWidth: 32,
    textAlign: 'right' as const,
  },
};

function PutawayTab({ document, onApplySuggestion }: { document: any; onApplySuggestion: (itemId: number, locationCode: string, quantity: number) => Promise<void> }) {
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [suggestions, setSuggestions] = useState<Record<number, any>>({});

  const loadSuggestion = async (itemId: number) => {
    if (suggestions[itemId]) return; // Already loaded
    setLoading({ ...loading, [itemId]: true });
    try {
      const data = await apiClient.get(`/putaway/suggestions/${itemId}`);
      setSuggestions({ ...suggestions, [itemId]: data });
    } catch (e: any) {
      console.error('Failed to load suggestion:', e);
    } finally {
      setLoading({ ...loading, [itemId]: false });
    }
  };

  if (!document) return null;

  const itemsWithQuantity = (document.items || []).filter((it: any) => {
    const remaining = (it.expected_quantity || 0) - (it.received_quantity || 0);
    return remaining > 0;
  });

  return (
    <div>
      <h4>Predlog smještanja (PUT-AWAY)</h4>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {itemsWithQuantity.length === 0 ? (
          <div style={{ color: '#777', padding: 20, textAlign: 'center' }}>
            Sve stavke su već postavljene ili nema stavki za smještanje.
          </div>
        ) : (
          itemsWithQuantity.map((item: any) => {
            const remaining = (item.expected_quantity || 0) - (item.received_quantity || 0);
            const sugg = suggestions[item.id];
            const isLoading = loading[item.id];

            return (
                      <div key={item.id} style={{ border: '1px solid #ffc107', borderRadius: 8, padding: 16, background: '#0a0a0a', color:'#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{item.item?.sku} - {item.item?.name}</div>
                    <div style={{ color: '#666', fontSize: 14, marginTop: 4 }}>
                      Količina za smještanje: {remaining} {item.quantity_uom || 'KOM'}
                    </div>
                  </div>
                  <button
                    onClick={() => loadSuggestion(item.id)}
                    disabled={isLoading}
                    style={{
                      padding: '8px 16px',
                      background: isLoading ? '#ccc' : '#ffc107',
                      color: '#000',
                      border: 'none',
                      borderRadius: 6,
                      fontWeight: 600,
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isLoading ? 'Učitavanje...' : sugg ? 'Osveži' : 'Predloži lokacije'}
                  </button>
                </div>

                {sugg && sugg.candidates && sugg.candidates.length > 0 && (
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {sugg.candidates.map((cand: any, idx: number) => {
                      const isBest = idx === 0;
                      const hasCapacityWarning = cand.capacity_free < remaining * 0.5;
                      return (
                        <div
                          key={idx}
                          style={{
                            border: `2px solid ${isBest ? '#4CAF50' : '#ddd'}`,
                            borderRadius: 6,
                            padding: 12,
                            background: '#0a0a0a',
                            position: 'relative',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{
                                background: isBest ? '#4CAF50' : '#ddd',
                                color: isBest ? '#fff' : '#000',
                                padding: '4px 8px',
                                borderRadius: 4,
                                fontSize: 12,
                                fontWeight: 700,
                              }}>
                                {cand.score}%
                              </span>
                              <span style={{ fontWeight: 700, fontSize: 16 }}>{cand.location_code}</span>
                              <span style={{ color: '#666', fontSize: 13 }}>
                                ({cand.zone || 'N/A'} / {cand.rack || 'N/A'} / {cand.level || 'N/A'})
                              </span>
                            </div>
                            <button
                              onClick={() => onApplySuggestion(item.id, cand.location_code, remaining)}
                              style={{
                                padding: '6px 12px',
                                background: '#4CAF50',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 4,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              PRIHVATI
                            </button>
                          </div>
                          {hasCapacityWarning && (
                            <div style={{ color: '#FB8C00', fontSize: 12, marginBottom: 4 }}>
                              ⚠️ Skoro pun kapacitet
                            </div>
                          )}
                          <div style={{ fontSize: 12, color: '#666' }}>
                            {cand.reason.map((r: string, i: number) => (
                              <div key={i}>• {r}</div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const storeOptions = [
  'Mp Bar',
  'Mp Bar Centar',
  'Mp Bijelo Polje',
  'Mp Berane',
  'Mp Budva',
  'Mp Kotor',
  'Mp Herceg Novi',
  'Mp Sutorina',
  'Mp Niksic',
  'Mp Podgorica',
  'Mp Podgorica Centar',
  'Mp Ulcinj',
  'Mp Ulcinj Centar',
  'Veleprodajni Magacin',
  'Carinsko Skladiste',
];

function ProgressMeter({ value }: { value: number }) {
  const pct = clampPercentage(value);
  return (
    <div style={styles.progressWrapper}>
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressValue, width: `${pct}%` }} />
      </div>
      <span style={styles.progressLabel}>{pct}%</span>
    </div>
  );
}

