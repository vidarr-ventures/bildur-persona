'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function Dashboard() {
  const params = useParams();
  const jobId = params.jobId as string;
  const [jobStatus, setJobStatus] = useState<any>(null);
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
          setError(data.error || 'Failed to fetch job status');
        }
      } catch (err) {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    };

    fetchJobStatus();
    
    // Poll for updates every 5 seconds if job is still pending
    const interval = setInterval(() => {
      if (jobStatus?.status === 'pending' || jobStatus?.status === 'processing') {
        fetchJobStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [jobId, jobStatus?.status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
          <div className="text-center">Loading job status...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
          <div className="text-center text-red-600">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Job Status Dashboard
        </h1>
        
        <div className="space-y-4">
          <div>
            <strong>Job ID:</strong> {jobStatus.id}
          </div>
          
          <div>
            <strong>Status:</strong> 
            <span className={`ml-2 px-2 py-1 rounded text-sm ${
              jobStatus.status === 'completed' ? 'bg-green-100 text-green-800' :
              jobStatus.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
              jobStatus.status === 'failed' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {jobStatus.status}
            </span>
          </div>
          
          <div>
            <strong>Progress:</strong> {jobStatus.progress}%
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${jobStatus.progress}%` }}
              ></div>
            </div>
          </div>
          
          <div>
            <strong>Created:</strong> {new Date(jobStatus.created_at).toLocaleString()}
          </div>
          
          {jobStatus.completed_at && (
            <div>
              <strong>Completed:</strong> {new Date(jobStatus.completed_at).toLocaleString()}
            </div>
          )}
          
          {jobStatus.error_message && (
            <div>
              <strong>Error:</strong> 
              <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-red-700">
                {jobStatus.error_message}
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-6 text-center">
          <a 
            href="/"
            className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
          >
            Create New Job
          </a>
        </div>
      </div>
    </div>
  );
}
