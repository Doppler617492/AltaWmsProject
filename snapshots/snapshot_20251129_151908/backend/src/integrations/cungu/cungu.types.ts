export interface CunguLoginResponse {
  status: number;
  token: string;
}

export type CunguFilterOperator =
  | '='
  | '>'
  | '<'
  | '>='
  | '<='
  | '!='
  | '<>'
  | 'like'
  | 'between'
  | 'in';

export interface CunguFilterDescriptor {
  operator: CunguFilterOperator;
  value: unknown;
}

export interface CunguRequestPayload<TFilters = Record<string, CunguFilterDescriptor>> {
  method: string;
  filters?: TFilters;
  offset?: number;
  limit?: number;
  [key: string]: unknown;
}

export interface CunguIssueDocumentLine {
  Poz: number;
  Ident: string;
  Naziv: string;
  Kolicina: number;
  JM: string;
}

export interface CunguIssueDocument {
  BrojDokumenta: string;
  TipDokumenta: string;
  DatumDokumenta: string;
  NasObjekat: string;
  Primalac1?: string;
  Primalac2?: string;
  Posiljalac?: string;
  OdgovornaOsoba?: string;
  StatusDokumenta: string;
  Napomena?: string;
  Objekti: CunguIssueDocumentLine[];
}

export interface CunguStockRecord {
  IdSubjekta: number;
  NazivSubjekta: string;
  Naziv2Subjekta?: string;
  Drzava?: string;
  Grad?: string;
  Adresa?: string;
  PIB?: string;
  Telefon1?: string;
  Telefon2?: string;
  Skladiste?: string;
  Kupac?: 'T' | 'F';
  Dobavljac?: 'T' | 'F';
}

// Response from getStock API - per article with store breakdown
export interface CunguStockItem {
  Ident: string;            // Article code/SKU
  Objekti: Array<{
    Objekat: string;        // Store/warehouse name (e.g., "Prodavnica - Podgorica Centar")
    Zaliha: number;         // Stock quantity at this location
  }>;                       // Array of stores/warehouses with quantities
}

export interface CunguApiErrorResponse {
  errorCode: number;
  message: string;
  status?: number;
}

export type Nullable<T> = T | null;

export interface CunguClientOptions {
  baseUrl: string;
  username: string;
  password: string;
  /**
   * Fallback token lifetime in milliseconds.
   * The upstream API does not expose TTL, pa default 55 minutes.
   */
  tokenTtlMs?: number;
}

export interface CunguWrappedResponse<T> {
  status?: number;
  data: T;
}


