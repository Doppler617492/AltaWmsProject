import dynamic from 'next/dynamic';
const PovracajCreateScreen = dynamic(() => import('../../../src/screens/PovracajCreateScreen'), { ssr: false });

export default function PovracajCreatePage() {
  return <PovracajCreateScreen />;
}
