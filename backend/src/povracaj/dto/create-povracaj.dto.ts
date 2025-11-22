export interface CreatePovracajItemDto {
  code: string;
  name: string;
  qty: number;
  reason: string;
  note?: string;
  photos?: string[]; // base64 encoded photos for this specific item
}

export interface CreatePovracajDto {
  storeId?: number | null;
  note?: string;
  items: CreatePovracajItemDto[];
  photos?: string[]; // base64 encoded (data URL or raw base64) - legacy support, deprecated
}

