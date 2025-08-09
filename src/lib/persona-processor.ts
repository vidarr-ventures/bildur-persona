// Fresh persona processor - simple and direct
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface CustomerQuote {
  quote: string;
  emotion_type: string;
  context: string;
  quote_category: string;
  advertising_potential: string;
  psychological_appeal: string;
  authenticity_score: string;
}

export interface CustomerPainPoint {
  pain: string;
  emotional_intensity: string;
  frequency_mentioned: string;
  evidence_source: string;
  customer_language: string;
}

export interface DemographicIndicator {
  segment: string;
  confidence_level: string;
  evidence: string;
  generation_indicators: string;
}

export interface ValueProposition {
  value: string;
  emphasis: string;
  emotional_appeal: string;
  supporting_evidence: string;
}

export interface BehavioralPattern {
  pattern: string;
  evidence: string;
  customer_susceptibility: string;
}

export interface PriceSensitivity {
  apparent_income_level: string;
  price_anchors: string;
  value_justification: string;
  payment_options: string;
}

export interface RawCustomerQuote {
  quote: string;
  emotion_type: string;
  context: string;
  advertising_potential: string;
  psychological_trigger: string;
}

export interface PainPointQuote {
  quote: string;
  pain_category: string;
  emotional_intensity: string;
  context: string;
}

export interface SuccessQuote {
  quote: string;
  benefit_type: string;
  context: string;
  outcome_timeframe: string;
}

export interface PersonaResult {
  // Enhanced data structure matching new prompt
  customer_pain_points?: CustomerPainPoint[];
  demographic_indicators?: DemographicIndicator[];
  value_propositions?: ValueProposition[];
  behavioral_patterns?: BehavioralPattern[];
  price_sensitivity?: PriceSensitivity;
  raw_customer_quotes?: RawCustomerQuote[];
  pain_point_quotes?: PainPointQuote[];
  success_quotes?: SuccessQuote[];
  
  // Original structure for backward compatibility
  demographics: {
    age_indicators: string[];
    generation_clues: string[];
    income_signals: string[];
    geographic_indicators: string[];
    education_level: string[];
    family_status: string[];
    professional_background: string[];
  };
  psychographic_profile: {
    core_values: string[];
    lifestyle_priorities: string[];
    risk_tolerance: string;
    decision_making_style: string;
    brand_relationship: string;
  };
  functional_goals: Array<{
    goal: string;
    evidence: string;
    priority: string;
  }>;
  higher_order_goals: Array<{
    emotional_outcome: string;
    identity_goal: string;
    evidence: string;
  }>;
  psychological_motivations: Array<{
    motivation: string;
    strength: string;
    evidence: string;
  }>;
  cognitive_biases: Array<{
    bias_type: string;
    evidence: string;
    customer_susceptibility: string;
  }>;
  current_solutions: {
    direct_competitors: string[];
    indirect_alternatives: string[];
    status_quo: string[];
  };
  competitive_positioning: {
    differentiation_claims: string[];
    unique_value_props: string[];
    market_gaps: string[];
  };
  life_event_triggers: Array<{
    trigger_event: string;
    timing_context: string;
    evidence: string;
  }>;
  transition_behaviors: {
    research_intensity: string;
    openness_to_change: string;
    decision_timeline: string;
  };
  decision_journey: {
    awareness_triggers: string[];
    research_behavior: string[];
    evaluation_criteria: string[];
    purchase_triggers: string[];
    implementation_challenges: string[];
  };
  channel_preferences: {
    preferred_content_types: string[];
    social_media_usage: string[];
    information_sources: string[];
    communication_style: string[];
  };
  pricing_psychology: {
    price_anchors: string[];
    value_justification: string[];
    payment_preferences: string[];
    budget_constraints: string[];
    roi_expectations: string[];
  };
  brand_communication: {
    tone_characteristics: string[];
    language_patterns: string[];
    personality_traits: string[];
    differentiation_language: string[];
  };
  customer_quotes: CustomerQuote[];
  report: string;
}

export interface CompetitorAnalysis {
  competitor_url: string;
  competitor_name: string;
  data_extraction: PersonaResult;
  extraction_summary: {
    quotes_found: number;
    pain_points_identified: number;
    demographic_indicators: number;
    processing_time: number;
  };
  error?: string;
}

export interface DebugInfo {
  steps: Array<{
    name: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    duration?: number;
    data?: any;
  }>;
  competitors?: Array<{
    url: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    duration?: number;
    error?: string;
  }>;
}

// Comprehensive multi-page scraping
async function scrapeWebsite(url: string): Promise<string> {
  console.log(`[Scraper] Starting comprehensive scraping for ${url}...`);
  
  try {
    const baseUrl = new URL(url).origin;
    let allContent = '';
    const maxContentLength = 8000; // Further optimized for token limits - each URL processed separately
    const scrapedUrls = new Set<string>();
    
    // Helper function to extract text from HTML
    const extractText = (html: string): string => {
      return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Helper function to find relevant links
    const findRelevantLinks = (html: string, baseUrl: string): string[] => {
      const links: string[] = [];
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
      let match;
      
      // Prioritize pages with valuable customer data over generic corporate pages
      const highPriorityPatterns = [
        /blog/i, /faq/i, /testimonials?/i, /reviews?/i, 
        /case[-\s]?studies?/i, /success[-\s]?stories?/i, /customers?/i,
        /pricing/i, /support/i, /help/i
      ];
      
      const lowPriorityPatterns = [
        /about/i, /contact/i, /careers/i, /team/i, /company/i
      ];
      
      while ((match = linkRegex.exec(html)) !== null) {
        let href = match[1];
        
        // Convert relative URLs to absolute
        if (href.startsWith('/')) {
          href = baseUrl + href;
        } else if (!href.startsWith('http')) {
          continue; // Skip non-HTTP links
        }
        
        // Prioritize high-value pages over generic corporate pages
        const isHighPriority = highPriorityPatterns.some(pattern => pattern.test(href));
        const isLowPriority = lowPriorityPatterns.some(pattern => pattern.test(href));
        
        if (href.startsWith(baseUrl)) {
          if (isHighPriority) {
            links.unshift(href); // Add high priority pages to front
          } else if (isLowPriority) {
            links.push(href); // Add low priority pages to end
          }
        }
      }
      
      // Remove duplicates and limit to 3 pages, prioritizing high-value content
      const uniqueLinks = [...new Set(links)];
      return uniqueLinks.slice(0, 3);
    };

    // Scrape main page first
    console.log(`[Scraper] Fetching main page: ${url}`);
    const mainResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PersonaBot/1.0)',
      },
    });
    
    if (!mainResponse.ok) {
      throw new Error(`HTTP ${mainResponse.status}: ${mainResponse.statusText}`);
    }
    
    const mainHtml = await mainResponse.text();
    const mainText = extractText(mainHtml);
    allContent += `=== MAIN PAGE (${url}) ===\n${mainText}\n\n`;
    scrapedUrls.add(url);
    
    console.log(`[Scraper] Main page: ${mainText.length} characters`);
    
    // Find and scrape relevant pages
    const relevantLinks = findRelevantLinks(mainHtml, baseUrl);
    console.log(`[Scraper] Found ${relevantLinks.length} relevant pages to scrape:`, relevantLinks);
    
    for (const link of relevantLinks) {
      if (scrapedUrls.has(link) || allContent.length >= maxContentLength) {
        continue;
      }
      
      try {
        console.log(`[Scraper] Fetching: ${link}`);
        const response = await fetch(link, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; PersonaBot/1.0)',
          },
        });
        
        if (response.ok) {
          const html = await response.text();
          const text = extractText(html);
          
          if (text.length > 100) { // Only include pages with substantial content
            const pageTitle = link.split('/').pop() || 'page';
            allContent += `=== ${pageTitle.toUpperCase()} PAGE (${link}) ===\n${text}\n\n`;
            scrapedUrls.add(link);
            console.log(`[Scraper] ${pageTitle}: ${text.length} characters`);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.log(`[Scraper] Failed to fetch ${link}:`, message);
        // Continue with other pages
      }
      
      // Small delay to be respectful
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Trim to max length if needed - ensure we stay well under token limits
    if (allContent.length > maxContentLength) {
      allContent = allContent.substring(0, maxContentLength);
      console.log(`[Scraper] Content trimmed to ${maxContentLength} characters for token optimization`);
    }
    
    console.log(`[Scraper] Total content extracted: ${allContent.length} characters from ${scrapedUrls.size} pages`);
    return allContent;
    
  } catch (error) {
    console.error('[Scraper] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to scrape website: ${message}`);
  }
}

// Helper function to extract company name from URL
function extractCompanyName(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '');
    const parts = hostname.split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } catch {
    return 'Unknown Company';
  }
}

// Process competitor analysis
export async function processCompetitorAnalysis(
  competitorUrls: string[],
  debug = false
): Promise<{ competitors: CompetitorAnalysis[]; debug?: DebugInfo }> {
  const competitors: CompetitorAnalysis[] = [];
  const debugInfo: DebugInfo = { 
    steps: [], 
    competitors: competitorUrls.map(url => ({ 
      url, 
      status: 'pending' as const 
    }))
  };

  console.log(`[Competitor] Processing ${competitorUrls.length} competitors`);

  for (let i = 0; i < competitorUrls.length; i++) {
    const url = competitorUrls[i];
    const startTime = Date.now();
    
    if (debug && debugInfo.competitors) {
      debugInfo.competitors[i].status = 'processing';
    }

    try {
      console.log(`[Competitor] Processing ${url}...`);
      const result = await processPersonaAnalysis(url, false);
      const processingTime = Date.now() - startTime;
      
      const competitorAnalysis: CompetitorAnalysis = {
        competitor_url: url,
        competitor_name: extractCompanyName(url),
        data_extraction: result.result,
        extraction_summary: {
          quotes_found: result.result.customer_quotes?.length || 0,
          pain_points_identified: result.result.functional_goals?.length || 0,
          demographic_indicators: Object.values(result.result.demographics || {}).flat().length,
          processing_time: processingTime
        }
      };

      competitors.push(competitorAnalysis);
      
      if (debug && debugInfo.competitors) {
        debugInfo.competitors[i].status = 'completed';
        debugInfo.competitors[i].duration = processingTime;
      }

      console.log(`[Competitor] Completed ${url} in ${processingTime}ms`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
      console.error(`[Competitor] Failed to process ${url}:`, errorMessage);
      
      const failedAnalysis: CompetitorAnalysis = {
        competitor_url: url,
        competitor_name: extractCompanyName(url),
        data_extraction: {} as PersonaResult,
        extraction_summary: {
          quotes_found: 0,
          pain_points_identified: 0,
          demographic_indicators: 0,
          processing_time: Date.now() - startTime
        },
        error: errorMessage
      };

      competitors.push(failedAnalysis);
      
      if (debug && debugInfo.competitors) {
        debugInfo.competitors[i].status = 'failed';
        debugInfo.competitors[i].duration = Date.now() - startTime;
        debugInfo.competitors[i].error = errorMessage;
      }
    }

    // Small delay between competitors
    if (i < competitorUrls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`[Competitor] Processed ${competitors.length} competitors, ${competitors.filter(c => !c.error).length} successful`);

  return { competitors, debug: debug ? debugInfo : undefined };
}

// Direct OpenAI processing
export async function processPersonaAnalysis(
  url: string, 
  debug = false
): Promise<{ result: PersonaResult; debug?: DebugInfo }> {
  const debugInfo: DebugInfo = { steps: [] };
  
  if (debug) {
    debugInfo.steps.push({ name: 'URL Scraping', status: 'processing' });
  }
  
  const startTime = Date.now();
  console.log(`[Processor] Starting analysis for ${url}`);
  
  try {
    // Step 1: Scrape website
    const content = await scrapeWebsite(url);
    
    if (debug) {
      debugInfo.steps[0].status = 'completed';
      debugInfo.steps[0].duration = Date.now() - startTime;
      
      // Extract scraped page info from content
      const pageMatches = content.match(/=== (.+?) PAGE \((.+?)\) ===/g) || [];
      const scrapedPages = pageMatches.map(match => {
        const parts = match.match(/=== (.+?) PAGE \((.+?)\) ===/);
        return parts ? { title: parts[1], url: parts[2] } : null;
      }).filter(Boolean);
      
      debugInfo.steps[0].data = { 
        total_content_length: content.length,
        pages_scraped: scrapedPages.length,
        scraped_pages: scrapedPages
      };
      debugInfo.steps.push({ name: 'AI Analysis', status: 'processing' });
    }
    
    // Step 2: OpenAI analysis
    const aiStart = Date.now();
    
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
**COMPREHENSIVE SITE ANALYSIS REQUIRED**: Do not analyze only homepage content. The website content provided should include material from blog posts, FAQ sections, product pages, customer reviews, testimonials, and all other relevant sections. If you receive limited content that appears to be only from a homepage, request more comprehensive site content that includes:

- Multiple blog articles showing customer problems and solutions
- FAQ sections revealing customer pain points and concerns  
- Product pages with detailed features and customer benefits
- Customer testimonials, reviews, and case studies
- Pricing information and value propositions
- Support documentation showing common customer issues

**Quality Check**: A thorough analysis should yield multiple customer quotes, diverse pain points, and rich behavioral insights from across the entire website, not just surface-level homepage messaging.

## Data to Extract

### 1. Structured Insights for Aggregation
Return the following data in JSON format for combining with other sources:

**Customer Pain Points:**
"customer_pain_points": [
  {
    "pain": "specific pain point description",
    "emotional_intensity": "high/medium/low",
    "frequency_mentioned": "number of references",
    "evidence_source": "FAQ section/blog post/testimonial",
    "customer_language": "exact phrase customer used"
  }
]

**Target Demographics Indicators:**
"demographic_indicators": [
  {
    "segment": "small business owners/professionals/consumers/etc",
    "confidence_level": "0.1-1.0",
    "evidence": "pricing tiers/language complexity/feature focus",
    "generation_indicators": "tech adoption/communication style/values"
  }
]

**Value Propositions:**
"value_propositions": [
  {
    "value": "specific benefit offered",
    "emphasis": "primary/secondary/tertiary",
    "emotional_appeal": "security/achievement/autonomy/etc",
    "supporting_evidence": "product features/testimonials/pricing"
  }
]

**Psychological Motivations:**
"psychological_motivations": [
  {
    "motivation": "achievement/autonomy/belonging/competence/empowerment/engagement/esteem/nurturance/security",
    "strength": "high/medium/low", 
    "evidence": "specific language or messaging that reveals this motivation"
  }
]

**Cognitive Biases/Behavioral Patterns:**
"behavioral_patterns": [
  {
    "pattern": "social_proof/price_anchoring/loss_aversion/etc",
    "evidence": "how the site leverages this pattern",
    "customer_susceptibility": "high/medium/low"
  }
]

**Life Event Triggers:**
"life_event_triggers": [
  {
    "trigger": "specific life event or transition",
    "timing": "when this creates need for the product",
    "evidence": "testimonials/case studies mentioning this context"
  }
]

**Price Sensitivity Indicators:**
"price_sensitivity": {
  "apparent_income_level": "budget/mid-market/premium",
  "price_anchors": "specific prices mentioned or emphasized",
  "value_justification": "how they justify higher prices",
  "payment_options": "what payment flexibility is offered"
}

### 2. Raw Customer Quotes for Final Report
Extract verbatim quotes that show authentic customer voice and emotional language:

**Emotionally Resonant Quotes:**
"raw_customer_quotes": [
  {
    "quote": "exact customer words - preserve ALL original language",
    "emotion_type": "frustration/excitement/fear/relief/pride/etc",
    "context": "testimonial/review/case study/FAQ response",
    "advertising_potential": "high/medium/low",
    "psychological_trigger": "which of the 9 core motivations this appeals to"
  }
]

**Pain Point Quotes:**
"pain_point_quotes": [
  {
    "quote": "exact words describing their problem or frustration",
    "pain_category": "time/money/complexity/fear/status/etc",
    "emotional_intensity": "high/medium/low",
    "context": "where this appeared on the site"
  }
]

**Success/Transformation Quotes:**
"success_quotes": [
  {
    "quote": "exact words describing positive outcomes or transformations",
    "benefit_type": "functional/emotional/social",
    "context": "testimonial/case study/review",
    "outcome_timeframe": "immediate/weeks/months/long-term"
  }
]

## Analysis Instructions

1. **Preserve Original Language**: For all quotes, maintain exact wording, grammar, and punctuation - do not paraphrase or clean up
2. **Look for Emotion**: Prioritize content that reveals feelings, not just facts
3. **Identify Patterns**: Note recurring themes across different pages
4. **Infer Psychology**: What deeper motivations and fears drive these customers?
5. **Evidence-Based**: Only include insights you can support with specific website content
6. **Generational Clues**: Note language patterns, tech adoption, values that suggest age groups

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
  ],
  "psychographic_profile": {
    "core_values": ["sustainability", "quality", "innovation"],
    "lifestyle_priorities": ["convenience", "status", "health"],
    "risk_tolerance": "conservative/moderate/adventurous",
    "decision_making_style": "analytical/emotional/social_proof_driven",
    "brand_relationship": "loyal/switcher/price_sensitive/quality_focused"
  },
  "functional_goals": [
    {
      "goal": "specific practical outcome wanted",
      "evidence": "where this was mentioned on site",
      "priority": "high/medium/low"
    }
  ],
  "psychological_motivations": [
    {
      "motivation": "achievement/autonomy/belonging/competence/empowerment/engagement/esteem/nurturance/security",
      "strength": "high/medium/low",
      "evidence": "specific language revealing this motivation"
    }
  ],
  "customer_quotes": [
    {
      "quote": "EXACT customer words - preserve ALL original language and punctuation",
      "emotion_type": "frustration/excitement/fear/relief/pride/anxiety/hope",
      "context": "testimonial/review/FAQ/case study/blog comment",
      "quote_category": "pain_point/success_story/motivation/objection/benefit",
      "advertising_potential": "high/medium/low",
      "psychological_appeal": "achievement/autonomy/belonging/competence/empowerment/engagement/esteem/nurturance/security",
      "authenticity_score": "high/medium/low"
    }
  ],
  "report": "Comprehensive markdown report with detailed psychological customer persona analysis..."
}

CRITICAL: Return ONLY the JSON object above - no markdown blocks, no explanations, no additional text.`
        },
        {
          role: "user",
          content: `Analyze this website content and create a customer persona:\n\n${content}`
        }
      ],
      temperature: 0.1,
      max_tokens: 4000,
    });
    
    const result = JSON.parse(completion.choices[0].message.content || '{}');
    
    if (debug) {
      debugInfo.steps[1].status = 'completed';
      debugInfo.steps[1].duration = Date.now() - aiStart;
      debugInfo.steps[1].data = { 
        tokens_used: completion.usage?.total_tokens,
        model: completion.model 
      };
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`[Processor] Analysis completed in ${totalTime}ms`);
    
    return { result, debug: debug ? debugInfo : undefined };
    
  } catch (error) {
    console.error('[Processor] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
    
    if (debug) {
      const currentStep = debugInfo.steps.find(s => s.status === 'processing');
      if (currentStep) {
        currentStep.status = 'failed';
        currentStep.data = { error: errorMessage };
      }
    }
    
    throw new Error(`Analysis failed: ${errorMessage}`);
  }
}