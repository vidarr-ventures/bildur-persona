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
    let workerResults = null;
    try {
      dbData = await getResearchRequest(jobId);
      // Get all job data from database (this is where workers save their results)
      const { getJobData: getDbJobData } = await import('@/lib/db');
      dbJobData = await getDbJobData(jobId);
      
      // Always get current status from workers for accurate debug data
      console.log('Getting real-time worker status...');
      workerResults = await getWorkerStatusData(jobId, cachedData, dbData);
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
      website: analyzeDataSourceStatusFromWorkers(workerResults, 'website') || analyzeDataSourceStatusFromDb(dbJobData, 'website') || analyzeDataSourceStatus(jobResults, 'website'),
      amazon: analyzeDataSourceStatusFromWorkers(workerResults, 'amazon') || analyzeDataSourceStatusFromDb(dbJobData, 'amazon_reviews') || analyzeDataSourceStatus(jobResults, 'amazon'),
      reddit: analyzeDataSourceStatusFromWorkers(workerResults, 'reddit') || analyzeDataSourceStatusFromDb(dbJobData, 'reddit') || analyzeDataSourceStatus(jobResults, 'reddit'),
      youtube: analyzeDataSourceStatusFromWorkers(workerResults, 'youtube') || analyzeDataSourceStatusFromDb(dbJobData, 'youtube_comments') || analyzeDataSourceStatus(jobResults, 'youtube_comments') || analyzeDataSourceStatus(jobResults, 'youtube'),
      persona: analyzeDataSourceStatusFromWorkers(workerResults, 'persona') || analyzeDataSourceStatusFromDb(dbJobData, 'persona_profile') || analyzeDataSourceStatus(jobResults, 'persona'),
      competitors: competitorStatuses
    };
    
    // Extract final persona content
    let finalPersona = null;
    
    // Try to get persona from worker results first, then from job cache
    if (workerResults?.persona?.data?.persona) {
      finalPersona = workerResults.persona.data.persona;
    } else if (jobResults?.persona?.persona) {
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
  
  // Determine if this is an AI-powered worker or direct API worker
  const isAIPowered = ['website', 'amazon_reviews', 'reddit'].includes(dataType);
  const isPersona = dataType === 'persona_profile';
  
  // NEW: Determine proper status based on data collection success
  let status = 'completed';
  if (data.error || data.success === false) {
    status = 'failed';
  } else if (data.hasActualData === false || data.dataCollected === false) {
    status = 'completed_no_data'; // Yellow status
  } else if (data.hasActualData === true || data.dataCollected === true) {
    status = 'completed'; // Green status
  }
  
  const baseStatus = {
    status: status,
    extractionMethod: extractMethodFromDb(data, dataType),
    processingTime: formatProcessingTime(data.metadata?.processingTime || Date.now()),
    statusCode: 200,
    errorMessage: data.error || null,
    metadata: {
      timestamp: data.metadata?.timestamp || new Date().toISOString(),
      dataQuality: data.dataQuality || data.analysis?.dataQuality,
      analysis: data.analysis,
      hasActualData: data.hasActualData
    }
  };

  if (isPersona) {
    const hasPersonaData = (!!data.persona && data.persona.length > 100) || (!!data.analysis && !data.error);
    return {
      ...baseStatus,
      status: data.error ? 'failed' : (hasPersonaData ? 'completed' : 'completed_no_data'),
      outputGenerated: hasPersonaData,
      personaLength: calculatePersonaLength(data),
      extractionMethod: 'Sequential AI Analysis'
    };
  } else if (isAIPowered) {
    return {
      ...baseStatus,
      dataReturned: data.hasActualData === true,
      contentVolume: calculateContentVolume(data, dataType),
      extractionMethod: getAIMethod(dataType)
    };
  } else {
    // YouTube and other direct API workers
    const hasComments = extractCommentsCountNumber(data, dataType) > 0;
    return {
      ...baseStatus,
      status: data.error ? 'failed' : (hasComments ? 'completed' : 'completed_no_data'),
      commentsFound: extractCommentsCount(data, dataType),
      videosProcessed: extractVideosCount(data, dataType),
      extractionMethod: 'YouTube API'
    };
  }
}

function analyzeDataSourceStatus(jobResults: any, dataType: string) {
  if (!jobResults || !jobResults[dataType]) {
    return {
      status: 'not_started',
      dataReturned: false,
      contentVolume: 0,
      extractionMethod: 'Unknown',
      processingTime: null,
      statusCode: null,
      errorMessage: null
    };
  }
  
  const data = jobResults[dataType];
  
  // Determine if this is an AI-powered worker or direct API worker
  const isAIPowered = ['website', 'amazon_reviews', 'reddit'].includes(dataType);
  const isPersona = dataType === 'persona_profile';
  
  // NEW: Determine proper status based on data collection success
  let status = 'completed';
  if (data.success === false || data.error) {
    status = 'failed';
  } else if (data.processing) {
    status = 'processing';
  } else if (data.hasActualData === false || data.dataCollected === false) {
    status = 'completed_no_data'; // Yellow status
  } else if (data.hasActualData === true || data.dataCollected === true) {
    status = 'completed'; // Green status
  }
  
  const baseStatus = {
    status: status,
    extractionMethod: extractMethod(data),
    processingTime: formatProcessingTime(data.processingTime || data.metadata?.processingTime),
    statusCode: data.statusCode || data.response?.status,
    errorMessage: data.error || data.errorMessage,
    metadata: {
      timestamp: data.timestamp,
      dataQuality: data.dataQuality,
      analysis: data.analysis,
      hasActualData: data.hasActualData
    }
  };

  if (isPersona) {
    const hasPersonaData = (!!data.persona && data.persona.length > 100) || (!!data.analysis && !data.error);
    return {
      ...baseStatus,
      status: data.error ? 'failed' : (hasPersonaData ? 'completed' : 'completed_no_data'),
      outputGenerated: hasPersonaData,
      personaLength: calculatePersonaLength(data),
      extractionMethod: 'Sequential AI Analysis'
    };
  } else if (isAIPowered) {
    return {
      ...baseStatus,
      dataReturned: data.hasActualData === true,
      contentVolume: calculateContentVolume(data, dataType),
      extractionMethod: getAIMethod(dataType)
    };
  } else {
    // YouTube and other direct API workers
    const hasComments = extractCommentsCountNumber(data, dataType) > 0;
    return {
      ...baseStatus,
      status: data.error ? 'failed' : (hasComments ? 'completed' : 'completed_no_data'),
      commentsFound: extractCommentsCount(data, dataType),
      videosProcessed: extractVideosCount(data, dataType),
      extractionMethod: 'YouTube API'
    };
  }
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

// New helper functions for AI-powered workflow metrics

function formatProcessingTime(timestamp: number | null | undefined): string {
  if (!timestamp) return 'Unknown';
  
  // If timestamp is very large, it's probably a unix timestamp, convert to processing time
  if (timestamp > 1000000000000) {
    // This is likely a timestamp, not processing time
    return 'Unknown';
  }
  
  // If it's a reasonable processing time in milliseconds
  if (timestamp < 60000) {
    return `${timestamp}ms`;
  }
  
  // Convert to seconds if over 1 minute
  return `${(timestamp / 1000).toFixed(1)}s`;
}

function calculateContentVolume(data: any, dataType: string): string {
  let totalWords = 0;
  
  if (dataType === 'website') {
    // Count words in website data
    if (data.websiteData?.customerReviews) {
      totalWords += data.websiteData.customerReviews.reduce((acc: number, review: any) => 
        acc + (review.text?.split(' ').length || 0), 0);
    }
    if (data.websiteData?.pageContent) {
      totalWords += data.websiteData.pageContent.split(' ').length;
    }
    if (data.analysis?.insights) {
      totalWords += JSON.stringify(data.analysis.insights).split(' ').length;
    }
  } else if (dataType === 'amazon_reviews') {
    // Count words in Amazon reviews
    if (data.reviews && Array.isArray(data.reviews)) {
      totalWords += data.reviews.reduce((acc: number, review: any) => 
        acc + (review.text?.split(' ').length || 0) + (review.title?.split(' ').length || 0), 0);
    }
    if (data.analysis) {
      totalWords += JSON.stringify(data.analysis).split(' ').length;
    }
  } else if (dataType === 'reddit') {
    // Count words in Reddit posts and comments
    if (data.posts && Array.isArray(data.posts)) {
      totalWords += data.posts.reduce((acc: number, post: any) => {
        let postWords = (post.title?.split(' ').length || 0) + (post.content?.split(' ').length || 0);
        if (post.comments && Array.isArray(post.comments)) {
          postWords += post.comments.reduce((commentAcc: number, comment: any) => 
            commentAcc + (comment.text?.split(' ').length || 0), 0);
        }
        return acc + postWords;
      }, 0);
    }
    if (data.analysis) {
      totalWords += JSON.stringify(data.analysis).split(' ').length;
    }
  }
  
  if (totalWords === 0) return 'No data';
  if (totalWords < 1000) return `${totalWords} words`;
  return `${(totalWords / 1000).toFixed(1)}k words`;
}

function calculatePersonaLength(data: any): string {
  if (!data.persona && !data.analysis) return '0 words';
  
  const personaText = data.persona || JSON.stringify(data.analysis);
  const wordCount = personaText.split(' ').length;
  
  if (wordCount < 1000) return `${wordCount} words`;
  return `${(wordCount / 1000).toFixed(1)}k words`;
}

function getAIMethod(dataType: string): string {
  const methods: { [key: string]: string } = {
    'website': 'OpenAI Analysis',
    'amazon_reviews': 'API + AI Analysis', 
    'reddit': 'API + AI Analysis'
  };
  return methods[dataType] || 'AI Analysis';
}

function extractCommentsCount(data: any, dataType: string): string {
  if (dataType === 'youtube_comments') {
    const totalComments = data.comments?.length || data.analysis?.totalComments || 0;
    return `${totalComments} comments`;
  }
  return '0 comments';
}

function extractVideosCount(data: any, dataType: string): string {
  if (dataType === 'youtube_comments') {
    const videosCount = data.analysis?.topVideos?.length || data.metadata?.videosAnalyzed || 0;
    return `${videosCount} videos`;
  }
  return '0 videos';
}

function extractCommentsCountNumber(data: any, dataType: string): number {
  if (dataType === 'youtube_comments') {
    return data.comments?.length || data.analysis?.totalComments || 0;
  }
  return 0;
}

async function getWorkerStatusData(jobId: string, cachedData: any, dbData: any) {
  const baseUrl = 'https://persona.bildur.ai';
  
  const workers = [
    { name: 'website-crawler', key: 'website' },
    { name: 'amazon-reviews', key: 'amazon' },
    { name: 'reddit-scraper', key: 'reddit' },
    { name: 'youtube-comments', key: 'youtube' },
    { name: 'persona-generator', key: 'persona' }
  ];

  const results: { [key: string]: any } = {};

  try {
    const workerPromises = workers.map(async (worker) => {
      try {
        const response = await fetch(`${baseUrl}/api/workers/${worker.name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`,
          },
          body: JSON.stringify({
            jobId,
            websiteUrl: cachedData?.websiteUrl || dbData?.website_url || 'https://example.com',
            targetKeywords: cachedData?.keywords || dbData?.keywords || 'test',
            keywords: cachedData?.keywords || dbData?.keywords || 'test',
            amazonUrl: cachedData?.amazonUrl || dbData?.amazon_url || '',
            email: cachedData?.email || dbData?.email,
            planName: cachedData?.planName || dbData?.plan_name || 'Essential'
          }),
          signal: AbortSignal.timeout(10000) // 10 second timeout for debug calls
        });

        if (response.ok) {
          const data = await response.json();
          results[worker.key] = data;
        }
      } catch (error) {
        console.log(`Worker ${worker.name} failed:`, error);
      }
    });

    await Promise.all(workerPromises);
  } catch (error) {
    console.error('Error calling workers:', error);
  }

  return results;
}

function analyzeDataSourceStatusFromWorkers(workerResults: any, dataType: string) {
  if (!workerResults || !workerResults[dataType]) {
    return null;
  }

  const data = workerResults[dataType];
  
  if (!data.success) {
    return {
      status: 'failed',
      dataReturned: false,
      contentVolume: 'No data',
      extractionMethod: 'Unknown',
      processingTime: 'Unknown',
      statusCode: data.statusCode || 500,
      errorMessage: data.error || data.message || 'Worker failed'
    };
  }

  const workerData = data.data || {};
  const isAIPowered = ['website', 'amazon', 'reddit'].includes(dataType);
  const isPersona = dataType === 'persona';

  // NEW: Determine proper status based on actual data collection
  let status = 'completed';
  if (data.hasActualData === false || data.dataCollected === false) {
    status = 'completed_no_data'; // Yellow status
  } else if (data.hasActualData === true || data.dataCollected === true) {
    status = 'completed'; // Green status
  }

  if (isPersona) {
    const hasPersonaData = (!!workerData.persona && workerData.persona.length > 100) || (!!workerData.analysis && !data.error);
    return {
      status: data.error ? 'failed' : (hasPersonaData ? 'completed' : 'completed_no_data'),
      outputGenerated: hasPersonaData,
      personaLength: calculatePersonaLength(workerData),
      extractionMethod: 'Sequential AI Analysis',
      processingTime: 'Real-time',
      statusCode: 200
    };
  } else if (isAIPowered) {
    // Check if we have actual review/content data
    const hasReviews = workerData.reviews?.length > 0 || 
                      workerData.websiteData?.customerReviews?.length > 0 ||
                      workerData.posts?.length > 0;
    
    const reviewCount = workerData.reviews?.length || 
                       workerData.websiteData?.customerReviews?.length || 
                       workerData.posts?.length || 
                       workerData.reviewCount || 
                       workerData.totalReviews || 
                       0;
    
    return {
      status: data.hasActualData === true ? 'completed' : (data.hasActualData === false ? 'completed_no_data' : status),
      dataReturned: data.hasActualData === true,
      contentVolume: hasReviews ? `${reviewCount} items found` : (workerData.contentLength ? `${workerData.contentLength} chars` : 'No data'),
      extractionMethod: getAIMethod(dataType),
      processingTime: 'Real-time',
      statusCode: 200,
      reviewsFound: reviewCount // Add this for backward compatibility
    };
  } else if (dataType === 'youtube') {
    const totalComments = workerData.totalComments || workerData.comments?.length || 0;
    const videosAnalyzed = workerData.videosAnalyzed || workerData.videos?.length || 0;
    const hasComments = totalComments > 0;
    
    return {
      status: data.error ? 'failed' : (hasComments ? 'completed' : 'completed_no_data'),
      commentsFound: `${totalComments} comments`,
      videosProcessed: `${videosAnalyzed} videos`,
      extractionMethod: 'YouTube API',
      processingTime: 'Real-time',
      statusCode: 200
    };
  }

  return {
    status: data.hasActualData === false ? 'completed_no_data' : 'completed',
    extractionMethod: 'Unknown',
    processingTime: 'Real-time',
    statusCode: 200
  };
}

function calculateContentVolumeFromWorker(data: any, dataType: string): string {
  if (dataType === 'website') {
    const reviewCount = data.reviewsFound || 0;
    const contentLength = data.contentLength || data.dataQuality?.contentLength || 0;
    if (reviewCount > 0) return `${reviewCount} reviews, ${contentLength} chars`;
    if (contentLength > 0) return `${contentLength} characters`;
    return 'No data';
  } else if (dataType === 'amazon') {
    const reviewCount = data.reviewCount || data.totalReviews || 0;
    if (reviewCount > 0) return `${reviewCount} reviews`;
    return 'No data';
  } else if (dataType === 'reddit') {
    const postCount = data.postCount || 0;
    if (postCount > 0) return `${postCount} posts`;
    return 'No data';
  }
  return 'No data';
}