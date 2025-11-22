export type ItemStatus = 'OK' | 'CRITICAL' | 'SHORTAGE' | 'EXCESS' | 'CONFIRMED' | 'UNPROCESSED';

export type ShipmentStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ERROR';

export type FilterType = 'ALL' | 'CRITICAL' | 'SHORTAGE' | 'EXCESS' | 'CONFIRMED';

export type SortType = 'NAME_ASC' | 'NAME_DESC' | 'MOST_REQUESTED' | 'UNPROCESSED';

export interface Item {
  id: string;
  code: string;
  name: string;
  requested: number;
  received: number;
  critical?: boolean;
  note?: string;
  variant?: string;
  lot?: string;
  serials?: string[];
  scanHistory?: Array<{ timestamp: string; user: string; note?: string }>;
}

export interface Shipment {
  id: string;
  status: ShipmentStatus;
  items: Item[];
  progressPct: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ItemCardProps {
  item: Item;
  onConfirm: (itemId: string) => void;
  onEdit: (item: Item) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isLoading?: boolean;
}

export interface RightPanelProps {
  item: Item | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (itemId: string, received: number, note?: string) => void;
  isLoading?: boolean;
}












