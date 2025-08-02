import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus, saveJobData, createResearchRequest } from '@/lib/db';
import { PRICING_PLANS } from '@/lib/stripe';
import { sql } from '@vercel/postgres';
import { Queue } from '@/lib/queue';

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

    // Add job to queue for processing
    try {
      console.log(`Adding job ${jobId} to processing queue`);
      
      const queueJobId = await Queue.addJob({
        type: 'persona_research',
        data: {
          jobId,
          websiteUrl,
          targetKeywords: keywords,
          amazonUrl
        }
      });
      
      console.log(`Research job ${jobId} added to queue with ID: ${queueJobId}`);
      
      // Also trigger direct processing as backup
      setTimeout(async () => {
        try {
          console.log(`Triggering backup direct processing for job ${jobId}`);
          await Queue.processQueueDirectly();
        } catch (error) {
          console.error(`Error in backup processing for job ${jobId}:`, error);
        }
      }, 2000);
      
    } catch (queueError) {
      console.error(`Error adding job ${jobId} to queue:`, queueError);
      // Fallback: trigger direct processing immediately
      setTimeout(async () => {
        try {
          console.log(`Using fallback processing for job ${jobId}`);
          await Queue.executeWorkersDirectly({
            jobId,
            websiteUrl,
            targetKeywords: keywords,
            amazonUrl
          });
        } catch (error) {
          console.error(`Error in fallback processing for job ${jobId}:`, error);
        }
      }, 1000);
    }

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
        estimatedCompletion: '5-8 minutes'
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