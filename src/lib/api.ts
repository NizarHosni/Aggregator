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

type ApiErrorPayload = {
  error?: string;
  details?: string;
  code?: string;
};

// Get auth token from Stack Auth (if available)
async function getAuthToken(): Promise<string | null> {
  try {
    // Stack Auth stores tokens in cookies automatically
    // For API requests, we'll use the cookie-based auth
    // If we need to send token in header, we can get it from Stack client
    const { stackClientApp } = await import('./stack');
    const user = await stackClientApp.getUser();
    if (user) {
      // Stack Auth handles token automatically via cookies
      // But we can also get it explicitly if needed
      return null; // Cookie-based auth, no need for header token
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Simplified API request helper with optional authentication
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Add credentials for cookie-based auth
  const requestOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // Include cookies for Stack Auth
  };

  // If using proxy, add path as query parameter
  let url: string;
  if (USE_PROXY) {
    // For proxy, add the endpoint path as a query parameter
    url = `${API_URL}?path=${encodeURIComponent(endpoint)}`;
  } else {
    url = `${API_URL}${endpoint}`;
  }

  const response = await fetch(url, requestOptions);

  // Parse response
  const responseData = await response.json().catch(() => ({ error: 'Request failed' })) as ApiErrorPayload & { success?: boolean; message?: string };

  // Check if backend returned success: false (from our proxy error handling)
  if (responseData.success === false) {
    const enrichedError = new Error(responseData.message || responseData.error || 'Service temporarily unavailable') as Error & {
      status?: number;
      code?: string;
    };
    enrichedError.status = 503; // Service Unavailable
    if (responseData.code) {
      enrichedError.code = responseData.code;
    }
    throw enrichedError;
  }

  if (!response.ok) {
    const errorMessage = responseData.error || responseData.details || 'Request failed';
    const enrichedError = new Error(errorMessage) as Error & {
      status?: number;
      code?: string;
    };
    enrichedError.status = response.status;
    if (responseData.code) {
      enrichedError.code = responseData.code;
    }
    throw enrichedError;
  }

  return responseData as T;
}

// Search API
export const searchApi = {
  async searchPhysicians(query: string, radius?: number, page: number = 1, pageSize: number = 15) {
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
        npi?: string;
        googlePlaceId?: string;
        healthgradesId?: string;
        website?: string;
        practice?: { name?: string; phone?: string };
        googleData?: { business_name?: string };
        nppesData?: { practice_name?: string };
        healthgradesData?: { practice_name?: string };
      }>;
      resultsCount: number;
      error?: string | null;
      suggestions?: string[] | null;
      searchRadius?: number | null;
      pagination?: {
        currentPage: number;
        resultsPerPage: number;
        totalPages: number;
        hasMore: boolean;
        totalResults: number;
      };
    }>('/search/physicians', {
      method: 'POST',
      body: JSON.stringify({ query, radius, page, pageSize }),
    });
  },
};

// Appointment & Insurance APIs (keep for future use, but simplified)
export type AppointmentSlot = {
  id: string;
  start: string;
  end: string;
  visitType: 'in_person' | 'telehealth';
  status?: 'available' | 'booked';
};

export const appointmentsApi = {
  async getAvailability(doctorNpi: string) {
    return apiRequest<{
      doctorNpi: string;
      slots: AppointmentSlot[];
      generatedAt: string;
    }>('/appointments/availability', {
      method: 'POST',
      body: JSON.stringify({ doctorNpi }),
    });
  },

  async bookAppointment(payload: {
    doctorNpi: string;
    slotId: string;
    visitType: 'in_person' | 'telehealth';
    reason: string;
    insurancePlan?: string;
    patientName: string;
    patientEmail?: string;
  }) {
    return apiRequest<{
      confirmationId: string;
      doctorNpi: string;
      slot: {
        start: string;
        end: string;
        visitType: 'in_person' | 'telehealth';
      };
      status: string;
      message: string;
    }>('/appointments/book', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

export const insuranceApi = {
  async verifyInsurance(doctorNpi: string, insurancePlan: string) {
    return apiRequest<{
      doctorNpi: string;
      insurancePlan: string;
      isInNetwork: boolean;
      copay: number;
      requiresReferral: boolean;
      message: string;
    }>('/insurance/verify', {
      method: 'POST',
      body: JSON.stringify({ doctorNpi, insurancePlan }),
    });
  },

  async getPlans() {
    return apiRequest<{
      plans: string[];
      message: string;
    }>('/insurance/plans', {
      method: 'GET',
    });
  },
};

export const reviewsApi = {
  async getReviews(doctorNpi: string) {
    return apiRequest<{
      doctorNpi: string;
      summary: {
        averageRating: number;
        waitTime: number;
        bedsideManner: number;
        staffFriendliness: number;
        totalReviews: number;
      };
      reviews: Array<{
        id: string;
        rating: number;
        waitTime: number;
        bedsideManner: number;
        staffFriendliness: number;
        comments: string;
        reviewerName: string;
        createdAt: string;
      }>;
    }>(`/reviews/${doctorNpi}`, {
      method: 'GET',
    });
  },

  async submitReview(payload: {
    doctorNpi: string;
    rating: number;
    waitTime?: number;
    bedsideManner?: number;
    staffFriendliness?: number;
    comments: string;
    reviewerName?: string;
  }) {
    return apiRequest<{
      message: string;
      review: {
        id: string;
        createdAt: string;
      };
    }>('/reviews', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

// History API (with database sync)
export type SearchHistoryItem = {
  id: string;
  query: string;
  specialty: string | null;
  location: string | null;
  results_count: number;
  created_at: string;
};

export const historyApi = {
  async getHistory(): Promise<SearchHistoryItem[]> {
    try {
      const response = await apiRequest<{ history: SearchHistoryItem[] }>('/history', {
        method: 'GET',
      });
      return response.history;
    } catch (error) {
      // If not authenticated, return empty array
      return [];
    }
  },

  async addHistory(query: string, specialty: string | null, location: string | null, results_count: number) {
    try {
      const response = await apiRequest<{ historyItem: SearchHistoryItem }>('/history', {
        method: 'POST',
        body: JSON.stringify({ query, specialty, location, results_count }),
      });
      return response.historyItem;
    } catch (error) {
      // Silently fail if not authenticated
      return null;
    }
  },

  async deleteHistoryItem(id: string): Promise<void> {
    try {
      await apiRequest(`/history/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      // Silently fail if not authenticated
    }
  },

  async clearHistory(): Promise<void> {
    try {
      await apiRequest('/history', {
        method: 'DELETE',
      });
    } catch (error) {
      // Silently fail if not authenticated
    }
  },
};

// Favorites API (with database sync)
export type FavoriteDoctor = {
  id?: string;
  npi: string;
  name: string;
  specialty: string;
  location: string;
  phone: string;
  rating: number;
  years_experience: number;
  google_place_id?: string;
  healthgrades_id?: string;
  website?: string;
  created_at?: string;
};

export const favoritesApi = {
  async getFavorites(): Promise<FavoriteDoctor[]> {
    try {
      const response = await apiRequest<{ favorites: FavoriteDoctor[] }>('/favorites', {
        method: 'GET',
      });
      return response.favorites;
    } catch (error) {
      // If not authenticated, return empty array
      return [];
    }
  },

  async addFavorite(doctor: FavoriteDoctor) {
    try {
      const response = await apiRequest<{ favorite: FavoriteDoctor }>('/favorites', {
        method: 'POST',
        body: JSON.stringify(doctor),
      });
      return response.favorite;
    } catch (error) {
      // Silently fail if not authenticated
      return null;
    }
  },

  async removeFavorite(npi: string): Promise<void> {
    try {
      await apiRequest(`/favorites/${npi}`, {
        method: 'DELETE',
      });
    } catch (error) {
      // Silently fail if not authenticated
    }
  },
};

// Auth API
export const authApi = {
  async getCurrentUser() {
    try {
      return await apiRequest<{
        id: string;
        email: string;
        displayName?: string;
      }>('/auth/me', {
        method: 'GET',
      });
    } catch (error) {
      return null;
    }
  },
};

export { API_URL };
