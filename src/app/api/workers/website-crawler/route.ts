import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus, saveJobData } from '@/lib/db';

interface WebsiteData {
  homePageContent: string;
  productPagesContent: string[];
  customerReviews: CustomerReview[];
  testimonials: string[];
  valuePropositions: string[];
  features: string[];
  brandMessaging: string;
  contactInfo: any;
}

interface CustomerReview {
  content: string;
  rating?: number;
  reviewer?: string;
  date?: string;
  source: string; // Which page it was found on
}

async function crawlWebsiteForContentAndReviews(websiteUrl: string): Promise<WebsiteData> {
  try {
    console.log(`Enhanced website crawling: ${websiteUrl}`);
    
    const domain = extractDomain(websiteUrl);
    const discoveredPages: string[] = [];
    const websiteData: WebsiteData = {
      homePageContent: '',
      productPagesContent: [],
      customerReviews: [],
      testimonials: [],
      valuePropositions: [],
      features: [],
      brandMessaging: '',
      contactInfo: {}
    };

    // Step 1: Crawl home page
    const homePageData = await crawlSinglePage(websiteUrl, 'home');
    if (homePageData) {
      websiteData.homePageContent = homePageData.content;
      websiteData.customerReviews.push(...homePageData.reviews);
      websiteData.testimonials.push(...homePageData.testimonials);
      websiteData.valuePropositions.push(...homePageData.valueProps);
      websiteData.features.push(...homePageData.features);
      websiteData.brandMessaging = homePageData.brandMessage;
      
      // Discover additional pages from home page
      discoveredPages.push(...homePageData.discoveredUrls);
    }

    // Step 2: Find and crawl key pages (products, reviews, testimonials, about)
    const keyPages = findKeyPages(discoveredPages, domain);
    
    for (const pageUrl of keyPages.slice(0, 8)) { // Limit to 8 additional pages
      try {
        console.log(`Crawling key page: ${pageUrl}`);
        const pageData = await crawlSinglePage(pageUrl, 'product');
        
        if (pageData) {
          websiteData.productPagesContent.push(pageData.content);
          websiteData.customerReviews.push(...pageData.reviews);
          websiteData.testimonials.push(...pageData.testimonials);
          websiteData.valuePropositions.push(...pageData.valueProps);
          websiteData.features.push(...pageData.features);
        }
      } catch (pageError) {
        console.error(`Error crawling ${pageUrl}:`, pageError);
      }
    }

    // Step 3: Clean and deduplicate data
    websiteData.customerReviews = deduplicateReviews(websiteData.customerReviews);
    websiteData.testimonials = [...new Set(websiteData.testimonials)];
    websiteData.valuePropositions = [...new Set(websiteData.valuePropositions)];
    websiteData.features = [...new Set(websiteData.features)];

    console.log(`Website crawling completed: ${websiteData.customerReviews.length} reviews, ${websiteData.testimonials.length} testimonials found`);
    
    return websiteData;

  } catch (error) {
    console.error('Error in website crawling:', error);
    return {
      homePageContent: '',
      productPagesContent: [],
      customerReviews: [],
      testimonials: [],
      valuePropositions: [],
      features: [],
      brandMessaging: '',
      contactInfo: {}
    };
  }
}

async function crawlSinglePage(url: string, pageType: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.log(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();
    
    return {
      content: extractMainContent(html),
      reviews: extractCustomerReviews(html, url),
      testimonials: extractTestimonials(html),
      valueProps: extractValuePropositions(html),
      features: extractFeatures(html),
      brandMessage: extractBrandMessaging(html),
      discoveredUrls: pageType === 'home' ? extractInternalUrls(html, extractDomain(url)) : []
    };

  } catch (error) {
    console.error(`Error crawling ${url}:`, error);
    return null;
  }
}

function extractCustomerReviews(html: string, sourceUrl: string): CustomerReview[] {
  const reviews: CustomerReview[] = [];
  
  // Common review patterns on websites
  const reviewPatterns = [
    // Standard review structures
    /<div[^>]*class="[^"]*review[^"]*"[^>]*>(.*?)<\/div>/gis,
    /<article[^>]*class="[^"]*review[^"]*"[^>]*>(.*?)<\/article>/gis,
    /<section[^>]*class="[^"]*testimonial[^"]*"[^>]*>(.*?)<\/section>/gis,
    
    // Review aggregator widgets
    /<div[^>]*class="[^"]*trustpilot[^"]*"[^>]*>(.*?)<\/div>/gis,
    /<div[^>]*class="[^"]*reviews-io[^"]*"[^>]*>(.*?)<\/div>/gis,
    /<div[^>]*class="[^"]*yotpo[^"]*"[^>]*>(.*?)<\/div>/gis,
    
    // Common review text patterns
    /"[^"]{50,500}"\s*[-—]\s*\w+/g,
    /★+\s*[4-5]\/5.*?"[^"]{30,300}"/g
  ];

  reviewPatterns.forEach(pattern => {
    const matches = html.match(pattern) || [];
    matches.forEach(match => {
      const cleanReview = cleanHtmlContent(match);
      if (cleanReview.length > 30 && cleanReview.length < 1000) {
        
        // Try to extract rating
        const ratingMatch = match.match(/(?:★+|(\d+(?:\.\d)?)\s*\/\s*5|(\d+)\s*stars?)/i);
        let rating = undefined;
        if (ratingMatch) {
          rating = ratingMatch[1] ? parseFloat(ratingMatch[1]) : 
                   ratingMatch[2] ? parseInt(ratingMatch[2]) : 5;
        }

        // Try to extract reviewer name
        const reviewerMatch = match.match(/[-—]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]*)?)\s*$/i);
        const reviewer = reviewerMatch ? reviewerMatch[1] : undefined;

        reviews.push({
          content: cleanReview,
          rating: rating,
          reviewer: reviewer,
          source: sourceUrl
        });
      }
    });
  });

  return reviews.slice(0, 20); // Limit per page
}

function extractTestimonials(html: string): string[] {
  const testimonials: string[] = [];
  
  const testimonialPatterns = [
    /<div[^>]*class="[^"]*testimonial[^"]*"[^>]*>(.*?)<\/div>/gis,
    /<blockquote[^>]*>(.*?)<\/blockquote>/gis,
    /"[^"]{50,400}"\s*[-—]\s*\w+[^<]*(?:CEO|Founder|Customer|Client)/gi
  ];

  testimonialPatterns.forEach(pattern => {
    const matches = html.match(pattern) || [];
    matches.forEach(match => {
      const cleanTestimonial = cleanHtmlContent(match);
      if (cleanTestimonial.length > 40 && cleanTestimonial.length < 500) {
        testimonials.push(cleanTestimonial);
      }
    });
  });

  return [...new Set(testimonials)].slice(0, 15);
}

function extractValuePropositions(html: string): string[] {
  const valueProps: string[] = [];
  
  const valuePatterns = [
    // Headlines and value prop sections
    /<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi,
    /<div[^>]*class="[^"]*(?:value|benefit|feature|advantage)[^"]*"[^>]*>(.*?)<\/div>/gis,
    
    // Common value prop phrases
    /(?:we help|our solution|unique|proven|guaranteed|results|benefits?|advantages?)[^.!?]{10,100}[.!?]/gi
  ];

  valuePatterns.forEach(pattern => {
    const matches = html.match(pattern) || [];
    matches.forEach(match => {
      const cleanValue = cleanHtmlContent(match);
      if (cleanValue.length > 15 && cleanValue.length < 200) {
        valueProps.push(cleanValue);
      }
    });
  });

  return [...new Set(valueProps)].slice(0, 10);
}

function extractFeatures(html: string): string[] {
  const features: string[] = [];
  
  const featurePatterns = [
    /<li[^>]*>(.*?)<\/li>/gi,
    /<div[^>]*class="[^"]*(?:feature|spec|benefit)[^"]*"[^>]*>(.*?)<\/div>/gis,
    /✓\s*[^<\n]{10,100}/g,
    /•\s*[^<\n]{10,100}/g
  ];

  featurePatterns.forEach(pattern => {
    const matches = html.match(pattern) || [];
    matches.forEach(match => {
      const cleanFeature = cleanHtmlContent(match);
      if (cleanFeature.length > 10 && cleanFeature.length < 150) {
        features.push(cleanFeature);
      }
    });
  });

  return [...new Set(features)].slice(0, 20);
}

function extractBrandMessaging(html: string): string {
  // Look for main brand message in hero sections, taglines, etc.
  const messagePatterns = [
    /<h1[^>]*>(.*?)<\/h1>/gi,
    /<div[^>]*class="[^"]*(?:hero|tagline|headline)[^"]*"[^>]*>(.*?)<\/div>/gis,
    /<meta[^>]*name="description"[^>]*content="([^"]+)"/gi
  ];

  for (const pattern of messagePatterns) {
    const matches = html.match(pattern);
    if (matches && matches.length > 0) {
      const cleanMessage = cleanHtmlContent(matches[0]);
      if (cleanMessage.length > 20 && cleanMessage.length < 300) {
        return cleanMessage;
      }
    }
  }

  return '';
}

function extractMainContent(html: string): string {
  // Remove scripts, styles, nav, footer
  let content = html.replace(/<script[^>]*>.*?<\/script>/gis, '');
  content = content.replace(/<style[^>]*>.*?<\/style>/gis, '');
  content = content.replace(/<nav[^>]*>.*?<\/nav>/gis, '');
  content = content.replace(/<footer[^>]*>.*?<\/footer>/gis, '');
  content = content.replace(/<header[^>]*>.*?<\/header>/gis, '');
  
  // Extract main content area
  const mainContent = content.match(/<main[^>]*>(.*?)<\/main>/is) ||
                     content.match(/<article[^>]*>(.*?)<\/article>/is) ||
                     content.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)<\/div>/is);
  
  if (mainContent) {
    return cleanHtmlContent(mainContent[1]).substring(0, 2000);
  }
  
  return cleanHtmlContent(content).substring(0, 2000);
}

function extractInternalUrls(html: string, domain: string): string[] {
  const urlPattern = /href="([^"]+)"/gi;
  const urls: string[] = [];
  let match;
  
  while ((match = urlPattern.exec(html)) !== null) {
    const url = match[1];
    if (url.includes(domain) || (url.startsWith('/') && !url.startsWith('//'))) {
      const fullUrl = url.startsWith('/') ? `https://${domain}${url}` : url;
      urls.push(fullUrl);
    }
  }
  
  return [...new Set(urls)];
}

function findKeyPages(urls: string[], domain: string): string[] {
  const keywordPriority = [
    'review', 'testimonial', 'customer', 'product', 'shop', 'store',
    'about', 'story', 'features', 'benefits', 'how-it-works'
  ];
  
  const scoredUrls = urls.map(url => {
    let score = 0;
    const urlLower = url.toLowerCase();
    
    keywordPriority.forEach((keyword, index) => {
      if (urlLower.includes(keyword)) {
        score += (keywordPriority.length - index);
      }
    });
    
    return { url, score };
  });
  
  return scoredUrls
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.url);
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function cleanHtmlContent(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&[^;]+;/g, ' ')
    .trim();
}

function deduplicateReviews(reviews: CustomerReview[]): CustomerReview[] {
  const seen = new Set();
  return reviews.filter(review => {
    const key = review.content.substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function analyzeWebsiteData(data: WebsiteData): any {
  return {
    totalReviews: data.customerReviews.length,
    totalTestimonials: data.testimonials.length,
    averageReviewLength: data.customerReviews.length > 0 ? 
      data.customerReviews.reduce((sum, r) => sum + r.content.length, 0) / data.customerReviews.length : 0,
    valuePropositionsFound: data.valuePropositions.length,
    featuresFound: data.features.length,
    brandMessagingPresent: !!data.brandMessaging,
    pagesCrawled: 1 + data.productPagesContent.length,
    dataQuality: data.customerReviews.length > 5 ? 'high' : 
                 data.customerReviews.length > 2 ? 'medium' : 'low'
  };
}

export async function POST(request: NextRequest) {
  try {
    const { jobId, websiteUrl, targetKeywords } = await request.json();

    if (!jobId || !websiteUrl) {
      return NextResponse.json({ error: 'Job ID and website URL are required' }, { status: 400 });
    }

    console.log(`Starting enhanced website crawling for job ${jobId}: ${websiteUrl}`);
    
    await updateJobStatus(jobId, 'processing');
    
    // Enhanced crawling for content + reviews
    const websiteData = await crawlWebsiteForContentAndReviews(websiteUrl);
    
    // Analyze the collected data
    const analysis = analyzeWebsiteData(websiteData);
    
    const crawlerData = {
      websiteData: websiteData,
      analysis: analysis,
      metadata: {
        timestamp: new Date().toISOString(),
        websiteUrl: websiteUrl,
        targetKeywords: targetKeywords,
        crawlType: 'enhanced_content_and_reviews'
      }
    };

    await saveJobData(jobId, 'website', crawlerData);

    console.log(`Enhanced website crawling completed for job ${jobId}: ${analysis.totalReviews} reviews, ${analysis.totalTestimonials} testimonials`);

    return NextResponse.json({
      success: true,
      message: 'Enhanced website crawling completed',
      data: {
        reviewsFound: analysis.totalReviews,
        testimonialsFound: analysis.totalTestimonials,
        valuePropsFound: analysis.valuePropositionsFound,
        featuresFound: analysis.featuresFound,
        pagesCrawled: analysis.pagesCrawled,
        dataQuality: analysis.dataQuality
      }
    });

  } catch (error) {
    console.error('Enhanced website crawling error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Enhanced website crawling failed', details: errorMessage },
      { status: 500 }
    );
  }
}
