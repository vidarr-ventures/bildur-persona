import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus, saveJobData } from '@/lib/db';

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

    // Store the research request
    const researchData = {
      jobId,
      websiteUrl,
      amazonUrl,
      keywords,
      email,
      competitorUrls,
      planId,
      discountCode,
      paymentSessionId,
      amountPaid,
      originalPrice,
      finalPrice,
      isFree,
      status: 'queued',
      createdAt: new Date().toISOString()
    };

    // For now, we'll use the existing job system structure
    // In a real implementation, you'd save this to your database
    console.log('Research request stored:', researchData);

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