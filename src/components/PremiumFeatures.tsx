import { useState, useEffect } from 'react';
import { Crown, Check, Sparkles, Users } from 'lucide-react';
import { monetizationApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type SubscriptionTier = 'free' | 'premium' | 'enterprise';

interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  features: string[];
  referralCode?: string;
}

export function PremiumFeatures() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    const fetchSubscription = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const data = await monetizationApi.getSubscription();
        setSubscription(data);
      } catch (error) {
        const err = error as Error & { status?: number };
        console.error('Failed to load subscription:', error);
        
        // Don't crash on 401 - just show free tier
        if (err.status === 401 || err.status === 403) {
          // Token invalid - will be handled by apiRequest redirect
          // Set default free subscription to prevent UI crash
          setSubscription({
            id: '',
            userId: user.id,
            tier: 'free',
            features: ['Basic search', 'Limited results (15 per search)', 'Standard booking'],
          });
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchSubscription();
  }, [user]);

  const handleUpgrade = async (tier: 'premium' | 'enterprise') => {
    setUpgrading(true);
    try {
      const data = await monetizationApi.upgradeSubscription(tier);
      setSubscription(data.subscription);
      alert(`Successfully upgraded to ${tier}!`);
    } catch (error) {
      console.error('Upgrade failed:', error);
      alert('Upgrade failed. Please try again.');
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  const currentTier = subscription?.tier || 'free';

  const tiers = {
    free: {
      name: 'Free',
      price: '$0',
      features: ['Basic search', 'Limited results (15 per search)', 'Standard booking'],
      icon: <Users className="w-5 h-5" />,
    },
    premium: {
      name: 'Premium',
      price: '$9.99/month',
      features: [
        'Unlimited searches',
        'Priority booking',
        'Extended doctor profiles',
        'Medical record storage',
        'Family accounts',
        'Ad-free experience',
      ],
      icon: <Crown className="w-5 h-5" />,
    },
    enterprise: {
      name: 'Enterprise',
      price: 'Custom',
      features: [
        'All premium features',
        'White-label solutions',
        'API access',
        'Custom integrations',
        'Analytics dashboard',
        'Dedicated support',
      ],
      icon: <Sparkles className="w-5 h-5" />,
    },
  };

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="glass-card-strong rounded-2xl p-6 border-2 border-blue-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center text-white">
              {tiers[currentTier].icon}
            </div>
            <div>
              <h3 className="text-heading text-lg">Current Plan</h3>
              <p className="text-body text-sm">{tiers[currentTier].name} - {tiers[currentTier].price}</p>
            </div>
          </div>
          {currentTier !== 'free' && (
            <span className="badge bg-green-50 text-green-700 border-green-200">Active</span>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-body text-sm font-semibold mb-2">Your Features:</p>
          {subscription?.features.map((feature, idx) => (
            <div key={idx} className="flex items-center gap-2 text-body text-sm">
              <Check className="w-4 h-4 text-green-600" />
              <span>{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade Options */}
      {currentTier === 'free' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="w-5 h-5 text-amber-500" />
              <h3 className="text-heading text-lg">Premium</h3>
            </div>
            <p className="text-heading text-2xl font-bold mb-4">$9.99<span className="text-body text-sm font-normal">/month</span></p>
            <ul className="space-y-2 mb-6">
              {tiers.premium.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2 text-body text-sm">
                  <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleUpgrade('premium')}
              disabled={upgrading}
              className="btn-primary w-full"
            >
              {upgrading ? 'Upgrading...' : 'Upgrade to Premium'}
            </button>
          </div>

          <div className="glass-card rounded-2xl p-6 border-2 border-purple-200 relative">
            <div className="absolute -top-3 right-4 bg-purple-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
              Best Value
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h3 className="text-heading text-lg">Enterprise</h3>
            </div>
            <p className="text-heading text-2xl font-bold mb-4">Custom<span className="text-body text-sm font-normal"> pricing</span></p>
            <ul className="space-y-2 mb-6">
              {tiers.enterprise.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2 text-body text-sm">
                  <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleUpgrade('enterprise')}
              disabled={upgrading}
              className="btn-secondary w-full"
            >
              Contact Sales
            </button>
          </div>
        </div>
      )}

      {/* Premium Badge */}
      {currentTier !== 'free' && (
        <div className="glass-card rounded-2xl p-6 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200">
          <div className="flex items-center gap-3">
            <Crown className="w-8 h-8 text-amber-500" />
            <div>
              <h3 className="text-heading text-lg">Premium Member</h3>
              <p className="text-body text-sm">Thank you for supporting YoDoc!</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

