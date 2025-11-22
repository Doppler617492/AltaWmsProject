import { apiClient } from './apiClient';

let timer: any = null;

export function startHeartbeat() {
  if (timer) return;
  // stable device id per browser
  let deviceId = 'pwa-' + (typeof navigator!=='undefined' ? (navigator.userAgent.replace(/\s+/g,'').slice(0,20)) : 'local');
  try {
    const stored = localStorage.getItem('device_id');
    if (stored) deviceId = stored;
    else {
      const rnd = Math.random().toString(36).slice(2, 8);
      deviceId = `${deviceId}-${rnd}`;
      localStorage.setItem('device_id', deviceId);
    }
  } catch {}
  const ping = async () => {
    try {
      await apiClient.patch('/pwa/heartbeat', { device_id: deviceId });
    } catch (e) {
      // if 401, log out
      try {
        const msg = String(e);
        if (msg.includes('401')) {
          localStorage.removeItem('token');
          location.reload();
        }
      } catch {}
    }
  };
  ping();
  timer = setInterval(ping, 60000);
}

export function stopHeartbeat() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
