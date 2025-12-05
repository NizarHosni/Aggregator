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

type ApiErrorPayload = {
  error?: string;
  details?: string;
  code?: string;
};

// API request helper with 401 handling
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Always include token if available - don't skip it
  if (token && token !== 'undefined' && token !== 'null' && token.trim() !== '') {
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

  // Handle 401 Unauthorized - but don't redirect for auth endpoints to prevent loops
  if (response.status === 401) {
    // Don't redirect if we're checking auth status (would cause infinite loop)
    const isAuthEndpoint = endpoint === '/auth/me' || endpoint === '/auth/is-admin';
    
    if (!isAuthEndpoint) {
      // Clear invalid token
      removeToken();
      
      // Only redirect if we're not already on the auth page and not checking auth
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth')) {
        // Use a flag to prevent multiple redirects
        const redirectKey = 'auth_redirect_in_progress';
        if (!sessionStorage.getItem(redirectKey)) {
          sessionStorage.setItem(redirectKey, 'true');
          // Store the current path to return after login
          const returnPath = window.location.pathname + window.location.search;
          window.location.href = `/auth?return=${encodeURIComponent(returnPath)}`;
          // Clear flag after redirect
          setTimeout(() => sessionStorage.removeItem(redirectKey), 1000);
        }
      }
    } else {
      // For auth endpoints, just clear the token but don't redirect
      removeToken();
    }
    
    const errorMessage = 'Authentication required. Please log in.';
    const enrichedError = new Error(errorMessage) as Error & {
      status?: number;
      code?: string;
    };
    enrichedError.status = 401;
    enrichedError.code = 'UNAUTHORIZED';
    throw enrichedError;
  }

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
      const token = getToken();
      
      // NO TOKEN = NOT AUTHENTICATED
      if (!token || token === 'undefined' || token === 'null' || token.trim() === '') {
        return null;
      }
      
      // Validate token with backend - but don't redirect on 401 for this endpoint
      // We'll handle redirect in ProtectedRoute instead
      const user = await apiRequest<{ id: string; email: string }>('/auth/me');
      
      // If response is invalid, return null
      if (!user || !user.id) {
        removeToken();
        return null;
      }
      
      return user;
    } catch (error) {
      const err = error as Error & { status?: number; code?: string };
      
      // 401/403 means invalid token - clear it but don't redirect (prevent loop)
      if (err.status === 401 || err.status === 403) {
        removeToken();
        return null;
      }
      
      // Network errors - return null but don't redirect
      console.warn('Auth service unavailable:', err.message || 'Unknown error');
      return null;
    }
  },

  signOut() {
    removeToken();
  },

  async isAdmin() {
    try {
      const result = await apiRequest<{ isAdmin: boolean }>('/auth/is-admin');
      return result.isAdmin;
    } catch {
      return false;
    }
  },
};

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

// Appointment & Insurance APIs
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

export const analyticsApi = {
  async getMetrics(timeRange: '7d' | '30d' | '90d' = '30d') {
    return apiRequest<{
      patientMetrics: {
        totalSearches: number;
        searchConversionRate: number;
        appointmentBookings: number;
        patientRetentionRate: number;
        geographicDemand: Array<{ location: string; count: number }>;
      };
      doctorMetrics: {
        profileCompletions: number;
        patientAcquisitionCost: number;
        averageSatisfactionScore: number;
        bookingUtilization: number;
        topDoctors: Array<{ name: string; views: number; bookings: number }>;
      };
      revenueMetrics: {
        totalRevenue: number;
        monthlyRecurringRevenue: number;
        averageRevenuePerUser: number;
        revenueGrowth: number;
      };
    }>(`/analytics/metrics?timeRange=${timeRange}`, {
      method: 'GET',
    });
  },
};

export const monetizationApi = {
  async getSubscription() {
    return apiRequest<{
      id: string;
      userId: string;
      tier: 'free' | 'premium' | 'enterprise';
      features: string[];
      referralCode?: string;
    }>('/monetization/subscription', {
      method: 'GET',
    });
  },

  async upgradeSubscription(tier: 'premium' | 'enterprise') {
    return apiRequest<{
      message: string;
      subscription: {
        id: string;
        userId: string;
        tier: 'free' | 'premium' | 'enterprise';
        features: string[];
      };
    }>('/monetization/subscription/upgrade', {
      method: 'POST',
      body: JSON.stringify({ tier }),
    });
  },

  async generateReferralCode() {
    return apiRequest<{
      referralCode: string;
      referralLink: string;
      message: string;
    }>('/monetization/referral/generate', {
      method: 'POST',
    });
  },

  async applyReferralCode(referralCode: string) {
    return apiRequest<{
      message: string;
      subscription: {
        id: string;
        userId: string;
        tier: 'free' | 'premium' | 'enterprise';
        features: string[];
      };
    }>('/monetization/referral/apply', {
      method: 'POST',
      body: JSON.stringify({ referralCode }),
    });
  },

  async getReferralStats() {
    return apiRequest<{
      referralCode: string | null;
      referralLink: string;
      totalReferrals: number;
      activeReferrals: number;
      rewards: Array<{
        referredId: string;
        reward: string;
        date: string;
      }>;
    }>('/monetization/referral/stats', {
      method: 'GET',
    });
  },
};

export { getToken, setToken, removeToken, API_URL };

