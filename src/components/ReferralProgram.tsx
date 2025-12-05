import { useState, useEffect } from 'react';
import { Gift, Copy, Check, Users, TrendingUp, Share2 } from 'lucide-react';
import { monetizationApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface ReferralStats {
  referralCode: string | null;
  referralLink: string;
  totalReferrals: number;
  activeReferrals: number;
  rewards: Array<{
    referredId: string;
    reward: string;
    date: string;
  }>;
}

export function ReferralProgram() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const data = await monetizationApi.getReferralStats();
        setStats(data);
      } catch (error) {
        const err = error as Error & { status?: number };
        console.error('Failed to load referral stats:', error);
        
        // Don't crash on 401 - just show empty state
        if (err.status === 401 || err.status === 403) {
          // Token invalid - will be handled by apiRequest redirect
          // Set empty stats to prevent UI crash
          setStats({
            referralCode: null,
            referralLink: '',
            totalReferrals: 0,
            activeReferrals: 0,
            rewards: [],
          });
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchStats();
  }, [user]);

  const handleGenerateCode = async () => {
    setGenerating(true);
    try {
      const data = await monetizationApi.generateReferralCode();
      setStats(prev => prev ? { ...prev, referralCode: data.referralCode, referralLink: data.referralLink } : null);
      alert('Referral code generated! Share it with friends to earn rewards.');
    } catch (error) {
      console.error('Failed to generate code:', error);
      alert('Failed to generate referral code. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!stats?.referralLink) return;
    
    try {
      await navigator.clipboard.writeText(stats.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card-strong rounded-2xl p-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-heading text-xl">Referral Program</h3>
            <p className="text-body text-sm">Invite friends and earn rewards!</p>
          </div>
        </div>
      </div>

      {/* Referral Code Section */}
      {!stats?.referralCode ? (
        <div className="glass-card rounded-2xl p-6 text-center">
          <Gift className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h4 className="text-heading text-lg mb-2">Get Your Referral Code</h4>
          <p className="text-body text-sm mb-6">
            Generate a referral code to share with friends. When they sign up, you both get rewards!
          </p>
          <button
            onClick={handleGenerateCode}
            disabled={generating}
            className="btn-primary"
          >
            {generating ? 'Generating...' : 'Generate Referral Code'}
          </button>
        </div>
      ) : (
        <div className="glass-card-strong rounded-2xl p-6 border-2 border-blue-200">
          <h4 className="text-heading text-lg mb-4 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-600" />
            Your Referral Link
          </h4>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 p-3 bg-gray-50 rounded-lg border border-gray-200 font-mono text-sm break-all">
              {stats.referralLink}
            </div>
            <button
              onClick={handleCopyLink}
              className="btn-secondary px-4 py-3"
              title="Copy link"
            >
              {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-body text-sm">
              <strong>Code:</strong> <span className="font-mono">{stats.referralCode}</span>
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card rounded-2xl p-6 text-center">
            <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-heading text-3xl font-bold mb-1">{stats.totalReferrals}</p>
            <p className="text-body text-sm">Total Referrals</p>
          </div>
          <div className="glass-card rounded-2xl p-6 text-center">
            <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-heading text-3xl font-bold mb-1">{stats.activeReferrals}</p>
            <p className="text-body text-sm">Active Referrals</p>
          </div>
          <div className="glass-card rounded-2xl p-6 text-center">
            <Gift className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <p className="text-heading text-3xl font-bold mb-1">{stats.rewards.length}</p>
            <p className="text-body text-sm">Rewards Earned</p>
          </div>
        </div>
      )}

      {/* Rewards List */}
      {stats && stats.rewards.length > 0 && (
        <div className="glass-card rounded-2xl p-6">
          <h4 className="text-heading text-lg mb-4">Recent Rewards</h4>
          <div className="space-y-3">
            {stats.rewards.map((reward, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Gift className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="text-body text-sm font-medium">{reward.reward}</p>
                    <p className="text-body text-xs text-gray-500">
                      {new Date(reward.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className="badge bg-green-50 text-green-700 border-green-200">Earned</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="glass-card rounded-2xl p-6">
        <h4 className="text-heading text-lg mb-4">How It Works</h4>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
              1
            </div>
            <div>
              <p className="text-body text-sm font-medium">Share your referral link</p>
              <p className="text-body text-xs text-gray-500">Send your unique link to friends and family</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
              2
            </div>
            <div>
              <p className="text-body text-sm font-medium">They sign up</p>
              <p className="text-body text-xs text-gray-500">Your friends create an account using your link</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
              3
            </div>
            <div>
              <p className="text-body text-sm font-medium">You both get rewards</p>
              <p className="text-body text-xs text-gray-500">You get 1 month premium, they get 1 month trial</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

