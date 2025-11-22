import { useRouter } from 'next/router';
import PopisWorkScreen from '../../../src/screens/PopisWorkScreen';
export default function Page(){ const r = useRouter(); const { id } = r.query; if(!id) return null; return <PopisWorkScreen taskId={Number(id)} />; }

