import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import AiHelpModal from './AiHelpModal';
import ErpPodaci from './ErpPodaci';
import Prijem from './Prijem';
import MojiPrijemi from './MojiPrijemi';
import { useToast } from './Toast';
import { apiClient } from '../lib/apiClient';
import { colors } from '../src/theme/colors';

interface DashboardProps {
  onLogout: () => void;
  user: any;
}

export default function Dashboard({ onLogout, user }: DashboardProps) {
  const [showAiModal, setShowAiModal] = useState(false);
  const [activeTab, setActiveTab] = useState('ERP PODACI');
  const [hasRisk, setHasRisk] = useState(false);
  const { showToast, ToastContainer } = useToast();
  const toastHandlerSet = useRef(false);

  // Set up toast handler once
  useEffect(() => {
    if (!toastHandlerSet.current) {
      apiClient.setToastHandler(showToast);
      toastHandlerSet.current = true;
    }
    const onNav = (e: any) => {
      const tab = e?.detail?.tab; if (tab) setActiveTab(tab);
    };
    const onRisk = (e: any) => {
      setHasRisk(!!(e?.detail?.risk));
    };
    window.addEventListener('dash:navigate', onNav as any);
    window.addEventListener('dashboard:risk', onRisk as any);
    return () => {
      window.removeEventListener('dash:navigate', onNav as any);
      window.removeEventListener('dashboard:risk', onRisk as any);
    };
  }, []);

  if (!user) {
    return <div style={styles.loading}>Loading user data...</div>;
  }

  const showUsersTab = user && ['admin','sef_magacina','sef'].includes(user.role);
  const showControlTab = user && ['admin','menadzer','sef_magacina'].includes(user.role);
  const showStockTab = user && ['admin','menadzer','sef_magacina'].includes(user.role);
  const showWorkforceTab = user && ['admin','sef_magacina'].includes(user.role);
  const showMapTab = user && ['admin','menadzer','sef','sef_magacina','magacioner'].includes(user.role);
  const showLabelingTab = user && ['admin','sef_magacina'].includes(user.role);
  const showSkartTab = user && ['admin','menadzer','sef','sef_magacina','manager'].includes(user.role);
  const UsersLazy = dynamic(() => import('./Users'), { ssr: false });
  const ControlTowerLazy = dynamic(() => import('./ControlTowerDashboard'), { ssr: false });
  const StockDashboardLazy = dynamic(() => import('./StockDashboard'), { ssr: false });
  const WorkforceDashboardLazy = dynamic(() => import('./WorkforceDashboard'), { ssr: false });
  const LabelingDashboardLazy = dynamic(() => import('./LabelingDashboard'), { ssr: false });
  const SkartDashboardLazy = dynamic(() => import('./SkartDashboard'), { ssr: false });
  const tabs = [
    ...(showControlTab ? ['PREGLED'] : []),
    'ERP PODACI',
    ...(user.role === 'magacioner' ? ['MOJI PRIJEMI'] : []),
    ...(user.role !== 'magacioner' ? ['PRIJEM'] : []),
    ...(showStockTab ? ['ZALIHE'] : []),
    ...(showSkartTab ? ['SKART'] : []),
    ...(showMapTab ? ['MAPA SKLADIŠTA'] : []),
    ...(showLabelingTab ? ['OZNAČAVANJE'] : []),
    ...(user.role !== 'magacioner' ? ['OTPREMA', 'POPIS', 'IZVEŠTAJI', 'ADMIN'] : ['OTPREMA']),
    ...(showUsersTab ? ['KORISNICI'] : []),
    ...(showWorkforceTab ? ['RADNA SNAGA'] : [])
  ];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.logo}>Alta WMS</h1>
          {hasRisk && <span style={{ marginLeft: 8, background:'#dc2626', color:'#fff', padding:'2px 8px', borderRadius: 999, fontSize:12, fontWeight:700 }}>RIZIK</span>}
        </div>
        
        <div style={styles.headerCenter}>
          {tabs.map((tab) => (
            <button 
              key={tab} 
              style={{
                ...styles.tab,
                ...(activeTab === tab ? styles.activeTab : {})
              }}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        
        <div style={styles.headerRight}>
          <span style={styles.userInfo}>Ulogovan: {user?.name || 'User'}</span>
          <button onClick={onLogout} style={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
  <div style={styles.content}>
        {activeTab === 'PREGLED' && showControlTab && <ControlTowerLazy />}
        {activeTab === 'ERP PODACI' && <ErpPodaci />}
        {activeTab === 'PRIJEM' && <Prijem user={user} />}
        {activeTab === 'MOJI PRIJEMI' && <Prijem user={user} />}
        {activeTab === 'KORISNICI' && showUsersTab && <UsersLazy />}
        {activeTab === 'ZALIHE' && showStockTab && <StockDashboardLazy />}
        {activeTab === 'SKART' && showSkartTab && <SkartDashboardLazy user={user} />}
        {activeTab === 'MAPA SKLADIŠTA' && showMapTab && (
          <iframe 
            src="/map" 
            style={{ width: '100%', height: 'calc(100vh - 100px)', border: 'none' }}
          />
        )}
        {activeTab === 'RADNA SNAGA' && showWorkforceTab && <WorkforceDashboardLazy />}
        {activeTab === 'OZNAČAVANJE' && showLabelingTab && <LabelingDashboardLazy />}
        {/* Placeholder for tabs without implementation */}
        {['OTPREMA','POPIS','IZVEŠTAJI','ADMIN'].includes(activeTab) && (
          <div style={styles.placeholder}>
            <h2>{activeTab}</h2>
            <p>Ovaj modul će biti implementiran u sledećoj fazi</p>
          </div>
        )}
      </div>

      {/* AI Help Button */}
      <button 
        onClick={() => setShowAiModal(true)}
        style={styles.aiButton}
      >
        AI pomoć?
      </button>

      {/* AI Modal */}
      {showAiModal && (
        <AiHelpModal onClose={() => setShowAiModal(false)} />
      )}

      {/* Toast Container */}
      <ToastContainer />
    </div>
  );
}

  const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    backgroundColor: '#000',
    color: '#ffc107',
    padding: '15px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
  },
  headerLeft: {
    flex: '0 0 auto',
  },
  logo: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 'bold',
  },
  headerCenter: {
    flex: '1',
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    margin: '0 20px',
  },
  tab: {
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  activeTab: {
    backgroundColor: '#ffc107',
    color: '#000',
  },
  headerRight: {
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
  },
  userInfo: {
    fontSize: '14px',
  },
  logoutBtn: {
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  content: {
    padding: '40px 20px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  placeholder: {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    textAlign: 'center' as const,
  },
  aiButton: {
    position: 'fixed' as const,
    bottom: '20px',
    right: '20px',
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '25px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
    color: '#666',
  },
};
