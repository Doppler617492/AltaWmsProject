// Quick local parser for Pantheon MP kalkulacija files
// Usage: node backend/scripts/parse-shipping-file.js "Uploads/yourfile.xlsx"
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

function normalize(s) { return (s ?? '').toString().trim().toLowerCase(); }

function parse(filePath) {
  const buf = fs.readFileSync(filePath);
  const wb = xlsx.read(buf, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true });

  let documentNumber = '';
  let receiverStore = '';
  let issuerStore = '';
  let responsiblePerson = '';
  let documentDate = null;

  // Detect possible PRENOS layout hint
  let isPrenos = false;
  if (data[1] && data[1][0] && data[1][0].toString().toUpperCase().includes('PRENOS')) isPrenos = true;

  if (isPrenos) {
    if (data[3]) {
      documentNumber = data[3][0]?.toString().trim() || '';
      receiverStore = data[3][9]?.toString().trim() || '';
    }
  }

  if (!documentNumber) {
    outer: for (let r = 0; r < Math.min(10, data.length); r++) {
      for (let c = 0; c < (data[r]?.length || 0); c++) {
        const v = data[r][c];
        if (!v) continue;
        const s = v.toString();
        if (/\d{2}-\d{2}[A-Z]{2}-\d{6}/.test(s) || /\d{2}-\d{2}[A-Za-z]{2}-\d{6}/.test(s)) {
          documentNumber = s.trim();
          break outer;
        }
      }
    }
  }
  if (!documentNumber) documentNumber = path.basename(filePath).replace(/\.[^.]+$/, '');

  const findRightNeighbor = (label) => {
    const needle = label.toLowerCase();
    for (let r = 0; r < Math.min(30, data.length); r++) {
      const row = data[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) {
        const s = normalize(row[c]);
        if (!s) continue;
        if (s === needle || s.includes(needle)) {
          for (let k = c + 1; k <= Math.min(c + 6, row.length - 1); k++) {
            const vv = row[k];
            if (vv && vv.toString().trim()) return vv.toString().trim();
          }
        }
      }
    }
    return '';
  };

  issuerStore = findRightNeighbor('izdavalac') || issuerStore;
  receiverStore = receiverStore || findRightNeighbor('primalac');
  const foundDt = findRightNeighbor('datum');
  if (foundDt) documentDate = foundDt;
  responsiblePerson = findRightNeighbor('odgovorna osoba') || responsiblePerson;

  // Auto header detect
  let headerRowIdx = -1;
  let colSku = -1, colName = -1, colQty = -1, colUom = -1;
  for (let r = 0; r < Math.min(30, data.length); r++) {
    const row = data[r];
    if (!Array.isArray(row)) continue;
    const lower = row.map(normalize);
    const has = (x, s) => (x || '').toString().includes(s);
    const skuIdx = lower.findIndex(x => has(x,'šifra') || has(x,'sifra') || has(x,'sku') || has(x,'šifra artikla') || has(x,'sifra artikla'));
    const nameIdx = lower.findIndex(x => has(x,'naziv') || (has(x,'artikl') && !has(x,'šifra')));
    const qtyIdx = lower.findIndex(x => has(x,'količ') || has(x,'kolic') || x === 'kol' || has(x,'qty'));
    const uomIdx = lower.findIndex(x => has(x,'jmj') || has(x,'jed') || has(x,'uom') || x === 'jm');
    if ((skuIdx !== -1 && nameIdx !== -1 && qtyIdx !== -1)) {
      headerRowIdx = r;
      colSku = skuIdx; colName = nameIdx; colQty = qtyIdx; colUom = uomIdx;
      break;
    }
  }
  if (headerRowIdx < 0) {
    headerRowIdx = isPrenos ? 4 : 11; // 0-based
    if (isPrenos) { colSku = 1; colName = 3; colQty = 11; colUom = -1; }
    else { colSku = 3; colName = 5; colQty = 9; colUom = 11; }
  }
  const startRow = headerRowIdx + 1;

  const lines = [];
  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    const n = row[0];
    if (!n || (typeof n !== 'string' && typeof n !== 'number')) continue;
    if (typeof n === 'string' && (n.toLowerCase().includes('ukupno') || n.toLowerCase().includes('total'))) break;
    const sku = (row[colSku] ?? '').toString().trim();
    const name = (row[colName] ?? '').toString().trim();
    const qty = Number(row[colQty] || 0);
    const rawUom = colUom !== -1 ? ((row[colUom] ?? '').toString().trim()) : '';
    const uom = rawUom && isNaN(Number(rawUom)) ? rawUom : 'KOM';
    if (sku && name && qty > 0) lines.push({ item_sku: sku, item_name: name, requested_qty: qty, uom });
  }

  return {
    order_number: documentNumber,
    issuer_name: issuerStore || null,
    customer_name: receiverStore || null,
    responsible_person: responsiblePerson || null,
    document_date: documentDate,
    detected_columns: { header_row: headerRowIdx, sku: colSku, name: colName, qty: colQty, uom: colUom },
    items_found: lines.length,
    lines,
  };
}

if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node backend/scripts/parse-shipping-file.js "Uploads/file.xlsx"');
    process.exit(1);
  }
  const res = parse(filePath);
  console.log(JSON.stringify(res, null, 2));
}

module.exports = { parse };
