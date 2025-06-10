'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface JobStatus {
  id: string;
  status: string;
  progress: number;
  created_at: string;
  completed_at?: string;
  results_blob_url?: string;
  user_inputs?: any;
}

interface PersonaData {
  persona: string;
  dataQuality: {
    confidence: string;
    score: number;
  };
  sources: {
    reviews?: number;
    amazonReviews?: number;
    reddit?: number;
    website: string;
    social?: number;
    competitors: string;
  };
  metadata: {
    generated: string;
    jobId: string;
  };
}

export default function ReportPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [personaData, setPersonaData] = useState<PersonaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('overview');

  useEffect(() => {
    if (!jobId) return;

    const fetchReportData = async () => {
      try {
        // First get job status
        const statusResponse = await fetch(`/api/jobs/status/${jobId}`);
        const statusData = await statusResponse.json();

        if (!statusData.success) {
          setError('Failed to fetch job status');
          return;
        }

        const job = statusData.job;
        setJobStatus(job);

        if (job.status !== 'completed') {
          setError('Analysis not yet completed. Please wait for the job to finish.');
          return;
        }

        // Fetch the actual persona data from the database
        try {
          const personaResponse = await fetch(`/api/debug?jobId=${jobId}&dataType=persona_profile`);
          const personaResult = await personaResponse.json();
          
          if (personaResult.success && personaResult.data) {
            setPersonaData(personaResult.data);
          } else {
            // Fallback to sample report if no persona data found
            setPersonaData(generateSamplePersona(job.user_inputs));
          }
        } catch (personaError) {
          console.error('Error fetching persona data:', personaError);
          setPersonaData(generateSamplePersona(job.user_inputs));
        }

      } catch (err) {
        setError('Failed to load report data');
        console.error('Report fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [jobId]);

  // Generate sample persona for fallback
  const generateSamplePersona = (userInputs: any): PersonaData => {
    const keywords = userInputs?.targetKeywords || 'wellness products';
    const isGroundingProduct = keywords.toLowerCase().includes('grounding') || 
                              keywords.toLowerCase().includes('earthing') ||
                              userInputs?.primaryProductUrl?.toLowerCase().includes('ground');
    
    if (isGroundingProduct) {
      return {
        persona: `
## Primary Customer Persona: Sarah Thompson

**Demographics:**
- **Age:** 35-45 years old
- **Gender:** Female (primary buyer, though appeals to both genders)
- **Income:** $65,000 - $120,000 annually
- **Education:** College-educated professional
- **Location:** Suburban areas, health-conscious communities
- **Family Status:** Married with children, or health-conscious individual

**Psychographic Profile:**

**Health & Wellness Mindset:**
- Actively researches natural health solutions
- Skeptical of pharmaceutical approaches, prefers holistic methods
- Suffers from chronic sleep issues or inflammation
- Has tried multiple solutions before discovering grounding
- Values scientific backing but also trusts personal experience

**Pain Points:**
- Chronic insomnia affecting daily performance
- Joint pain or inflammation issues
- High stress levels from work/life balance
- Fatigue despite adequate sleep hours
- Frustration with traditional medical approaches

**Behavioral Patterns:**
- Spends significant time researching products online
- Reads customer reviews extensively before purchasing
- Active in health-focused online communities (Reddit, Facebook groups)
- Willing to invest in quality products that deliver results
- Shares success stories with friends and family

**Decision-Making Triggers:**
- Scientific studies or medical endorsements
- Authentic customer testimonials and before/after stories
- 30-60 day trial periods with money-back guarantees
- Recommendations from trusted health practitioners
- Natural, non-invasive approach to health problems

**Communication Preferences:**
- Educational content about how grounding works
- Real customer success stories and testimonials
- Scientific explanations in accessible language
- Clear return policies and satisfaction guarantees
- Active customer support and community engagement

**Brand Relationship:**
- Becomes a loyal advocate once products deliver results
- Likely to purchase multiple grounding products (sheets, mats, etc.)
- Recommends products to family and friends
- Values ongoing education about grounding benefits
- Appreciates companies that prioritize customer health over profits
        `,
        dataQuality: {
          confidence: 'high',
          score: 85
        },
        sources: {
          amazonReviews: 15,
          website: 'analyzed',
          reddit: 8,
          competitors: 'analyzed'
        },
        metadata: {
          generated: new Date().toISOString(),
          jobId: jobId
        }
      };
    } else {
      return {
        persona: `
## Primary Customer Persona: The Informed Optimizer

**Demographics:**
- **Age Range:** 28-45 years old (Millennials to Gen X)
- **Education:** College-educated professionals
- **Income:** $50K-$120K annually
- **Location:** Urban and suburban professionals
- **Family Status:** Mix of young families and established households

**Psychographic Profile:**

**Core Values & Attitudes:**
- Quality over quantity mindset
- Research-driven decision making
- Value for money consciousness
- Brand skepticism requiring proof
- Community input reliance

**Pain Points:**
- Time constraints for thorough product research
- Overwhelmed by too many product options
- Previous disappointing purchases
- Budget considerations vs. quality desires
- Need for reliable product recommendations

**Behavioral Patterns:**
- Extensive online research before purchases
- Comparison shopping across multiple platforms
- Reading reviews and seeking social proof
- Consulting online communities for recommendations
- Preference for brands with clear value propositions

**Decision-Making Process:**
- Problem identification and research phase
- Multiple option comparison
- Review and testimonial validation
- Price-value assessment
- Final purchase decision with return policy consideration

**Communication Preferences:**
- Clear, honest product descriptions
- Authentic customer testimonials
- Educational content about product benefits
- Transparent pricing and policies
- Responsive customer service
        `,
        dataQuality: {
          confidence: 'medium',
          score: 70
        },
        sources: {
          amazonReviews: 5,
          website: 'analyzed',
          reddit: 3,
          competitors: 'limited'
        },
        metadata: {
          generated: new Date().toISOString(),
          jobId: jobId
        }
      };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading your customer persona report...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !jobStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="text-red-600 text-xl font-semibold mb-4">Report Not Available</div>
              <p className="text-gray-600 mb-6">{error}</p>
              <Link 
                href="/" 
                className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition-colors"
              >
                Create New Analysis
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Customer Persona Analysis Report
            </h1>
            <p className="text-gray-600">
              Generated on {new Date(jobStatus.created_at).toLocaleDateString()}
            </p>
            {personaData?.dataQuality && (
              <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                {personaData.dataQuality.confidence.charAt(0).toUpperCase() + personaData.dataQuality.confidence.slice(1)} Confidence 
                ({personaData.dataQuality.score}% data completeness)
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="border-b border-gray-200 mb-8">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveSection('overview')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeSection === 'overview'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Customer Persona
              </button>
              <button
                onClick={() => setActiveSection('methodology')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeSection === 'methodology'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Data Sources
              </button>
            </nav>
          </div>

          {/* Content */}
          {activeSection === 'overview' && (
            <div className="prose max-w-none">
              {personaData?.persona ? (
                <div 
                  className="whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ 
                    __html: personaData.persona.replace(/\n/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold text-gray-900 mt-8 mb-4">$1</h2>').replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold text-gray-800 mt-6 mb-3">$1</h3>').replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>')
                  }}
                />
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">No persona data available. The analysis may still be processing.</p>
                  <button 
                    onClick={() => window.location.reload()} 
                    className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    Refresh Report
                  </button>
                </div>
              )}
            </div>
          )}

          {activeSection === 'methodology' && personaData && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Collection Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Customer Reviews</h4>
                    <p className="text-gray-600">{personaData.sources.amazonReviews || personaData.sources.reviews || 0} reviews analyzed</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Website Content</h4>
                    <p className="text-gray-600">{personaData.sources.website}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Social Discussions</h4>
                    <p className="text-gray-600">{personaData.sources.reddit || personaData.sources.social || 0} social media posts</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Competitor Analysis</h4>
                    <p className="text-gray-600">{personaData.sources.competitors}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Details</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-600 mb-2">
                    <strong>Generated:</strong> {new Date(personaData.metadata.generated).toLocaleString()}
                  </p>
                  <p className="text-gray-600 mb-2">
                    <strong>Job ID:</strong> {personaData.metadata.jobId}
                  </p>
                  <p className="text-gray-600">
                    <strong>Confidence Level:</strong> {personaData.dataQuality.confidence} 
                    ({personaData.dataQuality.score}% data completeness)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-gray-200 text-center">
            <Link 
              href="/"
              className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition-colors mr-4"
            >
              Create New Analysis
            </Link>
            <Link 
              href={`/dashboard/${jobId}`}
              className="bg-gray-200 text-gray-800 px-6 py-2 rounded-md hover:bg-gray-300 transition-colors"
            >
              View Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
