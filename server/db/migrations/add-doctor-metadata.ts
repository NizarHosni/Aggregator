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

async function migrateDoctorMetadata() {
  console.log('🔄 Starting doctor metadata migration...');
  
  try {
    // Add missing columns to favorite_doctors table
    console.log('📦 Adding columns to favorite_doctors table...');
    
    await sql`
      DO $$
      BEGIN
        -- Add google_place_id if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'favorite_doctors' AND column_name = 'google_place_id') THEN
          ALTER TABLE favorite_doctors ADD COLUMN google_place_id TEXT;
        END IF;
        
        -- Add healthgrades_id if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'favorite_doctors' AND column_name = 'healthgrades_id') THEN
          ALTER TABLE favorite_doctors ADD COLUMN healthgrades_id TEXT;
        END IF;
        
        -- Add website if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'favorite_doctors' AND column_name = 'website') THEN
          ALTER TABLE favorite_doctors ADD COLUMN website TEXT;
        END IF;
        
        -- Add photo_url if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'favorite_doctors' AND column_name = 'photo_url') THEN
          ALTER TABLE favorite_doctors ADD COLUMN photo_url TEXT;
        END IF;
        
        -- Add photo_verified if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'favorite_doctors' AND column_name = 'photo_verified') THEN
          ALTER TABLE favorite_doctors ADD COLUMN photo_verified BOOLEAN DEFAULT FALSE;
        END IF;
      END $$;
    `;
    console.log('✅ Columns added to favorite_doctors table');

    // Create index for google_place_id
    await sql`
      CREATE INDEX IF NOT EXISTS idx_favorites_google_place ON favorite_doctors(google_place_id) WHERE google_place_id IS NOT NULL;
    `;
    console.log('✅ Index created for google_place_id');

    // Create doctors_photos table for centralized photo storage
    console.log('📦 Creating doctors_photos table...');
    await sql`
      CREATE TABLE IF NOT EXISTS doctors_photos (
        npi TEXT PRIMARY KEY,
        photo_url TEXT NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Doctors photos table created');

    // Create index for doctors_photos
    await sql`
      CREATE INDEX IF NOT EXISTS idx_doctors_photos_verified ON doctors_photos(verified) WHERE verified = TRUE;
    `;
    console.log('✅ Index created for doctors_photos');

    console.log('');
    console.log('✅ Doctor metadata migration completed successfully!');
    console.log('');
    console.log('📊 Added columns to favorite_doctors:');
    console.log('  - google_place_id');
    console.log('  - healthgrades_id');
    console.log('  - website');
    console.log('  - photo_url');
    console.log('  - photo_verified');
    console.log('');
    console.log('📊 Created table:');
    console.log('  - doctors_photos (centralized photo storage)');
    console.log('');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateDoctorMetadata();

