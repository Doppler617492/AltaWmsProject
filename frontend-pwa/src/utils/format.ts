/**
 * Format percentage with suffix
 */
export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format number with thousand separators
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('sr-Latn-RS').format(value);
}

/**
 * Get plural form based on count
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const pluralForm = plural || `${singular}a`;
  return count === 1 ? singular : pluralForm;
}

/**
 * Calculate remaining quantity
 */
export function calculateRemaining(requested: number, received: number): number {
  return Math.max(0, requested - received);
}

/**
 * Get status for an item based on quantities
 */
export function getItemStatus(item: { requested: number; received: number; critical?: boolean }): 'OK' | 'CRITICAL' | 'SHORTAGE' | 'EXCESS' | 'CONFIRMED' | 'UNPROCESSED' {
  const { requested, received, critical } = item;
  
  if (received === 0) return 'UNPROCESSED';
  if (received === requested) return 'CONFIRMED';
  if (received > requested) return 'EXCESS';
  if (received < requested * 0.5) return 'CRITICAL';
  if (received < requested) return 'SHORTAGE';
  
  return critical ? 'CRITICAL' : 'OK';
}

/**
 * Format date/time
 */
export function formatDateTime(dateString?: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('sr-Latn-RS', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '';
  }
}







