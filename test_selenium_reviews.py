#!/usr/bin/env python3
"""
Test Selenium review scraping for Shopify stores
Focused test that completes quickly
"""

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
import time
import json

def test_selenium_reviews(url):
    """Quick Selenium test for review scraping."""
    
    print(f"🌐 Testing Selenium review scraping for: {url}")
    print("=" * 50)
    
    # Setup Chrome options
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920x1080")
    
    driver = None
    reviews_found = []
    
    try:
        # Initialize driver
        print("🚀 Starting Chrome driver...")
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        driver.implicitly_wait(5)
        
        # Load main page
        print(f"📄 Loading page: {url}")
        driver.get(url)
        time.sleep(3)  # Wait for initial load
        
        # Look for product links
        print("🔍 Finding product links...")
        product_links = driver.find_elements(By.CSS_SELECTOR, "a[href*='/products/']")
        print(f"   Found {len(product_links)} product links")
        
        # Get first product URL that's not a collection page
        product_url = None
        for link in product_links:
            href = link.get_attribute("href")
            if href and "/products/" in href and "/collections/" not in href:
                product_url = href
                break
        
        if product_url:
            print(f"\n📦 Checking product page: {product_url}")
            driver.get(product_url)
            time.sleep(3)  # Wait for page load
            
            # Look for reviews with multiple selectors
            print("🔍 Looking for reviews...")
            
            review_selectors = [
                # Judge.me selectors
                "div.jdgm-rev",
                "div.jdgm-rev-widg__reviews",
                "div[class*='jdgm-rev__']",
                
                # Loox selectors
                "div.loox-reviews",
                "div[class*='loox-review']",
                
                # Rivyo selectors
                "div.rivio-reviews",
                "div[class*='r-review']",
                
                # Generic selectors
                "div[class*='review-item']",
                "div[class*='review-content']",
                "div[class*='product-review']"
            ]
            
            for selector in review_selectors:
                try:
                    reviews = driver.find_elements(By.CSS_SELECTOR, selector)
                    if reviews:
                        print(f"   ✅ Found {len(reviews)} reviews with selector: {selector}")
                        
                        # Extract first few reviews
                        for i, review in enumerate(reviews[:3]):
                            try:
                                # Extract text
                                text = review.text.strip()
                                if len(text) > 20:
                                    # Extract rating if possible
                                    rating = None
                                    try:
                                        rating_elem = review.find_element(By.CSS_SELECTOR, "[class*='rating'], [class*='stars']")
                                        rating_text = rating_elem.get_attribute("data-rating") or rating_elem.get_attribute("aria-label")
                                        if rating_text:
                                            import re
                                            match = re.search(r'(\d+)', rating_text)
                                            if match:
                                                rating = match.group(1)
                                    except:
                                        pass
                                    
                                    reviews_found.append({
                                        "text": text[:200] + "..." if len(text) > 200 else text,
                                        "rating": rating,
                                        "selector": selector
                                    })
                                    
                                    print(f"\n   Review {i+1}:")
                                    print(f"   Rating: {rating or 'Not found'}")
                                    print(f"   Text: {text[:100]}...")
                                    
                            except Exception as e:
                                print(f"   Error extracting review: {str(e)}")
                                
                        break  # Stop after finding reviews
                        
                except Exception as e:
                    continue
            
            # Check if we need to click "View all reviews" or similar
            if not reviews_found:
                print("\n🔍 Looking for review buttons to click...")
                
                button_texts = ["View all reviews", "See reviews", "Reviews", "Read reviews"]
                for btn_text in button_texts:
                    try:
                        button = driver.find_element(By.PARTIAL_LINK_TEXT, btn_text)
                        print(f"   Found button: {btn_text}")
                        button.click()
                        time.sleep(2)
                        
                        # Try to find reviews again
                        for selector in review_selectors[:3]:  # Try top 3 selectors
                            reviews = driver.find_elements(By.CSS_SELECTOR, selector)
                            if reviews:
                                print(f"   ✅ Found {len(reviews)} reviews after clicking button")
                                break
                                
                    except:
                        continue
        
        print("\n" + "=" * 50)
        print(f"📊 Results: Found {len(reviews_found)} reviews")
        
        return reviews_found
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return []
        
    finally:
        if driver:
            driver.quit()
            print("✅ Chrome driver closed")

if __name__ == "__main__":
    import sys
    test_url = sys.argv[1] if len(sys.argv) > 1 else "https://groundluxe.com"
    
    reviews = test_selenium_reviews(test_url)
    
    # Save results
    with open("selenium_test_results.json", "w") as f:
        json.dump({"url": test_url, "reviews": reviews}, f, indent=2)
    
    print(f"\n💾 Results saved to selenium_test_results.json")