interface Props {
  status: 'U RADU' | 'SLOŽENO' | 'POTVRĐENO' | string;
}

export default function StatusBadge({ status }: Props) {
  const map: Record<string, { text: string; color: string }> = {
    'U RADU': { text: 'U RADU', color: '#6c757d' },
    'SLOŽENO': { text: 'SLOŽENO', color: '#ffc107' },
    'POTVRĐENO': { text: 'POTVRĐENO', color: '#28a745' },
    'U PRIPREMI': { text: 'U PRIPREMI', color: '#6366f1' },
  };
  const cfg = map[status] || { text: status, color: '#999' };
  return (
    <span style={{
      padding: '4px 8px',
      borderRadius: 16,
      fontWeight: 'bold',
      border: `2px solid ${cfg.color}`,
      color: cfg.color,
      background: 'transparent',
      fontSize: 12,
      textTransform: 'uppercase',
    }}>
      {cfg.text}
    </span>
  );
}

