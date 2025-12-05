import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Users, Search, Calendar, DollarSign, BarChart3, Activity } from 'lucide-react';
import { analyticsApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface AnalyticsData {
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
    topDoctors?: Array<{ name: string; views: number; bookings: number }>;
    topSpecialties?: Array<{ specialty: string; searches: number }>;
  };
  revenueMetrics: {
    totalRevenue: number;
    monthlyRecurringRevenue: number;
    averageRevenuePerUser: number;
    revenueGrowth: number;
  };
}

export function AnalyticsDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await analyticsApi.getMetrics(timeRange);
        setAnalytics(data);
      } catch (err) {
        const error = err as Error & { status?: number };
        console.error('Failed to load analytics:', error);
        if (error.status === 403) {
          setError('Access denied. Admin privileges required.');
        } else {
          setError('Failed to load analytics data. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchAnalytics();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center glass-card rounded-3xl p-12 shadow-professional-lg">
          <div className="spinner-professional mx-auto mb-6" />
          <p className="text-body font-semibold">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <div className="text-center glass-card rounded-3xl p-12 shadow-professional-lg max-w-md">
          <div className="text-red-600 mb-4">
            <Activity className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-heading text-xl mb-2">Access Denied</h2>
          <p className="text-body mb-6">{error}</p>
          <button onClick={() => navigate(-1)} className="btn-primary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="min-h-screen bg-gradient-subtle pb-12">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-body hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <h1 className="text-heading text-3xl">Analytics Dashboard</h1>
          </div>
          <div className="flex gap-2">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* Revenue Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Revenue"
            value={`$${analytics.revenueMetrics.totalRevenue.toLocaleString()}`}
            change={analytics.revenueMetrics.revenueGrowth}
            icon={<DollarSign className="w-5 h-5" />}
            color="green"
          />
          <MetricCard
            title="MRR"
            value={`$${analytics.revenueMetrics.monthlyRecurringRevenue.toLocaleString()}`}
            change={12.5}
            icon={<TrendingUp className="w-5 h-5" />}
            color="blue"
          />
          <MetricCard
            title="ARPU"
            value={`$${analytics.revenueMetrics.averageRevenuePerUser.toFixed(2)}`}
            change={5.2}
            icon={<Users className="w-5 h-5" />}
            color="purple"
          />
          <MetricCard
            title="Total Searches"
            value={analytics.patientMetrics.totalSearches.toLocaleString()}
            change={18.7}
            icon={<Search className="w-5 h-5" />}
            color="teal"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Patient Metrics */}
          <div className="glass-card-strong rounded-2xl p-6 shadow-professional">
            <h2 className="text-heading text-xl mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Patient Metrics
            </h2>
            <div className="space-y-4">
              <MetricRow
                label="Search Conversion Rate"
                value={`${analytics.patientMetrics.searchConversionRate.toFixed(1)}%`}
                progress={analytics.patientMetrics.searchConversionRate}
              />
              <MetricRow
                label="Appointment Bookings"
                value={analytics.patientMetrics.appointmentBookings.toLocaleString()}
                progress={(analytics.patientMetrics.appointmentBookings / analytics.patientMetrics.totalSearches) * 100}
              />
              <MetricRow
                label="Patient Retention Rate"
                value={`${analytics.patientMetrics.patientRetentionRate.toFixed(1)}%`}
                progress={analytics.patientMetrics.patientRetentionRate}
              />
            </div>
          </div>

          {/* Doctor Metrics */}
          <div className="glass-card-strong rounded-2xl p-6 shadow-professional">
            <h2 className="text-heading text-xl mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Doctor Metrics
            </h2>
            <div className="space-y-4">
              <MetricRow
                label="Profile Completions"
                value={`${analytics.doctorMetrics.profileCompletions}%`}
                progress={analytics.doctorMetrics.profileCompletions}
              />
              <MetricRow
                label="Booking Utilization"
                value={`${analytics.doctorMetrics.bookingUtilization.toFixed(1)}%`}
                progress={analytics.doctorMetrics.bookingUtilization}
              />
              <MetricRow
                label="Avg Satisfaction Score"
                value={analytics.doctorMetrics.averageSatisfactionScore.toFixed(1)}
                progress={(analytics.doctorMetrics.averageSatisfactionScore / 5) * 100}
              />
            </div>
          </div>
        </div>

        {/* Geographic Demand */}
        {analytics.patientMetrics.geographicDemand && analytics.patientMetrics.geographicDemand.length > 0 ? (
          <div className="glass-card-strong rounded-2xl p-6 shadow-professional mb-8">
            <h2 className="text-heading text-xl mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Geographic Demand
            </h2>
            <div className="space-y-3">
              {analytics.patientMetrics.geographicDemand.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-body font-medium">{item.location}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-teal-500"
                        style={{
                          width: `${(item.count / analytics.patientMetrics.geographicDemand[0].count) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-body font-semibold w-12 text-right">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="glass-card-strong rounded-2xl p-6 shadow-professional mb-8">
            <h2 className="text-heading text-xl mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Geographic Demand
            </h2>
            <p className="text-body text-sm text-gray-500">No location data available for the selected time range.</p>
          </div>
        )}

        {/* Top Specialties */}
        {analytics.doctorMetrics.topSpecialties && analytics.doctorMetrics.topSpecialties.length > 0 && (
          <div className="glass-card-strong rounded-2xl p-6 shadow-professional">
            <h2 className="text-heading text-xl mb-6 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Top Searched Specialties
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-subheading text-sm">Specialty</th>
                    <th className="text-right py-3 px-4 text-subheading text-sm">Total Searches</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.doctorMetrics.topSpecialties.map((specialty, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-3 px-4 text-body font-medium">{specialty.specialty}</td>
                      <td className="py-3 px-4 text-body text-right font-semibold">{specialty.searches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  change,
  icon,
  color,
}: {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'purple' | 'teal';
}) {
  const colorClasses = {
    green: 'bg-green-50 text-green-600 border-green-200',
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    teal: 'bg-teal-50 text-teal-600 border-teal-200',
  };

  return (
    <div className="glass-card-strong rounded-2xl p-6 shadow-professional">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-full ${colorClasses[color]} flex items-center justify-center`}>
          {icon}
        </div>
        <span className={`text-sm font-semibold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(1)}%
        </span>
      </div>
      <h3 className="text-body text-sm mb-1">{title}</h3>
      <p className="text-heading text-2xl font-bold">{value}</p>
    </div>
  );
}

function MetricRow({ label, value, progress }: { label: string; value: string; progress: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-body text-sm font-medium">{label}</span>
        <span className="text-heading text-sm font-semibold">{value}</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-teal-500 transition-all duration-500"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  );
}

