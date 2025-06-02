'use client';

import { useState } from 'react';

export default function Home() {
  const [formData, setFormData] = useState({
    primaryProductUrl: '',
    amazonProductUrl: '',
    targetKeywords: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        console.log('Job created:', data.jobId);
      }
    } catch (error) {
      console.error('Error:', error);
      setResult({ error: 'Failed to submit form' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Customer Persona Research
        </h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Product URL
            </label>
            <input
              type="url"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.primaryProductUrl}
              onChange={(e) => setFormData({...formData, primaryProductUrl: e.target.value})}
              placeholder="https://yoursite.com/product"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amazon Product URL
            </label>
            <input
              type="url"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.amazonProductUrl}
              onChange={(e) => setFormData({...formData, amazonProductUrl: e.target.value})}
              placeholder="https://amazon.com/dp/..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Keywords (comma-separated)
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.targetKeywords}
              onChange={(e) => setFormData({...formData, targetKeywords: e.target.value})}
              placeholder="keyword1, keyword2, keyword3"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isSubmitting ? 'Creating Job...' : 'Start Research'}
          </button>
        </form>

        {result && (
          <div className="mt-6 p-4 rounded-md bg-gray-100">
            <pre className="text-sm">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
