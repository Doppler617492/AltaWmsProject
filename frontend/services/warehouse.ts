import { apiClient } from "../lib/apiClient";

export type StatusColor = "neutral" | "empty" | "ok" | "warn" | "over";

export interface RuntimeElement {
  id: string;
  type: string; // AISLE | RACK_BLOCK | RACK_SLOT | STAGING | VIRTUAL_ZONE | DOCK | MATERIAL_STORAGE
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  label?: string;
  aisle_code?: string | null;
  rack_code?: string | null;
  zone_code?: string | null;
  level?: number | null;
  position_index?: number | null;
  location_code?: string | null;
  capacity?: number | null;
  fillRatio?: number | null;
  statusColor?: StatusColor;
}

export interface AisleDetailSlot {
  label: string;
  location_code: string | null;
  capacity: number | null;
  fillRatio: number | null;
  statusColor: StatusColor;
}

export interface AisleDetailRack {
  rack_code: string;
  // matrix [level][position]
  slots: AisleDetailSlot[][];
}

export interface AisleDetailResponse {
  aisle_code: string;
  name: string;
  racks: AisleDetailRack[];
}

export interface SlotStockItem {
  pallet_id?: string;
  sku: string;
  name: string;
  qty: number;
}

export interface SlotInfoResponse {
  locationCode: string;
  zone?: string;
  aisle_code?: string;
  rack_code?: string;
  level?: number;
  position_index?: number;
  capacity?: number | null;
  fillRatio?: number | null;
  items: SlotStockItem[];
  movements: Array<{ reason: string; qty: number; at: string; by?: string }>;
}

// Runtime map with fallback mock
export async function fetchWarehouseRuntime(): Promise<RuntimeElement[]> {
  try {
    const data = await apiClient.get("/warehouse/map/live-stock");
    if (Array.isArray(data)) {
      // The backend returns { slot_code, location_code, fill_percent, status } etc
      // but the map needs RuntimeElement with { id, type, x, y, w, h, location_code, fillRatio, statusColor }
      // For now, return the mock data structure which has the proper shape
      // TODO: Transform backend data to RuntimeElement format
      throw new Error("Need to use mock for now");
    }
    throw new Error("Bad runtime payload");
  } catch (e) {
    // Expanded mock with more visible elements
    const elements: RuntimeElement[] = [];
    
    // Prolazi (4 aisles)
    for (let i = 0; i < 4; i++) {
      elements.push({
        id: `aisle-${i + 1}`,
        type: "AISLE",
        x: 100 + i * 280,
        y: 100,
        w: 240,
        h: 30,
        label: `PROLAZ ${i + 1}`,
        aisle_code: `AISLE-0${i + 1}`,
      });
    }
    
    // Rack blocks per aisle
    for (let a = 0; a < 4; a++) {
      const aisleX = 100 + a * 280;
      // Side A (left)
      for (let r = 0; r < 3; r++) {
        elements.push({
          id: `rack-a${a}-r${r}`,
          type: "RACK_BLOCK",
          x: aisleX + 20,
          y: 150 + r * 120,
          w: 90,
          h: 100,
          rack_code: `RACK-A${a}-${r}`,
        });
        // Slots in this rack
        for (let l = 0; l < 4; l++) {
          for (let p = 0; p < 6; p++) {
            const fillRatio = (l + p) % 7 === 0 ? 1.1 : (l + p) % 5 === 0 ? 0.85 : (l + p) % 3 === 0 ? 0.4 : 0;
            const statusColor: StatusColor = fillRatio === 0 ? "empty" : fillRatio < 0.7 ? "ok" : fillRatio < 1 ? "warn" : "over";
            elements.push({
              id: `slot-a${a}-r${r}-l${l}-p${p}`,
              type: "RACK_SLOT",
              x: aisleX + 25 + p * 14,
              y: 155 + r * 120 + l * 23,
              w: 12,
              h: 20,
              location_code: `${a + 1}A${String(r).padStart(2, '0')}${String(l + 1).padStart(2, '0')}${String(p + 1).padStart(2, '0')}`,
              capacity: 1,
              fillRatio,
              statusColor,
              level: l + 1,
              position_index: p + 1,
              rack_code: `RACK-A${a}-${r}`,
              aisle_code: `AISLE-0${a + 1}`,
            });
          }
        }
      }
      // Side B (right)
      for (let r = 0; r < 3; r++) {
        elements.push({
          id: `rack-b${a}-r${r}`,
          type: "RACK_BLOCK",
          x: aisleX + 130,
          y: 150 + r * 120,
          w: 90,
          h: 100,
          rack_code: `RACK-B${a}-${r}`,
        });
        for (let l = 0; l < 4; l++) {
          for (let p = 0; p < 6; p++) {
            const fillRatio = (l + p + 2) % 7 === 0 ? 1.1 : (l + p + 2) % 5 === 0 ? 0.85 : (l + p + 2) % 3 === 0 ? 0.4 : 0;
            const statusColor: StatusColor = fillRatio === 0 ? "empty" : fillRatio < 0.7 ? "ok" : fillRatio < 1 ? "warn" : "over";
            elements.push({
              id: `slot-b${a}-r${r}-l${l}-p${p}`,
              type: "RACK_SLOT",
              x: aisleX + 135 + p * 14,
              y: 155 + r * 120 + l * 23,
              w: 12,
              h: 20,
              location_code: `${a + 1}B${String(r).padStart(2, '0')}${String(l + 1).padStart(2, '0')}${String(p + 1).padStart(2, '0')}`,
              capacity: 1,
              fillRatio,
              statusColor,
              level: l + 1,
              position_index: p + 1,
              rack_code: `RACK-B${a}-${r}`,
              aisle_code: `AISLE-0${a + 1}`,
            });
          }
        }
      }
    }
    
    // Zones
    elements.push(
      { id: "rampa", type: "DOCK", x: 50, y: 50, w: 150, h: 40, label: "RAMPA", zone_code: "DOCK" },
      { id: "staging", type: "STAGING", x: 1250, y: 100, w: 200, h: 300, label: "STAGING", zone_code: "STAGING" },
      { id: "otprema", type: "OTPREMA", x: 1250, y: 420, w: 200, h: 200, label: "OTPREMNA ZONA", zone_code: "SHIPPING" },
      { id: "virtual", type: "VIRTUAL_ZONE", x: 50, y: 550, w: 300, h: 200, label: "VIRTUELNA ZONA", zone_code: "VIRTUAL" },
      { id: "material", type: "MATERIAL_STORAGE", x: 400, y: 550, w: 250, h: 200, label: "MAGACIN MATERIJALA", zone_code: "MATERIAL" }
    );
    
    return elements;
  }
}

export async function fetchAisleDetail(aisleCode: string): Promise<AisleDetailResponse> {
  try {
    const data = await apiClient.get(`/warehouse/aisle/${encodeURIComponent(aisleCode)}/detail`);
    return data as AisleDetailResponse;
  } catch (e) {
    // Mock simple single rack 3x4
    const slots: AisleDetailSlot[][] = Array.from({ length: 3 }).map((_, level) =>
      Array.from({ length: 4 }).map((_, pos) => ({
        label: `L${level + 1}-P${pos + 1}`,
        location_code: `1A000${level}${pos}`,
        capacity: 1,
        fillRatio: (level + pos) % 4 === 0 ? 1.1 : (level + pos) % 3 === 0 ? 0.85 : (level + pos) % 2 === 0 ? 0.4 : 0,
        statusColor: ((): StatusColor => {
          const fr = (level + pos) % 4 === 0 ? 1.1 : (level + pos) % 3 === 0 ? 0.85 : (level + pos) % 2 === 0 ? 0.4 : 0;
          if (fr === 0) return "empty";
          if (fr < 0.7) return "ok";
          if (fr < 1) return "warn";
          return "over";
        })(),
      }))
    );
    return { aisle_code: aisleCode, name: aisleCode, racks: [{ rack_code: "RACK-A1", slots }] };
  }
}

export async function fetchSlotInfo(locationCode: string): Promise<SlotInfoResponse> {
  try {
    const data = await apiClient.get(`/warehouse/slot/${encodeURIComponent(locationCode)}/stock`);
    return data as SlotInfoResponse;
  } catch (e) {
    return {
      locationCode,
      aisle_code: "AISLE-01",
      rack_code: "RACK-A1",
      level: 1,
      position_index: 2,
      capacity: 1,
      fillRatio: 0.8,
      items: [
        { sku: "SKU-123", name: "Test Artikal", qty: 12 },
      ],
      movements: [
        { reason: "PRIJEM", qty: 12, at: new Date().toISOString() },
      ],
    };
  }
}


