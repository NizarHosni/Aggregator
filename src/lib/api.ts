const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
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

