import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    
    console.log(`Getting simple status for job ${jobId}`);
    
    // Get job status from research_requests table
    const jobResult = await sql`
      SELECT job_id, status, created_at, completed_at, persona_analysis
      FROM research_requests 
      WHERE job_id = ${jobId}
    `;
    
    if (jobResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Job not found'
      }, { status: 404 });
    }
    
    const job = jobResult.rows[0];
    
    // Get worker data from job_data table
    const dataResult = await sql`
      SELECT data_type, created_at, updated_at
      FROM job_data 
      WHERE job_id = ${jobId}
      ORDER BY updated_at DESC
    `;
    
    const workerData = dataResult.rows.map(row => ({
      worker: row.data_type,
      completed: true,
      lastUpdated: row.updated_at
    }));

    return NextResponse.json({
      success: true,
      jobId: job.job_id,
      status: job.status,
      createdAt: job.created_at,
      completedAt: job.completed_at,
      hasPersona: !!job.persona_analysis,
      personaLength: job.persona_analysis?.length || 0,
      workers: workerData,
      totalWorkers: workerData.length,
      message: `Job status: ${job.status}. Workers completed: ${workerData.length}`
    });

  } catch (error) {
    console.error('Error getting job status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get job status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}