import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (two levels up from server/db/)
dotenv.config({ path: join(__dirname, '../../.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL is not set in .env file');
  console.error('Please make sure your .env file contains: DATABASE_URL=your_neon_database_url');
  throw new Error('DATABASE_URL environment variable is required');
}

export const sql = neon(databaseUrl);

// Initialize database schema
export async function initDatabase() {
  try {
    console.log('📊 Creating database tables...');
    
    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        email_verified BOOLEAN DEFAULT FALSE,
        verification_token TEXT,
        verification_token_expires TIMESTAMPTZ,
        reset_token TEXT,
        reset_token_expires TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Users table ready');
    
    // Create search_history table
    await sql`
      CREATE TABLE IF NOT EXISTS search_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        query TEXT NOT NULL,
        specialty TEXT,
        location TEXT,
        results_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Search history table ready');

    // Create favorite_doctors table
    await sql`
      CREATE TABLE IF NOT EXISTS favorite_doctors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        npi TEXT NOT NULL,
        name TEXT NOT NULL,
        specialty TEXT NOT NULL,
        location TEXT NOT NULL,
        phone TEXT NOT NULL,
        rating NUMERIC(3,1) DEFAULT 0,
        years_experience INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, npi)
      )
    `;
    console.log('✅ Favorite doctors table ready');

    // Create indexes - wrap in try-catch to handle existing tables
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token) WHERE verification_token IS NOT NULL`;
      await sql`CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL`;
      await sql`CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorite_doctors(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_favorites_npi ON favorite_doctors(npi)`;
      console.log('✅ Database indexes ready');
    } catch (indexError) {
      console.log('⚠️  Some indexes may already exist, continuing...');
    }

    // Run Stripe subscriptions migration
    try {
      const { addStripeSubscriptions } = await import('./migrations/add-stripe-subscriptions.js');
      await addStripeSubscriptions();
    } catch (migrationError) {
      console.warn('⚠️  Stripe subscriptions migration failed (may already be applied):', migrationError);
    }
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}
