import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus, saveJobData } from '@/lib/db';
import { validateInternalApiKey, createAuthErrorResponse } from '@/lib/auth';

interface WebsiteData {
  homePageContent: string;
  customerReviews: string[];
  testimonials: string[];
  valuePropositions: string[];
  features: string[];
  brandMessaging: string;
}

async function crawlWebsiteContent(websiteUrl: string): Promise<WebsiteData> {
  try {
    console.log(`Crawling website: ${websiteUrl}`);
    
    const response = await fetch(websiteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.status}`);
    }

    const html = await response.text();
    
    return {
      homePageContent: extractMainContent(html),
      customerReviews: extractReviews(html),
      testimonials: extractTestimonials(html),
      valuePropositions: extractValueProps(html),
      features: extractFeatures(html),
      brandMessaging: extractBrandMessage(html)
    };

  } catch (error) {
    console.error('Error crawling website:', error);
    return {
      homePageContent: '',
      customerReviews: [],
      testimonials: [],
      valuePropositions: [],
      features: [],
      brandMessaging: ''
    };
  }
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

    console.log(`Starting website crawling for job ${jobId}: ${websiteUrl}`);
    
    await updateJobStatus(jobId, 'processing');
    
    // Crawl website for content and reviews
    const websiteData = await crawlWebsiteContent(websiteUrl);
    
    const analysis = {
      contentLength: websiteData.homePageContent.length,
      reviewsFound: websiteData.customerReviews.length,
      testimonialsFound: websiteData.testimonials.length,
      valuePropsFound: websiteData.valuePropositions.length,
      featuresFound: websiteData.features.length,
      brandMessagingPresent: !!websiteData.brandMessaging
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

    console.log(`Website crawling completed for job ${jobId}: ${analysis.reviewsFound} reviews found`);

    return NextResponse.json({
      success: true,
      message: 'Website crawling completed',
      data: {
        reviewsFound: analysis.reviewsFound,
        testimonialsFound: analysis.testimonialsFound,
        valuePropsFound: analysis.valuePropsFound,
        featuresFound: analysis.featuresFound,
        contentExtracted: analysis.contentLength > 0
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
