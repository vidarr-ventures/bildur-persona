'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Globe, MessageSquare, Users, Zap, ArrowRight, CheckCircle, Star, TrendingUp, Loader2 } from "lucide-react"

export default function PersonaAnalyzer() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [competitorUrls, setCompetitorUrls] = useState<string[]>(['', '', '', '', '']);
  const [keywordPhrases, setKeywordPhrases] = useState<string[]>(['', '', '']);
  const [debugMode, setDebugMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const validateUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const updateCompetitorUrl = (index: number, value: string) => {
    const newUrls = [...competitorUrls];
    newUrls[index] = value;
    setCompetitorUrls(newUrls);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!url) {
      setError('Please enter your website URL');
      return;
    }

    if (!validateUrl(url)) {
      setError('Please enter a valid website URL');
      return;
    }

    // Validate first competitor URL is required
    if (!competitorUrls[0] || competitorUrls[0].trim() === '') {
      setError('Please enter at least one competitor website URL');
      return;
    }
    if (!validateUrl(competitorUrls[0])) {
      setError('Please enter a valid competitor website URL');
      return;
    }
    
    // Validate additional competitor URLs if provided
    const validCompetitors = competitorUrls.filter(u => u.trim() !== '');
    for (const compUrl of validCompetitors) {
      if (!validateUrl(compUrl)) {
        setError(`Invalid competitor URL: ${compUrl}`);
        return;
      }
    }

    // Validate keyword phrases - at least one is required
    const validKeywords = keywordPhrases.filter(k => k.trim() !== '');
    if (validKeywords.length === 0 || !keywordPhrases[0].trim()) {
      setError('Please enter at least one keyword phrase');
      return;
    }

    setIsLoading(true);

    try {
      // Normalize URLs
      const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
      const validCompetitors = competitorUrls.filter(u => u.trim() !== '');
      const normalizedCompetitors = validCompetitors.map(u => 
        u.startsWith('http') ? u : `https://${u}`
      );

      const response = await fetch('/api/v2/analysis/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUrl: normalizedUrl,
          competitorUrls: normalizedCompetitors,
          keywordPhrases: validKeywords,
          debugMode: debugMode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to start analysis');
      }

      console.log('Analysis started:', data);
      
      // ALWAYS skip processing page since our API completes synchronously
      // Store results in sessionStorage for the results page
      if (data.data.results) {
        sessionStorage.setItem(`analysis-${data.data.analysisId}`, JSON.stringify(data.data.results));
      }
      
      // Always go directly to results since processing is complete
      router.push(`/results/${data.data.analysisId}`);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start analysis');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 blur-3xl"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-emerald-500/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <Badge className="mb-6 bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30 transition-all duration-300">
              <Zap className="w-3 h-3 mr-1" />
              AI-Powered Customer Research
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight font-display">
              Understand Your{" "}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                Customers
              </span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              Generate detailed customer personas using AI analysis of reviews, social media, and website content.
              Transform data into actionable insights that drive growth.
            </p>

            <div className="flex justify-center items-center space-x-16 mb-12">
              <div className="text-center group">
                <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mb-3 mx-auto group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <Globe className="w-7 h-7 text-white" />
                </div>
                <span className="text-sm text-gray-400 font-medium">Website Analysis</span>
              </div>
              <div className="text-center group">
                <div className="w-14 h-14 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mb-3 mx-auto group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <MessageSquare className="w-7 h-7 text-white" />
                </div>
                <span className="text-sm text-gray-400 font-medium">Review Mining</span>
              </div>
              <div className="text-center group">
                <div className="w-14 h-14 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-3 mx-auto group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <span className="text-sm text-gray-400 font-medium">Persona Generation</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Form Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 pt-8">
        <Card className="bg-white/5 backdrop-blur-md border-white/20 shadow-2xl ring-1 ring-white/10">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-4 font-display">Start Your Customer Research</h2>
              <p className="text-gray-400 text-lg">
                Enter your website and product details to generate comprehensive customer personas
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Website URL */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Your Website URL <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="example.com or https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="pl-10 bg-white/5 border-white/20 text-white placeholder:text-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 h-12 transition-all duration-200"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {/* Keyword Phrases */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Keyword Phrases <span className="text-red-400">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">Enter 1-3 keyword phrases to focus the analysis</p>
                <div className="space-y-3">
                  {keywordPhrases.map((phrase, index) => (
                    <Input
                      key={index}
                      placeholder={index === 0 ? 'Primary keyword phrase (required)' : `Keyword phrase ${index + 1} (optional)`}
                      value={phrase}
                      onChange={(e) => {
                        const newPhrases = [...keywordPhrases];
                        newPhrases[index] = e.target.value;
                        setKeywordPhrases(newPhrases);
                      }}
                      className="bg-white/5 border-white/20 text-white placeholder:text-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 h-12 transition-all duration-200"
                      disabled={isLoading}
                      required={index === 0}
                    />
                  ))}
                </div>
              </div>

              {/* Competitor Websites */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Competitor Websites <span className="text-red-400">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">Add up to 5 competitor websites for comparative analysis</p>
                <div className="space-y-3">
                  {competitorUrls.map((compUrl, i) => (
                    <div key={i} className="relative">
                      <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <Input
                        placeholder={i === 0 ? `Competitor ${i + 1} URL (required)` : `Competitor ${i + 1} URL (optional)`}
                        value={compUrl}
                        onChange={(e) => updateCompetitorUrl(i, e.target.value)}
                        className="pl-10 bg-white/5 border-white/20 text-white placeholder:text-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 h-12 transition-all duration-200"
                        disabled={isLoading}
                        required={i === 0}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Debug Mode Toggle */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-white/5 to-white/10 rounded-lg border border-white/20 backdrop-blur-sm">
                <div>
                  <h3 className="text-white font-medium">Debug Mode</h3>
                  <p className="text-sm text-gray-400">Track processing steps and view detailed output</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDebugMode(!debugMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    debugMode ? 'bg-purple-600' : 'bg-gray-600'
                  }`}
                  disabled={isLoading}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      debugMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* CTA Button */}
              <Button 
                type="submit"
                className="w-full h-14 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 hover:from-purple-700 hover:via-pink-700 hover:to-purple-700 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] ring-2 ring-purple-500/20"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing Analysis... (2-3 minutes)
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
                    START FREE ANALYSIS
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30 backdrop-blur-sm hover:bg-gradient-to-br hover:from-purple-500/20 hover:to-pink-500/20 transition-all duration-300 group">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 font-display">AI-Powered Analysis</h3>
              <p className="text-gray-400">Advanced AI analysis optimized for accuracy & speed</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30 backdrop-blur-sm hover:bg-gradient-to-br hover:from-green-500/20 hover:to-emerald-500/20 transition-all duration-300 group">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 font-display">Competitor Insights</h3>
              <p className="text-gray-400">Compare up to 5 competitor websites</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30 backdrop-blur-sm hover:bg-gradient-to-br hover:from-blue-500/20 hover:to-cyan-500/20 transition-all duration-300 group">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Star className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 font-display">Actionable Results</h3>
              <p className="text-gray-400">Detailed personas and recommendations</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}