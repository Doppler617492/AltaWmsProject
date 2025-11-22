import { useState, useEffect, useCallback } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const getToastStyle = () => {
    const baseStyle = {
      position: 'fixed' as const,
      top: '20px',
      right: '20px',
      padding: '15px 20px',
      borderRadius: '8px',
      color: 'white',
      fontWeight: 'bold',
      zIndex: 10000,
      maxWidth: '400px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      cursor: 'pointer',
    };

    switch (type) {
      case 'success':
        return { ...baseStyle, backgroundColor: '#4CAF50' };
      case 'error':
        return { ...baseStyle, backgroundColor: '#F44336' };
      case 'warning':
        return { ...baseStyle, backgroundColor: '#FF9800' };
      case 'info':
        return { ...baseStyle, backgroundColor: '#2196F3' };
      default:
        return { ...baseStyle, backgroundColor: '#666' };
    }
  };

  return (
    <div style={getToastStyle()} onClick={onClose}>
      {message}
    </div>
  );
}

// Toast manager hook
export function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' | 'warning' | 'info' }>>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const ToastContainer = () => (
    <div style={{ position: 'fixed', top: 0, right: 0, zIndex: 10000 }}>
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );

  return { showToast, ToastContainer };
}
