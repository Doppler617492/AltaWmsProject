import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { apiClient } from '../lib/apiClient';
import { startHeartbeat } from '../lib/heartbeat';
import { logger } from '../lib/logger';
import PwaHeader from '../components/PwaHeader';
import dynamic from 'next/dynamic';

export default dynamic(() => Promise.resolve(DashboardPage), { ssr: false });

function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<any | null>(null);
  const [receivings, setReceivings] = useState<any[]>([]);
  const [shippings, setShippings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineStatus, setOnlineStatus] = useState<'ONLINE' | 'OFFLINE' | 'NEAKTIVAN'>('OFFLINE');
  const [lastActivity, setLastActivity] = useState<Date | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    // Start heartbeat immediately when dashboard loads
    startHeartbeat();

    const load = async () => {
      try {
        setLoading(true);
        // Load user info
        const meRes = await apiClient.get('/auth/me');
        logger.debug('User info from /auth/me', meRes, 'Dashboard');
        setMe(meRes);
        
        // Calculate online status based on last_activity
        // Send heartbeat first to ensure we're marked as online
        let heartbeatSent = false;
        try {
          await apiClient.patch('/pwa/heartbeat', { device_id: 'dashboard' });
          heartbeatSent = true;
        } catch (e: any) {
          console.warn('Heartbeat failed:', e);
        }
        
        // Reload user info after heartbeat to get fresh last_activity
        try {
          const meResAfter = await apiClient.get('/auth/me');
          logger.debug('User info after heartbeat', meResAfter, 'Dashboard');
          if (meResAfter?.last_activity) {
            const lastAct = new Date(meResAfter.last_activity);
            const now = new Date();
            const diffMs = now.getTime() - lastAct.getTime();
            const diffSecs = diffMs / 1000;
            const diffMins = diffSecs / 60;
            
            // Backend uses 180 seconds (3 minutes) for online status
            // If we just sent heartbeat, we should be online
            if (heartbeatSent || diffSecs <= 180) {
              setOnlineStatus('ONLINE');
            } else if (diffMins <= 180) {
              setOnlineStatus('OFFLINE');
            } else {
              setOnlineStatus('NEAKTIVAN');
            }
            setLastActivity(lastAct);
          } else {
            // If no last_activity but heartbeat was sent, assume online
            if (heartbeatSent) {
              setOnlineStatus('ONLINE');
              setLastActivity(new Date());
            } else {
              setOnlineStatus('OFFLINE');
            }
          }
        } catch (e: any) {
          console.warn('Failed to reload user info:', e);
          // If heartbeat was sent, assume online
          if (heartbeatSent) {
            setOnlineStatus('ONLINE');
          }
        }

        // Load active receivings - try both my-active and active endpoints
        try {
          // Try to get all active receivings first (includes all DRAFT, IN_PROGRESS, ON_HOLD)
          try {
            const allRecList = await apiClient.get('/receiving/active');
            logger.debug('All active receivings', allRecList, 'Dashboard');
            const allRecs = Array.isArray(allRecList) ? allRecList : [];
            
            // Also get my-active to mark which ones are assigned to me
            try {
              const myRecList = await apiClient.get('/receiving/my-active');
              logger.debug('My active receivings', myRecList, 'Dashboard');
              const myRecIds = new Set((Array.isArray(myRecList) ? myRecList : []).map((r: any) => r.id));
              
              // Mark assigned receivings
              const marked = allRecs.map((rec: any) => ({
                ...rec,
                is_mine: myRecIds.has(rec.id)
              }));
              logger.debug('Merged receivings', marked, 'Dashboard');
              setReceivings(marked);
            } catch (e: any) {
              console.warn('Failed to load my-active receivings:', e);
              // If my-active fails, just use all active
              setReceivings(allRecs);
            }
          } catch (e: any) {
            // If /active fails, fallback to my-active only
            console.warn('Failed to load all active receivings:', e);
            try {
              const myRecList = await apiClient.get('/receiving/my-active');
              logger.debug('Fallback: My active receivings', myRecList, 'Dashboard');
              setReceivings(Array.isArray(myRecList) ? myRecList : []);
            } catch (e2: any) {
              console.error('Failed to load my-active receivings:', e2);
              setReceivings([]);
            }
          }
        } catch (e: any) {
          console.error('Error loading receivings:', e);
          setReceivings([]);
        }

        // Load active shippings
        try {
          const shipList = await apiClient.get('/shipping/my-orders');
          setShippings(Array.isArray(shipList) ? shipList : []);
        } catch {
          setShippings([]);
        }
      } catch (e: any) {
        if (e?.message?.includes('401')) {
          localStorage.removeItem('token');
          router.push('/');
          return;
        }
        console.error('Error loading dashboard:', e);
      } finally {
        setLoading(false);
      }
    };

    // Send immediate heartbeat on mount and then load data
    const sendImmediateHeartbeat = async () => {
      try {
        const result = await apiClient.patch('/pwa/heartbeat', { device_id: 'dashboard' });
        logger.debug('Heartbeat sent', result, 'Dashboard');
        return true;
      } catch (e: any) {
        console.error('Heartbeat failed:', e);
        return false;
      }
    };
    
    // Send heartbeat immediately, then load data after a short delay to ensure DB is updated
    sendImmediateHeartbeat().then(() => {
      setTimeout(() => {
        load();
      }, 500); // Wait 500ms for DB to update
    });
    
    // Refresh every 15 seconds
    const interval = setInterval(() => {
      sendImmediateHeartbeat().then(() => {
        setTimeout(() => {
          load();
        }, 500);
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [router]);

  const logout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  const getStatusColor = (status: string) => {
    if (status === 'ONLINE') return '#28a745';
    if (status === 'OFFLINE') return '#9ca3af';
    return '#dc3545';
  };

  const getStatusText = (status: string) => {
    if (status === 'ONLINE') return 'ONLINE';
    if (status === 'OFFLINE') return 'OFFLINE';
    return 'NEAKTIVAN';
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Učitavanje...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
      <PwaHeader name={me?.name || me?.username || ''} onLogout={logout} />
      
      <div style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0, marginBottom: 20, color: '#FFC300', fontSize: 24, fontWeight: 'bold' }}>
          Dashboard
        </h2>

        {/* User Status Card */}
        <div style={{ 
          background: '#1a1a1a', 
          border: '2px solid #FFC300', 
          borderRadius: 12, 
          padding: 16, 
          marginBottom: 16 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 4 }}>
                {me?.full_name || me?.name || me?.username || 'Korisnik'}
              </div>
              <div style={{ fontSize: 14, color: '#9ca3af' }}>
                {me?.role || 'magacioner'}
              </div>
            </div>
            <div style={{ 
              background: getStatusColor(onlineStatus), 
              color: '#fff', 
              padding: '6px 12px', 
              borderRadius: 20, 
              fontSize: 14, 
              fontWeight: 'bold' 
            }}>
              {getStatusText(onlineStatus)}
            </div>
          </div>
          {lastActivity && (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              Poslednja aktivnost: {lastActivity.toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ 
            background: '#1a1a1a', 
            border: '2px solid #28a745', 
            borderRadius: 12, 
            padding: 16,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#28a745', marginBottom: 8 }}>
              {receivings.length}
            </div>
            <div style={{ fontSize: 14, color: '#9ca3af' }}>
              Aktivnih prijema {receivings.filter((r: any) => r.is_mine).length > 0 ? `(${receivings.filter((r: any) => r.is_mine).length} mojih)` : ''}
            </div>
            <button
              onClick={() => router.push('/pwa/receiving')}
              style={{
                marginTop: 12,
                background: '#28a745',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 6,
                fontWeight: 'bold',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              Pregled prijema
            </button>
          </div>

          <div style={{ 
            background: '#1a1a1a', 
            border: '2px solid #ffc107', 
            borderRadius: 12, 
            padding: 16,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#ffc107', marginBottom: 8 }}>
              {shippings.length}
            </div>
            <div style={{ fontSize: 14, color: '#9ca3af' }}>Aktivnih otprema</div>
            <button
              onClick={() => router.push('/pwa/otprema')}
              style={{
                marginTop: 12,
                background: '#ffc107',
                color: '#000',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 6,
                fontWeight: 'bold',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              Pregled otprema
            </button>
          </div>
        </div>

        {/* Active Receivings List */}
        {receivings.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ color: '#FFC300', marginBottom: 12, fontSize: 18 }}>Aktivni prijemi</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {receivings.slice(0, 5).map((rec: any) => (
                <div
                  key={rec.id}
                  onClick={() => router.push(`/pwa/receiving/${rec.id}`)}
                  style={{
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: 8,
                    padding: 12,
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                    {rec.document_number || `#${rec.id}`}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    {rec.supplier_name || rec.supplier?.name || 'Dobavljač'}
                  </div>
                  {(rec.percent_complete !== undefined || rec.progress !== undefined) && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ 
                        height: 6, 
                        background: '#333', 
                        borderRadius: 3, 
                        overflow: 'hidden' 
                      }}>
                        <div style={{ 
                          width: `${Math.min(100, rec.percent_complete || rec.progress || 0)}%`, 
                          height: '100%', 
                          background: '#28a745' 
                        }} />
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                        {rec.percent_complete || rec.progress || 0}% završeno
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Shippings List */}
        {shippings.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ color: '#FFC300', marginBottom: 12, fontSize: 18 }}>Aktivne otpreme</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {shippings.slice(0, 5).map((ship: any) => (
                <div
                  key={ship.order_id || ship.id}
                  onClick={() => router.push(`/pwa/otprema/${ship.order_id || ship.id}`)}
                  style={{
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: 8,
                    padding: 12,
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                    {ship.order_number || `#${ship.order_id || ship.id}`}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    {ship.customer_name || 'Kupac'}
                  </div>
                  {ship.status && (
                    <div style={{ marginTop: 4 }}>
                      <span style={{ 
                        background: '#ffc107', 
                        color: '#000', 
                        padding: '2px 8px', 
                        borderRadius: 4, 
                        fontSize: 11,
                        fontWeight: 'bold'
                      }}>
                        {String(ship.status).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Debug Info */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{ 
            marginTop: 16, 
            padding: 12, 
            background: '#1a1a1a', 
            border: '1px solid #333', 
            borderRadius: 8,
            fontSize: 12,
            color: '#9ca3af'
          }}>
            <div><strong>Debug Info:</strong></div>
            <div>User ID: {me?.id || 'N/A'}</div>
            <div>User Role: {me?.role || 'N/A'}</div>
            <div>Online Status: {onlineStatus}</div>
            <div>Last Activity: {lastActivity ? lastActivity.toLocaleString() : 'N/A'}</div>
            <div>Receivings Count: {receivings.length}</div>
            <div>Shippings Count: {shippings.length}</div>
            {receivings.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div><strong>Receivings:</strong></div>
                {receivings.map((r: any, idx: number) => (
                  <div key={idx} style={{ marginLeft: 12, fontSize: 11 }}>
                    #{r.id} - {r.document_number} - Status: {r.status} - Assigned: {r.assigned_user_name || 'N/A'} - Mine: {r.is_mine ? 'Yes' : 'No'}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {receivings.length === 0 && shippings.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: 40, 
            color: '#9ca3af',
            background: '#1a1a1a',
            borderRadius: 12,
            border: '1px solid #333'
          }}>
            <div style={{ fontSize: 18, marginBottom: 8 }}>Nema aktivnih zadataka</div>
            <div style={{ fontSize: 14 }}>Kada ti se dodeli prijem ili otprema, pojaviće se ovde.</div>
            {process.env.NODE_ENV === 'development' && (
              <div style={{ marginTop: 16, fontSize: 12, color: '#666' }}>
                Proveri konzolu za više detalja o učitavanju podataka.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

