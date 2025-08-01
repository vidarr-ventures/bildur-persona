import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus, saveJobData, createResearchRequest } from '@/lib/db';
import { PRICING_PLANS } from '@/lib/stripe';
import { sql } from '@vercel/postgres';

interface ResearchRequest {
  websiteUrl: string;
  amazonUrl?: string;
  keywords: string;
  email: string;
  competitorUrls?: string[];
  planId: string;
  discountCode?: string;
  paymentSessionId: string;
  amountPaid: number;
  originalPrice: number;
  finalPrice: number;
  isFree?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Check for internal API key (for webhook and free order calls)
    const authHeader = request.headers.get('authorization');
    const isInternalCall = authHeader?.startsWith('Bearer ') && 
                          authHeader.split(' ')[1] === process.env.INTERNAL_API_KEY;

    const body: ResearchRequest = await request.json();
    const {
      websiteUrl,
      amazonUrl,
      keywords,
      email,
      competitorUrls = [],
      planId,
      discountCode,
      paymentSessionId,
      amountPaid,
      originalPrice,
      finalPrice,
      isFree = false
    } = body;

    // Validate required fields
    if (!websiteUrl || !email || !keywords) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // For non-internal calls, verify payment (future enhancement)
    if (!isInternalCall && !isFree) {
      // TODO: Add payment verification logic here
      console.log('Payment verification would happen here for paid orders');
    }

    // Create a job ID
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`Starting research job ${jobId} for ${email}`);
    console.log(`Plan: ${planId}, Amount: $${finalPrice/100}, Free: ${isFree}`);

    // Get plan name from PRICING_PLANS
    const plan = PRICING_PLANS[planId as keyof typeof PRICING_PLANS];
    const planName = plan?.name || 'Unknown Plan';

    // Ensure research_requests table exists
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS research_requests (
          id SERIAL PRIMARY KEY,
          job_id VARCHAR(255) UNIQUE NOT NULL,
          website_url TEXT NOT NULL,
          amazon_url TEXT,
          keywords TEXT NOT NULL,
          email VARCHAR(255) NOT NULL,
          competitor_urls TEXT,
          plan_id VARCHAR(50) NOT NULL,
          plan_name VARCHAR(100) NOT NULL,
          discount_code VARCHAR(50),
          payment_session_id VARCHAR(255),
          amount_paid INTEGER DEFAULT 0,
          original_price INTEGER DEFAULT 0,
          final_price INTEGER DEFAULT 0,
          is_free BOOLEAN DEFAULT FALSE,
          status VARCHAR(50) DEFAULT 'queued',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          completed_at TIMESTAMP WITH TIME ZONE,
          persona_report_sent BOOLEAN DEFAULT FALSE
        )
      `;
      console.log('✅ research_requests table ready');
    } catch (tableError) {
      console.warn('Table creation warning (may already exist):', tableError);
    }

    // Store the research request in database
    const researchRequest = await createResearchRequest({
      jobId,
      websiteUrl,
      amazonUrl,
      keywords,
      email,
      competitorUrls,
      planId,
      planName,
      discountCode,
      paymentSessionId,
      amountPaid,
      originalPrice,
      finalPrice,
      isFree
    });

    console.log('Research request stored in database:', researchRequest.id);

    // Simulate starting the research process
    // In the real system, this would trigger your worker processes
    setTimeout(async () => {
      try {
        console.log(`Starting research workers for job ${jobId}`);
        
        // You would typically start your worker processes here:
        // - Website crawler
        // - Amazon reviews extractor
        // - Reddit scraper
        // - YouTube comments collector
        // - Competitor analysis
        // - Persona generator
        
        // For now, we'll just create a sample response
        console.log(`Research job ${jobId} queued successfully`);
      } catch (error) {
        console.error(`Error starting research job ${jobId}:`, error);
      }
    }, 1000);

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Research job started successfully',
      redirectUrl: `/dashboard/${jobId}`,
      data: {
        jobId,
        email,
        planId,
        isFree,
        estimatedCompletion: '10-15 minutes'
      }
    });

  } catch (error) {
    console.error('Research start error:', error);
    return NextResponse.json(
      { error: 'Failed to start research job' },
      { status: 500 }
    );
  }
}