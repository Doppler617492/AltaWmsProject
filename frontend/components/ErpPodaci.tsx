import { useState } from 'react';
import { colors } from '../src/theme/colors';
import Artikli from './Artikli';
import Dobavljaci from './Dobavljaci';
import ZalihaNaLokacijama from './ZalihaNaLokacijama';
import ZalihaNaZonama from './ZalihaNaZonama';

export default function ErpPodaci() {
  const [activeSubTab, setActiveSubTab] = useState('Artikli');

  const subTabs = [
    'Artikli',
    'Dobavljači',
    'Kupci',
    'Prevoznici',
    'Zaliha na lokacijama',
    'Zaliha na zonama'
  ];

  const dynamicStyles = {
    container: {
      backgroundColor: colors.bgPanel,
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
      overflow: 'hidden',
    },
    subNav: {
      backgroundColor: colors.bgPanelAlt,
      padding: '15px 20px',
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap' as const,
    },
    subTab: {
      backgroundColor: colors.brandYellow,
      color: '#000',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 'bold',
    },
    activeSubTab: {
      backgroundColor: colors.bgBody,
      color: colors.textPrimary,
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
    },
    disabledTab: {
      backgroundColor: '#666',
      color: '#999',
      cursor: 'not-allowed',
    },
    content: {
      padding: '20px',
      minHeight: '600px',
      backgroundColor: colors.bgBody,
      color: colors.textPrimary,
    },
  };

  return (
    <div style={dynamicStyles.container}>
      {/* Sub Navigation */}
      <div style={dynamicStyles.subNav}>
        {subTabs.map((tab) => (
          <button
            key={tab}
            style={{
              ...dynamicStyles.subTab,
              ...(activeSubTab === tab ? dynamicStyles.activeSubTab : {}),
              ...(tab === 'Kupci' || tab === 'Prevoznici' ? dynamicStyles.disabledTab : {})
            }}
            onClick={() => {
              if (tab !== 'Kupci' && tab !== 'Prevoznici') {
                setActiveSubTab(tab);
              }
            }}
            disabled={tab === 'Kupci' || tab === 'Prevoznici'}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={dynamicStyles.content}>
        {activeSubTab === 'Artikli' && <Artikli />}
        {activeSubTab === 'Dobavljači' && <Dobavljaci />}
        {activeSubTab === 'Zaliha na lokacijama' && <ZalihaNaLokacijama />}
        {activeSubTab === 'Zaliha na zonama' && <ZalihaNaZonama />}
      </div>
    </div>
  );
}
