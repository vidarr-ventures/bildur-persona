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
    const result = await sql`
      INSERT INTO jobs (website_url, primary_keywords, status)
      VALUES (${data.website_url}, ${data.target_keywords}, ${data.status})
      RETURNING *
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
      UPDATE jobs 
      SET status = ${status}
      WHERE id = ${jobId}
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
      SELECT * FROM jobs 
      WHERE id = ${id}
    `;
    const job = result.rows[0];
    if (!job) return null;

    // Transform to match expected interface for backwards compatibility
    return {
      ...job,
      target_keywords: job.primary_keywords
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
      // First try to update research_requests using job_id
      const updateResult = await sql`
        UPDATE research_requests 
        SET persona_analysis = ${data.persona},
            data_quality = ${JSON.stringify(data.dataQuality)},
            persona_metadata = ${JSON.stringify(data.metadata || {})},
            status = 'completed'
        WHERE job_id = ${jobId}
      `;
      
      // If no rows were updated, the research_request might use the jobs.research_request_id
      if (updateResult.rowCount === 0) {
        // Get the research_request_id from the jobs table
        const jobResult = await sql`
          SELECT research_request_id FROM jobs WHERE id = ${jobId}
        `;
        
        if (jobResult.rows.length > 0 && jobResult.rows[0].research_request_id) {
          await sql`
            UPDATE research_requests 
            SET persona_analysis = ${data.persona},
                data_quality = ${JSON.stringify(data.dataQuality)},
                persona_metadata = ${JSON.stringify(data.metadata || {})},
                status = 'completed'
            WHERE id = ${jobResult.rows[0].research_request_id}
          `;
        }
      }
      
      console.log(`Saved persona analysis for job ${jobId}`);
      return data;
    }
    
    // For other data types, just update status for now
    const result = await sql`
      UPDATE jobs 
      SET status = 'processing'
      WHERE id = ${jobId}
      RETURNING *
    `;
    return result.rows[0];
  } catch (error) {
    console.error('Error saving job data:', error);
    throw error;
  }
}

export async function getJobData(jobId: string, dataType?: string) {
  try {
    // For now, return empty array since we don't have separate job_data table
    // You might want to implement proper data storage later
    console.log(`Getting ${dataType} data for job ${jobId}`);
    return [];
  } catch (error) {
    console.error('Error getting job data:', error);
    throw error;
  }
}

export async function completeJob(jobId: string, resultsUrl?: string) {
  try {
    const result = await sql`
      UPDATE jobs 
      SET status = 'completed', 
          completed_at = NOW()
      WHERE id = ${jobId}
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
  planId: string;
  planName: string;
  discountCode?: string;
  paymentSessionId: string;
  amountPaid: number;
  originalPrice: number;
  finalPrice: number;
  isFree: boolean;
}): Promise<ResearchRequest> {
  try {
    // Store keywords as text for now (database may expect TEXT field)
    const result = await sql`
      INSERT INTO research_requests (
        job_id, website_url, amazon_url, email, keywords, plan_id, plan_name, 
        discount_code, payment_session_id, amount_paid, original_price, final_price, is_free
      ) VALUES (
        ${data.jobId}, ${data.websiteUrl}, ${data.amazonUrl || null}, ${data.email}, ${data.keywords}, 
        ${data.planId}, ${data.planName}, ${data.discountCode || null}, ${data.paymentSessionId}, 
        ${data.amountPaid}, ${data.originalPrice}, ${data.finalPrice}, ${data.isFree}
      )
      RETURNING *
    `;
    
    const row = result.rows[0];
    return {
      ...row,
      competitor_urls: Array.isArray(row.competitor_urls) ? row.competitor_urls : JSON.parse(row.competitor_urls || '[]')
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
      competitor_urls: JSON.parse(row.competitor_urls || '[]')
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
