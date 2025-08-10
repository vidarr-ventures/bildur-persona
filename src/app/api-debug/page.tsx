'use client';

import { useState } from 'react';

export default function APIDebugPage() {
  const [url, setUrl] = useState('https://stripe.com');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const testAPI = async () => {
    setLoading(true);
    setError('');
    setResponse(null);
    
    try {
      console.log('Testing API with URL:', url);
      
      const res = await fetch('/api/test-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetUrl: url }),
      });
      
      const data = await res.json();
      console.log('API Response:', data);
      
      setResponse(data);
      
      if (!data.success) {
        setError(data.error?.message || 'API returned an error');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  };

  const formatReport = (report: string) => {
    if (!report) return 'No report available';
    // Convert markdown to display better
    return report
      .split('\n')
      .map(line => line)
      .join('\n');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">API Debug Console</h1>
        
        {/* Input Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex gap-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter URL to analyze"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              onClick={testAPI}
              disabled={loading || !url}
              className={`px-6 py-2 rounded-lg font-medium text-white transition-colors ${
                loading || !url
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
              }`}
            >
              {loading ? 'Processing...' : 'Test API'}
            </button>
          </div>
          
          {loading && (
            <div className="mt-4 text-gray-600">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Generating persona report... This may take 30-60 seconds.</span>
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h2 className="text-red-800 font-semibold mb-2">Error</h2>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Response Display */}
        {response && response.success && (
          <>
            {/* Summary Stats */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Analysis Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {response.data?.scrapedContentLength?.toLocaleString() || 0}
                  </div>
                  <div className="text-sm text-gray-600">Characters Scraped</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {response.data?.extractedData?.painPointsCount || 0}
                  </div>
                  <div className="text-sm text-gray-600">Pain Points</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {response.data?.extractedData?.quotesCount || 0}
                  </div>
                  <div className="text-sm text-gray-600">Customer Quotes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {response.data?.finalReport ? response.data.finalReport.length.toLocaleString() : 0}
                  </div>
                  <div className="text-sm text-gray-600">Report Characters</div>
                </div>
              </div>
            </div>

            {/* Full Report Display */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Full Persona Report</h2>
                <div className="flex gap-2">
                  <span className="text-sm text-gray-500">
                    {response.data?.finalReport ? `${response.data.finalReport.length} characters` : 'No report'}
                  </span>
                  {response.data?.finalReport && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(response.data.finalReport);
                        alert('Report copied to clipboard!');
                      }}
                      className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                    >
                      Copy Report
                    </button>
                  )}
                </div>
              </div>
              
              {/* Report Content */}
              <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 overflow-auto max-h-[800px]">
                  {formatReport(response.data?.finalReport || '')}
                </pre>
              </div>
            </div>

            {/* Raw JSON Response (for debugging) */}
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