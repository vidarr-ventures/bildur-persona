'use client';

import { useState } from 'react';

export default function YouTubeTestPage() {
  const [keywords, setKeywords] = useState('customer service problems, frustrated with software, small business challenges');
  const [totalLimit, setTotalLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const testYouTubeAPI = async () => {
    setLoading(true);
    setError('');
    setResponse(null);
    
    try {
      console.log('Testing YouTube API...');
      
      // Convert keywords string to array
      const keywordArray = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
      
      const res = await fetch('/api/test-youtube', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          keywords: keywordArray,
          totalLimit: totalLimit
        }),
      });
      
      console.log('Response status:', res.status);
      
      const data = await res.json();
      console.log('Response data:', data);
      
      setResponse(data);
      
      if (!data.success) {
        setError(data.error?.message || 'YouTube API test failed');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to test YouTube API');
    } finally {
      setLoading(false);
    }
  };

  const formatQuote = (quote: any) => {
    return (
      <div key={quote.quote_text} className="border-l-4 border-blue-500 pl-4 mb-4">
        <p className="text-gray-800 italic">"{quote.quote_text}"</p>
        <div className="text-sm text-gray-600 mt-2">
          <span className="font-semibold">Emotion:</span> {quote.emotion_type} 
          <span className="mx-2">•</span>
          <span className="font-semibold">Intensity:</span> {(quote.emotional_intensity * 100).toFixed(0)}%
          <span className="mx-2">•</span>
          <span className="font-semibold">Marketing Potential:</span> {quote.marketing_potential}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          <span className="font-semibold">Trigger:</span> {quote.psychological_trigger}
          <span className="mx-2">•</span>
          <span className="font-semibold">By:</span> {quote.commenter}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">YouTube Comment Scraper Test</h1>
        
        {/* Input Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Keywords (comma-separated)
              </label>
              <textarea
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="Enter keywords separated by commas"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                rows={3}
                disabled={loading}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Comment Limit
              </label>
              <input
                type="number"
                value={totalLimit}
                onChange={(e) => setTotalLimit(parseInt(e.target.value) || 20)}
                min={5}
                max={50}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                disabled={loading}
              />
            </div>
            
            <button
              onClick={testYouTubeAPI}
              disabled={loading || !keywords.trim()}
              className={`px-6 py-2 rounded-lg font-medium text-white transition-colors ${
                loading || !keywords.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
              }`}
            >
              {loading ? 'Scraping YouTube Comments...' : 'Test YouTube API'}
            </button>
          </div>
          
          {loading && (
            <div className="mt-4 text-gray-600">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Scraping YouTube comments... This may take 30-60 seconds.</span>
              </div>
              <div className="text-sm text-gray-500 mt-2">
                Note: This uses the real YouTube Data API v3 and will consume API quota.
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h2 className="text-red-800 font-semibold mb-2">Error Details</h2>
            <p className="text-red-600 font-mono text-sm whitespace-pre-wrap">{error}</p>
          </div>
        )}

        {/* Success Response Display */}
        {response && response.success && (
          <>
            {/* Summary Stats */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">YouTube Scraping Results</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {response.data?.total_comments || 0}
                  </div>
                  <div className="text-sm text-gray-600">Comments Found</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {response.data?.emotional_quotes?.length || 0}
                  </div>
                  <div className="text-sm text-gray-600">Emotional Quotes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {response.data?.data_quality?.high_potential_quotes || 0}
                  </div>
                  <div className="text-sm text-gray-600">High Potential</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {response.data?.data_quality?.api_quota_used || 0}
                  </div>
                  <div className="text-sm text-gray-600">API Quota Used</div>
                </div>
              </div>
            </div>

            {/* Emotional Quotes Display */}
            {response.data?.emotional_quotes && response.data.emotional_quotes.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Emotionally Resonant Quotes</h2>
                <div className="space-y-4">
                  {response.data.emotional_quotes.map((quote: any, index: number) => 
                    formatQuote(quote)
                  )}
                </div>
              </div>
            )}

            {/* Sample Comments */}
            {response.data?.comments && response.data.comments.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Sample Comments (First 5)</h2>
                <div className="space-y-4">
                  {response.data.comments.map((comment: any, index: number) => (
                    <div key={comment.comment_id} className="border border-gray-200 rounded p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-blue-600">{comment.commenter}</span>
                        <span className="text-sm text-gray-500">
                          {comment.likes} likes • {comment.replies} replies
                        </span>
                      </div>
                      <p className="text-gray-800 mb-2">{comment.text}</p>
                      <div className="text-xs text-gray-500">
                        <span className="font-semibold">Video:</span> {comment.video_title}
                        <span className="mx-2">•</span>
                        <span className="font-semibold">Keyword:</span> {comment.keyword_phrase}
                        <span className="mx-2">•</span>
                        <span className="font-semibold">Relevance:</span> {(comment.relevance_score * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw Data */}
            <details className="bg-white rounded-lg shadow p-6">
              <summary className="cursor-pointer font-semibold text-lg mb-2">
                Raw API Response (Debug)
              </summary>
              <div className="mt-4 border border-gray-300 rounded-lg p-4 bg-gray-50">
                <pre className="text-xs font-mono overflow-auto max-h-96">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            </details>
          </>
        )}

        {/* Failed Response */}
        {response && !response.success && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-red-600 mb-4">API Error</h2>
            <pre className="text-sm font-mono text-red-800 whitespace-pre-wrap">
              {JSON.stringify(response, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}