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
  timestamp: number;
}

// In-memory storage (will be lost on deployment, but fine for testing)
const jobCache = new Map<string, JobData>();

// Clean up old entries (older than 1 hour)
function cleanupOldEntries() {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [jobId, data] of jobCache.entries()) {
    if (data.timestamp < oneHourAgo) {
      jobCache.delete(jobId);
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