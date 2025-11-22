class ApiClient {
  private baseUrl: string;
  private showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
  }

  setToastHandler(showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void) {
    this.showToast = showToast;
  }

  private resolveBase(): string {
    if (typeof window !== 'undefined') {
      try {
        const override = window.localStorage.getItem('API_URL');
        if (override && /^https?:\/\//.test(override)) return override;
      } catch {}
      // Use same-origin proxy to avoid CORS/host issues
      return '/api/proxy';
    }
    const envBase = (process.env.NEXT_PUBLIC_API_URL as string) || '';
    return envBase || this.baseUrl;
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found');
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  private async handleResponse(response: Response) {
    if (response.status === 401) {
      // Auto logout on 401
      localStorage.removeItem('token');
      this.showToast?.('Sesija je istekla. Prijavite se ponovo.', 'error');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
      throw new Error('Sesija je istekla. Prijavite se ponovo.');
    }
    
    if (response.status === 403) {
      this.showToast?.('Nemate dozvolu za pregled mape skladišta. Obratite se nadređenom.', 'error');
      throw new Error('Nemate dozvolu za pregled mape skladišta. Obratite se nadređenom.');
    }

    if (!response.ok) {
      // Try to extract server message for human-friendly errors
      let message = `Greška (${response.status})`;
      try {
        const text = await response.text();
        try {
          const json = JSON.parse(text);
          if (json && (json.message || json.error)) {
            message = Array.isArray(json.message) ? json.message.join(', ') : (json.message || json.error);
          }
        } catch {
          if (text && text.length < 300) message = text;
        }
      } catch {}
      this.showToast?.(message, 'error');
      throw new Error(message);
    }

    return response.json();
  }

  private async fetchWithFallback(urlPath: string, init: RequestInit) {
    const baseInit: RequestInit = { ...init, cache: 'no-store' };
    const sep = urlPath.includes('?') ? '&' : '?';
    const bust = `${sep}__ts=${Date.now()}`;
    // Always prefer same-origin proxies to avoid CORS
    // 1) Fresh proxy
    try {
      const r = await fetch(`/api/fresh${urlPath}${bust}`, baseInit);
      if (r.status !== 502) return r;
    } catch {}
    // 2) Legacy proxy
    try {
      const r = await fetch(`/api/proxy${urlPath}${bust}`, baseInit);
      return r;
    } catch (e) {
      throw e;
    }
  }

  async get(endpoint: string) {
    try {
      let response = await this.fetchWithFallback(endpoint, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (response.status === 304) {
        // Retry with cache buster if intermediary returned 304
        const sep = endpoint.includes('?') ? '&' : '?';
        response = await this.fetchWithFallback(`${endpoint}${sep}__ts=${Date.now()}` as any, {
          method: 'GET',
          headers: this.getAuthHeaders(),
        });
      }
      return this.handleResponse(response);
    } catch (error) {
      if (error instanceof Error && error.message.includes('No authentication token')) {
        window.location.href = '/';
        throw error;
      }
      throw error;
    }
  }

  async post(endpoint: string, data?: any) {
    try {
      const isFormData = data instanceof FormData;
      const headers: HeadersInit = isFormData ? {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      } : this.getAuthHeaders();
      
      const response = await this.fetchWithFallback(endpoint, {
        method: 'POST',
        headers,
        body: data ? (isFormData ? data : JSON.stringify(data)) : undefined,
      });
      return this.handleResponse(response);
    } catch (error) {
      if (error instanceof Error && error.message.includes('No authentication token')) {
        window.location.href = '/';
        throw error;
      }
      throw error;
    }
  }

  async patch(endpoint: string, data?: any) {
    try {
      const response = await this.fetchWithFallback(endpoint, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: data ? JSON.stringify(data) : undefined,
      });
      return this.handleResponse(response);
    } catch (error) {
      if (error instanceof Error && error.message.includes('No authentication token')) {
        window.location.href = '/';
        throw error;
      }
      throw error;
    }
  }

  async put(endpoint: string, data?: any) {
    try {
      const response = await this.fetchWithFallback(endpoint, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: data ? JSON.stringify(data) : undefined,
      });
      return this.handleResponse(response);
    } catch (error) {
      if (error instanceof Error && error.message.includes('No authentication token')) {
        window.location.href = '/';
        throw error;
      }
      throw error;
    }
  }

  async delete(endpoint: string) {
    try {
      const response = await this.fetchWithFallback(endpoint, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse(response);
    } catch (error) {
      if (error instanceof Error && error.message.includes('No authentication token')) {
        window.location.href = '/';
        throw error;
      }
      throw error;
    }
  }

  async getSkartDocuments(params?: { status?: string; limit?: number; offset?: number }) {
    const search = new URLSearchParams();
    if (params?.status) search.append('status', params.status);
    if (typeof params?.limit === 'number') search.append('limit', String(params.limit));
    if (typeof params?.offset === 'number') search.append('offset', String(params.offset));
    const query = search.toString();
    return this.get(`/skart${query ? `?${query}` : ''}`);
  }

  async createSkartDocument(payload: any) {
    return this.post('/skart', payload);
  }

  async getSkartDocument(uid: string) {
    return this.get(`/skart/${uid}`);
  }

  async receiveSkart(uid: string, payload: any) {
    return this.patch(`/skart/${uid}/receive`, payload);
  }

  async uploadSkartPhoto(uid: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.post(`/skart/${uid}/photos`, form);
  }

  async getSkartSummary(params?: { window?: string; from?: string; to?: string; storeId?: number }) {
    const search = new URLSearchParams();
    if (params?.window) search.append('window', params.window);
    if (params?.from) search.append('from', params.from);
    if (params?.to) search.append('to', params.to);
    if (typeof params?.storeId === 'number') search.append('storeId', String(params.storeId));
    const query = search.toString();
    return this.get(`/skart/reports/summary${query ? `?${query}` : ''}`);
  }

  async getSkartAnomalies(params?: { window?: string }) {
    const search = new URLSearchParams();
    if (params?.window) search.append('window', params.window);
    const query = search.toString();
    return this.get(`/skart/reports/anomalies${query ? `?${query}` : ''}`);
  }

  async downloadSkartPdf(uid: string) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No authentication token found');
    const response = await fetch(`/api/fresh/skart/qr/${uid}/pdf?__ts=${Date.now()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error('Preuzimanje PDF dokumenta nije uspelo.');
    }
    return response.blob();
  }

  async deleteSkartDocument(uid: string) {
    return this.delete(`/skart/${uid}`);
  }

  async assignSkartDocument(uid: string, assignedToUserId: number | null) {
    return this.patch(`/skart/${uid}/assign`, { assignedToUserId });
  }

  async getPovracajDocuments(params?: { status?: string; limit?: number; offset?: number }) {
    const search = new URLSearchParams();
    if (params?.status) search.append('status', params.status);
    if (typeof params?.limit === 'number') search.append('limit', String(params.limit));
    if (typeof params?.offset === 'number') search.append('offset', String(params.offset));
    const query = search.toString();
    return this.get(`/povracaj${query ? `?${query}` : ''}`);
  }

  async createPovracajDocument(payload: any) {
    return this.post('/povracaj', payload);
  }

  async getPovracajDocument(uid: string) {
    return this.get(`/povracaj/${uid}`);
  }

  async receivePovracaj(uid: string, payload: any) {
    return this.patch(`/povracaj/${uid}/receive`, payload);
  }

  async uploadPovracajPhoto(uid: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.post(`/povracaj/${uid}/photos`, form);
  }

  async getPovracajSummary(params?: { window?: string; from?: string; to?: string; storeId?: number }) {
    const search = new URLSearchParams();
    if (params?.window) search.append('window', params.window);
    if (params?.from) search.append('from', params.from);
    if (params?.to) search.append('to', params.to);
    if (typeof params?.storeId === 'number') search.append('storeId', String(params.storeId));
    const query = search.toString();
    return this.get(`/povracaj/reports/summary${query ? `?${query}` : ''}`);
  }

  async getPovracajAnomalies(params?: { window?: string }) {
    const search = new URLSearchParams();
    if (params?.window) search.append('window', params.window);
    const query = search.toString();
    return this.get(`/povracaj/reports/anomalies${query ? `?${query}` : ''}`);
  }

  async downloadPovracajPdf(uid: string) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No authentication token found');
    const response = await fetch(`/api/fresh/povracaj/qr/${uid}/pdf?__ts=${Date.now()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error('Preuzimanje PDF dokumenta nije uspelo.');
    }
    return response.blob();
  }

  async deletePovracajDocument(uid: string) {
    return this.delete(`/povracaj/${uid}`);
  }

  async assignPovracajDocument(uid: string, assignedToUserId: number | null) {
    return this.patch(`/povracaj/${uid}/assign`, { assignedToUserId });
  }
}

export const apiClient = new ApiClient();
