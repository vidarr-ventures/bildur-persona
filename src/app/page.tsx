'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, ArrowRight, Globe, MessageSquare, Brain, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { validateAndCorrectUrl, validateAmazonUrl } from '@/lib/url-utils';

interface FormData {
  websiteUrl: string;
  amazonUrl: string;
  keywords: string;
  customerEmail: string;
  competitor1: string;
  competitor2: string;
  competitor3: string;
  competitor4: string;
  competitor5: string;
}

interface ValidationState {
  websiteUrl: { isValid: boolean; message: string; wasCorrected: boolean; };
  amazonUrl: { isValid: boolean; message: string; wasCorrected: boolean; };
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
    amazonUrl: '',
    keywords: '',
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
    amazonUrl: { isValid: true, message: '', wasCorrected: false },
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

      // Redirect to pricing page with form data as URL parameters
      const searchParams = new URLSearchParams({
        websiteUrl: formData.websiteUrl,
        amazonUrl: formData.amazonUrl || '',
        keywords: formData.keywords,
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

    let result;
    if (field === 'amazonUrl') {
      result = validateAmazonUrl(value);
    } else {
      result = validateAndCorrectUrl(value);
    }

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
    const urlFields = ['websiteUrl', 'amazonUrl', 'competitor1', 'competitor2', 'competitor3', 'competitor4', 'competitor5'];
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
    <div className="flex flex-col">
      {/* Header */}
      <header className="bg-black/95 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-bold">
                <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  Persona Generator
                </span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="text-gray-300 hover:text-white flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Dashboard</span>
              </Link>
              <Link href="/lookup" className="text-gray-300 hover:text-white flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>Find Results</span>
              </Link>
              <Link href="/auth/login" className="text-gray-300 hover:text-white">
                Login
              </Link>
              <Link href="/auth/signup" className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-2 rounded-md hover:opacity-90">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-br from-purple-900/20 to-blue-900/20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col items-center space-y-8 text-center">
            <div className="space-y-4">
              <div className="inline-block rounded-lg bg-purple-500/10 px-3 py-1 text-sm text-purple-400 border border-purple-500/20">
                AI-Powered Customer Research
              </div>
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                Understand Your{" "}
                <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  Customers
                </span>
              </h1>
              <p className="mx-auto max-w-[700px] text-gray-300 md:text-xl">
                Generate detailed customer personas using AI analysis of reviews, social media, and website content.
              </p>
            </div>

            {/* Feature Icons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl">
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Globe className="h-6 w-6 text-purple-400" />
                </div>
                <span className="text-sm text-gray-300">Website Analysis</span>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-blue-400" />
                </div>
                <span className="text-sm text-gray-300">Review Mining</span>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <Brain className="h-6 w-6 text-green-400" />
                </div>
                <span className="text-sm text-gray-300">AI Persona Generation</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section className="w-full py-12 md:py-24 bg-black">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-4">
                Start Your Customer Research
              </h2>
              <p className="text-gray-400">
                Enter your website and product details to generate comprehensive customer personas
              </p>
            </div>

            <div className="rounded-lg border border-gray-800 bg-gray-900 p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="websiteUrl" className="text-white font-medium block">
                    Website URL <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="websiteUrl"
                      type="text"
                      placeholder="example.com or https://your-website.com"
                      value={formData.websiteUrl}
                      onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                      onBlur={(e) => handleUrlBlur('websiteUrl', e.target.value)}
                      className={`w-full px-4 py-3 bg-gray-800 border rounded-lg focus:outline-none focus:ring-2 text-white placeholder-gray-400 pr-10 ${
                        validation.websiteUrl.isValid 
                          ? 'border-gray-700 focus:ring-purple-500' 
                          : 'border-red-500 focus:ring-red-500'
                      }`}
                      required
                    />
                    {validation.websiteUrl.message && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        {validation.websiteUrl.isValid ? (
                          validation.websiteUrl.wasCorrected ? (
                            <CheckCircle className="h-5 w-5 text-green-400" />
                          ) : null
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-400" />
                        )}
                      </div>
                    )}
                  </div>
                  {validation.websiteUrl.message && (
                    <p className={`text-xs mt-1 ${
                      validation.websiteUrl.isValid 
                        ? validation.websiteUrl.wasCorrected ? 'text-green-400' : 'text-gray-400'
                        : 'text-red-400'
                    }`}>
                      {validation.websiteUrl.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="amazonUrl" className="text-white font-medium block">
                    Amazon Product URL <span className="text-gray-400">(Optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      id="amazonUrl"
                      type="text"
                      placeholder="amazon.com/your-product or full Amazon URL"
                      value={formData.amazonUrl}
                      onChange={(e) => handleInputChange('amazonUrl', e.target.value)}
                      onBlur={(e) => handleUrlBlur('amazonUrl', e.target.value)}
                      className={`w-full px-4 py-3 bg-gray-800 border rounded-lg focus:outline-none focus:ring-2 text-white placeholder-gray-400 pr-10 ${
                        validation.amazonUrl.isValid 
                          ? 'border-gray-700 focus:ring-purple-500' 
                          : 'border-red-500 focus:ring-red-500'
                      }`}
                    />
                    {validation.amazonUrl.message && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        {validation.amazonUrl.isValid ? (
                          validation.amazonUrl.wasCorrected ? (
                            <CheckCircle className="h-5 w-5 text-green-400" />
                          ) : null
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-400" />
                        )}
                      </div>
                    )}
                  </div>
                  {validation.amazonUrl.message && (
                    <p className={`text-xs mt-1 ${
                      validation.amazonUrl.isValid 
                        ? validation.amazonUrl.wasCorrected ? 'text-green-400' : 'text-gray-400'
                        : 'text-red-400'
                    }`}>
                      {validation.amazonUrl.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="keywords" className="text-white font-medium block">
                    Keywords <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="keywords"
                    type="text"
                    placeholder="Enter up to 5 keywords separated by commas (e.g., ecommerce platform, saas software, online store)"
                    value={formData.keywords}
                    onChange={(e) => handleInputChange('keywords', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400"
                    required
                  />
                </div>

                <div className="bg-orange-900/20 border border-orange-500/30 rounded-md p-3">
                  <div className="flex items-start space-x-2">
                    <svg className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="text-orange-300 text-sm">
                      <p className="font-medium mb-1">Reddit research provides authentic customer insights:</p>
                      <ul className="space-y-1 text-orange-200">
                        <li>• Real user pain points and frustrations</li>
                        <li>• Honest product discussions and comparisons</li>
                        <li>• Community behavior patterns and preferences</li>
                        <li>• Unfiltered feedback from target demographics</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Competitor Analysis Section */}
                <div className="border-t border-gray-700 pt-6">
                  <div className="mb-6">
                    <h3 className="text-white font-medium text-lg flex items-center space-x-2">
                      <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span>Competitive Intelligence</span>
                      <span className="bg-purple-500/20 text-purple-300 text-xs px-2 py-1 rounded-full">Enhanced</span>
                    </h3>
                    <p className="text-gray-300 text-sm mt-2">
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
                          <label htmlFor={`competitor${num}`} className="text-gray-300 font-medium block flex items-center space-x-2">
                            <span>Competitor {num} Website</span>
                            <span className="text-gray-500 text-sm">(Optional)</span>
                            {formData[`competitor${num}` as keyof typeof formData] && (
                              <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
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
                              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg focus:outline-none focus:ring-2 text-white placeholder-gray-400 pr-10 hover:border-gray-600 transition-colors ${
                                validation[fieldName as keyof ValidationState].isValid 
                                  ? 'border-gray-700 focus:ring-purple-500' 
                                  : 'border-red-500 focus:ring-red-500'
                              }`}
                            />
                            {validation[fieldName as keyof ValidationState].message && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                {validation[fieldName as keyof ValidationState].isValid ? (
                                  validation[fieldName as keyof ValidationState].wasCorrected ? (
                                    <CheckCircle className="h-5 w-5 text-green-400" />
                                  ) : null
                                ) : (
                                  <AlertCircle className="h-5 w-5 text-red-400" />
                                )}
                              </div>
                            )}
                          </div>
                          {validation[fieldName as keyof ValidationState].message && (
                            <p className={`text-xs mt-1 ${
                              validation[fieldName as keyof ValidationState].isValid 
                                ? validation[fieldName as keyof ValidationState].wasCorrected ? 'text-green-400' : 'text-gray-400'
                                : 'text-red-400'
                            }`}>
                              {validation[fieldName as keyof ValidationState].message}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-4 mt-6">
                    <div className="flex items-start space-x-3">
                      <div className="bg-purple-500/20 rounded-full p-2 flex-shrink-0">
                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div className="text-purple-200 text-sm">
                        <p className="font-semibold mb-2 text-purple-100">🚀 Enhanced Competitor Analysis Now Extracts:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <ul className="space-y-1.5">
                            <li className="flex items-center space-x-2">
                              <span className="text-green-400 text-xs">✓</span>
                              <span><strong>50+ customer reviews</strong> per competitor (vs 20 previously)</span>
                            </li>
                            <li className="flex items-center space-x-2">
                              <span className="text-green-400 text-xs">✓</span>
                              <span>Multi-page review extraction & pagination</span>
                            </li>
                            <li className="flex items-center space-x-2">
                              <span className="text-green-400 text-xs">✓</span>
                              <span>Underlying pain points & health conditions</span>
                            </li>
                          </ul>
                          <ul className="space-y-1.5">
                            <li className="flex items-center space-x-2">
                              <span className="text-green-400 text-xs">✓</span>
                              <span>Pricing analysis & feature comparison</span>
                            </li>
                            <li className="flex items-center space-x-2">
                              <span className="text-green-400 text-xs">✓</span>
                              <span>Customer demographics & psychographics</span>
                            </li>
                            <li className="flex items-center space-x-2">
                              <span className="text-green-400 text-xs">✓</span>
                              <span>Market gaps & differentiation opportunities</span>
                            </li>
                          </ul>
                        </div>
                        <div className="mt-3 text-xs text-purple-300 bg-purple-900/30 rounded-md p-2">
                          <strong>💡 Pro Tip:</strong> Add your top 3-5 direct competitors for the most comprehensive analysis. 
                          The system will extract 50+ reviews from each competitor to identify customer pain points and preferences.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Customer Email */}
                <div className="space-y-2">
                  <label htmlFor="customerEmail" className="text-white font-medium block">
                    Email Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="customerEmail"
                    type="email"
                    placeholder="your@email.com"
                    value={formData.customerEmail}
                    onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400"
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Proceeding to Payment...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue to Pricing</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="flex items-center space-x-2 text-gray-400 text-sm mt-6">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>Analysis includes website content, YouTube comments, Amazon reviews, Reddit research, and <strong>enhanced competitor intelligence (50+ reviews each)</strong></span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
