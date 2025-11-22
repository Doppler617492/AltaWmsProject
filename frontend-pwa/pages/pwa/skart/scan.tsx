import dynamic from 'next/dynamic';

const SkartScanScreen = dynamic(() => import('../../../src/screens/SkartScanScreen'), { ssr: false });

export default function SkartScanPage() {
  return <SkartScanScreen />;
}


