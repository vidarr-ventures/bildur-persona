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
    
    // Get database data (where workers actually save their results)
    let dbData = null;
    let dbJobData = null;
    try {
      dbData = await getResearchRequest(jobId);
      // Get all job data from database (this is where workers save their results)
      const { getJobData: getDbJobData } = await import('@/lib/db');
      dbJobData = await getDbJobData(jobId);
    } catch (error) {
      console.log('Database error:', error);
    }
    
    // Enhanced data source status
    // Analyze competitor statuses
    const competitorStatuses: any[] = [];
    if (cachedData?.competitorUrls && Array.isArray(cachedData.competitorUrls)) {
      cachedData.competitorUrls.forEach((url: string, index: number) => {
        const competitorKey = `competitor_${index}`;
        competitorStatuses.push({
          url,
          index,
          ...analyzeDataSourceStatus(jobResults, competitorKey)
        });
      });
    }
    
    const dataSourceStatuses = {
      website: analyzeDataSourceStatusFromDb(dbJobData, 'website') || analyzeDataSourceStatus(jobResults, 'website'),
      amazon: analyzeDataSourceStatusFromDb(dbJobData, 'amazon_reviews') || analyzeDataSourceStatus(jobResults, 'amazon'),
      reddit: analyzeDataSourceStatusFromDb(dbJobData, 'reddit') || analyzeDataSourceStatus(jobResults, 'reddit'),
      youtube: analyzeDataSourceStatusFromDb(dbJobData, 'youtube_comments') || analyzeDataSourceStatus(jobResults, 'youtube_comments') || analyzeDataSourceStatus(jobResults, 'youtube'),
      persona: analyzeDataSourceStatusFromDb(dbJobData, 'persona_profile') || analyzeDataSourceStatus(jobResults, 'persona'),
      competitors: competitorStatuses
    };
    
    // Extract final persona content
    let finalPersona = null;
    if (jobResults?.persona?.persona) {
      const p = jobResults.persona.persona;
      finalPersona = `Name: ${p.name}
Age: ${p.age}
Occupation: ${p.occupation}
Location: ${p.location}

Bio: ${p.bio}

Pain Points:
${p.painPoints?.map((point: string) => `• ${point}`).join('\n')}

Motivations:
${p.motivations?.map((mot: string) => `• ${mot}`).join('\n')}

Buying Behavior: ${p.buyingBehavior}

Confidence Score: ${jobResults.persona.analysis?.confidence ? (jobResults.persona.analysis.confidence * 100).toFixed(0) + '%' : 'N/A'}`;
    }
    
    return NextResponse.json({
      jobId,
      cachedData,
      jobResults,
      allCachedJobs,
      dbData,
      dataSourceStatuses,
      finalPersona,
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

function analyzeDataSourceStatusFromDb(dbJobData: any, dataType: string) {
  if (!dbJobData || !dbJobData[dataType]) {
    return null; // Return null so we can fallback to cache analysis
  }
  
  const data = dbJobData[dataType];
  
  return {
    status: data.error ? 'failed' : 'completed',
    reviewsCollected: extractReviewCountFromDb(data, dataType),
    extractionMethod: extractMethodFromDb(data, dataType),
    processingTime: data.metadata?.processingTime || Date.now(),
    statusCode: 200,
    errorMessage: data.error || null,
    metadata: {
      timestamp: data.metadata?.timestamp || new Date().toISOString(),
      dataQuality: data.dataQuality || data.analysis?.dataQuality,
      analysis: data.analysis
    }
  };
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

function extractReviewCountFromDb(data: any, dataType: string): number {
  // YouTube comments
  if (dataType === 'youtube_comments' && data.comments && Array.isArray(data.comments)) {
    return data.comments.length;
  }
  if (dataType === 'youtube_comments' && data.analysis && typeof data.analysis.totalComments === 'number') {
    return data.analysis.totalComments;
  }
  
  // Amazon reviews
  if (dataType === 'amazon_reviews' && data.reviews && Array.isArray(data.reviews)) {
    return data.reviews.length;
  }
  if (dataType === 'amazon_reviews' && data.analysis && typeof data.analysis.totalReviews === 'number') {
    return data.analysis.totalReviews;
  }
  
  // Reddit posts
  if (dataType === 'reddit' && data.posts && Array.isArray(data.posts)) {
    return data.posts.length;
  }
  if (dataType === 'reddit' && data.analysis && typeof data.analysis.totalPosts === 'number') {
    return data.analysis.totalPosts;
  }
  
  // Website data
  if (dataType === 'website' && data.websiteData && data.websiteData.customerReviews && Array.isArray(data.websiteData.customerReviews)) {
    return data.websiteData.customerReviews.length;
  }
  
  return 0;
}

function extractMethodFromDb(data: any, dataType: string): string {
  // Check various places where extraction method might be stored
  if (data.metadata && data.metadata.extractionMethod) {
    return data.metadata.extractionMethod;
  }
  if (data.metadata && data.metadata.keywordProcessingMethod) {
    return data.metadata.keywordProcessingMethod;
  }
  if (data.analysis && data.analysis.method) {
    return data.analysis.method;
  }
  if (data.dataQuality && data.dataQuality.method) {
    return data.dataQuality.method;
  }
  if (data.websiteData && data.websiteData.dataQuality && data.websiteData.dataQuality.method) {
    return data.websiteData.dataQuality.method;
  }
  
  // Default based on data type
  const defaultMethods: { [key: string]: string } = {
    'website': 'openai_extraction',
    'youtube_comments': 'youtube_api_v3',
    'reddit': 'reddit_api_v1',
    'amazon_reviews': 'custom_amazon_scraper',
    'persona_profile': 'sequential_analysis'
  };
  
  return defaultMethods[dataType] || 'Unknown';
}