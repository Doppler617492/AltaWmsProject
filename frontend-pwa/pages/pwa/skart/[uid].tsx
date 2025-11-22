import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';

const SkartReceiveScreen = dynamic(() => import('../../../src/screens/SkartReceiveScreen'), { ssr: false });

export default function SkartReceivePage() {
  const router = useRouter();
  const { uid } = router.query;
  if (!uid || Array.isArray(uid)) return null;
  return <SkartReceiveScreen uid={uid} />;
}


