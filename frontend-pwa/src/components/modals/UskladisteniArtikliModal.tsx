import React from 'react';

export default function UskladisteniArtikliModal({ rows, onClose }: { rows: Array<{ name: string; qty: number; location: string; pallet?: string }>; onClose: () => void; }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-lg w-11/12 max-w-xl">
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#ffc107', color: '#000' }}>
          <div className="font-bold">Artikli na tekućoj lokaciji</div>
          <div style={{ background:'#000', borderRadius:8, padding:'2px 6px', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <img src="/logo-white.svg" alt="Alta WMS" style={{ height: 16 }} />
          </div>
        </div>
        <div className="p-4">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left p-2">Artikal</th>
                <th className="text-right p-2">Količina</th>
                <th className="text-left p-2">Lokacija</th>
                <th className="text-left p-2">Paleta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx}>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2 text-right">{r.qty}</td>
                  <td className="p-2">{r.location}</td>
                  <td className="p-2">{r.pallet || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 text-right">
            <button onClick={onClose} className="px-4 py-2 rounded font-bold" style={{ background: '#1a1a1a', color: '#fff' }}>Zatvori</button>
          </div>
        </div>
      </div>
    </div>
  );
}
