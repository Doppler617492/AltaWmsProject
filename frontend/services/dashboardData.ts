// Central service for fetching dashboard KPI data
// Uses existing API client or falls back to mock if endpoints don't exist

import { apiClient } from '../lib/apiClient';

// Helper to get user role from JWT
function getUserRole(): string | null {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role || null;
  } catch {
    return null;
  }
}

export interface DashboardSnapshot {
  receiving: {
    inProgress: number;
    waiting: number;
    totalToday?: number;
    completedToday?: number;
    avgCloseTimeMin?: number;
  };
  shipping: {
    loadingNow: number;
    stagedReady: number;
    inProgress?: number;
    waiting?: number;
    totalToday?: number;
    completedToday?: number;
    avgCloseTimeMin?: number;
  };
  workforce: {
    onlineWorkers: number;
    totalWorkers: number;
  };
  stock: {
    hotspotLocations: number;
  };
  skart: {
    submittedToday: number;
    receivedToday: number;
    differencePercent: number;
  };
  povracaj: {
    submittedToday: number;
    receivedToday: number;
    differencePercent: number;
  };
}

// Helper for /workforce/overview
async function fetchWorkforceOverview(): Promise<{ onlineWorkers: number; totalWorkers: number }> {
  try {
    const data = await apiClient.get('/workforce/overview');
    
    if (!Array.isArray(data)) {
      throw new Error('Invalid workforce data format');
    }

    // Calculate online workers from heartbeat or online_status field
    const totalWorkers = data.length;
    const onlineWorkers = data.filter((w: any) => {
      // Check multiple possible fields for online status
      if (w.online_status === 'ONLINE') return true;
      if (w.online === true) return true;
      
      // Check heartbeat (within last 2 minutes)
      if (w.last_heartbeat_at) {
        const heartbeat = new Date(w.last_heartbeat_at).getTime();
        const now = Date.now();
        const diffMinutes = (now - heartbeat) / 60000;
        return diffMinutes < 2;
      }
      
      return false;
    }).length;

    return { onlineWorkers, totalWorkers };
  } catch (e) {
    console.warn('Workforce fetch failed:', e);
    // No mock values; return zeros so UI doesn't show lažna stanja
    return { onlineWorkers: 0, totalWorkers: 0 };
  }
}

// Normalize status to lowercase string
const normalizeStatus = (status: unknown): string =>
  (status ?? '').toString().toLowerCase();

// Helper for receiving summary
async function fetchReceivingSummary(): Promise<DashboardSnapshot['receiving']> {
  try {
    // Try /receiving/active first (for active receivings)
    const activeData = await apiClient.get('/receiving/active').catch(() => null);
    
    if (activeData && Array.isArray(activeData)) {
      const inProgress = activeData.filter((d: any) => normalizeStatus(d.status) === 'in_progress').length;
      const waiting = activeData.filter((d: any) => {
        const st = normalizeStatus(d.status);
        return st === 'draft' || st === 'on_hold';
      }).length;
      
      return { inProgress, waiting };
    }
    
    // Fallback: try /receiving/documents
    const allDocs = await apiClient.get('/receiving/documents');
    
    if (Array.isArray(allDocs)) {
      const inProgress = allDocs.filter((d: any) => normalizeStatus(d.status) === 'in_progress').length;
      const waiting = allDocs.filter((d: any) => {
        const st = normalizeStatus(d.status);
        return st === 'draft' || st === 'on_hold';
      }).length;
      
      return { inProgress, waiting };
    }
    
    throw new Error('Invalid receiving data format');
  } catch (e) {
    console.warn('Receiving fetch failed:', e);
    return { inProgress: 0, waiting: 0 };
  }
}

// Helper for shipping summary (mock if backend doesn't exist)
async function fetchShippingSummary(): Promise<DashboardSnapshot['shipping']> {
  try {
    const data = await apiClient.get('/shipping/summary');
    
    if (data && typeof data === 'object') {
      return {
        loadingNow: data.loading_now ?? data.loadingNow ?? 0,
        stagedReady: data.staged_ready ?? data.stagedReady ?? 0,
      };
    }
    
    throw new Error('Invalid shipping data format');
  } catch (e) {
    console.warn('Shipping fetch failed:', e);
    return { loadingNow: 0, stagedReady: 0 };
  }
}

// Helper for stock hotspots
async function fetchStockSummary(): Promise<{ hotspotLocations: number }> {
  try {
    const data = await apiClient.get('/stock/hotspots');
    
    if (data && typeof data === 'object') {
      // Check for different possible response formats
      if (Array.isArray(data.hotspots)) {
        return { hotspotLocations: data.hotspots.length };
      }
      
      if (Array.isArray(data.overloaded) || Array.isArray(data.negative)) {
        const overloaded = Array.isArray(data.overloaded) ? data.overloaded.length : 0;
        const negative = Array.isArray(data.negative) ? data.negative.length : 0;
        const conflicts = Array.isArray(data.recent_conflicts) ? data.recent_conflicts.length : 0;
        
        return { hotspotLocations: overloaded + negative + conflicts };
      }
      
      if (typeof data.hotspotLocations === 'number') {
        return { hotspotLocations: data.hotspotLocations };
      }
    }
    
    throw new Error('Invalid stock hotspots data format');
  } catch (e) {
    console.warn('Stock hotspots fetch failed:', e);
    return { hotspotLocations: 0 };
  }
}

// Main export function
export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const userRole = getUserRole();
  
  // For komercialista/komercijalista, only fetch shipping data and use fallbacks for everything else
  if (userRole === 'komercialista' || userRole === 'komercijalista') {
    const [shipping] = await Promise.all([
      fetchShippingSummary().catch(() => ({ loadingNow: 0, stagedReady: 0 })),
    ]);
    
    return {
      receiving: { inProgress: 0, waiting: 0 },
      shipping,
      workforce: { onlineWorkers: 0, totalWorkers: 0 },
      stock: { hotspotLocations: 0 },
    };
  }
  
  // For other roles, fetch all data
  const [receiving, shipping, workforce, stock, overview, skartSummary, povracajSummary] = await Promise.all([
    fetchReceivingSummary(),
    fetchShippingSummary(),
    fetchWorkforceOverview(),
    fetchStockSummary(),
    apiClient.get('/dashboard/overview').catch(() => null),
    apiClient.get('/skart/reports/summary?window=today').catch(() => null),
    apiClient.get('/povracaj/reports/summary?window=today').catch(() => null),
  ]);

  if (overview && typeof overview === 'object') {
    const rs = overview.receivingSummary || {};
    receiving.totalToday = rs.total_today ?? receiving.totalToday;
    receiving.completedToday = rs.completed_today ?? receiving.completedToday;
    receiving.avgCloseTimeMin = rs.avg_close_time_min ?? receiving.avgCloseTimeMin;

    const ss = overview.shippingSummary || {};
    if (typeof ss === 'object') {
      shipping.inProgress = ss.in_progress ?? shipping.inProgress;
      shipping.waiting = ss.waiting ?? shipping.waiting;
      shipping.totalToday = ss.total_today ?? shipping.totalToday;
      shipping.completedToday = ss.completed_today ?? shipping.completedToday;
      shipping.avgCloseTimeMin = ss.avg_close_time_min ?? shipping.avgCloseTimeMin;
    }

    const ws = overview.workforceSummary;
    if (ws?.online_now !== undefined && ws?.total_workers !== undefined) {
      workforce.onlineWorkers = ws.online_now ?? workforce.onlineWorkers;
      workforce.totalWorkers = ws.total_workers ?? workforce.totalWorkers;
    }
  }

  const submittedSkart = skartSummary?.totalSubmitted ?? 0;
  const receivedSkart = skartSummary?.totalReceived ?? 0;
  const differencePercent = submittedSkart > 0 ? Math.max(0, ((submittedSkart - receivedSkart) / submittedSkart) * 100) : 0;

  const submittedPovracaj = povracajSummary?.totalSubmitted ?? 0;
  const receivedPovracaj = povracajSummary?.totalReceived ?? 0;
  const povracajDifferencePercent = submittedPovracaj > 0 ? Math.max(0, ((submittedPovracaj - receivedPovracaj) / submittedPovracaj) * 100) : 0;

  return {
    receiving,
    shipping: {
      loadingNow: shipping.loadingNow ?? 0,
      stagedReady: shipping.stagedReady ?? 0,
      inProgress: shipping.inProgress ?? 0,
      waiting: shipping.waiting ?? 0,
      totalToday: shipping.totalToday ?? 0,
      completedToday: shipping.completedToday ?? 0,
      avgCloseTimeMin: shipping.avgCloseTimeMin ?? 0,
    },
    workforce,
    stock,
    skart: {
      submittedToday: submittedSkart,
      receivedToday: receivedSkart,
      differencePercent: Number(differencePercent.toFixed(1)),
    },
    povracaj: {
      submittedToday: submittedPovracaj,
      receivedToday: receivedPovracaj,
      differencePercent: Number(povracajDifferencePercent.toFixed(1)),
    },
  };
}
