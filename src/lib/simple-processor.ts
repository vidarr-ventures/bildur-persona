import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simple scraping function
export async function scrapeWebsite(url: string): Promise<string> {
  try {
    const baseUrl = new URL(url).origin;
    let allContent = '';
    const maxContentLength = 8000;
    const scrapedUrls = new Set<string>();
    
    // Extract text from HTML
    const extractText = (html: string): string => {
      return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Find high-value pages (blogs, FAQs, testimonials)
    const findValuePages = (html: string, baseUrl: string): string[] => {
      const links: string[] = [];
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
      let match;
      
      const highValuePatterns = [
        /blog/i, /faq/i, /testimonials?/i, /reviews?/i, 
        /case[-\s]?studies?/i, /success[-\s]?stories?/i, /customers?/i,
        /pricing/i, /support/i, /help/i
      ];
      
      while ((match = linkRegex.exec(html)) !== null) {
        let href = match[1];
        
        if (href.startsWith('/')) {
          href = baseUrl + href;
        } else if (!href.startsWith('http')) {
          continue;
        }
        
        const isHighValue = highValuePatterns.some(pattern => pattern.test(href));
        if (isHighValue && href.startsWith(baseUrl)) {
          links.unshift(href); // High value pages first
        }
      }
      
      return [...new Set(links)].slice(0, 3);
    };

    // Scrape main page
    const mainResponse = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PersonaBot/1.0)' },
    });
    
    if (!mainResponse.ok) {
      throw new Error(`HTTP ${mainResponse.status}: ${mainResponse.statusText}`);
    }
    
    const mainHtml = await mainResponse.text();
    const mainText = extractText(mainHtml);
    allContent += `=== MAIN PAGE ===\n${mainText}\n\n`;
    scrapedUrls.add(url);
    
    // Scrape high-value pages
    const valuePages = findValuePages(mainHtml, baseUrl);
    
    for (const link of valuePages) {
      if (scrapedUrls.has(link) || allContent.length >= maxContentLength) break;
      
      try {
        const response = await fetch(link, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PersonaBot/1.0)' },
        });
        
        if (response.ok) {
          const html = await response.text();
          const text = extractText(html);
          
          if (text.length > 100) {
            const pageTitle = link.split('/').pop() || 'page';
            allContent += `=== ${pageTitle.toUpperCase()} ===\n${text}\n\n`;
            scrapedUrls.add(link);
          }
        }
      } catch (error) {
        // Continue with other pages
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (allContent.length > maxContentLength) {
      allContent = allContent.substring(0, maxContentLength);
    }
    
    return allContent;
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to scrape website: ${message}`);
  }
}

// Extract data using your exact prompt
export async function extractDataWithAI(content: string): Promise<any> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
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
        content: `Analyze this website content:\n\n${content}`
      }
    ],
    temperature: 0.1,
    max_tokens: 4000,
  });
  
  return JSON.parse(completion.choices[0].message.content || '{}');
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
  
  // Generate comprehensive persona using your persona prompt
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `Create a comprehensive customer persona report by analyzing the provided data from multiple websites. Focus on psychological insights, behavioral patterns, and actionable recommendations.

Generate a detailed markdown report that includes:
1. Executive Summary
2. Primary Customer Profile
3. Pain Points Analysis
4. Competitive Landscape
5. Marketing Recommendations
6. Key Customer Quotes

Be specific and evidence-based. Use the actual customer quotes and data provided.`
      },
      {
        role: "user",
        content: `Generate a comprehensive customer persona report from this data:\n\n${JSON.stringify(combinedData, null, 2)}`
      }
    ],
    temperature: 0.1,
    max_tokens: 4000,
  });
  
  return {
    ...combinedData,
    final_report: completion.choices[0].message.content || 'Report generation failed'
  };
}