import { NextRequest, NextResponse } from 'next/server';

// UUID validation and generation helpers
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function POST(request: NextRequest) {
  try {
    let { jobId } = await request.json();
    
    // If no jobId provided or if it's not a UUID, generate a valid UUID
    if (!jobId || !isValidUUID(jobId)) {
      jobId = generateUUID();
      console.log(`Generated valid UUID for testing: ${jobId}`);
    }

    console.log(`🔍 Tracing job processing for job: ${jobId}`);
    
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://persona.bildur.ai'
      : process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'http://localhost:3000';

    console.log(`Using base URL: ${baseUrl}`);

    const testResults = [];

    // Worker system has been removed
    const workers = [
      { name: 'website-crawler', status: 'removed' },
      { name: 'amazon-reviews', status: 'removed' },
      { name: 'reddit-scraper', status: 'removed' },
      { name: 'youtube-comments', status: 'removed' },
      { name: 'persona-generator', status: 'removed' }
    ];

    for (const worker of workers) {
      console.log(`Worker ${worker.name} has been removed`);
      
      testResults.push({
        worker: worker.name,
        endpoint: 'N/A - Worker removed',
        status: 404,
        success: false,
        responseTime: 0,
        responseSize: 0,
        responsePreview: 'Worker system has been removed',
        headers: {},
        note: 'All worker endpoints have been removed as part of system simplification'
      });
    }

    // Queue system has also been removed
    console.log('Queue processor has also been removed');
    testResults.push({
      worker: 'queue-processor',
      endpoint: 'N/A - Queue removed',
      status: 404,
      success: false,
      responseTime: 0,
      responsePreview: 'Queue system has been removed',
      note: 'Queue processor endpoints have been removed'
    });

    // Analyze results - all workers have been removed
    const workingWorkers = 0;
    const totalWorkers = testResults.length;
    const failedWorkers = testResults; // All are effectively "failed" since they're removed
    const timeoutWorkers = []; // No timeout workers since system is removed

    return NextResponse.json({
      jobId,
      baseUrl,
      authStatus: {
        hasInternalApiKey: !!process.env.INTERNAL_API_KEY,
        apiKeyLength: process.env.INTERNAL_API_KEY?.length || 0
      },
      summary: {
        total: totalWorkers,
        working: workingWorkers,
        failed: failedWorkers.length,
        timeouts: timeoutWorkers.length,
        successRate: `${Math.round((workingWorkers / totalWorkers) * 100)}%`
      },
      failedWorkers: failedWorkers.map(w => ({ 
        name: w.worker, 
        error: 'Worker system removed',
        status: w.status 
      })),
      detailedResults: testResults,
      recommendations: [
        workingWorkers === totalWorkers ? 
          '✅ All workers are responding - issue may be in job completion logic' :
          `❌ ${failedWorkers.length} workers failing - fix these first`,
        timeoutWorkers.length > 0 ? 
          `⚠️ ${timeoutWorkers.length} workers timing out - check for infinite loops or external API issues` :
          '✅ No timeout issues detected',
        failedWorkers.some(w => w.status === 404) ?
          '❌ Some endpoints not found - check routing' :
          '✅ All endpoints exist'
      ]
    });

  } catch (error) {
    console.error('Job processing trace error:', error);
    return NextResponse.json({
      error: 'Failed to trace job processing',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Job Processing Trace Endpoint',
    usage: 'POST with { "jobId": "test_job_123" }',
    description: 'Tests all workers individually to identify where job processing fails'
  });
}