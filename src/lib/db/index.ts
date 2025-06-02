import { sql } from '@vercel/postgres';

export interface Job {
  id: string;
  user_inputs: any;
  status: string;
  progress: number;
  results_blob_url?: string;
  error_message?: string;
  created_at: Date;
  completed_at?: Date;
}

export async function createJob(userInputs: any): Promise<string> {
  const result = await sql`
    INSERT INTO jobs (user_inputs, status, progress)
    VALUES (${JSON.stringify(userInputs)}, 'pending', 0)
    RETURNING id
  `;
  return result.rows[0].id;
}

export async function getJobStatus(jobId: string): Promise<Job | null> {
  const result = await sql`
    SELECT * FROM jobs WHERE id = ${jobId}
  `;
  return (result.rows[0] as Job) || null;
}

export async function updateJobStatus(
  jobId: string, 
  status: string, 
  progress: number, 
  resultsUrl?: string,
  errorMessage?: string
) {
  await sql`
    UPDATE jobs 
    SET status = ${status}, 
        progress = ${progress},
        results_blob_url = ${resultsUrl || null},
        error_message = ${errorMessage || null},
        completed_at = ${status === 'completed' ? 'NOW()' : null}
    WHERE id = ${jobId}
  `;
}

export async function initializeDatabase() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_inputs JSONB NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        results_blob_url TEXT,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `;
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}
