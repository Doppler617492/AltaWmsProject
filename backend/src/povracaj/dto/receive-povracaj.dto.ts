export interface ReceivePovracajItemDto {
  code: string;
  receivedQty: number;
}

export interface ReceivePovracajDto {
  items: ReceivePovracajItemDto[];
  note?: string;
}

