"""
Shopify Review Scraper
Specialized scraper for Shopify stores that tries multiple review APIs first,
then falls back to Selenium for JavaScript rendering.

Author: Customer Persona Pipeline
Dependencies: requests, selenium, webdriver-manager
"""

import requests
import json
import time
import logging
import re
from datetime import datetime
from urllib.parse import urlparse, urljoin
from typing import Dict, List, Optional, Any, Tuple
import sys

# Selenium imports
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class ShopifyReviewScraper:
    """
    Specialized scraper for Shopify stores that prioritizes API endpoints
    and falls back to Selenium for guaranteed review extraction.
    Supports both customer and competitor URL scraping with tiered review limits.
    """
    
    # Tier-based review limits
    TIER_LIMITS = {
        "basic": 20,
        "premium": 200,
        "enterprise": 200,
        "pro": 200
    }
    
    def __init__(self, tier: str = "basic"):
        """
        Initialize the Shopify review scraper.
        
        Args:
            tier: Persona offering tier ("basic", "premium", "enterprise", "pro")
                 Determines maximum reviews per site (20 for basic, 200 for higher tiers)
        """
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/html, */*',
            'Accept-Language': 'en-US,en;q=0.9',
        })
        self.driver = None
        self.review_counter = 1
        
        # Set tier and review limits
        self.tier = tier.lower()
        self.max_reviews = self.TIER_LIMITS.get(self.tier, 20)  # Default to basic if invalid tier
        
        logger.info(f"🎯 Initialized Shopify scraper with tier: {self.tier.upper()} (max {self.max_reviews} reviews per site)")
        
    def scrape_shopify_reviews(self, url: str) -> Dict[str, Any]:
        """
        Main method to scrape reviews from a Shopify store.
        Tries API endpoints first, then falls back to Selenium.
        
        Args:
            url: The Shopify store URL
            
        Returns:
            Dictionary containing all scraped review data
        """
        logger.info(f"🛍️ Starting Shopify review scraping for: {url}")
        
        # Parse the URL to get shop domain
        parsed = urlparse(url)
        domain = parsed.netloc
        shop_name = domain.split('.')[0]
        
        # Initialize result structure
        result = {
            "source": "shopify_store",
            "url": url,
            "shop_name": shop_name,
            "domain": domain,
            "scrape_date": datetime.now().isoformat(),
            "scrape_method": None,
            "tier": self.tier,
            "max_reviews_per_site": self.max_reviews,
            "reviews": [],
            "products": [],
            "total_reviews": 0,
            "data_quality": {
                "reviews_found": False,
                "ratings_available": False,
                "dates_available": False,
                "method_used": None,
                "api_attempts": [],
                "errors": [],
                "tier_limit_applied": False,
                "available_reviews_estimated": 0
            }
        }
        
        # Step 1: Try API endpoints
        logger.info("📡 Step 1: Trying Shopify review API endpoints...")
        
        # Try Judge.me API
        judge_reviews = self._try_judge_me_api(shop_name, domain)
        if judge_reviews:
            # Apply tier limit
            limited_reviews = judge_reviews[:self.max_reviews]
            result["reviews"].extend(limited_reviews)
            result["data_quality"]["api_attempts"].append("judge.me - success")
            result["scrape_method"] = "judge.me_api"
            
            if len(judge_reviews) > self.max_reviews:
                result["data_quality"]["tier_limit_applied"] = True
                result["data_quality"]["available_reviews_estimated"] = len(judge_reviews)
                logger.info(f"✅ Collected {len(limited_reviews)} of {len(judge_reviews)} available reviews via Judge.me API (tier limit: {self.max_reviews})")
            else:
                logger.info(f"✅ Found {len(limited_reviews)} reviews via Judge.me API")
        else:
            result["data_quality"]["api_attempts"].append("judge.me - failed")
        
        # Try Shopify native product reviews
        if not result["reviews"]:
            shopify_reviews = self._try_shopify_product_api(url)
            if shopify_reviews:
                # Apply tier limit
                limited_reviews = shopify_reviews[:self.max_reviews]
                result["reviews"].extend(limited_reviews)
                result["data_quality"]["api_attempts"].append("shopify_products - success")
                result["scrape_method"] = "shopify_product_api"
                
                if len(shopify_reviews) > self.max_reviews:
                    result["data_quality"]["tier_limit_applied"] = True
                    result["data_quality"]["available_reviews_estimated"] = len(shopify_reviews)
                    logger.info(f"✅ Collected {len(limited_reviews)} of {len(shopify_reviews)} available reviews via Shopify Product API (tier limit: {self.max_reviews})")
                else:
                    logger.info(f"✅ Found {len(limited_reviews)} reviews via Shopify Product API")
            else:
                result["data_quality"]["api_attempts"].append("shopify_products - failed")
        
        # Try Yotpo API
        if not result["reviews"]:
            yotpo_reviews = self._try_yotpo_api(url)
            if yotpo_reviews:
                # Apply tier limit
                limited_reviews = yotpo_reviews[:self.max_reviews]
                result["reviews"].extend(limited_reviews)
                result["data_quality"]["api_attempts"].append("yotpo - success")
                result["scrape_method"] = "yotpo_api"
                
                if len(yotpo_reviews) > self.max_reviews:
                    result["data_quality"]["tier_limit_applied"] = True
                    result["data_quality"]["available_reviews_estimated"] = len(yotpo_reviews)
                    logger.info(f"✅ Collected {len(limited_reviews)} of {len(yotpo_reviews)} available reviews via Yotpo API (tier limit: {self.max_reviews})")
                else:
                    logger.info(f"✅ Found {len(limited_reviews)} reviews via Yotpo API")
            else:
                result["data_quality"]["api_attempts"].append("yotpo - failed")
        
        # Step 2: If no API results, use Selenium
        if not result["reviews"]:
            logger.info("🌐 Step 2: No API results, falling back to Selenium...")
            selenium_data = self._scrape_with_selenium(url)
            
            # Apply tier limit to Selenium results
            all_selenium_reviews = selenium_data["reviews"]
            limited_selenium_reviews = all_selenium_reviews[:self.max_reviews]
            
            result["reviews"] = limited_selenium_reviews
            result["products"] = selenium_data["products"]
            result["scrape_method"] = "selenium"
            result["data_quality"]["method_used"] = "selenium_javascript_rendering"
            
            if len(all_selenium_reviews) > self.max_reviews:
                result["data_quality"]["tier_limit_applied"] = True
                result["data_quality"]["available_reviews_estimated"] = len(all_selenium_reviews)
                logger.info(f"✅ Collected {len(limited_selenium_reviews)} of {len(all_selenium_reviews)} available reviews via Selenium (tier limit: {self.max_reviews})")
            else:
                logger.info(f"✅ Found {len(limited_selenium_reviews)} reviews via Selenium")
        
        # Update data quality metrics
        result["total_reviews"] = len(result["reviews"])
        result["data_quality"]["reviews_found"] = result["total_reviews"] > 0
        result["data_quality"]["ratings_available"] = any(r.get("rating") for r in result["reviews"])
        result["data_quality"]["dates_available"] = any(r.get("date") for r in result["reviews"])
        result["data_quality"]["method_used"] = result["scrape_method"]
        
        logger.info(f"🎉 Scraping complete! Total reviews found: {result['total_reviews']}")
        logger.info(f"📊 Method used: {result['scrape_method']}")
        
        return result
    
    def scrape_customer_and_competitors(self, customer_url: str, competitor_urls: List[str] = None) -> Dict[str, Any]:
        """
        Scrape reviews from customer URL and multiple competitor URLs.
        
        Args:
            customer_url: Primary customer/client Shopify store URL
            competitor_urls: List of competitor Shopify store URLs
            
        Returns:
            Dictionary containing customer data and list of competitor data
        """
        logger.info(f"🏪 Starting multi-store scraping")
        logger.info(f"👤 Customer URL: {customer_url}")
        if competitor_urls:
            logger.info(f"🏆 Competitor URLs: {len(competitor_urls)} stores")
            for i, url in enumerate(competitor_urls, 1):
                logger.info(f"   Competitor {i}: {url}")
        
        # Initialize results structure
        results = {
            "scrape_type": "customer_and_competitors",
            "scrape_date": datetime.now().isoformat(),
            "tier": self.tier,
            "max_reviews_per_site": self.max_reviews,
            "customer_data": None,
            "competitor_data": [],
            "total_customer_reviews": 0,
            "total_competitor_reviews": 0,
            "summary": {
                "stores_scraped": 1,  # Customer store
                "total_reviews": 0,
                "successful_scrapes": 0,
                "failed_scrapes": 0
            }
        }
        
        # Reset review counter for consistent numbering
        original_counter = self.review_counter
        
        # Scrape customer store
        logger.info(f"\n🎯 SCRAPING CUSTOMER STORE")
        logger.info(f"=" * 50)
        
        self.review_counter = 1  # Start customer reviews at R001
        try:
            customer_data = self.scrape_shopify_reviews(customer_url)
            customer_data["store_type"] = "customer"
            customer_data["store_index"] = 0
            
            results["customer_data"] = customer_data
            results["total_customer_reviews"] = customer_data["total_reviews"]
            results["summary"]["successful_scrapes"] += 1
            results["summary"]["total_reviews"] += customer_data["total_reviews"]
            
            logger.info(f"✅ Customer store complete: {customer_data['total_reviews']} reviews")
            
        except Exception as e:
            logger.error(f"❌ Customer store failed: {str(e)}")
            results["summary"]["failed_scrapes"] += 1
        
        # Scrape competitor stores
        if competitor_urls:
            for i, competitor_url in enumerate(competitor_urls, 1):
                logger.info(f"\n🏆 SCRAPING COMPETITOR {i}")
                logger.info(f"=" * 50)
                logger.info(f"URL: {competitor_url}")
                
                # Reset counter for each competitor
                self.review_counter = 1
                
                try:
                    competitor_data = self.scrape_shopify_reviews(competitor_url)
                    competitor_data["store_type"] = "competitor"
                    competitor_data["store_index"] = i
                    competitor_data["competitor_number"] = i
                    
                    results["competitor_data"].append(competitor_data)
                    results["total_competitor_reviews"] += competitor_data["total_reviews"]
                    results["summary"]["stores_scraped"] += 1
                    results["summary"]["successful_scrapes"] += 1
                    results["summary"]["total_reviews"] += competitor_data["total_reviews"]
                    
                    logger.info(f"✅ Competitor {i} complete: {competitor_data['total_reviews']} reviews")
                    
                    # Save individual competitor file
                    self.save_competitor_data(competitor_data, i)
                    
                except Exception as e:
                    logger.error(f"❌ Competitor {i} failed: {str(e)}")
                    results["summary"]["failed_scrapes"] += 1
                    continue
        
        # Restore original counter
        self.review_counter = original_counter
        
        # Log final summary
        logger.info(f"\n🎉 MULTI-STORE SCRAPING COMPLETE")
        logger.info(f"=" * 50)
        logger.info(f"📊 Summary:")
        logger.info(f"   Customer reviews: {results['total_customer_reviews']}")
        logger.info(f"   Competitor reviews: {results['total_competitor_reviews']}")
        logger.info(f"   Total reviews: {results['summary']['total_reviews']}")
        logger.info(f"   Successful scrapes: {results['summary']['successful_scrapes']}/{results['summary']['stores_scraped']}")
        
        return results
    
    def save_competitor_data(self, competitor_data: Dict[str, Any], competitor_number: int) -> str:
        """
        Save individual competitor data to separate JSON file.
        
        Args:
            competitor_data: Scraped competitor data
            competitor_number: Competitor index (1, 2, 3, etc.)
            
        Returns:
            Path to saved file
        """
        filename = f"competitor_{competitor_number}_reviews.json"
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(competitor_data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"💾 Competitor {competitor_number} data saved to: {filename}")
            return filename
            
        except Exception as e:
            logger.error(f"Error saving competitor {competitor_number} data: {str(e)}")
            return ""
    
    def _try_judge_me_api(self, shop_name: str, domain: str) -> List[Dict[str, Any]]:
        """Try to fetch reviews from Judge.me API with pagination support."""
        all_reviews = []
        
        try:
            # Try different Judge.me URL patterns with pagination
            base_urls = [
                f"https://judge.me/api/v1/reviews?shop_domain={shop_name}.myshopify.com",
                f"https://judge.me/api/v1/reviews?shop_domain={domain}",
                f"https://judge.me/api/v1/widgets/product_review?shop_domain={domain}",
            ]
            
            for base_url in base_urls:
                page = 1
                per_page = 50  # Judge.me typical page size
                
                while len(all_reviews) < self.max_reviews:
                    # Add pagination parameters
                    judge_url = f"{base_url}&page={page}&per_page={per_page}"
                    logger.info(f"Trying Judge.me API: {judge_url}")
                    
                    try:
                        response = self.session.get(judge_url, timeout=10)
                        
                        if response.status_code == 200:
                            data = response.json()
                            page_reviews = []
                            
                            # Extract reviews from Judge.me response
                            if "reviews" in data and data["reviews"]:
                                for review in data["reviews"]:
                                    if len(all_reviews) >= self.max_reviews:
                                        break
                                        
                                    page_reviews.append({
                                        "review_id": f"R{self.review_counter:03d}",
                                        "text": review.get("body", ""),
                                        "rating": review.get("rating"),
                                        "reviewer": review.get("reviewer", {}).get("name", "Anonymous"),
                                        "date": review.get("created_at"),
                                        "verified": review.get("verified", False),
                                        "source": "judge.me"
                                    })
                                    self.review_counter += 1
                                
                                all_reviews.extend(page_reviews)
                                
                                # Check if we have more pages
                                if len(page_reviews) < per_page:
                                    break  # No more reviews
                                    
                                page += 1
                                logger.info(f"📄 Loaded page {page-1}, total reviews so far: {len(all_reviews)}")
                                
                            else:
                                break  # No reviews found
                        else:
                            break  # API call failed
                            
                    except json.JSONDecodeError:
                        break  # Invalid JSON response
                    except Exception as e:
                        logger.debug(f"Error on page {page}: {str(e)}")
                        break
                
                if all_reviews:
                    logger.info(f"Judge.me API: Collected {len(all_reviews)} reviews across {page-1} pages")
                    return all_reviews
                        
        except Exception as e:
            logger.debug(f"Judge.me API error: {str(e)}")
        
        return all_reviews
    
    def _try_shopify_product_api(self, url: str) -> List[Dict[str, Any]]:
        """Try to fetch reviews from Shopify's product.js endpoint."""
        try:
            # Get products list first
            products_url = urljoin(url, "/products.json")
            logger.info(f"Fetching products from: {products_url}")
            
            response = self.session.get(products_url, timeout=10)
            if response.status_code != 200:
                return []
            
            products_data = response.json()
            reviews = []
            
            # Check each product for reviews
            for product in products_data.get("products", [])[:5]:  # Limit to first 5 products
                handle = product.get("handle")
                if not handle:
                    continue
                
                # Try to get product data with reviews
                product_url = urljoin(url, f"/products/{handle}.js")
                logger.info(f"Checking product: {product_url}")
                
                try:
                    prod_response = self.session.get(product_url, timeout=5)
                    if prod_response.status_code == 200:
                        prod_data = prod_response.json()
                        
                        # Look for reviews in product data
                        # Note: Native Shopify reviews might be in different formats
                        if "reviews" in prod_data:
                            for review in prod_data["reviews"]:
                                reviews.append({
                                    "review_id": f"R{self.review_counter:03d}",
                                    "text": review.get("content", review.get("body", "")),
                                    "rating": review.get("rating"),
                                    "reviewer": review.get("author", "Anonymous"),
                                    "date": review.get("created_at"),
                                    "product": product.get("title"),
                                    "source": "shopify_native"
                                })
                                self.review_counter += 1
                                
                except Exception as e:
                    logger.debug(f"Error fetching product {handle}: {str(e)}")
                    continue
            
            return reviews
            
        except Exception as e:
            logger.debug(f"Shopify Product API error: {str(e)}")
        
        return []
    
    def _try_yotpo_api(self, url: str) -> List[Dict[str, Any]]:
        """Try to fetch reviews from Yotpo API with pagination support."""
        all_reviews = []
        
        try:
            # First, try to find Yotpo app key from the page
            logger.info("Looking for Yotpo integration...")
            response = self.session.get(url, timeout=10)
            
            if response.status_code == 200:
                # Look for Yotpo app key in the HTML
                app_key_match = re.search(r'yotpo.*?app_key["\']?\s*[:=]\s*["\']([^"\']+)', response.text, re.IGNORECASE)
                
                if app_key_match:
                    app_key = app_key_match.group(1)
                    logger.info(f"Found Yotpo app key: {app_key[:10]}...")
                    
                    # Paginate through Yotpo reviews
                    page = 1
                    per_page = 100  # Yotpo typical page size
                    
                    while len(all_reviews) < self.max_reviews:
                        # Try Yotpo reviews endpoint with pagination
                        yotpo_url = f"https://api.yotpo.com/v1/apps/{app_key}/reviews?page={page}&count={per_page}"
                        logger.info(f"Trying Yotpo API page {page}: {yotpo_url}")
                        
                        try:
                            yotpo_response = self.session.get(yotpo_url, timeout=10)
                            
                            if yotpo_response.status_code == 200:
                                data = yotpo_response.json()
                                page_reviews = []
                                
                                for review in data.get("reviews", []):
                                    if len(all_reviews) >= self.max_reviews:
                                        break
                                        
                                    page_reviews.append({
                                        "review_id": f"R{self.review_counter:03d}",
                                        "text": review.get("content"),
                                        "rating": review.get("score"),
                                        "reviewer": review.get("user", {}).get("display_name", "Anonymous"),
                                        "date": review.get("created_at"),
                                        "verified": review.get("verified_buyer", False),
                                        "source": "yotpo"
                                    })
                                    self.review_counter += 1
                                
                                all_reviews.extend(page_reviews)
                                
                                # Check if we have more pages
                                if len(page_reviews) < per_page:
                                    break  # No more reviews
                                    
                                page += 1
                                logger.info(f"📄 Loaded page {page-1}, total reviews so far: {len(all_reviews)}")
                                
                            else:
                                break  # API call failed
                                
                        except Exception as e:
                            logger.debug(f"Error on Yotpo page {page}: {str(e)}")
                            break
                    
                    if all_reviews:
                        logger.info(f"Yotpo API: Collected {len(all_reviews)} reviews across {page-1} pages")
                        
        except Exception as e:
            logger.debug(f"Yotpo API error: {str(e)}")
        
        return all_reviews
    
    def _scrape_with_selenium(self, url: str) -> Dict[str, Any]:
        """
        Use Selenium to scrape reviews from the rendered page with tier-based limits.
        This is the fallback method that's guaranteed to work and will try to load
        more reviews up to the tier limit.
        """
        logger.info(f"🚀 Starting Selenium scraping (tier: {self.tier.upper()}, max reviews: {self.max_reviews})...")
        
        reviews = []
        products = []
        
        try:
            # Setup Chrome options
            chrome_options = Options()
            chrome_options.add_argument("--headless")  # Run in background
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-blink-features=AutomationControlled")
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            chrome_options.add_experimental_option('useAutomationExtension', False)
            
            # Initialize driver
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            self.driver.implicitly_wait(10)
            
            # Load the page
            logger.info(f"Loading page: {url}")
            self.driver.get(url)
            
            # Wait for page to load
            time.sleep(3)
            
            # First, try to find and navigate to a product with reviews
            products_data = self._find_products_selenium()
            products.extend(products_data)
            
            # Try to find review sections on the main page with pagination
            reviews.extend(self._extract_reviews_with_pagination())
            
            # If no reviews on main page, try product pages
            if len(reviews) < self.max_reviews and products_data:
                logger.info("Checking product pages for more reviews...")
                
                # Get product links
                product_links = self.driver.find_elements(By.CSS_SELECTOR, "a[href*='/products/']")[:5]
                
                for link in product_links:
                    if len(reviews) >= self.max_reviews:
                        break
                        
                    try:
                        product_url = link.get_attribute("href")
                        logger.info(f"Checking product page: {product_url}")
                        
                        self.driver.get(product_url)
                        time.sleep(2)
                        
                        # Extract reviews from product page with pagination
                        product_reviews = self._extract_reviews_with_pagination()
                        reviews.extend(product_reviews)
                        
                        logger.info(f"Found {len(product_reviews)} reviews on product page. Total: {len(reviews)}")
                            
                    except Exception as e:
                        logger.debug(f"Error checking product page: {str(e)}")
                        continue
            
            # Look for dedicated review pages if still under limit
            if len(reviews) < self.max_reviews:
                review_page_found = self._navigate_to_review_page()
                if review_page_found:
                    additional_reviews = self._extract_reviews_with_pagination()
                    reviews.extend(additional_reviews)
                    logger.info(f"Found {len(additional_reviews)} reviews on review page. Total: {len(reviews)}")
            
        except Exception as e:
            logger.error(f"Selenium error: {str(e)}")
            
        finally:
            if self.driver:
                self.driver.quit()
        
        # Log final collection stats
        logger.info(f"Selenium scraping complete: Collected {len(reviews)} reviews")
        if len(reviews) >= self.max_reviews:
            logger.info(f"Reached tier limit of {self.max_reviews} reviews")
        
        return {
            "reviews": reviews,
            "products": products
        }
    
    def _extract_reviews_with_pagination(self) -> List[Dict[str, Any]]:
        """Extract reviews with pagination support - keeps loading until tier limit."""
        all_reviews = []
        max_attempts = 10  # Prevent infinite loops
        attempt = 0
        
        while len(all_reviews) < self.max_reviews and attempt < max_attempts:
            attempt += 1
            
            # Extract reviews from current page
            page_reviews = self._extract_reviews_selenium()
            
            if not page_reviews:
                # Try to click "Load more" or pagination buttons
                if not self._try_load_more_reviews():
                    break  # No more reviews to load
                time.sleep(2)
                continue
            
            # Add new reviews (avoid duplicates)
            existing_texts = {r.get("text", "")[:50] for r in all_reviews}
            new_reviews = []
            
            for review in page_reviews:
                review_snippet = review.get("text", "")[:50]
                if review_snippet not in existing_texts and len(all_reviews) + len(new_reviews) < self.max_reviews:
                    new_reviews.append(review)
                    existing_texts.add(review_snippet)
            
            all_reviews.extend(new_reviews)
            logger.info(f"Page {attempt}: Found {len(new_reviews)} new reviews. Total: {len(all_reviews)}")
            
            # If we didn't find any new reviews, try pagination
            if not new_reviews:
                if not self._try_load_more_reviews():
                    break  # No more reviews to load
                time.sleep(2)
        
        return all_reviews
    
    def _try_load_more_reviews(self) -> bool:
        """Try to load more reviews by clicking pagination/load more buttons."""
        load_more_selectors = [
            # Load more buttons
            "button[class*='load-more']",
            "button[class*='show-more']", 
            "a[class*='load-more']",
            "a[class*='show-more']",
            "button:contains('Load more')",
            "button:contains('Show more')",
            
            # Pagination buttons
            "a[class*='next']",
            "button[class*='next']",
            "a[aria-label*='next']",
            "button[aria-label*='next']",
            
            # Judge.me specific
            "button.jdgm-paginate__next",
            "a.jdgm-paginate__next",
            
            # Yotpo specific
            "button.yotpo-show-more",
            "a.yotpo-next-page"
        ]
        
        for selector in load_more_selectors:
            try:
                elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                for element in elements:
                    if element.is_displayed() and element.is_enabled():
                        logger.info(f"Clicking load more button: {selector}")
                        self.driver.execute_script("arguments[0].click();", element)
                        return True
            except Exception as e:
                logger.debug(f"Error with load more selector {selector}: {str(e)}")
                continue
        
        # Try text-based selectors as fallback
        load_more_texts = ["Load more", "Show more", "View more", "Next", "More reviews"]
        for text in load_more_texts:
            try:
                element = self.driver.find_element(By.PARTIAL_LINK_TEXT, text)
                if element.is_displayed() and element.is_enabled():
                    logger.info(f"Clicking load more text: {text}")
                    self.driver.execute_script("arguments[0].click();", element)
                    return True
            except:
                continue
        
        return False
    
    def _navigate_to_review_page(self) -> bool:
        """Try to navigate to a dedicated reviews page."""
        review_link_texts = [
            "reviews", "Reviews", "REVIEWS",
            "View all reviews", "See all reviews", "All reviews",
            "Read reviews", "Customer reviews", "Product reviews",
            "testimonials", "Testimonials"
        ]
        
        for link_text in review_link_texts:
            try:
                # Try exact text match
                link = self.driver.find_element(By.LINK_TEXT, link_text)
                if link.is_displayed():
                    logger.info(f"Navigating to review page: {link_text}")
                    link.click()
                    time.sleep(3)
                    return True
            except:
                try:
                    # Try partial text match
                    link = self.driver.find_element(By.PARTIAL_LINK_TEXT, link_text)
                    if link.is_displayed():
                        logger.info(f"Navigating to review page (partial): {link_text}")
                        link.click()
                        time.sleep(3)
                        return True
                except:
                    continue
        
        return False
    
    def _extract_reviews_selenium(self) -> List[Dict[str, Any]]:
        """Extract reviews from the current page using Selenium."""
        reviews = []
        
        # Common review selectors for Shopify stores
        review_selectors = [
            # Judge.me selectors
            "div.jdgm-rev",
            "div[class*='jdgm-rev__']",
            
            # Yotpo selectors
            "div.yotpo-review",
            "div[class*='yotpo-review']",
            "div.y-review",
            
            # Shopify native reviews
            "div.spr-review",
            "div[class*='shopify-product-reviews']",
            "div[class*='product-review']",
            
            # Generic review selectors
            "div[class*='review-item']",
            "div[class*='review-content']",
            "article[class*='review']",
            "div[data-review]",
            "div[class*='testimonial']"
        ]
        
        for selector in review_selectors:
            try:
                review_elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                
                if review_elements:
                    logger.info(f"Found {len(review_elements)} potential reviews with selector: {selector}")
                    
                    for element in review_elements[:20]:  # Limit per selector
                        review_data = self._parse_review_element(element)
                        if review_data and review_data.get("text"):
                            reviews.append(review_data)
                    
                    if reviews:
                        break  # Stop if we found reviews
                        
            except Exception as e:
                logger.debug(f"Error with selector {selector}: {str(e)}")
                continue
        
        # Remove duplicates
        unique_reviews = []
        seen_texts = set()
        
        for review in reviews:
            text_key = review.get("text", "")[:100]
            if text_key not in seen_texts:
                seen_texts.add(text_key)
                unique_reviews.append(review)
        
        return unique_reviews
    
    def _parse_review_element(self, element) -> Optional[Dict[str, Any]]:
        """Parse a single review element."""
        try:
            review_data = {
                "review_id": f"R{self.review_counter:03d}",
                "source": "selenium_scrape"
            }
            
            # Extract review text
            text_selectors = [
                "div[class*='review-text']",
                "div[class*='review-body']", 
                "div[class*='review-content']",
                "p[class*='review']",
                "div.jdgm-rev__body",
                "div.yotpo-review-content",
                "div.spr-review-content",
                ".text", ".content", ".body"
            ]
            
            review_text = ""
            for selector in text_selectors:
                try:
                    text_elem = element.find_element(By.CSS_SELECTOR, selector)
                    review_text = text_elem.text.strip()
                    if review_text:
                        break
                except:
                    continue
            
            if not review_text:
                review_text = element.text.strip()
            
            if not review_text or len(review_text) < 10:
                return None
                
            review_data["text"] = review_text
            
            # Extract rating
            rating = None
            rating_selectors = [
                "span[class*='rating']",
                "div[class*='stars']",
                "span[class*='stars']",
                "[data-rating]",
                ".jdgm-rev__rating",
                ".yotpo-review-stars",
                ".spr-starrating"
            ]
            
            for selector in rating_selectors:
                try:
                    rating_elem = element.find_element(By.CSS_SELECTOR, selector)
                    
                    # Try data attribute
                    rating_value = rating_elem.get_attribute("data-rating") or rating_elem.get_attribute("data-score")
                    if rating_value:
                        rating = float(rating_value)
                        break
                    
                    # Count filled stars
                    filled_stars = rating_elem.find_elements(By.CSS_SELECTOR, "[class*='filled'], [class*='active'], [class*='star-on']")
                    if filled_stars:
                        rating = len(filled_stars)
                        break
                        
                    # Parse from text
                    rating_text = rating_elem.text
                    if rating_text:
                        match = re.search(r'(\d+(?:\.\d+)?)', rating_text)
                        if match:
                            rating = float(match.group(1))
                            break
                            
                except:
                    continue
            
            review_data["rating"] = rating
            
            # Extract reviewer name
            reviewer = "Anonymous"
            name_selectors = [
                "span[class*='reviewer']",
                "div[class*='author']",
                "span[class*='author']",
                ".jdgm-rev__author",
                ".yotpo-user-name",
                ".spr-review-header-byline"
            ]
            
            for selector in name_selectors:
                try:
                    name_elem = element.find_element(By.CSS_SELECTOR, selector)
                    reviewer = name_elem.text.strip()
                    if reviewer:
                        break
                except:
                    continue
                    
            review_data["reviewer"] = reviewer
            
            # Extract date
            date = None
            date_selectors = [
                "span[class*='date']",
                "time",
                "[datetime]",
                ".jdgm-rev__timestamp",
                ".yotpo-review-date"
            ]
            
            for selector in date_selectors:
                try:
                    date_elem = element.find_element(By.CSS_SELECTOR, selector)
                    date = date_elem.get_attribute("datetime") or date_elem.text.strip()
                    if date:
                        break
                except:
                    continue
                    
            review_data["date"] = date
            
            self.review_counter += 1
            return review_data
            
        except Exception as e:
            logger.debug(f"Error parsing review element: {str(e)}")
            return None
    
    def _find_products_selenium(self) -> List[Dict[str, Any]]:
        """Find product information on the page."""
        products = []
        
        try:
            # Common product selectors
            product_selectors = [
                "div[class*='product-item']",
                "div[class*='product-card']",
                "article[class*='product']",
                "div.product",
                "li[class*='product']"
            ]
            
            for selector in product_selectors:
                elements = self.driver.find_elements(By.CSS_SELECTOR, selector)[:10]
                
                for element in elements:
                    try:
                        # Extract title
                        title = ""
                        title_selectors = ["h2", "h3", "h4", "[class*='title']", "[class*='name']"]
                        for title_sel in title_selectors:
                            try:
                                title_elem = element.find_element(By.CSS_SELECTOR, title_sel)
                                title = title_elem.text.strip()
                                if title:
                                    break
                            except:
                                continue
                        
                        # Extract price
                        price = None
                        price_selectors = ["[class*='price']", "span.money", "[data-price]"]
                        for price_sel in price_selectors:
                            try:
                                price_elem = element.find_element(By.CSS_SELECTOR, price_sel)
                                price = price_elem.text.strip()
                                if price:
                                    break
                            except:
                                continue
                        
                        if title:
                            products.append({
                                "title": title,
                                "price": price,
                                "source": "selenium"
                            })
                            
                    except:
                        continue
                        
                if products:
                    break
                    
        except Exception as e:
            logger.debug(f"Error finding products: {str(e)}")
            
        return products
    
    def _click_review_links(self):
        """Try to click on review-related links to load more reviews."""
        try:
            review_link_texts = [
                "reviews", "Reviews", "REVIEWS",
                "View all reviews", "See all reviews",
                "Read reviews", "Customer reviews",
                "testimonials", "Testimonials"
            ]
            
            for link_text in review_link_texts:
                try:
                    # Try exact text match
                    link = self.driver.find_element(By.LINK_TEXT, link_text)
                    link.click()
                    logger.info(f"Clicked on '{link_text}' link")
                    return True
                except:
                    # Try partial text match
                    try:
                        link = self.driver.find_element(By.PARTIAL_LINK_TEXT, link_text)
                        link.click()
                        logger.info(f"Clicked on '{link_text}' link (partial match)")
                        return True
                    except:
                        continue
                        
        except Exception as e:
            logger.debug(f"Error clicking review links: {str(e)}")
            
        return False
    
    def save_scraped_data(self, data: Dict[str, Any], filename: str) -> bool:
        """Save scraped data to JSON file."""
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            logger.info(f"💾 Data saved to {filename}")
            return True
        except Exception as e:
            logger.error(f"Error saving data: {str(e)}")
            return False


# Example usage and testing
if __name__ == "__main__":
    # Test with command line argument or default
    test_url = sys.argv[1] if len(sys.argv) > 1 else "https://groundluxe.com"
    
    print(f"🛍️ Testing Shopify Review Scraper")
    print(f"🌐 Target: {test_url}")
    print("=" * 50)
    
    # Create scraper and run
    scraper = ShopifyReviewScraper()
    results = scraper.scrape_shopify_reviews(test_url)
    
    # Save results
    output_file = "shopify_reviews_output.json"
    scraper.save_scraped_data(results, output_file)
    
    # Print summary
    print(f"\n📊 Results Summary:")
    print(f"✅ Total reviews: {results['total_reviews']}")
    print(f"🛍️ Shop name: {results['shop_name']}")
    print(f"🔧 Method used: {results['scrape_method']}")
    print(f"📡 API attempts: {', '.join(results['data_quality']['api_attempts'])}")
    
    if results['reviews']:
        print(f"\n📝 Sample reviews:")
        for review in results['reviews'][:3]:
            print(f"\n[{review['review_id']}] {review.get('reviewer', 'Anonymous')} - {review.get('rating', 'No rating')}/5")
            print(f"   {review['text'][:100]}...")
            
    print(f"\n💾 Full results saved to: {output_file}")