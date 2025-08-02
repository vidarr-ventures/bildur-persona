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
    
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';

    console.log(`Using base URL: ${baseUrl}`);

    const testResults = [];

    // Test each worker individually
    const workers = [
      { name: 'website-crawler', endpoint: '/api/workers/website-crawler' },
      { name: 'amazon-reviews', endpoint: '/api/workers/amazon-reviews' },
      { name: 'reddit-scraper', endpoint: '/api/workers/reddit-scraper' },
      { name: 'youtube-comments', endpoint: '/api/workers/youtube-comments' },
      { name: 'persona-generator', endpoint: '/api/workers/persona-generator' }
    ];

    for (const worker of workers) {
      try {
        console.log(`🔧 Testing ${worker.name}...`);
        
        // Different payload for persona generator
        const payload = worker.name === 'persona-generator' ? {
          jobId,
          websiteUrl: 'https://groundluxe.com',
          targetKeywords: 'grounding sheets',
          keywords: 'grounding sheets',
          amazonUrl: 'https://amazon.com/dp/B07RLNS58H',
          email: 'test@example.com',
          planName: 'Test Plan'
        } : {
          jobId,
          websiteUrl: 'https://groundluxe.com',
          targetKeywords: 'grounding sheets',
          keywords: 'grounding sheets', // For YouTube worker
          amazonUrl: 'https://amazon.com/dp/B07RLNS58H'
        };

        const startTime = Date.now();
        const response = await fetch(`${baseUrl}${worker.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        const endTime = Date.now();
        const responseText = await response.text();

        testResults.push({
          worker: worker.name,
          endpoint: worker.endpoint,
          status: response.status,
          success: response.ok,
          responseTime: endTime - startTime,
          responseSize: responseText.length,
          responsePreview: responseText.substring(0, 200),
          headers: Object.fromEntries(response.headers.entries())
        });

        console.log(`${response.ok ? '✅' : '❌'} ${worker.name}: ${response.status} (${endTime - startTime}ms)`);

      } catch (error) {
        console.error(`❌ ${worker.name} failed:`, error);
        testResults.push({
          worker: worker.name,
          endpoint: worker.endpoint,
          status: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timeout: error instanceof Error && error.name === 'AbortError'
        });
      }
    }

    // Test queue processing trigger
    try {
      console.log('🔧 Testing queue processor...');
      const startTime = Date.now();
      const queueResponse = await fetch(`${baseUrl}/api/queue/processor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: true }),
        signal: AbortSignal.timeout(15000)
      });
      const endTime = Date.now();
      const queueText = await queueResponse.text();

      testResults.push({
        worker: 'queue-processor',
        endpoint: '/api/queue/processor',
        status: queueResponse.status,
        success: queueResponse.ok,
        responseTime: endTime - startTime,
        responsePreview: queueText.substring(0, 200)
      });

    } catch (error) {
      testResults.push({
        worker: 'queue-processor',
        endpoint: '/api/queue/processor',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Analyze results
    const workingWorkers = testResults.filter(r => r.success).length;
    const totalWorkers = testResults.length;
    const failedWorkers = testResults.filter(r => !r.success);
    const timeoutWorkers = testResults.filter(r => r.timeout);

    return NextResponse.json({
      jobId,
      baseUrl,
      summary: {
        total: totalWorkers,
        working: workingWorkers,
        failed: failedWorkers.length,
        timeouts: timeoutWorkers.length,
        successRate: `${Math.round((workingWorkers / totalWorkers) * 100)}%`
      },
      failedWorkers: failedWorkers.map(w => ({ 
        name: w.worker, 
        error: w.error,
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