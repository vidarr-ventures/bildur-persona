'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Sparkles, Crown, Zap } from 'lucide-react';
import { PRICING_PLANS, DISCOUNT_CODES, calculateDiscountedPrice, formatPrice, validateDiscountCode } from '@/lib/stripe';

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<string | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [isLoading, setIsLoading] = useState<string | null>(null);

  // Get pre-filled form data from search params
  const formData = {
    websiteUrl: searchParams.get('websiteUrl') || '',
    amazonUrl: searchParams.get('amazonUrl') || '',
    keywords: searchParams.get('keywords') || '',
    email: searchParams.get('email') || '',
    competitorUrls: searchParams.get('competitorUrls') || ''
  };

  const handleDiscountApply = () => {
    setDiscountError('');
    if (!discountCode.trim()) {
      setDiscountError('Please enter a discount code');
      return;
    }

    const upperCode = discountCode.toUpperCase();
    if (validateDiscountCode(upperCode)) {
      setAppliedDiscount(upperCode);
      setDiscountError('');
    } else {
      setDiscountError('Invalid discount code');
    }
  };

  const handleDiscountRemove = () => {
    setAppliedDiscount(null);
    setDiscountCode('');
    setDiscountError('');
  };

  const handlePurchase = async (planId: string) => {
    setIsLoading(planId);
    
    try {
      const plan = PRICING_PLANS[planId as keyof typeof PRICING_PLANS];
      const originalPrice = plan.price; // Already in cents
      const finalPrice = calculateDiscountedPrice(originalPrice, appliedDiscount || undefined);

      const response = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          discountCode: appliedDiscount,
          formData,
          originalPrice,
          finalPrice
        }),
      });

      const data = await response.json();

      console.log('Checkout response:', data); // Debug log

      if (data.success && data.checkoutUrl) {
        // Redirect to checkout or success page
        window.location.href = data.checkoutUrl;
      } else {
        console.error('Checkout failed:', data);
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Payment error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error details:', errorMessage);
      alert(`Failed to start payment process: ${errorMessage}. Please try again.`);
    } finally {
      setIsLoading(null);
    }
  };

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'basic': return <Zap className="h-6 w-6" />;
      case 'pro': return <Sparkles className="h-6 w-6" />;
      case 'enterprise': return <Crown className="h-6 w-6" />;
      default: return <Zap className="h-6 w-6" />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-black/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">
              Choose Your <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Analysis Plan</span>
            </h1>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Select the perfect plan for your customer research needs. All plans include AI-powered analysis and detailed persona reports.
            </p>
          </div>
        </div>
      </header>

      {/* Discount Code Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
            <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <span>Have a discount code?</span>
          </h3>
          
          {appliedDiscount ? (
            <div className="flex items-center justify-between bg-green-900/30 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Check className="h-5 w-5 text-green-400" />
                <div>
                  <p className="text-green-300 font-medium">Discount Applied: {appliedDiscount}</p>
                  <p className="text-green-200 text-sm">{DISCOUNT_CODES[appliedDiscount as keyof typeof DISCOUNT_CODES].description}</p>
                </div>
              </div>
              <button
                onClick={handleDiscountRemove}
                className="text-green-300 hover:text-green-100 text-sm underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex space-x-3">
              <input
                type="text"
                placeholder="Enter discount code"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400"
              />
              <button
                onClick={handleDiscountApply}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                Apply
              </button>
            </div>
          )}
          
          {discountError && (
            <p className="text-red-400 text-sm mt-2">{discountError}</p>
          )}
        </div>
      </section>

      {/* Pricing Plans */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {Object.entries(PRICING_PLANS).map(([planId, plan]) => {
            const originalPrice = plan.price;
            const finalPrice = calculateDiscountedPrice(originalPrice, appliedDiscount || undefined);
            const hasDiscount = finalPrice < originalPrice;

            return (
              <div
                key={planId}
                className={`relative bg-gray-900 rounded-xl border-2 p-8 ${
                  'popular' in plan && plan.popular 
                    ? 'border-purple-500 ring-2 ring-purple-500/20' 
                    : 'border-gray-700 hover:border-gray-600'
                } transition-all duration-200`}
              >
                {'popular' in plan && plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-500/20 rounded-lg mb-4">
                    {getPlanIcon(planId)}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
                  
                  <div className="mb-6">
                    {hasDiscount && (
                      <div className="text-gray-400 line-through text-lg mb-1">
                        {formatPrice(originalPrice)}
                      </div>
                    )}
                    <div className="text-4xl font-bold text-white">
                      {finalPrice === 0 ? 'FREE' : formatPrice(finalPrice)}
                    </div>
                    {hasDiscount && finalPrice > 0 && (
                      <div className="text-green-400 text-sm font-medium mt-1">
                        Save {formatPrice(originalPrice - finalPrice)}
                      </div>
                    )}
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start space-x-3">
                      <Check className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handlePurchase(planId)}
                  disabled={isLoading === planId}
                  className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
                    'popular' in plan && plan.popular
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:opacity-90'
                      : 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2`}
                >
                  {isLoading === planId ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>{finalPrice === 0 ? 'Start Free Analysis' : 'Start Analysis'}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="bg-gray-950 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center space-y-2">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="font-semibold text-white">Secure Payment</h4>
              <p className="text-gray-400 text-sm">Protected by Stripe</p>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="font-semibold text-white">Instant Access</h4>
              <p className="text-gray-400 text-sm">Analysis starts immediately</p>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h4 className="font-semibold text-white">Email Delivery</h4>
              <p className="text-gray-400 text-sm">Results sent to your inbox</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold">Loading pricing...</h2>
        </div>
      </div>
    }>
      <PricingContent />
    </Suspense>
  );
}