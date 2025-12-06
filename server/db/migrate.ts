import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function migrate() {
  console.log('🔄 Starting database migration...');
  
  try {
    // Drop old tables (cascade will drop dependent tables)
    console.log('📦 Dropping old tables...');
    await sql`DROP TABLE IF EXISTS favorite_doctors CASCADE`;
    await sql`DROP TABLE IF EXISTS search_history CASCADE`;
    await sql`DROP TABLE IF EXISTS users CASCADE`;
    console.log('✅ Old tables dropped');

    // Create users table with all new columns
    console.log('📦 Creating users table...');
    await sql`
      CREATE TABLE users (
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
    console.log('✅ Users table created');

    // Create search_history table
    console.log('📦 Creating search_history table...');
    await sql`
      CREATE TABLE search_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        query TEXT NOT NULL,
        specialty TEXT,
        location TEXT,
        results_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Search history table created');

    // Create favorite_doctors table
    console.log('📦 Creating favorite_doctors table...');
    await sql`
      CREATE TABLE favorite_doctors (
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
    console.log('✅ Favorite doctors table created');

    // Create indexes
    console.log('📦 Creating indexes...');
    await sql`CREATE INDEX idx_users_email ON users(email)`;
    await sql`CREATE INDEX idx_users_verification_token ON users(verification_token) WHERE verification_token IS NOT NULL`;
    await sql`CREATE INDEX idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL`;
    await sql`CREATE INDEX idx_search_history_user_id ON search_history(user_id)`;
    await sql`CREATE INDEX idx_search_history_created_at ON search_history(created_at DESC)`;
    await sql`CREATE INDEX idx_favorites_user_id ON favorite_doctors(user_id)`;
    await sql`CREATE INDEX idx_favorites_npi ON favorite_doctors(npi)`;
    console.log('✅ Indexes created');

    console.log('');
    console.log('✅ Migration completed successfully!');
    console.log('');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();

