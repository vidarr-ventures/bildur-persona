'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface JobStatus {
  id: string;
  website_url: string;
  target_keywords: string;
  amazon_url?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

interface QueueStats {
  pending: number;
  processing: number;
  total: number;
}

export default function Dashboard({ params }: { params: Promise<{ jobId: string }> }) {
  const [job, setJob] = useState<JobStatus | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string>('');
  const router = useRouter();

  const fetchQueueStats = async () => {
    try {
      const response = await fetch('/api/queue/status');
      if (response.ok) {
        const data = await response.json();
        setQueueStats(data.queue);
      }
    } catch (err) {
      console.log('Could not fetch queue stats:', err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const resolvedParams = await params;
      setJobId(resolvedParams.jobId);
      
      const fetchJobStatus = async () => {
        try {
          const response = await fetch(`/api/jobs/status/${resolvedParams.jobId}`);
          if (!response.ok) {
            throw new Error('Failed to fetch job status');
          }
          const data = await response.json();
          setJob(data.job);
          
          // If job is completed, redirect to report
          if (data.job.status === 'completed') {
            setTimeout(() => {
              router.push(`/report/${resolvedParams.jobId}`);
            }, 2000);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'An error occurred');
        }
      };

      await Promise.all([fetchJobStatus(), fetchQueueStats()]);
      setLoading(false);

      // Poll for updates every 3 seconds
      const interval = setInterval(() => {
        fetchJobStatus();
        fetchQueueStats();
      }, 3000);

      return () => clearInterval(interval);
    };

    fetchData();
  }, [params, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading job status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Job not found</h1>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'processing': return 'text-blue-600 bg-blue-100';
      case 'completed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'processing': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '⚪';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Customer Persona Research
            </h1>
            <p className="text-gray-600">Job ID: {job.id}</p>
          </div>

          {/* Job Status */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-center mb-4">
              <span className="text-4xl mr-3">{getStatusIcon(job.status)}</span>
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(job.status)}`}>
                {job.status.toUpperCase()}
              </span>
            </div>
            
            <div className="text-center">
              {job.status === 'pending' && (
                <p className="text-gray-600">Your job is queued and will begin processing shortly...</p>
              )}
              {job.status === 'processing' && (
                <div>
                  <p className="text-gray-600 mb-2">Analyzing your customer data...</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                  </div>
                </div>
              )}
              {job.status === 'completed' && (
                <div>
                  <p className="text-green-600 font-medium mb-2">Analysis Complete!</p>
                  <p className="text-gray-600">Redirecting to your report...</p>
                </div>
              )}
              {job.status === 'failed' && (
                <div>
                  <p className="text-red-600 font-medium mb-2">Analysis Failed</p>
                  <p className="text-gray-600">Please try creating a new job or contact support.</p>
                </div>
              )}
            </div>
          </div>

          {/* Queue Status */}
          {queueStats && (
            <div className="bg-indigo-50 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Queue Status</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{queueStats.pending}</p>
                  <p className="text-sm text-gray-600">Pending</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{queueStats.processing}</p>
                  <p className="text-sm text-gray-600">Processing</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-indigo-600">{queueStats.total}</p>
                  <p className="text-sm text-gray-600">Total</p>
                </div>
              </div>
            </div>
          )}

          {/* Job Details */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Details</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Website URL</label>
                <p className="text-gray-900 break-all">{job.website_url}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Target Keywords</label>
                <p className="text-gray-900">{job.target_keywords}</p>
              </div>
              {job.amazon_url && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Amazon URL</label>
                  <p className="text-gray-900 break-all">{job.amazon_url}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Created</label>
                <p className="text-gray-900">{new Date(job.created_at).toLocaleString()}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Last Updated</label>
                <p className="text-gray-900">{new Date(job.updated_at).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t pt-6 flex justify-center space-x-4">
            <button
              onClick={() => window.location.reload()}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Refresh Status
            </button>
            
            {job.status === 'completed' && (
              <button
                onClick={() => router.push(`/report/${job.id}`)}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                View Report
              </button>
            )}
            
            {job.status === 'failed' && (
              <button
                onClick={() => router.push('/')}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Create New Job
              </button>
            )}
          </div>

          {/* Processing Steps Indicator */}
          {job.status === 'processing' && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Steps</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-500 rounded-full mr-3"></div>
                  <span className="text-gray-900">Website Analysis</span>
                  <span className="ml-auto text-green-600">✓ Complete</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-blue-500 rounded-full mr-3 animate-pulse"></div>
                  <span className="text-gray-900">Customer Voice Collection</span>
                  <span className="ml-auto text-blue-600">🔄 Processing</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-gray-300 rounded-full mr-3"></div>
                  <span className="text-gray-500">Competitor Analysis</span>
                  <span className="ml-auto text-gray-500">⏳ Pending</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-gray-300 rounded-full mr-3"></div>
                  <span className="text-gray-500">Psychological Profile Generation</span>
                  <span className="ml-auto text-gray-500">⏳ Pending</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
