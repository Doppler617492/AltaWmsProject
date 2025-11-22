class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else if (typeof window !== 'undefined') {
      // Prefer local proxy to backend to avoid CORS/network issues
      this.baseUrl = `${window.location.origin}/api/fresh`;
    } else {
      this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    }
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return token ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } : { 'Content-Type': 'application/json' };
  }

  async get(endpoint: string) {
    const res = await fetch(`${this.baseUrl}${endpoint}`, { headers: this.getAuthHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async post(endpoint: string, data?: any) {
    const res = await fetch(`${this.baseUrl}${endpoint}`, { method: 'POST', headers: this.getAuthHeaders(), body: data ? JSON.stringify(data) : undefined });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async postForm(endpoint: string, formData: FormData) {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
    const res = await fetch(`${this.baseUrl}${endpoint}`, { method: 'POST', headers, body: formData });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async patch(endpoint: string, data?: any) {
    const res = await fetch(`${this.baseUrl}${endpoint}`, { method: 'PATCH', headers: this.getAuthHeaders(), body: data ? JSON.stringify(data) : undefined });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
}

export const apiClient = new ApiClient();
