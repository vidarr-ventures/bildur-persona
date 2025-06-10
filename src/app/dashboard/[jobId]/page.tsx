'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

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
  }, [jobId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !jobStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="text-red-600 text-xl font-semibold mb-4">Dashboard Not Available</div>
              <p className="text-gray-600 mb-6">{error}</p>
              <Link 
                href="/" 
                className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition-colors"
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Analysis Dashboard
            </h1>
            <p className="text-gray-600">
              Job ID: {jobId}
            </p>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Job Status</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className={`font-medium ${
                    jobStatus.status === 'completed' ? 'text-green-600' :
                    jobStatus.status === 'processing' ? 'text-blue-600' :
                    jobStatus.status === 'failed' ? 'text-red-600' :
                    'text-yellow-600'
                  }`}>
                    {jobStatus.status.charAt(0).toUpperCase() + jobStatus.status.slice(1)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Progress</p>
                  <p className="font-medium">{jobStatus.progress}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Created</p>
                  <p className="font-medium">{new Date(jobStatus.created_at).toLocaleString()}</p>
                </div>
                {jobStatus.completed_at && (
                  <div>
                    <p className="text-sm text-gray-600">Completed</p>
                    <p className="font-medium">{new Date(jobStatus.completed_at).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>

            {jobStatus.user_inputs && (
              <div className="bg-gray-50 p-6 rounded-lg">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Analysis Parameters</h2>
                <div className="space-y-2">
                  {jobStatus.user_inputs.primaryProductUrl && (
                    <div>
                      <p className="text-sm text-gray-600">Website URL</p>
                      <p className="font-medium break-all">{jobStatus.user_inputs.primaryProductUrl}</p>
                    </div>
                  )}
                  {jobStatus.user_inputs.amazonProductUrl && (
                    <div>
                      <p className="text-sm text-gray-600">Amazon Product URL</p>
                      <p className="font-medium break-all">{jobStatus.user_inputs.amazonProductUrl}</p>
                    </div>
                  )}
                  {jobStatus.user_inputs.targetKeywords && (
                    <div>
                      <p className="text-sm text-gray-600">Target Keywords</p>
                      <p className="font-medium">{jobStatus.user_inputs.targetKeywords}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 text-center space-x-4">
            {jobStatus.status === 'completed' && (
              <Link 
                href={`/report/${jobId}`}
                className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition-colors"
              >
                View Report
              </Link>
            )}
            <Link 
              href="/"
              className="bg-gray-200 text-gray-800 px-6 py-2 rounded-md hover:bg-gray-300 transition-colors"
            >
              Create New Analysis
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
