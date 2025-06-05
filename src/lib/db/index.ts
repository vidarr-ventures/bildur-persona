import { sql } from '@vercel/postgres';

export interface Job {
  id: string;
  website_url: string;
  target_keywords: string;
  amazon_url?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export async function createJob(data: {
  website_url: string;
  target_keywords: string;
  amazon_url?: string;
  status: string;
}) {
  try {
    const result = await sql`
      INSERT INTO jobs (website_url, target_keywords, amazon_url, status)
      VALUES (${data.website_url}, ${data.target_keywords}, ${data.amazon_url}, ${data.status})
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
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${jobId}
      RETURNING *
    `;
    return result.rows[0];
  } catch (error) {
    console.error('Error updating job status:', error);
    throw error;
  }
}

export async function getJobById(id: string) {
  try {
    const result = await sql`
      SELECT * FROM jobs 
      WHERE id = ${id}
    `;
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting job by ID:', error);
    throw error;
  }
}

export async function saveJobData(jobId: string, dataType: string, data: any) {
  try {
    const result = await sql`
      INSERT INTO job_data (job_id, data_type, data)
      VALUES (${jobId}, ${dataType}, ${JSON.stringify(data)})
      ON CONFLICT (job_id, data_type)
      DO UPDATE SET 
        data = ${JSON.stringify(data)},
        updated_at = NOW()
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
    let result;
    if (dataType) {
      result = await sql`
        SELECT * FROM job_data
        WHERE job_id = ${jobId} AND data_type = ${dataType}
      `;
    } else {
      result = await sql`
        SELECT * FROM job_data
        WHERE job_id = ${jobId}
      `;
    }
    return result.rows;
  } catch (error) {
    console.error('Error getting job data:', error);
    throw error;
  }
}
