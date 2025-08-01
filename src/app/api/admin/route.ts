import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

// GET endpoint for database setup
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'setup-db') {
      console.log('Creating research_requests table...');

      try {
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
            persona_report_sent BOOLEAN DEFAULT FALSE
          )
        `;

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
      } catch (dbError) {
        console.error('Database error:', dbError);
        return NextResponse.json({
          success: false,
          error: 'Database setup failed',
          details: dbError instanceof Error ? dbError.message : 'Unknown database error'
        }, { status: 500 });
      }
    }

    if (action === 'check-table') {
      try {
        const result = await sql`
          SELECT COUNT(*) as count FROM information_schema.tables 
          WHERE table_name = 'research_requests'
        `;
        
        const tableExists = result.rows[0].count > 0;
        
        return NextResponse.json({
          success: true,
          tableExists,
          message: tableExists ? 'Table exists' : 'Table does not exist'
        });
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: 'Failed to check table',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action',
      availableActions: ['setup-db', 'check-table']
    }, { status: 400 });

  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Admin API error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}