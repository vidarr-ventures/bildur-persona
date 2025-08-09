'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/brainwave/Button';
import Section from '@/components/brainwave/Section';
import { Loader2, ArrowRight, Globe, CheckCircle, Plus, X } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [competitorUrls, setCompetitorUrls] = useState<string[]>(['', '', '']);
  const [keywordPhrases, setKeywordPhrases] = useState<string[]>(['', '', '']);
  const [debugMode, setDebugMode] = useState(false);
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

  const addCompetitorField = () => {
    if (competitorUrls.length < 5) {
      setCompetitorUrls([...competitorUrls, '']);
    }
  };

  const removeCompetitorField = (index: number) => {
    const newUrls = competitorUrls.filter((_, i) => i !== index);
    setCompetitorUrls(newUrls.length > 0 ? newUrls : ['']);
  };

  const updateCompetitorUrl = (index: number, value: string) => {
    const newUrls = [...competitorUrls];
    newUrls[index] = value;
    setCompetitorUrls(newUrls);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!url) {
      setError('Please enter your website URL');
      return;
    }

    if (!validateUrl(url)) {
      setError('Please enter a valid website URL');
      return;
    }

    // Validate competitor URLs if provided
    const validCompetitors = competitorUrls.filter(u => u.trim() !== '');
    for (const compUrl of validCompetitors) {
      if (!validateUrl(compUrl)) {
        setError(`Invalid competitor URL: ${compUrl}`);
        return;
      }
    }

    // Validate keyword phrases - at least one is required
    const validKeywords = keywordPhrases.filter(k => k.trim() !== '');
    if (validKeywords.length === 0 || !keywordPhrases[0].trim()) {
      setError('Please enter at least one keyword phrase');
      return;
    }

    setIsLoading(true);

    try {
      // Normalize URLs
      const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
      const normalizedCompetitors = validCompetitors.map(u => 
        u.startsWith('http') ? u : `https://${u}`
      );

      const response = await fetch('/api/v2/analysis/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUrl: normalizedUrl,
          competitorUrls: normalizedCompetitors,
          keywordPhrases: validKeywords,
          debugMode: debugMode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to start analysis');
      }

      console.log('Analysis completed:', data);
      
      // Redirect to debug or report page
      if (debugMode) {
        router.push(`/debug/${data.data.analysisId}`);
      } else {
        router.push(`/report/${data.data.analysisId}`);
      }
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
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="h1 text-n-1 mb-4">
                Customer Persona Analyzer
              </h1>
              <p className="body-1 text-n-2">
                Analyze your website and competitors to generate comprehensive customer personas
              </p>
            </div>

            {/* Main Form Card */}
            <div className="bg-n-7 border border-n-6 rounded-xl p-8 shadow-2xl">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Your Website URL */}
                <div>
                  <label htmlFor="url" className="block text-sm font-medium text-n-1 mb-2">
                    Your Website URL *
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

                {/* Keyword Phrases */}
                <div>
                  <label className="block text-sm font-medium text-n-1 mb-2">
                    Keyword Phrases *
                  </label>
                  <p className="text-xs text-n-3 mb-3">
                    Enter 1-3 keyword phrases to focus the analysis
                  </p>
                  {keywordPhrases.map((phrase, index) => (
                    <div key={index} className="mb-2">
                      <input
                        type="text"
                        placeholder={index === 0 ? 'Primary keyword phrase (required)' : `Keyword phrase ${index + 1} (optional)`}
                        value={phrase}
                        onChange={(e) => {
                          const newPhrases = [...keywordPhrases];
                          newPhrases[index] = e.target.value;
                          setKeywordPhrases(newPhrases);
                        }}
                        className="w-full px-4 py-3 bg-n-6 border border-n-5 rounded-lg text-n-1 placeholder-n-4 focus:outline-none focus:border-color-1 transition-colors"
                        disabled={isLoading}
                        required={index === 0}
                      />
                    </div>
                  ))}
                </div>

                {/* Competitor URLs */}
                <div>
                  <label className="block text-sm font-medium text-n-1 mb-2">
                    Competitor Websites (Optional)
                  </label>
                  <p className="text-xs text-n-3 mb-3">
                    Add up to 5 competitor websites for comparative analysis
                  </p>
                  {competitorUrls.map((compUrl, index) => (
                    <div key={index} className="relative mb-2">
                      <Globe className="absolute left-3 top-3 h-5 w-5 text-n-4" />
                      <input
                        type="text"
                        placeholder={`Competitor ${index + 1} URL`}
                        value={compUrl}
                        onChange={(e) => updateCompetitorUrl(index, e.target.value)}
                        className="w-full pl-10 pr-12 py-3 bg-n-6 border border-n-5 rounded-lg text-n-1 placeholder-n-4 focus:outline-none focus:border-color-1 transition-colors"
                        disabled={isLoading}
                      />
                      {competitorUrls.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCompetitorField(index)}
                          className="absolute right-3 top-3 text-n-4 hover:text-color-3 transition-colors"
                          disabled={isLoading}
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {competitorUrls.length < 5 && (
                    <button
                      type="button"
                      onClick={addCompetitorField}
                      className="flex items-center text-color-1 hover:text-color-2 transition-colors text-sm"
                      disabled={isLoading}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Competitor
                    </button>
                  )}
                </div>


                {/* Debug Mode Toggle */}
                <div className="flex items-center justify-between p-4 bg-n-7 border border-n-6 rounded-lg">
                  <div>
                    <label htmlFor="debug" className="block text-sm font-medium text-n-2">
                      Debug Mode
                    </label>
                    <p className="text-xs text-n-4 mt-1">
                      Track processing steps and view detailed output
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDebugMode(!debugMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      debugMode ? 'bg-color-1' : 'bg-n-6'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        debugMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
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
                      Processing Analysis... (2-3 minutes)
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
                  Advanced AI analysis optimized for accuracy & speed
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-color-4/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="h-6 w-6 text-color-4" />
                </div>
                <h3 className="h6 text-n-1">Competitor Insights</h3>
                <p className="caption text-n-3 mt-1">
                  Compare up to 5 competitor websites
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-color-6/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="h-6 w-6 text-color-6" />
                </div>
                <h3 className="h6 text-n-1">Actionable Results</h3>
                <p className="caption text-n-3 mt-1">
                  Detailed personas and recommendations
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}