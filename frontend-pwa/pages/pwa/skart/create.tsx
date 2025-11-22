import dynamic from 'next/dynamic';

const SkartCreateScreen = dynamic(() => import('../../../src/screens/SkartCreateScreen'), { ssr: false });

export default function SkartCreatePage() {
  return <SkartCreateScreen />;
}


