import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus, saveJobData } from '@/lib/db';
import { validateInternalApiKey, createAuthErrorResponse } from '@/lib/auth';
import { scrapeWebsiteWithFirecrawl, isFirecrawlAvailable } from '@/lib/firecrawl';
import { routeDataCollection } from '@/lib/data-collection-router';

interface WebsiteData {
  homePageContent: string;
  customerReviews: string[];
  testimonials: string[];
  valuePropositions: string[];
  features: string[];
  brandMessaging: string;
}

async function crawlWebsiteContent(websiteUrl: string, targetKeywords: string): Promise<WebsiteData & { firecrawlUsed: boolean; dataQuality: any }> {
  // Try enhanced Firecrawl scraping first
  if (isFirecrawlAvailable()) {
    try {
      console.log(`🔥 Using Firecrawl for enhanced website scraping: ${websiteUrl}`);
      
      const firecrawlResult = await scrapeWebsiteWithFirecrawl(websiteUrl);
      
      if (firecrawlResult.success && firecrawlResult.data) {
        const { markdown, content, metadata } = firecrawlResult.data;
        
        // Extract structured data from Firecrawl results
        const extractedData = extractDataFromFirecrawlContent(markdown || content || '', metadata);
        
        return {
          ...extractedData,
          firecrawlUsed: true,
          dataQuality: {
            method: 'firecrawl',
            contentLength: (markdown || content || '').length,
            hasMetadata: !!metadata,
            title: metadata?.title,
            description: metadata?.description
          }
        };
      } else {
        console.warn('Firecrawl failed, falling back to basic scraping:', firecrawlResult.error);
      }
    } catch (error) {
      console.error('Firecrawl error, falling back to basic scraping:', error);
    }
  }

  // Fallback to basic scraping
  console.log(`Using basic scraping for: ${websiteUrl}`);
  
  try {
    // Create a timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(websiteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    
    return {
      homePageContent: extractMainContent(html),
      customerReviews: extractReviews(html),
      testimonials: extractTestimonials(html),
      valuePropositions: extractValueProps(html),
      features: extractFeatures(html),
      brandMessaging: extractBrandMessage(html),
      firecrawlUsed: false,
      dataQuality: {
        method: 'basic_fetch',
        contentLength: html.length,
        hasMetadata: false
      }
    };

  } catch (error) {
    console.error('Error crawling website:', error);
    return {
      homePageContent: '',
      customerReviews: [],
      testimonials: [],
      valuePropositions: [],
      features: [],
      brandMessaging: '',
      firecrawlUsed: false,
      dataQuality: {
        method: 'failed',
        contentLength: 0,
        hasMetadata: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

function extractDataFromFirecrawlContent(content: string, metadata: any): WebsiteData {
  console.log(`Extracting data from Firecrawl content (${content.length} chars)`);
  
  // Extract value propositions from headings and key sections
  const valuePropositions = extractValuePropsFromMarkdown(content);
  
  // Extract features from list items and feature sections
  const features = extractFeaturesFromMarkdown(content);
  
  // Extract testimonials and reviews
  const customerReviews = extractReviewsFromMarkdown(content);
  const testimonials = extractTestimonialsFromMarkdown(content);
  
  // Use metadata for brand messaging, fallback to first heading
  const brandMessaging = metadata?.title || metadata?.description || extractMainHeading(content);
  
  // Get main content (first 2000 chars of cleaned content)
  const homePageContent = content.replace(/[#*_`]/g, '').replace(/\n+/g, ' ').trim().substring(0, 2000);
  
  console.log(`Extracted: ${valuePropositions.length} value props, ${features.length} features, ${customerReviews.length} reviews, ${testimonials.length} testimonials`);
  
  return {
    homePageContent,
    customerReviews,
    testimonials,
    valuePropositions,
    features,
    brandMessaging
  };
}

function extractValuePropsFromMarkdown(content: string): string[] {
  const valueProps: string[] = [];
  
  // Extract from headings (H1-H3)
  const headingMatches = content.match(/^#{1,3}\s+(.+)$/gm) || [];
  headingMatches.forEach(match => {
    const clean = match.replace(/^#+\s*/, '').trim();
    if (clean.length > 10 && clean.length < 200 && !clean.toLowerCase().includes('menu')) {
      valueProps.push(clean);
    }
  });
  
  // Extract from key sections that might contain value props
  const sections = content.split(/\n#{1,3}\s/);
  sections.forEach(section => {
    const lines = section.split('\n').filter(line => line.trim().length > 20);
    lines.slice(0, 2).forEach(line => {
      const clean = line.replace(/[*_#]/g, '').trim();
      if (clean.length > 15 && clean.length < 150) {
        valueProps.push(clean);
      }
    });
  });
  
  return [...new Set(valueProps)].slice(0, 8);
}

function extractFeaturesFromMarkdown(content: string): string[] {
  const features: string[] = [];
  
  // Extract from bulleted lists
  const listMatches = content.match(/^[-*+]\s+(.+)$/gm) || [];
  listMatches.forEach(match => {
    const clean = match.replace(/^[-*+]\s+/, '').replace(/[*_]/g, '').trim();
    if (clean.length > 8 && clean.length < 150) {
      features.push(clean);
    }
  });
  
  // Extract from numbered lists
  const numberedMatches = content.match(/^\d+\.\s+(.+)$/gm) || [];
  numberedMatches.forEach(match => {
    const clean = match.replace(/^\d+\.\s+/, '').replace(/[*_]/g, '').trim();
    if (clean.length > 8 && clean.length < 150) {
      features.push(clean);
    }
  });
  
  return [...new Set(features)].slice(0, 12);
}

function extractReviewsFromMarkdown(content: string): string[] {
  const reviews: string[] = [];
  
  // Look for quoted content that might be reviews
  const quoteMatches = content.match(/["""]([^"""]{30,300})["""]/g) || [];
  quoteMatches.forEach(match => {
    const clean = match.replace(/["""]/g, '').trim();
    if (clean.length > 30 && clean.length < 400) {
      reviews.push(clean);
    }
  });
  
  // Look for review-like patterns in blockquotes or similar
  const blockMatches = content.match(/>\s*([^<\n]{30,300})/g) || [];
  blockMatches.forEach(match => {
    const clean = match.replace(/>\s*/, '').trim();
    if (clean.length > 30 && clean.length < 400 && !clean.toLowerCase().includes('http')) {
      reviews.push(clean);
    }
  });
  
  return [...new Set(reviews)].slice(0, 10);
}

function extractTestimonialsFromMarkdown(content: string): string[] {
  const testimonials: string[] = [];
  
  // Look for testimonial sections
  const testimonialSections = content.split(/testimonials?|reviews?|feedback/i);
  if (testimonialSections.length > 1) {
    testimonialSections.slice(1).forEach(section => {
      const quotes = section.match(/["""]([^"""]{40,300})["""]/g) || [];
      quotes.forEach(quote => {
        const clean = quote.replace(/["""]/g, '').trim();
        testimonials.push(clean);
      });
    });
  }
  
  return [...new Set(testimonials)].slice(0, 8);
}

function extractMainHeading(content: string): string {
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }
  
  const firstLine = content.split('\n').find(line => line.trim().length > 10);
  return firstLine ? firstLine.replace(/[#*_]/g, '').trim() : '';
}

function extractMainContent(html: string): string {
  // Remove scripts and styles
  let content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Clean HTML tags
  content = content.replace(/<[^>]*>/g, ' ');
  content = content.replace(/\s+/g, ' ');
  content = content.trim();
  
  return content.substring(0, 2000);
}

function extractReviews(html: string): string[] {
  const reviews: string[] = [];
  
  // Look for review patterns
  const reviewPatterns = [
    /"[^"]{50,300}"/g,
    /★+.*?"[^"]{30,200}"/g
  ];

  reviewPatterns.forEach(pattern => {
    const matches = html.match(pattern) || [];
    matches.forEach(match => {
      const clean = match.replace(/[★"]/g, '').trim();
      if (clean.length > 30 && clean.length < 400) {
        reviews.push(clean);
      }
    });
  });

  return [...new Set(reviews)].slice(0, 10);
}

function extractTestimonials(html: string): string[] {
  const testimonials: string[] = [];
  
  const patterns = [
    /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
    /"[^"]{40,300}"\s*[-—]\s*\w+/g
  ];

  patterns.forEach(pattern => {
    const matches = html.match(pattern) || [];
    matches.forEach(match => {
      const clean = match.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (clean.length > 30 && clean.length < 400) {
        testimonials.push(clean);
      }
    });
  });

  return [...new Set(testimonials)].slice(0, 8);
}

function extractValueProps(html: string): string[] {
  const valueProps: string[] = [];
  
  const patterns = [
    /<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi
  ];

  patterns.forEach(pattern => {
    const matches = html.match(pattern) || [];
    matches.forEach(match => {
      const clean = match.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (clean.length > 10 && clean.length < 200) {
        valueProps.push(clean);
      }
    });
  });

  return [...new Set(valueProps)].slice(0, 8);
}

function extractFeatures(html: string): string[] {
  const features: string[] = [];
  
  const patterns = [
    /<li[^>]*>(.*?)<\/li>/gi,
    /✓\s*[^<\n]{10,100}/g
  ];

  patterns.forEach(pattern => {
    const matches = html.match(pattern) || [];
    matches.forEach(match => {
      const clean = match.replace(/<[^>]*>/g, ' ').replace(/[✓•]/g, '').replace(/\s+/g, ' ').trim();
      if (clean.length > 8 && clean.length < 150) {
        features.push(clean);
      }
    });
  });

  return [...new Set(features)].slice(0, 12);
}

function extractBrandMessage(html: string): string {
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1Match) {
    const clean = h1Match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length > 10 && clean.length < 200) {
      return clean;
    }
  }
  
  const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
  if (descMatch) {
    return descMatch[1].trim();
  }
  
  return '';
}

export async function POST(request: NextRequest) {
  // TEMPORARILY DISABLED: Validate internal API key for testing
  // if (!validateInternalApiKey(request)) {
  //   return createAuthErrorResponse();
  // }

  try {
    const { jobId, websiteUrl, targetKeywords } = await request.json();

    if (!jobId || !websiteUrl) {
      return NextResponse.json({ error: 'Job ID and website URL are required' }, { status: 400 });
    }

    console.log(`Starting enhanced website crawling for job ${jobId}: ${websiteUrl}`);
    console.log(`Firecrawl available: ${isFirecrawlAvailable()}`);
    
    await updateJobStatus(jobId, 'processing');
    
    // Crawl website for content and reviews using enhanced method
    const websiteData = await crawlWebsiteContent(websiteUrl, targetKeywords || '');
    
    const analysis = {
      method: websiteData.dataQuality.method,
      firecrawlUsed: websiteData.firecrawlUsed,
      contentLength: websiteData.homePageContent.length,
      reviewsFound: websiteData.customerReviews.length,
      testimonialsFound: websiteData.testimonials.length,
      valuePropsFound: websiteData.valuePropositions.length,
      featuresFound: websiteData.features.length,
      brandMessagingPresent: !!websiteData.brandMessaging,
      dataQuality: websiteData.dataQuality
    };
    
    const crawlerData = {
      websiteData: websiteData,
      analysis: analysis,
      metadata: {
        timestamp: new Date().toISOString(),
        websiteUrl: websiteUrl,
        targetKeywords: targetKeywords,
        crawlType: 'content_and_reviews'
      }
    };

    await saveJobData(jobId, 'website', crawlerData);

    console.log(`Enhanced website crawling completed for job ${jobId}:`);
    console.log(`- Method: ${analysis.method} (Firecrawl: ${analysis.firecrawlUsed})`);
    console.log(`- Content: ${analysis.contentLength} chars`);
    console.log(`- Reviews: ${analysis.reviewsFound}, Testimonials: ${analysis.testimonialsFound}`);
    console.log(`- Value Props: ${analysis.valuePropsFound}, Features: ${analysis.featuresFound}`);

    return NextResponse.json({
      success: true,
      message: `Enhanced website crawling completed using ${analysis.method}`,
      data: {
        method: analysis.method,
        firecrawlUsed: analysis.firecrawlUsed,
        reviewsFound: analysis.reviewsFound,
        testimonialsFound: analysis.testimonialsFound,
        valuePropsFound: analysis.valuePropsFound,
        featuresFound: analysis.featuresFound,
        contentExtracted: analysis.contentLength > 0,
        contentLength: analysis.contentLength,
        dataQuality: analysis.dataQuality,
        brandMessagingFound: analysis.brandMessagingPresent
      }
    });

  } catch (error) {
    console.error('Website crawling error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Website crawling failed', details: errorMessage },
      { status: 500 }
    );
  }
}
