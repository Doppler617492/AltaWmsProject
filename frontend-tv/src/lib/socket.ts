import { io } from 'socket.io-client';

// TV dashboard connects to the admin domain for Socket.IO
// because Socket.IO is hosted on the admin frontend domain
const base = 'https://admin.cungu.com';
const token = process.env.NEXT_PUBLIC_TV_KIOSK_TOKEN || '';

// Connect to the /ws/performance namespace at the /socket.io path
// Use both WebSocket and polling for reliability over nginx
export const perfSocket = io(`${base}/ws/performance`, {
  path: '/socket.io',
  transports: ['polling', 'websocket'],
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 20,
  extraHeaders: { 'x-kiosk-token': token },
  query: { kioskToken: token }
});

