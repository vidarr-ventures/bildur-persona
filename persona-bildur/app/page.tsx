import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Globe, MessageSquare, Users, Zap, ArrowRight, CheckCircle, Star, TrendingUp } from "lucide-react"

export default function PersonaAnalyzer() {
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
              <a href="/" className="text-purple-400 font-medium">
                Home
              </a>
              <a href="/about" className="text-gray-300 hover:text-white transition-colors">
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
              <Zap className="w-3 h-3 mr-1" />
              AI-Powered Customer Research
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight font-space-grotesk">
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
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <Card className="bg-white/5 backdrop-blur-md border-white/20 shadow-2xl ring-1 ring-white/10">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-4 font-space-grotesk">Start Your Customer Research</h2>
              <p className="text-gray-400 text-lg">
                Enter your website and product details to generate comprehensive customer personas
              </p>
            </div>

            <div className="space-y-6">
              {/* Website URL */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Your Website URL <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="example.com or https://example.com"
                    className="pl-10 bg-white/5 border-white/20 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 h-12 transition-all duration-200"
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
                  <Input
                    placeholder="Primary keyword phrase (required)"
                    className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 h-12 transition-all duration-200"
                  />
                  <Input
                    placeholder="Keyword phrase 2 (optional)"
                    className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 h-12 transition-all duration-200"
                  />
                  <Input
                    placeholder="Keyword phrase 3 (optional)"
                    className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 h-12 transition-all duration-200"
                  />
                </div>
              </div>

              {/* Competitor Websites */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Competitor Websites (Optional)</label>
                <p className="text-xs text-gray-500 mb-3">Add up to 5 competitor websites for comparative analysis</p>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="relative">
                      <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <Input
                        placeholder={`Competitor ${i} URL`}
                        className="pl-10 bg-white/5 border-white/20 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 h-12 transition-all duration-200"
                      />
                    </div>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  className="mt-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-all duration-200"
                >
                  + Add Competitor
                </Button>
              </div>

              {/* Debug Mode Toggle */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-white/5 to-white/10 rounded-lg border border-white/20 backdrop-blur-sm">
                <div>
                  <h3 className="text-white font-medium">Debug Mode</h3>
                  <p className="text-sm text-gray-400">Track processing steps and view detailed output</p>
                </div>
                <div className="relative">
                  <input type="checkbox" className="sr-only" />
                  <div className="w-11 h-6 bg-gray-600 rounded-full shadow-inner cursor-pointer transition-colors duration-200 hover:bg-gray-500">
                    <div className="w-5 h-5 bg-white rounded-full shadow transform translate-x-0 transition-transform duration-200"></div>
                  </div>
                </div>
              </div>

              {/* CTA Button */}
              <Button className="w-full h-14 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 hover:from-purple-700 hover:via-pink-700 hover:to-purple-700 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] ring-2 ring-purple-500/20">
                <Zap className="w-5 h-5 mr-2" />
                START FREE ANALYSIS
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
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
              <h3 className="text-xl font-bold text-white mb-2 font-space-grotesk">AI-Powered Analysis</h3>
              <p className="text-gray-400">Advanced AI analysis optimized for accuracy & speed</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30 backdrop-blur-sm hover:bg-gradient-to-br hover:from-green-500/20 hover:to-emerald-500/20 transition-all duration-300 group">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 font-space-grotesk">Competitor Insights</h3>
              <p className="text-gray-400">Compare up to 5 competitor websites</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30 backdrop-blur-sm hover:bg-gradient-to-br hover:from-blue-500/20 hover:to-cyan-500/20 transition-all duration-300 group">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Star className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 font-space-grotesk">Actionable Results</h3>
              <p className="text-gray-400">Detailed personas and recommendations</p>
            </CardContent>
          </Card>
        </div>
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
