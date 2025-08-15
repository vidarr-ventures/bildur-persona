'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function IntegratedAnalyzePage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [competitorUrls, setCompetitorUrls] = useState(['', '', '']);
  const [keywords, setKeywords] = useState('');
  const [email, setEmail] = useState('');
  const [enableYouTube, setEnableYouTube] = useState(true);
  const [enableReddit, setEnableReddit] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<{
    step: string;
    dataSources: string[];
    dataPoints: number;
  } | null>(null);

  const validateUrl = (url: string): boolean => {
    if (!url) return true; // Empty URLs are OK for competitors
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
    setProgress(null);

    if (!url) {
      setError('Please enter your website URL');
      return;
    }

    if (!validateUrl(url)) {
      setError('Please enter a valid website URL');
      return;
    }

    // Validate competitor URLs
    const validCompetitors = competitorUrls.filter(u => u.trim() !== '');
    for (const compUrl of validCompetitors) {
      if (!validateUrl(compUrl)) {
        setError(`Invalid competitor URL: ${compUrl}`);
        return;
      }
    }

    if (!keywords.trim()) {
      setError('Please enter at least one keyword or phrase');
      return;
    }

    setIsLoading(true);

    try {
      // Normalize URLs
      const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
      const normalizedCompetitors = validCompetitors.map(u => 
        u.startsWith('http') ? u : `https://${u}`
      );
      
      // Parse keywords
      const keywordPhrases = keywords.split(',').map(k => k.trim()).filter(k => k);

      const response = await fetch('/api/v2/analysis/integrated', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUrl: normalizedUrl,
          competitorUrls: normalizedCompetitors,
          keywordPhrases,
          userEmail: email,
          enableYouTube,
          enableReddit,
          debugMode: false
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      // Show progress
      setProgress({
        step: 'Analysis started',
        dataSources: data.dataSources || [],
        dataPoints: data.totalDataPoints || 0
      });

      // Redirect to results page after a short delay
      setTimeout(() => {
        router.push(`/report/${data.analysisId}?integrated=true`);
      }, 2000);

    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start analysis');
      setIsLoading(false);
    }
  };

  const updateCompetitorUrl = (index: number, value: string) => {
    const newUrls = [...competitorUrls];
    newUrls[index] = value;
    setCompetitorUrls(newUrls);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
              Integrated Persona Analysis
            </h1>
            <p className="text-xl text-gray-300">
              Combine website data with social media insights from YouTube and Reddit
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Main Website */}
            <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
              <h2 className="text-2xl font-semibold mb-6 text-white">Your Website</h2>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourwebsite.com"
                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                disabled={isLoading}
              />
            </div>

            {/* Keywords */}
            <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
              <h2 className="text-2xl font-semibold mb-6 text-white">Target Keywords</h2>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="grounding sheets, earthing sheets, grounding for health"
                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                disabled={isLoading}
              />
              <p className="text-sm text-gray-400 mt-2">Separate multiple keywords with commas</p>
            </div>

            {/* Competitor URLs */}
            <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
              <h2 className="text-2xl font-semibold mb-6 text-white">Competitor Websites (Optional)</h2>
              <div className="space-y-3">
                {competitorUrls.map((compUrl, index) => (
                  <input
                    key={index}
                    type="text"
                    value={compUrl}
                    onChange={(e) => updateCompetitorUrl(index, e.target.value)}
                    placeholder={`https://competitor${index + 1}.com`}
                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    disabled={isLoading}
                  />
                ))}
              </div>
            </div>

            {/* Social Media Sources */}
            <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
              <h2 className="text-2xl font-semibold mb-6 text-white">Social Media Sources</h2>
              <div className="space-y-4">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={enableYouTube}
                    onChange={(e) => setEnableYouTube(e.target.checked)}
                    className="w-5 h-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    disabled={isLoading}
                  />
                  <span className="text-white">
                    <span className="font-semibold">YouTube Comments</span>
                    <span className="text-gray-400 ml-2">- Analyze comments from relevant videos</span>
                  </span>
                </label>
                
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={enableReddit}
                    onChange={(e) => setEnableReddit(e.target.checked)}
                    className="w-5 h-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    disabled={isLoading}
                  />
                  <span className="text-white">
                    <span className="font-semibold">Reddit Discussions</span>
                    <span className="text-gray-400 ml-2">- Analyze posts and comments from relevant subreddits</span>
                  </span>
                </label>
              </div>
            </div>

            {/* Email (Optional) */}
            <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
              <h2 className="text-2xl font-semibold mb-6 text-white">Email (Optional)</h2>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                disabled={isLoading}
              />
              <p className="text-sm text-gray-400 mt-2">Get notified when analysis is complete</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Progress */}
            {progress && (
              <div className="bg-green-900/50 border border-green-500 text-green-200 px-6 py-4 rounded-lg">
                <div className="font-semibold mb-2">{progress.step}</div>
                <div className="text-sm space-y-1">
                  <div>Data sources: {progress.dataSources.join(', ')}</div>
                  <div>Total data points collected: {progress.dataPoints}</div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-white transition-all ${
                isLoading
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analyzing all data sources...
                </span>
              ) : (
                'Generate Integrated Persona'
              )}
            </button>

            {/* Data Quality Notice */}
            <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
              <p className="text-blue-200 text-sm">
                <strong>Data Quality Requirement:</strong> The system needs at least 20 reviews/comments across all sources 
                for accurate persona generation. Enable multiple data sources for best results.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}