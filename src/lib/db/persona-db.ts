import { sql } from '@vercel/postgres';
import { v4 as uuidv4 } from 'uuid';

export interface PersonaAnalysis {
  analysis_id: string;
  user_url: string;
  structured_data: any;
  raw_quotes: any[];
  persona_report?: string;
  created_at: Date;
  updated_at: Date;
  user_email?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
}

export class PersonaDatabase {
  /**
   * Create a new persona analysis record
   */
  static async createAnalysis(userUrl: string, userEmail?: string): Promise<PersonaAnalysis> {
    const analysisId = uuidv4();
    
    const result = await sql<PersonaAnalysis>`
      INSERT INTO persona_analyses (
        analysis_id,
        user_url,
        user_email,
        status
      ) VALUES (
        ${analysisId},
        ${userUrl},
        ${userEmail || null},
        'pending'
      )
      RETURNING *
    `;
    
    return result.rows[0];
  }

  /**
   * Update analysis with structured data from web scraping
   */
  static async updateStructuredData(
    analysisId: string,
    structuredData: any,
    rawQuotes: any[]
  ): Promise<PersonaAnalysis> {
    const result = await sql<PersonaAnalysis>`
      UPDATE persona_analyses
      SET 
        structured_data = ${JSON.stringify(structuredData)},
        raw_quotes = ${JSON.stringify(rawQuotes)},
        status = 'processing',
        updated_at = CURRENT_TIMESTAMP
      WHERE analysis_id = ${analysisId}
      RETURNING *
    `;
    
    return result.rows[0];
  }

  /**
   * Update analysis with the final persona report
   */
  static async updatePersonaReport(
    analysisId: string,
    personaReport: string
  ): Promise<PersonaAnalysis> {
    const result = await sql<PersonaAnalysis>`
      UPDATE persona_analyses
      SET 
        persona_report = ${personaReport},
        status = 'completed',
        updated_at = CURRENT_TIMESTAMP
      WHERE analysis_id = ${analysisId}
      RETURNING *
    `;
    
    return result.rows[0];
  }

  /**
   * Mark analysis as failed with error message
   */
  static async markFailed(
    analysisId: string,
    errorMessage: string
  ): Promise<PersonaAnalysis> {
    const result = await sql<PersonaAnalysis>`
      UPDATE persona_analyses
      SET 
        status = 'failed',
        error_message = ${errorMessage},
        updated_at = CURRENT_TIMESTAMP
      WHERE analysis_id = ${analysisId}
      RETURNING *
    `;
    
    return result.rows[0];
  }

  /**
   * Get analysis by ID
   */
  static async getAnalysis(analysisId: string): Promise<PersonaAnalysis | null> {
    const result = await sql<PersonaAnalysis>`
      SELECT * FROM persona_analyses
      WHERE analysis_id = ${analysisId}
    `;
    
    return result.rows[0] || null;
  }

  /**
   * Get recent analyses (for admin/debugging)
   */
  static async getRecentAnalyses(limit: number = 10): Promise<PersonaAnalysis[]> {
    const result = await sql<PersonaAnalysis>`
      SELECT * FROM persona_analyses
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    
    return result.rows;
  }

  /**
   * Initialize database tables
   */
  static async initializeDatabase(): Promise<void> {
    try {
      // Check if table exists
      const tableExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'persona_analyses'
        );
      `;

      if (!tableExists.rows[0].exists) {
        // Create table
        await sql`
          CREATE TABLE persona_analyses (
            analysis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_url TEXT NOT NULL,
            structured_data JSONB NOT NULL DEFAULT '{}',
            raw_quotes JSONB NOT NULL DEFAULT '[]',
            persona_report TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            user_email TEXT,
            status TEXT DEFAULT 'pending',
            error_message TEXT
          );
        `;

        // Create indexes
        await sql`CREATE INDEX idx_persona_analyses_created_at ON persona_analyses(created_at DESC);`;
        await sql`CREATE INDEX idx_persona_analyses_user_url ON persona_analyses(user_url);`;
        await sql`CREATE INDEX idx_persona_analyses_status ON persona_analyses(status);`;

        console.log('Database tables created successfully');
      }
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }
}