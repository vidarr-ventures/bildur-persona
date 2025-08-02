const { sql } = require('@vercel/postgres');

async function runMigration() {
  try {
    console.log('🔧 Running database migration...');

    // Check current columns
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'research_requests'
      ORDER BY ordinal_position
    `;

    console.log('Current research_requests columns:', columns.rows);

    // Add missing columns
    const migrations = [
      {
        name: 'job_id',
        sql: `ALTER TABLE research_requests ADD COLUMN IF NOT EXISTS job_id VARCHAR(255) UNIQUE`
      },
      {
        name: 'persona_analysis',
        sql: `ALTER TABLE research_requests ADD COLUMN IF NOT EXISTS persona_analysis TEXT`
      },
      {
        name: 'data_quality', 
        sql: `ALTER TABLE research_requests ADD COLUMN IF NOT EXISTS data_quality TEXT`
      },
      {
        name: 'persona_metadata',
        sql: `ALTER TABLE research_requests ADD COLUMN IF NOT EXISTS persona_metadata TEXT`
      }
    ];

    for (const migration of migrations) {
      try {
        console.log(`Adding column: ${migration.name}`);
        await sql.query(migration.sql);
        console.log(`✅ Added column: ${migration.name}`);
      } catch (error) {
        console.log(`⚠️ Column ${migration.name} might already exist:`, error.message);
      }
    }

    // Verify final schema
    const finalColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'research_requests'
      ORDER BY ordinal_position
    `;

    console.log('\n✅ Migration completed!');
    console.log('Final schema:', finalColumns.rows);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();