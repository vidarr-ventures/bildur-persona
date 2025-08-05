'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, ArrowRight, Globe, MessageSquare, Brain, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { validateAndCorrectUrl } from '@/lib/url-utils';
import Section from '@/components/brainwave/Section';
import Button from '@/components/brainwave/Button';

interface FormData {
  websiteUrl: string;
  primaryKeyword: string;
  secondaryKeyword: string;
  additionalKeyword: string;
  customerEmail: string;
  competitor1: string;
  competitor2: string;
  competitor3: string;
  competitor4: string;
  competitor5: string;
}

interface ValidationState {
  websiteUrl: { isValid: boolean; message: string; wasCorrected: boolean; };
  competitor1: { isValid: boolean; message: string; wasCorrected: boolean; };
  competitor2: { isValid: boolean; message: string; wasCorrected: boolean; };
  competitor3: { isValid: boolean; message: string; wasCorrected: boolean; };
  competitor4: { isValid: boolean; message: string; wasCorrected: boolean; };
  competitor5: { isValid: boolean; message: string; wasCorrected: boolean; };
}

export default function HomePage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    websiteUrl: '',
    primaryKeyword: '',
    secondaryKeyword: '',
    additionalKeyword: '',
    customerEmail: '',
    competitor1: '',
    competitor2: '',
    competitor3: '',
    competitor4: '',
    competitor5: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationState>({
    websiteUrl: { isValid: true, message: '', wasCorrected: false },
    competitor1: { isValid: true, message: '', wasCorrected: false },
    competitor2: { isValid: true, message: '', wasCorrected: false },
    competitor3: { isValid: true, message: '', wasCorrected: false },
    competitor4: { isValid: true, message: '', wasCorrected: false },
    competitor5: { isValid: true, message: '', wasCorrected: false }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Collect competitor URLs
      const competitorUrls = [
        formData.competitor1,
        formData.competitor2,
        formData.competitor3,
        formData.competitor4,
        formData.competitor5
      ].filter(Boolean); // Remove empty strings

      // Validate that at least primary keyword is provided
      if (!formData.primaryKeyword.trim()) {
        setError('Primary keyword is required');
        return;
      }

      // Combine keywords into a single string (comma-separated for backend compatibility)
      const keywords = [
        formData.primaryKeyword,
        formData.secondaryKeyword,
        formData.additionalKeyword
      ].filter(Boolean).join(', ');

      // Redirect to pricing page with form data as URL parameters
      const searchParams = new URLSearchParams({
        websiteUrl: formData.websiteUrl,
        keywords: keywords,
        email: formData.customerEmail,
        competitorUrls: competitorUrls.join(',')
      });

      router.push(`/pricing?${searchParams.toString()}`);
    } catch (err) {
      setError('Failed to proceed to payment. Please try again.');
      console.error('Submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateUrl = (field: string, value: string) => {
    if (!value.trim()) {
      setValidation(prev => ({
        ...prev,
        [field]: { isValid: true, message: '', wasCorrected: false }
      }));
      return;
    }

    const result = validateAndCorrectUrl(value);

    // Update form data with corrected URL if needed
    if (result.isValid && result.wasCorrected) {
      setFormData(prev => ({ ...prev, [field]: result.correctedUrl }));
    }

    // Update validation state
    setValidation(prev => ({
      ...prev,
      [field]: {
        isValid: result.isValid,
        message: result.wasCorrected 
          ? `Auto-corrected to: ${result.correctedUrl}`
          : result.error || '',
        wasCorrected: result.wasCorrected
      }
    }));
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // Validate URL fields on blur (we'll add onBlur handlers to inputs)
    const urlFields = ['websiteUrl', 'competitor1', 'competitor2', 'competitor3', 'competitor4', 'competitor5'];
    if (urlFields.includes(field)) {
      // Clear validation state while typing
      setValidation(prev => ({
        ...prev,
        [field]: { isValid: true, message: '', wasCorrected: false }
      }));
    }
  };

  const handleUrlBlur = (field: string, value: string) => {
    validateUrl(field, value);
  };

  return (
    <div className="flex flex-col min-h-screen bg-n-8 text-n-1">
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
      <Section
        className="-mt-[5.25rem] pt-[12.25rem] lg:pt-[15.25rem] xl:pt-[20.25rem]"
        crosses
        crossesOffset="lg:translate-y-[5.25rem]"
        customPaddings
      >
        <div className="container relative">
          <div className="relative z-1 max-w-[62rem] mx-auto text-center mb-[3.875rem] md:mb-20 lg:mb-[6.25rem]">
            <h1 className="h1 mb-6">
              Understand Your{" "}
              <span className="inline-block relative">
                Customers
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
              Generate detailed customer personas using AI analysis of reviews, social media, and website content. 
              Discover what your customers really want.
            </p>
            <Button href="#form" white>
              Get started
            </Button>
          </div>

          {/* Feature Icons */}
          <div className="relative max-w-[50rem] mx-auto mb-20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col items-center space-y-4 p-6 border border-n-6 rounded-2xl bg-n-7">
                <div className="w-12 h-12 bg-gradient-to-r from-color-1 to-color-5 rounded-lg flex items-center justify-center">
                  <Globe className="h-6 w-6 text-n-1" />
                </div>
                <span className="font-semibold text-n-1">Website Analysis</span>
                <span className="text-sm text-n-3 text-center">Extract customer insights from your website content and messaging</span>
              </div>
              <div className="flex flex-col items-center space-y-4 p-6 border border-n-6 rounded-2xl bg-n-7">
                <div className="w-12 h-12 bg-gradient-to-r from-color-2 to-color-4 rounded-lg flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-n-1" />
                </div>
                <span className="font-semibold text-n-1">Review Mining</span>
                <span className="text-sm text-n-3 text-center">Analyze customer reviews and feedback for deep insights</span>
              </div>
              <div className="flex flex-col items-center space-y-4 p-6 border border-n-6 rounded-2xl bg-n-7">
                <div className="w-12 h-12 bg-gradient-to-r from-color-4 to-color-6 rounded-lg flex items-center justify-center">
                  <Brain className="h-6 w-6 text-n-1" />
                </div>
                <span className="font-semibold text-n-1">AI Persona Generation</span>
                <span className="text-sm text-n-3 text-center">Generate detailed customer personas with AI analysis</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Form Section */}
      <Section id="form" className="pt-[4rem] pb-[8rem]">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="h2 mb-4">
                Start Your Customer Research
              </h2>
              <p className="body-1 text-n-3">
                Enter your website and product details to generate comprehensive customer personas
              </p>
            </div>

            <div className="relative p-0.5 rounded-2xl bg-conic-gradient">
              <div className="relative bg-n-8 rounded-[0.875rem] p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="websiteUrl" className="text-n-1 font-medium block mb-3">
                      Website URL <span className="text-color-3">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="websiteUrl"
                        type="text"
                        placeholder="example.com or https://your-website.com"
                        value={formData.websiteUrl}
                        onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                        onBlur={(e) => handleUrlBlur('websiteUrl', e.target.value)}
                        className={`w-full px-4 py-4 bg-n-7 border rounded-xl focus:outline-none focus:ring-2 text-n-1 placeholder-n-4 pr-10 ${
                          validation.websiteUrl.isValid 
                            ? 'border-n-6 focus:ring-color-1' 
                            : 'border-color-3 focus:ring-color-3'
                        }`}
                        required
                      />
                      {validation.websiteUrl.message && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          {validation.websiteUrl.isValid ? (
                            validation.websiteUrl.wasCorrected ? (
                              <CheckCircle className="h-5 w-5 text-color-4" />
                            ) : null
                          ) : (
                            <AlertCircle className="h-5 w-5 text-color-3" />
                          )}
                        </div>
                      )}
                    </div>
                    {validation.websiteUrl.message && (
                      <p className={`text-xs mt-2 ${
                        validation.websiteUrl.isValid 
                          ? validation.websiteUrl.wasCorrected ? 'text-color-4' : 'text-n-4'
                          : 'text-color-3'
                      }`}>
                        {validation.websiteUrl.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-n-1 font-semibold text-lg flex items-center space-x-2 mb-4">
                        <svg className="w-5 h-5 text-color-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <span>Target Keywords</span>
                      </h3>
                      <p className="text-n-3 text-sm mb-4">
                        Enter up to 3 keywords that best describe your product, service, or target market
                      </p>
                    </div>

                    <div>
                      <label htmlFor="primaryKeyword" className="text-n-1 font-medium block mb-3">
                        Primary Keyword <span className="text-color-3">*</span>
                      </label>
                      <input
                        id="primaryKeyword"
                        type="text"
                        placeholder="e.g., ecommerce platform"
                        value={formData.primaryKeyword}
                        onChange={(e) => handleInputChange('primaryKeyword', e.target.value)}
                        className="w-full px-4 py-4 bg-n-7 border border-n-6 rounded-xl focus:outline-none focus:ring-2 focus:ring-color-1 text-n-1 placeholder-n-4"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="secondaryKeyword" className="text-n-1 font-medium block mb-3">
                        Secondary Keyword <span className="text-n-4">(Optional)</span>
                      </label>
                      <input
                        id="secondaryKeyword"
                        type="text"
                        placeholder="e.g., online store builder"
                        value={formData.secondaryKeyword}
                        onChange={(e) => handleInputChange('secondaryKeyword', e.target.value)}
                        className="w-full px-4 py-4 bg-n-7 border border-n-6 rounded-xl focus:outline-none focus:ring-2 focus:ring-color-1 text-n-1 placeholder-n-4"
                      />
                    </div>

                    <div>
                      <label htmlFor="additionalKeyword" className="text-n-1 font-medium block mb-3">
                        Additional Keyword <span className="text-n-4">(Optional)</span>
                      </label>
                      <input
                        id="additionalKeyword"
                        type="text"
                        placeholder="e.g., saas software"
                        value={formData.additionalKeyword}
                        onChange={(e) => handleInputChange('additionalKeyword', e.target.value)}
                        className="w-full px-4 py-4 bg-n-7 border border-n-6 rounded-xl focus:outline-none focus:ring-2 focus:ring-color-1 text-n-1 placeholder-n-4"
                      />
                    </div>
                  </div>

                  {/* Competitor Analysis Section */}
                  <div className="border-t border-n-6 pt-6">
                    <div className="mb-6">
                      <h3 className="text-n-1 font-semibold text-lg flex items-center space-x-2">
                        <svg className="w-5 h-5 text-color-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span>Competitive Intelligence</span>
                        <span className="bg-color-1/20 text-color-1 text-xs px-2 py-1 rounded-full">Enhanced</span>
                      </h3>
                      <p className="text-n-3 text-sm mt-2">
                        Add competitor websites to extract <strong>50+ customer reviews</strong> and competitive insights for enhanced persona accuracy
                      </p>
                    </div>
                    
                    {/* Enhanced Competitor URL Fields */}
                    <div className="space-y-4">
                      {[1, 2, 3, 4, 5].map((num) => {
                        const fieldName = `competitor${num}`;
                        const placeholders = [
                          "competitor1.com or https://your-competitor.com",
                          "competitor2.com or https://similar-product.com", 
                          "competitor3.com or https://alternative-solution.com",
                          "competitor4.com or https://premium-option.com",
                          "competitor5.com or https://budget-alternative.com"
                        ];
                        
                        return (
                          <div key={num} className="space-y-2">
                            <label htmlFor={`competitor${num}`} className="text-n-2 font-medium block flex items-center space-x-2">
                              <span>Competitor {num} Website</span>
                              <span className="text-n-4 text-sm">(Optional)</span>
                              {formData[`competitor${num}` as keyof typeof formData] && (
                                <svg className="w-4 h-4 text-color-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              )}
                            </label>
                            <div className="relative">
                              <input
                                id={`competitor${num}`}
                                type="text"
                                placeholder={placeholders[num - 1]}
                                value={formData[`competitor${num}` as keyof typeof formData]}
                                onChange={(e) => handleInputChange(`competitor${num}`, e.target.value)}
                                onBlur={(e) => handleUrlBlur(`competitor${num}`, e.target.value)}
                                className={`w-full px-4 py-4 bg-n-7 border rounded-xl focus:outline-none focus:ring-2 text-n-1 placeholder-n-4 pr-10 hover:border-n-5 transition-colors ${
                                  validation[fieldName as keyof ValidationState].isValid 
                                    ? 'border-n-6 focus:ring-color-1' 
                                    : 'border-color-3 focus:ring-color-3'
                                }`}
                              />
                              {validation[fieldName as keyof ValidationState].message && (
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                  {validation[fieldName as keyof ValidationState].isValid ? (
                                    validation[fieldName as keyof ValidationState].wasCorrected ? (
                                      <CheckCircle className="h-5 w-5 text-color-4" />
                                    ) : null
                                  ) : (
                                    <AlertCircle className="h-5 w-5 text-color-3" />
                                  )}
                                </div>
                              )}
                            </div>
                            {validation[fieldName as keyof ValidationState].message && (
                              <p className={`text-xs mt-1 ${
                                validation[fieldName as keyof ValidationState].isValid 
                                  ? validation[fieldName as keyof ValidationState].wasCorrected ? 'text-color-4' : 'text-n-4'
                                  : 'text-color-3'
                              }`}>
                                {validation[fieldName as keyof ValidationState].message}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Customer Email */}
                  <div className="space-y-2">
                    <label htmlFor="customerEmail" className="text-n-1 font-medium block mb-3">
                      Email Address <span className="text-color-3">*</span>
                    </label>
                    <input
                      id="customerEmail"
                      type="email"
                      placeholder="your@email.com"
                      value={formData.customerEmail}
                      onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                      className="w-full px-4 py-4 bg-n-7 border border-n-6 rounded-xl focus:outline-none focus:ring-2 focus:ring-color-1 text-n-1 placeholder-n-4"
                      required
                    />
                  </div>

                  {error && (
                    <div className="bg-color-3/10 border border-color-3/20 rounded-xl p-4">
                      <p className="text-sm text-color-3">{error}</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full"
                    white
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-n-8 mr-2"></div>
                        <span>Proceeding to Payment...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="flex items-center space-x-2 text-n-4 text-sm mt-6">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>Analysis uses your keywords to extract relevant data from website content, YouTube comments, Reddit research, and <strong>enhanced competitor intelligence (50+ reviews each)</strong></span>
                </div>
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