import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(request: NextRequest) {
  try {
    // Check for internal API key
    const authHeader = request.headers.get('authorization');
    const isInternalCall = authHeader?.startsWith('Bearer ') && 
                          authHeader.split(' ')[1] === process.env.INTERNAL_API_KEY;

    if (!isInternalCall) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Creating research_requests table...');

    // Create research_requests table
    await sql`
      CREATE TABLE IF NOT EXISTS research_requests (
        id SERIAL PRIMARY KEY,
        job_id VARCHAR(255) UNIQUE NOT NULL,
        website_url TEXT NOT NULL,
        amazon_url TEXT,
        keywords TEXT NOT NULL,
        email VARCHAR(255) NOT NULL,
        competitor_urls TEXT,
        plan_id VARCHAR(50) NOT NULL,
        plan_name VARCHAR(100) NOT NULL,
        discount_code VARCHAR(50),
        payment_session_id VARCHAR(255),
        amount_paid INTEGER DEFAULT 0,
        original_price INTEGER DEFAULT 0,
        final_price INTEGER DEFAULT 0,
        is_free BOOLEAN DEFAULT FALSE,
        status VARCHAR(50) DEFAULT 'queued',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        persona_report_sent BOOLEAN DEFAULT FALSE,
        persona_analysis TEXT,
        data_quality TEXT,
        persona_metadata TEXT
      )
    `;

    // Add new columns if they don't exist (for existing tables)
    await sql`ALTER TABLE research_requests ADD COLUMN IF NOT EXISTS persona_analysis TEXT`;
    await sql`ALTER TABLE research_requests ADD COLUMN IF NOT EXISTS data_quality TEXT`;
    await sql`ALTER TABLE research_requests ADD COLUMN IF NOT EXISTS persona_metadata TEXT`;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_research_requests_job_id ON research_requests(job_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_research_requests_email ON research_requests(email)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_research_requests_status ON research_requests(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_research_requests_created_at ON research_requests(created_at)`;

    console.log('✅ Database table created successfully');

    return NextResponse.json({
      success: true,
      message: 'Database table created successfully'
    });

  } catch (error) {
    console.error('Database setup error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create database table',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}