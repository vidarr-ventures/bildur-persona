import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { saveJobData } from '@/lib/db';

interface WebsiteData {
  url: string;
  title: string;
  description: string;
  content: string;
  metadata: any;
}

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

async function crawlWebsite(url: string): Promise<WebsiteData | null> {
  try {
    console.log(`Crawling website: ${url}`);
    
    const response = await fetch('https://api.scrapeowl.com/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.SCRAPEOWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: process.env.SCRAPEOWL_API_KEY,
        url: url,
        elements: [
          { name: 'title', selector: 'title' },
          { name: 'description', selector: 'meta[name="description"]', attribute: 'content' },
          { name: 'h1', selector: 'h1', multiple: true },
          { name: 'h2', selector: 'h2', multiple: true },
          { name: 'paragraphs', selector: 'p', multiple: true },
          { name: 'links', selector: 'a', multiple: true, attribute: 'href' },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Scraping failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      url: url,
      title: data.title || 'No title found',
      description: data.description || 'No description found',
      content: [
        ...(data.h1 || []),
        ...(data.h2 || []),
        ...(data.paragraphs || [])
      ].join(' '),
      metadata: {
        headings: {
          h1: data.h1 || [],
          h2: data.h2 || []
        },
        links: data.links || [],
        crawled: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error(`Error crawling ${url}:`, error);
    return null;
  }
}

function analyzeWebsiteContent(websiteData: WebsiteData[], keywords: string): any {
  const allContent = websiteData.map(site => 
    `${site.title} ${site.description} ${site.content}`
  ).join(' ').toLowerCase();
  
  const keywordList = keywords.toLowerCase().split(' ');
  const keywordMatches = keywordList.map(keyword => ({
    keyword,
    count: (allContent.match(new RegExp(keyword, 'g')) || []).length
  }));
  
  const valueProps = extractValuePropositions(allContent);
  const brandMessaging = extractBrandMessaging(websiteData);
  const customerFocus = analyzeCustomerFocus(allContent);
  
  return {
    totalPages: websiteData.length,
    keywordRelevance: keywordMatches,
    valuePropositions: valueProps,
    brandMessaging: brandMessaging,
    customerFocus: customerFocus,
    contentThemes: extractContentThemes(allContent),
    metadata: {
      analyzed: new Date().toISOString(),
      keywords: keywords
    }
  };
}

function extractValuePropositions(content: string): string[] {
  const valuePatterns = [
    /(?:we|our)\s+(?:provide|offer|deliver|ensure|guarantee)[\s\w]{1,100}/gi,
    /(?:best|leading|top|premium|quality|reliable|trusted)[\s\w]{1,50}/gi,
    /(?:save|reduce|increase|improve|enhance|optimize)[\s\w]{1,50}/gi
  ];
  
const props: string[] = [];
  valuePatterns.forEach(pattern => {
    const matches = content.match(pattern) || [];
    props.push(...matches.slice(0, 5));
  });
  
  return [...new Set(props)].slice(0, 10);
}

function extractBrandMessaging(websites: WebsiteData[]): any {
  const titles = websites.map(site => site.title).join(' ');
  const descriptions = websites.map(site => site.description).join(' ');
  
  return {
    mainTitles: websites.map(site => site.title),
    descriptions: websites.map(site => site.description),
    tone: analyzeTone(titles + ' ' + descriptions),
    focusAreas: extractFocusAreas(titles + ' ' + descriptions)
  };
}

function analyzeTone(text: string): string {
  const professionalWords = ['professional', 'enterprise', 'business', 'corporate'];
  const friendlyWords = ['friendly', 'easy', 'simple', 'fun', 'enjoy'];
  const urgentWords = ['fast', 'quick', 'immediate', 'urgent', 'now'];
  
  const professionalCount = professionalWords.filter(word => text.toLowerCase().includes(word)).length;
  const friendlyCount = friendlyWords.filter(word => text.toLowerCase().includes(word)).length;
  const urgentCount = urgentWords.filter(word => text.toLowerCase().includes(word)).length;
  
  if (professionalCount > friendlyCount && professionalCount > urgentCount) return 'professional';
  if (friendlyCount > urgentCount) return 'friendly';
  if (urgentCount > 0) return 'urgent';
  return 'neutral';
}

function extractFocusAreas(text: string): string[] {
  const areas = ['quality', 'price', 'service', 'innovation', 'reliability', 'speed', 'convenience'];
  return areas.filter(area => text.toLowerCase().includes(area));
}

function analyzeCustomerFocus(content: string): any {
  const customerWords = (content.match(/\b(?:customer|client|user|buyer|you|your)\b/g) || []).length;
  const productWords = (content.match(/\b(?:product|service|solution|feature|benefit)\b/g) || []).length;
  
  return {
    customerMentions: customerWords,
    productMentions: productWords,
    customerFocusRatio: customerWords / Math.max(productWords, 1),
    isCustomerCentric: customerWords > productWords
  };
}

function extractContentThemes(content: string): string[] {
  const words = content.split(/\s+/).filter(word => word.length > 4);
  const wordCounts = words.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(wordCounts)
    .filter(([word, count]) => count >= 5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);
}

export async function POST(request: NextRequest) {
  try {
    const { jobId, websiteUrl, targetKeywords } = await request.json();

    if (!jobId || !websiteUrl) {
      return NextResponse.json({ error: 'Job ID and website URL are required' }, { status: 400 });
    }

    const primaryProductUrl = websiteUrl;
    console.log(`Starting website analysis for job ${jobId}: ${primaryProductUrl}`);
    
    // Update job status
    await updateJobStatus(jobId, 'processing');
    
    // Extract domain and prepare for crawling
    const domain = extractDomain(primaryProductUrl);
    if (!domain) {
      throw new Error('Invalid website URL provided');
    }

    await updateJobStatus(jobId, 'processing');
    
    // Crawl main pages
    const urlsToCrawl = [
      primaryProductUrl,
      `https://${domain}`,
      `https://${domain}/about`,
      `https://${domain}/products`,
      `https://${domain}/services`
    ];
    
    console.log(`Crawling ${urlsToCrawl.length} pages for comprehensive analysis...`);
    
    const websiteData: WebsiteData[] = [];
    for (let i = 0; i < urlsToCrawl.length; i++) {
      const url = urlsToCrawl[i];
      const data = await crawlWebsite(url);
      if (data) {
        websiteData.push(data);
      }
      
      // Update progress
      const progress = 30 + (i / urlsToCrawl.length) * 40;
      await updateJobStatus(jobId, 'processing');
    }

    if (websiteData.length === 0) {
      throw new Error('Could not crawl any pages from the website');
    }

    await updateJobStatus(jobId, 'processing');
    
    // Analyze website content
    const analysis = analyzeWebsiteContent(websiteData, targetKeywords || '');
    
    const websiteAnalysis = {
      pages: websiteData,
      analysis: analysis,
      metadata: {
        timestamp: new Date().toISOString(),
        domain: domain,
        totalPages: websiteData.length,
        keywords: targetKeywords
      }
    };

    await updateJobStatus(jobId, 'processing');

    // Save the website analysis data
    await saveJobData(jobId, 'website', websiteAnalysis);

    console.log(`Website analysis completed for job ${jobId}. Analyzed ${websiteData.length} pages.`);

    return NextResponse.json({
      success: true,
      message: 'Website analysis completed',
      data: {
        pagesAnalyzed: websiteData.length,
        domain: domain,
        keywordMatches: analysis.keywordRelevance,
        valuePropositions: analysis.valuePropositions.length
      }
    });

  } catch (error) {
    console.error('Website crawling error:', error);
    
    try {
      const { jobId } = await request.json();
      if (jobId) {
        await updateJobStatus(jobId, 'failed');
      }
    } catch (updateError) {
      console.error('Failed to update job status:', updateError);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Website analysis failed', details: errorMessage },
      { status: 500 }
    );
  }
}
