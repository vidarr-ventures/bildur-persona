// Create: src/app/api/test-status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getJobById } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Hardcode the job ID to test
    const jobId = '4deba76c-440f-4fa3-bc68-cfc036528cc';
    
    console.log(`Testing job status for: ${jobId}`);
    
    const job = await getJobById(jobId);
    
    if (!job) {
      return NextResponse.json({
        success: false,
        error: 'Job not found',
        jobId
      });
    }

return NextResponse.json({
      success: true,
      jobId,
      job: job,
      message: 'Job found successfully'
    });

  } catch (error) {
    console.error('Test status error:', error);
    return NextResponse.json({
      success: false,
      error: 'Database error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
