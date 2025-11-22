import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';

const PovracajReceiveScreen = dynamic(() => import('../../../src/screens/PovracajReceiveScreen'), { ssr: false });

export default function PovracajReceivePage() {
  const router = useRouter();
  const { uid } = router.query;
  if (!uid || typeof uid !== 'string') return null;
  return <PovracajReceiveScreen uid={uid} />;
}
