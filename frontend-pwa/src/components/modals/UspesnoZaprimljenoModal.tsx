import React from 'react';

export default function UspesnoZaprimljenoModal({ itemName, qty, location, onClose }: { itemName: string; qty: number; location: string; onClose: () => void; }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-lg w-11/12 max-w-md">
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#ffc107', color: '#000' }}>
          <div className="font-bold">OBAVEŠTENJE</div>
          <div style={{ background:'#000', borderRadius:8, padding:'2px 6px', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <img src="/logo-white.svg" alt="Alta WMS" style={{ height: 16 }} />
          </div>
        </div>
        <div className="p-4">
          <div className="font-bold mb-2">Uspešno ste zaprimili artikal:</div>
          <div className="mb-1">Naziv: {itemName}</div>
          <div className="mb-1">Količina: {qty}</div>
          <div className="mb-1">Lokacija: {location}</div>
          <div className="mt-4 text-right">
            <button onClick={onClose} className="px-4 py-2 rounded font-bold" style={{ background: '#1a1a1a', color: '#fff' }}>OK</button>
          </div>
        </div>
      </div>
    </div>
  );
}
