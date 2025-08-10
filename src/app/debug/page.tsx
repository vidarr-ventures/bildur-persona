'use client';

import { useState } from 'react';

export default function DebugPage() {
  const [url, setUrl] = useState('https://stripe.com');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testAPI = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetUrl: url }),
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ success: false, error: { message: error instanceof Error ? error.message : String(error) } });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Persona Generation Debug Console</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex gap-4 mb-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter URL to analyze"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={testAPI}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Processing...' : 'Test API'}
            </button>
          </div>
        </div>

        {result && (
          <div className="space-y-6">
            {/* Status */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Status</h2>
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {result.success ? 'SUCCESS' : 'ERROR'}
              </div>
            </div>

            {result.success ? (
              <>
                {/* Summary */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Analysis Summary</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {result.data.scrapedContentLength?.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">Characters Scraped</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {result.data.extractedData.painPointsCount}
                      </div>
                      <div className="text-sm text-gray-600">Pain Points</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {result.data.extractedData.quotesCount}
                      </div>
                      <div className="text-sm text-gray-600">Customer Quotes</div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {result.data.finalReport ? Math.ceil(result.data.finalReport.length / 1000) : 0}k
                      </div>
                      <div className="text-sm text-gray-600">Report Characters</div>
                    </div>
                  </div>
                </div>

                {/* Sample Data */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">Sample Pain Points</h2>
                    <div className="space-y-3">
                      {result.data.extractedData.samplePainPoints?.map((point: any, i: number) => (
                        <div key={i} className="border-l-4 border-red-400 pl-4">
                          <div className="font-medium">{point.pain}</div>
                          <div className="text-sm text-gray-600">Intensity: {point.emotional_intensity}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">Sample Customer Quotes</h2>
                    <div className="space-y-3">
                      {result.data.extractedData.sampleQuotes?.map((quote: any, i: number) => (
                        <div key={i} className="border-l-4 border-blue-400 pl-4">
                          <div className="italic">"{quote.quote}"</div>
                          <div className="text-sm text-gray-600 mt-1">
                            Emotion: {quote.emotion_type} | Context: {quote.context}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Debug Info */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4">Debug Information</h2>
                  <div className="space-y-2 text-sm font-mono">
                    <div>Has result.data: {result.data ? 'YES' : 'NO'}</div>
                    <div>Has finalReport key: {'finalReport' in (result.data || {}) ? 'YES' : 'NO'}</div>
                    <div>finalReport type: {typeof result.data?.finalReport}</div>
                    <div>finalReport length: {result.data?.finalReport?.length || 0}</div>
                    <div>Available keys: {JSON.stringify(Object.keys(result.data || {}))}</div>
                  </div>
                </div>

                {/* Full Final Report */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Complete Persona Report</h2>
                  <div className="relative">
                    <textarea
                      readOnly
                      value={result.data?.finalReport || 'No report generated'}
                      className="w-full h-96 p-4 border border-gray-300 rounded-lg font-mono text-sm leading-relaxed resize-y focus:ring-2 focus:ring-blue-500"
                      style={{ minHeight: '600px' }}
                      placeholder="Report will appear here after processing..."
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(result.data?.finalReport || '')}
                      className="absolute top-2 right-2 px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Error Display */
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-semibold mb-4 text-red-600">Error Details</h2>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <pre className="text-red-800 text-sm whitespace-pre-wrap">
                    {JSON.stringify(result.error, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Generating persona report... This may take up to 2 minutes.</p>
          </div>
        )}
      </div>
    </div>
  );
}