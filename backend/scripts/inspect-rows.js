const fs = require('fs');
const xlsx = require('xlsx');
const p = process.argv[2];
if(!p){ console.error('usage: node backend/scripts/inspect-rows.js <file> [from] [to]'); process.exit(1); }
const from = Number(process.argv[3]||0);
const to = Number(process.argv[4]||40);
const wb = xlsx.read(fs.readFileSync(p), { type:'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(ws, { header:1, raw:true });
for(let i=from;i<=to;i++){
  const row = data[i]||[]; console.log(i, JSON.stringify(row));
}

