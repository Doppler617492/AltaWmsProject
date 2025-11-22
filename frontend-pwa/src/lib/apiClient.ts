import { apiClient as base } from '../../lib/apiClient';

export const apiClient = base;

export async function getMyActiveReceivings() {
  return base.get('/receiving/my-active');
}

export async function startReceiving(documentId: number, assignedToUserId: number) {
  return base.patch(`/receiving/documents/${documentId}/start`, { assigned_to_user_id: assignedToUserId });
}

export async function getReceivingDetail(documentId: number) {
  return base.get(`/receiving/documents/${documentId}`);
}

export async function patchReceivingItem(itemId: number, body: any) {
  return base.patch(`/receiving/items/${itemId}`, body);
}

export async function completeReceiving(documentId: number) {
  return base.patch(`/receiving/documents/${documentId}/complete`);
}

export async function resolveLocation(code: string) {
  return base.get(`/warehouse/location/${encodeURIComponent(code)}`);
}

export async function getStockImpactByDocument(documentId: number) {
  return base.get(`/stock/inventory/by-document/${documentId}`);
}

export async function getRecommendedLocationsBySku(sku: string) {
  try {
    // If warehouse path endpoint exists, try it
    return base.get(`/warehouse/path/${encodeURIComponent(sku)}`);
  } catch (e) {
    throw e;
  }
}

export async function getSkartDocumentByUid(uid: string) {
  return base.get(`/skart/${encodeURIComponent(uid)}`);
}

export async function receiveSkartDocument(uid: string, payload: any) {
  return base.patch(`/skart/${encodeURIComponent(uid)}/receive`, payload);
}

export async function uploadSkartDocumentPhoto(uid: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return base.post(`/skart/${encodeURIComponent(uid)}/photos`, form);
}

export async function getSkartSummary(window: string = 'today') {
  return base.get(`/skart/reports/summary?window=${encodeURIComponent(window)}`);
}

export async function createSkartDocument(payload: any) {
  return base.post('/skart', payload);
}

export async function listSkartDocuments(params: { status?: string; assignedToUserId?: number } = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (typeof params.assignedToUserId === 'number') query.set('assignedToUserId', String(params.assignedToUserId));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return base.get(`/skart${suffix}`);
}

export async function getPovracajDocumentByUid(uid: string) {
  return base.get(`/povracaj/${encodeURIComponent(uid)}`);
}

export async function receivePovracajDocument(uid: string, payload: any) {
  return base.patch(`/povracaj/${encodeURIComponent(uid)}/receive`, payload);
}

export async function uploadPovracajDocumentPhoto(uid: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return base.post(`/povracaj/${encodeURIComponent(uid)}/photos`, form);
}

export async function getPovracajSummary(window: string = 'today') {
  return base.get(`/povracaj/reports/summary?window=${encodeURIComponent(window)}`);
}

export async function createPovracajDocument(payload: any) {
  return base.post('/povracaj', payload);
}

export async function listPovracajDocuments(params: { status?: string; assignedToUserId?: number } = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (typeof params.assignedToUserId === 'number') query.set('assignedToUserId', String(params.assignedToUserId));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return base.get(`/povracaj${suffix}`);
}

export async function getMyShippingOrders() {
  return base.get('/shipping/my-orders');
}

export async function searchItems(search: string) {
  if (!search) return [];
  const params = new URLSearchParams();
  params.set('limit', '25');
  params.set('search', search.trim());
  const res = await base.get(`/stock/pantheon/items?${params.toString()}`);
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res)) return res;
  return [];
}
