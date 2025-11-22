import { io } from 'socket.io-client';

const base = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
const token = process.env.NEXT_PUBLIC_TV_KIOSK_TOKEN || '';

export const perfSocket = io(`${base}/ws/performance`, {
  transports: ['websocket'],
  extraHeaders: { 'x-kiosk-token': token },
  query: { kioskToken: token }
});

