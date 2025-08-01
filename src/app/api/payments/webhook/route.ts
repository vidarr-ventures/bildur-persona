import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Payment processing not configured' }, { status: 500 });
  }

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'No signature found' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        await handlePaymentSuccess(session);
        break;

      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment succeeded:', paymentIntent.id);
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        console.log('Payment failed:', failedPayment.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}

async function handlePaymentSuccess(session: Stripe.Checkout.Session) {
  try {
    console.log('Payment successful for session:', session.id);

    // Extract metadata from the session
    const metadata = session.metadata;
    if (!metadata) {
      console.error('No metadata found in session');
      return;
    }

    const {
      planId,
      discountCode,
      websiteUrl,
      amazonUrl,
      keywords,
      redditKeywords,
      competitorUrls,
      originalPrice,
      finalPrice
    } = metadata;

    // Create research request
    const researchData = {
      websiteUrl,
      amazonUrl,
      keywords,
      redditKeywords,
      email: session.customer_email,
      competitorUrls: competitorUrls ? competitorUrls.split(',') : [],
      planId,
      discountCode,
      paymentSessionId: session.id,
      amountPaid: session.amount_total,
      originalPrice: parseInt(originalPrice || '0'),
      finalPrice: parseInt(finalPrice || '0'),
    };

    // Start the research process
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/research/lead-gen/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`, // Internal API key for webhook calls
      },
      body: JSON.stringify(researchData),
    });

    if (!response.ok) {
      throw new Error(`Failed to start research: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Research started successfully:', result.jobId);

    // TODO: Store payment record in database
    // await storePaymentRecord({
    //   sessionId: session.id,
    //   email: session.customer_email,
    //   planId,
    //   discountCode,
    //   amountPaid: session.amount_total,
    //   jobId: result.jobId,
    //   status: 'paid',
    //   createdAt: new Date()
    // });

  } catch (error) {
    console.error('Error handling payment success:', error);
    // TODO: Implement retry logic or dead letter queue for failed webhook processing
  }
}

// Disable body parsing for webhooks
export const runtime = 'nodejs';