// Firecrawl-based Amazon review extraction with tier-based limits

export async function extractFirecrawlAmazonReviews(amazonUrl: string, targetKeywords: string, planName: string = 'Essential') {
  try {
    console.log(`Firecrawl Amazon extraction from: ${amazonUrl} (${planName} tier)`);
    
    if (!process.env.FIRECRAWL_API_KEY) {
      console.warn('Firecrawl API key not configured - skipping Amazon extraction');
      return {
        reviews: [],
        productInfo: {},
        extractionMethod: 'firecrawl_not_configured',
        realReviewsCount: 0,
        extractionFailed: true
      };
    }

    // Extract ASIN for review URLs
    const asinMatch = amazonUrl.match(/\/dp\/([A-Z0-9]{10})/i) || 
                     amazonUrl.match(/\/product\/([A-Z0-9]{10})/i) ||
                     amazonUrl.match(/asin=([A-Z0-9]{10})/i);
    
    if (!asinMatch) {
      throw new Error('Could not extract ASIN from Amazon URL');
    }
    
    const asin = asinMatch[1];
    console.log(`Extracted ASIN: ${asin}`);
    
    let allReviews: any[] = [];
    let productInfo: any = {};
    
    // Determine review collection strategy based on plan
    const isEssentialTier = planName === 'Essential';
    const maxReviews = isEssentialTier ? 20 : 200; // Essential: 20, Pro/Enterprise: 200
    const maxPages = isEssentialTier ? 1 : 10; // Essential: product page only, Pro/Enterprise: paginated
    
    console.log(`Plan: ${planName}, Max reviews: ${maxReviews}, Max pages: ${maxPages}`);

    // URLs to scrape based on tier
    const urlsToScrape = [];
    
    if (isEssentialTier) {
      // Essential tier: just the product page
      urlsToScrape.push(amazonUrl);
    } else {
      // Pro/Enterprise tiers: product page + review pages
      urlsToScrape.push(amazonUrl); // Product page
      
      // Add review pages for pagination
      for (let page = 1; page <= maxPages; page++) {
        const reviewUrl = `https://www.amazon.com/product-reviews/${asin}/ref=cm_cr_dp_d_show_all_btm?reviewerType=all_reviews&sortBy=recent&pageNumber=${page}`;
        urlsToScrape.push(reviewUrl);
      }
    }
    
    console.log(`Will scrape ${urlsToScrape.length} URLs for ${planName} tier`);
    
    for (let i = 0; i < urlsToScrape.length; i++) {
      const url = urlsToScrape[i];
      const isProductPage = i === 0;
      
      try {
        console.log(`Firecrawl scraping ${isProductPage ? 'product page' : `review page ${i}`}: ${url}`);
        
        const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: url,
            formats: ['markdown', 'html'],
            onlyMainContent: true,
            waitFor: 3000
          }),
        });

        if (firecrawlResponse.ok) {
          const data = await firecrawlResponse.json();
          const content = data.data?.markdown || data.data?.html || '';
          
          if (isProductPage) {
            // Extract product info from main page
            productInfo = extractProductInfo(content, asin);
            console.log(`Product: ${productInfo.title}`);
            
            // Extract reviews from product page (Essential tier or initial reviews for others)
            const productPageReviews = extractReviewsFromContent(content, 'amazon_firecrawl_product', 1);
            allReviews = allReviews.concat(productPageReviews);
            console.log(`Found ${productPageReviews.length} reviews on product page`);
          } else {
            // Extract reviews from review pages (Pro/Enterprise tiers only)
            const pageReviews = extractReviewsFromContent(content, 'amazon_firecrawl_reviews', i);
            allReviews = allReviews.concat(pageReviews);
            console.log(`Found ${pageReviews.length} reviews on review page ${i}`);
          }
          
          // Stop if we've reached our review limit
          if (allReviews.length >= maxReviews) {
            console.log(`Reached review limit of ${maxReviews}, stopping extraction`);
            allReviews = allReviews.slice(0, maxReviews);
            break;
          }
          
          // Add delay between requests
          if (i < urlsToScrape.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
          }
          
        } else {
          console.error(`Firecrawl request failed for ${url}:`, firecrawlResponse.status);
          if (isProductPage) {
            // If product page fails, stop everything
            break;
          }
        }
        
      } catch (pageError) {
        console.error(`Error scraping ${url}:`, pageError);
        if (isProductPage) {
          // If product page fails, stop everything
          break;
        }
      }
    }
    
    console.log(`Firecrawl extraction completed: ${allReviews.length} total reviews`);
    
    return {
      reviews: allReviews,
      productInfo: productInfo,
      extractionMethod: `firecrawl_${planName.toLowerCase()}`,
      realReviewsCount: allReviews.length,
      extractionFailed: allReviews.length === 0
    };
    
  } catch (error) {
    console.error('Error in Firecrawl Amazon extraction:', error);
    return {
      reviews: [],
      productInfo: {},
      extractionMethod: 'firecrawl_failed',
      realReviewsCount: 0,
      extractionFailed: true
    };
  }
}

function extractProductInfo(content: string, asin: string) {
  // Extract product information from HTML/markdown content
  const titleMatch = content.match(/<h1[^>]*>([^<]+)<\/h1>/i) || content.match(/# (.+)/);
  const ratingMatch = content.match(/(\d\.\d) out of 5/i) || content.match(/★.*?(\d\.\d)/);
  const reviewCountMatch = content.match(/(\d{1,3}(?:,\d{3})*) ratings/i) || content.match(/(\d+) customer reviews/i);
  
  return {
    title: titleMatch ? titleMatch[1].trim() : 'Unknown Product',
    overallRating: ratingMatch ? ratingMatch[1] : 'Unknown',
    totalReviews: reviewCountMatch ? reviewCountMatch[1] : 'Unknown',
    asin: asin
  };
}

function extractReviewsFromContent(content: string, source: string, page: number) {
  const reviews: any[] = [];
  
  // Extract reviews using regex patterns for common Amazon review structure
  const reviewPattern = /(\d\.\d out of 5 stars|★{1,5}).*?\n.*?\n(.*?)\n/gi;
  let match;
  
  while ((match = reviewPattern.exec(content)) !== null) {
    const rating = extractRatingFromText(match[1]);
    const text = match[2]?.trim();
    
    if (text && text.length > 15) {
      reviews.push({
        title: text.substring(0, 100), // Use first part as title
        text: text,
        rating: rating,
        verified: content.includes('Verified Purchase'),
        helpful_votes: 0,
        date: new Date().toISOString().split('T')[0], // Current date as fallback
        reviewer_name: 'Amazon Customer',
        source: source,
        page: page
      });
    }
    
    // Limit reviews per page
    if (reviews.length >= 20) break;
  }
  
  return reviews;
}

function extractRatingFromText(ratingText: string): number {
  const match = ratingText.match(/(\d)\.?\d?/);
  return match ? parseInt(match[1]) : 3;
}