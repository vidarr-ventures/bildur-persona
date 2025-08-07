'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, XCircle, Clock, Loader2, ChevronDown, ChevronRight, Copy, Download } from 'lucide-react';
import Section from '@/components/brainwave/Section';
import Button from '@/components/brainwave/Button';

interface ProcessingStep {
  name: string;
  order: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  duration: string | null;
  startedAt: string | null;
  completedAt: string | null;
  hasError: boolean;
  error?: any;
  input?: any;
  output?: any;
  debug?: any;
}

interface DebugData {
  analysisId: string;
  status: string;
  totalDuration: string;
  errorCount: number;
  steps: ProcessingStep[];
  report?: {
    id: string;
    fullReport: string;
    summary: string;
    personaData: any;
    quotes: any[];
    insightCount: number;
    topQuotes: any[];
    reportValid: boolean;
  };
  errors: any[];
}

export default function DebugPage() {
  const params = useParams();
  const analysisId = params.analysisId as string;
  
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'steps' | 'report' | 'data'>('steps');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchDebugData = async () => {
    try {
      const response = await fetch(`/api/v2/debug/${analysisId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to fetch debug data');
      }

      setDebugData(result.data);
      setError('');

      // Stop auto-refresh if completed or failed
      if (result.data.status === 'COMPLETED' || result.data.status === 'FAILED') {
        setAutoRefresh(false);
      }
    } catch (err) {
      console.error('Debug fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load debug data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (analysisId) {
      fetchDebugData();
      
      // Auto-refresh every 2 seconds if enabled
      const interval = autoRefresh ? setInterval(fetchDebugData, 2000) : null;
      
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [analysisId, autoRefresh]);

  const toggleStep = (stepName: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepName)) {
      newExpanded.delete(stepName);
    } else {
      newExpanded.add(stepName);
    }
    setExpandedSteps(newExpanded);
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-color-4" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-color-3" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-color-1 animate-spin" />;
      case 'skipped':
        return <Clock className="h-5 w-5 text-n-4" />;
      default:
        return <Clock className="h-5 w-5 text-n-5" />;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadReport = () => {
    if (!debugData?.report) return;
    
    const blob = new Blob([debugData.report.fullReport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-report-${analysisId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadDebugData = () => {
    if (!debugData) return;
    
    const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-data-${analysisId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !debugData) {
    return (
      <div className="min-h-screen bg-n-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-color-1" />
          <p className="text-n-3">Loading debug data...</p>
        </div>
      </div>
    );
  }

  if (error && !debugData) {
    return (
      <div className="min-h-screen bg-n-8 flex items-center justify-center">
        <div className="bg-color-3/10 border border-color-3 rounded-lg p-6 max-w-md">
          <h3 className="h6 text-color-3 mb-2">Error</h3>
          <p className="text-n-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!debugData) return null;

  return (
    <div className="min-h-screen bg-n-8">
      <Section className="pt-[6rem] pb-[4rem]">
        <div className="container">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h1 className="h2 text-n-1">Debug Analysis</h1>
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-sm ${
                  debugData.status === 'COMPLETED' ? 'bg-color-4/20 text-color-4' :
                  debugData.status === 'FAILED' ? 'bg-color-3/20 text-color-3' :
                  debugData.status === 'PROCESSING' ? 'bg-color-1/20 text-color-1' :
                  'bg-n-6 text-n-3'
                }`}>
                  {debugData.status}
                </span>
                <Button onClick={downloadDebugData} className="!px-4 !py-2">
                  <Download className="h-4 w-4 mr-2" />
                  Export Debug Data
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-n-7 border border-n-6 rounded-lg p-4">
                <p className="caption text-n-4 mb-1">Analysis ID</p>
                <p className="body-2 text-n-1 font-mono text-xs">{debugData.analysisId}</p>
              </div>
              <div className="bg-n-7 border border-n-6 rounded-lg p-4">
                <p className="caption text-n-4 mb-1">Total Duration</p>
                <p className="body-2 text-n-1">{debugData.totalDuration}</p>
              </div>
              <div className="bg-n-7 border border-n-6 rounded-lg p-4">
                <p className="caption text-n-4 mb-1">Steps Completed</p>
                <p className="body-2 text-n-1">
                  {debugData.steps.filter(s => s.status === 'completed').length} / {debugData.steps.length}
                </p>
              </div>
              <div className="bg-n-7 border border-n-6 rounded-lg p-4">
                <p className="caption text-n-4 mb-1">Errors</p>
                <p className={`body-2 ${debugData.errorCount > 0 ? 'text-color-3' : 'text-color-4'}`}>
                  {debugData.errorCount}
                </p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('steps')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'steps'
                    ? 'bg-color-1 text-n-1'
                    : 'bg-n-7 text-n-3 hover:text-n-1'
                }`}
              >
                Processing Steps
              </button>
              <button
                onClick={() => setActiveTab('report')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'report'
                    ? 'bg-color-1 text-n-1'
                    : 'bg-n-7 text-n-3 hover:text-n-1'
                }`}
              >
                Final Report
              </button>
              <button
                onClick={() => setActiveTab('data')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'data'
                    ? 'bg-color-1 text-n-1'
                    : 'bg-n-7 text-n-3 hover:text-n-1'
                }`}
              >
                Raw Data
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'steps' && (
            <div className="space-y-4">
              {debugData.steps.map((step) => (
                <div key={step.name} className="bg-n-7 border border-n-6 rounded-lg">
                  <button
                    onClick={() => toggleStep(step.name)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-n-6/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getStepIcon(step.status)}
                      <span className="h6 text-n-1">{step.order}. {step.name.replace(/_/g, ' ')}</span>
                      {step.duration && (
                        <span className="caption text-n-4">({step.duration})</span>
                      )}
                    </div>
                    {expandedSteps.has(step.name) ? (
                      <ChevronDown className="h-5 w-5 text-n-4" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-n-4" />
                    )}
                  </button>
                  
                  {expandedSteps.has(step.name) && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="caption text-n-4 mb-1">Started At</p>
                          <p className="body-2 text-n-2 text-sm">
                            {step.startedAt ? new Date(step.startedAt).toLocaleString() : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="caption text-n-4 mb-1">Completed At</p>
                          <p className="body-2 text-n-2 text-sm">
                            {step.completedAt ? new Date(step.completedAt).toLocaleString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                      
                      {step.input && (
                        <div>
                          <p className="caption text-n-4 mb-1">Input</p>
                          <pre className="bg-n-8 border border-n-6 rounded p-2 text-xs text-n-2 overflow-x-auto">
                            {JSON.stringify(step.input, null, 2)}
                          </pre>
                        </div>
                      )}
                      
                      {step.output && (
                        <div>
                          <p className="caption text-n-4 mb-1">Output</p>
                          <pre className="bg-n-8 border border-n-6 rounded p-2 text-xs text-n-2 overflow-x-auto">
                            {JSON.stringify(step.output, null, 2)}
                          </pre>
                        </div>
                      )}
                      
                      {step.debug && (
                        <div>
                          <p className="caption text-n-4 mb-1">Debug Data</p>
                          <pre className="bg-n-8 border border-n-6 rounded p-2 text-xs text-n-2 overflow-x-auto">
                            {JSON.stringify(step.debug, null, 2)}
                          </pre>
                        </div>
                      )}
                      
                      {step.error && (
                        <div>
                          <p className="caption text-color-3 mb-1">Error</p>
                          <pre className="bg-color-3/10 border border-color-3/30 rounded p-2 text-xs text-color-3 overflow-x-auto">
                            {JSON.stringify(step.error, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'report' && (
            <div className="bg-n-7 border border-n-6 rounded-lg p-6">
              {debugData.report ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="h4 text-n-1">Generated Report</h3>
                    <div className="flex gap-2">
                      <Button onClick={() => copyToClipboard(debugData.report!.fullReport)} className="!px-3 !py-1">
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button onClick={downloadReport} className="!px-3 !py-1">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-n-8 border border-n-6 rounded p-3">
                      <p className="caption text-n-4 mb-1">Insight Count</p>
                      <p className="body-2 text-n-1">{debugData.report.insightCount}</p>
                    </div>
                    <div className="bg-n-8 border border-n-6 rounded p-3">
                      <p className="caption text-n-4 mb-1">Quote Count</p>
                      <p className="body-2 text-n-1">{debugData.report.quotes.length}</p>
                    </div>
                    <div className="bg-n-8 border border-n-6 rounded p-3">
                      <p className="caption text-n-4 mb-1">Report Valid</p>
                      <p className={`body-2 ${debugData.report.reportValid ? 'text-color-4' : 'text-color-3'}`}>
                        {debugData.report.reportValid ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="caption text-n-4 mb-2">Full Report Output</p>
                    <textarea
                      readOnly
                      value={debugData.report.fullReport}
                      className="w-full h-[600px] bg-n-8 border border-n-6 rounded-lg p-4 text-sm text-n-2 font-mono resize-none"
                    />
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-n-4">No report generated yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'data' && (
            <div className="bg-n-7 border border-n-6 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="h4 text-n-1">Raw Debug Data</h3>
                <Button onClick={() => copyToClipboard(JSON.stringify(debugData, null, 2))} className="!px-3 !py-1">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy JSON
                </Button>
              </div>
              
              <pre className="bg-n-8 border border-n-6 rounded-lg p-4 text-xs text-n-2 overflow-x-auto max-h-[600px]">
                {JSON.stringify(debugData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}