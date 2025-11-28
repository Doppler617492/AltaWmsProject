import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues
const InventarScreen = dynamic(() => import('../../src/screens/InventarScreen'), {
  ssr: false,
  loading: () => (
    <div 
      style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(180deg, #0f1419 0%, #0a0e13 50%, #000000 100%)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, marginBottom: 12 }}>Učitavanje inventara...</div>
      </div>
    </div>
  )
});

export default function Page(){ return <InventarScreen />; }