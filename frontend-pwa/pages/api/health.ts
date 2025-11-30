import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Alta WMS PWA Frontend',
    version: '2.1.0',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  };
  
  res.status(200).json(healthData);
}