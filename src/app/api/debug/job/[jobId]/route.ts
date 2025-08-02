import { NextRequest, NextResponse } from 'next/server';
import { getJobData, listCachedJobs } from '@/lib/job-cache';
import { getResearchRequest } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    
    console.log('=== DEBUG ENDPOINT CALLED ===');
    console.log('Job ID:', jobId);
    
    // Get cache data
    const cachedData = getJobData(jobId);
    const allCachedJobs = listCachedJobs();
    
    // Get database data
    let dbData = null;
    try {
      dbData = await getResearchRequest(jobId);
    } catch (error) {
      console.log('Database error:', error);
    }
    
    return NextResponse.json({
      jobId,
      cachedData,
      allCachedJobs,
      dbData,
      summary: {
        cacheHasAmazonUrl: !!cachedData?.amazonUrl,
        dbHasAmazonUrl: !!dbData?.amazon_url,
        totalCachedJobs: allCachedJobs.length,
        cacheDataExists: !!cachedData,
        dbDataExists: !!dbData
      }
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}