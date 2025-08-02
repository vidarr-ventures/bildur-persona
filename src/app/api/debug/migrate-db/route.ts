import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Running database migration to fix schema issues...');

    // Check what columns exist in research_requests
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'research_requests'
      ORDER BY ordinal_position
    `;

    console.log('Current research_requests columns:', columns.rows);

    // Add missing columns if they don't exist
    const migrations = [
      {
        name: 'amazon_url',
        sql: `ALTER TABLE research_requests ADD COLUMN IF NOT EXISTS amazon_url TEXT`
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

    const results = [];

    for (const migration of migrations) {
      try {
        console.log(`Adding column: ${migration.name}`);
        await sql.query(migration.sql);
        results.push({ column: migration.name, status: 'success' });
        console.log(`✅ Added column: ${migration.name}`);
      } catch (error) {
        console.log(`⚠️ Column ${migration.name} might already exist or migration failed:`, error);
        results.push({ 
          column: migration.name, 
          status: 'skipped',
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Check if job_id column exists and add if missing
    const hasJobId = columns.rows.some(col => col.column_name === 'job_id');
    if (!hasJobId) {
      try {
        console.log('Adding missing job_id column...');
        await sql`ALTER TABLE research_requests ADD COLUMN job_id VARCHAR(255) UNIQUE`;
        results.push({ column: 'job_id', status: 'added' });
        console.log('✅ Added job_id column');
      } catch (error) {
        console.error('❌ Failed to add job_id column:', error);
        results.push({ 
          column: 'job_id', 
          status: 'failed',
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else {
      results.push({ column: 'job_id', status: 'exists' });
    }

    // Verify final schema
    const finalColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'research_requests'
      ORDER BY ordinal_position
    `;

    return NextResponse.json({
      success: true,
      message: 'Database migration completed',
      results,
      schema: {
        before: columns.rows,
        after: finalColumns.rows
      }
    });

  } catch (error) {
    console.error('Database migration error:', error);
    return NextResponse.json({
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Check current schema without making changes
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'research_requests'
      ORDER BY ordinal_position
    `;

    return NextResponse.json({
      table: 'research_requests',
      columns: columns.rows,
      analysis: {
        hasJobId: columns.rows.some(col => col.column_name === 'job_id'),
        hasAmazonUrl: columns.rows.some(col => col.column_name === 'amazon_url'),
        hasPersonaAnalysis: columns.rows.some(col => col.column_name === 'persona_analysis'),
        hasDataQuality: columns.rows.some(col => col.column_name === 'data_quality'),
        hasPersonaMetadata: columns.rows.some(col => col.column_name === 'persona_metadata'),
        totalColumns: columns.rows.length
      }
    });

  } catch (error) {
    console.error('Schema check error:', error);
    return NextResponse.json({
      error: 'Failed to check schema',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}