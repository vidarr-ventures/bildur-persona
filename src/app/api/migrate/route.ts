import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(request: NextRequest) {
  try {
    // Security check - only allow this in development or with special header
    const authHeader = request.headers.get('x-migration-key');
    if (authHeader !== process.env.INTERNAL_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Running database migration: Change jobs.id from UUID to TEXT');
    
    // Run the migration
    const result = await sql`
      ALTER TABLE jobs ALTER COLUMN id TYPE TEXT;
    `;
    
    console.log('Migration completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Database migration completed: jobs.id column changed from UUID to TEXT',
      result: result
    });
    
  } catch (error) {
    console.error('Migration failed:', error);
    return NextResponse.json({
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}