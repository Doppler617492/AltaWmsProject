export interface ReceiveSkartItemDto {
  code: string;
  receivedQty: number;
}

export interface ReceiveSkartDto {
  items: ReceiveSkartItemDto[];
  note?: string;
}


