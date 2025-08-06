import { sql } from '@vercel/postgres';

export interface ResearchRequest {
  id: number;
  job_id: string;
  website_url: string;
  amazon_url?: string;
  keywords: string;
  email: string;
  competitor_urls: string[];
  plan_id: string;
  plan_name: string;
  discount_code?: string;
  payment_session_id: string;
  amount_paid: number;
  original_price: number;
  final_price: number;
  is_free: boolean;
  status: string;
  created_at: string;
  completed_at?: string;
  persona_report_sent: boolean;
}

export interface Job {
  id: string;
  user_inputs: {
    primaryProductUrl: string;
    targetKeywords: string;
    amazonProductUrl?: string;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  results_blob_url?: string;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export async function createJob(data: {
  website_url: string;
  target_keywords: string;
  amazon_url?: string;
  status: string;
}) {
  try {
    // Generate a unique job ID
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create a simplified research request entry for the job
    // Always format keywords as PostgreSQL array (database expects this format)
    const keywordsFormatted = `{${data.target_keywords}}`;
      
    const result = await sql`
      INSERT INTO research_requests (
        job_id, website_url, amazon_url, keywords, email, 
        plan_id, plan_name, is_free, status
      )
      VALUES (
        ${jobId}, ${data.website_url}, ${data.amazon_url || null}, ${keywordsFormatted}, 
        'system@example.com', 'free', 'Free Analysis', true, ${data.status}
      )
      RETURNING job_id as id, *
    `;
    return result.rows[0];
  } catch (error) {
    console.error('Error creating job:', error);
    throw error;
  }
}

export async function updateJobStatus(jobId: string, status: string) {
  try {
    const result = await sql`
      UPDATE research_requests 
      SET status = ${status},
          completed_at = ${status === 'completed' ? 'NOW()' : null}
      WHERE job_id = ${jobId}
      RETURNING *
    `;
    return result.rows[0];
  } catch (error) {
    console.error('Error updating job status:', error);
    throw error;
  }
}

export async function updateJobProgress(jobId: string, progress: number) {
  try {
    // Progress column doesn't exist in the jobs table, so just update status
    const result = await sql`
      UPDATE jobs 
      SET status = 'processing'
      WHERE id = ${jobId}
      RETURNING *
    `;
    return result.rows[0];
  } catch (error) {
    console.error('Error updating job progress:', error);
    throw error;
  }
}

export async function getJobById(id: string) {
  try {
    const result = await sql`
      SELECT * FROM research_requests 
      WHERE job_id = ${id}
    `;
    const job = result.rows[0];
    if (!job) return null;

    // Transform to match expected interface for backwards compatibility
    return {
      ...job,
      id: job.job_id,
      target_keywords: job.keywords
    };
  } catch (error) {
    console.error('Error getting job by ID:', error);
    throw error;
  }
}

export async function saveJobData(jobId: string, dataType: string, data: any) {
  try {
    console.log(`Saving ${dataType} data for job ${jobId}`);
    
    // Special handling for persona_profile - store in research_requests table
    if (dataType === 'persona_profile' && data?.persona) {
      await sql`
        UPDATE research_requests 
        SET persona_analysis = ${data.persona},
            data_quality = ${JSON.stringify(data.dataQuality || {})},
            persona_metadata = ${JSON.stringify(data.metadata || {})}
        WHERE job_id = ${jobId}
      `;
      console.log(`Saved persona analysis for job ${jobId}`);
    }
    
    // Store all worker data in the job_data table using UPSERT (ON CONFLICT)
    const result = await sql`
      INSERT INTO job_data (job_id, data_type, data_content)
      VALUES (${jobId}, ${dataType}, ${JSON.stringify(data)})
      ON CONFLICT (job_id, data_type) 
      DO UPDATE SET 
        data_content = ${JSON.stringify(data)},
        updated_at = NOW()
      RETURNING *
    `;
    
    console.log(`Saved ${dataType} data to job_data table for job ${jobId}`);
    return result.rows[0];
  } catch (error) {
    console.error('Error saving job data:', error);
    // Don't throw error here - allow job to continue even if data saving fails
    console.log(`Continuing job processing despite data save error`);
    return null;
  }
}

export async function getJobData(jobId: string, dataType?: string) {
  try {
    console.log(`Getting ${dataType || 'all'} data for job ${jobId}`);
    
    if (dataType) {
      // Get specific data type from job_data table
      const result = await sql`
        SELECT data_content
        FROM job_data 
        WHERE job_id = ${jobId} AND data_type = ${dataType}
      `;
      
      if (result.rows.length === 0) {
        console.log(`No ${dataType} data found for job ${jobId}`);
        return null;
      }
      
      return result.rows[0].data_content;
    } else {
      // Get all data types for the job
      const result = await sql`
        SELECT data_type, data_content
        FROM job_data 
        WHERE job_id = ${jobId}
      `;
      
      if (result.rows.length === 0) {
        console.log(`No data found for job ${jobId}`);
        return {};
      }
      
      // Convert to object with data_type as keys
      const jobData: { [key: string]: any } = {};
      result.rows.forEach(row => {
        jobData[row.data_type] = row.data_content;
      });
      
      console.log(`Retrieved job data for ${jobId}. Available data types:`, Object.keys(jobData));
      return jobData;
    }
    
  } catch (error) {
    console.error('Error getting job data:', error);
    return dataType ? null : {};
  }
}

export async function completeJob(jobId: string, resultsUrl?: string) {
  try {
    const result = await sql`
      UPDATE research_requests 
      SET status = 'completed', 
          completed_at = NOW()
      WHERE job_id = ${jobId}
      RETURNING *
    `;
    return result.rows[0];
  } catch (error) {
    console.error('Error completing job:', error);
    throw error;
  }
}

export async function failJob(jobId: string, errorMessage: string) {
  try {
    const result = await sql`
      UPDATE jobs 
      SET status = 'failed',
          error_message = ${errorMessage}
      WHERE id = ${jobId}
      RETURNING *
    `;
    return result.rows[0];
  } catch (error) {
    console.error('Error failing job:', error);
    throw error;
  }
}

// Research Requests functions
export async function createResearchRequest(data: {
  jobId: string;
  websiteUrl: string;
  amazonUrl?: string;
  keywords: string;
  email: string;
  competitorUrls: string[];
  planId?: string;
  planName?: string;
  discountCode?: string;
  paymentSessionId?: string;
  amountPaid?: number;
  originalPrice?: number;
  finalPrice?: number;
  isFree?: boolean;
}): Promise<ResearchRequest> {
  try {
    // Fix keywords format: use PostgreSQL ARRAY constructor to preserve search intent
    const result = await sql`
      INSERT INTO research_requests (
        job_id, website_url, amazon_url, email, keywords, competitor_urls, plan_id, plan_name, 
        discount_code, payment_session_id, amount_paid, original_price, final_price, is_free
      ) VALUES (
        ${data.jobId}, ${data.websiteUrl}, ${data.amazonUrl || null}, ${data.email}, ARRAY[${data.keywords}], 
        ${JSON.stringify(data.competitorUrls || [])}, ${data.planId || 'free'}, ${data.planName || 'Free Analysis'}, ${data.discountCode || null}, 
        ${data.paymentSessionId || 'free_access'}, ${data.amountPaid || 0}, ${data.originalPrice || 0}, ${data.finalPrice || 0}, ${data.isFree !== false}
      )
      RETURNING *
    `;
    
    const row = result.rows[0];
    return {
      ...row,
      competitor_urls: Array.isArray(row.competitor_urls) ? row.competitor_urls : JSON.parse(row.competitor_urls || '[]'),
      keywords: Array.isArray(row.keywords) ? row.keywords[0] : row.keywords // Extract first item for search
    } as ResearchRequest;
  } catch (error) {
    console.error('Error creating research request:', error);
    throw error;
  }
}

export async function getResearchRequest(jobId: string): Promise<ResearchRequest | null> {
  try {
    const result = await sql`
      SELECT * FROM research_requests 
      WHERE job_id = ${jobId}
    `;
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      ...row,
      competitor_urls: JSON.parse(row.competitor_urls || '[]'),
      keywords: Array.isArray(row.keywords) ? row.keywords[0] : row.keywords // Extract first item for search
    } as ResearchRequest;
  } catch (error) {
    console.error('Error getting research request:', error);
    throw error;
  }
}

export async function updateResearchRequestStatus(jobId: string, status: string): Promise<void> {
  try {
    await sql`
      UPDATE research_requests 
      SET status = ${status}, 
          completed_at = ${status === 'completed' ? 'NOW()' : null}
      WHERE job_id = ${jobId}
    `;
  } catch (error) {
    console.error('Error updating research request status:', error);
    throw error;
  }
}

export async function markPersonaReportSent(jobId: string): Promise<void> {
  try {
    await sql`
      UPDATE research_requests 
      SET persona_report_sent = true
      WHERE job_id = ${jobId}
    `;
  } catch (error) {
    console.error('Error marking persona report as sent:', error);
    throw error;
  }
}

export async function getPersonaByJobId(jobId: string) {
  try {
    const result = await sql`
      SELECT persona_analysis, data_quality, persona_metadata, status, created_at, completed_at
      FROM research_requests 
      WHERE job_id = ${jobId}
    `;
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    
    // Only return if persona analysis exists
    if (!row.persona_analysis) return null;
    
    return {
      persona: row.persona_analysis,
      data_quality: row.data_quality ? JSON.parse(row.data_quality) : null,
      metadata: row.persona_metadata ? JSON.parse(row.persona_metadata) : null,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.completed_at
    };
  } catch (error) {
    console.error('Error getting persona by job ID:', error);
    throw error;
  }
}
