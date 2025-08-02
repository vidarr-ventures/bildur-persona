'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Clock, Mail, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface PaymentStatus {
  success: boolean;
  jobId?: string;
  email?: string;
  planName?: string;
  isFree?: boolean;
  error?: string;
}

interface PersonaReport {
  content: string;
  status: string;
  dataQuality?: any;
}

interface WorkerStatus {
  worker: string;
  status: 'success' | 'failed' | 'error' | 'running';
  httpStatus: number;
  responseTime: number;
  message: string;
  details?: any;
}

interface JobStatusResponse {
  success: boolean;
  jobId: string;
  job?: any;
  researchRequest?: any;
  workers: WorkerStatus[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    errors: number;
  };
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const isFree = searchParams.get('free') === 'true';
  
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [personaReport, setPersonaReport] = useState<PersonaReport | null>(null);
  const [checkingReport, setCheckingReport] = useState(false);
  const [workerStatus, setWorkerStatus] = useState<JobStatusResponse | null>(null);
  const [checkingWorkers, setCheckingWorkers] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setStatus({ success: false, error: 'No session ID found' });
      setLoading(false);
      return;
    }

    const verifyPayment = async () => {
      try {
        const response = await fetch(`/api/payments/verify?session_id=${sessionId}&free=${isFree}`);
        const data = await response.json();
        setStatus(data);
      } catch (error) {
        console.error('Error verifying payment:', error);
        setStatus({ success: false, error: 'Failed to verify payment' });
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [sessionId, isFree]);

  // Check worker status and persona report
  useEffect(() => {
    if (!status?.jobId) return;

    const checkWorkerStatus = async () => {
      setCheckingWorkers(true);
      try {
        const response = await fetch(`/api/jobs/${status.jobId}/status`);
        if (response.ok) {
          const data = await response.json();
          setWorkerStatus(data);
          
          // Check if persona generator succeeded and get the report
          const personaWorker = data.workers?.find((w: WorkerStatus) => w.worker === 'persona-generator');
          if (personaWorker?.status === 'success') {
            // Try to get the persona report
            const personaResponse = await fetch(`/api/jobs/${status.jobId}/persona`);
            if (personaResponse.ok) {
              const personaData = await personaResponse.json();
              if (personaData.persona) {
                setPersonaReport({
                  content: personaData.persona,
                  status: 'completed',
                  dataQuality: personaData.dataQuality
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking worker status:', error);
      } finally {
        setCheckingWorkers(false);
      }
    };

    // Check immediately
    checkWorkerStatus();

    // Check every 10 seconds if no persona report yet
    const interval = setInterval(() => {
      if (!personaReport) {
        checkWorkerStatus();
      } else {
        clearInterval(interval);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [status?.jobId, personaReport]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold">Verifying your payment...</h2>
          <p className="text-gray-400 mt-2">This will only take a moment</p>
        </div>
      </div>
    );
  }

  if (!status || !status.success) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="max-w-md mx-auto text-center px-4">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-4">Payment Verification Failed</h1>
          <p className="text-gray-400 mb-6">
            {status?.error || 'We couldn\'t verify your payment. Please contact support.'}
          </p>
          <Link 
            href="/pricing"
            className="inline-flex items-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <span>Try Again</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Success Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-3xl font-bold mb-4">
            {isFree ? 'Free Analysis Started!' : 'Payment Successful!'}
          </h1>
          <p className="text-xl text-gray-300 mb-2">
            Your customer persona analysis is now processing
          </p>
          <p className="text-gray-400">
            Results will appear on this page as soon as they're ready
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Payment Confirmed</h3>
                <p className="text-sm text-gray-400">
                  {isFree ? 'Free access granted' : 'Transaction completed'}
                </p>
              </div>
            </div>
            <div className="text-sm text-gray-300">
              {status.planName && (
                <p><span className="text-gray-400">Plan:</span> {status.planName}</p>
              )}
              {sessionId && (
                <p className="truncate"><span className="text-gray-400">ID:</span> {sessionId}</p>
              )}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Analysis Started</h3>
                <p className="text-sm text-gray-400">Processing your data</p>
              </div>
            </div>
            <div className="text-sm text-gray-300">
              <p><span className="text-gray-400">Status:</span> In Progress</p>
              <p><span className="text-gray-400">ETA:</span> Real-time</p>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Results Display</h3>
                <p className="text-sm text-gray-400">Live results on this page</p>
              </div>
            </div>
            <div className="text-sm text-gray-300">
              <p><span className="text-gray-400">Format:</span> Live Display</p>
              <p><span className="text-gray-400">Delivery:</span> Immediate</p>
            </div>
          </div>
        </div>

        {/* Worker Status Display */}
        {workerStatus && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Analysis Progress</h2>
              <div className="flex items-center space-x-4">
                {checkingWorkers && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                )}
                <div className="text-sm text-gray-400">
                  {workerStatus.summary.successful}/{workerStatus.summary.total} workers completed
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workerStatus.workers.map((worker) => (
                <div
                  key={worker.worker}
                  className={`border rounded-lg p-4 ${
                    worker.status === 'success' ? 'border-green-500/30 bg-green-500/10' :
                    worker.status === 'failed' ? 'border-red-500/30 bg-red-500/10' :
                    worker.status === 'error' ? 'border-orange-500/30 bg-orange-500/10' :
                    'border-gray-600 bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white capitalize">
                      {worker.worker.replace('-', ' ')}
                    </h3>
                    <div className={`w-3 h-3 rounded-full ${
                      worker.status === 'success' ? 'bg-green-400' :
                      worker.status === 'failed' ? 'bg-red-400' :
                      worker.status === 'error' ? 'bg-orange-400' :
                      'bg-gray-400'
                    }`}></div>
                  </div>
                  <p className="text-sm text-gray-300 mb-2">{worker.message}</p>
                  <div className="text-xs text-gray-400 space-y-1">
                    <p>Status: {worker.httpStatus || 'N/A'}</p>
                    {worker.responseTime > 0 && (
                      <p>Time: {(worker.responseTime / 1000).toFixed(1)}s</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {workerStatus.summary.failed > 0 || workerStatus.summary.errors > 0 ? (
              <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-300 text-sm">
                  ⚠️ Some workers encountered issues, but the analysis may still complete. 
                  If the persona report doesn't appear after a few minutes, please contact support.
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* Persona Report Display */}
        {personaReport && (
          <div className="bg-gray-900 border border-purple-500/30 rounded-lg p-8 mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Your Customer Persona Report</h2>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-medium">Complete</span>
              </div>
            </div>
            <div className="prose prose-invert max-w-none">
              <div className="bg-black/50 rounded-lg p-6 overflow-auto max-h-[600px]">
                <pre className="whitespace-pre-wrap font-sans text-gray-300 text-sm leading-relaxed">
                  {personaReport.content}
                </pre>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => {
                  const blob = new Blob([personaReport.content], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `persona-report-${status?.jobId || 'report'}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Download Report</span>
              </button>
              {personaReport.dataQuality && (
                <div className="text-sm text-gray-400">
                  <span>Data Quality: </span>
                  <span className={`font-medium ${
                    personaReport.dataQuality.confidence === 'high' ? 'text-green-400' :
                    personaReport.dataQuality.confidence === 'medium' ? 'text-yellow-400' :
                    'text-orange-400'
                  }`}>
                    {personaReport.dataQuality.confidence}
                  </span>
                  <span className="ml-2">({personaReport.dataQuality.score}%)</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* What's Next - Show only if report not ready */}
        {!personaReport && (
          <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-center">What happens next?</h2>
          
          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-purple-400 font-bold text-sm">1</span>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2">Data Collection (3-5 minutes)</h3>
                <p className="text-gray-300 text-sm">
                  Our AI system is analyzing your website, extracting customer reviews, researching Reddit discussions, 
                  and gathering competitive intelligence from your specified competitors.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-purple-400 font-bold text-sm">2</span>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2">AI Analysis (3-5 minutes)</h3>
                <p className="text-gray-300 text-sm">
                  Advanced AI processes all collected data to identify customer pain points, preferences, 
                  demographics, and behavioral patterns to create detailed personas.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-purple-400 font-bold text-sm">3</span>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2">Report Generation & Delivery</h3>
                <p className="text-gray-300 text-sm">
                  Your comprehensive customer persona report will be generated and automatically 
                  sent to your email address. Check your inbox in 5-8 minutes!
                </p>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Action Buttons */}
        <div className="text-center mt-12 space-y-4">
          {status.jobId && (
            <Link
              href={`/dashboard/${status.jobId}`}
              className="inline-flex items-center space-x-2 bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              <span>View Progress</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          
          <div className="text-gray-400 text-sm">
            <p>Questions? Contact us at support@bildur.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold">Loading...</h2>
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}