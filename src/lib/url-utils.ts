/**
 * Smart URL validation and correction utilities
 */

export interface UrlValidationResult {
  isValid: boolean;
  correctedUrl: string;
  originalUrl: string;
  wasCorrected: boolean;
  error?: string;
}

/**
 * Validates and auto-corrects URLs with smart handling
 * Handles common cases like missing protocol, www variants, etc.
 */
export function validateAndCorrectUrl(input: string): UrlValidationResult {
  if (!input || input.trim() === '') {
    return {
      isValid: false,
      correctedUrl: '',
      originalUrl: input,
      wasCorrected: false,
      error: 'URL is required'
    };
  }

  const originalUrl = input.trim();
  let correctedUrl = originalUrl;
  let wasCorrected = false;

  try {
    // Step 1: Add protocol if missing
    if (!correctedUrl.match(/^https?:\/\//i)) {
      correctedUrl = `https://${correctedUrl}`;
      wasCorrected = true;
    }

    // Step 2: Handle common typos and formats
    correctedUrl = correctedUrl
      .replace(/^http:\/\//, 'https://') // Prefer HTTPS
      .replace(/\/+$/, '') // Remove trailing slashes
      .toLowerCase(); // Normalize to lowercase

    // Step 3: Validate the corrected URL
    const url = new URL(correctedUrl);
    
    // Step 4: Basic domain validation
    if (!url.hostname || url.hostname.length < 3) {
      return {
        isValid: false,
        correctedUrl: originalUrl,
        originalUrl,
        wasCorrected: false,
        error: 'Invalid domain name'
      };
    }

    // Step 5: Check for valid TLD (basic check)
    if (!url.hostname.includes('.')) {
      return {
        isValid: false,
        correctedUrl: originalUrl,
        originalUrl,
        wasCorrected: false,
        error: 'Domain must include a valid extension (e.g., .com, .org)'
      };
    }

    return {
      isValid: true,
      correctedUrl,
      originalUrl,
      wasCorrected: wasCorrected && correctedUrl !== originalUrl
    };

  } catch (error) {
    return {
      isValid: false,
      correctedUrl: originalUrl,
      originalUrl,
      wasCorrected: false,
      error: 'Invalid URL format'
    };
  }
}

/**
 * Validates Amazon URLs specifically
 */
export function validateAmazonUrl(input: string): UrlValidationResult {
  if (!input || input.trim() === '') {
    return {
      isValid: true, // Amazon URL is optional
      correctedUrl: '',
      originalUrl: input,
      wasCorrected: false
    };
  }

  const result = validateAndCorrectUrl(input);
  
  if (!result.isValid) {
    return result;
  }

  try {
    const url = new URL(result.correctedUrl);
    const hostname = url.hostname.toLowerCase();
    
    // Check if it's an Amazon domain
    const amazonDomains = [
      'amazon.com', 'amazon.co.uk', 'amazon.ca', 'amazon.de', 
      'amazon.fr', 'amazon.it', 'amazon.es', 'amazon.in',
      'amazon.com.au', 'amazon.co.jp', 'amazon.com.br'
    ];
    
    const isAmazonDomain = amazonDomains.some(domain => 
      hostname === domain || hostname === `www.${domain}`
    );
    
    if (!isAmazonDomain) {
      return {
        isValid: false,
        correctedUrl: result.correctedUrl,
        originalUrl: result.originalUrl,
        wasCorrected: result.wasCorrected,
        error: 'Please enter a valid Amazon product URL'
      };
    }

    return result;

  } catch (error) {
    return {
      isValid: false,
      correctedUrl: result.correctedUrl,
      originalUrl: result.originalUrl,
      wasCorrected: result.wasCorrected,
      error: 'Invalid Amazon URL format'
    };
  }
}

/**
 * Helper function to get domain name from URL for display
 */
export function getDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}