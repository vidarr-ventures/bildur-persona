import { NextRequest, NextResponse } from 'next/server';
import { stripe, PRICING_PLANS } from '@/lib/stripe';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const isFree = searchParams.get('free') === 'true';

    if (!sessionId) {
      return NextResponse.json({ 
        success: false, 
        error: 'No session ID provided' 
      }, { status: 400 });
    }

    console.log('Payment verification request:', { sessionId, isFree });

    // Handle free orders (with discount code TESTER) - check this FIRST
    if (isFree && sessionId.startsWith('free_')) {
      console.log('Verifying free order:', sessionId);
      
      const existingJobId = searchParams.get('job_id');
      if (existingJobId) {
        console.log('Free order already has job ID:', existingJobId);
        return NextResponse.json({
          success: true,
          isFree: true,
          email: 'Free Analysis',
          planName: 'Free Analysis',
          jobId: existingJobId
        });
      }

      // If no job ID, create a free job with minimal data for testing
      console.log('Creating free test job');
      
      // Create a test job with sample data for free analysis
      const testJobResponse = await fetch(`${request.nextUrl.origin}/api/jobs/create-v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryProductUrl: 'https://example.com',
          targetKeywords: 'free analysis test',
          amazonProductUrl: 'https://amazon.com/test'
        })
      });

      if (!testJobResponse.ok) {
        console.error('Failed to create free test job:', await testJobResponse.text());
        return NextResponse.json({
          success: false,
          error: 'Failed to create free analysis job'
        }, { status: 500 });
      }

      const testJobData = await testJobResponse.json();
      console.log('Free test job created:', testJobData.jobId);

      return NextResponse.json({
        success: true,
        isFree: true,
        email: 'Free Analysis',
        planName: 'Free Analysis',
        jobId: testJobData.jobId
      });
    }

    // Only check Stripe for paid orders
    if (!stripe) {
      console.error('Stripe not configured for paid order verification');
      return NextResponse.json({ error: 'Payment processing not configured' }, { status: 500 });
    }

    // Retrieve the Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'line_items.data.price.product']
    });

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ 
        success: false, 
        error: 'Payment not completed' 
      }, { status: 400 });
    }

    // Extract plan information from metadata
    const planId = session.metadata?.planId;
    const plan = planId ? PRICING_PLANS[planId as keyof typeof PRICING_PLANS] : null;

    return NextResponse.json({
      success: true,
      email: session.customer_email,
      planName: plan?.name || 'Unknown Plan',
      sessionId: session.id,
      amountPaid: session.amount_total,
      isFree: false,
      jobId: null // This will be populated by the webhook handler
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to verify payment' 
    }, { status: 500 });
  }
}