import { apiClient } from '../lib/apiClient';

export async function fetchActiveOrders() {
  return apiClient.get('/shipping/active');
}

export async function createOrder(body: any) {
  return apiClient.post('/shipping/order', body);
}

export async function startOrder(id: number, assigned_user_id: number) {
  return apiClient.patch(`/shipping/order/${id}/start`, { assigned_user_id });
}

export async function stageOrder(id: number) {
  return apiClient.patch(`/shipping/order/${id}/stage`);
}

export async function loadOrder(id: number) {
  return apiClient.patch(`/shipping/order/${id}/load`);
}

export async function closeOrder(id: number) {
  return apiClient.patch(`/shipping/order/${id}/close`);
}

export async function fetchStores() {
  return apiClient.get('/stores');
}

export async function createStore(storeData: any) {
  return apiClient.post('/stores', storeData);
}

export async function importFromExcel(file: File, customerName: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('customer_name', customerName);
  
  const token = localStorage.getItem('token');
  const response = await fetch('/api/fresh/shipping/import', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Import failed' }));
    throw new Error(error.message || 'Import failed');
  }
  
  return response.json();
}

export async function importFromExcelPreview(file: File, customerName: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('customer_name', customerName);
  formData.append('preview', 'true');

  const token = localStorage.getItem('token');
  const response = await fetch('/api/fresh/shipping/import', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Preview failed' }));
    throw new Error(error.message || 'Preview failed');
  }
  return response.json();
}

export async function fetchOrderDetail(id: number) {
  return apiClient.get(`/shipping/order/${id}`);
}

export async function deleteOrdersBulk(orderIds: number[]) {
  return apiClient.post('/shipping/orders/bulk-delete', { orderIds });
}
