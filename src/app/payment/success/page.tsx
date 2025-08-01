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

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const isFree = searchParams.get('free') === 'true';
  
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);

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
          {status.email && (
            <p className="text-gray-400">
              Results will be sent to <span className="text-purple-400 font-medium">{status.email}</span>
            </p>
          )}
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
              <p><span className="text-gray-400">ETA:</span> 10-15 minutes</p>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Email Delivery</h3>
                <p className="text-sm text-gray-400">Results via email</p>
              </div>
            </div>
            <div className="text-sm text-gray-300">
              <p><span className="text-gray-400">Format:</span> PDF Report</p>
              <p><span className="text-gray-400">Delivery:</span> Automatic</p>
            </div>
          </div>
        </div>

        {/* What's Next */}
        <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-center">What happens next?</h2>
          
          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-purple-400 font-bold text-sm">1</span>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2">Data Collection (5-10 minutes)</h3>
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
                  sent to your email address. Check your inbox in 10-15 minutes!
                </p>
              </div>
            </div>
          </div>
        </div>

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