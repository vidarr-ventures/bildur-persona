// src/app/api/workers/website-crawler/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus, saveJobData } from '@/lib/db';

interface WebsiteData {
  url: string;
  title: string;
  content: string;
  valuePropositions: string[];
  features: string[];
  benefits: string[];
  keywords: string[];
  metadata: {
    timestamp: string;
    contentLength: number;
    extractionMethod: string;
    success: boolean;
  };
}

async function crawlWebsiteMultipleWays(websiteUrl: string, targetKeywords: string[]): Promise<WebsiteData | null> {
  console.log(`Starting multi-method crawl for: ${websiteUrl}`);
  
  // Method 1: Direct fetch with multiple user agents
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
  ];
  
  for (const userAgent of userAgents) {
    try {
      console.log(`Trying direct fetch with user agent: ${userAgent.substring(0, 50)}...`);
      
      const response = await fetch(websiteUrl, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0',
        }
      });

      if (response.ok) {
        const html = await response.text();
        console.log(`Direct fetch successful! Got ${html.length} characters`);
        
        if (html.length > 1000) { // Reasonable content length
          const result = processHTML(html, websiteUrl, targetKeywords, 'direct_fetch');
          if (result && result.content.length > 100) {
            return result;
          }
        }
      } else {
        console.log(`Direct fetch failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`Direct fetch error:`, error);
    }
  }
  
  // Method 2: Try with ScrapeOwl as fallback (if available)
  if (process.env.SCRAPEOWL_API_KEY) {
    try {
      console.log('Trying ScrapeOwl as fallback...');
      
      const response = await fetch('https://api.scrapeowl.com/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${process.env.SCRAPEOWL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: process.env.SCRAPEOWL_API_KEY,
          url: websiteUrl,
          render_js: true,
          wait_for: 2000,
          elements: [
            { name: 'page_content', selector: 'body' },
            { name: 'title', selector: 'title' },
            { name: 'meta_description', selector: 'meta[name="description"]', attribute: 'content' },
            { name: 'headings', selector: 'h1, h2, h3', multiple: true },
            { name: 'paragraphs', selector: 'p', multiple: true }
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('ScrapeOwl successful!');
        
        if (data.page_content) {
          const html = data.page_content;
          const result = processHTML(html, websiteUrl, targetKeywords, 'scrapeowl');
          if (result && result.content.length > 100) {
            return result;
          }
        }
      } else {
        const errorText = await response.text();
        console.log('ScrapeOwl failed:', response.status, errorText);
      }
    } catch (error) {
      console.log('ScrapeOwl error:', error);
    }
  }
  
  // Method 3: Create minimal data from URL and keywords if all else fails
  console.log('All crawling methods failed, creating minimal data...');
  return createMinimalWebsiteData(websiteUrl, targetKeywords);
}

function processHTML(html: string, websiteUrl: string, targetKeywords: string[], method: string): WebsiteData | null {
  try {
    // Extract text content
    const textContent = extractTextFromHTML(html);
    const title = extractTitle(html);
    
    if (textContent.length < 100) {
      console.log(`Insufficient content extracted: ${textContent.length} characters`);
      return null;
    }
    
    // Analyze content for key information
    const analysis = analyzeWebsiteContent(textContent, targetKeywords);
    
    const websiteData: WebsiteData = {
      url: websiteUrl,
      title: title,
      content: textContent.substring(0, 5000), // First 5000 chars
      valuePropositions: analysis.valuePropositions,
      features: analysis.features,
      benefits: analysis.benefits,
      keywords: analysis.keywords,
      metadata: {
        timestamp: new Date().toISOString(),
        contentLength: textContent.length,
        extractionMethod: method,
        success: true
      }
    };

    console.log(`Content processed via ${method}:`, {
      titleLength: title.length,
      contentLength: textContent.length,
      valuePropsFound: analysis.valuePropositions.length,
      featuresFound: analysis.features.length,
      benefitsFound: analysis.benefits.length,
      keywordsFound: analysis.keywords.length
    });

    return websiteData;
  } catch (error) {
    console.error('Error processing HTML:', error);
    return null;
  }
}

function extractTextFromHTML(html: string): string {
  // Remove script and style tags completely
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
  
  // Remove HTML tags but keep the text
  text = text.replace(/<[^>]*>/g, ' ');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&apos;/g, "'");
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();
  
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) return h1Match[1].replace(/<[^>]*>/g, '').trim();
  
  return 'Website Title';
}

function analyzeWebsiteContent(content: string, targetKeywords: string[]): {
  valuePropositions: string[];
  features: string[];
  benefits: string[];
  keywords: string[];
} {
  const contentLower = content.toLowerCase();
  
  // Extract value propositions (sentences with key value words)
  const valueWords = ['premium', 'best', 'quality', 'professional', 'certified', 'proven', 'guaranteed', 'exclusive', 'advanced', 'superior', 'leading', 'trusted', 'award-winning', 'scientifically', 'clinically'];
  const valuePropositions = extractSentencesWithWords(content, valueWords, 150).slice(0, 6);
  
  // Extract features (sentences with feature/specification words)
  const featureWords = ['made', 'includes', 'features', 'contains', 'designed', 'built', 'comes with', 'equipped', 'material', 'fabric', 'thread', 'cotton', 'silver', 'conductive', 'organic'];
  const features = extractSentencesWithWords(content, featureWords, 120).slice(0, 8);
  
  // Extract benefits (sentences with benefit words)
  const benefitWords = ['helps', 'improves', 'reduces', 'increases', 'better', 'enhanced', 'relief', 'healing', 'sleep', 'health', 'wellness', 'benefits', 'feel', 'experience', 'achieve'];
  const benefits = extractSentencesWithWords(content, benefitWords, 120).slice(0, 8);
  
  // Find target keyword mentions
  const foundKeywords: string[] = [];
  targetKeywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase().trim();
    if (contentLower.includes(keywordLower)) {
      foundKeywords.push(keyword.trim());
    }
  });
  
  // Extract product-specific keywords
  const productKeywords = extractProductKeywords(content, targetKeywords);
  
  return {
    valuePropositions,
    features,
    benefits,
    keywords: [...foundKeywords, ...productKeywords].slice(0, 15)
  };
}

function extractSentencesWithWords(content: string, targetWords: string[], maxLength: number = 150): string[] {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 30);
  const matchingSentences: string[] = [];
  
  sentences.forEach(sentence => {
    const sentenceLower = sentence.toLowerCase();
    const hasTargetWord = targetWords.some(word => sentenceLower.includes(word.toLowerCase()));
    
    if (hasTargetWord && sentence.trim().length > 40 && sentence.trim().length < maxLength) {
      matchingSentences.push(sentence.trim());
    }
  });
  
  return [...new Set(matchingSentences)]; // Remove duplicates
}

function extractProductKeywords(content: string, targetKeywords: string[]): string[] {
  // Base keywords from target
  const baseKeywords = targetKeywords.flatMap(k => k.toLowerCase().split(/[\s,]+/));
  
  // Common product-related terms
  const productTerms = content.match(/\b(grounding|earthing|conductive|organic|cotton|silver|copper|sheet|mat|pad|wellness|sleep|health|natural|therapy|healing|premium|quality|certified|proven|warranty|guarantee)\b/gi) || [];
  
  // Clean and deduplicate
  const uniqueTerms = [...new Set([...baseKeywords, ...productTerms.map(term => term.toLowerCase())])];
  
  return uniqueTerms.slice(0, 12);
}

function createMinimalWebsiteData(websiteUrl: string, targetKeywords: string[]): WebsiteData {
  console.log('Creating minimal fallback data...');
  
  return {
    url: websiteUrl,
    title: 'Website Content',
    content: `Website content for ${targetKeywords.join(', ')} products. This website offers ${targetKeywords.join(' and ')} with various features and benefits.`,
    valuePropositions: [`Quality ${targetKeywords.join(' and ')} products`],
    features: [`${targetKeywords.join(' and ')} available`],
    benefits: [`Benefits of ${targetKeywords.join(' and ')}`],
    keywords: targetKeywords,
    metadata: {
      timestamp: new Date().toISOString(),
      contentLength: 0,
      extractionMethod: 'minimal_fallback',
      success: false
    }
  };
}

export async function POST(request: NextRequest) {
  try {
    const { jobId, websiteUrl, targetKeywords } = await request.json();

    if (!jobId || !websiteUrl) {
      return NextResponse.json({ 
        error: 'Job ID and website URL are required' 
      }, { status: 400 });
    }

    console.log(`Starting robust website crawl for job ${jobId}: ${websiteUrl}`);
    
    await updateJobStatus(jobId, 'processing');
    
    // Parse keywords
    const keywords = typeof targetKeywords === 'string' 
      ? targetKeywords.split(',').map(k => k.trim())
      : targetKeywords || [];
    
    console.log('Target keywords:', keywords);
    
    // Crawl the website using multiple methods
    const websiteData = await crawlWebsiteMultipleWays(websiteUrl, keywords);
    
    if (!websiteData) {
      console.log('All website crawl methods failed');
      const fallbackData = createMinimalWebsiteData(websiteUrl, keywords);
      await saveJobData(jobId, 'website', fallbackData);
      
      return NextResponse.json({
        success: true,
        message: 'Website crawl completed with minimal data',
        data: { 
          url: websiteUrl, 
          contentLength: 0,
          method: 'fallback',
          valuePropositions: fallbackData.valuePropositions.length,
          features: fallbackData.features.length,
          benefits: fallbackData.benefits.length
        }
      });
    }

    // Save the website data
    await saveJobData(jobId, 'website', websiteData);

    console.log(`Website crawl completed for job ${jobId} using ${websiteData.metadata.extractionMethod}`);

    return NextResponse.json({
      success: true,
      message: 'Website crawl completed successfully',
      data: {
        url: websiteUrl,
        title: websiteData.title,
        contentLength: websiteData.content.length,
        method: websiteData.metadata.extractionMethod,
        valuePropositions: websiteData.valuePropositions.length,
        features: websiteData.features.length,
        benefits: websiteData.benefits.length,
        keywords: websiteData.keywords.length,
        preview: websiteData.content.substring(0, 200) + '...'
      }
    });

  } catch (error) {
    console.error('Website crawler error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Website crawl failed', details: errorMessage },
      { status: 500 }
    );
  }
}
