import { useState } from 'react';
import { colors } from '../src/theme/colors';
import { apiClient } from '../lib/apiClient';

interface AiHelpModalProps {
  onClose: () => void;
}

interface AiResponse {
  answer: string;
  highlight?: {
    type: string;
    code?: string;
    coordinates?: { x: number; y: number };
    rack?: string;
    side?: string;
    aisle?: string;
    zone?: string;
  };
  path?: string[];
}

export default function AiHelpModal({ onClose }: AiHelpModalProps) {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<AiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await apiClient.post('/agent/query', { question });
      setResponse(data);
    } catch (err) {
      setResponse({ answer: 'Greška pri povezivanju sa serverom' });
    } finally {
      setLoading(false);
    }
  };

  const getStyles = () => ({
    overlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
    modal: {
      backgroundColor: colors.bgPanel,
      borderRadius: '8px',
      width: '500px',
      maxWidth: '90vw',
      maxHeight: '80vh',
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
    },
    header: {
      backgroundColor: colors.bgPanelAlt,
      color: colors.brandYellow,
      padding: '15px 20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    closeBtn: {
      backgroundColor: 'transparent',
      color: colors.brandYellow,
      border: 'none',
      fontSize: '24px',
      cursor: 'pointer',
      padding: 0,
      width: '30px',
      height: '30px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      padding: '20px',
      backgroundColor: colors.bgPanel,
      color: colors.textPrimary,
    },
    form: {
      display: 'flex',
      gap: '10px',
      marginBottom: '20px',
    },
    input: {
      flex: 1,
      padding: '10px',
      border: `1px solid ${colors.borderCard}`,
      borderRadius: '4px',
      fontSize: '16px',
      backgroundColor: colors.bgBody,
      color: colors.textPrimary,
    },
    submitBtn: {
      backgroundColor: colors.brandYellow,
      color: '#000',
      border: 'none',
      padding: '10px 20px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '16px',
      fontWeight: 'bold',
    },
    answer: {
      backgroundColor: colors.bgBody,
      padding: '15px',
      borderRadius: '4px',
      border: `1px solid ${colors.borderCard}`,
      color: colors.textPrimary,
    },
    highlight: {
      backgroundColor: 'rgba(33,150,243,0.2)',
      padding: '10px',
      borderRadius: '4px',
      marginTop: '10px',
      border: '1px solid #2196f3',
      color: colors.textPrimary,
    },
    path: {
      backgroundColor: 'rgba(156,39,176,0.2)',
      padding: '10px',
      borderRadius: '4px',
      marginTop: '10px',
      border: '1px solid #9c27b0',
      color: colors.textPrimary,
    },
    pathSteps: {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap' as const,
      gap: '5px',
      marginTop: '5px',
    },
    pathStep: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      backgroundColor: colors.bgPanel,
      padding: '5px 10px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 'bold',
      color: colors.textPrimary,
    },
    pathArrow: {
      color: '#9c27b0',
      fontWeight: 'bold',
    },
  });

  const dynamicStyles = getStyles();

  return (
    <div style={dynamicStyles.overlay}>
      <div style={dynamicStyles.modal}>
        <div style={dynamicStyles.header}>
          <h2 style={{ margin: 0, color: colors.brandYellow }}>AI Pomoć</h2>
          <button onClick={onClose} style={dynamicStyles.closeBtn}>
            ×
          </button>
        </div>
        
        <div style={dynamicStyles.content}>
          <form onSubmit={handleSubmit} style={dynamicStyles.form}>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Postavite pitanje..."
              style={dynamicStyles.input}
              required
            />
            <button 
              type="submit" 
              disabled={loading}
              style={dynamicStyles.submitBtn}
            >
              {loading ? 'Pitam...' : 'Pitaj'}
            </button>
          </form>
          
          {response && (
            <div style={dynamicStyles.answer}>
              <strong>AI Odgovor:</strong>
              <p>{response.answer}</p>
              
              {response.highlight && (
                <div style={dynamicStyles.highlight}>
                  <strong>Lokacija:</strong>
                  {response.highlight.type === 'location' && (
                    <div>
                      <p>Kod: {response.highlight.code}</p>
                      {response.highlight.coordinates && (
                        <p>Koordinata: ({response.highlight.coordinates.x}, {response.highlight.coordinates.y})</p>
                      )}
                    </div>
                  )}
                  {response.highlight.type === 'rack' && (
                    <div>
                      <p>Regal: {response.highlight.rack} {response.highlight.side}</p>
                      <p>Prolaz: {response.highlight.aisle}</p>
                    </div>
                  )}
                  {response.highlight.type === 'aisle' && (
                    <div>
                      <p>Prolaz: {response.highlight.aisle}</p>
                      <p>Zona: {response.highlight.zone}</p>
                    </div>
                  )}
                </div>
              )}
              
              {response.path && response.path.length > 0 && (
                <div style={dynamicStyles.path}>
                  <strong>Putanja:</strong>
                  <div style={dynamicStyles.pathSteps}>
                    {response.path.map((step, index) => (
                      <div key={index} style={dynamicStyles.pathStep}>
                        {index > 0 && <span style={dynamicStyles.pathArrow}>→</span>}
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {};
