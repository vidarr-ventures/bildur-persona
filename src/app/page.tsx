'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, ArrowRight, Globe, MessageSquare, Brain } from 'lucide-react';

interface FormData {
  primaryProductUrl: string;
  amazonProductUrl: string;
  primaryKeywords: string;
  secondaryKeywords: string;
  additionalKeywords: string;
}

export default function Home() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    primaryProductUrl: '',
    amazonProductUrl: '',
    primaryKeywords: '',
    secondaryKeywords: '',
    additionalKeywords: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const targetKeywords = [
        formData.primaryKeywords,
        formData.secondaryKeywords,
        formData.additionalKeywords
      ].filter(keyword => keyword.trim() !== '').join(', ');

      const submitData = {
        primaryProductUrl: formData.primaryProductUrl,
        amazonProductUrl: formData.amazonProductUrl,
        targetKeywords: targetKeywords
      };

      const response = await fetch('/api/jobs/create-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/dashboard/${data.jobId}`);
      } else {
        setError(data.error || 'Failed to start analysis');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col">
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
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Website URL
                  </label>
                  <input
                    type="url"
                    required
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400"
                    value={formData.primaryProductUrl}
                    onChange={(e) => setFormData({...formData, primaryProductUrl: e.target.value})}
                    placeholder="https://yoursite.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Amazon Product URL (Optional)
                  </label>
                  <input
                    type="url"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400"
                    value={formData.amazonProductUrl}
                    onChange={(e) => setFormData({...formData, amazonProductUrl: e.target.value})}
                    placeholder="https://amazon.com/dp/..."
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Primary Keywords <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400"
                      value={formData.primaryKeywords}
                      onChange={(e) => setFormData({...formData, primaryKeywords: e.target.value})}
                      placeholder="grounding sheets"
                    />
                    <p className="text-xs text-gray-500 mt-1">Main product or topic keywords</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Secondary Keywords (Optional)
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400"
                      value={formData.secondaryKeywords}
                      onChange={(e) => setFormData({...formData, secondaryKeywords: e.target.value})}
                      placeholder="earthing mats"
                    />
                    <p className="text-xs text-gray-500 mt-1">Related or alternative terms</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Additional Keywords (Optional)
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400"
                      value={formData.additionalKeywords}
                      onChange={(e) => setFormData({...formData, additionalKeywords: e.target.value})}
                      placeholder="sleep improvement"
                    />
                    <p className="text-xs text-gray-500 mt-1">Broader problem or benefit keywords</p>
                  </div>
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
                      <span>Starting Analysis...</span>
                    </>
                  ) : (
                    <>
                      <span>Start Customer Research</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <p className="text-xs text-purple-300">
                  <strong>Tip:</strong> Use different keyword fields to capture various aspects - 
                  primary (main product), secondary (alternatives), additional (problems/benefits).
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
