import { NextRequest, NextResponse } from 'next/server';
import { stripe, PRICING_PLANS, validateDiscountCode } from '@/lib/stripe';

interface CheckoutRequest {
  planId: string;
  discountCode?: string;
  formData: {
    websiteUrl: string;
    amazonUrl?: string;
    keywords: string;
    redditKeywords?: string;
    email: string;
    competitorUrls?: string;
  };
  originalPrice: number;
  finalPrice: number;
}

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'Payment processing not configured' }, { status: 500 });
    }

    const body: CheckoutRequest = await request.json();
    const { planId, discountCode, formData, originalPrice, finalPrice } = body;

    // Validate plan
    if (!(planId in PRICING_PLANS)) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    // Validate discount code if provided
    if (discountCode && !validateDiscountCode(discountCode)) {
      return NextResponse.json({ error: 'Invalid discount code' }, { status: 400 });
    }

    // Validate required form data
    if (!formData.websiteUrl || !formData.email || !formData.keywords) {
      return NextResponse.json({ error: 'Missing required form data' }, { status: 400 });
    }

    const plan = PRICING_PLANS[planId as keyof typeof PRICING_PLANS];

    // If final price is 0 (100% discount), create a free "payment" record
    if (finalPrice === 0) {
      try {
        // Create a record in your database for the free analysis
        const freeOrderId = `free_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Start the research process immediately for free orders
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://persona.bildur.ai';
        
        const researchData = {
          websiteUrl: formData.websiteUrl,
          amazonUrl: formData.amazonUrl || '',
          keywords: formData.keywords,
          redditKeywords: formData.redditKeywords || '',
          email: formData.email,
          competitorUrls: formData.competitorUrls ? formData.competitorUrls.split(',').filter(Boolean) : [],
          planId,
          discountCode,
          paymentSessionId: freeOrderId,
          amountPaid: 0,
          originalPrice,
          finalPrice: 0,
          isFree: true
        };

        // Start the research process
        const response = await fetch(`${baseUrl}/api/research/lead-gen/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`, // Internal API key for free orders
          },
          body: JSON.stringify(researchData),
        });

        let jobId = null;
        if (response.ok) {
          const result = await response.json();
          jobId = result.jobId;
          console.log('Free research started successfully:', jobId);
        } else {
          console.error('Failed to start free research:', response.statusText);
        }

        // Redirect to success page with free order
        const successUrl = `${baseUrl}/payment/success?session_id=${freeOrderId}&free=true&job_id=${jobId || ''}`;
        
        return NextResponse.json({
          success: true,
          checkoutUrl: successUrl,
          freeOrder: true,
          jobId
        });
      } catch (error) {
        console.error('Error processing free order:', error);
        return NextResponse.json({ error: 'Failed to process free order' }, { status: 500 });
      }
    }

    // Create Stripe checkout session for paid plans
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: plan.name,
              description: plan.description,
              metadata: {
                planId,
                discountCode: discountCode || '',
              },
            },
            unit_amount: finalPrice,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/pricing?cancelled=true`,
      customer_email: formData.email,
      metadata: {
        planId,
        discountCode: discountCode || '',
        websiteUrl: formData.websiteUrl,
        amazonUrl: formData.amazonUrl || '',
        keywords: formData.keywords,
        redditKeywords: formData.redditKeywords || '',
        competitorUrls: formData.competitorUrls || '',
        originalPrice: originalPrice.toString(),
        finalPrice: finalPrice.toString(),
      },
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}