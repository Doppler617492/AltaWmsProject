import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PwaHeader from '../../components/PwaHeader';
import Putaway from '../../components/Putaway';

export default function PutawayPage() {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser({ id: payload.sub, username: payload.username, role: payload.role, name: payload.username });
    } catch {
      localStorage.removeItem('token');
      router.push('/');
    }
  }, []);

  function logout() {
    localStorage.removeItem('token');
    router.push('/');
  }

  if (!user) return null;

  return (
    <div>
      <PwaHeader name={user?.username || ''} onLogout={logout} />
      <Putaway />
    </div>
  );
}

