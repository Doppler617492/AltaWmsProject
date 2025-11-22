// Local parser for Pantheon KCM/Kalkulacija prijema files
// Usage: node backend/scripts/parse-receiving-file.js "Uploads/<file>.xls[x]"
const fs = require('fs');
const xlsx = require('xlsx');

function norm(v){ return (v??'').toString().trim().toLowerCase(); }

function findRight(data, label){
  const needle = label.toLowerCase();
  for(let r=0;r<Math.min(60, data.length);r++){
    const row = data[r]; if(!Array.isArray(row)) continue;
    for(let c=0;c<row.length;c++){
      const raw = row[c];
      const s = norm(raw); if(!s) continue;
      if (s.includes(needle)){
        const maxRight = Math.min(c+12, row.length-1);
        for(let k=c+1;k<=maxRight;k++){
          const vv=row[k];
          if(vv && vv.toString().trim()) return vv.toString().trim();
        }
        for(let rr=r+1; rr<Math.min(r+8,data.length); rr++){
          const down = data[rr];
          if(Array.isArray(down)){
            const dv = down[c];
            if(dv && dv.toString().trim()) return dv.toString().trim();
          }
        }
      }
    }
  }
  return '';
}

function parse(filePath){
  const buf = fs.readFileSync(filePath);
  const wb = xlsx.read(buf, { type:'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(ws, { header:1, raw:true });

  let documentNumber = findRight(data,'prijemnica') || findRight(data,'broj dokumenta') || filePath.replace(/.*\/(.*)\..*$/, '$1');
  let supplierName = findRight(data,'dobavljač') || findRight(data,'dobavljac') || findRight(data,'supplier');
  let storeName = findRight(data,'trgovina') || '';
  let documentDate = findRight(data,'datum') || '';
  let responsible = findRight(data,'odgovorna osoba') || '';
  let invoice = findRight(data,'račun') || findRight(data,'racun') || findRight(data,'raèun') || '';

  let headerRow=-1, colSku=-1, colName=-1, colQty=-1, colUom=-1;
  for(let r=0;r<Math.min(60,data.length);r++){
    const row=data[r]; if(!Array.isArray(row)) continue; const low=row.map(norm);
    const has=(x,s)=>((x||'').toString().includes(s));
    const iSku = low.findIndex(x=> has(x,'ident') || has(x,'šifra') || has(x,'sifra') || has(x,'sku') || has(x,'code'));
    const iName = low.findIndex(x=> has(x,'naziv') || has(x,'name'));
    const iQty = low.findIndex(x=> has(x,'količ') || has(x,'kolic') || x==='kol' || has(x,'qty') || has(x,'kolicina'));
    const iUom = low.findIndex(x=> x==='jm' || has(x,'jmj') || has(x,'uom') || has(x,'jed'));
    if(iSku!==-1 && iName!==-1 && iQty!==-1){ headerRow=r; colSku=iSku; colName=iName; colQty=iQty; colUom=iUom; break; }
  }
  if(headerRow<0){ headerRow=10; colSku=2; colName=4; colQty=8; colUom=9; }

  function collect(cSku,cName,cQty,cUom){
    const out=[]; for(let i=headerRow+1;i<data.length;i++){ const row=data[i]; if(!Array.isArray(row)) continue; const sku=(row[cSku]??'').toString().trim(); const name=(row[cName]??'').toString().trim(); const qty=Number((row[cQty]??'').toString().replace(',','.'))||0; const uom=cUom!==-1 ? ((row[cUom]??'').toString().trim()||'KOM'):'KOM'; if(sku && name && qty>0) out.push({ item_sku: sku, item_name: name, requested_qty: qty, uom }); }
    return out;
  }
  let lines = collect(colSku,colName,colQty,colUom);
  if(lines.length===0){
    // Try common Pantheon KCM mappings
    const candidates = [ [1,3,9,11], [3,5,10,12], [2,4,8,9], [3,5,9,12] ];
    for(const [cs,cn,cq,cu] of candidates){ lines = collect(cs,cn,cq,cu); if(lines.length) { colSku=cs; colName=cn; colQty=cq; colUom=cu; break; } }
  }

  return { document_number: documentNumber, supplier_name: supplierName||null, store_name: storeName||null, document_date: documentDate||null, responsible_person: responsible||null, invoice_number: invoice||null, detected_columns:{ header_row: headerRow, sku: colSku, name: colName, qty: colQty, uom: colUom }, items_found: lines.length, lines };
}

if (require.main === module){
  const p = process.argv[2]; if(!p){ console.error('Usage: node backend/scripts/parse-receiving-file.js "Uploads/file.xls[x]"'); process.exit(1); }
  const res = parse(p); console.log(JSON.stringify(res,null,2));
}

module.exports = { parse };
