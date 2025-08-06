import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Getting comprehensive system status...');

    // Get recent jobs from both tables
    const recentJobs = await sql`
      SELECT 
        j.id as job_id,
        j.status as job_status,
        j.progress,
        j.created_at as job_created,
        j.completed_at as job_completed,
        j.error_message,
        rr.email,
        rr.status as research_status,
        rr.created_at as research_created,
        rr.completed_at as research_completed,
        rr.persona_report_sent,
        rr.persona_analysis IS NOT NULL as has_persona,
        rr.website_url,
        rr.keywords
      FROM jobs j
      LEFT JOIN research_requests rr ON j.id = rr.job_id
      ORDER BY j.created_at DESC
      LIMIT 20
    `;

    // Queue system has been removed
    const queueStats = { pending: 0, processing: 0, note: 'Queue system removed' };

    // Get stuck jobs (processing for more than 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const stuckJobs = await sql`
      SELECT id, status, created_at 
      FROM jobs 
      WHERE status = 'processing' 
      AND created_at < ${thirtyMinutesAgo}
    `;

    // Get environment info
    const envInfo = {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasResendKey: !!process.env.RESEND_API_KEY,
      hasVercelKV: !!process.env.KV_URL,
      hasPostgres: !!process.env.POSTGRES_URL,
      vercelUrl: process.env.VERCEL_URL || 'localhost',
      nodeEnv: process.env.NODE_ENV
    };

    // Test external services
    const serviceTests = {
      openai: false,
      resend: false,
      database: false
    };

    // Test OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
        });
        serviceTests.openai = openaiResponse.ok;
      } catch (e) {
        serviceTests.openai = false;
      }
    }

    // Test database
    try {
      await sql`SELECT 1`;
      serviceTests.database = true;
    } catch (e) {
      serviceTests.database = false;
    }

    // Test Resend (if we have the key)
    if (process.env.RESEND_API_KEY) {
      try {
        const resendResponse = await fetch('https://api.resend.com/domains', {
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` }
        });
        serviceTests.resend = resendResponse.ok;
      } catch (e) {
        serviceTests.resend = false;
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      systemHealth: {
        environment: envInfo,
        services: serviceTests,
        queue: queueStats
      },
      jobAnalysis: {
        total: recentJobs.rows.length,
        stuck: stuckJobs.rows.length,
        byStatus: recentJobs.rows.reduce((acc: any, job: any) => {
          const status = job.job_status || 'unknown';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {}),
        withPersonas: recentJobs.rows.filter((job: any) => job.has_persona).length,
        emailsSent: recentJobs.rows.filter((job: any) => job.persona_report_sent).length
      },
      recentJobs: recentJobs.rows.map((job: any) => ({
        jobId: job.job_id,
        email: job.email,
        website: job.website_url,
        keywords: job.keywords,
        jobStatus: job.job_status,
        researchStatus: job.research_status,
        progress: job.progress,
        hasPersona: job.has_persona,
        emailSent: job.persona_report_sent,
        created: job.job_created,
        completed: job.job_completed || job.research_completed,
        errorMessage: job.error_message,
        processingTime: job.job_completed ? 
          Math.round((new Date(job.job_completed).getTime() - new Date(job.job_created).getTime()) / 1000) : 
          Math.round((new Date().getTime() - new Date(job.job_created).getTime()) / 1000)
      })),
      stuckJobs: stuckJobs.rows
    });

  } catch (error) {
    console.error('System status error:', error);
    return NextResponse.json({
      error: 'Failed to get system status',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}