import { NextRequest, NextResponse } from 'next/server';

// Copy of the improved extractReviews function for testing
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

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing review extraction function...');
    
    // Fetch GroundLuxe HTML
    const response = await fetch('https://groundluxe.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = await response.text();
    console.log(`📄 Fetched ${html.length} characters of HTML`);
    
    // Test our extraction function
    const extractedReviews = extractReviews(html);
    
    return NextResponse.json({
      success: true,
      message: 'Review extraction test completed',
      data: {
        htmlLength: html.length,
        reviewsFound: extractedReviews.length,
        reviews: extractedReviews,
        testMethod: 'improved_extraction'
      }
    });
    
  } catch (error) {
    console.error('Review extraction test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}