import { NextRequest, NextResponse } from 'next/server';
import { getJobById, getResearchRequest } from '@/lib/db';
import { getJobData } from '@/lib/job-cache';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Get job and research request data
    // Note: job might not exist in jobs table for free sessions, but researchRequest should exist
    let job = null;
    try {
      job = await getJobById(jobId);
    } catch (error) {
      console.log('Job not found in jobs table (expected for free sessions):', error);
    }
    
    const researchRequest = await getResearchRequest(jobId);
    
    // Get data from cache as fallback/primary source
    const cachedJobData = getJobData(jobId);
    
    // Debug: Log what we found in the database and cache
    console.log('=== JOB STATUS DEBUG ===');
    console.log('Job ID:', jobId);
    console.log('Research Request Amazon URL:', researchRequest?.amazon_url);
    console.log('Cached Job Data Amazon URL:', cachedJobData?.amazonUrl);
    console.log('Research Request Full Data:', JSON.stringify(researchRequest, null, 2));
    console.log('Cached Job Data Full Data:', JSON.stringify(cachedJobData, null, 2));

    // Test all workers to see their current status
    // Use the production domain for worker calls to avoid preview URL issues
    const baseUrl = 'https://persona.bildur.ai';

    // Debug: Check if API key is available
    const hasApiKey = !!process.env.INTERNAL_API_KEY;
    const apiKeyLength = process.env.INTERNAL_API_KEY?.length || 0;

    // Worker system has been removed - return placeholder status
    console.log('Worker system has been removed - returning placeholder status');

    const workerStatuses = [
      {
        worker: 'website-crawler',
        status: 'removed',
        httpStatus: null,
        responseTime: 0,
        message: 'Worker system has been removed',
        details: { note: 'Worker endpoints no longer exist' }
      },
      {
        worker: 'amazon-reviews',
        status: 'removed',
        httpStatus: null,
        responseTime: 0,
        message: 'Worker system has been removed',
        details: { note: 'Worker endpoints no longer exist' }
      },
      {
        worker: 'reddit-scraper',
        status: 'removed',
        httpStatus: null,
        responseTime: 0,
        message: 'Worker system has been removed',
        details: { note: 'Worker endpoints no longer exist' }
      },
      {
        worker: 'youtube-comments',
        status: 'removed',
        httpStatus: null,
        responseTime: 0,
        message: 'Worker system has been removed',
        details: { note: 'Worker endpoints no longer exist' }
      },
      {
        worker: 'persona-generator',
        status: 'removed',
        httpStatus: null,
        responseTime: 0,
        message: 'Worker system has been removed',
        details: { note: 'Worker endpoints no longer exist' }
      }
    ];

    return NextResponse.json({
      success: true,
      jobId,
      job: job ? {
        id: (job as any).id || jobId,
        status: (job as any).status || 'unknown',
        website_url: (job as any).website_url,
        primary_keywords: (job as any).primary_keywords,
        created_at: (job as any).created_at,
        completed_at: (job as any).completed_at
      } : null,
      researchRequest: researchRequest ? {
        id: researchRequest.id,
        status: researchRequest.status,
        email: researchRequest.email,
        plan_name: researchRequest.plan_name,
        created_at: researchRequest.created_at,
        completed_at: researchRequest.completed_at
      } : null,
      workers: workerStatuses,
      summary: {
        total: workerStatuses.length,
        successful: 0,
        failed: 0,
        errors: 0,
        removed: workerStatuses.filter(w => w.status === 'removed').length,
        note: 'Worker system has been removed'
      },
      debug: {
        baseUrl,
        hasApiKey,
        apiKeyLength
      }
    });

  } catch (error) {
    console.error('Error getting job status:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get job status', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}