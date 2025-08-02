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
    name: 'Essential',
    description: 'Core customer persona analysis',
    price: 1999, // $19.99 (in cents)
    priceId: process.env.STRIPE_BASIC_PRICE_ID,
    dataCollection: 'standard',
    features: [
      'Website content analysis',
      'Basic customer review extraction',
      'Amazon product analysis', 
      'YouTube comments research',
      'Reddit discussion insights',
      'Standard competitor analysis (2 competitors)',
      'AI-generated persona report',
      'Email delivery'
    ]
  },
  enhanced: {
    id: 'enhanced',
    name: 'Professional',
    description: 'Enhanced data collection and deeper insights',
    price: 4999, // $49.99 (in cents)
    priceId: process.env.STRIPE_ENHANCED_PRICE_ID,
    dataCollection: 'enhanced',
    popular: true,
    features: [
      'Everything in Essential',
      'Enhanced data collection (advanced web scraping)',
      'Deep customer review analysis (100+ reviews)',
      'Comprehensive competitor analysis (5 competitors)',
      'Advanced Reddit thread exploration',
      'Rich content extraction from complex sites',
      'Enhanced pain point identification',
      'Priority processing'
    ]
  },
  premium: {
    id: 'premium',
    name: 'Enterprise',
    description: 'Maximum insights with AI-powered deep research',
    price: 9999, // $99.99 (in cents)
    priceId: process.env.STRIPE_PREMIUM_PRICE_ID,
    dataCollection: 'premium',
    features: [
      'Everything in Professional',
      'AI-powered deep market research',
      'Custom industry analysis queries',
      'Advanced psychographic profiling',
      'Competitive positioning strategies',
      'Market opportunity identification',
      'Executive summary and action items',
      'White-label reporting options',
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