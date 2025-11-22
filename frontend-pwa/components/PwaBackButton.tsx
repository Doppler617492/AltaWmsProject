import { useRouter } from 'next/router';
import { useCallback, type CSSProperties } from 'react';

interface Props {
  label?: string;
  fallbackHref?: string;
  style?: CSSProperties;
}

export default function PwaBackButton({
  label = '← Nazad na dashboard',
  fallbackHref = '/pwa/home',
  style,
}: Props) {
  const router = useRouter();

  const handleClick = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }, [router, fallbackHref]);

  return (
    <button
      onClick={handleClick}
      className="focus-ring"
      style={{
        background: 'rgba(250,204,21,0.1)',
        color: '#fde68a',
        border: '1px solid rgba(250,204,21,0.35)',
        padding: '10px 16px',
        borderRadius: 12,
        fontWeight: 600,
        letterSpacing: '0.4px',
        fontSize: 13,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        transition: 'all 0.2s',
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(250,204,21,0.15)';
        e.currentTarget.style.borderColor = 'rgba(250,204,21,0.5)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(250,204,21,0.1)';
        e.currentTarget.style.borderColor = 'rgba(250,204,21,0.35)';
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>←</span>
      <span>{label}</span>
    </button>
  );
}

