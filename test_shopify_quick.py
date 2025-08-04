#!/usr/bin/env python3
"""
Quick test of Shopify review scraper without Selenium
Tests only the API endpoints
"""

import requests
import json
import re

def quick_test_shopify_apis(url):
    """Quick test of Shopify review APIs without Selenium."""
    
    print(f"🧪 Testing Shopify Review APIs for: {url}")
    print("=" * 50)
    
    session = requests.Session()
    session.headers.update({'User-Agent': 'Mozilla/5.0'})
    
    # Parse domain
    from urllib.parse import urlparse
    parsed = urlparse(url)
    domain = parsed.netloc
    shop_name = domain.split('.')[0]
    
    results = {
        "shop": shop_name,
        "apis_tested": [],
        "reviews_found": 0
    }
    
    # 1. Test Judge.me
    print("\n1️⃣ Testing Judge.me API...")
    judge_urls = [
        f"https://judge.me/api/v1/reviews?shop_domain={shop_name}.myshopify.com",
        f"https://judge.me/api/v1/reviews?shop_domain={domain}",
    ]
    
    for judge_url in judge_urls:
        try:
            response = session.get(judge_url, timeout=5)
            print(f"   {judge_url}: {response.status_code}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if "reviews" in data:
                        review_count = len(data["reviews"])
                        print(f"   ✅ Found {review_count} reviews!")
                        results["reviews_found"] += review_count
                        results["apis_tested"].append(("judge.me", "success", review_count))
                        
                        # Show sample review
                        if data["reviews"]:
                            review = data["reviews"][0]
                            print(f"   Sample: {review.get('rating')}/5 - {review.get('body', '')[:100]}...")
                        break
                except:
                    pass
        except Exception as e:
            print(f"   Error: {str(e)}")
    
    # 2. Test Shopify Products API
    print("\n2️⃣ Testing Shopify Products API...")
    products_url = f"{url}/products.json"
    
    try:
        response = session.get(products_url, timeout=5)
        print(f"   {products_url}: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            products = data.get("products", [])
            print(f"   Found {len(products)} products")
            
            # Check first few products for reviews
            for i, product in enumerate(products[:3]):
                handle = product.get("handle")
                title = product.get("title")
                print(f"\n   Checking product {i+1}: {title}")
                
                # Try product.js endpoint
                product_url = f"{url}/products/{handle}.js"
                try:
                    prod_response = session.get(product_url, timeout=3)
                    if prod_response.status_code == 200:
                        prod_data = prod_response.json()
                        
                        # Look for metafields that might contain reviews
                        if "metafields" in prod_data:
                            print(f"     Has metafields: {len(prod_data['metafields'])}")
                            
                        # Check for review-related keys
                        review_keys = [k for k in prod_data.keys() if 'review' in k.lower()]
                        if review_keys:
                            print(f"     Review keys found: {review_keys}")
                            
                except Exception as e:
                    print(f"     Error: {str(e)}")
                    
            results["apis_tested"].append(("shopify_products", "checked", len(products)))
            
    except Exception as e:
        print(f"   Error: {str(e)}")
    
    # 3. Check for review apps in HTML
    print("\n3️⃣ Checking for review app integrations...")
    try:
        response = session.get(url, timeout=5)
        if response.status_code == 200:
            html = response.text
            
            # Look for Judge.me
            if "judge.me" in html.lower():
                print("   ✅ Judge.me integration detected")
                results["apis_tested"].append(("judge.me_html", "detected", 0))
                
            # Look for Yotpo
            if "yotpo" in html.lower():
                print("   ✅ Yotpo integration detected")
                
                # Try to find app key
                app_key_match = re.search(r'yotpo.*?app_key["\']?\s*[:=]\s*["\']([^"\']+)', html, re.IGNORECASE)
                if app_key_match:
                    app_key = app_key_match.group(1)
                    print(f"   Found Yotpo app key: {app_key[:10]}...")
                    results["apis_tested"].append(("yotpo", "app_key_found", 0))
                    
            # Look for other review apps
            review_apps = ["stamped", "loox", "rivyo", "kudobuzz", "reviewsio"]
            for app in review_apps:
                if app in html.lower():
                    print(f"   ✅ {app.capitalize()} integration detected")
                    results["apis_tested"].append((app, "detected", 0))
                    
    except Exception as e:
        print(f"   Error: {str(e)}")
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Summary:")
    print(f"Shop: {results['shop']}")
    print(f"APIs tested: {len(results['apis_tested'])}")
    print(f"Total reviews found via APIs: {results['reviews_found']}")
    
    if results['reviews_found'] == 0:
        print("\n⚠️  No reviews found via APIs. Selenium would be needed to scrape rendered content.")
    
    return results

if __name__ == "__main__":
    import sys
    test_url = sys.argv[1] if len(sys.argv) > 1 else "https://groundluxe.com"
    
    results = quick_test_shopify_apis(test_url)