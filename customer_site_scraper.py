"""
Customer Site Scraper
Free web scraper for customer websites using requests + BeautifulSoup
Extracts reviews, testimonials, product info for Demographics Foundation analysis

Author: Customer Persona Pipeline
Dependencies: requests, beautifulsoup4, lxml
"""

import requests
from bs4 import BeautifulSoup, Comment
import json
import time
import logging
import re
from datetime import datetime
from urllib.parse import urljoin, urlparse
from typing import Dict, List, Optional, Tuple, Any
import sys

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CustomerSiteScraper:
    """
    Free web scraper for customer websites using requests + BeautifulSoup.
    Extracts reviews, testimonials, and product information.
    """
    
    def __init__(self, delay_between_requests: float = 1.0):
        """
        Initialize the scraper with configuration.
        
        Args:
            delay_between_requests: Delay in seconds between requests (respectful scraping)
        """
        self.delay = delay_between_requests
        self.session = requests.Session()
        
        # User agent to avoid basic bot detection
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        })
        
        # Common selectors for different types of content
        self.review_selectors = [
            # Generic review classes
            '.review', '.testimonial', '.feedback', '.customer-review', '.user-review',
            '.client-review', '.review-item', '.testimonial-item', '.feedback-item',
            
            # Common review containers
            '[class*="review"]', '[class*="testimonial"]', '[class*="feedback"]',
            '[data-testid*="review"]', '[data-testid*="testimonial"]',
            
            # Specific review platforms
            '.reviews-container .review', '.testimonials-section .testimonial',
            '.customer-feedback .feedback', '.reviews-list .review-item',
            
            # Generic content that might contain reviews
            'blockquote', '.quote', '.customer-quote', '.client-quote'
        ]
        
        self.rating_selectors = [
            '.rating', '.stars', '.star-rating', '[class*="star"]', '[class*="rating"]',
            '.review-rating', '.rating-stars', '.score', '[data-rating]',
            '.fa-star', '.star', '★', '.rating-value'
        ]
        
        self.product_selectors = [
            '.product', '.product-item', '.service', '.offering',
            '[class*="product"]', '[class*="service"]', '.shop-item',
            '.catalog-item', '.portfolio-item'
        ]

    def scrape_customer_site(self, url: str) -> Dict[str, Any]:
        """
        Main scraping function for customer websites.
        
        Args:
            url: Customer website URL to scrape
            
        Returns:
            Dictionary containing scraped data in Demographics Foundation format
        """
        logger.info(f"Starting scrape of customer site: {url}")
        
        try:
            # Initialize result structure
            result = {
                "source": "customer_website",
                "url": url,
                "scrape_date": datetime.now().isoformat(),
                "company_info": {},
                "products": [],
                "reviews": [],
                "total_reviews": 0,
                "data_quality": {
                    "reviews_found": False,
                    "ratings_available": False,
                    "dates_available": False,
                    "scrape_successful": False,
                    "pages_scraped": 0,
                    "errors": []
                }
            }
            
            # Get main page content
            soup = self._fetch_page(url)
            if not soup:
                result["data_quality"]["errors"].append("Failed to fetch main page")
                return result
            
            result["data_quality"]["pages_scraped"] += 1
            
            # Extract company information
            result["company_info"] = self.extract_company_info(soup, url)
            
            # Extract reviews and testimonials from main page
            main_reviews = self.extract_reviews(soup, url)
            result["reviews"].extend(main_reviews)
            
            # Try to find and scrape dedicated review/testimonial pages
            review_pages = self._find_review_pages(soup, url)
            for review_url in review_pages[:3]:  # Limit to 3 additional pages
                time.sleep(self.delay)
                logger.info(f"Scraping additional review page: {review_url}")
                
                review_soup = self._fetch_page(review_url)
                if review_soup:
                    result["data_quality"]["pages_scraped"] += 1
                    additional_reviews = self.extract_reviews(review_soup, review_url)
                    result["reviews"].extend(additional_reviews)
            
            # Extract product information
            result["products"] = self.extract_product_info(soup, url)
            
            # Calculate data quality metrics
            result["total_reviews"] = len(result["reviews"])
            result["data_quality"]["reviews_found"] = result["total_reviews"] > 0
            result["data_quality"]["ratings_available"] = any(
                review.get("rating") for review in result["reviews"]
            )
            result["data_quality"]["dates_available"] = any(
                review.get("date") for review in result["reviews"]
            )
            result["data_quality"]["scrape_successful"] = True
            
            logger.info(f"Scraping completed successfully. Found {result['total_reviews']} reviews across {result['data_quality']['pages_scraped']} pages")
            return result
            
        except Exception as e:
            logger.error(f"Error during scraping: {str(e)}")
            result["data_quality"]["errors"].append(f"Scraping error: {str(e)}")
            return result

    def _fetch_page(self, url: str) -> Optional[BeautifulSoup]:
        """
        Fetch and parse a webpage.
        
        Args:
            url: URL to fetch
            
        Returns:
            BeautifulSoup object or None if failed
        """
        try:
            logger.info(f"Fetching page: {url}")
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            # Check if content is HTML
            content_type = response.headers.get('content-type', '').lower()
            if 'text/html' not in content_type:
                logger.warning(f"Non-HTML content type: {content_type}")
                return None
            
            soup = BeautifulSoup(response.content, 'lxml')
            return soup
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error for {url}: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Parsing error for {url}: {str(e)}")
            return None

    def extract_reviews(self, soup: BeautifulSoup, page_url: str) -> List[Dict[str, Any]]:
        """
        Extract reviews and testimonials from a webpage.
        
        Args:
            soup: BeautifulSoup object of the page
            page_url: URL of the page being scraped
            
        Returns:
            List of review dictionaries
        """
        reviews = []
        review_counter = 1
        
        logger.info("Extracting reviews and testimonials...")
        
        # Try different review selectors
        for selector in self.review_selectors:
            try:
                review_elements = soup.select(selector)
                
                for element in review_elements:
                    review_data = self._extract_single_review(element, page_url, review_counter)
                    if review_data and self._is_valid_review(review_data):
                        reviews.append(review_data)
                        review_counter += 1
                        
                        # Stop if we found enough reviews to avoid duplicates
                        if len(reviews) >= 50:
                            break
                            
                if reviews:
                    logger.info(f"Found {len(review_elements)} potential reviews with selector: {selector}")
                    break  # Stop trying selectors once we find reviews
                    
            except Exception as e:
                logger.debug(f"Selector {selector} failed: {str(e)}")
                continue
        
        # Also look for structured data (JSON-LD)
        structured_reviews = self._extract_structured_reviews(soup, page_url, review_counter)
        reviews.extend(structured_reviews)
        
        # Remove duplicates based on text content
        unique_reviews = self._deduplicate_reviews(reviews)
        
        logger.info(f"Extracted {len(unique_reviews)} unique reviews from page")
        return unique_reviews

    def _extract_single_review(self, element, page_url: str, review_id: int) -> Optional[Dict[str, Any]]:
        """
        Extract data from a single review element.
        
        Args:
            element: BeautifulSoup element containing review
            page_url: URL of the page
            review_id: Unique review identifier
            
        Returns:
            Review dictionary or None if invalid
        """
        try:
            # Get review text
            review_text = self._extract_text_content(element)
            if not review_text or len(review_text.strip()) < 20:
                return None
            
            # Extract rating
            rating = self._extract_rating(element)
            
            # Extract reviewer name
            reviewer = self._extract_reviewer_name(element)
            
            # Extract date
            date = self._extract_date(element)
            
            return {
                "review_id": f"R{review_id:03d}-Customer",
                "text": review_text.strip(),
                "rating": rating,
                "reviewer": reviewer,
                "date": date,
                "source_url": page_url
            }
            
        except Exception as e:
            logger.debug(f"Error extracting review: {str(e)}")
            return None

    def _extract_text_content(self, element) -> str:
        """Extract clean text content from an element."""
        # Remove script and style elements
        for script in element(["script", "style"]):
            script.decompose()
        
        # Get text and clean it
        text = element.get_text()
        text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
        text = text.strip()
        
        return text

    def _extract_rating(self, element) -> Optional[str]:
        """Extract rating from review element."""
        # Look for star ratings
        for selector in self.rating_selectors:
            rating_elem = element.select_one(selector)
            if rating_elem:
                # Try to extract numeric rating
                rating_text = rating_elem.get_text().strip()
                
                # Look for patterns like "5/5", "4.5 stars", "★★★★★"
                rating_patterns = [
                    r'(\d+(?:\.\d+)?)[/\s]*(?:out of\s*)?(\d+)',  # "4.5/5" or "4.5 out of 5"
                    r'(\d+(?:\.\d+)?)\s*(?:stars?|★)',  # "4.5 stars" or "4.5★"
                    r'(★+)',  # "★★★★★"
                ]
                
                for pattern in rating_patterns:
                    match = re.search(pattern, rating_text)
                    if match:
                        if pattern == r'(★+)':
                            return str(len(match.group(1)))
                        else:
                            return match.group(1)
                
                # Check for data attributes
                for attr in ['data-rating', 'data-score', 'rating', 'score']:
                    if rating_elem.get(attr):
                        return str(rating_elem.get(attr))
        
        return None

    def _extract_reviewer_name(self, element) -> Optional[str]:
        """Extract reviewer name or initials."""
        # Common selectors for reviewer names
        name_selectors = [
            '.reviewer-name', '.customer-name', '.author', '.name',
            '[class*="name"]', '[class*="author"]', '[class*="reviewer"]',
            '.review-author', '.testimonial-author'
        ]
        
        for selector in name_selectors:
            name_elem = element.select_one(selector)
            if name_elem:
                name = name_elem.get_text().strip()
                if name and len(name) < 100:  # Reasonable name length
                    return name
        
        return None

    def _extract_date(self, element) -> Optional[str]:
        """Extract review date."""
        # Look for date patterns
        date_selectors = [
            '.date', '.review-date', '.timestamp', '[class*="date"]',
            'time', '[datetime]', '.posted-date'
        ]
        
        for selector in date_selectors:
            date_elem = element.select_one(selector)
            if date_elem:
                # Try datetime attribute first
                if date_elem.get('datetime'):
                    return date_elem.get('datetime')
                
                # Extract text and look for date patterns
                date_text = date_elem.get_text().strip()
                if self._is_date_like(date_text):
                    return date_text
        
        return None

    def _is_date_like(self, text: str) -> bool:
        """Check if text looks like a date."""
        date_patterns = [
            r'\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}',  # MM/DD/YYYY
            r'\d{4}[/\-]\d{1,2}[/\-]\d{1,2}',    # YYYY/MM/DD
            r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)',  # Month names
            r'\d{1,2}\s+(days?|weeks?|months?|years?)\s+ago',  # "3 days ago"
        ]
        
        for pattern in date_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        
        return False

    def _extract_structured_reviews(self, soup: BeautifulSoup, page_url: str, start_id: int) -> List[Dict[str, Any]]:
        """Extract reviews from structured data (JSON-LD, microdata)."""
        reviews = []
        
        # Look for JSON-LD structured data
        json_scripts = soup.find_all('script', type='application/ld+json')
        for script in json_scripts:
            try:
                data = json.loads(script.string)
                if isinstance(data, list):
                    data = data[0]  # Take first item if it's a list
                
                # Look for Review or reviews property
                if data.get('@type') == 'Review' or 'review' in data:
                    structured_review = self._parse_structured_review(data, page_url, start_id + len(reviews))
                    if structured_review:
                        reviews.append(structured_review)
                        
            except (json.JSONDecodeError, Exception) as e:
                logger.debug(f"Error parsing JSON-LD: {str(e)}")
                continue
        
        return reviews

    def _parse_structured_review(self, data: Dict, page_url: str, review_id: int) -> Optional[Dict[str, Any]]:
        """Parse a single structured review."""
        try:
            review_text = ""
            rating = None
            reviewer = None
            date = None
            
            if data.get('@type') == 'Review':
                review_text = data.get('reviewBody', '')
                rating = data.get('reviewRating', {}).get('ratingValue')
                reviewer = data.get('author', {}).get('name') if isinstance(data.get('author'), dict) else data.get('author')
                date = data.get('datePublished')
            
            if review_text and len(review_text.strip()) >= 20:
                return {
                    "review_id": f"R{review_id:03d}-Customer",
                    "text": review_text.strip(),
                    "rating": str(rating) if rating else None,
                    "reviewer": reviewer,
                    "date": date,
                    "source_url": page_url
                }
                
        except Exception as e:
            logger.debug(f"Error parsing structured review: {str(e)}")
            
        return None

    def _is_valid_review(self, review: Dict[str, Any]) -> bool:
        """Validate if extracted review meets quality criteria."""
        text = review.get("text", "")
        
        # Minimum length requirement
        if len(text.strip()) < 20:
            return False
        
        # Check if it's not just navigation or boilerplate text
        boilerplate_keywords = [
            'navigation', 'menu', 'footer', 'header', 'copyright',
            'privacy policy', 'terms of service', 'cookie policy',
            'subscribe', 'newsletter', 'follow us'
        ]
        
        text_lower = text.lower()
        for keyword in boilerplate_keywords:
            if keyword in text_lower and len(text) < 100:
                return False
        
        return True

    def _deduplicate_reviews(self, reviews: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate reviews based on text similarity."""
        unique_reviews = []
        seen_texts = set()
        
        for review in reviews:
            text = review.get("text", "").strip().lower()
            # Use first 100 characters for deduplication
            text_key = text[:100]
            
            if text_key not in seen_texts:
                seen_texts.add(text_key)
                unique_reviews.append(review)
        
        return unique_reviews

    def _find_review_pages(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """Find links to dedicated review or testimonial pages."""
        review_page_urls = []
        
        # Common patterns for review page links
        review_link_patterns = [
            r'reviews?', r'testimonials?', r'feedback', r'customers?',
            r'what.*say', r'success.*stories', r'case.*studies'
        ]
        
        # Find all links
        links = soup.find_all('a', href=True)
        
        for link in links:
            href = link.get('href')
            link_text = link.get_text().strip().lower()
            
            # Check if link text suggests it's a review page
            for pattern in review_link_patterns:
                if re.search(pattern, link_text) or re.search(pattern, href.lower() if href else ''):
                    full_url = urljoin(base_url, href)
                    if full_url not in review_page_urls and full_url != base_url:
                        review_page_urls.append(full_url)
                        break
        
        return review_page_urls[:3]  # Limit to 3 additional pages

    def extract_product_info(self, soup: BeautifulSoup, page_url: str) -> List[Dict[str, Any]]:
        """
        Extract product information from the webpage.
        
        Args:
            soup: BeautifulSoup object
            page_url: URL of the page
            
        Returns:
            List of product dictionaries
        """
        products = []
        logger.info("Extracting product information...")
        
        # Try different product selectors
        for selector in self.product_selectors:
            try:
                product_elements = soup.select(selector)
                
                for element in product_elements:
                    product_data = self._extract_single_product(element)
                    if product_data:
                        products.append(product_data)
                        
                        # Limit to avoid too much data
                        if len(products) >= 20:
                            break
                            
                if products:
                    logger.info(f"Found {len(product_elements)} potential products with selector: {selector}")
                    break
                    
            except Exception as e:
                logger.debug(f"Product selector {selector} failed: {str(e)}")
                continue
        
        # If no products found with specific selectors, try general extraction
        if not products:
            products = self._extract_general_products(soup)
        
        logger.info(f"Extracted {len(products)} products")
        return products

    def _extract_single_product(self, element) -> Optional[Dict[str, Any]]:
        """Extract data from a single product element."""
        try:
            # Extract title
            title_selectors = ['h1', 'h2', 'h3', '.title', '.name', '.product-title', '.product-name']
            title = None
            for selector in title_selectors:
                title_elem = element.select_one(selector)
                if title_elem:
                    title = title_elem.get_text().strip()
                    break
            
            if not title:
                return None
            
            # Extract description
            desc_selectors = ['.description', '.product-description', 'p', '.summary']
            description = ""
            for selector in desc_selectors:
                desc_elem = element.select_one(selector)
                if desc_elem:
                    description = desc_elem.get_text().strip()
                    break
            
            # Extract price
            price_selectors = ['.price', '.cost', '[class*="price"]', '.amount']
            price = None
            for selector in price_selectors:
                price_elem = element.select_one(selector)
                if price_elem:
                    price_text = price_elem.get_text().strip()
                    # Look for currency patterns
                    if re.search(r'[\$£€¥]|\d+(?:\.\d{2})?', price_text):
                        price = price_text
                        break
            
            return {
                "title": title,
                "description": description[:500] if description else "",  # Limit description length
                "price": price
            }
            
        except Exception as e:
            logger.debug(f"Error extracting product: {str(e)}")
            return None

    def _extract_general_products(self, soup: BeautifulSoup) -> List[Dict[str, Any]]:
        """Extract products using general patterns when specific selectors fail."""
        products = []
        
        # Look for headings that might be product titles
        headings = soup.find_all(['h1', 'h2', 'h3'], limit=10)
        
        for heading in headings:
            title = heading.get_text().strip()
            if len(title) > 5 and len(title) < 200:
                # Look for description in nearby elements
                description = ""
                next_elem = heading.find_next(['p', 'div'])
                if next_elem:
                    desc_text = next_elem.get_text().strip()
                    if len(desc_text) > 20:
                        description = desc_text
                
                products.append({
                    "title": title,
                    "description": description[:500],
                    "price": None
                })
        
        return products

    def extract_company_info(self, soup: BeautifulSoup, page_url: str) -> Dict[str, Any]:
        """
        Extract company information from the webpage.
        
        Args:
            soup: BeautifulSoup object
            page_url: URL of the page
            
        Returns:
            Dictionary containing company information
        """
        logger.info("Extracting company information...")
        
        company_info = {
            "name": "",
            "description": "",
            "website": page_url
        }
        
        # Extract company name
        # Try title tag first
        title_tag = soup.find('title')
        if title_tag:
            company_info["name"] = title_tag.get_text().strip()
        
        # Try meta description
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc:
            company_info["description"] = meta_desc.get('content', '').strip()
        
        # Look for about us section
        about_selectors = [
            '[class*="about"]', '[id*="about"]',
            '[class*="company"]', '[id*="company"]',
            '.mission', '.vision', '.story'
        ]
        
        for selector in about_selectors:
            about_elem = soup.select_one(selector)
            if about_elem:
                about_text = about_elem.get_text().strip()
                if len(about_text) > len(company_info["description"]):
                    company_info["description"] = about_text[:1000]  # Limit length
                break
        
        # If no specific about section, use first paragraph
        if not company_info["description"]:
            first_p = soup.find('p')
            if first_p:
                company_info["description"] = first_p.get_text().strip()[:500]
        
        logger.info(f"Extracted company info: {company_info['name'][:50]}...")
        return company_info

    def save_scraped_data(self, data: Dict[str, Any], filename: str) -> bool:
        """
        Save scraped data to JSON file.
        
        Args:
            data: Scraped data dictionary
            filename: Output filename
            
        Returns:
            True if successful, False otherwise
        """
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Scraped data saved to {filename}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving data to {filename}: {str(e)}")
            return False

    def validate_scraped_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate scraped data quality.
        
        Args:
            data: Scraped data dictionary
            
        Returns:
            Validation results dictionary
        """
        validation = {
            "is_valid": True,
            "warnings": [],
            "errors": [],
            "quality_score": 0,
            "recommendations": []
        }
        
        # Check if scraping was successful
        if not data.get("data_quality", {}).get("scrape_successful", False):
            validation["errors"].append("Scraping failed")
            validation["is_valid"] = False
            return validation
        
        # Check review count
        review_count = data.get("total_reviews", 0)
        if review_count == 0:
            validation["warnings"].append("No reviews found")
            validation["recommendations"].append("Check if the website has a dedicated reviews or testimonials page")
        elif review_count < 20:
            validation["warnings"].append(f"Only {review_count} reviews found (minimum 20 recommended)")
        
        # Calculate quality score
        score = 0
        if review_count > 0:
            score += 40
        if review_count >= 20:
            score += 30
        if data.get("data_quality", {}).get("ratings_available", False):
            score += 15
        if data.get("data_quality", {}).get("dates_available", False):
            score += 15
        
        validation["quality_score"] = score
        
        # Add recommendations based on score
        if score < 50:
            validation["recommendations"].append("Consider checking additional pages or improving selectors")
        
        logger.info(f"Data validation complete. Quality score: {score}/100")
        return validation


# Example usage and testing
if __name__ == "__main__":
    # Example usage
    scraper = CustomerSiteScraper()
    
    # Test URL (replace with actual customer site)
    test_url = "https://example.com"
    
    if len(sys.argv) > 1:
        test_url = sys.argv[1]
    
    print(f"Testing scraper with URL: {test_url}")
    
    # Scrape the site
    scraped_data = scraper.scrape_customer_site(test_url)
    
    # Validate the data
    validation = scraper.validate_scraped_data(scraped_data)
    
    # Save the data
    output_file = "customer_site_data.json"
    scraper.save_scraped_data(scraped_data, output_file)
    
    # Print summary
    print(f"\n=== Scraping Summary ===")
    print(f"URL: {scraped_data['url']}")
    print(f"Reviews found: {scraped_data['total_reviews']}")
    print(f"Products found: {len(scraped_data['products'])}")
    print(f"Pages scraped: {scraped_data['data_quality']['pages_scraped']}")
    print(f"Quality score: {validation['quality_score']}/100")
    
    if validation['warnings']:
        print(f"\nWarnings:")
        for warning in validation['warnings']:
            print(f"  - {warning}")
    
    if validation['recommendations']:
        print(f"\nRecommendations:")
        for rec in validation['recommendations']:
            print(f"  - {rec}")
    
    print(f"\nData saved to: {output_file}")