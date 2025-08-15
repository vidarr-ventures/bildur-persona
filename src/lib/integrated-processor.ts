import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { scrapeWebsite, extractDataWithAI, ScrapeResult, ExtractedData } from './simple-processor';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const geminiModel = genAI.getGenerativeModel({ 
  model: 'gemini-1.5-flash',
  generationConfig: {
    temperature: 0.1,
    maxOutputTokens: 8000,
  }
});

// Data source interfaces
export interface YouTubeData {
  total_comments: number;
  channels_analyzed: number;
  videos_analyzed: number;
  emotional_intensity: {
    high: number;
    medium: number;
    low: number;
  };
  comments: Array<{
    comment_id: string;
    text: string;
    author: string;
    video_title: string;
    channel_name: string;
    relevance_score: number;
    emotional_classification?: string;
  }>;
}

export interface RedditData {
  total_items: number;
  subreddits_searched: string[];
  content: Array<{
    content_id: string;
    content_type: 'post' | 'comment';
    text: string;
    title?: string;
    username: string;
    subreddit: string;
    score: number;
    relevance_score: number;
  }>;
}

export interface IntegratedData {
  websiteData: ExtractedData;
  amazonData?: ExtractedData;
  competitorData: ExtractedData[];
  youtubeData?: YouTubeData;
  redditData?: RedditData;
  totalReviewCount: number;
  dataSources: string[];
}

// Fetch YouTube comments for keyword
export async function fetchYouTubeComments(keywords: string[]): Promise<YouTubeData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/youtube-live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        keywords: keywords,
        maxComments: 50 
      }),
    });
    
    if (!response.ok) {
      console.error('[YouTube] Failed to fetch comments:', response.statusText);
      return null;
    }
    
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('[YouTube] Error fetching comments:', error);
    return null;
  }
}

// Fetch Reddit discussions for keyword
export async function fetchRedditDiscussions(keywords: string[]): Promise<RedditData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/reddit-real-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        keywords: keywords,
        totalLimit: 50 
      }),
    });
    
    if (!response.ok) {
      console.error('[Reddit] Failed to fetch discussions:', response.statusText);
      return null;
    }
    
    const data = await response.json();
    return data.success && data.data ? data.data : null;
  } catch (error) {
    console.error('[Reddit] Error fetching discussions:', error);
    return null;
  }
}

// Integrate all data sources
export async function integrateAllDataSources(
  targetUrl: string,
  competitorUrls: string[] = [],
  keywordPhrases: string[] = []
): Promise<IntegratedData> {
  console.log('[Integration] Starting multi-source data collection...');
  
  // Collect data from all sources in parallel
  const [
    websiteResult,
    youtubeData,
    redditData,
    ...competitorResults
  ] = await Promise.all([
    // Main website
    scrapeWebsite(targetUrl, keywordPhrases).then(scrapeResult => 
      extractDataWithAI(scrapeResult.content, keywordPhrases)
    ),
    // YouTube comments
    fetchYouTubeComments(keywordPhrases),
    // Reddit discussions
    fetchRedditDiscussions(keywordPhrases),
    // Competitor websites
    ...competitorUrls.map(url => 
      scrapeWebsite(url, keywordPhrases).then(scrapeResult => 
        extractDataWithAI(scrapeResult.content, keywordPhrases)
      ).catch(err => {
        console.error(`[Integration] Failed to analyze competitor ${url}:`, err);
        return null;
      })
    )
  ]);
  
  // Calculate total review count
  let totalReviewCount = 0;
  const dataSources: string[] = ['website'];
  
  // Website reviews
  totalReviewCount += websiteResult.reviews_found || 0;
  totalReviewCount += websiteResult.raw_customer_quotes?.length || 0;
  
  // YouTube comments
  if (youtubeData && youtubeData.total_comments > 0) {
    totalReviewCount += youtubeData.total_comments;
    dataSources.push('youtube');
  }
  
  // Reddit posts/comments
  if (redditData && redditData.total_items > 0) {
    totalReviewCount += redditData.total_items;
    dataSources.push('reddit');
  }
  
  // Competitor reviews
  const validCompetitorData = competitorResults.filter(r => r !== null) as ExtractedData[];
  validCompetitorData.forEach((competitor, index) => {
    totalReviewCount += competitor.reviews_found || 0;
    totalReviewCount += competitor.raw_customer_quotes?.length || 0;
    if ((competitor.reviews_found || 0) > 0) {
      dataSources.push(`competitor${index + 1}`);
    }
  });
  
  console.log(`[Integration] Data collected from ${dataSources.length} sources with ${totalReviewCount} total reviews/comments`);
  
  return {
    websiteData: websiteResult,
    amazonData: undefined, // Can be added later
    competitorData: validCompetitorData,
    youtubeData: youtubeData || undefined,
    redditData: redditData || undefined,
    totalReviewCount,
    dataSources
  };
}

// Generate integrated persona report with all data sources
export async function generateIntegratedPersona(integratedData: IntegratedData): Promise<any> {
  // Prepare data for the prompt
  const attributionCodes: Record<string, string> = {
    customer: 'R001-Customer',
    amazon: 'R002-Amazon',
    competitor1: 'R003-Comp1',
    competitor2: 'R004-Comp2',
    competitor3: 'R005-Comp3',
    youtube: 'R006-YouTube',
    reddit: 'R007-Reddit'
  };
  
  // Format YouTube data
  const youtubeContent = integratedData.youtubeData ? 
    integratedData.youtubeData.comments.map(c => 
      `[${attributionCodes.youtube}] ${c.author}: "${c.text}" (Video: ${c.video_title}, Emotion: ${c.emotional_classification || 'neutral'})`
    ).join('\n') : '';
  
  // Format Reddit data
  const redditContent = integratedData.redditData ?
    integratedData.redditData.content.map(r => 
      `[${attributionCodes.reddit}] u/${r.username} in r/${r.subreddit}: "${r.text}" (Score: ${r.score})`
    ).join('\n') : '';
  
  // Format competitor data
  const competitorContent = integratedData.competitorData.map((comp, index) => {
    const quotes = comp.raw_customer_quotes || [];
    return quotes.map(q => 
      `[${attributionCodes[`competitor${index + 1}` as keyof typeof attributionCodes]}] "${q.quote}" (${q.emotion_type})`
    ).join('\n');
  }).filter(c => c).join('\n');
  
  // Format website data
  const websiteContent = integratedData.websiteData.raw_customer_quotes?.map(q => 
    `[${attributionCodes.customer}] "${q.quote}" (${q.emotion_type})`
  ).join('\n') || '';
  
  // Create comprehensive prompt with all data sources
  const prompt = `DEMOGRAPHICS FOUNDATION PROMPT

You are analyzing multiple data sources to create a comprehensive customer persona. Use the attribution codes to reference specific sources when citing evidence.

ATTRIBUTION REFERENCE:
${Object.entries(attributionCodes).map(([key, code]) => `${code}: ${key}`).join('\n')}

COLLECTED DATA FOR ANALYSIS:

WEBSITE DATA:
Customer Site:
${JSON.stringify(integratedData.websiteData.demographics || {}, null, 2)}
${websiteContent}

COMPETITOR DATA:
${competitorContent}

SOCIAL MEDIA DATA:
YouTube Comments (${integratedData.youtubeData?.total_comments || 0} comments from ${integratedData.youtubeData?.videos_analyzed || 0} videos):
${youtubeContent}

Reddit Discussions (${integratedData.redditData?.total_items || 0} posts/comments from subreddits: ${integratedData.redditData?.subreddits_searched?.join(', ') || 'none'}):
${redditContent}

TOTAL REVIEW/COMMENT COUNT: ${integratedData.totalReviewCount}
DATA SOURCES: ${integratedData.dataSources.join(', ')}

Based on ALL the data above from multiple sources, create a comprehensive psychological customer persona that:

1. DEMOGRAPHICS & PSYCHOGRAPHICS
- Synthesize demographic patterns across all sources
- Use YouTube/Reddit usernames and language patterns to infer age/generation
- Note geographic indicators from social media discussions
- Identify education/income levels from language complexity and topics discussed

2. PAIN POINTS & NEEDS (cite sources using attribution codes)
- List top 5 pain points with frequency across sources
- Quote exact customer language from YouTube/Reddit
- Note emotional intensity patterns from social media
- Identify unmet needs expressed in discussions

3. BEHAVIORAL PATTERNS
- Social proof indicators from Reddit upvotes/YouTube engagement
- Purchase decision factors mentioned across sources
- Information seeking behavior (which platforms they use)
- Community participation patterns

4. GENERATIONAL ANALYSIS
- Identify predominant generation from language/platform usage
- Generation-specific communication preferences
- Technology adoption patterns evident in data

5. MOTIVATIONS & VALUES
- Core values expressed across all platforms
- Identity and self-perception themes
- Social/community motivations from Reddit/YouTube

6. CUSTOMER VOICE & LANGUAGE
- Common phrases and terminology used
- Emotional expressions and intensity
- Metaphors and analogies they use
- Jargon and insider language

7. DATA QUALITY ASSESSMENT
- Minimum 20 reviews/comments requirement: ${integratedData.totalReviewCount >= 20 ? 'MET' : 'NOT MET'}
- Source diversity: ${integratedData.dataSources.length} sources
- Emotional range captured: ${integratedData.youtubeData ? 'YES' : 'LIMITED'}

Provide detailed analysis with specific quotes and attribution codes to support each insight.`;

  // Generate persona using Gemini
  const result = await geminiModel.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  
  return {
    persona: text,
    metadata: {
      totalDataPoints: integratedData.totalReviewCount,
      dataSources: integratedData.dataSources,
      youtubeComments: integratedData.youtubeData?.total_comments || 0,
      redditPosts: integratedData.redditData?.total_items || 0,
      competitorSites: integratedData.competitorData.length,
      dataQualityMet: integratedData.totalReviewCount >= 20
    }
  };
}