'use client';

import { useState } from 'react';

export default function RedditTestPage() {
  const [keywords, setKeywords] = useState(['grounding sheets', 'earthing sheets', 'grounding for health']);
  const [totalLimit, setTotalLimit] = useState(25);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const testRedditAPI = async () => {
    setLoading(true);
    setError('');
    setResponse(null);
    
    try {
      console.log('Testing Reddit API with keywords:', keywords);
      
      const res = await fetch('/api/reddit-nodejs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          keywords: keywords.filter(k => k.trim().length > 0),
          totalLimit
        }),
      });
      
      console.log('Response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.log('Error response:', errorText);
        throw new Error(`HTTP ${res.status}: ${errorText.substring(0, 100)}`);
      }
      
      const data = await res.json();
      console.log('Parsed data:', data);
      setResponse(data);
      
      if (!data.success) {
        setError(data.error?.message || 'Reddit API returned an error');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch Reddit data');
    } finally {
      setLoading(false);
    }
  };

  const addKeyword = () => {
    setKeywords([...keywords, '']);
  };

  const removeKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  const updateKeyword = (index: number, value: string) => {
    const newKeywords = [...keywords];
    newKeywords[index] = value;
    setKeywords(newKeywords);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-orange-500 text-white p-3 rounded-lg">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reddit Discussion Scraper</h1>
            <p className="text-gray-600 mt-1">Node.js JSON API - Real Reddit data, no credentials required</p>
          </div>
        </div>
        
        {/* Input Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="space-y-6">
            {/* Keywords Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Search Keywords
                </label>
                <button
                  onClick={addKeyword}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  disabled={loading}
                >
                  + Add Keyword
                </button>
              </div>
              
              <div className="space-y-3">
                {keywords.map((keyword, index) => (
                  <div key={index} className="flex gap-3">
                    <input
                      type="text"
                      value={keyword}
                      onChange={(e) => updateKeyword(index, e.target.value)}
                      placeholder="e.g., customer service problems, software frustrations"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 bg-white"
                      disabled={loading}
                    />
                    {keywords.length > 1 && (
                      <button
                        onClick={() => removeKeyword(index)}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        disabled={loading}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="mt-3 text-sm text-gray-600">
                <strong>Examples:</strong> "grounding sheets", "earthing sheets", "grounding for health"
              </div>
            </div>

            {/* Total Limit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Results
              </label>
              <input
                type="number"
                value={totalLimit}
                onChange={(e) => setTotalLimit(parseInt(e.target.value) || 25)}
                min="5"
                max="100"
                className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 bg-white"
                disabled={loading}
              />
              <div className="mt-1 text-sm text-gray-600">
                Total posts and comments to collect (5-100)
              </div>
            </div>

            <button
              onClick={testRedditAPI}
              disabled={loading || keywords.filter(k => k.trim()).length === 0}
              className={`px-6 py-3 rounded-lg font-medium text-white transition-colors ${
                loading || keywords.filter(k => k.trim()).length === 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-orange-600 hover:bg-orange-700 cursor-pointer'
              }`}
            >
              {loading ? 'Searching Reddit...' : '🔍 Search Reddit Discussions'}
            </button>
          </div>
          
          {loading && (
            <div className="mt-4 text-gray-600">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                <span>Scraping Reddit discussions... This may take 15-30 seconds.</span>
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

        {/* Results Display */}
        {response && response.success && (
          <>
            {/* Summary Stats */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Reddit Scraping Results</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {response.data?.total_items || 0}
                  </div>
                  <div className="text-sm text-gray-600">Total Items</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {response.data?.data_quality?.posts_vs_comments?.posts || 0}
                  </div>
                  <div className="text-sm text-gray-600">Posts</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {response.data?.data_quality?.posts_vs_comments?.comments || 0}
                  </div>
                  <div className="text-sm text-gray-600">Comments</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {response.data?.data_quality?.subreddits_searched?.length || 0}
                  </div>
                  <div className="text-sm text-gray-600">Subreddits</div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <div className="text-sm text-gray-600 space-y-1">
                  <div><strong>Subreddits searched:</strong> {response.data?.data_quality?.subreddits_searched?.join(', ')}</div>
                  <div><strong>Average relevance score:</strong> {response.data?.data_quality?.avg_relevance_score}</div>
                  <div><strong>Scraping duration:</strong> {response.data?.data_quality?.scraping_duration_seconds}s</div>
                </div>
              </div>
            </div>

            {/* Sample Content */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Sample Discussion Content</h2>
              
              {response.data?.content?.map((item: any, index: number) => (
                <div key={index} className="border-b border-gray-200 pb-4 mb-4 last:border-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      item.content_type === 'post' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {item.content_type.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-600">r/{item.subreddit}</span>
                    <span className="text-sm text-gray-500">•</span>
                    <span className="text-sm text-gray-500">{item.username}</span>
                    <span className="text-sm text-gray-500">•</span>
                    <span className="text-sm text-gray-500">Score: {item.score}</span>
                  </div>
                  
                  {item.title && (
                    <h4 className="font-medium text-gray-900 mb-1">{item.title}</h4>
                  )}
                  
                  <p className="text-gray-700 text-sm mb-2">{item.text}</p>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Keyword: "{item.keyword_phrase}"</span>
                    <span>Relevance: {Math.round(item.relevance_score * 100)}%</span>
                    <span>{new Date(item.date).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Raw JSON Response */}
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
            <h2 className="text-xl font-semibold text-red-600 mb-4">Reddit API Error</h2>
            <pre className="text-sm font-mono text-red-800 whitespace-pre-wrap">
              {JSON.stringify(response, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}