import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    // Check what status values currently exist in the database
    const statusValues = await sql`
      SELECT DISTINCT status, COUNT(*) as count
      FROM research_requests 
      WHERE status IS NOT NULL
      GROUP BY status
      ORDER BY count DESC
    `;

    // Also get the table constraints
    const constraints = await sql`
      SELECT conname, pg_get_constraintdef(oid) as constraint_def
      FROM pg_constraint 
      WHERE conrelid = 'research_requests'::regclass
      AND conname LIKE '%status%'
    `;

    return NextResponse.json({
      statusValues: statusValues.rows,
      constraints: constraints.rows,
      message: 'Status values and constraints from database'
    });

  } catch (error) {
    console.error('Error checking status values:', error);
    return NextResponse.json({
      error: 'Failed to check status values',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}