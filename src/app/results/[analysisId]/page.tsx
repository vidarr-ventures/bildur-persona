'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Users, 
  TrendingUp, 
  Target, 
  MessageSquare, 
  Star, 
  Download, 
  Share,
  CheckCircle,
  Heart,
  Zap,
  Globe,
  ArrowRight,
  DollarSign,
  Calendar,
  MapPin,
  Loader2,
  AlertCircle
} from "lucide-react"

interface AnalysisData {
  id: string;
  analysisId: string;
  fullReport: string;
  summary: any;
  demographics: any;
  painPoints: any[];
  quotes: any[];
  valuePropositions: any[];
  behaviorPatterns: any[];
  generatedAt: string;
}

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const analysisId = params.analysisId as string;
  
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResults() {
      if (!analysisId) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/v2/analysis/${analysisId}/report`);
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error?.message || 'Failed to fetch results');
        }
        
        if (!result.success) {
          throw new Error(result.error?.message || 'Analysis not ready');
        }
        
        setData(result.data);
      } catch (err) {
        console.error('Error fetching results:', err);
        setError(err instanceof Error ? err.message : 'Failed to load results');
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, [analysisId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading your analysis results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">Analysis Not Ready</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <Button 
            onClick={() => router.push('/')}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Start New Analysis
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-lg">No analysis data found</p>
        </div>
      </div>
    );
  }

  // Extract summary information
  const summaryData = data.summary || {};
  const totalDataPoints = summaryData.totalDataPoints || summaryData.user_quotes || 0;
  const competitorsCount = summaryData.competitors?.length || 0;
  const dataSources = summaryData.dataSources || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 blur-3xl"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-emerald-500/10"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="mb-6 bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30 transition-all duration-300">
            <CheckCircle className="w-3 h-3 mr-1" />
            Analysis Complete
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight font-display">
            Your Customer{" "}
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              Insights
            </span>
          </h1>
          
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            We analyzed {totalDataPoints} data points {competitorsCount > 0 ? `and ${competitorsCount} competitor${competitorsCount > 1 ? 's' : ''}` : ''} to understand your audience better.
          </p>

          {/* Action buttons */}
          <div className="flex justify-center space-x-4 mb-8">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white">
              <Download className="w-4 h-4 mr-2" />
              Download Report
            </Button>
            <Button variant="outline" className="border-purple-500 text-purple-300 hover:bg-purple-500/10">
              <Share className="w-4 h-4 mr-2" />
              Share Results
            </Button>
          </div>

          {/* Data sources */}
          {dataSources.length > 0 && (
            <div className="flex justify-center items-center space-x-4 mb-8">
              <span className="text-gray-400 text-sm">Data Sources:</span>
              <div className="flex space-x-2">
                {dataSources.map((source: string, index: number) => (
                  <Badge key={index} variant="outline" className="text-xs border-gray-600 text-gray-300">
                    {source}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Report */}
        <Card className="bg-white/5 backdrop-blur-md border-white/20 shadow-2xl ring-1 ring-white/10 mb-8">
          <CardHeader>
            <h2 className="text-2xl font-bold text-white font-display">Customer Persona Analysis</h2>
          </CardHeader>
          <CardContent className="p-8">
            {/* Full Report Content */}
            <div className="prose prose-lg prose-invert max-w-none">
              <div 
                className="text-gray-300 leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ 
                  __html: data.fullReport
                    .replace(/\n/g, '<br>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em class="text-purple-300">$1</em>')
                    .replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold text-white mb-4 mt-8 first:mt-0">$1</h1>')
                    .replace(/^## (.*$)/gm, '<h2 class="text-2xl font-bold text-white mb-3 mt-6">$1</h2>')
                    .replace(/^### (.*$)/gm, '<h3 class="text-xl font-bold text-white mb-2 mt-4">$1</h3>')
                    .replace(/^- (.*$)/gm, '<div class="flex items-start mb-2"><span class="text-purple-400 mr-2">•</span><span>$1</span></div>')
                    .replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-purple-500 pl-4 my-4 italic text-purple-200">$1</blockquote>')
                }} 
              />
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats Grid */}
        {(data.painPoints.length > 0 || data.quotes.length > 0 || data.valuePropositions.length > 0) && (
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {/* Pain Points */}
            {data.painPoints.length > 0 && (
              <Card className="bg-red-500/10 border-red-500/30 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Pain Points</h3>
                  <p className="text-red-300 text-3xl font-bold">{data.painPoints.length}</p>
                  <p className="text-gray-400 text-sm">Key challenges identified</p>
                </CardContent>
              </Card>
            )}

            {/* Customer Quotes */}
            {data.quotes.length > 0 && (
              <Card className="bg-blue-500/10 border-blue-500/30 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <MessageSquare className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Customer Quotes</h3>
                  <p className="text-blue-300 text-3xl font-bold">{data.quotes.length}</p>
                  <p className="text-gray-400 text-sm">Real customer voices</p>
                </CardContent>
              </Card>
            )}

            {/* Value Propositions */}
            {data.valuePropositions.length > 0 && (
              <Card className="bg-green-500/10 border-green-500/30 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <Target className="w-12 h-12 text-green-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Value Props</h3>
                  <p className="text-green-300 text-3xl font-bold">{data.valuePropositions.length}</p>
                  <p className="text-gray-400 text-sm">Key value drivers</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="text-center">
          <Button 
            onClick={() => router.push('/')}
            className="bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 hover:from-purple-700 hover:via-pink-700 hover:to-purple-700 text-white font-semibold text-lg px-8 py-3"
          >
            Start New Analysis
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}