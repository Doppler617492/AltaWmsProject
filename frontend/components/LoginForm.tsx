import { useState, useEffect } from 'react';
import { colors } from '../src/theme/colors';
import { loadFirebaseCompat, initFirebaseFromEnv, firebaseSignIn } from '../lib/firebaseCompat';

interface LoginFormProps {
  onLogin: (token: string) => void;
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const apiBase = '/api/proxy';
  const [apiStatus, setApiStatus] = useState<'unknown'|'ok'|'down'>('unknown');
  const [fbReady, setFbReady] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 5s timeout to avoid hanging requests if API is unreachable
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const response = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        signal: ctrl.signal,
      });
      clearTimeout(t);

      if (response.ok) {
        const data = await response.json();
        onLogin(data.token);
        // Try Firebase sign-in in background (optional)
        if (fbReady) firebaseSignIn(username, password);
      } else {
        setError('Pogrešno korisničko ime ili lozinka');
      }
    } catch (err) {
      setError('Greška pri povezivanju sa serverom');
    } finally {
      setLoading(false);
    }
  };

  // lightweight health probe so user immediately sees if API is reachable
  // runs once when component mounts
  // does not block login
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tryUrl = async (u: string) => {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 2500);
          try { const r = await fetch(u, { signal: ctrl.signal }); return r.ok; } finally { clearTimeout(t); }
        };
        let ok = await tryUrl(`${apiBase}/health/`);
        if (!ok) ok = await tryUrl(`http://localhost:8000/health/`);
        if (!ok) ok = await tryUrl(`http://127.0.0.1:8000/health/`);
        if (!cancelled) setApiStatus(ok ? 'ok' : 'down');
      } catch { if (!cancelled) setApiStatus('down'); }
    })();
    return () => { cancelled = true; };
  }, []);

  const getStyles = () => ({
    container: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgBody,
      fontFamily: 'Inter, system-ui, Arial, sans-serif',
      padding: '16px',
    },
    loginBox: {
      backgroundColor: colors.bgPanel,
      padding: '28px',
      borderRadius: '12px',
      border: `2px solid ${colors.brandYellow}`,
      width: '100%',
      maxWidth: '380px',
      textAlign: 'center' as const,
      color: colors.textPrimary,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
    },
    logoWrap: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '12px',
    },
    subtitle: {
      color: colors.textPrimary,
      marginBottom: '16px',
      fontSize: '16px',
      opacity: 0.85,
    },
    form: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '14px',
    },
    inputGroup: {
      textAlign: 'left' as const,
    },
    label: {
      display: 'block',
      marginBottom: '6px',
      color: colors.textPrimary,
      fontWeight: 600,
      fontSize: '13px',
    },
    input: {
      width: '100%',
      padding: '14px 16px',
      border: `2px solid ${colors.borderCard}`,
      borderRadius: '10px',
      fontSize: '18px',
      color: colors.textPrimary,
      background: colors.bgBody,
      boxSizing: 'border-box' as const,
      outline: 'none',
    },
    button: {
      backgroundColor: colors.brandYellow,
      color: '#000',
      padding: '16px',
      border: 'none',
      borderRadius: '10px',
      fontSize: '18px',
      fontWeight: 800,
      cursor: 'pointer',
      marginTop: '6px',
      minHeight: '56px',
    },
    error: {
      color: colors.statusErr,
      fontSize: '13px',
      textAlign: 'center' as const,
      marginBottom: '8px',
    },
  });

  const dynamicStyles = getStyles();

  return (
    <div style={dynamicStyles.container}>
      <div style={dynamicStyles.loginBox}>
        <div style={dynamicStyles.logoWrap}>
          <img src="/logo-white.svg" alt="Alta WMS" style={{ height: 42 }} />
        </div>
        <div style={dynamicStyles.subtitle}>Admin prijava</div>
        {apiStatus === 'down' && (
          <div style={{ ...dynamicStyles.error, marginTop: 0 }}>
            API nije dostupan (proxy /api/proxy ne odgovara). Proverite backend i mrežu containera.
          </div>
        )}

        <form onSubmit={handleSubmit} style={dynamicStyles.form}>
          <div style={dynamicStyles.inputGroup}>
            <label style={dynamicStyles.label}>Korisničko ime / Email</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={dynamicStyles.input}
              required
            />
          </div>

          <div style={dynamicStyles.inputGroup}>
            <label style={dynamicStyles.label}>Lozinka</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={dynamicStyles.input}
              required
            />
          </div>

          {error && <div style={dynamicStyles.error}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={dynamicStyles.button}
          >
            {loading ? 'Prijavljivanje...' : 'Prijava'}
          </button>
        </form>
      </div>
    </div>
  );
}
