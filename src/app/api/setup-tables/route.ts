import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(request: NextRequest) {
  try {
    console.log('Setting up database tables...');
    
    // Create job_data table to store worker results
    await sql`
      CREATE TABLE IF NOT EXISTS job_data (
        id SERIAL PRIMARY KEY,
        job_id VARCHAR(255) NOT NULL,
        data_type VARCHAR(100) NOT NULL,
        data_content JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    
    // Add indexes for performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_job_data_job_id ON job_data(job_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_job_data_type ON job_data(data_type)
    `;
    
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_job_data_job_type ON job_data(job_id, data_type)
    `;
    
    console.log('Database tables created successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Database tables created successfully'
    });
    
  } catch (error) {
    console.error('Error setting up database tables:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to setup database tables',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}