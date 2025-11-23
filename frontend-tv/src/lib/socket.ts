import { io } from 'socket.io-client';

// TV dashboard connects to the admin domain for Socket.IO
// because Socket.IO is hosted on the admin frontend domain
const base = 'https://admin.cungu.com';
const token = process.env.NEXT_PUBLIC_TV_KIOSK_TOKEN || '';

export const perfSocket = io(base, {
  path: '/socket.io',
  namespace: '/ws/performance',
  transports: ['websocket', 'polling'],
  extraHeaders: { 'x-kiosk-token': token },
  query: { kioskToken: token }
});

