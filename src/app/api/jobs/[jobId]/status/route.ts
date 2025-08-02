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
    const job = await getJobById(jobId);
    const researchRequest = await getResearchRequest(jobId);

    // Test all workers to see their current status
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXTAUTH_URL || 'http://localhost:3000';

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