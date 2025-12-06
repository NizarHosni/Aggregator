import { sql } from '../index.js';

export async function addStripeSubscriptions() {
  try {
    console.log('📦 Updating subscriptions table for Stripe...');

    // Add missing columns if they don't exist
    await sql`
      ALTER TABLE subscriptions
      ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
      ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE
    `;

    // Update existing subscriptions table structure
    await sql`
      DO $$
      BEGIN
        -- Add stripe_price_id if missing
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'subscriptions' AND column_name = 'stripe_price_id'
        ) THEN
          ALTER TABLE subscriptions ADD COLUMN stripe_price_id TEXT;
        END IF;

        -- Add cancel_at_period_end if missing
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'subscriptions' AND column_name = 'cancel_at_period_end'
        ) THEN
          ALTER TABLE subscriptions ADD COLUMN cancel_at_period_end BOOLEAN DEFAULT FALSE;
        END IF;
      END $$;
    `;

    // Create subscription_usage table for tracking
    await sql`
      CREATE TABLE IF NOT EXISTS subscription_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        searches_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, month, year)
      )
    `;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_subscription_usage_user_id ON subscription_usage(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_subscription_usage_month_year ON subscription_usage(year, month)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL`;

    console.log('✅ Stripe subscriptions migration completed');
  } catch (error) {
    console.error('❌ Error in Stripe subscriptions migration:', error);
    throw error;
  }
}

