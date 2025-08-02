import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId') || 'ecb8d1f7-d4f3-42ee-9b73-3a08d4086617';
    
    console.log(`🔍 Checking test job: ${jobId}`);
    
    // Check job in jobs table
    const jobResult = await sql`SELECT * FROM jobs WHERE id = ${jobId}`;
    const job = jobResult.rows[0];
    
    // Check research request
    const researchResult = await sql`SELECT * FROM research_requests WHERE job_id = ${jobId}`;
    const researchRequest = researchResult.rows[0];
    
    // Check data tables
    const dataCounts = {};
    const tables = ['website_data', 'amazon_data', 'reddit_data', 'youtube_data'];
    
    for (const table of tables) {
      try {
        const result = await sql`SELECT COUNT(*) as count FROM ${sql(table)} WHERE job_id = ${jobId}`;
        dataCounts[table] = parseInt(result.rows[0]?.count || '0');
      } catch (error) {
        dataCounts[table] = `Error: ${error.message}`;
      }
    }
    
    return NextResponse.json({
      success: true,
      jobId,
      timestamp: new Date().toISOString(),
      job: job ? {
        id: job.id,
        status: job.status,
        progress: job.progress,
        created_at: job.created_at,
        completed_at: job.completed_at,
        error_message: job.error_message
      } : null,
      researchRequest: researchRequest ? {
        id: researchRequest.id,
        status: researchRequest.status,
        email: researchRequest.email,
        website_url: researchRequest.website_url,
        keywords: researchRequest.keywords,
        amazon_url: researchRequest.amazon_url,
        created_at: researchRequest.created_at,
        completed_at: researchRequest.completed_at,
        has_persona_analysis: !!researchRequest.persona_analysis,
        persona_report_sent: researchRequest.persona_report_sent
      } : null,
      dataCounts
    });
    
  } catch (error) {
    console.error('Error checking test job:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check test job',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}