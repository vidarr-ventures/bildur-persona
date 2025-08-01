import { NextRequest } from 'next/server';
import { stripe } from '@/lib/stripe';

export interface PaymentVerification {
  isValid: boolean;
  planId?: string;
  email?: string;
  error?: string;
  isFree?: boolean;
}

export async function verifyPayment(
  sessionId: string, 
  isFree?: boolean
): Promise<PaymentVerification> {
  try {
    // Handle free access with discount codes
    if (isFree && sessionId.startsWith('free_')) {
      return {
        isValid: true,
        isFree: true,
        planId: 'basic', // Default to basic plan for free users
        email: 'free_user'
      };
    }

    if (!stripe) {
      return {
        isValid: false,
        error: 'Payment processing not configured'
      };
    }

    // Verify Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return {
        isValid: false,
        error: 'Payment not completed'
      };
    }

    return {
      isValid: true,
      planId: session.metadata?.planId,
      email: session.customer_email || undefined,
      isFree: false
    };

  } catch (error) {
    console.error('Payment verification error:', error);
    return {
      isValid: false,
      error: 'Failed to verify payment'
    };
  }
}

export function requirePayment(handler: Function) {
  return async (request: NextRequest) => {
    try {
      // Check for internal API key (for webhook calls)
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ') && authHeader.split(' ')[1] === process.env.INTERNAL_API_KEY) {
        return handler(request);
      }

      // Get payment verification from request body or headers
      let paymentData;
      try {
        const body = await request.json();
        paymentData = {
          sessionId: body.paymentSessionId || body.sessionId,
          isFree: body.isFree
        };
      } catch {
        // If JSON parsing fails, check headers
        paymentData = {
          sessionId: request.headers.get('x-payment-session'),
          isFree: request.headers.get('x-payment-free') === 'true'
        };
      }

      if (!paymentData.sessionId) {
        return new Response(
          JSON.stringify({ error: 'Payment verification required' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const verification = await verifyPayment(paymentData.sessionId, paymentData.isFree);
      
      if (!verification.isValid) {
        return new Response(
          JSON.stringify({ error: verification.error || 'Invalid payment' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Add payment info to request context
      (request as any).paymentInfo = verification;
      
      return handler(request);

    } catch (error) {
      console.error('Payment middleware error:', error);
      return new Response(
        JSON.stringify({ error: 'Payment verification failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
}