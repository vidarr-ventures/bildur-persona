import { NextRequest, NextResponse } from 'next/server';
import { getJobById, getResearchRequest } from '@/lib/db';

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
    
    // Debug: Log what we found in the database
    console.log('=== JOB STATUS DEBUG ===');
    console.log('Job ID:', jobId);
    console.log('Research Request Amazon URL:', researchRequest?.amazon_url);
    console.log('Research Request Full Data:', JSON.stringify(researchRequest, null, 2));

    // Test all workers to see their current status
    // Use the production domain for worker calls to avoid preview URL issues
    const baseUrl = 'https://persona.bildur.ai';

    // Debug: Check if API key is available
    const hasApiKey = !!process.env.INTERNAL_API_KEY;
    const apiKeyLength = process.env.INTERNAL_API_KEY?.length || 0;

    const workers = [
      { name: 'website-crawler', endpoint: '/api/workers/website-crawler' },
      { name: 'amazon-reviews', endpoint: '/api/workers/amazon-reviews' },
      { name: 'reddit-scraper', endpoint: '/api/workers/reddit-scraper' },
      { name: 'youtube-comments', endpoint: '/api/workers/youtube-comments' },
      { name: 'persona-generator', endpoint: '/api/workers/persona-generator' }
    ];

    const workerStatuses = await Promise.all(
      workers.map(async (worker) => {
        try {
          const startTime = Date.now();
          const response = await fetch(`${baseUrl}${worker.endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`,
            },
            body: JSON.stringify({
              jobId,
              websiteUrl: researchRequest?.website_url || 'https://example.com',
              targetKeywords: researchRequest?.keywords || 'test',
              keywords: researchRequest?.keywords || 'test', // YouTube worker expects 'keywords'
              amazonUrl: researchRequest?.amazon_url,
              email: researchRequest?.email,
              planName: researchRequest?.plan_name
            }),
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });

          const responseTime = Date.now() - startTime;
          const isSuccess = response.ok;
          
          let responseData;
          try {
            responseData = await response.json();
          } catch {
            responseData = { error: 'Invalid JSON response' };
          }

          return {
            worker: worker.name,
            status: isSuccess ? 'success' : 'failed',
            httpStatus: response.status,
            responseTime,
            message: isSuccess ? responseData?.message || 'Completed' : responseData?.error || 'Failed',
            details: responseData
          };
        } catch (error) {
          return {
            worker: worker.name,
            status: 'error',
            httpStatus: 0,
            responseTime: 0,
            message: error instanceof Error ? error.message : 'Unknown error',
            details: null
          };
        }
      })
    );

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
        successful: workerStatuses.filter(w => w.status === 'success').length,
        failed: workerStatuses.filter(w => w.status === 'failed').length,
        errors: workerStatuses.filter(w => w.status === 'error').length
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