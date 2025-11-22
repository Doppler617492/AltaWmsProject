import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../lib/apiClient';

type Mode = 'view' | 'create';

interface PovracajModalProps {
  mode: Mode;
  document?: any;
  onClose: () => void;
  onSaved: () => void;
  canReceive: boolean;
  canCreate: boolean;
  canDelete?: boolean;
  canAssign?: boolean;
  userRole: string;
}

interface DraftItem {
  code: string;
  name: string;
  qty: number;
  reason: string;
  note?: string;
}

const emptyItem: DraftItem = {
  code: '',
  name: '',
  qty: 1,
  reason: '',
};

function translatePovracajStatus(status: string): string {
  const map: Record<string, string> = {
    'SUBMITTED': 'SUBMITOVANO',
    'RECEIVED': 'PRIMLJENO',
    'submitted': 'SUBMITOVANO',
    'received': 'PRIMLJENO',
  };
  return map[status] || status;
}

export default function PovracajModal({ mode, document, onClose, onSaved, canReceive, canCreate, canDelete = false, canAssign = false, userRole }: PovracajModalProps) {
  const [stores, setStores] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    storeId: document?.storeId || '',
    note: document?.note || '',
  });
  const [items, setItems] = useState<DraftItem[]>(document?.items?.map((i: any) => ({
    code: i.code,
    name: i.name,
    qty: Number(i.qty) || 0,
    reason: i.reason,
    note: i.note || '',
  })) || [{ ...emptyItem }]);
  const [receiveItems, setReceiveItems] = useState<{ code: string; receivedQty: number }[]>(document?.items?.map((i: any) => ({
    code: i.code,
    receivedQty: typeof i.receivedQty === 'number' && !Number.isNaN(i.receivedQty) ? i.receivedQty : Number(i.qty) || 0,
  })) || []);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [base64Photos, setBase64Photos] = useState<string[]>([]);
  const [activeDoc, setActiveDoc] = useState<any>(document || null);

  useEffect(() => {
    if (mode === 'view' && document?.uid) {
      refreshDocument();
    }
    if (mode === 'create' || canCreate) {
      loadStores();
    }
    if (canAssign && mode === 'view') {
      loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document?.uid, mode, canAssign]);

  const summaryTotals = useMemo(() => {
    if (!activeDoc) return { declared: 0, received: 0 };
    const declared = (activeDoc.items || []).reduce((acc: number, item: any) => acc + (Number(item.qty) || 0), 0);
    const received = (activeDoc.items || []).reduce((acc: number, item: any) => acc + (Number(item.receivedQty ?? item.received_qty ?? 0) || 0), 0);
    return { declared, received };
  }, [activeDoc]);

  async function loadStores() {
    try {
      const data = await apiClient.get('/stores');
      setStores(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Neuspešno učitavanje prodavnica.');
    }
  }

  async function loadUsers() {
    try {
      const data = await apiClient.get('/users');
      // Filtriraj samo magacionere
      const magacioneri = Array.isArray(data) ? data.filter((u: any) => 
        ['magacioner', 'warehouse', 'admin', 'menadzer', 'sef'].includes(u.role?.toLowerCase() || '')
      ) : [];
      setUsers(magacioneri);
    } catch (e: any) {
      console.error('Neuspešno učitavanje korisnika:', e);
      setUsers([]);
    }
  }

  async function handleAssign(assignedToUserId: number | null) {
    if (!activeDoc?.uid) return;
    setAssigning(true);
    setError(null);
    try {
      await apiClient.assignPovracajDocument(activeDoc.uid, assignedToUserId);
      await refreshDocument();
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Dodeljivanje naloga nije uspelo.');
    } finally {
      setAssigning(false);
    }
  }

  function handlePrintDocument() {
    if (!activeDoc) return;

    const logoUrl = `${window.location.origin}/logo.svg`;
    const statusLabel = translatePovracajStatus(activeDoc.status);
    const statusColor = activeDoc.status === 'RECEIVED' ? '#15803d' : '#ca8a04';

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const totalQty = (activeDoc.items || []).reduce((sum: number, item: any) => sum + (Number(item.qty) || 0), 0);
    const totalReceived = (activeDoc.items || []).reduce((sum: number, item: any) => {
      const received = item.receivedQty !== null && item.receivedQty !== undefined 
        ? Number(item.receivedQty) 
        : (item.received_qty !== null && item.received_qty !== undefined 
          ? Number(item.received_qty) 
          : 0);
      return sum + received;
    }, 0);

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>POVRAĆAJ dokument - ${activeDoc.uid}</title>
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
              flex-wrap: wrap;
              gap: 15px;
            }
            .document-info div {
              font-size: 11px;
            }
            .document-info strong {
              display: block;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .store-info {
              margin: 20px 0;
              padding: 15px;
              border: 2px solid #000;
              background: #f9f9f9;
            }
            .store-info h3 {
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
              vertical-align: top;
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
              background: ${statusColor};
              color: #fff;
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
            .reason-cell {
              font-weight: 600;
              color: #dc2626;
            }
            .note-cell {
              font-style: italic;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <h1>POVRAĆAJ DOKUMENT</h1>
              <img src="${logoUrl}" alt="Alta WMS" style="height:42px;" />
            </div>
            <div class="document-info">
              <div>
                <strong>UID:</strong>
                ${activeDoc.uid}
              </div>
              <div>
                <strong>Datum kreiranja:</strong>
                ${formatDate(activeDoc.createdAt)}
              </div>
              <div>
                <strong>Status:</strong>
                <span class="status-badge">${statusLabel}</span>
              </div>
              ${activeDoc.receivedAt ? `
              <div>
                <strong>Datum primanja:</strong>
                ${formatDate(activeDoc.receivedAt)}
              </div>
              ` : ''}
            </div>
          </div>

          <div class="store-info">
            <h3>Podaci o dokumentu</h3>
            <div><strong>Prodavnica:</strong> ${activeDoc.storeName || '—'}</div>
            ${activeDoc.note ? `<div style="margin-top:8px;"><strong>Napomena:</strong> ${activeDoc.note.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
            ${activeDoc.createdBy ? `<div style="margin-top:8px;"><strong>Kreirao:</strong> Korisnik ID #${activeDoc.createdBy}</div>` : ''}
            ${activeDoc.receivedBy ? `<div style="margin-top:8px;"><strong>Primio:</strong> Korisnik ID #${activeDoc.receivedBy}</div>` : ''}
            ${activeDoc.assignedToUserId ? `<div style="margin-top:8px;"><strong>Dodeljeno magacioneru:</strong> Korisnik ID #${activeDoc.assignedToUserId}</div>` : ''}
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th style="width: 5%;">#</th>
                  <th style="width: 15%;">Šifra</th>
                  <th style="width: 25%;">Naziv artikla</th>
                  <th style="width: 10%;">Količina</th>
                  <th style="width: 15%;">Razlog POVRAĆAJ-a</th>
                  <th style="width: 15%;">Napomena</th>
                  <th style="width: 10%;">Primljeno</th>
                  <th style="width: 5%;">Foto</th>
                </tr>
              </thead>
              <tbody>
                ${(activeDoc.items || []).map((item: any, index: number) => {
                  const receivedQty = item.receivedQty !== null && item.receivedQty !== undefined 
                    ? Number(item.receivedQty) 
                    : (item.received_qty !== null && item.received_qty !== undefined 
                      ? Number(item.received_qty) 
                      : (activeDoc.status === 'RECEIVED' ? Number(item.qty) : 0));
                  const hasPhotos = item.photos && item.photos.length > 0;
                  return `
                    <tr>
                      <td>${index + 1}</td>
                      <td><strong>${(item.code || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</strong></td>
                      <td><strong>${(item.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</strong></td>
                      <td style="text-align: center;">${Number(item.qty || 0).toLocaleString('sr-Latn-RS')}</td>
                      <td class="reason-cell" style="text-align: center;">${(item.reason || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                      <td class="note-cell" style="text-align: left;">${item.note ? item.note.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '—'}</td>
                      <td style="text-align: center;">${activeDoc.status === 'RECEIVED' ? receivedQty.toLocaleString('sr-Latn-RS') : '—'}</td>
                      <td style="text-align: center;">${hasPhotos ? '✓' : '—'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <div class="totals">
            <strong>Ukupno stavki: ${(activeDoc.items || []).length}</strong>
            <strong>Ukupno količina (POVRAĆAJ): ${totalQty.toLocaleString('sr-Latn-RS')} kom</strong>
            ${activeDoc.status === 'RECEIVED' ? `<strong>Ukupno primljeno: ${totalReceived.toLocaleString('sr-Latn-RS')} kom</strong>` : ''}
            <strong>Razlozi POVRAĆAJ-a: ${[...new Set((activeDoc.items || []).map((i: any) => i.reason).filter(Boolean))].join(', ')}</strong>
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
  }

  async function refreshDocument() {
    if (!document?.uid) return;
    try {
      setIsLoading(true);
      const fresh = await apiClient.getPovracajDocument(document.uid);
      setActiveDoc(fresh);
      setForm({ storeId: fresh.storeId, note: fresh.note || '' });
      setItems(
        (fresh.items || []).map((i: any) => ({
          code: i.code,
          name: i.name,
          qty: Number(i.qty) || 0,
          reason: i.reason,
          note: i.note || '',
        })),
      );
      setReceiveItems(
        (fresh.items || []).map((i: any) => ({
          code: i.code,
          receivedQty: typeof i.receivedQty === 'number' ? i.receivedQty : (typeof i.received_qty === 'number' ? i.received_qty : Number(i.qty) || 0),
        })),
      );
    } catch (e: any) {
      setError(e?.message || 'Neuspešno osvežavanje dokumenta.');
    } finally {
      setIsLoading(false);
    }
  }

  function updateItem(index: number, key: keyof DraftItem, value: string) {
    const next = [...items];
    if (key === 'qty') {
      const numeric = Number(value);
      next[index][key] = Number.isNaN(numeric) ? 0 : numeric;
    } else {
      next[index][key] = value;
    }
    setItems(next);
  }

  function addItem() {
    setItems((prev) => [...prev, { ...emptyItem }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function handleCreate() {
    if (!canCreate) {
      setError('Nemate dozvolu za kreiranje POVRAĆAJ dokumenta.');
      return;
    }
    if (!form.storeId) {
      setError('Izaberite prodavnicu.');
      return;
    }
    const cleanedItems = items
      .map((item) => ({
        code: item.code.trim(),
        name: item.name.trim(),
        qty: Number(item.qty),
        reason: item.reason.trim(),
        note: item.note?.trim() || undefined,
      }))
      .filter((item) => item.code && item.name && item.qty > 0 && item.reason);
    if (!cleanedItems.length) {
      setError('Dodajte bar jednu validnu stavku. Potrebni su kod, naziv, količina i razlog.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await apiClient.createPovracajDocument({
        storeId: Number(form.storeId),
        note: form.note || undefined,
        items: cleanedItems,
        photos: base64Photos.length ? base64Photos : undefined,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Kreiranje nije uspelo.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReceive() {
    if (!activeDoc?.uid) return;
    setError(null);
    const payload = receiveItems.map((line) => ({
      code: line.code,
      receivedQty: Number(line.receivedQty) || 0,
    }));
    setIsLoading(true);
    try {
      await apiClient.receivePovracaj(activeDoc.uid, {
        items: payload,
        note: form.note || undefined,
      });
      await refreshDocument();
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Prijem nije uspeo.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!activeDoc?.uid) return;
    const files = event.target.files;
    if (!files || !files.length) return;
    setUploading(true);
    setPhotoError(null);
    try {
      await apiClient.uploadPovracajPhoto(activeDoc.uid, files[0]);
      await refreshDocument();
    } catch (e: any) {
      setPhotoError(e?.message || 'Otpremanje slike nije uspelo.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  async function handleBase64Select(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || !files.length) return;
    const list: string[] = [];
    for (const file of Array.from(files)) {
      const encoded = await fileToBase64(file);
      list.push(encoded);
    }
    setBase64Photos(list);
  }

  function updateReceive(index: number, value: string) {
    const next = [...receiveItems];
    const numeric = Number(value);
    next[index] = {
      ...next[index],
      receivedQty: Number.isNaN(numeric) ? 0 : numeric,
    };
    setReceiveItems(next);
  }

  const modalTitle = mode === 'create' ? 'Novi POVRAĆAJ dokument' : `POVRAĆAJ ${activeDoc?.uid || ''}`;

  return (
    <div style={styles.backdrop}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>{modalTitle}</h2>
            {mode === 'view' && activeDoc && (
              <div style={styles.badgeRow}>
                <span style={{ ...styles.badge, background: activeDoc.status === 'RECEIVED' ? '#15803d' : '#ca8a04' }}>
                  {translatePovracajStatus(activeDoc.status)}
                </span>
                <span style={styles.meta}>Prodavnica: {activeDoc.storeName || 'N/A'}</span>
                <span style={styles.meta}>Deklarisano: {summaryTotals.declared.toLocaleString('sr-Latn-RS')}</span>
                <span style={styles.meta}>Primljeno: {summaryTotals.received.toLocaleString('sr-Latn-RS')}</span>
              </div>
            )}
          </div>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {photoError && <div style={styles.error}>{photoError}</div>}

        {mode === 'create' && (
          <>
            <div style={styles.fieldGrid}>
              <label style={styles.label}>
                Prodavnica
                <select
                  value={form.storeId}
                  onChange={(e) => setForm((prev) => ({ ...prev, storeId: e.target.value }))}
                  style={styles.select}
                >
                  <option value="">-- Izaberi --</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </select>
              </label>
              <label style={styles.label}>
                Napomena
                <textarea
                  value={form.note}
                  onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                  style={styles.textarea}
                  placeholder="Dodatne informacije (opciono)"
                />
              </label>
            </div>

            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle}>Stavke ({items.length})</h3>
                <button style={styles.secondaryBtn} onClick={addItem}>+ Dodaj stavku</button>
              </div>
              <div>
                {items.map((item, index) => (
                  <div key={index} style={styles.itemRow}>
                    <input
                      value={item.code}
                      onChange={(e) => updateItem(index, 'code', e.target.value)}
                      placeholder="Šifra"
                      style={styles.input}
                    />
                    <input
                      value={item.name}
                      onChange={(e) => updateItem(index, 'name', e.target.value)}
                      placeholder="Naziv"
                      style={styles.input}
                    />
                    <input
                      value={item.qty}
                      onChange={(e) => updateItem(index, 'qty', e.target.value)}
                      placeholder="Količina"
                      style={styles.input}
                      type="number"
                      min="0"
                    />
                    <input
                      value={item.reason}
                      onChange={(e) => updateItem(index, 'reason', e.target.value)}
                      placeholder="Razlog"
                      style={styles.input}
                    />
                    <input
                      value={item.note || ''}
                      onChange={(e) => updateItem(index, 'note', e.target.value)}
                      placeholder="Napomena (opciono)"
                      style={styles.input}
                    />
                    <button style={styles.removeBtn} onClick={() => removeItem(index)}>Ukloni</button>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Fotografije (opciono)</h3>
              <input type="file" accept="image/*" multiple onChange={handleBase64Select} />
              {base64Photos.length > 0 && (
                <p style={styles.meta}>Izabrano {base64Photos.length} fotografija (biće sačuvane prilikom kreiranja).</p>
              )}
            </div>

            <div style={styles.footer}>
              <button style={styles.primaryBtn} onClick={handleCreate} disabled={isLoading || !canCreate}>
                {isLoading ? 'Čuvanje...' : 'Kreiraj POVRAĆAJ'}
              </button>
              <button style={styles.cancelBtn} onClick={onClose}>Otkaži</button>
            </div>
          </>
        )}

        {mode === 'view' && activeDoc && (
          <>
            <div style={styles.infoGrid}>
              <div>
                <div style={styles.infoLabel}>UID</div>
                <div style={styles.infoValue}>{activeDoc.uid}</div>
              </div>
              <div>
                <div style={styles.infoLabel}>Prodavnica</div>
                <div style={styles.infoValue}>{activeDoc.storeName || 'N/A'}</div>
              </div>
              <div>
                <div style={styles.infoLabel}>Kreirano</div>
                <div style={styles.infoValue}>{formatDate(activeDoc.createdAt)}</div>
              </div>
              <div>
                <div style={styles.infoLabel}>Primljeno</div>
                <div style={styles.infoValue}>{activeDoc.receivedAt ? formatDate(activeDoc.receivedAt) : '-'}</div>
              </div>
            </div>

            <label style={styles.label}>
              Napomena
              <textarea
                value={form.note}
                onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                style={styles.textarea}
                placeholder="Napomena o dokumentu"
              />
            </label>

            <div style={{ ...styles.section, overflowX: 'auto' }}>
              <h3 style={styles.sectionTitle}>Stavke</h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Šifra</th>
                    <th style={styles.th}>Naziv</th>
                    <th style={styles.th}>Količina</th>
                    <th style={styles.th}>Razlog</th>
                    <th style={styles.th}>Napomena</th>
                    <th style={styles.th}>Primljeno</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeDoc.items || []).map((item: any, index: number) => (
                    <tr key={item.id}>
                      <td style={styles.td}>{item.code}</td>
                      <td style={styles.td}>
                        <div>{item.name}</div>
                        {item.photos && item.photos.length > 0 && (
                          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {item.photos.map((photo: any) => {
                              const photoUrl = photo.path?.startsWith('http') 
                                ? photo.path 
                                : `http://localhost:8000${photo.path}`;
                              return (
                                <a
                                  key={photo.id}
                                  href={photoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ display: 'inline-block' }}
                                >
                                  <img
                                    src={photoUrl}
                                    alt={`Foto ${photo.id}`}
                                    style={{
                                      width: 80,
                                      height: 80,
                                      objectFit: 'cover',
                                      borderRadius: 8,
                                      border: '2px solid #FFC300',
                                      cursor: 'pointer',
                                    }}
                                    onError={(e: any) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td style={styles.td}>{Number(item.qty).toLocaleString('sr-Latn-RS')}</td>
                      <td style={styles.td}>{item.reason}</td>
                      <td style={styles.td}>{item.note || '-'}</td>
                      <td style={styles.td}>
                        {activeDoc.status === 'RECEIVED' || !canReceive ? (
                          item.receivedQty !== null && item.receivedQty !== undefined
                            ? Number(item.receivedQty).toLocaleString('sr-Latn-RS')
                            : (item.received_qty !== null && item.received_qty !== undefined
                              ? Number(item.received_qty).toLocaleString('sr-Latn-RS')
                              : '-')
                        ) : (
                          <input
                            type="number"
                            min="0"
                            style={styles.input}
                            value={receiveItems[index]?.receivedQty ?? 0}
                            onChange={(e) => updateReceive(index, e.target.value)}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(activeDoc.photos && activeDoc.photos.length > 0) && (
              <div style={styles.section}>
                <div style={styles.sectionHeader}>
                  <h3 style={styles.sectionTitle}>Fotografije dokumenta (legacy)</h3>
                  {(canReceive || ['admin', 'menadzer', 'sef'].includes(userRole)) && (
                    <label style={styles.secondaryBtn}>
                      {uploading ? 'Otpremanje...' : '+ Dodaj fotografiju'}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        disabled={uploading}
                        onChange={handlePhotoUpload}
                      />
                    </label>
                  )}
                </div>
                <div style={styles.photoGrid}>
                  {activeDoc.photos.map((photo: any) => {
                    const photoUrl = photo.path?.startsWith('http') 
                      ? photo.path 
                      : `http://localhost:8000${photo.path}`;
                    return (
                      <a key={photo.id} href={photoUrl} target="_blank" rel="noreferrer" style={styles.photoCard}>
                        <img 
                          src={photoUrl} 
                          alt="Povracaj" 
                          style={styles.photo}
                          onError={(e: any) => {
                            e.target.style.display = 'none';
                          }}
                        />
                        <div style={styles.photoMeta}>{formatDate(photo.uploadedAt)}</div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {canAssign && activeDoc.status === 'SUBMITTED' && (
              <div style={styles.section}>
                <div style={styles.sectionHeader}>
                  <h3 style={styles.sectionTitle}>Dodeli magacioneru</h3>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  {activeDoc.assignedToUserId && (
                    <div style={styles.meta}>
                      Trenutno dodeljeno korisniku ID: {activeDoc.assignedToUserId}
                    </div>
                  )}
                  <select
                    value={activeDoc.assignedToUserId || ''}
                    onChange={(e) => handleAssign(e.target.value ? parseInt(e.target.value, 10) : null)}
                    style={styles.select}
                    disabled={assigning}
                  >
                    <option value="">-- Nije dodeljeno --</option>
                    {users.map((user: any) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name || user.name} ({user.role})
                      </option>
                    ))}
                  </select>
                  {assigning && <span style={styles.meta}>Dodeljivanje...</span>}
                </div>
              </div>
            )}

            <div style={styles.footer}>
              <div style={{ display: 'flex', gap: 12, flex: 1 }}>
                <button style={styles.secondaryBtn} onClick={handlePrintDocument}>
                  Štampaj nalog
                </button>
                {activeDoc.status === 'SUBMITTED' && canReceive && (
                  <button style={styles.primaryBtn} onClick={handleReceive} disabled={isLoading}>
                    {isLoading ? 'Obrada...' : 'Završi prijem POVRAĆAJ-a'}
                  </button>
                )}
                {canDelete && (
                  <button
                    style={{ ...styles.cancelBtn, background: '#dc2626', color: '#fff', border: 'none' }}
                    onClick={async () => {
                      if (!window.confirm('Da li ste sigurni da želite da obrišete ovaj POVRAĆAJ dokument? Ova akcija je nepovratna.')) {
                        return;
                      }
                      setIsLoading(true);
                      setError(null);
                      try {
                        await apiClient.deletePovracajDocument(activeDoc.uid);
                        onSaved();
                        onClose();
                      } catch (e: any) {
                        setError(e?.message || 'Brisanje dokumenta nije uspelo.');
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading}
                  >
                    Obriši
                  </button>
                )}
              </div>
              <button style={styles.cancelBtn} onClick={onClose}>Zatvori</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatDate(date: string | Date) {
  const value = date instanceof Date ? date : new Date(date);
  return value.toLocaleString('sr-Latn-RS');
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const styles: Record<string, any> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
  },
  modal: {
    background: '#0f172a',
    color: '#e2e8f0',
    width: '100%',
    maxWidth: 980,
    maxHeight: '90vh',
    overflowY: 'auto',
    borderRadius: 18,
    padding: 28,
    boxShadow: '0 25px 65px rgba(15,23,42,0.55)',
    border: '1px solid rgba(148,163,184,0.25)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    color: '#facc15',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#f8fafc',
    fontSize: 28,
    cursor: 'pointer',
    lineHeight: 1,
  },
  badgeRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  badge: {
    padding: '4px 12px',
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 12,
    color: '#0f172a',
  },
  meta: {
    fontSize: 13,
    color: '#94a3b8',
  },
  error: {
    background: 'rgba(220, 38, 38, 0.2)',
    border: '1px solid rgba(220,38,38,0.4)',
    borderRadius: 8,
    padding: '10px 16px',
    marginBottom: 14,
    color: '#fecaca',
  },
  fieldGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flex: '1',
    fontSize: 13,
    color: '#cbd5f5',
  },
  select: {
    background: '#1e293b',
    color: '#f1f5f9',
    borderRadius: 10,
    border: '1px solid rgba(148,163,184,0.25)',
    padding: '10px 12px',
  },
  textarea: {
    background: '#1e293b',
    color: '#f1f5f9',
    borderRadius: 10,
    border: '1px solid rgba(148,163,184,0.25)',
    padding: '10px 12px',
    minHeight: 90,
    resize: 'vertical' as const,
  },
  section: {
    background: 'rgba(15,23,42,0.65)',
    borderRadius: 14,
    border: '1px solid rgba(148,163,184,0.2)',
    padding: 16,
    marginBottom: 20,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: '#facc15',
  },
  itemRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(120px, 1fr)) 80px',
    gap: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  input: {
    background: '#1e293b',
    color: '#f1f5f9',
    borderRadius: 10,
    border: '1px solid rgba(148,163,184,0.25)',
    padding: '10px 12px',
    fontSize: 13,
  },
  removeBtn: {
    background: 'rgba(220,38,38,0.2)',
    border: '1px solid rgba(220,38,38,0.5)',
    color: '#fecaca',
    borderRadius: 10,
    padding: '8px 10px',
    cursor: 'pointer',
  },
  footer: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 24,
  },
  primaryBtn: {
    background: '#facc15',
    color: '#0f172a',
    fontWeight: 800,
    border: 'none',
    borderRadius: 12,
    padding: '12px 20px',
    cursor: 'pointer',
    minWidth: 180,
  },
  secondaryBtn: {
    background: 'rgba(250,204,21,0.15)',
    border: '1px solid rgba(250,204,21,0.4)',
    color: '#fde68a',
    borderRadius: 12,
    padding: '8px 14px',
    cursor: 'pointer',
    fontSize: 13,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  },
  cancelBtn: {
    background: 'transparent',
    border: '1px solid rgba(148,163,184,0.25)',
    color: '#cbd5f5',
    borderRadius: 12,
    padding: '12px 20px',
    cursor: 'pointer',
    minWidth: 140,
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 14,
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#94a3b8',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: 600,
    color: '#f8fafc',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  th: {
    textAlign: 'left' as const,
    padding: '12px 16px',
    borderBottom: '2px solid rgba(148,163,184,0.3)',
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    background: 'rgba(15,23,42,0.5)',
  },
  td: {
    padding: '12px 16px',
    borderBottom: '1px solid rgba(148,163,184,0.15)',
    color: '#e2e8f0',
    fontSize: 14,
    verticalAlign: 'middle' as const,
  },
  photoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
  },
  photoCard: {
    display: 'block',
    background: '#1e293b',
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid rgba(148,163,184,0.25)',
    textDecoration: 'none',
  },
  photo: {
    width: '100%',
    height: 120,
    objectFit: 'cover' as const,
    display: 'block',
  },
  photoMeta: {
    padding: '8px 10px',
    fontSize: 12,
    color: '#cbd5f5',
  },
};


