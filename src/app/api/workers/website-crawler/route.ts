import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { saveJobData } from '@/lib/db';

interface PageContent {
  url: string;
  title: string;
  description: string;
  allText: string;
  headings: string[];
  links: string[];
  images: string[];
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

async function scrapePageComprehensively(url: string): Promise<PageContent | null> {
  try {
    console.log(`Comprehensively scraping: ${url}`);
    
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
          // Get ALL text content
          { name: 'title', selector: 'title' },
          { name: 'meta_description', selector: 'meta[name="description"]', attribute: 'content' },
          { name: 'meta_keywords', selector: 'meta[name="keywords"]', attribute: 'content' },
          
          // Get ALL headings
          { name: 'h1', selector: 'h1', multiple: true },
          { name: 'h2', selector: 'h2', multiple: true },
          { name: 'h3', selector: 'h3', multiple: true },
          { name: 'h4', selector: 'h4', multiple: true },
          
          // Get ALL paragraph content
          { name: 'paragraphs', selector: 'p', multiple: true },
          
          // Get content from divs (often contains main content)
          { name: 'content_divs', selector: 'div', multiple: true },
          
          // Get list items (features, benefits, etc.)
          { name: 'list_items', selector: 'li', multiple: true },
          
          // Get spans (often contains important info)
          { name: 'spans', selector: 'span', multiple: true },
          
          // Get all links
          { name: 'links', selector: 'a', multiple: true, attribute: 'href' },
          { name: 'link_text', selector: 'a', multiple: true },
          
          // Get images and their alt text
          { name: 'images', selector: 'img', multiple: true, attribute: 'src' },
          { name: 'image_alts', selector: 'img', multiple: true, attribute: 'alt' },
          
          // Get form labels (contact info, etc.)
          { name: 'labels', selector: 'label', multiple: true },
          
          // Get button text (CTAs)
          { name: 'buttons', selector: 'button', multiple: true },
          { name: 'input_buttons', selector: 'input[type="submit"], input[type="button"]', multiple: true, attribute: 'value' },
          
          // Get footer content
          { name: 'footer', selector: 'footer' },
          
          // Get navigation content
          { name: 'nav', selector: 'nav' },
          
          // Get any testimonials or reviews on the page
          { name: 'testimonials', selector: '.testimonial, .review, .customer-review, [class*="testimonial"], [class*="review"]', multiple: true },
          
          // Get pricing information
          { name: 'prices', selector: '[class*="price"], [class*="cost"], .price, .pricing', multiple: true },
          
          // Get product descriptions
          { name: 'descriptions', selector: '[class*="description"], .description, .product-description', multiple: true },
          
          // Get benefits/features sections
          { name: 'features', selector: '[class*="feature"], [class*="benefit"], .features, .benefits', multiple: true },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ScrapeOwl failed for ${url}:`, response.status, errorText);
      throw new Error(`Scraping failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Combine ALL text content
    const allTextParts = [
      data.title || '',
      data.meta_description || '',
      data.meta_keywords || '',
      ...(data.h1 || []),
      ...(data.h2 || []),
      ...(data.h3 || []),
      ...(data.h4 || []),
      ...(data.paragraphs || []),
      ...(data.content_divs || []),
      ...(data.list_items || []),
      ...(data.spans || []),
      ...(data.link_text || []),
      ...(data.labels || []),
      ...(data.buttons || []),
      ...(data.input_buttons || []),
      data.footer || '',
      data.nav || '',
      ...(data.testimonials || []),
      ...(data.prices || []),
      ...(data.descriptions || []),
      ...(data.features || []),
      ...(data.image_alts || []).filter(alt => alt && alt.trim()),
    ].filter(text => text && text.trim() && text.length > 2);

    // Clean and deduplicate text
    const allText = [...new Set(allTextParts)]
      .map(text => text.trim())
      .filter(text => text.length > 3)
      .join(' ');

    // Combine all headings
    const headings = [
      ...(data.h1 || []),
      ...(data.h2 || []),
      ...(data.h3 || []),
      ...(data.h4 || [])
    ].filter(h => h && h.trim());

    return {
      url: url,
      title: data.title || 'No title found',
      description: data.meta_description || 'No description found',
      allText: allText,
      headings: headings,
      links: data.links || [],
      images: data.images || [],
      metadata: {
        textLength: allText.length,
        headingCount: headings.length,
        linkCount: (data.links || []).length,
        imageCount: (data.images || []).length,
        testimonialCount: (data.testimonials || []).length,
        featureCount: (data.features || []).length,
        crawled: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return null;
  }
}

function analyzeWebsiteContent(pages: PageContent[], keywords: string): any {
  // Combine all text from all pages
  const allContent = pages.map(page => page.allText).join(' ').toLowerCase();
  const totalTextLength = allContent.length;
  
  console.log(`Analyzing ${totalTextLength} characters of website content`);
  
  const keywordList = keywords.toLowerCase().split(' ').filter(k => k.length > 2);
  const keywordMatches = keywordList.map(keyword => ({
    keyword,
    count: (allContent.match(new RegExp(keyword, 'g')) || []).length
  }));
  
  // Extract value propositions from all content
  const valueProps = extractValuePropositions(allContent);
  const brandMessaging = extractBrandMessaging(pages);
  const customerFocus = analyzeCustomerFocus(allContent);
  const contentThemes = extractContentThemes(allContent);
  
  return {
    totalPages: pages.length,
    totalTextLength: totalTextLength,
    keywordRelevance: keywordMatches,
    valuePropositions: valueProps,
    brandMessaging: brandMessaging,
    customerFocus: customerFocus,
    contentThemes: contentThemes,
    pageBreakdown: pages.map(page => ({
      url: page.url,
      textLength: page.allText.length,
      headingCount: page.headings.length,
      hasTestimonials: page.metadata.testimonialCount > 0,
      hasFeatures: page.metadata.featureCount > 0
    })),
    metadata: {
      analyzed: new Date().toISOString(),
      keywords: keywords
    }
  };
}

function extractValuePropositions(content: string): string[] {
  const valuePatterns = [
    // Benefits and value statements
    /(?:we|our|this|it)\s+(?:helps?|provides?|offers?|delivers?|ensures?|guarantees?|enables?)[^.!?]{10,100}[.!?]/gi,
    // Quality and superiority claims
    /(?:best|leading|top|#1|premium|quality|superior|excellent|outstanding|proven)[^.!?]{10,80}[.!?]/gi,
    // Results and outcomes
    /(?:results?|benefits?|improves?|reduces?|increases?|saves?|eliminates?)[^.!?]{10,80}[.!?]/gi,
    // Problem solving
    /(?:solves?|fixes?|addresses?|tackles?|handles?)[^.!?]{10,80}[.!?]/gi,
    // Unique selling points
    /(?:only|unique|exclusive|patented|proprietary|revolutionary)[^.!?]{10,80}[.!?]/gi
  ];
  
  const props: string[] = [];
  valuePatterns.forEach(pattern => {
    const matches = content.match(pattern) || [];
    props.push(...matches.slice(0, 5));
  });
  
  return [...new Set(props)].slice(0, 15);
}

function extractBrandMessaging(pages: PageContent[]): any {
  const allHeadings = pages.flatMap(page => page.headings);
  const allTitles = pages.map(page => page.title);
  const allDescriptions = pages.map(page => page.description);
  
  return {
    mainTitles: allTitles,
    descriptions: allDescriptions,
    primaryHeadings: allHeadings.slice(0, 10),
    tone: analyzeTone(allHeadings.join(' ') + ' ' + allTitles.join(' ')),
    focusAreas: extractFocusAreas(allHeadings.join(' ') + ' ' + allDescriptions.join(' '))
  };
}

function analyzeTone(text: string): string {
  const lowerText = text.toLowerCase();
  
  const professionalWords = ['professional', 'enterprise', 'business', 'corporate', 'industry', 'expert'];
  const friendlyWords = ['friendly', 'easy', 'simple', 'fun', 'enjoy', 'love', 'happy'];
  const urgentWords = ['fast', 'quick', 'immediate', 'urgent', 'now', 'today', 'instant'];
  const trustWords = ['trusted', 'reliable', 'secure', 'guaranteed', 'certified', 'proven'];
  
  const scores = {
    professional: professionalWords.filter(word => lowerText.includes(word)).length,
    friendly: friendlyWords.filter(word => lowerText.includes(word)).length,
    urgent: urgentWords.filter(word => lowerText.includes(word)).length,
    trust: trustWords.filter(word => lowerText.includes(word)).length
  };
  
  const maxScore = Math.max(...Object.values(scores));
  const dominantTone = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] || 'neutral';
  
  return dominantTone;
}

function extractFocusAreas(text: string): string[] {
  const areas = [
    'quality', 'price', 'service', 'innovation', 'reliability', 'speed', 
    'convenience', 'support', 'experience', 'results', 'safety', 'security'
  ];
  return areas.filter(area => text.toLowerCase().includes(area));
}

function analyzeCustomerFocus(content: string): any {
  const customerWords = (content.match(/\b(?:customer|client|user|buyer|you|your)\b/g) || []).length;
  const productWords = (content.match(/\b(?:product|service|solution|feature|benefit)\b/g) || []).length;
  const problemWords = (content.match(/\b(?:problem|issue|challenge|pain|struggle|difficulty)\b/g) || []).length;
  
  return {
    customerMentions: customerWords,
    productMentions: productWords,
    problemMentions: problemWords,
    customerFocusRatio: customerWords / Math.max(productWords, 1),
    isCustomerCentric: customerWords > productWords,
    addressesProblems: problemWords > 5
  };
}

function extractContentThemes(content: string): string[] {
  const words = content.split(/\s+/)
    .map(word => word.replace(/[^\w]/g, '').toLowerCase())
    .filter(word => word.length > 4 && word.length < 20);
    
  const wordCounts = words.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(wordCounts)
    .filter(([word, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

export async function POST(request: NextRequest) {
  try {
    const { jobId, websiteUrl, targetKeywords } = await request.json();

    if (!jobId || !websiteUrl) {
      return NextResponse.json({ error: 'Job ID and website URL are required' }, { status: 400 });
    }

    const primaryProductUrl = websiteUrl;
    console.log(`Starting comprehensive website analysis for job ${jobId}: ${primaryProductUrl}`);
    
    await updateJobStatus(jobId, 'processing');
    
    const domain = extractDomain(primaryProductUrl);
    if (!domain) {
      throw new Error('Invalid website URL provided');
    }

    // Crawl multiple important pages for comprehensive analysis
    const urlsToCrawl = [
      primaryProductUrl,
      `https://${domain}`,
      `https://${domain}/about`,
      `https://${domain}/about-us`,
      `https://${domain}/products`,
      `https://${domain}/services`,
      `https://${domain}/features`,
      `https://${domain}/benefits`,
      `https://${domain}/testimonials`,
      `https://${domain}/reviews`,
      `https://${domain}/contact`,
    ];
    
    console.log(`Comprehensively crawling ${urlsToCrawl.length} pages...`);
    
    const websitePages: PageContent[] = [];
    for (const url of urlsToCrawl) {
      const pageContent = await scrapePageComprehensively(url);
      if (pageContent && pageContent.allText.length > 100) { // Only keep pages with substantial content
        websitePages.push(pageContent);
        console.log(`Scraped ${url}: ${pageContent.allText.length} characters`);
      }
    }

    if (websitePages.length === 0) {
      throw new Error('Could not extract any meaningful content from the website');
    }

    console.log(`Successfully scraped ${websitePages.length} pages with total ${websitePages.reduce((sum, page) => sum + page.allText.length, 0)} characters`);

    const analysis = analyzeWebsiteContent(websitePages, targetKeywords || '');
    
    const websiteAnalysis = {
      pages: websitePages,
      analysis: analysis,
      metadata: {
        timestamp: new Date().toISOString(),
        domain: domain,
        totalPages: websitePages.length,
        totalTextLength: analysis.totalTextLength,
        keywords: targetKeywords
      }
    };

    await saveJobData(jobId, 'website', websiteAnalysis);

    console.log(`Comprehensive website analysis completed for job ${jobId}. Analyzed ${websitePages.length} pages with ${analysis.totalTextLength} characters.`);

    return NextResponse.json({
      success: true,
      message: 'Comprehensive website analysis completed',
      data: {
        pagesAnalyzed: websitePages.length,
        totalTextLength: analysis.totalTextLength,
        domain: domain,
        keywordMatches: analysis.keywordRelevance,
        valuePropositions: analysis.valuePropositions.length,
        contentThemes: analysis.contentThemes.length
      }
    });

  } catch (error) {
    console.error('Website crawling error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Website analysis failed', details: errorMessage },
      { status: 500 }
    );
  }
}
