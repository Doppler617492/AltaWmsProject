import { useEffect, useState } from 'react';
import { colors } from '../src/theme/colors';
import ReceivingDocuments from './ReceivingDocuments';
import MojiPrijemi from './MojiPrijemi';
import ActiveReceivings from './ActiveReceivings';
import ControlCenter from './ControlCenter';

interface PrijemProps {
  user?: any;
}

export default function Prijem({ user }: PrijemProps) {
  const [activeSubTab, setActiveSubTab] = useState('Dokumenti prijema');

  const isMagacioner = user?.role === 'magacioner';
  const isSupervisor = ['admin', 'menadzer', 'sef'].includes(user?.role);

  const subTabs = [
    'Dokumenti prijema',
    'Moji prijemi',
    ...(isSupervisor ? ['Aktivni prijemi', 'Kontrolni centar'] as const : []),
    'Foto evidencija',
  ];

  return (
    <div style={styles.wrapper}>
      <div style={styles.hero}>
        <div>
          <div style={styles.heroEyebrow}>Inbound control</div>
          <h1 style={styles.heroTitle}>Prijem robe – real‑time nadzor</h1>
          <p style={styles.heroSubtitle}>Prati dokumente, sopstvene prijeme, aktivne dokove i incidentni centar iz jedinstvene konzole.</p>
        </div>
      </div>
      {/* listen for external navigation to a specific sub-tab */}
      <SubTabBridge onNavigate={(tab:string)=>setActiveSubTab(tab)} />
      <div style={styles.subTabContainer}>
        {subTabs.map((tab) => {
          const isDisabled = tab === 'Foto evidencija';
          return (
            <button
              key={tab as string}
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) setActiveSubTab(tab as string);
              }}
              title={isDisabled ? 'Privremeno onemogućeno' : ''}
              style={{
                ...styles.subTabButton,
                ...(activeSubTab === tab ? styles.activeSubTabButton : {}),
                ...(isDisabled ? styles.disabledSubTabButton : {}),
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      <div style={styles.subTabContent}>
        {activeSubTab === 'Dokumenti prijema' && <ReceivingDocuments />}
        {activeSubTab === 'Moji prijemi' && <MojiPrijemi />}
        {isSupervisor && activeSubTab === 'Aktivni prijemi' && <ActiveReceivings />}
        {isSupervisor && activeSubTab === 'Kontrolni centar' && <ControlCenter />}
        {activeSubTab === 'Foto evidencija' && (
          <div style={styles.placeholder}>
            <h3>Foto evidencija</h3>
            <p>Ova sekcija je privremeno onemogućena.</p>
          </div>
        )}
      </div>
    </div>
  );
} 

function SubTabBridge({ onNavigate }: { onNavigate: (tab:string)=>void }){
  useEffect(() => {
    const handler = (e:any) => { const t = e?.detail?.tab; if (t) onNavigate(t); };
    window.addEventListener('prijem:setSub', handler as any);
    return () => window.removeEventListener('prijem:setSub', handler as any);
  }, []);
  return null;
}

const styles = {
  wrapper: {
    background: "linear-gradient(180deg,#05070d 0%,#020304 100%)",
    minHeight: '100%',
    padding: "2rem clamp(1.5rem,2vw,3rem)",
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    color: '#f8fafc',
  },
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    gap: 12,
  },
  heroEyebrow: {
    textTransform: 'uppercase' as const,
    letterSpacing: 3,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  heroTitle: {
    margin: '6px 0 8px',
    fontSize: 32,
    fontWeight: 700,
  },
  heroSubtitle: {
    margin: 0,
    color: 'rgba(255,255,255,0.65)',
    maxWidth: 540,
  },
  subTabContainer: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap' as const,
    padding: '10px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
  },
  subTabButton: {
    backgroundColor: 'transparent',
    border: 'none',
    padding: '10px 18px',
    borderRadius: 999,
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 600 as const,
    color: 'rgba(255,255,255,0.65)',
    transition: 'background 0.2s ease, color 0.2s ease',
  },
  activeSubTabButton: {
    backgroundColor: colors.brandYellow,
    color: '#111',
  },
  disabledSubTabButton: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },
  subTabContent: {
    background: 'linear-gradient(180deg,#111522,#090b14)',
    color: colors.textPrimary,
    padding: '20px',
    borderRadius: '24px',
    border: '1px solid rgba(255,255,255,0.05)',
    boxShadow: '0 18px 35px rgba(0,0,0,0.45)',
  },
  placeholder: {
    textAlign: 'center' as const,
    padding: '40px',
    color: colors.textSecondary,
  },
};
