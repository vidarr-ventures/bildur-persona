'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Clock, XCircle, AlertCircle, ExternalLink } from 'lucide-react';

interface JobStatus {
  id: string;
  status: string;
  progress: number;
  created_at: string;
  completed_at?: string;
  user_inputs?: any;
}

export default function DashboardPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const fetchJobStatus = async () => {
      try {
        const response = await fetch(`/api/jobs/status/${jobId}`);
        const data = await response.json();

        if (data.success) {
          setJobStatus(data.job);
        } else {
          setError('Failed to fetch job status');
        }
      } catch (err) {
        setError('Failed to load job data');
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchJobStatus();
    
    // Poll for updates every 5 seconds if job is processing
    const interval = setInterval(() => {
      if (jobStatus?.status === 'processing') {
        fetchJobStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [jobId, jobStatus?.status]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-8 w-8 text-green-400" />;
      case 'processing':
        return <Clock className="h-8 w-8 text-blue-400 animate-pulse" />;
      case 'failed':
        return <XCircle className="h-8 w-8 text-red-400" />;
      default:
        return <AlertCircle className="h-8 w-8 text-yellow-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'processing':
        return 'text-blue-400';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-yellow-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
              <p className="mt-4 text-gray-300">Loading dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !jobStatus) {
    return (
      <div className="min-h-screen bg-black py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <div className="text-red-400 text-xl font-semibold mb-4">Dashboard Not Available</div>
              <p className="text-gray-300 mb-6">{error}</p>
              <Link 
                href="/" 
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Create New Analysis
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              {getStatusIcon(jobStatus.status)}
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Analysis Dashboard
            </h1>
            <p className="text-gray-400">
              Job ID: {jobId}
            </p>
          </div>

          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-gray-800 border border-gray-700 p-6 rounded-lg">
              <h2 className="text-xl font-semibold text-white mb-4">Job Status</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Status</p>
                  <p className={`font-medium ${getStatusColor(jobStatus.status)}`}>
                    {jobStatus.status.charAt(0).toUpperCase() + jobStatus.status.slice(1)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Progress</p>
                  <p className="font-medium text-white">{jobStatus.progress}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Created</p>
                  <p className="font-medium text-white">{new Date(jobStatus.created_at).toLocaleString()}</p>
                </div>
                {jobStatus.completed_at && (
                  <div>
                    <p className="text-sm text-gray-400">Completed</p>
                    <p className="font-medium text-white">{new Date(jobStatus.completed_at).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Analysis Parameters */}
            {jobStatus.user_inputs && (
              <div className="bg-gray-800 border border-gray-700 p-6 rounded-lg">
                <h2 className="text-xl font-semibold text-white mb-4">Analysis Parameters</h2>
                <div className="space-y-3">
                  {jobStatus.user_inputs.primaryProductUrl && (
                    <div>
                      <p className="text-sm text-gray-400">Website URL</p>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-white break-all">{jobStatus.user_inputs.primaryProductUrl}</p>
                        <a 
                          href={jobStatus.user_inputs.primaryProductUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  )}
                  {jobStatus.user_inputs.amazonProductUrl && (
                    <div>
                      <p className="text-sm text-gray-400">Amazon Product URL</p>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-white break-all">{jobStatus.user_inputs.amazonProductUrl}</p>
                        <a 
                          href={jobStatus.user_inputs.amazonProductUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  )}
                  {jobStatus.user_inputs.targetKeywords && (
                    <div>
                      <p className="text-sm text-gray-400">Target Keywords</p>
                      <p className="font-medium text-white">{jobStatus.user_inputs.targetKeywords}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Processing Message */}
            {jobStatus.status === 'processing' && (
              <div className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Clock className="h-6 w-6 text-blue-400 animate-pulse" />
                  <div>
                    <h3 className="text-lg font-semibold text-blue-400">Analysis in Progress</h3>
                    <p className="text-blue-300">Your customer persona is being generated. This usually takes 2-5 minutes.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            {jobStatus.status === 'completed' && (
              <Link 
                href={`/report/${jobId}`}
                className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium text-center"
              >
                View Persona Report
              </Link>
            )}
            <Link 
              href="/"
              className="bg-gray-700 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors font-medium text-center"
            >
              Create New Analysis
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
