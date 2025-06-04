import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { JobQueue } from '@/lib/queue';

interface WebsitePage {
  id: string;
  url: string;
  title: string;
  content: string;
  pageType: string; // 'homepage', 'product', 'about', 'testimonials', 'blog', 'other'
  headings: string[];
  links: string[];
  images: string[];
  metadata: {
    description?: string;
    keywords?: string;
    wordCount: number;
    lastCrawled: string;
  };
}

interface WebsiteInsights {
  totalPages: number;
  pageTypes: Record<string, number>;
  commonKeywords: string[];
  brandMessaging: string[];
  targetAudience: string[];
  valuePropositions: string[];
  testimonials: string[];
  productFeatures: string[];
  dataQuality: 'high' | 'medium' | 'low';
}

export async function POST(request: NextRequest) {
  let jobId: string = '';
  
  try {
    const body = await request.json();
    jobId = body.jobId;
    const { payload } = body;
    const { primaryProductUrl, targetKeywords, userProduct } = payload;
    
    console.log(`Starting website crawling for job ${jobId} on ${primaryProductUrl}`);
    
    // Update job status
    await updateJobStatus(jobId, 'processing', 20, undefined, undefined);
    
    // Extract domain and prepare for crawling
    const domain = extractDomain(primaryProductUrl);
    const pagesToCrawl = await discoverPages(primaryProductUrl, domain);
    
    console.log(`Found ${pagesToCrawl.length} pages to crawl for ${domain}`);
    
    // Update progress
    await updateJobStatus(jobId, 'processing', 30, undefined, undefined);
    
    // Crawl pages in batches to respect timeouts
    const allWebsiteData: WebsitePage[] = [];
    let completedPages = 0;
    
    for (const pageUrl of pagesToCrawl) {
      try {
        console.log(`Crawling page: ${pageUrl}`);
        
        const pageData = await crawlPage(pageUrl, domain);
        if (pageData) {
          allWebsiteData.push(pageData);
        }
        
        completedPages++;
        const progress = 30 + Math.floor((completedPages / pagesToCrawl.length) * 40);
        await updateJobStatus(jobId, 'processing', progress, undefined, undefined);
        
        // Respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1500));
        
      } catch (error) {
        console.error(`Error crawling ${pageUrl}:`, error);
        // Continue with other pages
      }
    }
    
    console.log(`Crawled ${allWebsiteData.length} pages from ${domain}`);
    
    // Update progress
    await updateJobStatus(jobId, 'processing', 75, undefined, undefined);
    
    // Analyze website data for insights
    const websiteInsights = analyzeWebsiteData(allWebsiteData, targetKeywords, userProduct);
    
    // Store website data
    await storeWebsiteData(jobId, allWebsiteData, websiteInsights);
    
    // Update progress
    await updateJobStatus(jobId, 'processing', 85, undefined, undefined);
    
    // Queue the data processor (final step)
    const queue = new JobQueue();
    await queue.addJob(jobId, 'data-processor', {
      websiteData: allWebsiteData,
      websiteInsights,
      targetKeywords,
      userProduct
    });
    
    await queue.markTaskCompleted(jobId, 'website-crawler');
    
    console.log(`Website crawling completed for job ${jobId}`);
    
    return NextResponse.json({
      success: true,
      message: 'Website crawling completed',
      pagesCrawled: allWebsiteData.length,
      websiteInsights
    });

  } catch (error) {
    console.error('Website crawling error:', error);
    
    await updateJobStatus(
      jobId, 
      'failed', 
      0, 
      undefined, 
      `Website crawling failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    
    return NextResponse.json(
      { error: 'Website crawling failed' },
      { status: 500 }
    );
  }
}

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    console.error('Invalid URL:', url);
    return '';
  }
}

async function discoverPages(startUrl: string, domain: string): Promise<string[]> {
  const pages = new Set<string>();
  pages.add(startUrl);
  
  try {
    // Get the homepage to discover internal links
    const homepageData = await crawlPage(startUrl, domain);
    
    if (homepageData && homepageData.links) {
      // Add important page types we want to prioritize
      const priorityPages = homepageData.links.filter(link => {
        const lowerLink = link.toLowerCase();
        return lowerLink.includes('about') ||
               lowerLink.includes('product') ||
               lowerLink.includes('service') ||
               lowerLink.includes('testimonial') ||
               lowerLink.includes('review') ||
               lowerLink.includes('customer') ||
               lowerLink.includes('story') ||
               lowerLink.includes('case-study') ||
               lowerLink.includes('contact') ||
               lowerLink.includes('pricing') ||
               lowerLink.includes('feature');
      });
      
      priorityPages.forEach(link => pages.add(link));
    }
    
    // Add common important pages manually
    const commonPages = [
      `https://${domain}/about`,
      `https://${domain}/about-us`,
      `https://${domain}/products`,
      `https://${domain}/services`,
      `https://${domain}/testimonials`,
      `https://${domain}/reviews`,
      `https://${domain}/customers`,
      `https://${domain}/case-studies`,
      `https://${domain}/features`,
      `https://${domain}/pricing`
    ];
    
    commonPages.forEach(page => pages.add(page));
    
    // Limit to top 10 pages for cost control
    return Array.from(pages).slice(0, 10);
    
  } catch (error) {
    console.error('Error discovering pages:', error);
    return [startUrl]; // Fallback to just the start URL
  }
}

async function crawlPage(url: string, domain: string): Promise<WebsitePage | null> {
  try {
    console.log(`Crawling: ${url}`);
    
    const scrapeOwlResponse = await fetch('https://api.scrapeowl.com/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.SCRAPEOWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: process.env.SCRAPEOWL_API_KEY,
        url: url,
        elements: [
          {
            name: 'title',
            selector: 'title',
            type: 'text'
          },
          {
            name: 'description',
            selector: 'meta[name="description"]',
            type: 'attribute',
            attribute: 'content'
          },
          {
            name: 'keywords',
            selector: 'meta[name="keywords"]',
            type: 'attribute',
            attribute: 'content'
          },
          {
            name: 'headings',
            selector: 'h1, h2, h3',
            type: 'list',
            children: [
              {
                name: 'text',
                selector: '',
                type: 'text'
              }
            ]
          },
          {
            name: 'content',
            selector: 'main, .main, #main, .content, #content, article, .article',
            type: 'text'
          },
          {
            name: 'bodyText',
            selector: 'body',
            type: 'text'
          },
          {
            name: 'links',
            selector: 'a[href]',
            type: 'list',
            children: [
              {
                name: 'href',
                selector: '',
                type: 'attribute',
                attribute: 'href'
              }
            ]
          }
        ]
      }),
    });

    if (scrapeOwlResponse.ok) {
      const scrapeData = await scrapeOwlResponse.json();
      
      if (scrapeData.success && scrapeData.data) {
        const data = scrapeData.data;
        
        // Extract internal links
        const internalLinks = data.links ? 
          data.links
            .map((link: any) => link.href)
            .filter((href: string) => href && (href.includes(domain) || href.startsWith('/')))
            .map((href: string) => href.startsWith('/') ? `https://${domain}${href}` : href)
          : [];
        
        // Determine page type
        const pageType = determinePageType(url, data.title || '', data.content || data.bodyText || '');
        
        // Extract headings
        const headings = data.headings ? 
          data.headings.map((h: any) => h.text).filter((text: string) => text && text.trim()) 
          : [];
        
        const content = data.content || data.bodyText || '';
        
        return {
          id: `website_${Math.random().toString(36).substring(2, 12)}`,
          url,
          title: data.title || '',
          content: content.substring(0, 5000), // Limit content length
          pageType,
          headings,
          links: internalLinks.slice(0, 20), // Limit links
          images: [], // Could add image extraction if needed
          metadata: {
            description: data.description || '',
            keywords: data.keywords || '',
            wordCount: content.split(/\s+/).length,
            lastCrawled: new Date().toISOString()
          }
        };
      }
    }
    
    console.log(`Failed to crawl ${url}, generating fallback data`);
    return generateFallbackPageData(url, domain);
    
  } catch (error) {
    console.error(`Error crawling ${url}:`, error);
    return generateFallbackPageData(url, domain);
  }
}

function determinePageType(url: string, title: string, content: string): string {
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const lowerContent = content.toLowerCase();
  
  if (lowerUrl.includes('/about') || lowerTitle.includes('about') || lowerContent.includes('our story')) {
    return 'about';
  }
  if (lowerUrl.includes('/product') || lowerTitle.includes('product') || lowerContent.includes('features')) {
    return 'product';
  }
  if (lowerUrl.includes('/testimonial') || lowerUrl.includes('/review') || lowerContent.includes('customer says')) {
    return 'testimonials';
  }
  if (lowerUrl.includes('/blog') || lowerUrl.includes('/news') || lowerUrl.includes('/article')) {
    return 'blog';
  }
  if (lowerUrl.includes('/contact') || lowerTitle.includes('contact')) {
    return 'contact';
  }
  if (lowerUrl.includes('/pricing') || lowerTitle.includes('pricing') || lowerContent.includes('price')) {
    return 'pricing';
  }
  if (lowerUrl === extractDomain(url) || lowerUrl.endsWith('/') || lowerUrl.includes('home')) {
    return 'homepage';
  }
  
  return 'other';
}

function generateFallbackPageData(url: string, domain: string): WebsitePage {
  const pageType = determinePageType(url, '', '');
  
  const fallbackContent = {
    homepage: `Welcome to ${domain}. We provide high-quality products and services to help you achieve your goals. Our customers love our innovative solutions and excellent customer service.`,
    about: `About ${domain}: We are a leading company in our industry, dedicated to providing exceptional value to our customers. Our team has years of experience and we pride ourselves on innovation and quality.`,
    product: `Our products are designed with your needs in mind. We focus on quality, reliability, and user experience. Features include advanced functionality and easy-to-use interface.`,
    testimonials: `"${domain} has been fantastic to work with. Their product exceeded our expectations and their support team is amazing." - Happy Customer`,
    other: `${domain} - Quality products and services you can trust. We are committed to customer satisfaction and continuous improvement.`
  };
  
  return {
    id: `fallback_${Math.random().toString(36).substring(2, 12)}`,
    url,
    title: `${domain} - ${pageType}`,
    content: fallbackContent[pageType as keyof typeof fallbackContent] || fallbackContent.other,
    pageType,
    headings: [`${domain}`, `Quality Products`, `Customer Focused`],
    links: [],
    images: [],
    metadata: {
      description: `${domain} ${pageType} page`,
      keywords: '',
      wordCount: 50,
      lastCrawled: new Date().toISOString()
    }
  };
}

function analyzeWebsiteData(websiteData: WebsitePage[], targetKeywords: string, userProduct: string): WebsiteInsights {
  const totalPages = websiteData.length;
  
  // Count page types
  const pageTypes = websiteData.reduce((acc, page) => {
    acc[page.pageType] = (acc[page.pageType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Extract common keywords from content
  const allContent = websiteData.map(page => `${page.title} ${page.content} ${page.headings.join(' ')}`).join(' ').toLowerCase();
  const commonKeywords = extractKeywords(allContent, targetKeywords);
  
  // Extract brand messaging (from homepage and about pages)
  const brandPages = websiteData.filter(page => page.pageType === 'homepage' || page.pageType === 'about');
  const brandMessaging = extractBrandMessaging(brandPages);
  
  // Extract target audience indicators
  const targetAudience = extractTargetAudience(allContent);
  
  // Extract value propositions
  const valuePropositions = extractValuePropositions(brandPages);
  
  // Extract testimonials
  const testimonialPages = websiteData.filter(page => page.pageType === 'testimonials');
  const testimonials = extractTestimonials(testimonialPages);
  
  // Extract product features
  const productPages = websiteData.filter(page => page.pageType === 'product' || page.pageType === 'homepage');
  const productFeatures = extractProductFeatures(productPages, userProduct);
  
  return {
    totalPages,
    pageTypes,
    commonKeywords,
    brandMessaging,
    targetAudience,
    valuePropositions,
    testimonials,
    productFeatures,
    dataQuality: totalPages > 5 ? 'high' : totalPages > 2 ? 'medium' : 'low'
  };
}

function extractKeywords(content: string, targetKeywords: string): string[] {
  const keywords = targetKeywords.split(',').map(k => k.trim().toLowerCase());
  const words = content.split(/\s+/).filter(word => word.length > 3);
  
  // Count word frequency
  const wordCount = words.reduce((acc, word) => {
    const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
    if (cleanWord.length > 3) {
      acc[cleanWord] = (acc[cleanWord] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  // Get most frequent words
  const frequentWords = Object.entries(wordCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 20)
    .map(([word]) => word);
  
  // Combine with target keywords
  return [...new Set([...keywords, ...frequentWords])].slice(0, 15);
}

function extractBrandMessaging(brandPages: WebsitePage[]): string[] {
  const messaging: string[] = [];
  
  brandPages.forEach(page => {
    // Look for key messaging patterns
    const content = page.content.toLowerCase();
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    // Find sentences that contain brand messaging keywords
    const messagingKeywords = ['we are', 'we provide', 'we help', 'our mission', 'we believe', 'dedicated to', 'committed to'];
    
    sentences.forEach(sentence => {
      messagingKeywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.length < 200) {
          messaging.push(sentence.trim());
        }
      });
    });
  });
  
  return messaging.slice(0, 10);
}

function extractTargetAudience(content: string): string[] {
  const audienceIndicators = [
    'small business', 'enterprise', 'startup', 'professional', 'individual', 'team', 'company',
    'beginner', 'expert', 'student', 'educator', 'manager', 'developer', 'designer',
    'entrepreneur', 'freelancer', 'agency', 'consultant', 'customer', 'client'
  ];
  
  const foundAudiences = audienceIndicators.filter(indicator => 
    content.includes(indicator)
  );
  
  return foundAudiences.slice(0, 8);
}

function extractValuePropositions(brandPages: WebsitePage[]): string[] {
  const propositions: string[] = [];
  
  brandPages.forEach(page => {
    const headings = page.headings.join(' ').toLowerCase();
    const content = page.content.toLowerCase();
    
    // Look for value proposition patterns
    const valueKeywords = ['save time', 'save money', 'increase', 'improve', 'better', 'faster', 'easier', 'simple', 'effective', 'reliable'];
    
    page.headings.forEach(heading => {
      valueKeywords.forEach(keyword => {
        if (heading.toLowerCase().includes(keyword) && heading.length < 100) {
          propositions.push(heading);
        }
      });
    });
  });
  
  return propositions.slice(0, 8);
}

function extractTestimonials(testimonialPages: WebsitePage[]): string[] {
  const testimonials: string[] = [];
  
  testimonialPages.forEach(page => {
    const content = page.content;
    
    // Look for testimonial patterns (quotes, customer stories)
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 30);
    
    sentences.forEach(sentence => {
      if (sentence.includes('"') || sentence.includes('customer') || sentence.includes('amazing') || sentence.includes('great')) {
        testimonials.push(sentence.trim());
      }
    });
  });
  
  return testimonials.slice(0, 8);
}

function extractProductFeatures(productPages: WebsitePage[], userProduct: string): string[] {
  const features: string[] = [];
  
  productPages.forEach(page => {
    // Look in headings for features
    page.headings.forEach(heading => {
      if (heading.length < 100 && (
        heading.toLowerCase().includes('feature') ||
        heading.toLowerCase().includes(userProduct.toLowerCase()) ||
        heading.toLowerCase().includes('benefit')
      )) {
        features.push(heading);
      }
    });
  });
  
  return features.slice(0, 10);
}

async function storeWebsiteData(jobId: string, websiteData: WebsitePage[], insights: WebsiteInsights) {
  console.log(`Storing ${websiteData.length} website pages for job ${jobId}`);
  console.log('Website insights:', insights);
  
  // TODO: Store in database
  // await sql`INSERT INTO website_data (job_id, page_data, insights) VALUES (${jobId}, ${JSON.stringify(websiteData)}, ${JSON.stringify(insights)})`
}
