import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Brain, Target, Zap, Users, TrendingUp, Shield, Clock, Award, ArrowRight, CheckCircle } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-white/10 backdrop-blur-sm bg-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <span className="text-white font-semibold text-lg font-space-grotesk">Bildur</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="/" className="text-gray-300 hover:text-white transition-colors">
                Home
              </a>
              <a href="/about" className="text-purple-400 font-medium">
                About
              </a>
              <a href="#" className="text-gray-300 hover:text-white transition-colors">
                Persona Builder
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 blur-3xl"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-emerald-500/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <Badge className="mb-6 bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30 transition-all duration-300">
              <Brain className="w-3 h-3 mr-1" />
              About Bildur
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight font-space-grotesk">
              Revolutionizing{" "}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                Customer Research
              </span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              We're transforming how businesses understand their customers through AI-powered persona generation and
              deep market insights.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <Card className="bg-white/5 backdrop-blur-md border-white/20 shadow-2xl ring-1 ring-white/10 mb-16">
          <CardContent className="p-12">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-white mb-6 font-space-grotesk">Our Mission</h2>
              <p className="text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
                To democratize customer research by making advanced AI-powered persona generation accessible to
                businesses of all sizes. We believe every company deserves deep customer insights to drive growth.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center group">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 font-space-grotesk">Precision</h3>
                <p className="text-gray-400">Accurate customer insights powered by advanced AI algorithms</p>
              </div>

              <div className="text-center group">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 font-space-grotesk">Speed</h3>
                <p className="text-gray-400">Get comprehensive personas in minutes, not weeks</p>
              </div>

              <div className="text-center group">
                <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 font-space-grotesk">Accessibility</h3>
                <p className="text-gray-400">Enterprise-grade insights for businesses of every size</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30 backdrop-blur-sm hover:bg-gradient-to-br hover:from-purple-500/20 hover:to-pink-500/20 transition-all duration-300">
            <CardContent className="p-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mr-4">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white font-space-grotesk">AI-Powered Analysis</h3>
              </div>
              <p className="text-gray-300 mb-4">
                Our advanced machine learning algorithms analyze thousands of data points from websites, reviews, and
                social media to create accurate customer personas.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                  Natural language processing
                </li>
                <li className="flex items-center text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                  Sentiment analysis
                </li>
                <li className="flex items-center text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                  Behavioral pattern recognition
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30 backdrop-blur-sm hover:bg-gradient-to-br hover:from-blue-500/20 hover:to-cyan-500/20 transition-all duration-300">
            <CardContent className="p-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mr-4">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white font-space-grotesk">Competitive Intelligence</h3>
              </div>
              <p className="text-gray-300 mb-4">
                Compare your customer base with up to 5 competitors to identify market gaps, opportunities, and
                positioning strategies.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                  Market positioning analysis
                </li>
                <li className="flex items-center text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                  Gap identification
                </li>
                <li className="flex items-center text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                  Strategic recommendations
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30 backdrop-blur-sm hover:bg-gradient-to-br hover:from-green-500/20 hover:to-emerald-500/20 transition-all duration-300">
            <CardContent className="p-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mr-4">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white font-space-grotesk">Privacy & Security</h3>
              </div>
              <p className="text-gray-300 mb-4">
                Your data is processed securely with enterprise-grade encryption. We never store sensitive information
                and comply with all major privacy regulations.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                  GDPR compliant
                </li>
                <li className="flex items-center text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                  End-to-end encryption
                </li>
                <li className="flex items-center text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                  No data retention
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/30 backdrop-blur-sm hover:bg-gradient-to-br hover:from-orange-500/20 hover:to-red-500/20 transition-all duration-300">
            <CardContent className="p-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center mr-4">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white font-space-grotesk">Rapid Results</h3>
              </div>
              <p className="text-gray-300 mb-4">
                Get comprehensive customer personas and actionable insights in minutes, not the weeks traditional
                research methods require.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                  5-minute analysis
                </li>
                <li className="flex items-center text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                  Instant reports
                </li>
                <li className="flex items-center text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                  Real-time insights
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <Card className="bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-purple-500/10 border-purple-500/30 backdrop-blur-sm">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Award className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4 font-space-grotesk">
              Ready to Transform Your Customer Research?
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Join thousands of businesses using Bildur to understand their customers better and drive growth.
            </p>
            <Button className="h-14 px-8 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 hover:from-purple-700 hover:via-pink-700 hover:to-purple-700 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] ring-2 ring-purple-500/20">
              <Zap className="w-5 h-5 mr-2" />
              Start Free Analysis
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-gray-400">© 2024 Bildur. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
