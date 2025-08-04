'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertCircle, 
  ExternalLink, 
  Copy,
  Globe,
  ShoppingCart,
  MessageSquare,
  Youtube,
  User,
  TrendingUp
} from 'lucide-react';

interface DataSourceStatus {
  name: string;
  url?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'not_started';
  reviewsCollected?: number;
  extractionMethod?: string;
  processingTime?: number;
  statusCode?: number;
  errorMessage?: string;
  metadata?: any;
}

interface JobDebugData {
  jobId: string;
  cachedData?: any;
  dbData?: any;
  dataSources: {
    customerWebsite: DataSourceStatus;
    competitors: DataSourceStatus[];
    amazonReviews: DataSourceStatus;
    redditScraper: DataSourceStatus;
    youtubeComments: DataSourceStatus;
    personaGenerator: DataSourceStatus;
  };
  finalPersona?: string;
}

export default function DebugPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  const [debugData, setDebugData] = useState<JobDebugData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    const fetchDebugData = async () => {
      try {
        const response = await fetch(`/api/debug/job/${jobId}`);
        const data = await response.json();

        if (response.ok) {
          // Transform the raw debug data into our structured format
          const transformedData = transformDebugData(data);
          setDebugData(transformedData);
        } else {
          setError(data.error || 'Failed to fetch debug data');
        }
      } catch (err) {
        setError('Failed to load debug data');
        console.error('Debug fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDebugData();
    
    // Poll for updates every 3 seconds
    const interval = setInterval(fetchDebugData, 3000);
    return () => clearInterval(interval);
  }, [jobId]);

  const transformDebugData = (rawData: any): JobDebugData => {
    const cachedData = rawData.cachedData || {};
    const dbData = rawData.dbData || {};
    const dataSourceStatuses = rawData.dataSourceStatuses || {};
    
    // Extract competitor URLs from user inputs
    const competitorUrls = dbData.competitor_urls || [];
    const competitors: DataSourceStatus[] = competitorUrls.map((url: string, index: number) => ({
      name: `Competitor ${index + 1}`,
      url,
      status: 'not_started',
      reviewsCollected: 0,
      extractionMethod: 'Unknown'
    }));

    // Helper function to convert API status to our status format
    const convertStatus = (apiStatus: any): DataSourceStatus => ({
      name: apiStatus.name || 'Unknown',
      url: apiStatus.url,
      status: apiStatus.status || 'not_started',
      reviewsCollected: apiStatus.reviewsCollected || 0,
      extractionMethod: apiStatus.extractionMethod || 'Unknown',
      processingTime: apiStatus.processingTime,
      statusCode: apiStatus.statusCode,
      errorMessage: apiStatus.errorMessage,
      metadata: apiStatus.metadata
    });

    return {
      jobId: rawData.jobId,
      cachedData,
      dbData,
      dataSources: {
        customerWebsite: {
          name: 'Customer Website',
          url: dbData.website_url || cachedData.websiteUrl,
          status: dataSourceStatuses.website?.status || 'not_started',
          reviewsCollected: dataSourceStatuses.website?.reviewsCollected || 0,
          extractionMethod: dataSourceStatuses.website?.extractionMethod || 'Unknown',
          processingTime: dataSourceStatuses.website?.processingTime,
          statusCode: dataSourceStatuses.website?.statusCode,
          errorMessage: dataSourceStatuses.website?.errorMessage
        },
        competitors,
        amazonReviews: {
          name: 'Amazon Reviews',
          url: dbData.amazon_url || cachedData.amazonUrl,
          status: dataSourceStatuses.amazon?.status || 'not_started',
          reviewsCollected: dataSourceStatuses.amazon?.reviewsCollected || 0,
          extractionMethod: dataSourceStatuses.amazon?.extractionMethod || 'Unknown',
          processingTime: dataSourceStatuses.amazon?.processingTime,
          statusCode: dataSourceStatuses.amazon?.statusCode,
          errorMessage: dataSourceStatuses.amazon?.errorMessage
        },
        redditScraper: {
          name: 'Reddit Scraper',
          status: dataSourceStatuses.reddit?.status || 'not_started',
          reviewsCollected: dataSourceStatuses.reddit?.reviewsCollected || 0,
          extractionMethod: dataSourceStatuses.reddit?.extractionMethod || 'Unknown',
          processingTime: dataSourceStatuses.reddit?.processingTime,
          statusCode: dataSourceStatuses.reddit?.statusCode,
          errorMessage: dataSourceStatuses.reddit?.errorMessage
        },
        youtubeComments: {
          name: 'YouTube Comments',
          status: dataSourceStatuses.youtube?.status || 'not_started',
          reviewsCollected: dataSourceStatuses.youtube?.reviewsCollected || 0,
          extractionMethod: dataSourceStatuses.youtube?.extractionMethod || 'Unknown',
          processingTime: dataSourceStatuses.youtube?.processingTime,
          statusCode: dataSourceStatuses.youtube?.statusCode,
          errorMessage: dataSourceStatuses.youtube?.errorMessage
        },
        personaGenerator: {
          name: 'Persona Generator',
          status: dataSourceStatuses.persona?.status || 'not_started',
          processingTime: dataSourceStatuses.persona?.processingTime,
          errorMessage: dataSourceStatuses.persona?.errorMessage
        }
      },
      finalPersona: dbData.persona_analysis || cachedData.persona || cachedData.finalPersona
    };
  };

  const formatMethod = (method: string): string => {
    const methodMap: { [key: string]: string } = {
      'shopify_scraper': 'Shopify API',
      'selenium_fallback': 'Selenium fallback',
      'firecrawl': 'Firecrawl',
      'basic_fetch': 'Basic HTTP',
      'amazon_api': 'Amazon API',
      'reddit_api': 'Reddit API',
      'youtube_api': 'YouTube API'
    };
    return methodMap[method] || method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getStatusIcon = (status: DataSourceStatus['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-6 w-6 text-green-400" />;
      case 'processing':
        return <Clock className="h-6 w-6 text-blue-400 animate-pulse" />;
      case 'failed':
        return <XCircle className="h-6 w-6 text-red-400" />;
      case 'pending':
        return <AlertCircle className="h-6 w-6 text-yellow-400" />;
      default:
        return <AlertCircle className="h-6 w-6 text-gray-400" />;
    }
  };

  const getStatusColor = (status: DataSourceStatus['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'processing':
        return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'failed':
        return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'pending':
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      default:
        return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const getSourceIcon = (sourceName: string) => {
    if (sourceName.includes('Website') || sourceName.includes('Competitor')) {
      return <Globe className="h-5 w-5" />;
    }
    if (sourceName.includes('Amazon')) {
      return <ShoppingCart className="h-5 w-5" />;
    }
    if (sourceName.includes('Reddit')) {
      return <MessageSquare className="h-5 w-5" />;
    }
    if (sourceName.includes('YouTube')) {
      return <Youtube className="h-5 w-5" />;
    }
    if (sourceName.includes('Persona')) {
      return <User className="h-5 w-5" />;
    }
    return <TrendingUp className="h-5 w-5" />;
  };

  const copyPersonaToClipboard = async () => {
    if (!debugData?.finalPersona) return;
    
    try {
      await navigator.clipboard.writeText(debugData.finalPersona);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy persona:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
              <p className="mt-4 text-gray-300">Loading debug data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !debugData) {
    return (
      <div className="min-h-screen bg-black py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <div className="text-red-400 text-xl font-semibold mb-4">Debug Data Not Available</div>
              <p className="text-gray-300 mb-6">{error}</p>
              <Link 
                href="/" 
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Go Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const DataSourceBox = ({ source }: { source: DataSourceStatus }) => (
    <div className={`border rounded-lg p-6 ${getStatusColor(source.status)}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {getSourceIcon(source.name)}
          <h3 className="text-lg font-semibold text-white">{source.name}</h3>
        </div>
        {getStatusIcon(source.status)}
      </div>
      
      {source.url && (
        <div className="mb-3">
          <p className="text-sm text-gray-400">URL</p>
          <div className="flex items-center space-x-2">
            <p className="font-mono text-sm text-white break-all">{source.url}</p>
            <a 
              href={source.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 flex-shrink-0"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-400">Status</p>
          <p className="font-medium text-white capitalize">{source.status.replace('_', ' ')}</p>
        </div>
        
        {source.reviewsCollected !== undefined && (
          <div>
            <p className="text-gray-400">Reviews</p>
            <p className="font-medium text-white">
              {source.reviewsCollected > 0 ? `${source.reviewsCollected} extracted` : 'No reviews found'}
            </p>
          </div>
        )}
        
        {source.extractionMethod && (
          <div>
            <p className="text-gray-400">Method</p>
            <p className="font-medium text-white">{source.extractionMethod}</p>
          </div>
        )}
        
        {source.processingTime && (
          <div>
            <p className="text-gray-400">Processing Time</p>
            <p className="font-medium text-white">{source.processingTime}ms</p>
          </div>
        )}
        
        {source.statusCode && (
          <div>
            <p className="text-gray-400">Status Code</p>
            <p className="font-medium text-white">{source.statusCode}</p>
          </div>
        )}
      </div>
      
      {source.errorMessage && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded">
          <p className="text-sm text-red-300">{source.errorMessage}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-black py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Debug Dashboard</h1>
          <p className="text-gray-400">Job ID: {jobId}</p>
        </div>

        {/* Data Sources Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Customer Website */}
          <DataSourceBox source={debugData.dataSources.customerWebsite} />
          
          {/* Competitors */}
          {debugData.dataSources.competitors.map((competitor, index) => (
            <DataSourceBox key={index} source={competitor} />
          ))}
          
          {/* Other Sources */}
          <DataSourceBox source={debugData.dataSources.amazonReviews} />
          <DataSourceBox source={debugData.dataSources.redditScraper} />
          <DataSourceBox source={debugData.dataSources.youtubeComments} />
          <DataSourceBox source={debugData.dataSources.personaGenerator} />
        </div>

        {/* Final Persona Output */}
        {debugData.finalPersona && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Generated Persona</span>
              </h2>
              <button
                onClick={copyPersonaToClipboard}
                className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Copy className="h-4 w-4" />
                <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded p-4 max-h-96 overflow-y-auto">
              <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                {debugData.finalPersona}
              </pre>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            href={`/dashboard/${jobId}`}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium text-center"
          >
            View Regular Dashboard
          </Link>
          <Link 
            href="/"
            className="bg-gray-700 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors font-medium text-center"
          >
            Create New Analysis
          </Link>
        </div>
      </div>
    </div>
  );
}