#!/usr/bin/env python3
"""
Demo: Multi-Store Shopify Pipeline with Demographics Foundation Integration
Shows how the complete pipeline works with customer + competitor data
"""

import json
from pathlib import Path
from integrate_shopify_scraper import ShopifyIntegrator

def demo_multi_store_pipeline():
    """Demonstrate the complete multi-store pipeline."""
    
    print("🎭 Multi-Store Shopify Pipeline Demo")
    print("=" * 60)
    
    # Load existing GroundLuxe data as customer data
    print("\n📂 Loading existing GroundLuxe data as customer store...")
    
    try:
        with open("groundluxe_scraped_output.json", "r") as f:
            groundluxe_data = json.load(f)
        
        print(f"   ✅ Loaded {groundluxe_data['total_reviews']} reviews from GroundLuxe")
        
        # Create mock competitor data
        print("\n🏗️ Creating mock competitor data...")
        
        competitor_1_data = {
            "url": "https://earthandmoon.co",
            "shop_name": "earthandmoon",
            "total_reviews": 18,
            "scrape_method": "selenium",
            "reviews": [
                {
                    "review_id": "R001",
                    "text": "Love these grounding products! The quality is amazing and I sleep so much better. Highly recommend for anyone looking to improve their wellness routine.",
                    "rating": 5,
                    "reviewer": "Emma K.",
                    "date": "2024-01-20",
                    "verified": False,
                    "source": "selenium_scrape"
                },
                {
                    "review_id": "R002", 
                    "text": "Great earthing mat! I use it while working at my desk and feel more grounded. The quality is excellent and customer service was very helpful.",
                    "rating": 5,
                    "reviewer": "Jake R.",
                    "date": "2024-01-15",
                    "verified": False,
                    "source": "selenium_scrape"
                },
                {
                    "review_id": "R003",
                    "text": "Good product but shipping was slow. The grounding benefits are noticeable after a few weeks of use. Would buy again despite the delivery issues.",
                    "rating": 4,
                    "reviewer": "Sophie M.", 
                    "date": "2024-01-10",
                    "verified": False,
                    "source": "selenium_scrape"
                }
            ],
            "products": [
                {
                    "title": "Earth & Moon Grounding Mat",
                    "price": "$149.00",
                    "source": "selenium"
                },
                {
                    "title": "Organic Grounding Sheet Set",
                    "price": "$199.00", 
                    "source": "selenium"
                }
            ]
        }
        
        competitor_2_data = {
            "url": "https://naturesluxeproducts.com",
            "shop_name": "naturesluxeproducts", 
            "total_reviews": 12,
            "scrape_method": "judge.me_api",
            "reviews": [
                {
                    "review_id": "R001",
                    "text": "These wellness products are amazing! The grounding technology really works. I feel more energized and sleep better. Natural materials feel great too.",
                    "rating": 5,
                    "reviewer": "Maria L.",
                    "date": "2024-01-25",
                    "verified": True,
                    "source": "judge.me"
                },
                {
                    "review_id": "R002",
                    "text": "High quality grounding products. I've tried several brands and this one is definitely premium. Worth the investment for better health and sleep.",
                    "rating": 5,
                    "reviewer": "Alex T.",
                    "date": "2024-01-18", 
                    "verified": True,
                    "source": "judge.me"
                }
            ],
            "products": [
                {
                    "title": "Nature's Luxe Grounding Blanket",
                    "price": "$259.00",
                    "source": "selenium"
                }
            ]
        }
        
        # Create multi-store data structure
        multi_store_data = {
            "scrape_type": "customer_and_competitors",
            "scrape_date": "2025-08-04T12:30:00.000Z",
            "customer_data": groundluxe_data,
            "competitor_data": [competitor_1_data, competitor_2_data],
            "total_customer_reviews": groundluxe_data["total_reviews"],
            "total_competitor_reviews": competitor_1_data["total_reviews"] + competitor_2_data["total_reviews"],
            "summary": {
                "stores_scraped": 3,
                "total_reviews": groundluxe_data["total_reviews"] + competitor_1_data["total_reviews"] + competitor_2_data["total_reviews"], 
                "successful_scrapes": 3,
                "failed_scrapes": 0
            }
        }
        
        print(f"   🏪 Customer: {groundluxe_data['shop_name']} ({groundluxe_data['total_reviews']} reviews)")
        print(f"   🏆 Competitor 1: {competitor_1_data['shop_name']} ({competitor_1_data['total_reviews']} reviews)")
        print(f"   🏆 Competitor 2: {competitor_2_data['shop_name']} ({competitor_2_data['total_reviews']} reviews)")
        print(f"   📊 Total reviews: {multi_store_data['summary']['total_reviews']}")
        
        # Process through integration pipeline
        print(f"\n🔄 Processing through Demographics Foundation integration...")
        
        integrator = ShopifyIntegrator()
        foundation_data = integrator.convert_multi_store_to_foundation_format(
            multi_store_data,
            "demo_job_789",
            "grounding sheets, wellness, sleep, earthing"
        )
        
        print(f"   ✅ Foundation data structure created")
        print(f"   📊 Total reviews: {foundation_data['total_review_count']}")
        print(f"   👤 Customer reviews: {foundation_data['customer_review_count']}")
        print(f"   🏆 Competitor reviews: {foundation_data['competitor_review_count']}")
        print(f"   📈 Products: {len(foundation_data['products'])}")
        print(f"   🎯 Data quality: {foundation_data['data_quality']['confidence_level']}")
        
        # Save demo output
        print(f"\n💾 Saving demo output...")
        
        demo_dir = Path("demo_output")
        demo_dir.mkdir(exist_ok=True)
        
        # Save raw multi-store data
        with open(demo_dir / "multi_store_raw_demo.json", "w", encoding="utf-8") as f:
            json.dump(multi_store_data, f, indent=2, ensure_ascii=False)
        
        # Save foundation-formatted data
        with open(demo_dir / "foundation_formatted_demo.json", "w", encoding="utf-8") as f:
            json.dump(foundation_data, f, indent=2, ensure_ascii=False)
        
        print(f"   📁 Raw data: demo_output/multi_store_raw_demo.json")
        print(f"   📁 Foundation format: demo_output/foundation_formatted_demo.json")
        
        # Show sample insights
        print(f"\n🔍 Sample Analysis Insights:")
        print(f"   🌟 Average customer rating: {foundation_data['analysis']['customer_avg_rating']:.1f}/5")
        print(f"   🏆 Average competitor rating: {foundation_data['analysis']['competitor_avg_rating']:.1f}/5")
        print(f"   📝 Average review length: {foundation_data['analysis']['average_review_length']:.0f} characters")
        print(f"   ✅ Verified purchase rate: {foundation_data['analysis']['verified_purchase_rate']:.1%}")
        
        # Show competitor insights
        if foundation_data['analysis']['competitor_insights']:
            print(f"   🏆 Competitor insights:")
            for insight in foundation_data['analysis']['competitor_insights']:
                print(f"      • {insight}")
        
        # Show value propositions from customer reviews
        if foundation_data['analysis']['value_propositions']:
            print(f"   💎 Key value propositions:")
            for i, prop in enumerate(foundation_data['analysis']['value_propositions'][:3], 1):
                print(f"      {i}. {prop}")
        
        print(f"\n🎉 Demo complete! Ready for Demographics Foundation prompt analysis.")
        print(f"   🔗 Next step: Feed foundation_formatted_demo.json to demographics_foundation_prompt.py")
        
    except FileNotFoundError:
        print("   ❌ groundluxe_scraped_output.json not found. Run a GroundLuxe scrape first.")
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    demo_multi_store_pipeline()