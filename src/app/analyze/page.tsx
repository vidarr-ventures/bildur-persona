'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/brainwave/Button';
import Section from '@/components/brainwave/Section';
import { Loader2, ArrowRight, Globe, CheckCircle } from 'lucide-react';

export default function AnalyzePage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const validateUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!url) {
      setError('Please enter a website URL');
      return;
    }

    if (!validateUrl(url)) {
      setError('Please enter a valid website URL');
      return;
    }

    setIsLoading(true);

    try {
      // Normalize URL
      const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

      const response = await fetch('/api/v2/analysis/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUrl: normalizedUrl,
          userEmail: email || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to start analysis');
      }

      // Redirect to report page
      router.push(`/report/${data.data.analysisId}`);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start analysis');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-n-8">
      <Section className="px-4 py-16">
        <div className="container">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="h1 text-n-1 mb-4">
                Customer Persona Analyzer
              </h1>
              <p className="body-1 text-n-2">
                Enter a website URL to generate a comprehensive customer persona report
              </p>
            </div>

            {/* Main Form Card */}
            <div className="bg-n-7 border border-n-6 rounded-xl p-8 shadow-2xl">
              <div className="mb-6">
                <h2 className="h4 text-n-1 mb-2">Analyze Website</h2>
                <p className="body-2 text-n-3">
                  Our AI will analyze the website content to extract customer insights and generate a detailed persona report.
                </p>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* URL Input */}
                <div>
                  <label htmlFor="url" className="block text-sm font-medium text-n-2 mb-2">
                    Website URL *
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3 h-5 w-5 text-n-4" />
                    <input
                      id="url"
                      type="text"
                      placeholder="example.com or https://example.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-n-6 border border-n-5 rounded-lg text-n-1 placeholder-n-4 focus:outline-none focus:border-color-1 transition-colors"
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>

                {/* Email Input (Optional) */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-n-2 mb-2">
                    Email (Optional)
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-n-6 border border-n-5 rounded-lg text-n-1 placeholder-n-4 focus:outline-none focus:border-color-1 transition-colors"
                    disabled={isLoading}
                  />
                  <p className="text-sm text-n-4 mt-1">
                    We'll send you the report when it's ready
                  </p>
                </div>

                {/* Error Alert */}
                {error && (
                  <div className="bg-color-3/10 border border-color-3 rounded-lg p-4">
                    <p className="text-color-3 text-sm">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Analyzing Website...
                    </>
                  ) : (
                    <>
                      Start Free Analysis
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>
            </div>

            {/* Features */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-color-1/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="h-6 w-6 text-color-1" />
                </div>
                <h3 className="h6 text-n-1">AI-Powered Analysis</h3>
                <p className="caption text-n-3 mt-1">
                  Advanced GPT-4 analysis of website content
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-color-4/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="h-6 w-6 text-color-4" />
                </div>
                <h3 className="h6 text-n-1">Instant Results</h3>
                <p className="caption text-n-3 mt-1">
                  Get your persona report in minutes
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-color-6/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="h-6 w-6 text-color-6" />
                </div>
                <h3 className="h6 text-n-1">Actionable Insights</h3>
                <p className="caption text-n-3 mt-1">
                  Detailed recommendations for your business
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}