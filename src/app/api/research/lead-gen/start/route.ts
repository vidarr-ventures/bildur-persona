import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus, saveJobData, createResearchRequest } from '@/lib/db';
import { PRICING_PLANS } from '@/lib/stripe';
import { sql } from '@vercel/postgres';
// TEMPORARILY DISABLED: import { Queue } from '@/lib/queue';

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
    // TEMPORARILY DISABLED: Check for internal API key (for webhook and free order calls)
    // const authHeader = request.headers.get('authorization');
    // const isInternalCall = authHeader?.startsWith('Bearer ') && 
    //                       authHeader.split(' ')[1] === process.env.INTERNAL_API_KEY;
    const isInternalCall = true; // Allow all calls for testing

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

    // TEMPORARILY SKIP ALL DATABASE OPERATIONS FOR TESTING
    console.log('TESTING MODE: Skipping database operations to test jobId flow');
    console.log(`Generated jobId: ${jobId}`);

    console.log('About to return response with jobId:', jobId);
    
    const responseData = {
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
    };
    
    console.log('Full response data:', JSON.stringify(responseData));
    
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Research start error:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'TESTING MODE: lead-gen bypass failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}