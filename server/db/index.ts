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
    
    // Create users table (for authentication)
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text UNIQUE NOT NULL,
        password_hash text NOT NULL,
        created_at timestamptz DEFAULT now()
      )
    `;
    console.log('✅ Users table ready');

    // Create profiles table
    await sql`
      CREATE TABLE IF NOT EXISTS profiles (
        id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        email text NOT NULL,
        created_at timestamptz DEFAULT now()
      )
    `;
    console.log('✅ Profiles table ready');

    // Create search_history table
    await sql`
      CREATE TABLE IF NOT EXISTS search_history (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        query text NOT NULL,
        specialty text,
        location text,
        results_count integer DEFAULT 0,
        created_at timestamptz DEFAULT now()
      )
    `;
    console.log('✅ Search history table ready');

    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at DESC)
    `;
    console.log('✅ Database indexes ready');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

