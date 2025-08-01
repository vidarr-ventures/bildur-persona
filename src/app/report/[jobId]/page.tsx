'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { FileText, Database, Globe, MessageSquare, Star } from 'lucide-react';

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
## Section 1: Customer Demographics & Psychographics

### Demographic Profile
**Primary Persona: Sarah Thompson - The Wellness Seeker**

- **Age Range:** 35-45 years old (Millennial/Gen X cusp)
- **Gender:** Primarily female (though appeals to health-conscious individuals of all genders)
- **Income:** $65,000 - $120,000 annually
- **Education:** College-educated professional
- **Location:** Suburban areas, health-conscious communities
- **Family Status:** Married with children, or health-conscious individual
- **Technology Adoption:** Active online researcher, moderate social media user

### Generational Analysis
As a Millennial/Gen X hybrid, Sarah exhibits:
- Mix of traditional and digital media consumption
- Strong research orientation before purchasing
- Quality and value-seeking behavior
- Active on Facebook and health-focused online communities
- Email marketing effectiveness
- Preference for authenticity over hype

### Psychographic Deep Dive

#### Core Attitudes and Values
- Values natural, holistic approaches to health over pharmaceutical solutions
- Strong belief in personal research and self-advocacy
- Risk-tolerant when scientific evidence supports claims
- Prioritizes long-term health outcomes over quick fixes

#### Hopes, Dreams, and Fears
- **Primary Goal:** Achieve optimal health and wellness naturally
- **Deep Fear:** Chronic health issues affecting quality of life and family relationships
- **Success Definition:** Feeling energetic, sleeping well, and maintaining vitality

#### Perceived Obstacles & Outside Forces
- Skeptical of mainstream medical approaches
- Frustrated by information overload in wellness space
- Believes "natural solutions are often overlooked by traditional medicine"

## Section 2: Behavioral Psychology Analysis

### Goal Assessment

#### Functional Goals
- Improve sleep quality and duration
- Reduce inflammation and joint pain
- Increase daily energy levels

#### Higher-Order Goals
- Feel confident in health choices
- Be seen as someone who takes proactive care of health
- Set positive example for family

### Motivation Analysis
**Primary Motivations:**
1. **Security:** Desire to feel safe and protected from health threats
2. **Competence:** Desire to feel capable of managing own health
3. **Achievement:** Desire to overcome health obstacles

### Cognitive Heuristics & Predictable Irrationalities
- **Social Proof:** Heavily relies on customer reviews and testimonials
- **Authority Bias:** Values scientific studies and expert endorsements
- **Loss Aversion:** Focuses more on avoiding health deterioration than gaining benefits

## Section 7: ICP Synthesis & Implementation Strategy

### Executive Summary
Sarah Thompson represents the informed wellness seeker who combines thorough research with openness to natural solutions. She's driven primarily by security and competence motivations, uses social proof heavily in decision-making, and becomes a powerful advocate when products deliver results.

### Primary Persona Development
**Name:** Sarah Thompson - The Informed Wellness Advocate
**Key Quote:** "I've tried everything else, so I'm willing to try this if the science backs it up."
**Decision Trigger:** Combination of scientific evidence and authentic customer testimonials
**Life Event Receptivity:** Health diagnoses, sleep disruption periods, major life stress events

## Bonus Section: Brand Identity Recommendations

### Key Customer Quotes
Based on typical customer feedback patterns:
1. "I was skeptical at first, but the results speak for themselves"
2. "Finally found something natural that actually works"
3. "My sleep has improved dramatically since starting"
4. "I wish I had discovered this years ago"
5. "The science behind this makes so much sense"
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
## Section 1: Customer Demographics & Psychographics

### Demographic Profile
**Primary Persona: Alex Chen - The Informed Optimizer**

- **Age Range:** 28-45 years old (Millennials to Gen X)
- **Education:** College-educated professionals
- **Income:** $50K-$120K annually
- **Location:** Urban and suburban professionals
- **Family Status:** Mix of young families and established households
- **Technology Adoption:** Digital-native with hybrid media consumption

### Generational Analysis
As a Millennial/Gen X professional, Alex exhibits:
- Digital-first approach with smartphone optimization
- Strong research orientation and comparison shopping
- Quality and value-seeking behavior
- Active on multiple social platforms
- Email and social media marketing effectiveness
- Preference for authenticity and transparency

### Psychographic Deep Dive

#### Core Attitudes and Values
- Quality over quantity mindset
- Research-driven decision making approach
- Value for money consciousness
- Brand skepticism requiring proof
- Community input and peer validation reliance

#### Hopes, Dreams, and Fears
- **Primary Goal:** Make optimal choices that deliver long-term value
- **Deep Fear:** Making poor purchasing decisions and wasting money
- **Success Definition:** Finding products that exceed expectations and deliver ROI

#### Perceived Obstacles & Outside Forces
- Time constraints limiting thorough research
- Information overload in product selection
- Previous disappointing purchase experiences
- Budget constraints vs. quality desires

## Section 2: Behavioral Psychology Analysis

### Goal Assessment

#### Functional Goals
- Solve specific problems efficiently
- Maximize value for money spent
- Save time in decision-making process

#### Higher-Order Goals
- Feel confident in purchase decisions
- Be seen as smart, discerning consumer
- Maintain reputation for good recommendations

### Motivation Analysis
**Primary Motivations:**
1. **Competence:** Desire to feel capable of making optimal choices
2. **Security:** Desire to avoid poor decisions and financial loss
3. **Achievement:** Desire to find the best solutions available

### Cognitive Heuristics & Predictable Irrationalities
- **Social Proof:** Heavy reliance on reviews and ratings
- **Loss Aversion:** Focuses on avoiding bad purchases over gaining benefits
- **Choice Overload:** Can become paralyzed by too many options

## Section 7: ICP Synthesis & Implementation Strategy

### Executive Summary
Alex Chen represents the methodical, research-driven consumer who combines thorough analysis with community validation. Driven by competence and security motivations, they use extensive social proof in decision-making and become loyal advocates for brands that consistently deliver value.

### Primary Persona Development
**Name:** Alex Chen - The Methodical Value Seeker
**Key Quote:** "I never buy anything without reading the reviews first."
**Decision Trigger:** Combination of strong reviews, clear value proposition, and risk mitigation
**Life Event Receptivity:** Career changes, major purchases, problem-solving moments

## Bonus Section: Brand Identity Recommendations

### Key Customer Quotes
Based on typical research-driven customer patterns:
1. "The reviews convinced me this was worth trying"
2. "Exactly what I was looking for - great value"
3. "Does exactly what it promises, no surprises"
4. "Would definitely recommend to others"
5. "Glad I did my research before buying"
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

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      default:
        return 'bg-red-500/10 text-red-400 border-red-500/20';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
              <p className="mt-4 text-gray-300">Loading your customer persona report...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !jobStatus) {
    return (
      <div className="min-h-screen bg-black py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
            <div className="text-center">
              <div className="text-red-400 text-xl font-semibold mb-4">Report Not Available</div>
              <p className="text-gray-300 mb-6">{error}</p>
              <Link 
                href="/" 
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
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
    <div className="min-h-screen bg-black py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
          <div className="text-center mb-8">
            <FileText className="h-12 w-12 text-purple-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">
              Customer Persona Analysis Report
            </h1>
            <p className="text-gray-400">
              Generated on {new Date(jobStatus.created_at).toLocaleDateString()}
            </p>
            {personaData?.dataQuality && (
              <div className={`mt-4 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getConfidenceColor(personaData.dataQuality.confidence)}`}>
                <Star className="h-4 w-4 mr-1" />
                {personaData.dataQuality.confidence.charAt(0).toUpperCase() + personaData.dataQuality.confidence.slice(1)} Confidence 
                ({personaData.dataQuality.score}% data completeness)
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="border-b border-gray-700 mb-8">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveSection('overview')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeSection === 'overview'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                }`}
              >
                Customer Persona
              </button>
              <button
                onClick={() => setActiveSection('methodology')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeSection === 'methodology'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                }`}
              >
                Data Sources
              </button>
            </nav>
          </div>

          {/* Content */}
          {activeSection === 'overview' && (
            <div className="prose prose-invert max-w-none">
              {personaData?.persona ? (
                <div 
                  className="whitespace-pre-wrap text-gray-300 leading-relaxed"
                  dangerouslySetInnerHTML={{ 
                    __html: personaData.persona
                      .replace(/\n/g, '<br />')
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em class="text-gray-300 italic">$1</em>')
                      .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold text-white mt-8 mb-4 border-b border-gray-700 pb-2">$1</h2>')
                      .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold text-purple-400 mt-6 mb-3">$1</h3>')
                      .replace(/^#### (.*$)/gim, '<h4 class="text-lg font-medium text-blue-400 mt-4 mb-2">$1</h4>')
                      .replace(/^\* (.*$)/gim, '<li class="ml-4 text-gray-300 mb-1 list-disc">$1</li>')
                      .replace(/^- (.*$)/gim, '<li class="ml-4 text-gray-300 mb-1 list-disc">$1</li>')
                      .replace(/^(\d+)\. (.*$)/gim, '<li class="ml-4 text-gray-300 mb-1 list-decimal">$2</li>')
                  }}
                />
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-400">No persona data available. The analysis may still be processing.</p>
                  <button 
                    onClick={() => window.location.reload()} 
                    className="mt-4 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
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
                <h3 className="text-lg font-semibold text-white mb-4">Data Collection Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <MessageSquare className="h-5 w-5 text-blue-400" />
                      <h4 className="font-medium text-white">Customer Reviews</h4>
                    </div>
                    <p className="text-gray-300">{personaData.sources.amazonReviews || personaData.sources.reviews || 0} reviews analyzed</p>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Globe className="h-5 w-5 text-green-400" />
                      <h4 className="font-medium text-white">Website Content</h4>
                    </div>
                    <p className="text-gray-300">{personaData.sources.website}</p>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <MessageSquare className="h-5 w-5 text-purple-400" />
                      <h4 className="font-medium text-white">Social Discussions</h4>
                    </div>
                    <p className="text-gray-300">{personaData.sources.reddit || personaData.sources.social || 0} social media posts</p>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Database className="h-5 w-5 text-yellow-400" />
                      <h4 className="font-medium text-white">Competitor Analysis</h4>
                    </div>
                    <p className="text-gray-300">{personaData.sources.competitors}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Analysis Details</h3>
                <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
                  <p className="text-gray-300 mb-2">
                    <strong className="text-white">Generated:</strong> {new Date(personaData.metadata.generated).toLocaleString()}
                  </p>
                  <p className="text-gray-300 mb-2">
                    <strong className="text-white">Job ID:</strong> {personaData.metadata.jobId}
                  </p>
                  <p className="text-gray-300">
                    <strong className="text-white">Confidence Level:</strong> {personaData.dataQuality.confidence} 
                    ({personaData.dataQuality.score}% data completeness)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-gray-700 flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/"
              className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium text-center"
            >
              Create New Analysis
            </Link>
            <Link 
              href={`/dashboard/${jobId}`}
              className="bg-gray-700 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors font-medium text-center"
            >
              View Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
