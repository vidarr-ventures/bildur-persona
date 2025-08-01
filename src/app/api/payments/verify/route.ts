import { NextRequest, NextResponse } from 'next/server';
import { stripe, PRICING_PLANS } from '@/lib/stripe';

export async function GET(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'Payment processing not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const isFree = searchParams.get('free') === 'true';

    if (!sessionId) {
      return NextResponse.json({ 
        success: false, 
        error: 'No session ID provided' 
      }, { status: 400 });
    }

    // Handle free orders (with discount code TESTER)
    if (isFree) {
      // For free orders, the sessionId is actually a generated free order ID
      if (sessionId.startsWith('free_')) {
        return NextResponse.json({
          success: true,
          isFree: true,
          email: 'Free Analysis',
          planName: 'Free Analysis',
          jobId: null // Will be set when the analysis starts
        });
      }
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