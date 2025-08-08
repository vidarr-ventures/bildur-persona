// Fresh database connection - simple and direct
import { sql } from '@vercel/postgres';

export interface Analysis {
  id: string;
  url: string;
  email?: string;
  status: 'processing' | 'completed' | 'failed';
  report_data?: any;
  debug_data?: any;
  created_at: Date;
  completed_at?: Date;
}

export async function createAnalysis(url: string, email?: string): Promise<string> {
  const id = `ana_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  
  await sql`INSERT INTO analyses (id, url, email) VALUES (${id}, ${url}, ${email})`;
  
  return id;
}

export async function getAnalysis(id: string): Promise<Analysis | null> {
  const result = await sql`SELECT * FROM analyses WHERE id = ${id}`;
  return result.rows[0] as Analysis || null;
}

export async function updateAnalysis(
  id: string, 
  status: Analysis['status'], 
  reportData?: any,
  debugData?: any
): Promise<void> {
  const completedAt = status === 'completed' ? new Date().toISOString() : null;
  
  await sql`
    UPDATE analyses 
    SET status = ${status}, 
        report_data = ${JSON.stringify(reportData)}, 
        debug_data = ${JSON.stringify(debugData)}, 
        completed_at = ${completedAt}
    WHERE id = ${id}
  `;
}