import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus, saveJobData } from '@/lib/db';
import { validateInternalApiKey, createAuthErrorResponse } from '@/lib/auth';
import { scrapeWebsiteWithFirecrawl, isFirecrawlAvailable } from '@/lib/firecrawl';
import { routeDataCollection } from '@/lib/data-collection-router';
import { enhancedWebsiteCrawling, detectShopifyFromResponse } from '@/lib/shopify-integration';
import { storeJobResult } from '@/lib/job-cache';

interface WebsiteData {
  homePageContent: string;
  customerReviews: string[];
  testimonials: string[];
  valuePropositions: string[];
  features: string[];
  brandMessaging: string;
}

async function crawlWebsiteContent(websiteUrl: string, targetKeywords: string, jobId?: string): Promise<WebsiteData & { firecrawlUsed: boolean; dataQuality: any }> {
  console.log(`=== WEBSITE CRAWLER DEBUG START ===`);
  console.log(`📍 Starting customer site extraction for URL: ${websiteUrl}`);
  console.log(`🔍 Target keywords: ${targetKeywords}`);
  console.log(`🆔 Job ID: ${jobId || 'none'}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  
  // Step 1: Try enhanced crawling with Shopify detection
  console.log(`🚀 Step 1: Attempting enhanced website crawling with Shopify detection`);
  
  try {
    console.log(`🔧 Calling enhancedWebsiteCrawling function...`);
    const enhancedResult = await enhancedWebsiteCrawling(websiteUrl, targetKeywords, 'premium', jobId);
    
    console.log(`📊 Enhanced crawling result received:`);
    console.log(`   - Method: ${enhancedResult.dataQuality.method}`);
    console.log(`   - Success: ${enhancedResult.dataQuality.method !== 'fallback_needed'}`);
    console.log(`   - Customer reviews found: ${enhancedResult.customerReviews?.length || 0}`);
    
    if (enhancedResult.dataQuality.method !== 'fallback_needed') {
      console.log(`✅ Enhanced crawling successful using method: ${enhancedResult.dataQuality.method}`);
      console.log(`📋 Data extracted: ${enhancedResult.customerReviews?.length || 0} reviews found`);
      return {
        ...enhancedResult,
        dataQuality: {
          ...enhancedResult.dataQuality,
          enhanced: true
        }
      };
    } else {
      console.log(`⚠️ Enhanced crawling requested fallback, proceeding to Step 2`);
    }
  } catch (error) {
    console.error('❌ Enhanced crawling failed with error:', error);
    console.error('🔍 Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.warn('📍 Falling back to standard methods...');
  }
  
  // Step 2: Skip Firecrawl entirely for cost optimization
  console.log(`💰 Step 2: Skipping Firecrawl to eliminate API costs - using basic scraping instead`);

  // Fallback to basic scraping
  console.log(`🔧 Step 3: Attempting basic HTTP fetch for: ${websiteUrl}`);
  
  try {
    console.log(`⏱️ Creating 10-second timeout controller...`);
    // Create a timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    console.log(`🌐 Making HTTP request to ${websiteUrl}...`);
    const response = await fetch(websiteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    console.log(`📡 HTTP Response received: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(`❌ HTTP request failed: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch website: ${response.status} ${response.statusText}`);
    }

    console.log(`📄 Reading HTML content...`);
    const html = await response.text();
    console.log(`📊 HTML content received: ${html.length} characters`);
    
    console.log(`🔍 Extracting data using basic scraping methods...`);
    const extractedData = {
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
    
    console.log(`📋 Extraction method used: basic_fetch`);
    console.log(`📋 Data extracted: ${extractedData.customerReviews?.length || 0} reviews found`);
    console.log(`📋 Testimonials found: ${extractedData.testimonials?.length || 0}`);
    console.log(`📋 Features found: ${extractedData.features?.length || 0}`);
    console.log(`📋 Content length: ${extractedData.homePageContent?.length || 0} characters`);
    
    return extractedData;

  } catch (error) {
    console.error('❌ Basic scraping failed with error:', error);
    console.error('🔍 Error details:', error instanceof Error ? error.message : 'Unknown error');
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
  console.log(`📄 Extracting main content from ${html.length} characters of HTML...`);
  
  // Remove scripts and styles but preserve location for debugging
  let content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' [SCRIPT_REMOVED] ');
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' [STYLE_REMOVED] ');
  
  // Clean HTML tags
  content = content.replace(/<[^>]*>/g, ' ');
  content = content.replace(/\s+/g, ' ');
  content = content.trim();
  
  // Extract a larger sample to capture more testimonials (increased from 2000)
  const longContent = content.substring(0, 8000);
  console.log(`📄 Extracted ${longContent.length} characters of clean content`);
  
  // Look for testimonial section specifically
  const testimonialMatch = content.match(/customer\s+love[\s\S]{0,2000}/i);
  if (testimonialMatch) {
    console.log(`💬 Found 'Customer Love' section in main content`);
  }
  
  return longContent;
}

function extractReviews(html: string): string[] {
  console.log(`🔍 Starting improved review extraction...`);
  const reviews: string[] = [];
  
  // Step 1: Check for Shopify review platforms
  console.log(`📱 Checking for Shopify review platforms...`);
  const reviewPlatforms = {
    'Judge.me': html.includes('judge.me') || html.includes('judgeme'),
    'Yotpo': html.includes('yotpo') || html.includes('Yotpo'),
    'Shopify Reviews': html.includes('shopify-product-reviews') || html.includes('spr-'),
    'Loox': html.includes('loox') || html.includes('Loox'),
    'Stamped': html.includes('stamped.io') || html.includes('stamped')
  };
  
  const detectedPlatform = Object.entries(reviewPlatforms).find(([name, detected]) => detected)?.[0];
  console.log(`📊 Review platform detected: ${detectedPlatform || 'None - using custom extraction'}`);
  
  // Step 2: Extract testimonials from visible content (GroundLuxe specific)
  console.log(`💬 Extracting customer testimonials from visible content...`);
  
  // Look for testimonial patterns with customer names
  const testimonialPatterns = [
    // Pattern: "Quote text" - Name
    /"([^"]{30,500})"\s*[-—]\s*([A-Z][a-z]+(?:\s+[A-Z]\.?)?)/g,
    // Pattern: Name: "Quote text"
    /([A-Z][a-z]+(?:\s+[A-Z]\.?)?)[\s:]*[""]([^""]{30,500})[""](?!\s*[{}\[\];,])/g,
    // Pattern: Customer testimonials in HTML structure
    /<[^>]*(?:testimonial|review|customer)[^>]*>[\s\S]*?[""]([^""]{30,500})[""][\s\S]*?([A-Z][a-z]+(?:\s+[A-Z]\.?)?)/gi
  ];
  
  testimonialPatterns.forEach((pattern, index) => {
    console.log(`🔍 Trying testimonial pattern ${index + 1}...`);
    const matches = Array.from(html.matchAll(pattern));
    console.log(`   Found ${matches.length} matches`);
    
    matches.forEach(match => {
      let reviewText = '';
      let customerName = '';
      
      if (index === 0) { // "Quote" - Name
        reviewText = match[1].trim();
        customerName = match[2].trim();
      } else if (index === 1) { // Name: "Quote"
        customerName = match[1].trim();
        reviewText = match[2].trim();
      } else { // HTML structure
        reviewText = match[1].trim();
        customerName = match[2].trim();
      }
      
      // Filter out JavaScript/technical content
      if (isValidCustomerReview(reviewText, customerName)) {
        const formattedReview = `"${reviewText}" - ${customerName}`;
        reviews.push(formattedReview);
        console.log(`   ✅ Found testimonial: ${customerName} - ${reviewText.substring(0, 50)}...`);
      } else {
        console.log(`   ❌ Filtered out: ${reviewText.substring(0, 50)}... (technical content)`);
      }
    });
  });
  
  // Step 3: Look for review-like content in specific sections
  console.log(`🔍 Looking for review content in specific sections...`);
  
  // Look for content between "Customer Love" or "Reviews" sections
  const reviewSectionPatterns = [
    /customer\s+love[\s\S]{0,500}?[""]([^""]{30,400})[""][\s\S]{0,100}?([A-Z][a-z]+)/gi,
    /testimonials?[\s\S]{0,500}?[""]([^""]{30,400})[""][\s\S]{0,100}?([A-Z][a-z]+)/gi,
    /reviews?[\s\S]{0,500}?[""]([^""]{30,400})[""][\s\S]{0,100}?([A-Z][a-z]+)/gi
  ];
  
  reviewSectionPatterns.forEach((pattern, index) => {
    console.log(`🔍 Checking review section pattern ${index + 1}...`);
    const matches = Array.from(html.matchAll(pattern));
    console.log(`   Found ${matches.length} matches`);
    
    matches.forEach(match => {
      const reviewText = match[1].trim();
      const customerName = match[2].trim();
      
      if (isValidCustomerReview(reviewText, customerName)) {
        const formattedReview = `"${reviewText}" - ${customerName}`;
        if (!reviews.some(r => r.includes(reviewText.substring(0, 30)))) { // Avoid duplicates
          reviews.push(formattedReview);
          console.log(`   ✅ Found section review: ${customerName} - ${reviewText.substring(0, 50)}...`);
        }
      }
    });
  });
  
  // Step 4: Extract from JSON-LD structured data if present
  console.log(`🔍 Checking for JSON-LD structured review data...`);
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatches) {
    jsonLdMatches.forEach(match => {
      try {
        const jsonContent = match.replace(/<script[^>]*>|<\/script>/g, '');
        const data = JSON.parse(jsonContent);
        if (data.review || data.reviews || data['@type'] === 'Review') {
          console.log(`   ✅ Found JSON-LD review data`);
          // Extract reviews from structured data
          // This would need specific implementation based on the schema
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    });
  }
  
  console.log(`📊 Review extraction complete: found ${reviews.length} valid reviews`);
  return [...new Set(reviews)].slice(0, 10);
}

function isValidCustomerReview(reviewText: string, customerName: string): boolean {
  // Filter out JavaScript/technical content
  const technicalKeywords = [
    'function', 'window', 'document', 'script', 'var ', 'const ', 'let ',
    'jquery', 'ajax', 'http', 'https', 'javascript', 'shopify', 'theme',
    'css', 'html', 'json', 'api', 'url', 'getElementById', 'querySelector',
    'addEventListener', 'fetch(', 'console.', '.js', '.css', '.com/',
    'gtag', 'analytics', 'tracking', 'pixel', 'cookie', 'localStorage'
  ];
  
  const reviewLower = reviewText.toLowerCase();
  
  // Check if it contains technical keywords
  if (technicalKeywords.some(keyword => reviewLower.includes(keyword))) {
    return false;
  }
  
  // Check if customer name looks valid (not a technical term)
  if (!customerName || customerName.length < 2 || customerName.length > 50) {
    return false;
  }
  
  const nameLower = customerName.toLowerCase();
  if (technicalKeywords.some(keyword => nameLower.includes(keyword))) {
    return false;
  }
  
  // Check if review text looks like actual customer feedback
  const reviewIndicators = [
    'love', 'great', 'amazing', 'recommend', 'best', 'good', 'excellent',
    'perfect', 'quality', 'comfortable', 'soft', 'sleep', 'better',
    'product', 'buy', 'purchase', 'use', 'tried', 'experience'
  ];
  
  const hasReviewLanguage = reviewIndicators.some(indicator => 
    reviewLower.includes(indicator)
  );
  
  // Must have review-like language and reasonable length
  return hasReviewLanguage && reviewText.length >= 30 && reviewText.length <= 500;
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
  console.log(`=== WEBSITE CRAWLER WORKER START ===`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  
  // TEMPORARILY DISABLED: Validate internal API key for testing
  // if (!validateInternalApiKey(request)) {
  //   return createAuthErrorResponse();
  // }

  let jobId: string | undefined;
  
  try {
    console.log(`📨 Reading request body...`);
    const requestBody = await request.json();
    jobId = requestBody.jobId;
    const { websiteUrl, targetKeywords } = requestBody;
    
    console.log(`📋 Request parameters received:`);
    console.log(`   - Job ID: ${jobId}`);
    console.log(`   - Website URL: ${websiteUrl}`);
    console.log(`   - Target Keywords: ${targetKeywords || 'none'}`);

    if (!jobId || !websiteUrl) {
      console.error(`❌ Missing required parameters - jobId: ${!!jobId}, websiteUrl: ${!!websiteUrl}`);
      return NextResponse.json({ error: 'Job ID and website URL are required' }, { status: 400 });
    }

    console.log(`🚀 Starting enhanced website crawling for job ${jobId}: ${websiteUrl}`);
    console.log(`🔧 Firecrawl available: ${isFirecrawlAvailable()}`);
    
    console.log(`📊 Attempting database status update to 'processing'...`);
    try {
      await updateJobStatus(jobId, 'processing');
      console.log(`✅ Database status updated successfully`);
    } catch (statusError) {
      console.error(`⚠️ Database status update failed:`, statusError);
      console.log(`📍 Continuing with crawling despite status update failure...`);
    }
    
    console.log(`🕷️ Starting website content crawling...`);
    // Crawl website for content and reviews using enhanced method
    const websiteData = await crawlWebsiteContent(websiteUrl, targetKeywords || '', jobId);
    console.log(`✅ Website crawling completed!`);
    
    console.log(`📊 Analyzing crawled data...`);
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
    
    console.log(`📋 Analysis complete:`);
    console.log(`   - Method: ${analysis.method}`);
    console.log(`   - Reviews found: ${analysis.reviewsFound}`);
    console.log(`   - Content length: ${analysis.contentLength} chars`);
    console.log(`   - Testimonials: ${analysis.testimonialsFound}`);
    console.log(`   - Features: ${analysis.featuresFound}`);
    
    console.log(`📦 Preparing data package for storage...`);
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

    console.log(`💾 Attempting database write...`);
    try {
      await saveJobData(jobId, 'website', crawlerData);
      console.log(`✅ Database write successful!`);
    } catch (dbError) {
      console.error(`❌ Database write failed:`, dbError);
      console.error(`🔍 Database error details:`, dbError instanceof Error ? dbError.message : 'Unknown error');
      // Continue to try job cache storage
    }
    
    console.log(`💾 Attempting job cache storage...`);
    try {
      // Store result in cache for debug dashboard
      storeJobResult(jobId, 'website', {
        success: true,
        websiteData: websiteData,
        analysis: analysis,
        processingTime: Date.now() - 30000, // Approximate processing time
        statusCode: 200
      });
      console.log(`✅ Job cache storage successful!`);
    } catch (cacheError) {
      console.error(`❌ Job cache storage failed:`, cacheError);
      console.error(`🔍 Cache error details:`, cacheError instanceof Error ? cacheError.message : 'Unknown error');
    }

    console.log(`🎉 Enhanced website crawling completed for job ${jobId}:`);
    console.log(`📊 Final Results Summary:`);
    console.log(`   - Method: ${analysis.method} (Firecrawl: ${analysis.firecrawlUsed})`);
    console.log(`   - Content: ${analysis.contentLength} chars`);
    console.log(`   - Reviews: ${analysis.reviewsFound}, Testimonials: ${analysis.testimonialsFound}`);
    console.log(`   - Value Props: ${analysis.valuePropsFound}, Features: ${analysis.featuresFound}`);
    console.log(`=== WEBSITE CRAWLER WORKER END ===`);

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
    console.error('❌ WEBSITE CRAWLER WORKER FAILED ===');
    console.error('🔍 Error details:', error);
    console.error('🆔 Failed job ID:', jobId);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.log(`💾 Attempting error result storage in job cache...`);
    // Store error result in cache for debug dashboard (if jobId is available)
    if (jobId) {
      try {
        storeJobResult(jobId, 'website', {
          success: false,
          error: errorMessage,
          processingTime: 0,
          statusCode: 500
        });
        console.log(`✅ Error result stored in job cache`);
      } catch (cacheError) {
        console.error(`❌ Failed to store error in job cache:`, cacheError);
      }
    } else {
      console.error(`❌ No job ID available for error storage`);
    }
    
    console.log(`=== WEBSITE CRAWLER WORKER END (WITH ERROR) ===`);
    
    return NextResponse.json(
      { error: 'Website crawling failed', details: errorMessage },
      { status: 500 }
    );
  }
}
