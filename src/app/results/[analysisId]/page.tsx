'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
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
  MapPin
} from "lucide-react"

// Mock data - replace with actual API call
const mockResults = {
  summary: {
    totalReviews: 1247,
    avgRating: 4.2,
    competitorsAnalyzed: 3,
    processingTime: "2m 34s"
  },
  personas: [
    {
      id: 1,
      name: "Tech-Savvy Professional",
      percentage: 45,
      demographics: {
        age: "25-35",
        income: "$75k-120k",
        location: "Urban areas",
        occupation: "Software Engineer, Designer"
      },
      characteristics: [
        "Values efficiency and automation",
        "Early adopter of new technologies", 
        "Research-driven decision maker",
        "Willing to pay premium for quality"
      ],
      painPoints: [
        "Limited time for research",
        "Overwhelmed by choices",
        "Seeks trusted recommendations"
      ],
      goals: [
        "Save time on routine tasks",
        "Stay ahead of technology trends",
        "Maximize productivity"
      ]
    },
    {
      id: 2,
      name: "Budget-Conscious Family",
      percentage: 35,
      demographics: {
        age: "30-45",
        income: "$45k-75k",
        location: "Suburban areas",
        occupation: "Teacher, Nurse, Manager"
      },
      characteristics: [
        "Price-sensitive buyer",
        "Values long-term reliability",
        "Seeks family-friendly solutions",
        "Influenced by reviews and recommendations"
      ],
      painPoints: [
        "Limited budget constraints",
        "Need products that last",
        "Balancing quality vs. cost"
      ],
      goals: [
        "Get best value for money",
        "Make purchases that benefit whole family",
        "Avoid buyer's remorse"
      ]
    }
  ],
  insights: [
    {
      category: "Customer Sentiment",
      icon: Heart,
      color: "from-pink-500 to-rose-500",
      data: [
        { label: "Overall Satisfaction", value: "87%" },
        { label: "Would Recommend", value: "82%" },
        { label: "Repeat Customers", value: "64%" }
      ]
    },
    {
      category: "Key Motivators",
      icon: Zap,
      color: "from-yellow-500 to-orange-500",
      data: [
        { label: "Quality", value: "89%" },
        { label: "Price", value: "76%" },
        { label: "Customer Service", value: "71%" }
      ]
    },
    {
      category: "Purchase Drivers",
      icon: TrendingUp,
      color: "from-green-500 to-emerald-500",
      data: [
        { label: "Product Reviews", value: "94%" },
        { label: "Brand Reputation", value: "78%" },
        { label: "Recommendations", value: "65%" }
      ]
    }
  ],
  recommendations: [
    {
      title: "Target Tech Professionals with Premium Features",
      description: "Focus marketing efforts on automation and efficiency benefits. This segment shows 45% higher lifetime value.",
      impact: "High",
      effort: "Medium"
    },
    {
      title: "Create Family Value Packages", 
      description: "Bundle products for families with transparent pricing and extended warranties to address budget concerns.",
      impact: "Medium",
      effort: "Low"
    },
    {
      title: "Enhance Review Collection Strategy",
      description: "94% of customers rely on reviews. Implement systematic review collection and showcase testimonials prominently.",
      impact: "High",
      effort: "Low"
    }
  ]
};

export default function ResultsPage() {
  const params = useParams();
  const analysisId = params.analysisId as string;
  const [results, setResults] = useState(mockResults);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // In a real app, you'd fetch results from API
    // setLoading(true);
    // fetchResults(analysisId).then(setResults).finally(() => setLoading(false));
  }, [analysisId]);

  const handleDownload = () => {
    // Implement PDF download
    console.log('Downloading report...');
  };

  const handleShare = () => {
    // Implement sharing functionality
    console.log('Sharing report...');
  };

  return (
    <div className="min-h-screen">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 blur-3xl"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-emerald-500/10"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="mb-6 bg-green-500/20 text-green-300 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Analysis Complete
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight font-display">
            Your Customer{" "}
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              Insights
            </span>
          </h1>
          
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            We analyzed {results.summary.totalReviews.toLocaleString()} customer reviews and {results.summary.competitorsAnalyzed} competitors 
            to understand your audience better.
          </p>

          <div className="flex justify-center space-x-4">
            <Button onClick={handleDownload} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
              <Download className="w-4 h-4 mr-2" />
              Download Report
            </Button>
            <Button variant="outline" onClick={handleShare} className="border-white/20 text-white hover:bg-white/10">
              <Share className="w-4 h-4 mr-2" />
              Share Results
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <Card className="bg-white/5 backdrop-blur-md border-white/20">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-white mb-1">{results.summary.totalReviews.toLocaleString()}</div>
              <div className="text-sm text-gray-400">Reviews Analyzed</div>
            </CardContent>
          </Card>
          <Card className="bg-white/5 backdrop-blur-md border-white/20">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-white mb-1">{results.summary.avgRating}/5</div>
              <div className="text-sm text-gray-400">Avg Rating</div>
            </CardContent>
          </Card>
          <Card className="bg-white/5 backdrop-blur-md border-white/20">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-white mb-1">{results.summary.competitorsAnalyzed}</div>
              <div className="text-sm text-gray-400">Competitors</div>
            </CardContent>
          </Card>
          <Card className="bg-white/5 backdrop-blur-md border-white/20">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-white mb-1">{results.summary.processingTime}</div>
              <div className="text-sm text-gray-400">Processing Time</div>
            </CardContent>
          </Card>
        </div>

        {/* Customer Personas */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-8 font-display flex items-center">
            <Users className="w-8 h-8 mr-3 text-purple-400" />
            Customer Personas
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {results.personas.map((persona) => (
              <Card key={persona.id} className="bg-white/5 backdrop-blur-md border-white/20 hover:bg-white/10 transition-all duration-300">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white font-display">{persona.name}</h3>
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                      {persona.percentage}% of audience
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Demographics */}
                  <div>
                    <h4 className="font-semibold text-gray-300 mb-3 flex items-center">
                      <Target className="w-4 h-4 mr-2" />
                      Demographics
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center text-gray-400">
                        <Calendar className="w-4 h-4 mr-2" />
                        {persona.demographics.age}
                      </div>
                      <div className="flex items-center text-gray-400">
                        <DollarSign className="w-4 h-4 mr-2" />
                        {persona.demographics.income}
                      </div>
                      <div className="flex items-center text-gray-400">
                        <MapPin className="w-4 h-4 mr-2" />
                        {persona.demographics.location}
                      </div>
                      <div className="flex items-center text-gray-400">
                        <Users className="w-4 h-4 mr-2" />
                        {persona.demographics.occupation}
                      </div>
                    </div>
                  </div>

                  {/* Key Characteristics */}
                  <div>
                    <h4 className="font-semibold text-gray-300 mb-3">Key Characteristics</h4>
                    <ul className="space-y-2">
                      {persona.characteristics.map((char, idx) => (
                        <li key={idx} className="flex items-start text-sm text-gray-400">
                          <CheckCircle className="w-4 h-4 mr-2 text-green-400 mt-0.5 flex-shrink-0" />
                          {char}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Pain Points & Goals */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-red-300 mb-2">Pain Points</h4>
                      <ul className="space-y-1">
                        {persona.painPoints.map((point, idx) => (
                          <li key={idx} className="text-sm text-gray-400">• {point}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-green-300 mb-2">Goals</h4>
                      <ul className="space-y-1">
                        {persona.goals.map((goal, idx) => (
                          <li key={idx} className="text-sm text-gray-400">• {goal}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Key Insights */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-8 font-display flex items-center">
            <Star className="w-8 h-8 mr-3 text-yellow-400" />
            Key Insights
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {results.insights.map((insight, idx) => {
              const IconComponent = insight.icon;
              return (
                <Card key={idx} className="bg-white/5 backdrop-blur-md border-white/20">
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 bg-gradient-to-r ${insight.color} rounded-xl flex items-center justify-center mb-4`}>
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-bold text-white mb-4 font-display">{insight.category}</h3>
                    <div className="space-y-3">
                      {insight.data.map((item, dataIdx) => (
                        <div key={dataIdx} className="flex justify-between items-center">
                          <span className="text-gray-400 text-sm">{item.label}</span>
                          <span className="text-white font-semibold">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Recommendations */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-8 font-display flex items-center">
            <TrendingUp className="w-8 h-8 mr-3 text-green-400" />
            Actionable Recommendations
          </h2>
          
          <div className="space-y-6">
            {results.recommendations.map((rec, idx) => (
              <Card key={idx} className="bg-white/5 backdrop-blur-md border-white/20">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="font-bold text-white text-lg font-display flex-1">{rec.title}</h3>
                    <div className="flex space-x-2 ml-4">
                      <Badge className={`${
                        rec.impact === 'High' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                        rec.impact === 'Medium' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                        'bg-gray-500/20 text-gray-300 border-gray-500/30'
                      }`}>
                        {rec.impact} Impact
                      </Badge>
                      <Badge className={`${
                        rec.effort === 'Low' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                        rec.effort === 'Medium' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                        'bg-red-500/20 text-red-300 border-red-500/30'
                      }`}>
                        {rec.effort} Effort
                      </Badge>
                    </div>
                  </div>
                  <p className="text-gray-400">{rec.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <Card className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30">
          <CardContent className="p-8 text-center">
            <h3 className="text-2xl font-bold text-white mb-4 font-display">Ready to Act on These Insights?</h3>
            <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
              Use these customer personas and insights to optimize your marketing, product development, and customer experience.
            </p>
            <div className="flex justify-center space-x-4">
              <Button onClick={handleDownload} size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                <Download className="w-4 h-4 mr-2" />
                Download Full Report
              </Button>
              <Button variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10">
                <ArrowRight className="w-4 h-4 mr-2" />
                Start New Analysis
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}