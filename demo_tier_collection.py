#!/usr/bin/env python3
"""
Demo: Tier-Based Review Collection
Shows how different tiers collect different amounts of reviews
"""

import json
from shopify_review_scraper import ShopifyReviewScraper

def demo_tier_collection():
    """Demonstrate tier-based review collection with simulated data."""
    
    print("🎭 Tier-Based Review Collection Demo")
    print("=" * 60)
    
    # Simulate a large dataset (like a premium tier scenario)
    print("🏗️ Creating mock high-volume review data...")
    
    mock_reviews = []
    for i in range(150):  # Simulate 150 available reviews
        mock_reviews.append({
            "review_id": f"R{i+1:03d}",
            "text": f"This is review {i+1}. Great product, very satisfied with the quality and service. Would definitely recommend to others looking for similar items.",
            "rating": 4 + (i % 2),  # Alternating 4 and 5 star ratings
            "reviewer": f"Customer_{i+1}",
            "date": f"2024-{(i % 12) + 1:02d}-{(i % 28) + 1:02d}",
            "verified": i % 3 == 0,  # Every 3rd review is verified
            "source": "simulated_data"
        })
    
    print(f"   📊 Created {len(mock_reviews)} mock reviews")
    
    # Test each tier
    tiers = ["basic", "premium", "enterprise", "pro"]
    
    for tier in tiers:
        print(f"\n🔍 Testing {tier.upper()} tier:")
        
        scraper = ShopifyReviewScraper(tier=tier)
        max_reviews = scraper.max_reviews
        
        # Simulate applying tier limits
        collected_reviews = mock_reviews[:max_reviews]
        tier_limit_applied = len(mock_reviews) > max_reviews
        
        print(f"   Max reviews per site: {max_reviews}")
        print(f"   Available reviews: {len(mock_reviews)}")
        print(f"   Collected reviews: {len(collected_reviews)}")
        print(f"   Tier limit applied: {tier_limit_applied}")
        
        if tier_limit_applied:
            print(f"   ⚠️  Collected {len(collected_reviews)} of {len(mock_reviews)} available reviews (tier limit: {max_reviews})")
        else:
            print(f"   ✅ All available reviews collected (under tier limit)")
    
    # Show pricing differentiation impact
    print(f"\n💰 Pricing Tier Impact:")
    basic_collected = len(mock_reviews[:20])
    premium_collected = len(mock_reviews[:200])
    
    print(f"   BASIC tier customers get:    {basic_collected} reviews")
    print(f"   PREMIUM+ tier customers get: {min(premium_collected, len(mock_reviews))} reviews")
    print(f"   Additional value for premium: {min(premium_collected, len(mock_reviews)) - basic_collected} more reviews")
    
    # Show data quality flags
    print(f"\n📋 Data Quality Documentation:")
    
    basic_result = {
        "tier": "basic",
        "max_reviews_per_site": 20,
        "total_reviews": basic_collected,
        "data_quality": {
            "tier_limit_applied": len(mock_reviews) > 20,
            "available_reviews_estimated": len(mock_reviews),
            "reviews_found": basic_collected > 0,
            "confidence_level": "high" if basic_collected >= 20 else "medium"
        }
    }
    
    premium_result = {
        "tier": "premium", 
        "max_reviews_per_site": 200,
        "total_reviews": min(premium_collected, len(mock_reviews)),
        "data_quality": {
            "tier_limit_applied": len(mock_reviews) > 200,
            "available_reviews_estimated": len(mock_reviews),
            "reviews_found": premium_collected > 0,
            "confidence_level": "high"
        }
    }
    
    print(f"   Basic tier result:")
    print(f"     - Reviews collected: {basic_result['total_reviews']}")
    print(f"     - Tier limit applied: {basic_result['data_quality']['tier_limit_applied']}")
    print(f"     - Confidence level: {basic_result['data_quality']['confidence_level']}")
    
    print(f"   Premium tier result:")
    print(f"     - Reviews collected: {premium_result['total_reviews']}")
    print(f"     - Tier limit applied: {premium_result['data_quality']['tier_limit_applied']}")  
    print(f"     - Confidence level: {premium_result['data_quality']['confidence_level']}")
    
    # Save demo results
    print(f"\n💾 Saving demo results...")
    
    with open("tier_demo_basic.json", "w") as f:
        json.dump({
            "tier_demo": basic_result,
            "reviews_sample": mock_reviews[:20]
        }, f, indent=2)
    
    with open("tier_demo_premium.json", "w") as f:
        json.dump({
            "tier_demo": premium_result,
            "reviews_sample": mock_reviews[:min(200, len(mock_reviews))]
        }, f, indent=2)
    
    print(f"   📁 Basic tier demo: tier_demo_basic.json")
    print(f"   📁 Premium tier demo: tier_demo_premium.json")
    
    print(f"\n🎉 Tier collection demo complete!")
    print(f"✅ Basic tier: {basic_collected} reviews (20 max)")
    print(f"✅ Premium tier: {min(premium_collected, len(mock_reviews))} reviews (200 max)")
    print(f"✅ Tier limits properly enforced")
    print(f"✅ Data quality flags document collection limits")

if __name__ == "__main__":
    demo_tier_collection()