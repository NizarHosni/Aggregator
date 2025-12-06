import { sql } from '../db/index.js';

// Free tier limits
export const FREE_TIER_LIMITS = {
  searchesPerMonth: 10,
};

// Premium tier limits (unlimited)
export const PREMIUM_TIER_LIMITS = {
  searchesPerMonth: Infinity,
};

export interface UsageStats {
  searches: number;
  limit: number;
  remaining: number;
  resetDate: Date;
  isPremium: boolean;
}

// Get current month usage for a user
export async function getMonthlyUsage(userId: string): Promise<UsageStats> {
  // Get subscription status
  const [subscription] = await sql`
    SELECT plan, status FROM subscriptions 
    WHERE user_id = ${userId} AND status = 'active'
    LIMIT 1
  `;

  const isPremium = subscription?.plan === 'premium' || subscription?.plan === 'pro';
  const limit = isPremium ? PREMIUM_TIER_LIMITS.searchesPerMonth : FREE_TIER_LIMITS.searchesPerMonth;

  // Get current month start
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Get search count for current month
  const [usage] = await sql`
    SELECT COUNT(*) as count FROM search_history
    WHERE user_id = ${userId} 
    AND created_at >= ${monthStart}
    AND created_at <= ${monthEnd}
  `;

  const searches = Number(usage?.count || 0);
  const remaining = isPremium ? Infinity : Math.max(0, limit - searches);
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    searches,
    limit,
    remaining,
    resetDate,
    isPremium,
  };
}

// Increment search count (called after successful search)
export async function incrementSearchCount(userId: string, query: string, resultsCount: number = 0): Promise<void> {
  // Check if we should track (only for logged-in users)
  if (!userId) return;

  try {
    await sql`
      INSERT INTO search_history (user_id, query, results_count)
      VALUES (${userId}, ${query}, ${resultsCount})
    `;
  } catch (error) {
    console.error('Error tracking search usage:', error);
    // Don't throw - usage tracking shouldn't break search
  }
}

// Check if user can perform search
export async function canPerformSearch(userId: string | null): Promise<{ allowed: boolean; reason?: string; usage?: UsageStats }> {
  // Guest users are always allowed (they have no limits, but results may be limited)
  if (!userId) {
    return { allowed: true };
  }

  const usage = await getMonthlyUsage(userId);

  if (usage.isPremium) {
    return { allowed: true, usage };
  }

  if (usage.searches >= usage.limit) {
    return {
      allowed: false,
      reason: `You've reached your monthly search limit of ${usage.limit}. Upgrade to Premium for unlimited searches.`,
      usage,
    };
  }

  return { allowed: true, usage };
}

// Reset usage (called monthly via cron or manually)
export async function resetMonthlyUsage(userId: string): Promise<void> {
  // This is handled automatically by querying by date range
  // No need to manually reset - just query current month
}

