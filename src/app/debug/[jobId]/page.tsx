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
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Star,
  Target,
  Zap,
  Brain,
  Quote
} from 'lucide-react';

interface DataSourceStatus {
  name: string;
  url?: string;
  status: 'pending' | 'processing' | 'completed' | 'completed_no_data' | 'failed' | 'not_started';
  // Legacy metric for backward compatibility
  reviewsFound?: number;
  // AI-Powered Worker metrics
  dataReturned?: boolean;
  contentVolume?: string;
  // YouTube Worker metrics  
  commentsFound?: string;
  videosProcessed?: string;
  // Persona Generator metrics
  outputGenerated?: boolean;
  personaLength?: string;
  // Common metrics
  extractionMethod?: string;
  processingTime?: number | string;
  statusCode?: number;
  errorMessage?: string;
  metadata?: any;
  data?: OpenAIExtractedData;
}

interface OpenAIExtractedData {
  customerReviews: string[];
  testimonials: string[];
  valuePropositions: string[];
  features: string[];
  brandMessaging: string;
  painPointsAddressed: string[];
  dataQuality: {
    method: string;
    model?: string;
    tokensUsed?: number;
    contentLength: number;
  };
}

interface JobDebugData {
  jobId: string;
  cachedData?: any;
  jobResults?: any;
  dataSources: {
    customerWebsite: DataSourceStatus;
    competitors: DataSourceStatus[];
    amazonReviews?: DataSourceStatus; // Optional for MVP - hidden from UI
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
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [lastDataUpdate, setLastDataUpdate] = useState<string>('');

  useEffect(() => {
    if (!jobId) return;

    const fetchDebugData = async () => {
      try {
        const response = await fetch(`/api/debug/job/${jobId}`);
        const data = await response.json();

        if (response.ok) {
          const transformedData = transformDebugData(data);
          
          // Only update if data has actually changed to prevent UI flicker
          const dataChecksum = JSON.stringify({
            finalPersona: data.finalPersona,
            competitorCount: data.dataSourceStatuses?.competitors?.length || 0,
            websiteStatus: data.dataSourceStatuses?.website?.status,
            jobResults: Object.keys(data.jobResults || {}).length
          });
          
          if (dataChecksum !== lastDataUpdate) {
            setDebugData(transformedData);
            setLastDataUpdate(dataChecksum);
          }
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
    const jobResults = rawData.jobResults || {};
    const dataSourceStatuses = rawData.dataSourceStatuses || {};
    
    // Helper to extract OpenAI data from job results
    const getOpenAIData = (resultKey: string): OpenAIExtractedData | undefined => {
      const result = jobResults[resultKey];
      if (result?.success && result.data) {
        return result.data;
      }
      return undefined;
    };

    // Extract competitor data from dataSourceStatuses
    const competitorSources = dataSourceStatuses.competitors || [];
    
    return {
      jobId: rawData.jobId,
      cachedData,
      jobResults,
      dataSources: {
        customerWebsite: {
          name: 'Customer Website',
          url: cachedData.websiteUrl,
          status: dataSourceStatuses.website?.status || (jobResults.website?.hasActualData === true ? 'completed' : (jobResults.website?.hasActualData === false ? 'completed_no_data' : (jobResults.website?.success ? 'completed' : (jobResults.website ? 'failed' : 'not_started')))),
          dataReturned: dataSourceStatuses.website?.dataReturned ?? (jobResults.website?.hasActualData === true || jobResults.website?.success || false),
          contentVolume: dataSourceStatuses.website?.contentVolume || calculateWebsiteContentVolume(jobResults.website),
          extractionMethod: dataSourceStatuses.website?.extractionMethod || jobResults.website?.data?.dataQuality?.method || 'Unknown',
          processingTime: dataSourceStatuses.website?.processingTime || jobResults.website?.processingTime,
          statusCode: jobResults.website?.statusCode || 200,
          errorMessage: jobResults.website?.error,
          metadata: jobResults.website?.data?.dataQuality,
          data: getOpenAIData('website')
        },
        competitors: (() => {
          // Handle competitors with improved data structure consistency
          const competitors: any[] = [];
          
          // First priority: Use competitorSources from dataSourceStatuses if available
          if (competitorSources && competitorSources.length > 0) {
            competitorSources.forEach((competitor: any) => {
              competitors.push({
                name: competitor.name || `Competitor ${competitor.index + 1}`,
                url: competitor.url,
                status: competitor.status || 'not_started',
                dataReturned: competitor.dataReturned ?? false,
                contentVolume: competitor.contentVolume || 'No data',
                extractionMethod: competitor.extractionMethod || 'Website Crawler',
                processingTime: competitor.processingTime || 'Unknown',
                statusCode: competitor.statusCode || 200,
                errorMessage: competitor.errorMessage || null,
                metadata: competitor.metadata,
                data: getOpenAIData(`competitor_${competitor.index}`)
              });
            });
          }
          
          // Fallback: Generate competitor boxes from cached data or job results  
          if (competitors.length === 0 && cachedData?.competitorUrls && Array.isArray(cachedData.competitorUrls)) {
            cachedData.competitorUrls.forEach((url: string, index: number) => {
              const competitorKey = `competitor_${index}`;
              const competitorResult = jobResults?.[competitorKey];
              
              // Determine status more accurately
              let status = 'not_started';
              if (competitorResult) {
                if (competitorResult.error) {
                  status = 'failed';
                } else if (competitorResult.hasActualData === true) {
                  status = 'completed';
                } else if (competitorResult.hasActualData === false) {
                  status = 'completed_no_data';
                } else if (competitorResult.success) {
                  status = 'completed';
                }
              }
              
              competitors.push({
                name: `Competitor ${index + 1}`,
                url: url,
                status: status,
                dataReturned: competitorResult?.hasActualData === true || false,
                contentVolume: competitorResult ? calculateWebsiteContentVolume(competitorResult) : 'No data',
                extractionMethod: competitorResult?.data?.dataQuality?.method || 'Website Crawler',
                processingTime: competitorResult?.processingTime ? `${competitorResult.processingTime}ms` : 'Unknown',
                statusCode: competitorResult?.statusCode || (competitorResult?.success ? 200 : competitorResult?.error ? 500 : 200),
                errorMessage: competitorResult?.error || null,
                metadata: competitorResult?.data?.dataQuality,
                data: getOpenAIData(competitorKey)
              });
            });
          }
          
          // Always return an array, even if empty
          return competitors;
        })(),
        // Amazon Reviews hidden for MVP
        // amazonReviews: {
        //   name: 'Amazon Reviews',
        //   url: cachedData.amazonUrl,
        //   status: dataSourceStatuses.amazon?.status || 'not_started',
        //   dataReturned: dataSourceStatuses.amazon?.dataReturned,
        //   contentVolume: dataSourceStatuses.amazon?.contentVolume,
        //   extractionMethod: dataSourceStatuses.amazon?.extractionMethod || 'Unknown',
        //   processingTime: dataSourceStatuses.amazon?.processingTime,
        //   statusCode: dataSourceStatuses.amazon?.statusCode,
        //   errorMessage: dataSourceStatuses.amazon?.errorMessage
        // },
        redditScraper: {
          name: 'Reddit Scraper',
          status: dataSourceStatuses.reddit?.status || (jobResults.reddit?.hasActualData === true ? 'completed' : (jobResults.reddit?.hasActualData === false ? 'completed_no_data' : 'not_started')),
          dataReturned: dataSourceStatuses.reddit?.dataReturned ?? (jobResults.reddit?.hasActualData === true),
          contentVolume: dataSourceStatuses.reddit?.contentVolume || (jobResults.reddit ? `${jobResults.reddit.posts?.length || 0} posts` : 'No data'),
          extractionMethod: dataSourceStatuses.reddit?.extractionMethod || 'API + AI Analysis',
          processingTime: dataSourceStatuses.reddit?.processingTime,
          statusCode: dataSourceStatuses.reddit?.statusCode,
          errorMessage: dataSourceStatuses.reddit?.errorMessage
        },
        youtubeComments: {
          name: 'YouTube Comments',
          status: dataSourceStatuses.youtube?.status || (jobResults.youtube_comments?.hasActualData === true ? 'completed' : (jobResults.youtube_comments?.hasActualData === false ? 'completed_no_data' : (jobResults.youtube_comments?.success ? 'completed' : 'not_started'))),
          commentsFound: dataSourceStatuses.youtube?.commentsFound || (jobResults.youtube_comments?.comments ? `${jobResults.youtube_comments.comments.length} comments` : '0 comments'),
          videosProcessed: dataSourceStatuses.youtube?.videosProcessed || (jobResults.youtube_comments?.analysis?.topVideos ? `${jobResults.youtube_comments.analysis.topVideos.length} videos` : '0 videos'),
          extractionMethod: jobResults.youtube_comments?.metadata?.extractionMethod || dataSourceStatuses.youtube?.extractionMethod || 'youtube_api_v3',
          processingTime: dataSourceStatuses.youtube?.processingTime,
          statusCode: dataSourceStatuses.youtube?.statusCode,
          errorMessage: dataSourceStatuses.youtube?.errorMessage,
          metadata: {
            ...jobResults.youtube_comments?.metadata,
            keywordMetrics: jobResults.youtube_comments?.keywordMetrics,
            keywordSummary: jobResults.youtube_comments?.analysis?.keywordSummary
          }
        },
        personaGenerator: {
          name: 'Persona Generator',
          status: dataSourceStatuses.persona?.status || (jobResults.persona?.hasActualData === true ? 'completed' : (jobResults.persona?.hasActualData === false ? 'completed_no_data' : 'not_started')),
          outputGenerated: dataSourceStatuses.persona?.outputGenerated ?? (jobResults.persona?.hasActualData === true),
          personaLength: dataSourceStatuses.persona?.personaLength || (jobResults.persona?.persona ? `${jobResults.persona.persona.length} chars` : '0 chars'),
          processingTime: dataSourceStatuses.persona?.processingTime,
          errorMessage: dataSourceStatuses.persona?.errorMessage
        }
      },
      finalPersona: rawData.finalPersona || cachedData.persona
    };
  };

  const formatMethod = (method: string): string => {
    const methodMap: { [key: string]: string } = {
      'openai_extraction': 'OpenAI Analysis',
      'shopify_scraper': 'Shopify API',
      'custom_amazon_scraper': 'API + AI Analysis',
      'custom_reddit_scraper': 'API + AI Analysis',
      'selenium_fallback': 'Selenium fallback',
      'firecrawl': 'Firecrawl (Deprecated)',
      'basic_fetch': 'Basic HTTP (Deprecated)',
      'amazon_api': 'API + AI Analysis',
      'reddit_api': 'API + AI Analysis',
      'youtube_api': 'YouTube API',
      'youtube_api_v3': 'YouTube API',
      'reddit_api_v1_plus_openai': 'API + AI Analysis'
    };
    return methodMap[method] || method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const calculateWebsiteContentVolume = (websiteData: any): string => {
    if (!websiteData?.data) return 'No data';
    
    let totalWords = 0;
    
    // Count words in customer reviews
    if (websiteData.data.customerReviews) {
      totalWords += websiteData.data.customerReviews.reduce((acc: number, review: string) => 
        acc + review.split(' ').length, 0);
    }
    
    // Count words in page content  
    if (websiteData.data.pageContent) {
      totalWords += websiteData.data.pageContent.split(' ').length;
    }
    
    // Count words in features
    if (websiteData.data.features) {
      totalWords += websiteData.data.features.reduce((acc: number, feature: string) => 
        acc + feature.split(' ').length, 0);
    }
    
    // Count words in value propositions
    if (websiteData.data.valuePropositions) {
      totalWords += websiteData.data.valuePropositions.reduce((acc: number, value: string) => 
        acc + value.split(' ').length, 0);
    }
    
    if (totalWords === 0) return 'No data';
    if (totalWords < 1000) return `${totalWords} words`;
    return `${(totalWords / 1000).toFixed(1)}k words`;
  };

  const getStatusIcon = (status: DataSourceStatus['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-6 w-6 text-green-400" />;
      case 'completed_no_data':
        return <AlertCircle className="h-6 w-6 text-yellow-400" />;
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
      case 'completed_no_data':
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
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

  const toggleExpanded = (sourceName: string) => {
    const newExpanded = new Set(expandedSources);
    if (newExpanded.has(sourceName)) {
      newExpanded.delete(sourceName);
    } else {
      newExpanded.add(sourceName);
    }
    setExpandedSources(newExpanded);
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

  const DataSourceBox = ({ source }: { source: DataSourceStatus }) => {
    const isExpanded = expandedSources.has(source.name);
    const hasDetailedData = (
      (source.data && (
        source.data.customerReviews.length > 0 ||
        source.data.valuePropositions.length > 0 ||
        source.data.painPointsAddressed.length > 0
      )) ||
      (source.metadata?.keywordMetrics && source.metadata.keywordMetrics.length > 0)
    );

    return (
      <div className={`border rounded-lg p-6 ${getStatusColor(source.status)}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {getSourceIcon(source.name)}
            <h3 className="text-lg font-semibold text-white">{source.name}</h3>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusIcon(source.status)}
            {hasDetailedData && (
              <button
                onClick={() => toggleExpanded(source.name)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
            )}
          </div>
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
        
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <p className="text-gray-400">Status</p>
            <p className="font-medium text-white capitalize">
              {source.status === 'completed_no_data' ? 'Completed (No Data)' : source.status.replace('_', ' ')}
            </p>
          </div>
          
          {/* AI-Powered Workers: Show Data Returned and Content Volume */}
          {(source.name.includes('Website') || source.name.includes('Amazon') || source.name.includes('Reddit')) && source.dataReturned !== undefined && (
            <>
              <div>
                <p className="text-gray-400">Data Returned</p>
                <p className="font-medium text-white">
                  {source.dataReturned ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p className="text-gray-400">Content Volume</p>
                <p className="font-medium text-white">
                  {source.contentVolume || 'No data'}
                </p>
              </div>
            </>
          )}
          
          {/* YouTube Worker: Show Comments and Videos */}
          {source.name.includes('YouTube') && (
            <>
              <div>
                <p className="text-gray-400">Comments Found</p>
                <p className="font-medium text-white">
                  {source.commentsFound || '0 comments'}
                </p>
              </div>
              <div>
                <p className="text-gray-400">Videos Processed</p>
                <p className="font-medium text-white">
                  {source.videosProcessed || '0 videos'}
                </p>
              </div>
            </>
          )}
          
          {/* Persona Generator: Show Output Generated and Length */}
          {source.name.includes('Persona') && source.outputGenerated !== undefined && (
            <>
              <div>
                <p className="text-gray-400">Output Generated</p>
                <p className="font-medium text-white">
                  {source.outputGenerated ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p className="text-gray-400">Persona Length</p>
                <p className="font-medium text-white">
                  {source.personaLength || '0 words'}
                </p>
              </div>
            </>
          )}
          
          {/* Legacy: Show Reviews for backward compatibility */}
          {source.reviewsFound !== undefined && !source.dataReturned && !source.commentsFound && !source.outputGenerated && (
            <div>
              <p className="text-gray-400">Reviews</p>
              <p className="font-medium text-white">
                {source.reviewsFound > 0 ? `${source.reviewsFound} extracted` : 'No reviews found'}
              </p>
            </div>
          )}
          
          {source.extractionMethod && (
            <div>
              <p className="text-gray-400">Method</p>
              <p className="font-medium text-white">{formatMethod(source.extractionMethod)}</p>
            </div>
          )}
          
          {source.processingTime && (
            <div>
              <p className="text-gray-400">Processing Time</p>
              <p className="font-medium text-white">{source.processingTime}</p>
            </div>
          )}
          
          {source.metadata?.tokensUsed && (
            <div>
              <p className="text-gray-400">AI Tokens</p>
              <p className="font-medium text-white">{source.metadata.tokensUsed.toLocaleString()}</p>
            </div>
          )}
          
          {source.metadata?.keywordSummary && (
            <div>
              <p className="text-gray-400">Keywords</p>
              <p className="font-medium text-white">
                {source.metadata.keywordSummary.successfulKeywords}/{source.metadata.keywordSummary.totalKeywords} successful
              </p>
            </div>
          )}
        </div>

        {/* OpenAI Detailed Data Section */}
        {isExpanded && source.data && (
          <div className="border-t border-gray-600 pt-4 space-y-4">
            {/* Customer Reviews */}
            {source.data.customerReviews.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Quote className="h-4 w-4 text-blue-400" />
                  <h4 className="font-semibold text-white">Customer Reviews ({source.data.customerReviews.length})</h4>
                </div>
                <div className="space-y-2">
                  {source.data.customerReviews.map((review, index) => (
                    <div key={index} className="bg-gray-800 p-3 rounded text-sm">
                      <p className="text-gray-300 italic">"{review}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pain Points */}
            {source.data.painPointsAddressed.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Target className="h-4 w-4 text-red-400" />
                  <h4 className="font-semibold text-white">Pain Points Addressed ({source.data.painPointsAddressed.length})</h4>
                </div>
                <div className="space-y-1">
                  {source.data.painPointsAddressed.map((pain, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-300 text-sm">{pain}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Value Propositions */}
            {source.data.valuePropositions.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Star className="h-4 w-4 text-yellow-400" />
                  <h4 className="font-semibold text-white">Value Propositions ({source.data.valuePropositions.length})</h4>
                </div>
                <div className="space-y-1">
                  {source.data.valuePropositions.map((prop, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-300 text-sm">{prop}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Features */}
            {source.data.features.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Zap className="h-4 w-4 text-green-400" />
                  <h4 className="font-semibold text-white">Features ({source.data.features.length})</h4>
                </div>
                <div className="space-y-1">
                  {source.data.features.map((feature, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-300 text-sm">{feature}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Brand Messaging */}
            {source.data.brandMessaging && (
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Brain className="h-4 w-4 text-purple-400" />
                  <h4 className="font-semibold text-white">Brand Messaging</h4>
                </div>
                <div className="bg-purple-900/20 border border-purple-500/20 p-3 rounded">
                  <p className="text-purple-200 text-sm italic">"{source.data.brandMessaging}"</p>
                </div>
              </div>
            )}

            {/* Testimonials */}
            {source.data.testimonials.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <User className="h-4 w-4 text-blue-400" />
                  <h4 className="font-semibold text-white">Testimonials ({source.data.testimonials.length})</h4>
                </div>
                <div className="space-y-2">
                  {source.data.testimonials.map((testimonial, index) => (
                    <div key={index} className="bg-blue-900/20 border border-blue-500/20 p-3 rounded">
                      <p className="text-blue-200 text-sm">"{testimonial}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* YouTube Keyword Metrics */}
            {source.metadata?.keywordMetrics && source.metadata.keywordMetrics.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Youtube className="h-4 w-4 text-red-400" />
                  <h4 className="font-semibold text-white">Per-Keyword Breakdown ({source.metadata.keywordMetrics.length} keywords)</h4>
                </div>
                <div className="space-y-2">
                  {source.metadata.keywordMetrics.map((metric: any, index: number) => {
                    const statusIcon = metric.extractionStatus === 'success' ? '✅' : 
                                     metric.extractionStatus === 'partial' ? '⚠️' : 
                                     metric.extractionStatus === 'no_videos' ? '🚫' : '❌';
                    const statusColor = metric.extractionStatus === 'success' ? 'text-green-400' : 
                                      metric.extractionStatus === 'partial' ? 'text-yellow-400' : 
                                      'text-red-400';
                    return (
                      <div key={index} className="bg-gray-800 p-3 rounded">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">{statusIcon}</span>
                            <span className="font-medium text-white">"{metric.keyword}"</span>
                          </div>
                          <span className={`text-sm ${statusColor} capitalize`}>{metric.extractionStatus.replace('_', ' ')}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {metric.commentsExtracted} comments • {metric.videosProcessed}/{metric.videosFound} videos processed
                          {metric.topVideo && (
                            <div className="truncate mt-1">Top video: {metric.topVideo}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {source.metadata.keywordSummary && (
                  <div className="mt-3 p-3 bg-gray-800 rounded">
                    <h5 className="font-medium text-white mb-2">Summary</h5>
                    <div className="text-sm text-gray-300 space-y-1">
                      <div>Most productive: <span className="text-green-400">"{source.metadata.keywordSummary.mostProductiveKeyword}"</span></div>
                      <div>Success rate: <span className="text-blue-400">{source.metadata.keywordSummary.successfulKeywords}/{source.metadata.keywordSummary.totalKeywords}</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {source.errorMessage && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded">
            <p className="text-sm text-red-300">{source.errorMessage}</p>
          </div>
        )}
      </div>
    );
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

  return (
    <div className="min-h-screen bg-black py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Debug Dashboard</h1>
          <p className="text-gray-400">Job ID: {jobId}</p>
          <div className="mt-2 text-sm text-gray-500">
            Click the expand arrow to view detailed extracted data from data sources
          </div>
          {debugData && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="bg-gray-800 text-gray-300 px-2 py-1 rounded">
                Data Sources: {Object.keys(debugData.dataSources).length}
              </span>
              <span className="bg-gray-800 text-gray-300 px-2 py-1 rounded">
                Competitors: {debugData.dataSources.competitors?.length || 0}
              </span>
              <span className="bg-gray-800 text-gray-300 px-2 py-1 rounded">
                Last Updated: {new Date().toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>

        {/* Data Sources Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Customer Website */}
          <DataSourceBox source={debugData.dataSources.customerWebsite} />
          
          {/* Competitors - Always show boxes for better UX */}
          {debugData.dataSources.competitors && debugData.dataSources.competitors.length > 0 ? (
            debugData.dataSources.competitors.map((competitor, index) => (
              <DataSourceBox key={`competitor-${index}-${competitor.url}`} source={competitor} />
            ))
          ) : (
            // Show placeholder if no competitor data yet but cached URLs exist
            debugData.cachedData?.competitorUrls?.map((url: string, index: number) => (
              <DataSourceBox 
                key={`placeholder-competitor-${index}`} 
                source={{
                  name: `Competitor ${index + 1}`,
                  url: url,
                  status: 'not_started' as const,
                  dataReturned: false,
                  contentVolume: 'Pending analysis',
                  extractionMethod: 'Website Crawler',
                  processingTime: 'Not started',
                  statusCode: 200,
                  errorMessage: null
                }} 
              />
            )) || null
          )}
          
          {/* Other Sources */}
          {/* Amazon Reviews hidden for MVP */}
          {/* <DataSourceBox source={debugData.dataSources.amazonReviews} /> */}
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