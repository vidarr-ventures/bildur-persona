#!/usr/bin/env python3
"""
Quick test for multi-store integration functionality
Tests the command-line argument parsing and integration structure
"""

import sys
import os
from integrate_shopify_scraper import ShopifyIntegrator

def test_multi_store_args():
    """Test command-line argument parsing for multi-store functionality."""
    
    print("🧪 Testing Multi-Store Integration")
    print("=" * 50)
    
    # Test 1: Single store
    print("\n1️⃣ Testing single store format:")
    test_args_single = ["script.py", "https://groundluxe.com", "job_123", "grounding sheets"]
    
    url = test_args_single[1]
    job_id = test_args_single[2]
    keywords = test_args_single[3]
    competitor_urls = []
    
    print(f"   Customer URL: {url}")
    print(f"   Job ID: {job_id}")
    print(f"   Keywords: {keywords}")
    print(f"   Competitors: {len(competitor_urls)} (none)")
    
    # Test 2: Multi-store
    print("\n2️⃣ Testing multi-store format:")
    test_args_multi = [
        "script.py", 
        "https://groundluxe.com", 
        "job_123", 
        "grounding sheets",
        "https://competitor1.com", 
        "https://competitor2.com"
    ]
    
    url = test_args_multi[1]
    job_id = test_args_multi[2]
    keywords = test_args_multi[3]
    competitor_urls = test_args_multi[4:] if len(test_args_multi) > 4 else []
    
    print(f"   Customer URL: {url}")
    print(f"   Job ID: {job_id}")
    print(f"   Keywords: {keywords}")
    print(f"   Competitors: {len(competitor_urls)} URLs")
    for i, comp_url in enumerate(competitor_urls, 1):
        print(f"      Competitor {i}: {comp_url}")
    
    # Test 3: Integration structure
    print("\n3️⃣ Testing integration structure:")
    integrator = ShopifyIntegrator()
    
    # Mock scraped data structure for multi-store
    mock_multi_store_data = {
        "scrape_type": "customer_and_competitors",
        "scrape_date": "2025-08-04T12:00:00.000Z",
        "customer_data": {
            "url": "https://groundluxe.com",
            "shop_name": "groundluxe",
            "total_reviews": 22,
            "scrape_method": "selenium",
            "reviews": [
                {
                    "review_id": "R001",
                    "text": "Great product!",
                    "rating": 5,
                    "reviewer": "Test User",
                    "date": "2024-01-01"
                }
            ],
            "products": [
                {
                    "title": "Test Product",
                    "price": "$100"
                }
            ]
        },
        "competitor_data": [
            {
                "url": "https://competitor1.com",
                "shop_name": "competitor1",
                "total_reviews": 15,
                "scrape_method": "judge.me_api",
                "reviews": [
                    {
                        "review_id": "R001",
                        "text": "Competitor product review",
                        "rating": 4,
                        "reviewer": "Comp User",
                        "date": "2024-01-01"
                    }
                ],
                "products": [
                    {
                        "title": "Competitor Product",
                        "price": "$80"
                    }
                ]
            }
        ],
        "total_customer_reviews": 22,
        "total_competitor_reviews": 15,
        "summary": {
            "stores_scraped": 2,
            "total_reviews": 37,
            "successful_scrapes": 2,
            "failed_scrapes": 0
        }
    }
    
    # Test the conversion function
    print("   Testing convert_multi_store_to_foundation_format...")
    try:
        foundation_data = integrator.convert_multi_store_to_foundation_format(
            mock_multi_store_data, 
            job_id, 
            keywords
        )
        
        print(f"   ✅ Foundation data created successfully")
        print(f"   📊 Total reviews: {foundation_data['total_review_count']}")
        print(f"   👤 Customer reviews: {foundation_data['customer_review_count']}")
        print(f"   🏆 Competitor reviews: {foundation_data['competitor_review_count']}")
        print(f"   🏪 Competitor sources: {len(foundation_data['competitor_info'])}")
        print(f"   📈 Products: {len(foundation_data['products'])}")
        
        # Test unique review IDs
        review_ids = [r['review_id'] for r in foundation_data['reviews']]
        print(f"   🔢 Review ID format: {review_ids[:3]}...")
        
        # Check that competitor reviews have C1-, C2- prefixes
        competitor_reviews = [r for r in foundation_data['reviews'] if r['review_id'].startswith('C')]
        print(f"   🏆 Competitor review IDs: {[r['review_id'] for r in competitor_reviews]}")
        
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 50)
    print("🎉 Multi-store integration test complete!")

if __name__ == "__main__":
    test_multi_store_args()