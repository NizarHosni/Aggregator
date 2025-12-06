import { useState } from 'react';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth } from '../context/AuthContext';
import { Crown, Check, X, Loader2, CreditCard, Calendar, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Subscription() {
  const { user } = useAuth();
  const { subscription, loading, createCheckout, openPortal, cancelSubscription, resumeSubscription } = useSubscription();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="glass-card-strong rounded-3xl p-8 text-center">
        <p className="text-body mb-4">Please sign in to manage your subscription</p>
        <Link to="/login" className="btn-primary">
          Sign In
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass-card-strong rounded-3xl p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
        <p className="text-body">Loading subscription...</p>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="glass-card-strong rounded-3xl p-8 text-center">
        <p className="text-body text-red-600">Failed to load subscription</p>
      </div>
    );
  }

  const handleUpgrade = async () => {
    if (!subscription.stripeConfigured) {
      setError('Payment processing is not available at this time');
      return;
    }

    try {
      setProcessing(true);
      setError(null);
      await createCheckout();
    } catch (err: any) {
      setError(err.message || 'Failed to start checkout');
    } finally {
      setProcessing(false);
    }
  };

  const handleManage = async () => {
    try {
      setProcessing(true);
      setError(null);
      await openPortal();
    } catch (err: any) {
      setError(err.message || 'Failed to open billing portal');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
      return;
    }

    try {
      setProcessing(true);
      setError(null);
      await cancelSubscription(false);
      alert('Subscription will be canceled at the end of your billing period');
    } catch (err: any) {
      setError(err.message || 'Failed to cancel subscription');
    } finally {
      setProcessing(false);
    }
  };

  const handleResume = async () => {
    try {
      setProcessing(true);
      setError(null);
      await resumeSubscription();
      alert('Subscription resumed successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to resume subscription');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="glass-card-strong rounded-3xl p-6 sm:p-8 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-heading text-2xl sm:text-3xl flex items-center gap-3">
            <Crown className="w-8 h-8 text-yellow-500" />
            Subscription
          </h1>
          {subscription.isPremium && (
            <span className="badge-rating bg-yellow-100 text-yellow-800 border-yellow-300">
              Premium
            </span>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Current Plan */}
        <div className="mb-8">
          <h2 className="text-subheading text-lg mb-4">Current Plan</h2>
          <div className="bg-gradient-to-br from-blue-50 to-teal-50 rounded-2xl p-6 border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-heading text-xl font-bold capitalize">{subscription.plan} Plan</h3>
                <p className="text-body text-sm mt-1">
                  Status: <span className="font-semibold capitalize">{subscription.status}</span>
                </p>
              </div>
              {subscription.isPremium && (
                <Crown className="w-12 h-12 text-yellow-500" />
              )}
            </div>

            {subscription.currentPeriodEnd && (
              <div className="flex items-center gap-2 text-body text-sm mb-4">
                <Calendar className="w-4 h-4" />
                <span>
                  {subscription.willCancel
                    ? `Cancels on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                    : `Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
                </span>
              </div>
            )}

            {/* Usage Stats */}
            {subscription.usage && (
              <div className="bg-white/60 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-body text-sm font-medium">Monthly Searches</span>
                  <span className="text-heading font-semibold">
                    {subscription.usage.searches} / {subscription.usage.isPremium ? '∞' : subscription.usage.limit}
                  </span>
                </div>
                {!subscription.usage.isPremium && (
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (subscription.usage.searches / subscription.usage.limit) * 100)}%`,
                      }}
                    />
                  </div>
                )}
                <p className="text-body text-xs">
                  {subscription.usage.isPremium
                    ? 'Unlimited searches'
                    : `${subscription.usage.remaining} searches remaining this month`}
                </p>
                <p className="text-body text-xs mt-1 text-gray-500">
                  Resets on {new Date(subscription.usage.resetDate).toLocaleDateString()}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              {!subscription.isPremium ? (
                <button
                  onClick={handleUpgrade}
                  disabled={processing || !subscription.stripeConfigured}
                  className="btn-primary flex items-center gap-2"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Crown className="w-4 h-4" />
                      Upgrade to Premium
                    </>
                  )}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleManage}
                    disabled={processing}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    Manage Billing
                  </button>
                  {subscription.willCancel ? (
                    <button
                      onClick={handleResume}
                      disabled={processing}
                      className="btn-primary flex items-center gap-2"
                    >
                      Resume Subscription
                    </button>
                  ) : (
                    <button
                      onClick={handleCancel}
                      disabled={processing}
                      className="btn-secondary text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Cancel Subscription
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Features Comparison */}
        <div className="mb-8">
          <h2 className="text-subheading text-lg mb-4">Plan Features</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass-card rounded-xl p-5 border border-gray-200">
              <h3 className="text-heading font-semibold mb-3">Free Plan</h3>
              <ul className="space-y-2 text-body text-sm">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span>10 searches per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span>Basic search features</span>
                </li>
                <li className="flex items-center gap-2">
                  <X className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">Unlimited searches</span>
                </li>
                <li className="flex items-center gap-2">
                  <X className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">Priority support</span>
                </li>
              </ul>
            </div>

            <div className="glass-card rounded-xl p-5 border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="w-5 h-5 text-yellow-600" />
                <h3 className="text-heading font-semibold">Premium Plan</h3>
              </div>
              <ul className="space-y-2 text-body text-sm">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="font-semibold">Unlimited searches</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span>All search features</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span>Priority support</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span>Advanced filters</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

