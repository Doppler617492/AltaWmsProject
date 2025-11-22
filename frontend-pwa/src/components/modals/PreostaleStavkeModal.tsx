import React from 'react';

export default function PreostaleStavkeModal({ items, onClose }: { items: Array<{ name: string; remaining: number }>; onClose: () => void; }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.9)', zIndex: 55, backdropFilter: 'blur(4px)' }}>
      <div className="bg-white w-full max-w-lg overflow-hidden" style={{ borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        {/* Header - Ultra moderan */}
        <div className="px-6 py-5" style={{ 
          background: 'linear-gradient(135deg, #FFD700 0%, #FFC300 50%, #FFB700 100%)', 
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at top right, rgba(255,255,255,0.3), transparent)',
            pointerEvents: 'none'
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="font-black" style={{ color: '#000', fontSize: 18, letterSpacing: '1px', marginBottom: 4 }}>
              PREOSTALE STAVKE
            </div>
            <div className="flex items-center gap-2">
              <div style={{ 
                background: 'rgba(0,0,0,0.15)', 
                color: '#000',
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 'bold'
              }}>
                {items.length} {items.length === 1 ? 'stavka' : items.length < 5 ? 'stavke' : 'stavki'}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5" style={{ maxHeight: '60vh', overflowY: 'auto', background: '#f8f9fa' }}>
          {items.length === 0 ? (
            <div className="text-center py-10" style={{ 
              background: 'linear-gradient(135deg, rgba(40, 167, 69, 0.1), rgba(32, 201, 151, 0.1))',
              borderRadius: 16,
              border: '2px dashed #28a745'
            }}>
              <div style={{ 
                fontSize: 56, 
                marginBottom: 12,
                filter: 'drop-shadow(0 2px 4px rgba(40, 167, 69, 0.3))'
              }}>✓</div>
              <div style={{ fontSize: 17, fontWeight: 'bold', color: '#28a745', marginBottom: 4 }}>
                Sve stavke primljene!
              </div>
              <div style={{ fontSize: 13, color: '#6c757d' }}>
                Možete završiti prijem
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {items.map((it, idx) => (
                <div 
                  key={idx}
                  className="p-4"
                  style={{ 
                    background: '#fff',
                    borderRadius: 14,
                    border: '2px solid #e9ecef',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div className="flex justify-between items-center gap-3">
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: 14, 
                        fontWeight: '700', 
                        color: '#1a1a1a',
                        lineHeight: 1.3,
                        marginBottom: 4
                      }}>
                        {it.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#6c757d' }}>
                        Potrebno zaprimiti
                      </div>
                    </div>
                    <div style={{ 
                      background: 'linear-gradient(135deg, #FFC300, #FFD700)',
                      color: '#000',
                      padding: '10px 16px',
                      borderRadius: 12,
                      fontSize: 18,
                      fontWeight: 'black',
                      minWidth: 70,
                      textAlign: 'center',
                      boxShadow: '0 3px 10px rgba(255, 195, 0, 0.3)',
                      lineHeight: 1
                    }}>
                      {it.remaining}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Zatvori dugme */}
          <div className="mt-5">
            <button 
              onClick={onClose} 
              className="w-full py-4 font-bold"
              style={{ 
                background: 'linear-gradient(135deg, #1a1a1a, #2a2a2a)',
                color: '#fff',
                border: 'none',
                fontSize: 15,
                letterSpacing: '0.5px',
                borderRadius: 12,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                transition: 'all 0.2s ease'
              }}
              onTouchStart={(e) => {
                e.currentTarget.style.transform = 'scale(0.98)';
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
              }}
            >
              Zatvori
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
