// Simple in-memory cache for job data to bypass database issues during testing
// This is a temporary solution while we debug database schema issues

interface JobData {
  jobId: string;
  websiteUrl: string;
  amazonUrl?: string;
  keywords: string;
  email: string;
  competitorUrls: string[];
  planId: string;
  planName: string;
  timestamp?: number; // Optional, will be added by storeJobData
}

interface JobResults {
  [key: string]: any; // Flexible structure for different data types
}

// In-memory storage (will be lost on deployment, but fine for testing)
const jobCache = new Map<string, JobData>();
const jobResultsCache = new Map<string, JobResults>();

// Clean up old entries (older than 1 hour)
function cleanupOldEntries() {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  // Clean up job cache
  for (const [jobId, data] of jobCache.entries()) {
    if (data.timestamp && data.timestamp < oneHourAgo) {
      jobCache.delete(jobId);
    }
  }
  
  // Clean up job results cache
  for (const [jobId, results] of jobResultsCache.entries()) {
    // Check if any result is still fresh
    const hasFreshResults = Object.values(results).some((result: any) => 
      result.timestamp && result.timestamp >= oneHourAgo
    );
    
    if (!hasFreshResults) {
      jobResultsCache.delete(jobId);
    }
  }
}

export function storeJobData(data: JobData) {
  cleanupOldEntries();
  jobCache.set(data.jobId, {
    ...data,
    timestamp: Date.now()
  });
  console.log(`Stored job data in cache for ${data.jobId}:`, {
    amazonUrl: data.amazonUrl,
    websiteUrl: data.websiteUrl,
    keywords: data.keywords
  });
}

export function getJobData(jobId: string): JobData | null {
  cleanupOldEntries();
  const data = jobCache.get(jobId);
  console.log(`Retrieved job data from cache for ${jobId}:`, data ? {
    amazonUrl: data.amazonUrl,
    websiteUrl: data.websiteUrl,
    keywords: data.keywords
  } : 'NOT FOUND');
  return data || null;
}

export function listCachedJobs(): string[] {
  cleanupOldEntries();
  return Array.from(jobCache.keys());
}

// Job Results Management
export function storeJobResult(jobId: string, dataType: string, result: any) {
  cleanupOldEntries();
  
  let jobResults = jobResultsCache.get(jobId) || {};
  jobResults[dataType] = {
    ...result,
    timestamp: Date.now()
  };
  
  jobResultsCache.set(jobId, jobResults);
  console.log(`Stored ${dataType} result for job ${jobId}`);
}

export function getJobResults(jobId: string): JobResults | null {
  cleanupOldEntries();
  const results = jobResultsCache.get(jobId);
  console.log(`Retrieved job results for ${jobId}:`, results ? Object.keys(results) : 'NOT FOUND');
  return results || null;
}

export function getJobResult(jobId: string, dataType: string): any | null {
  cleanupOldEntries();
  const jobResults = jobResultsCache.get(jobId);
  return jobResults?.[dataType] || null;
}