import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { loadFirebaseCompat, initFirebaseFromEnv, firebaseSignIn } from '../src/lib/firebaseCompat';
import { startHeartbeat } from '../lib/heartbeat';
import PwaHeader from '../components/PwaHeader';
import PwaMenu from '../components/PwaMenu';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [fbReady, setFbReady] = useState(false);
  const [alertBanner, setAlertBanner] = useState<{ type: 'receiving' | 'shipping'; id: number; identifier: string; reason?: string } | null>(null);
  const seenTasksRef = useRef<Set<string>>(new Set());
  const vibrationPattern = useRef<number[]>([0, 200, 120, 200, 80, 200]);

  const triggerAssignmentAlert = (payload: { type: 'receiving' | 'shipping'; id: number; identifier: string; reason?: string }) => {
    setAlertBanner(payload);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(vibrationPattern.current); } catch {}
    }
  };

  useEffect(() => {
    if (!alertBanner) return;
    const timer = setTimeout(() => setAlertBanner(null), 10000);
    return () => clearTimeout(timer);
  }, [alertBanner]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({ id: payload.sub, username: payload.username, role: payload.role, name: payload.username });
        // Start heartbeat when user is logged in
        startHeartbeat();
      } catch {
        localStorage.removeItem('token');
      }
    }
  }, []);

  // WS notifikacije (Socket.IO) – odmah banner bez poll‑a
  useEffect(() => {
    if (!user) return;
    let socket: any = null;
    const start = () => {
      try {
        // window.io dolazi iz CDN skripte u _app.tsx
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const io = (window as any).io;
        if (!io) return;
        const backendBase = (process.env.NEXT_PUBLIC_API_URL as string) || `${window.location.protocol}//localhost:8000`;
        socket = io(`${backendBase}/ws/assignments`, { transports: ['websocket'] });
        socket.on('assignment:new', (p: any) => {
          try {
            const assignees: number[] = Array.isArray(p?.assignees) ? p.assignees : [];
            const isMine = assignees.includes(user.id);
            if (!isMine) return;
            const id = p?.task_id || p?.id;
            const identifier = p?.document_number || p?.order_number || (p?.type === 'RECEIVING' ? `Prijem ${id}` : `Otprema ${id}`);
            const key = `${p?.type === 'RECEIVING' ? 'REC' : 'SHIP'}-${id}`;
            seenTasksRef.current.add(key);
            if (p?.type === 'RECEIVING') triggerAssignmentAlert({ type: 'receiving', id, identifier, reason: p?.reason || 'Dodeljen novi prijem' });
            if (p?.type === 'SHIPPING') triggerAssignmentAlert({ type: 'shipping', id, identifier, reason: p?.reason || 'Dodeljena nova otprema' });
          } catch {}
        });
      } catch {}
    };
    // Try to start immediately and also retry once after a short delay if script not ready
    start();
    const t = setTimeout(() => { if (!socket) start(); }, 1500);
    return () => { clearTimeout(t); try { socket && socket.disconnect(); } catch {} };
  }, [user]);

  // Optional Firebase init (if env provided)
  useEffect(() => {
    const hasFirebaseEnv = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!hasFirebaseEnv) return;
    (async () => {
      const fb = await loadFirebaseCompat();
      if (fb) {
        initFirebaseFromEnv();
        setFbReady(true);
      }
    })();
  }, []);

  // Poll for reassigned tasks
  useEffect(() => {
    if (!user) return;

    const checkReassignedTasks = async () => {
      try {
        const [receivings, shippings] = await Promise.all([
          apiClient.get('/receiving/my-active').catch(() => []),
          apiClient.get('/shipping/my-orders').catch(() => []),
        ]);

        const currentTasks = new Set<string>();
        
        // Check receiving tasks
        (Array.isArray(receivings) ? receivings : []).forEach((r: any) => {
          const key = `REC-${r.id}`;
          currentTasks.add(key);
          if (!seenTasksRef.current.has(key)) {
            triggerAssignmentAlert({
              type: 'receiving',
              id: r.id,
              identifier: r.document_number || `Prijem ${r.id}`,
              reason: r.on_hold_reason || 'Dodeljena nova prijemnica',
            });
          }
        });

        // Check shipping tasks
        (Array.isArray(shippings) ? shippings : []).forEach((s: any) => {
          const key = `SHIP-${s.order_id || s.id}`;
          currentTasks.add(key);
          if (!seenTasksRef.current.has(key)) {
            triggerAssignmentAlert({
              type: 'shipping',
              id: s.order_id || s.id,
              identifier: s.order_number || `Otprema ${s.order_id || s.id}`,
              reason: s.reason || 'Dodeljena nova otprema',
            });
          }
        });

        seenTasksRef.current = currentTasks;
      } catch (e) {
        console.error('Error checking reassigned tasks:', e);
      }
    };

    checkReassignedTasks();
    const interval = setInterval(checkReassignedTasks, 15000); // 15s polling
    return () => clearInterval(interval);
  }, [user]);

  async function login(e: any) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const username = String(form.get('username'));
    const password = String(form.get('password'));
    try {
      // Use local API proxy to avoid cross-origin/network issues
      const res = await fetch(`/api/fresh/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
      });
      if (!res.ok) throw new Error('Neuspešna prijava');
      const data = await res.json();
      localStorage.setItem('token', data.token);
      const payload = JSON.parse(atob(data.token.split('.')[1]));
      setUser({ id: payload.sub, username: payload.username, role: payload.role, name: payload.username });
      if (fbReady) firebaseSignIn(username, password);
    } catch (err: any) {
      alert(err.message || 'Greška pri prijavi');
    }
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', padding: 16 }}>
        <form onSubmit={login} style={{ width: 340, border: '2px solid #FFC300', borderRadius: 12, padding: 20, background:'#000', color:'#fff' }}>
          <div style={{ display:'flex', justifyContent:'center', marginBottom: 10 }}>
            <img src="/logo-white.svg" alt="Alta WMS" style={{ height: 36 }} />
          </div>
          <div style={{ textAlign:'center', marginBottom: 12, opacity: 0.85 }}>PWA Prijava</div>
          <label style={{ display:'block', marginBottom: 6, fontSize: 13 }}>Korisničko ime / Email</label>
          <input name="username" placeholder="Korisničko ime" style={{ width: '100%', padding: 14, border: '2px solid #333', borderRadius: 10, marginBottom: 8, background:'#0a0a0a', color:'#fff', fontSize: 17, boxSizing:'border-box' }} />
          <label style={{ display:'block', marginBottom: 6, fontSize: 13 }}>Lozinka</label>
          <input name="password" type="password" placeholder="Lozinka" style={{ width: '100%', padding: 14, border: '2px solid #333', borderRadius: 10, marginBottom: 12, background:'#0a0a0a', color:'#fff', fontSize: 17, boxSizing:'border-box' }} />
          <button type="submit" style={{ width: '100%', background: '#FFC300', color: '#000', border: 'none', padding: 14, borderRadius: 10, fontWeight: 800, minHeight: 52 }}>Prijava</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <PwaHeader name={user?.username || ''} onLogout={logout} />
      {alertBanner && (
        <div
          style={{
            background: '#7a1f1f',
            color: '#fff',
            padding: '10px 14px',
            textAlign: 'center',
            fontWeight: 600,
            fontSize: 14,
            position: 'relative',
            zIndex: 100,
            cursor: 'pointer',
            border: '2px solid #FFC300',
          }}
          onClick={() => {
            if (alertBanner.type === 'receiving') {
              router.push('/');
            } else {
              const tid = alertBanner.id;
              router.push(tid ? `/pwa/otprema/${tid}` : '/pwa/otprema');
            }
            setAlertBanner(null);
          }}
        >
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap: 12 }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 16, marginBottom: 4, fontWeight: 700 }}>
                {alertBanner.type === 'receiving' ? 'Novi prijem' : 'Nova otprema'}
              </div>
              <div style={{ opacity: 0.95, fontSize: 14 }}>Zadatak: <strong>{alertBanner.identifier}</strong></div>
              {alertBanner.reason && (
                <div style={{ opacity: 0.8, fontSize: 12, marginTop: 4 }}>{alertBanner.reason}</div>
              )}
            </div>
            <div style={{ background:'#000', borderRadius:8, padding:'2px 6px', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <img src="/logo-white.svg" alt="Alta WMS" style={{ height: 16 }} />
            </div>
          </div>
        </div>
      )}
      <PwaMenu />
    </div>
  );
}
