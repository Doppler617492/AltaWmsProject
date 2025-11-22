// Lightweight loader for Firebase compat SDK via CDN without npm deps
// Initializes only if NEXT_PUBLIC_FIREBASE_API_KEY is present.

declare global {
  interface Window {
    firebase?: any;
    __fbLoaded?: boolean;
  }
}

export async function loadFirebaseCompat(): Promise<any | null> {
  if (typeof window === 'undefined') return null;
  if (window.firebase) return window.firebase;
  if (window.__fbLoaded) return window.firebase || null;
  window.__fbLoaded = true;
  const add = (src: string) => new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
  try {
    await add('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
    await add('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth-compat.js');
    return window.firebase || null;
  } catch {
    return null;
  }
}

export function initFirebaseFromEnv(): any | null {
  if (typeof window === 'undefined') return null;
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  } as any;
  if (!cfg.apiKey || !window.firebase) return null;
  try {
    if (window.firebase.apps && window.firebase.apps.length) return window.firebase.app();
    return window.firebase.initializeApp(cfg);
  } catch {
    return null;
  }
}

export async function firebaseSignIn(email: string, password: string): Promise<void> {
  if (typeof window === 'undefined' || !window.firebase) return;
  try {
    await window.firebase.auth().signInWithEmailAndPassword(email, password);
  } catch {
    // Ignore errors; backend JWT auth remains source of truth.
  }
}

