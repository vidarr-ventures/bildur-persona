import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Gemini AI with API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
// Use gemini-1.5-flash for better performance
const geminiModel = genAI.getGenerativeModel({ 
  model: 'gemini-1.5-flash',
  generationConfig: {
    temperature: 0.1,
    maxOutputTokens: 16000, // Doubled for more comprehensive output
  }
});

// Simple scraping function with metadata
export interface ScrapeResult {
  content: string;
  metadata: {
    totalPages: number;
    blogPages: number;
    faqPages: number;
    reviewPages: number;
    pagesScraped: string[];
  };
}

export async function scrapeWebsite(url: string, keywordPhrases: string[] = []): Promise<ScrapeResult> {
  try {
    const baseUrl = new URL(url).origin;
    let allContent = '';
    const maxContentLength = 200000; // Doubled to allow more comprehensive site crawling
    const scrapedUrls = new Set<string>();
    
    // Track page types
    const pageMetadata = {
      totalPages: 0,
      blogPages: 0,
      faqPages: 0,
      reviewPages: 0,
      pagesScraped: [] as string[],
    };
    
    // Extract text from HTML
    const extractText = (html: string): string => {
      return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Find high-value pages (blogs, FAQs, testimonials) with keyword focus
    const findValuePages = (html: string, baseUrl: string): string[] => {
      const links: Array<{ url: string; score: number; text: string }> = [];
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)</gi;
      let match;
      
      const highValuePatterns = [
        /blog/i, /faq/i, /testimonials?/i, /reviews?/i, 
        /case[-\s]?studies?/i, /success[-\s]?stories?/i, /customers?/i,
        /pricing/i, /support/i, /help/i, /product/i, /service/i
      ];

      // Create keyword patterns for relevance scoring
      const keywordPatterns = keywordPhrases.map(phrase => 
        new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      );
      
      while ((match = linkRegex.exec(html)) !== null) {
        let href = match[1];
        const linkText = match[2] || '';
        
        if (href.startsWith('/')) {
          href = baseUrl + href;
        } else if (!href.startsWith('http')) {
          continue;
        }
        
        if (!href.startsWith(baseUrl)) continue;
        
        // Score pages based on relevance
        let relevanceScore = 0;
        
        // High-value page type bonus
        const isHighValue = highValuePatterns.some(pattern => pattern.test(href));
        if (isHighValue) relevanceScore += 10;
        
        // Keyword relevance bonus
        if (keywordPhrases.length > 0) {
          keywordPatterns.forEach(pattern => {
            if (pattern.test(href) || pattern.test(linkText)) {
              relevanceScore += 20; // High bonus for keyword match
            }
          });
        }
        
        // Only include pages with some relevance score
        if (relevanceScore > 0) {
          links.push({ url: href, score: relevanceScore, text: linkText });
        }
      }
      
      // Sort by relevance score (highest first) and return URLs
      return links
        .sort((a, b) => b.score - a.score)
        .slice(0, 15) // Reduced for faster processing while maintaining quality
        .map(link => link.url);
    };

    // Helper to categorize page type
    const categorizeUrl = (url: string): void => {
      const urlLower = url.toLowerCase();
      if (/blog|article|post|news/i.test(urlLower)) {
        pageMetadata.blogPages++;
      } else if (/faq|question|help|support/i.test(urlLower)) {
        pageMetadata.faqPages++;
      } else if (/review|testimonial|feedback|customer/i.test(urlLower)) {
        pageMetadata.reviewPages++;
      }
    };

    // Scrape main page with timeout
    const mainResponse = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PersonaBot/1.0)' },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (!mainResponse.ok) {
      throw new Error(`HTTP ${mainResponse.status}: ${mainResponse.statusText}`);
    }
    
    const mainHtml = await mainResponse.text();
    const mainText = extractText(mainHtml);
    
    // Add keyword context to main page content
    const keywordContext = keywordPhrases.length > 0 
      ? `KEYWORD FOCUS: ${keywordPhrases.join(', ')}\n\n` 
      : '';
    
    allContent += `=== MAIN PAGE (${url}) ===\n${keywordContext}${mainText}\n\n`;
    scrapedUrls.add(url);
    pageMetadata.totalPages++;
    pageMetadata.pagesScraped.push(url);
    
    // Scrape high-value pages
    const valuePages = findValuePages(mainHtml, baseUrl);
    
    for (const link of valuePages) {
      if (scrapedUrls.has(link)) continue;
      if (allContent.length >= maxContentLength) break;
      
      try {
        const response = await fetch(link, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PersonaBot/1.0)' },
          signal: AbortSignal.timeout(8000), // 8 second timeout per page
        });
        
        if (response.ok) {
          const html = await response.text();
          const text = extractText(html);
          
          if (text.length > 100) {
            const pageTitle = link.split('/').pop() || 'page';
            allContent += `=== ${pageTitle.toUpperCase()} ===\n${text}\n\n`;
            scrapedUrls.add(link);
            pageMetadata.totalPages++;
            pageMetadata.pagesScraped.push(link);
            categorizeUrl(link);
          }
        }
      } catch (error) {
        // Continue with other pages - timeouts and network errors are expected
      }
      
      // Reduced delay from 500ms to 100ms for faster processing
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (allContent.length > maxContentLength) {
      allContent = allContent.substring(0, maxContentLength);
    }
    
    return {
      content: allContent,
      metadata: pageMetadata,
    };
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to scrape website: ${message}`);
  }
}

// Extract data using your exact prompt
export interface ExtractedData {
  demographics: any;
  customer_pain_points: any[];
  raw_customer_quotes: any[];
  value_propositions: any[];
  behavioral_patterns: any[];
  faq_count?: number;
  reviews_found?: number;
}

export async function extractDataWithAI(content: string, keywordPhrases: string[] = []): Promise<ExtractedData> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a market research analyst specializing in customer psychology and behavioral analysis. Analyze ALL provided content to extract structured data that will inform a comprehensive psychological customer persona.

## Content Scope Expectations
You should expect to receive content from:
- **Homepage** (initial company messaging and positioning)
- **ALL blog articles** (problems customers need help solving, educational content)
- **ALL FAQ pages** (real customer pain points, concerns, objections)
- **ALL product pages** (features, benefits, value propositions)
- **ALL review/testimonial pages** (authentic customer voice and experiences)
- **Pricing pages** (price sensitivity and positioning strategies)
- **About pages** (target market indicators, company values)
- **Support/help sections** (customer service issues and solutions)
- **Case studies** (customer success stories and use cases)

## Critical Analysis Requirement
**COMPREHENSIVE SITE ANALYSIS REQUIRED**: Do not analyze only homepage content. The website content provided should include material from blog posts, FAQ sections, product pages, customer reviews, testimonials, and all other relevant sections.

**Quality Check**: A thorough analysis should yield multiple customer quotes, diverse pain points, and rich behavioral insights from across the entire website, not just surface-level homepage messaging.

## Output Format
Return ONLY valid JSON with this exact structure - no markdown, no explanations, no additional text:

{
  "demographics": {
    "age_indicators": ["language complexity indicators", "technology references found"],
    "generation_clues": ["communication style patterns", "values expressed"],
    "income_signals": ["pricing tiers mentioned", "payment options shown"],
    "geographic_indicators": ["shipping options", "regional references"],
    "education_level": ["content complexity level", "technical depth"],
    "family_status": ["lifestyle references found"],
    "professional_background": ["industry terminology", "business context"]
  },
  "customer_pain_points": [
    {
      "pain": "specific pain point description",
      "emotional_intensity": "high/medium/low",
      "frequency_mentioned": "number of references",
      "evidence_source": "FAQ section/blog post/testimonial",
      "customer_language": "exact phrase customer used"
    }
  ],
  "raw_customer_quotes": [
    {
      "quote": "exact customer words - preserve ALL original language",
      "emotion_type": "frustration/excitement/fear/relief/pride/etc",
      "context": "testimonial/review/case study/FAQ response",
      "advertising_potential": "high/medium/low",
      "psychological_trigger": "achievement/autonomy/belonging/etc"
    }
  ],
  "value_propositions": [
    {
      "value": "specific benefit offered",
      "emphasis": "primary/secondary/tertiary",
      "emotional_appeal": "security/achievement/autonomy/etc",
      "supporting_evidence": "product features/testimonials/pricing"
    }
  ],
  "behavioral_patterns": [
    {
      "pattern": "social_proof/price_anchoring/loss_aversion/etc",
      "evidence": "how the site leverages this pattern",
      "customer_susceptibility": "high/medium/low"
    }
  ]
}

CRITICAL: Return ONLY the JSON object above - no markdown blocks, no explanations, no additional text.`
      },
      {
        role: "user",
        content: `Analyze this website content${keywordPhrases.length > 0 ? `, focusing particularly on these keyword phrases: ${keywordPhrases.join(', ')}` : ''}:\n\n${content}`
      }
    ],
    temperature: 0.1,
    max_tokens: 12000, // Further increased for comprehensive extraction
  });
  
  const extracted = JSON.parse(completion.choices[0].message.content || '{}');
  
  // Count FAQs and reviews in the content
  const faqMatches = content.match(/\?[\s\S]{1,200}(answer|response|solution|yes|no)/gi) || [];
  const reviewIndicators = content.match(/(testimonial|review|feedback|rating|stars?|customer said|client said)/gi) || [];
  
  return {
    ...extracted,
    faq_count: Math.floor(faqMatches.length / 2), // Rough estimate of Q&A pairs
    reviews_found: Math.floor(reviewIndicators.length / 3), // Rough estimate of review count
  };
}

// Generate fallback report when AI fails
function generateSimpleFallbackReport(combinedData: any): string {
  const userSite = combinedData.user_site || {};
  const competitors = combinedData.competitors || [];
  const summary = combinedData.summary || {};

  return `# Customer Persona Analysis (Fallback Report)

**Note: This analysis was generated using collected website data without AI processing due to a temporary service issue.**

## Analysis Summary
- **Websites analyzed**: ${summary.urls_analyzed || 0}
- **Customer quotes found**: ${summary.user_quotes || 0}
- **Competitor quotes**: ${summary.total_competitor_quotes || 0}
- **Data sources**: Website content, competitor analysis

## Key Demographics Indicators
${userSite.demographics ? Object.entries(userSite.demographics).map(([key, value]) => 
  `- **${key.replace(/_/g, ' ')}**: ${Array.isArray(value) ? value.join(', ') : value}`
).join('\n') : 'Demographics data collected from website analysis'}

## Customer Pain Points
${userSite.customer_pain_points?.slice(0, 5).map((p: any, i: number) => 
  `${i + 1}. **${p.pain || 'Pain point identified'}** (${p.emotional_intensity || 'medium'} intensity)`
).join('\n') || 'Multiple customer challenges identified in website content'}

## Customer Voice
${userSite.raw_customer_quotes?.slice(0, 3).map((q: any) => 
  `> "${q.quote}" *(${q.emotion_type})*`
).join('\n\n') || 'Customer feedback and testimonials collected from website'}

## Value Propositions
${userSite.value_propositions?.slice(0, 3).map((v: any, i: number) => 
  `${i + 1}. **${v.value || 'Value proposition'}** - ${v.emotional_appeal || 'customer benefit'}`
).join('\n') || 'Key value propositions identified from website messaging'}

## Behavioral Patterns
${userSite.behavioral_patterns?.slice(0, 3).map((p: any) => 
  `- **${p.pattern}**: ${p.evidence}`
).join('\n') || '- Social proof seeking behavior observed\n- Value-conscious decision making\n- Research-oriented purchasing approach'}

## Competitive Landscape
${competitors.length > 0 ? `Analyzed ${competitors.length} competitor websites for positioning and messaging insights.` : 'Limited competitor data available'}

## Recommendations
1. **Data Quality**: Continue collecting customer feedback to enhance persona accuracy
2. **Messaging**: Use identified customer language patterns in marketing materials  
3. **Pain Points**: Address the ${userSite.customer_pain_points?.length || 'multiple'} pain points identified in your value proposition
4. **Follow-up**: Retry full AI analysis when services are restored for detailed psychological insights

## Data Quality Assessment
- **Content Coverage**: ${userSite.faq_count ? `${userSite.faq_count} FAQ sections` : 'Website content'} analyzed
- **Review Data**: ${userSite.reviews_found || 0} customer reviews/testimonials found
- **Behavioral Insights**: ${userSite.behavioral_patterns?.length || 0} patterns identified

*This fallback analysis provides essential insights from your collected website data. For comprehensive psychological profiling and strategic recommendations, please retry when AI services are available.*`;
}

// Generate final persona report from all extracted data
export async function generateFinalReport(extractedData: any[]): Promise<any> {
  const userSite = extractedData.find(item => item.isUserSite);
  const competitors = extractedData.filter(item => !item.isUserSite);
  
  // Combine all data for final persona generation
  const combinedData = {
    user_site: userSite?.data || {},
    competitors: competitors.map(c => ({ url: c.url, data: c.data })),
    summary: {
      urls_analyzed: extractedData.length,
      user_quotes: userSite?.data?.raw_customer_quotes?.length || 0,
      total_competitor_quotes: competitors.reduce((sum, c) => sum + (c.data?.raw_customer_quotes?.length || 0), 0)
    }
  };
  
  // Generate comprehensive persona using Gemini 2.0 Flash with advanced 4,500-token framework
  const prompt = `Ultimate Psychological ICP Development Prompt

Overview
Create a comprehensive, psychologically nuanced Ideal Customer Profile (ICP) based on the collected research data from website analysis, competitor analysis, and customer insights. This ICP should go beyond traditional demographic data to deliver deep psychological insights about your target customer's mindstates, motivations, decision-making processes, life event triggers, and generational characteristics.

Data Integration Guidelines
Use the following collected data to inform your analysis:
* Website Content: Scraped content from user's website and competitor websites
* Customer Insights: Pain points, quotes, and behavioral patterns extracted from content
* Competitive Landscape: Competitor positioning and messaging analysis
* Target Keywords: User-specified keywords that define the focus area
* Review Data: Customer feedback and testimonials found across websites

Evidence Requirements:
* Quote actual customer text from the collected data to support behavioral insights
* Reference specific competitor positioning to identify market gaps
* Use authentic customer language patterns to understand voice
* Cite content trends and sentiment patterns from collected data

Framework Integration
This prompt integrates five powerful frameworks:
1. The ICP Research & Refinement Process
2. The Mindstate Behavioral Model
3. Predictably Irrational Behavioral Economics
4. The RMBC Research Method
5. Generational Marketing Strategy

Section 1: Customer Demographics & Psychographics

Demographic Profile
Based on the collected website content, competitor analysis, and extracted customer insights, infer specific details about who this customer is:
* Age range and generation (e.g., Millennials, Gen X)
* Gender distribution (if relevant from content patterns)
* Geographic location and living environment
* Education level and professional background (inferred from content sophistication)
* Income level and financial stability (based on pricing and positioning)
* Family status and household composition
* Technology adoption profile
* Cultural background and influences

Generational Analysis
Based on the predominant generation of your target customer, analyze their specific traits:

Baby Boomers (Born ~1946-1964) If your target customers are primarily Baby Boomers, consider:
* Strong brand loyalty when trust is established
* Preference for traditional marketing channels
* Emphasis on quality, reliability, and practical value over trends
* Gradual adoption of digital platforms
* Desire for straightforward, no-nonsense marketing
* Appreciation for loyalty programs and value propositions
* Lower trust in social media influencers
* Focus on practical benefits and proven results

Generation X (Born ~1965-1980) If your target customers are primarily Gen X, consider:
* Hybrid media consumption (mix of traditional and digital)
* Strong research orientation before purchasing
* High brand loyalty once earned, but pragmatic not blind
* Quality and value-seeking behavior
* Active on major social platforms, especially Facebook
* Email marketing effectiveness
* Lower ad aversion compared to younger generations
* Preference for authenticity and straight talk over hype

Millennials (Born ~1981-1996) If your target customers are primarily Millennials, consider:
* Digital-first approach with heavy smartphone usage
* Strong social media engagement across multiple platforms
* Desire for personalized experiences and convenience
* Expectation for brand values alignment and transparency
* High responsiveness to influencer marketing
* Preference for mobile-optimized experiences
* Emphasis on experiences and outcomes
* Strong loyalty when value is demonstrated

Generation Z (Born ~1997-2010) If your target customers are primarily Gen Z, consider:
* Digital natives with preference for visual, fast-paced content
* Heavy use of TikTok, Instagram, and YouTube
* Low inherent brand loyalty and high openness to new brands
* Strong demand for authenticity and social responsibility
* Preference for relatability over polish in marketing
* Integration of online and offline experiences
* Influence of peer recommendations and micro-influencers
* Need for interactive and participatory brand experiences

Psychographic Deep Dive
Go beyond surface-level information using content analysis to understand their inner world:

Core Attitudes and Values
* Religious, political, social, and economic attitudes that influence decisions
* Risk tolerance spectrum (conservative vs. adventurous)
* Key values that drive decisions (e.g., sustainability, tradition, innovation)
* Life priorities and how they allocate resources
* What makes them feel pride versus shame
* Generation-specific values and expectations from brands

Hopes, Dreams, and Fears
* Primary aspirations and goals (personal and professional)
* Definition of success in their own terms
* Deep-seated fears and anxieties revealed in content
* Specific worries related to your product/service area
* Emotional drivers behind their purchasing decisions
* What keeps them up at night
* Generational influences on long-term goals

Perceived Obstacles & Outside Forces
* External forces they believe are holding them back
* Systemic barriers they perceive
* Personal limitations they acknowledge
* Self-narratives about why they haven't solved their problem yet
* Outside forces they blame for their condition
* How they explain their own successes and failures

Section 2: Behavioral Psychology Analysis

Goal Assessment
Identify both functional and higher-order goals based on content analysis:

Functional Goals: What specific practical outcomes do they want to achieve?
* Daily tasks they need to accomplish
* Specific problems they're trying to solve
* Practical needs they want to meet

Higher-Order Goals: What deeper emotional outcomes are they seeking?
* How do they want to feel about themselves?
* How do they want others to perceive them?
* What identity are they trying to reinforce or achieve?
* What story are they trying to tell themselves?

Motivation Analysis
Identify the primary psychological motivation(s) driving their behavior from these nine core human motivations:
1. Achievement: Desire to feel successful, victorious, and to overcome obstacles
2. Autonomy: Desire to feel unique, independent, and self-determined
3. Belonging: Desire to feel aligned, accepted, and connected with others
4. Competence: Desire to feel capable, qualified, prepared, and skilled
5. Empowerment: Desire to feel authorized and equipped to act on choices
6. Engagement: Desire to feel captivated, excited, and interested
7. Esteem: Desire to feel approved, respected, and admired by others
8. Nurturance: Desire to feel appreciated, loved, and to care for others
9. Security: Desire to feel safe and protected from threats

Cognitive Heuristics & Predictable Irrationalities
Identify 3-5 key mental shortcuts and predictable irrationalities they exhibit based on content patterns:
* Price Anchoring: How initial price points influence their valuations
* Social Proof: How they rely on testimonials and case studies
* Loss Aversion: Overweighting potential negatives vs. positives
* Zero-Price Effect: Irrationally overvaluing "free" options
* Endowment Effect: Overvaluing things they already own
* Choice Overload: Decision paralysis when faced with too many options

For each pattern, explain:
* How it influences their decision-making
* Evidence from content showing this behavior
* How competitors currently exploit this pattern
* Opportunities to ethically leverage this insight

Section 3: Competitive Analysis Integration

Current Solutions Landscape
Analyze how your target customer currently addresses their needs based on competitor research:

Direct Competitors: What similar products/services do they currently use?
* Market leaders and their positioning
* Emerging alternatives gaining traction
* Features and benefits most valued by customers
* Pricing strategies and customer perception

Indirect Alternatives: What different approaches do they use?
* Adjacent categories that serve similar needs
* DIY or workaround solutions
* Non-consumption options

Competitive Differentiation Opportunities
Based on collected competitor data, identify:
* How competitor customers differ from your ideal target
* Messaging gaps in the current market
* Underserved persona segments
* Pain points competitors aren't addressing
* Language and positioning opportunities
* Price/value positioning gaps

Solution Experience Analysis
Evaluate how they experience existing solutions based on content analysis:

Positive Aspects: What do they consistently praise about current options?
* Features they love and wouldn't give up
* Benefits they actually experience
* Emotional satisfactions derived from current solutions

Pain Points: What frustrates them about current options?
* Common complaints across multiple solutions
* Deal-breakers that cause them to abandon solutions
* Unmet needs not addressed by any current option
* Misalignments between promises and experiences

Section 4: Life-Event Triggers & Transition Points

Life Event Analysis
Identify key life transitions that might trigger interest in your product/service:

Major Life Milestones: Which specific transitions create need for your offering?
* Career changes, business growth, scaling challenges
* Market shifts, competitive pressures
* Technology adoption cycles
* Regulatory or compliance changes
* Economic conditions and budget cycles

Behavioral Changes During Transitions: How do habits shift during these events?
* Increased research and information-seeking behaviors
* Greater openness to trying new solutions
* Changes in decision-making criteria
* Shifts in budget allocation and priorities

Section 5: Decision Journey Mapping

Journey Stages
Map their path from awareness to decision:

Awareness: How do they first recognize they have a need?
* Information sources they consult initially
* How challenges create awareness of new needs
* Key questions they have at this stage

Consideration: How do they explore and evaluate options?
* Research behaviors (depth, channels, time invested)
* Decision criteria they prioritize
* Influence of emotional states on consideration

Decision: What factors ultimately drive their choice?
* Final decision triggers evident in content
* Price sensitivity and value perception
* Trust factors and social proof requirements

Usage: How do they implement and experience the solution?
* Onboarding and implementation expectations
* Success metrics from their perspective
* Evolving needs as they gain experience

Section 6: Generation-Specific Marketing Strategy

Based on your target customer's generational profile, develop tailored marketing approaches:

Channel Strategy
Determine optimal marketing channels based on generational preferences.

Messaging Approach
Craft messaging that resonates with generational values and communication styles.

Loyalty & Engagement Strategy
Develop approaches to foster loyalty based on generational expectations.

Section 7: ICP Synthesis & Implementation Strategy

Executive Summary
Create a 1-paragraph overview of who this customer is and what fundamentally drives them, including their key predictable irrationalities and pivotal business events.

Primary Persona Development
Develop the main representative persona with:
* A descriptive name that captures their essence
* Age, generation, and key demographics
* A day-in-the-business narrative showing decision-making moments
* Key quotes from actual collected content that reflect their mindset
* Critical emotional and functional needs
* Primary decision drivers and cognitive biases they exhibit
* Price sensitivity and reference points they use
* Business events that would make them most receptive to your solution

Strategic Behavioral Implications
Extract key insights for business strategy:

Product Development:
* How should features be designed based on content feedback?
* What choice architecture will lead to optimal decisions?
* Which product aspects matter most during specific business events?

Pricing Strategy:
* What price anchors should you establish?
* How might you use competitor pricing as reference points?
* When should you employ bundling vs. unbundling?

Marketing Messaging:
* What benefit framing will be most effective?
* How should you set expectations to enhance experience?
* What language patterns from content should you adopt?

Customer Experience:
* What moments matter most based on content patterns?
* How can you address common pain points mentioned?
* What support might they need during different business stages?

Competitive Positioning:
* How can you differentiate from alternatives?
* What messaging gaps exist in the current market?
* How can you become the preferred choice in your category?

Key Customer Quotes
Using the collected data, extract 10 key quotes that are most likely to deeply resonate with potential customers if used in marketing. Include the source context for each quote.

Output Format Requirements
Deliver a structured markdown report with clear sections and actionable insights. Use actual quotes from collected content to support findings. Ensure all recommendations are grounded in the collected data rather than generic assumptions.

CRITICAL LENGTH REQUIREMENTS:
- Each major section (1-7) must contain 400-500 words minimum
- Total report length: 5,000-7,000 words for comprehensive analysis
- Provide detailed explanations, examples, and evidence for each point
- DO NOT summarize or be brief - be comprehensive and thorough
- If data is limited for a section, provide framework analysis and educated inferences based on available patterns

Focus: Actionable insights that directly inform product, marketing, and business strategy decisions
Evidence: Root all insights in the actual collected data from website content and competitive analysis.
Detail Level: Each section should be detailed enough to be a standalone mini-report.

Data to analyze:
${JSON.stringify(combinedData, null, 2).substring(0, 50000)}`; // Truncate to prevent excessive token usage

  let response: any;
  try {
    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8000, // Reduced for faster processing
      }
    });
    response = await result.response;
  } catch (error) {
    console.error('[Gemini API] Error generating final report:', error);
    // Generate fallback report using the available data
    return {
      ...combinedData,
      final_report: generateSimpleFallbackReport(combinedData)
    };
  }
  
  return {
    ...combinedData,
    final_report: response.text() || 'Report generation failed'
  };
}