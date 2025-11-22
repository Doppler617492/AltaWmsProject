import { apiClient } from "../lib/apiClient";

export type PutawayStatus = "ASSIGNED" | "IN_PROGRESS" | "DONE" | "BLOCKED";

export interface PutawayTask {
  id: number;
  pallet_id: string;
  item_sku: string;
  item_name: string;
  quantity: number;
  uom: string;
  from: string;
  to: string;
  assigned_user?: string;
  assigned_user_id?: number;
  status: PutawayStatus;
  age_minutes?: number;
}

export async function fetchActivePutawayTasks(): Promise<PutawayTask[]> {
  try {
    const data = await apiClient.get('/putaway/tasks/active');
    return Array.isArray(data) ? data : [];
  } catch {
    // mock
    return [
      { id: 79, pallet_id: 'PAL-00022', item_sku: 'LIM-2MM', item_name: 'LIM 2mm ČELIK', quantity: 12, uom: 'PAL', from: 'STAGING-B', to: '1B0004', assigned_user: 'Sabin', assigned_user_id: 8, status: 'ASSIGNED', age_minutes: 3 },
      { id: 80, pallet_id: 'PAL-00023', item_sku: 'MAT0000015', item_name: 'AL PROFIL 40x40', quantity: 24, uom: 'KOM', from: 'STAGING-A1', to: '1A0007', assigned_user: 'Marko', assigned_user_id: 5, status: 'IN_PROGRESS', age_minutes: 12 },
    ];
  }
}


