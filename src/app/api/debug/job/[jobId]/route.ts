import { NextRequest, NextResponse } from 'next/server';
import { getJobData, listCachedJobs, getJobResults } from '@/lib/job-cache';
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
    
    // Get job results (data from individual workers)
    const jobResults = getJobResults(jobId);
    
    // Get database data
    let dbData = null;
    try {
      dbData = await getResearchRequest(jobId);
    } catch (error) {
      console.log('Database error:', error);
    }
    
    // Enhanced data source status
    const dataSourceStatuses = {
      website: analyzeDataSourceStatus(jobResults, 'website'),
      amazon: analyzeDataSourceStatus(jobResults, 'amazon'),
      reddit: analyzeDataSourceStatus(jobResults, 'reddit'),
      youtube: analyzeDataSourceStatus(jobResults, 'youtube'),
      persona: analyzeDataSourceStatus(jobResults, 'persona')
    };
    
    return NextResponse.json({
      jobId,
      cachedData,
      jobResults,
      allCachedJobs,
      dbData,
      dataSourceStatuses,
      summary: {
        cacheHasAmazonUrl: !!cachedData?.amazonUrl,
        dbHasAmazonUrl: !!dbData?.amazon_url,
        totalCachedJobs: allCachedJobs.length,
        cacheDataExists: !!cachedData,
        dbDataExists: !!dbData,
        jobResultsExists: !!jobResults,
        dataSourcesProcessed: Object.keys(jobResults || {}).length
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

function analyzeDataSourceStatus(jobResults: any, dataType: string) {
  if (!jobResults || !jobResults[dataType]) {
    return {
      status: 'not_started',
      reviewsCollected: 0,
      extractionMethod: 'Unknown',
      processingTime: null,
      statusCode: null,
      errorMessage: null
    };
  }
  
  const data = jobResults[dataType];
  
  return {
    status: data.success === false ? 'failed' : 
            data.error ? 'failed' : 
            data.processing ? 'processing' : 'completed',
    reviewsCollected: extractReviewCount(data),
    extractionMethod: extractMethod(data),
    processingTime: data.processingTime || data.metadata?.processingTime,
    statusCode: data.statusCode || data.response?.status,
    errorMessage: data.error || data.errorMessage,
    metadata: {
      timestamp: data.timestamp,
      dataQuality: data.dataQuality,
      analysis: data.analysis
    }
  };
}

function extractReviewCount(data: any): number {
  // Amazon reviews
  if (data.reviews && Array.isArray(data.reviews)) {
    return data.reviews.length;
  }
  if (data.data && data.data.reviews && Array.isArray(data.data.reviews)) {
    return data.data.reviews.length;
  }
  if (data.analysis && typeof data.analysis.reviewsFound === 'number') {
    return data.analysis.reviewsFound;
  }
  // Reddit posts and comments
  if (data.posts && Array.isArray(data.posts)) {
    return data.posts.length;
  }
  if (data.analysis && typeof data.analysis.postsFound === 'number') {
    const comments = data.analysis.commentsFound || 0;
    return data.analysis.postsFound + comments;
  }
  // YouTube comments
  if (data.comments && Array.isArray(data.comments)) {
    return data.comments.length;
  }
  if (data.analysis && typeof data.analysis.commentsFound === 'number') {
    return data.analysis.commentsFound;
  }
  // Website reviews
  if (data.websiteData && data.websiteData.customerReviews && Array.isArray(data.websiteData.customerReviews)) {
    return data.websiteData.customerReviews.length;
  }
  return 0;
}

function extractMethod(data: any): string {
  if (data.analysis && data.analysis.method) {
    return data.analysis.method;
  }
  if (data.metadata && data.metadata.extraction_method) {
    return data.metadata.extraction_method;
  }
  if (data.method) {
    return data.method;
  }
  if (data.dataQuality && data.dataQuality.method) {
    return data.dataQuality.method;
  }
  if (data.websiteData && data.websiteData.dataQuality && data.websiteData.dataQuality.method) {
    return data.websiteData.dataQuality.method;
  }
  return 'Unknown';
}