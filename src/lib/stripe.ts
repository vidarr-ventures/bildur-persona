import Stripe from 'stripe';

// Initialize Stripe only if the secret key is available
export const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-07-30.basil',
      typescript: true,
    })
  : null;

// Product and pricing configuration
export const PRICING_PLANS = {
  basic: {
    id: 'basic',
    name: 'Basic Analysis',
    description: 'Single customer persona analysis',
    price: 49, // $49
    priceId: process.env.STRIPE_BASIC_PRICE_ID,
    features: [
      'Website content analysis',
      'Customer review extraction (50+ reviews)',
      'Amazon product analysis',
      'YouTube comments research',
      'Reddit insights',
      'Basic competitor analysis (2 competitors)',
      'AI-generated persona report',
      'Email delivery'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Professional Analysis',
    description: 'Comprehensive multi-competitor analysis',
    price: 99, // $99
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    popular: true,
    features: [
      'Everything in Basic',
      'Enhanced competitor analysis (5 competitors)',
      'Advanced Reddit research',
      'Detailed pain point analysis',
      'Customer journey mapping',
      'Market positioning insights',
      'Downloadable PDF report',
      'Priority processing'
    ]
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise Analysis',
    description: 'Multi-product analysis with custom insights',
    price: 199, // $199
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    features: [
      'Everything in Professional',
      'Multiple product analysis',
      'Custom competitor research',
      'Advanced demographic insights',
      'Psychographic profiling',
      'Market opportunity analysis',
      'White-label reporting',
      'Dedicated support'
    ]
  }
} as const;

export type PricingPlan = keyof typeof PRICING_PLANS;

// Discount codes configuration
export const DISCOUNT_CODES = {
  'BETA50': { percent: 50, description: 'Beta tester 50% discount' },
  'LAUNCH25': { percent: 25, description: 'Launch week 25% discount' },
  'TESTER': { percent: 100, description: 'Free access for testers' },
  'EARLYBIRD': { percent: 30, description: 'Early bird 30% discount' }
} as const;

export type DiscountCode = keyof typeof DISCOUNT_CODES;

// Helper functions
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function calculateDiscountedPrice(originalPrice: number, discountCode?: string): number {
  if (!discountCode || !(discountCode in DISCOUNT_CODES)) {
    return originalPrice;
  }
  
  const discount = DISCOUNT_CODES[discountCode as DiscountCode];
  return Math.round(originalPrice * (100 - discount.percent) / 100);
}

export function validateDiscountCode(code: string): boolean {
  return code in DISCOUNT_CODES;
}