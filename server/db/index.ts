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
// Note: Tables are created via migrations, this just ensures indexes exist
export async function initDatabase() {
  try {
    console.log('📊 Verifying database schema...');
    
    // Ensure indexes exist (tables should already exist from migrations)
    await sql`
      CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at DESC)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorite_doctors(user_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_favorites_npi ON favorite_doctors(npi)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON favorite_doctors(created_at DESC)
    `;
    console.log('✅ Database indexes verified');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    // Don't throw - tables might already exist from migrations
    console.warn('⚠️  Continuing anyway - tables may already exist');
  }
}

