import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

export interface SubscriptionStatus {
  plan: 'free' | 'premium' | 'pro';
  status: 'active' | 'canceled' | 'past_due' | 'paused';
  isPremium: boolean;
  isActive: boolean;
  willCancel: boolean;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  canceledAt?: string;
  usage: {
    searches: number;
    limit: number;
    remaining: number;
    resetDate: string;
    isPremium: boolean;
  };
  stripeConfigured: boolean;
}

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await apiRequest<SubscriptionStatus>('/subscriptions/status', {
        method: 'GET',
      });
      setSubscription(data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching subscription:', err);
      setError(err.message || 'Failed to load subscription');
      // Set default free tier on error
      setSubscription({
        plan: 'free',
        status: 'active',
        isPremium: false,
        isActive: true,
        willCancel: false,
        usage: {
          searches: 0,
          limit: 10,
          remaining: 10,
          resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          isPremium: false,
        },
        stripeConfigured: false,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [user]);

  const createCheckout = async () => {
    try {
      const data = await apiRequest<{ sessionId: string; url: string }>('/subscriptions/checkout', {
        method: 'POST',
      });
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err: any) {
      console.error('Error creating checkout:', err);
      throw err;
    }
  };

  const openPortal = async () => {
    try {
      const data = await apiRequest<{ url: string }>('/subscriptions/portal', {
        method: 'POST',
      });
      // Redirect to Stripe Customer Portal
      window.location.href = data.url;
    } catch (err: any) {
      console.error('Error opening portal:', err);
      throw err;
    }
  };

  const cancelSubscription = async (immediately: boolean = false) => {
    try {
      await apiRequest('/subscriptions/cancel', {
        method: 'POST',
        body: JSON.stringify({ immediately }),
      });
      await fetchSubscription(); // Refresh
    } catch (err: any) {
      console.error('Error canceling subscription:', err);
      throw err;
    }
  };

  const resumeSubscription = async () => {
    try {
      await apiRequest('/subscriptions/resume', {
        method: 'POST',
      });
      await fetchSubscription(); // Refresh
    } catch (err: any) {
      console.error('Error resuming subscription:', err);
      throw err;
    }
  };

  return {
    subscription,
    loading,
    error,
    refresh: fetchSubscription,
    createCheckout,
    openPortal,
    cancelSubscription,
    resumeSubscription,
    isPremium: subscription?.isPremium || false,
    usage: subscription?.usage || null,
  };
}

