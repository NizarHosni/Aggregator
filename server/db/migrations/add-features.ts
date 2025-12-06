import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../../.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function migrateFeatures() {
  console.log('🔄 Starting feature migration...');
  
  try {
    // ===============================
    // 1. REVIEWS TABLE
    // ===============================
    console.log('📦 Creating reviews table...');
    await sql`
      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_npi TEXT NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        wait_time INTEGER CHECK (wait_time >= 1 AND wait_time <= 5),
        bedside_manner INTEGER CHECK (bedside_manner >= 1 AND bedside_manner <= 5),
        staff_friendliness INTEGER CHECK (staff_friendliness >= 1 AND staff_friendliness <= 5),
        comment TEXT,
        photos TEXT[], -- Array of photo URLs
        verified_patient BOOLEAN DEFAULT FALSE,
        helpful_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, doctor_npi)
      )
    `;
    console.log('✅ Reviews table created');

    // Review indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_reviews_doctor_npi ON reviews(doctor_npi)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC)`;
    console.log('✅ Review indexes created');

    // ===============================
    // 2. BLOG POSTS TABLE
    // ===============================
    console.log('📦 Creating blog_posts table...');
    await sql`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        content TEXT NOT NULL,
        excerpt TEXT,
        author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category TEXT,
        tags TEXT[],
        featured_image_url TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
        published_at TIMESTAMPTZ,
        seo_title TEXT,
        seo_description TEXT,
        seo_keywords TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Blog posts table created');

    // Blog indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_blog_posts_author ON blog_posts(author_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category)`;
    console.log('✅ Blog indexes created');

    // ===============================
    // 3. SUBSCRIPTIONS TABLE
    // ===============================
    console.log('📦 Creating subscriptions table...');
    await sql`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium', 'pro')),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'paused')),
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        current_period_start TIMESTAMPTZ,
        current_period_end TIMESTAMPTZ,
        canceled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Subscriptions table created');

    // Subscription indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`;
    console.log('✅ Subscription indexes created');

    // ===============================
    // 4. AFFILIATE CLICKS TABLE
    // ===============================
    console.log('📦 Creating affiliate_clicks table...');
    await sql`
      CREATE TABLE IF NOT EXISTS affiliate_clicks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        doctor_npi TEXT NOT NULL,
        platform TEXT NOT NULL CHECK (platform IN ('zocdoc', 'healthgrades', 'vitals', 'other')),
        clicked_at TIMESTAMPTZ DEFAULT NOW(),
        ip_address TEXT,
        user_agent TEXT
      )
    `;
    console.log('✅ Affiliate clicks table created');

    // Affiliate indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_doctor_npi ON affiliate_clicks(doctor_npi)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_platform ON affiliate_clicks(platform)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_clicked_at ON affiliate_clicks(clicked_at DESC)`;
    console.log('✅ Affiliate click indexes created');

    // ===============================
    // 5. AD IMPRESSIONS TABLE
    // ===============================
    console.log('📦 Creating ad_impressions table...');
    await sql`
      CREATE TABLE IF NOT EXISTS ad_impressions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ad_id TEXT NOT NULL,
        page TEXT NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        viewed_at TIMESTAMPTZ DEFAULT NOW(),
        ip_address TEXT
      )
    `;
    console.log('✅ Ad impressions table created');

    // Ad impression indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad_id ON ad_impressions(ad_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ad_impressions_page ON ad_impressions(page)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ad_impressions_viewed_at ON ad_impressions(viewed_at DESC)`;
    console.log('✅ Ad impression indexes created');

    // ===============================
    // 6. USER ACTIONS TABLE (Analytics)
    // ===============================
    console.log('📦 Creating user_actions table...');
    await sql`
      CREATE TABLE IF NOT EXISTS user_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action_type TEXT NOT NULL CHECK (action_type IN ('search', 'view_doctor', 'save_favorite', 'remove_favorite', 'write_review', 'book_appointment', 'upgrade', 'cancel_subscription')),
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ User actions table created');

    // User actions indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_user_actions_user_id ON user_actions(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_actions_action_type ON user_actions(action_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_actions_created_at ON user_actions(created_at DESC)`;
    console.log('✅ User action indexes created');

    // ===============================
    // 7. UPDATE USERS TABLE
    // ===============================
    console.log('📦 Updating users table...');
    
    // Add role column if it doesn't exist
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') THEN
          ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));
        END IF;
      END $$;
    `;
    console.log('✅ Users table updated with role column');

    console.log('');
    console.log('✅ Feature migration completed successfully!');
    console.log('');
    console.log('📊 Created tables:');
    console.log('  - reviews (doctor ratings with photos)');
    console.log('  - blog_posts (CMS for SEO content)');
    console.log('  - subscriptions (premium tiers)');
    console.log('  - affiliate_clicks (tracking)');
    console.log('  - ad_impressions (analytics)');
    console.log('  - user_actions (user analytics)');
    console.log('');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateFeatures();

