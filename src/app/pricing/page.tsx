'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Sparkles, Crown, Zap } from 'lucide-react';
import Link from 'next/link';
import { PRICING_PLANS, DISCOUNT_CODES, calculateDiscountedPrice, formatPrice, validateDiscountCode } from '@/lib/stripe';
import Section from '@/components/brainwave/Section';
import Button from '@/components/brainwave/Button';

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
    <div className="min-h-screen bg-n-8 text-n-1">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-50 border-b border-n-6 lg:bg-n-8/90 lg:backdrop-blur-sm">
        <div className="flex items-center px-5 lg:px-7.5 xl:px-10 max-lg:py-4">
          <Link href="/" className="block w-[12rem] xl:mr-8">
            <span className="h2 font-bold text-n-1">
              Persona<span className="text-color-1">AI</span>
            </span>
          </Link>
          
          <nav className="hidden fixed top-[5rem] left-0 right-0 bottom-0 bg-n-8 lg:static lg:flex lg:mx-auto lg:bg-transparent">
            <div className="relative z-2 flex flex-col items-center justify-center m-auto lg:flex-row">
              <Link href="/dashboard" className="block relative font-code text-2xl uppercase text-n-1 transition-colors hover:text-color-1 lg:text-xs lg:font-semibold lg:leading-5 lg:hover:text-color-1 xl:px-12">
                Dashboard
              </Link>
              <Link href="/pricing" className="block relative font-code text-2xl uppercase text-n-1 transition-colors hover:text-color-1 lg:text-xs lg:font-semibold lg:leading-5 lg:hover:text-color-1 xl:px-12">
                Pricing
              </Link>
            </div>
          </nav>

          <Link href="/auth/signup" className="hidden mr-8 text-n-1/50 transition-colors hover:text-n-1 lg:block">
            New account
          </Link>
          <Button href="/auth/login" className="hidden lg:flex">
            Sign in
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <Section className="-mt-[5.25rem] pt-[12.25rem] lg:pt-[15.25rem] xl:pt-[20.25rem]" customPaddings>
        <div className="container relative">
          <div className="relative z-1 max-w-[62rem] mx-auto text-center mb-[3.875rem] md:mb-20 lg:mb-[6.25rem]">
            <h1 className="h1 mb-6">
              Choose Your{" "}
              <span className="inline-block relative">
                Analysis Plan
                <svg
                  className="absolute top-full left-0 w-full xl:-mt-2"
                  width="624"
                  height="28"
                  viewBox="0 0 624 28"
                  fill="none"
                >
                  <path
                    d="M1 14.5C204.5 -4.5 621 -4.5 623 14.5"
                    stroke="url(#gradient)"
                    strokeWidth="2"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#89F9E8" />
                      <stop offset="100%" stopColor="#FACB7B" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </h1>
            <p className="body-1 max-w-3xl mx-auto mb-6 text-n-2 lg:mb-8">
              Select the perfect plan for your customer research needs. All plans include AI-powered analysis and detailed persona reports.
            </p>
          </div>
        </div>
      </Section>

      {/* Discount Code Section */}
      <Section>
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="relative p-0.5 rounded-2xl bg-conic-gradient mb-12">
              <div className="relative bg-n-8 rounded-[0.875rem] p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2 text-n-1">
                  <svg className="w-5 h-5 text-color-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <span>Have a discount code?</span>
                </h3>
                
                {appliedDiscount ? (
                  <div className="flex items-center justify-between bg-color-4/10 border border-color-4/30 rounded-xl p-4">
                    <div className="flex items-center space-x-3">
                      <Check className="h-5 w-5 text-color-4" />
                      <div>
                        <p className="text-color-4 font-medium">Discount Applied: {appliedDiscount}</p>
                        <p className="text-color-4/80 text-sm">{DISCOUNT_CODES[appliedDiscount as keyof typeof DISCOUNT_CODES].description}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleDiscountRemove}
                      className="text-color-4 hover:text-color-4/80 text-sm underline"
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
                      className="flex-1 px-4 py-3 bg-n-7 border border-n-6 rounded-xl focus:outline-none focus:ring-2 focus:ring-color-1 text-n-1 placeholder-n-4"
                    />
                    <Button onClick={handleDiscountApply} white>
                      Apply
                    </Button>
                  </div>
                )}
                
                {discountError && (
                  <p className="text-color-3 text-sm mt-2">{discountError}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Pricing Plans */}
      <Section>
        <div className="container">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {Object.entries(PRICING_PLANS).map(([planId, plan]) => {
                const originalPrice = plan.price;
                const finalPrice = calculateDiscountedPrice(originalPrice, appliedDiscount || undefined);
                const hasDiscount = finalPrice < originalPrice;
                const isPopular = 'popular' in plan && plan.popular;

                return (
                  <div
                    key={planId}
                    className={`relative ${
                      isPopular ? 'p-0.5 rounded-2xl bg-conic-gradient' : ''
                    }`}
                  >
                    <div
                      className={`relative ${
                        isPopular ? 'bg-n-8 rounded-[0.875rem]' : 'bg-n-7 rounded-2xl border border-n-6'
                      } p-8 h-full flex flex-col`}
                    >
                      {isPopular && (
                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                          <span className="bg-gradient-to-r from-color-1 to-color-5 text-n-8 px-4 py-1 rounded-full text-sm font-medium">
                            Most Popular
                          </span>
                        </div>
                      )}

                      <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-color-1 to-color-5 rounded-lg mb-4">
                          {getPlanIcon(planId)}
                        </div>
                        <h3 className="text-xl font-bold text-n-1 mb-2">{plan.name}</h3>
                        <p className="text-n-3 text-sm mb-4">{plan.description}</p>
                        
                        <div className="mb-6">
                          {hasDiscount && (
                            <div className="text-n-4 line-through text-lg mb-1">
                              {formatPrice(originalPrice)}
                            </div>
                          )}
                          <div className="text-4xl font-bold text-n-1">
                            {finalPrice === 0 ? 'FREE' : formatPrice(finalPrice)}
                          </div>
                          {hasDiscount && finalPrice > 0 && (
                            <div className="text-color-4 text-sm font-medium mt-1">
                              Save {formatPrice(originalPrice - finalPrice)}
                            </div>
                          )}
                        </div>
                      </div>

                      <ul className="space-y-3 mb-8 flex-grow">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-start space-x-3">
                            <Check className="h-5 w-5 text-color-4 mt-0.5 flex-shrink-0" />
                            <span className="text-n-2 text-sm">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        onClick={() => handlePurchase(planId)}
                        disabled={isLoading === planId}
                        className={`w-full ${
                          isPopular ? 'bg-gradient-to-r from-color-1 to-color-5' : ''
                        }`}
                        white={!isPopular}
                      >
                        {isLoading === planId ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                            <span>Processing...</span>
                          </>
                        ) : (
                          <span>{finalPrice === 0 ? 'Start Free Analysis' : 'Start Analysis'}</span>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      {/* Trust Indicators */}
      <Section className="bg-n-7">
        <div className="container">
          <div className="max-w-4xl mx-auto text-center">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-12 h-12 bg-color-4/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-color-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-n-1">Secure Payment</h4>
                <p className="text-n-3 text-sm">Protected by Stripe</p>
              </div>
              <div className="flex flex-col items-center space-y-4">
                <div className="w-12 h-12 bg-color-2/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-color-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-n-1">Instant Access</h4>
                <p className="text-n-3 text-sm">Analysis starts immediately</p>
              </div>
              <div className="flex flex-col items-center space-y-4">
                <div className="w-12 h-12 bg-color-1/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-color-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-n-1">Email Delivery</h4>
                <p className="text-n-3 text-sm">Results sent to your inbox</p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Footer */}
      <footer className="bg-n-8 border-t border-n-6">
        <div className="container py-10">
          <div className="flex items-center justify-between">
            <span className="h5 font-bold text-n-1">
              Persona<span className="text-color-1">AI</span>
            </span>
            <p className="caption text-n-4">
              © 2024 PersonaAI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-n-8 text-n-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-color-1 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold">Loading pricing...</h2>
        </div>
      </div>
    }>
      <PricingContent />
    </Suspense>
  );
}