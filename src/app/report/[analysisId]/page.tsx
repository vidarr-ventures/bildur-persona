'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Button from '@/components/brainwave/Button';
import Section from '@/components/brainwave/Section';
import { Loader2, Download, RefreshCw, CheckCircle, XCircle, Clock, Globe, Quote } from 'lucide-react';

interface PersonaAnalysis {
  analysis_id: string;
  user_url: string;
  structured_data: any;
  raw_quotes: any[];
  persona_report?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  currentStep?: string;
  completedSteps?: number;
  totalSteps?: number;
}

export default function ReportPage() {
  const params = useParams();
  const analysisId = params.analysisId as string;
  
  const [analysis, setAnalysis] = useState<PersonaAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('report');

  const fetchAnalysis = async () => {
    try {
      // First get the analysis status
      const statusResponse = await fetch(`/api/v2/analysis/${analysisId}`);
      const statusData = await statusResponse.json();

      if (!statusResponse.ok) {
        throw new Error(statusData.error?.message || 'Failed to fetch analysis');
      }

      const progress = statusData.data;
      
      // If completed, fetch the report
      if (progress.status === 'COMPLETED') {
        const reportResponse = await fetch(`/api/v2/analysis/${analysisId}/report`);
        const reportData = await reportResponse.json();
        
        if (reportResponse.ok && reportData.success) {
          const report = reportData.data;
          setAnalysis({
            analysis_id: report.analysisId,
            user_url: 'N/A', // Not available in V2 response
            structured_data: report.personaData,
            raw_quotes: report.quotes,
            persona_report: report.fullReport,
            status: 'completed',
            created_at: report.generatedAt,
          });
        } else {
          // Show progress even if report not ready
          setAnalysis({
            analysis_id: analysisId,
            user_url: 'N/A',
            structured_data: {},
            raw_quotes: [],
            persona_report: undefined,
            status: progress.status.toLowerCase(),
            created_at: new Date().toISOString(),
            currentStep: progress.currentStep,
            completedSteps: progress.completedSteps,
            totalSteps: progress.totalSteps,
          });
        }
      } else {
        // Show progress for processing/pending
        setAnalysis({
          analysis_id: analysisId,
          user_url: 'N/A',
          structured_data: {},
          raw_quotes: [],
          persona_report: undefined,
          status: progress.status.toLowerCase(),
          created_at: new Date().toISOString(),
          currentStep: progress.currentStep,
          completedSteps: progress.completedSteps,
          totalSteps: progress.totalSteps,
        });
      }

      setError('');

      // Poll if still processing
      if (progress.status === 'PENDING' || progress.status === 'PROCESSING') {
        setTimeout(fetchAnalysis, 3000); // Poll every 3 seconds
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analysis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (analysisId) {
      fetchAnalysis();
    }
  }, [analysisId]);

  const downloadReport = () => {
    if (!analysis?.persona_report) return;

    const blob = new Blob([analysis.persona_report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `persona-report-${analysisId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading && !analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-n-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-color-1" />
          <p className="body-2 text-n-2">Loading analysis...</p>
        </div>
      </div>
    );
  }

  if (error && !analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-n-8">
        <div className="max-w-md bg-color-3/10 border border-color-3 rounded-lg p-6">
          <h3 className="h6 text-color-3 mb-2">Error</h3>
          <p className="body-2 text-n-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  const getStatusIcon = () => {
    switch (analysis.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-color-4" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-color-3" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-color-1" />;
      default:
        return <Clock className="h-5 w-5 text-n-3" />;
    }
  };

  const getStatusColor = () => {
    switch (analysis.status) {
      case 'completed':
        return 'bg-color-4/20 text-color-4';
      case 'failed':
        return 'bg-color-3/20 text-color-3';
      case 'processing':
        return 'bg-color-1/20 text-color-1';
      default:
        return 'bg-n-6/20 text-n-3';
    }
  };

  return (
    <div className="min-h-screen bg-n-8">
      <Section className="px-4 py-8">
        <div className="container">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h1 className="h2 text-n-1">Persona Analysis Report</h1>
              <div className="flex items-center gap-4">
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}>
                  <span className="flex items-center gap-1">
                    {getStatusIcon()}
                    {analysis.status.charAt(0).toUpperCase() + analysis.status.slice(1)}
                  </span>
                </div>
                {analysis.status === 'processing' && (
                  <Button onClick={fetchAnalysis} className="!px-4 !py-2">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                )}
                {analysis.status === 'completed' && (
                  <Button onClick={downloadReport} className="!px-4 !py-2">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-n-3">
              <Globe className="h-4 w-4" />
              <a href={analysis.user_url} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-color-1 transition-colors">
                {analysis.user_url}
              </a>
            </div>
            <p className="caption text-n-4 mt-1">
              Created: {new Date(analysis.created_at).toLocaleString()}
            </p>
          </div>

          {/* Processing State */}
          {(analysis.status === 'pending' || analysis.status === 'processing') && (
            <div className="bg-n-7 border border-n-6 rounded-xl p-12 mb-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-color-1 mx-auto mb-4"></div>
                <h2 className="h4 text-n-1 mb-2">
                  {analysis.currentStep || 'Analyzing Website...'}
                </h2>
                <p className="body-2 text-n-2">
                  Our AI is analyzing the website content and generating your persona report.
                </p>
                {analysis.completedSteps !== undefined && analysis.totalSteps && (
                  <div className="mt-4">
                    <div className="flex justify-between caption text-n-4 mb-2">
                      <span>Progress</span>
                      <span>{analysis.completedSteps} of {analysis.totalSteps} steps</span>
                    </div>
                    <div className="w-full bg-n-6 rounded-full h-2">
                      <div 
                        className="bg-color-1 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(analysis.completedSteps / analysis.totalSteps) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                <p className="caption text-n-4 mt-2">
                  This usually takes 1-2 minutes.
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {analysis.status === 'failed' && (
            <div className="bg-color-3/10 border border-color-3 rounded-lg p-6 mb-8">
              <h3 className="h6 text-color-3 mb-2">Analysis Failed</h3>
              <p className="body-2 text-n-2">
                {analysis.error_message || 'An error occurred during analysis. Please try again.'}
              </p>
            </div>
          )}

          {/* Completed State */}
          {analysis.status === 'completed' && (
            <div className="space-y-4">
              {/* Custom Tab Navigation */}
              <div className="flex w-full bg-n-7 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('report')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'report'
                      ? 'bg-color-1 text-n-8'
                      : 'text-n-3 hover:text-n-1'
                  }`}
                >
                  Persona Report
                </button>
                <button
                  onClick={() => setActiveTab('insights')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'insights'
                      ? 'bg-color-1 text-n-8'
                      : 'text-n-3 hover:text-n-1'
                  }`}
                >
                  Structured Insights
                </button>
                <button
                  onClick={() => setActiveTab('quotes')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'quotes'
                      ? 'bg-color-1 text-n-8'
                      : 'text-n-3 hover:text-n-1'
                  }`}
                >
                  Raw Quotes
                </button>
              </div>

              {/* Persona Report Tab */}
              {activeTab === 'report' && (
                <div className="bg-n-7 border border-n-6 rounded-xl">
                  <div className="p-6 border-b border-n-6">
                    <h2 className="h4 text-n-1 mb-2">Customer Persona Report</h2>
                    <p className="body-2 text-n-3">
                      Comprehensive analysis of your target customer
                    </p>
                  </div>
                  <div className="p-6">
                    <div className="max-w-none">
                      {analysis.persona_report ? (
                        <pre className="whitespace-pre-wrap text-n-1 body-2 leading-relaxed">
                          {analysis.persona_report}
                        </pre>
                      ) : (
                        <p className="text-n-4">No report available yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Structured Insights Tab */}
              {activeTab === 'insights' && (
                <div className="bg-n-7 border border-n-6 rounded-xl">
                  <div className="p-6 border-b border-n-6">
                    <h2 className="h4 text-n-1 mb-2">Structured Customer Insights</h2>
                    <p className="body-2 text-n-3">
                      Organized data extracted from the website
                    </p>
                  </div>
                  <div className="p-6">
                    <div className="space-y-6">
                      {/* Demographics */}
                      {analysis.structured_data?.demographics && (
                        <div>
                          <h3 className="h6 text-n-1 mb-3">Demographics</h3>
                          <div className="grid grid-cols-2 gap-4">
                            {Object.entries(analysis.structured_data.demographics).map(([key, value]) => 
                              value ? (
                                <div key={key} className="bg-n-6 p-3 rounded-lg">
                                  <p className="caption text-n-3 capitalize">
                                    {key.replace('_', ' ')}
                                  </p>
                                  <p className="body-2 text-n-1 font-medium">{value as string}</p>
                                </div>
                              ) : null
                            )}
                          </div>
                        </div>
                      )}

                      {/* Pain Points */}
                      {analysis.structured_data?.pain_points?.length > 0 && (
                        <div>
                          <h3 className="h6 text-n-1 mb-3">Pain Points</h3>
                          <ul className="space-y-2">
                            {analysis.structured_data.pain_points.map((point: string, idx: number) => (
                              <li key={idx} className="flex items-start">
                                <span className="text-color-3 mr-2">•</span>
                                <span className="body-2 text-n-2">{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Motivations */}
                      {analysis.structured_data?.motivations?.length > 0 && (
                        <div>
                          <h3 className="h6 text-n-1 mb-3">Motivations</h3>
                          <ul className="space-y-2">
                            {analysis.structured_data.motivations.map((motivation: string, idx: number) => (
                              <li key={idx} className="flex items-start">
                                <span className="text-color-4 mr-2">•</span>
                                <span className="body-2 text-n-2">{motivation}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Other Arrays */}
                      {['behaviors', 'preferred_channels', 'values', 'objections', 'decision_factors'].map(key => (
                        analysis.structured_data?.[key]?.length > 0 && (
                          <div key={key}>
                            <h3 className="h6 text-n-1 mb-3 capitalize">
                              {key.replace('_', ' ')}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {analysis.structured_data[key].map((item: string, idx: number) => (
                                <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-n-6 text-n-2">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Raw Quotes Tab */}
              {activeTab === 'quotes' && (
                <div className="bg-n-7 border border-n-6 rounded-xl">
                  <div className="p-6 border-b border-n-6">
                    <h2 className="h4 text-n-1 mb-2">Customer Quotes & Testimonials</h2>
                    <p className="body-2 text-n-3">
                      Verbatim quotes extracted from the website
                    </p>
                  </div>
                  <div className="p-6">
                    {analysis.raw_quotes?.length > 0 ? (
                      <div className="space-y-4">
                        {analysis.raw_quotes.map((quote: any, idx: number) => (
                          <div key={idx} className="border-l-4 border-color-1 pl-4 py-2">
                            <div className="flex items-start mb-2">
                              <Quote className="h-4 w-4 text-n-4 mr-2 mt-1" />
                              <p className="italic text-n-2 body-2">{quote.quote}</p>
                            </div>
                            <div className="caption text-n-4 space-y-1">
                              <p><strong>Source:</strong> {quote.source}</p>
                              <p><strong>Context:</strong> {quote.context}</p>
                              {quote.relevance && (
                                <p><strong>Relevance:</strong> {quote.relevance}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-n-4">No quotes extracted from the website.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}