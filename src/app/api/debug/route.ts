import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    // Check if jobs table exists and what columns it has
    const tableInfo = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'jobs'
      ORDER BY ordinal_position;
    `;

    // Also get a sample job to see the actual structure
    let sampleJob = null;
    try {
      const sample = await sql`SELECT * FROM jobs LIMIT 1`;
      sampleJob = sample.rows[0] || null;
    } catch (e) {
      sampleJob = { error: 'Could not fetch sample job' };
    }

    // Check all tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    return NextResponse.json({
      success: true,
      tables: tables.rows,
      jobsTableColumns: tableInfo.rows,
      sampleJob: sampleJob,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Database inspection failed',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
