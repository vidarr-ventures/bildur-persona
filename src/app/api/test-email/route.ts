import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { sendPersonaReport } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { action, email } = await request.json();

    if (action === 'setup-db') {
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
          persona_report_sent BOOLEAN DEFAULT FALSE
        )
      `;

      // Create indexes
      await sql`CREATE INDEX IF NOT EXISTS idx_research_requests_job_id ON research_requests(job_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_research_requests_email ON research_requests(email)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_research_requests_status ON research_requests(status)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_research_requests_created_at ON research_requests(created_at)`;

      return NextResponse.json({
        success: true,
        message: 'Database table created successfully'
      });
    }

    if (action === 'test-email' && email) {
      console.log(`Sending test email to ${email}`);

      const emailSent = await sendPersonaReport({
        jobId: 'test_' + Date.now(),
        email,
        websiteUrl: 'https://example.com',
        keywords: 'test, persona, analysis',
        personaReport: `# Test Persona Report

This is a test email to verify that the Resend integration is working correctly.

## Test Analysis Results
- Email service: ✅ Working
- Template rendering: ✅ Working  
- Database integration: ✅ Ready

Your persona analysis system is now ready to send detailed reports!`,
        planName: 'Test Plan',
        analysisDate: new Date().toLocaleDateString()
      });

      return NextResponse.json({
        success: emailSent,
        message: emailSent ? 'Test email sent successfully' : 'Failed to send test email'
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Test API error:', error);
    return NextResponse.json({
      success: false,
      error: 'API error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}