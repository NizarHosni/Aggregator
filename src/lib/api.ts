// Default API URL for local development
const DEFAULT_API_URL = 'http://localhost:3001/api';

// Check if we should use Netlify function proxy (in production on Netlify)
const USE_PROXY = import.meta.env.PROD && typeof window !== 'undefined' && window.location.hostname.includes('netlify.app');

// Get API URL from environment and ensure it doesn't have trailing slash
// If VITE_API_URL doesn't end with /api, add it
let envApiUrl = import.meta.env.VITE_API_URL || DEFAULT_API_URL;
envApiUrl = envApiUrl.endsWith('/') ? envApiUrl.slice(0, -1) : envApiUrl;

// Ensure the URL ends with /api
const BACKEND_API_URL = envApiUrl.endsWith('/api') ? envApiUrl : `${envApiUrl}/api`;

// Use Netlify function proxy in production, direct API in development
const API_URL = USE_PROXY ? '/.netlify/functions/api-proxy' : BACKEND_API_URL;

// Debug: Log API URL in development
if (import.meta.env.DEV) {
  console.log('🔗 API URL:', API_URL);
  console.log('🌍 Environment:', import.meta.env.MODE);
}

// Get auth token from localStorage
function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

// Set auth token in localStorage
function setToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

// Remove auth token from localStorage
function removeToken(): void {
  localStorage.removeItem('auth_token');
}

// API request helper
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If using proxy, add path as query parameter
  let url: string;
  if (USE_PROXY) {
    // For proxy, add the endpoint path as a query parameter
    url = `${API_URL}?path=${encodeURIComponent(endpoint)}`;
  } else {
    url = `${API_URL}${endpoint}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    const errorMessage = errorData.error || errorData.details || 'Request failed';
    const error = new Error(errorMessage);
    (error as any).status = response.status;
    (error as any).code = errorData.code;
    throw error;
  }

  return response.json();
}

// Auth API
export const authApi = {
  async signUp(email: string, password: string) {
    const data = await apiRequest<{ user: { id: string; email: string }; token: string }>(
      '/auth/signup',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
    setToken(data.token);
    return { user: data.user, error: null };
  },

  async signIn(email: string, password: string) {
    try {
      const data = await apiRequest<{ user: { id: string; email: string }; token: string }>(
        '/auth/signin',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }
      );
      setToken(data.token);
      return { user: data.user, error: null };
    } catch (error) {
      return { user: null, error: error as Error };
    }
  },

  async getCurrentUser() {
    try {
      const user = await apiRequest<{ id: string; email: string }>('/auth/me');
      return user;
    } catch (error) {
      return null;
    }
  },

  signOut() {
    removeToken();
  },
};

// Search API
export const searchApi = {
  async searchPhysicians(query: string) {
    return apiRequest<{
      query: string;
      specialty: string;
      location: string | null;
      results: Array<{
        name: string;
        specialty: string;
        location: string;
        phone: string;
        rating: number;
        years_experience: number;
      }>;
      resultsCount: number;
    }>('/search/physicians', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  },
};

// History API
export type SearchHistory = {
  id: string;
  user_id: string;
  query: string;
  specialty: string | null;
  location: string | null;
  results_count: number;
  created_at: string;
};

export const historyApi = {
  async getHistory(): Promise<SearchHistory[]> {
    return apiRequest<SearchHistory[]>('/history');
  },

  async deleteHistoryItem(id: string): Promise<void> {
    await apiRequest(`/history/${id}`, {
      method: 'DELETE',
    });
  },

  async clearHistory(): Promise<void> {
    await apiRequest('/history', {
      method: 'DELETE',
    });
  },
};

