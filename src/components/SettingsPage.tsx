import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Shield, Crown, Gift, Lock, FileText, Bell } from 'lucide-react';
import { PremiumFeatures } from './PremiumFeatures';
import { ReferralProgram } from './ReferralProgram';
import { useAuth } from '../context/AuthContext';

type Tab = 'premium' | 'referral' | 'security' | 'privacy';

export function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('premium');

  // Redirect to home if no user (guest mode)
  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Show loading or redirect message if no user
  if (!user) {
    return null; // Will redirect via useEffect
  }

  const tabs = [
    { id: 'premium' as Tab, label: 'Premium', icon: <Crown className="w-4 h-4" /> },
    { id: 'referral' as Tab, label: 'Referral Program', icon: <Gift className="w-4 h-4" /> },
    { id: 'security' as Tab, label: 'Security', icon: <Shield className="w-4 h-4" /> },
    { id: 'privacy' as Tab, label: 'Privacy & Compliance', icon: <Lock className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-subtle pb-12">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-body hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-600" />
            <h1 className="text-heading text-3xl">Settings</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="glass-card-strong rounded-2xl p-4 space-y-2 sticky top-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-body hover:bg-gray-100'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            {activeTab === 'premium' && <PremiumFeatures />}
            {activeTab === 'referral' && <ReferralProgram />}
            {activeTab === 'security' && <SecuritySettings />}
            {activeTab === 'privacy' && <PrivacyCompliance />}
          </div>
        </div>
      </div>
    </div>
  );
}

function SecuritySettings() {
  const { user } = useAuth();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  return (
    <div className="space-y-6">
      <div className="glass-card-strong rounded-2xl p-6">
        <h2 className="text-heading text-xl mb-6 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          Account Security
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-body font-medium">Email</p>
              <p className="text-body text-sm text-gray-500">{user?.email}</p>
            </div>
            <button className="btn-secondary text-sm">Change</button>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-body font-medium">Password</p>
              <p className="text-body text-sm text-gray-500">Last changed: Never</p>
            </div>
            <button className="btn-secondary text-sm">Change</button>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-body font-medium">Two-Factor Authentication</p>
              <p className="text-body text-sm text-gray-500">Add an extra layer of security</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={twoFactorEnabled}
                onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="glass-card-strong rounded-2xl p-6">
        <h2 className="text-heading text-xl mb-6 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Security Activity
        </h2>
        <div className="space-y-3">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-body text-sm font-medium">All account activity is logged for security</p>
            <p className="text-body text-xs text-gray-500 mt-1">
              Your login history, password changes, and sensitive actions are tracked and audited.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrivacyCompliance() {
  return (
    <div className="space-y-6">
      <div className="glass-card-strong rounded-2xl p-6">
        <h2 className="text-heading text-xl mb-6 flex items-center gap-2">
          <Lock className="w-5 h-5 text-blue-600" />
          Privacy & Compliance
        </h2>
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-heading text-sm font-semibold mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              HIPAA Compliance
            </h3>
            <p className="text-body text-sm mb-3">
              YoDoc is committed to protecting your health information. We follow HIPAA guidelines to ensure your data is secure.
            </p>
            <ul className="space-y-2 text-body text-xs">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>End-to-end encryption for all health data</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>Access controls and audit logging</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>Regular security assessments</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>Business Associate Agreements (BAAs) with all partners</span>
              </li>
            </ul>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-heading text-sm font-semibold mb-2">Data Privacy</h3>
            <p className="text-body text-sm mb-3">
              Your personal information is protected and never shared without your consent.
            </p>
            <div className="space-y-2 text-body text-xs">
              <p>• GDPR compliant data handling</p>
              <p>• CCPA compliant for California residents</p>
              <p>• You can request data deletion at any time</p>
              <p>• Transparent privacy policy and terms of service</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="btn-secondary text-sm flex-1">View Privacy Policy</button>
            <button className="btn-secondary text-sm flex-1">View Terms of Service</button>
          </div>
        </div>
      </div>

      <div className="glass-card-strong rounded-2xl p-6">
        <h2 className="text-heading text-xl mb-6 flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-600" />
          Privacy Preferences
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-body font-medium">Email Notifications</p>
              <p className="text-body text-sm text-gray-500">Receive updates about your account</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-body font-medium">Data Sharing for Research</p>
              <p className="text-body text-sm text-gray-500">Anonymized data for healthcare research</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

