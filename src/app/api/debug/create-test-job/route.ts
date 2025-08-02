import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(request: NextRequest) {
  try {
    const jobId = crypto.randomUUID();
    
    // Create a test job
    const jobResult = await sql`
      INSERT INTO jobs (id, website_url, primary_keywords, status, created_at)
      VALUES (
        ${jobId},
        ${'https://example.com'},
        ${'test product, quality items'},
        ${'pending'},
        NOW()
      )
      RETURNING *
    `;
    const job = jobResult.rows[0];

    // Create a test research request with Amazon URL
    const researchResult = await sql`
      INSERT INTO research_requests (
        job_id,
        website_url,
        amazon_url,
        email,
        keywords,
        plan_name,
        status,
        created_at
      ) VALUES (
        ${jobId},
        ${'https://example.com'},
        ${'https://www.amazon.com/dp/B08N5WRWNW'},
        ${'test@example.com'},
        ${'{test product,quality items}'},
        ${'Essential'},
        ${'queued'},
        NOW()
      )
      RETURNING *
    `;
    const researchRequest = researchResult.rows[0];

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Test job created with Amazon URL',
      job: {
        id: job.id,
        website_url: job.website_url,
        amazon_url: job.amazon_url,
        status: job.status
      },
      researchRequest: {
        id: researchRequest.id,
        amazon_url: researchRequest.amazon_url,
        email: researchRequest.email
      },
      debugUrl: `/payment/success?debug=true&testJobId=${job.id}`
    });

  } catch (error) {
    console.error('Error creating test job:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create test job', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}