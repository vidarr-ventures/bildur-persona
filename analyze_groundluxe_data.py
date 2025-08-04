#!/usr/bin/env python3
"""
Analyze GroundLuxe review data quality
"""

import json

def analyze_groundluxe_data():
    """Analyze the quality and quantity of GroundLuxe review data."""
    
    try:
        with open('groundluxe_scraped_output.json', 'r') as f:
            data = json.load(f)
        
        print('📊 GroundLuxe Review Data Quality Report')
        print('=' * 50)
        print(f'Total Reviews: {data["total_reviews"]}')
        print(f'Extraction Method: {data["scrape_method"]}')
        print(f'Shop Name: {data["shop_name"]}')
        print(f'URL: {data["url"]}')
        print(f'Scrape Date: {data["scrape_date"]}')
        print(f'Products Found: {len(data["products"])}')
        
        # Data quality details
        dq = data["data_quality"]
        print(f'\n🔍 Data Quality Details:')
        print(f'Reviews Found: {dq["reviews_found"]}')
        print(f'Ratings Available: {dq["ratings_available"]}')
        print(f'Dates Available: {dq["dates_available"]}')
        print(f'Method Used: {dq["method_used"]}')
        print(f'API Attempts: {", ".join(dq["api_attempts"])}')
        
        # Review quality analysis
        reviews = data['reviews']
        if reviews:
            total_chars = sum(len(r['text']) for r in reviews)
            avg_length = total_chars / len(reviews)
            ratings = [r['rating'] for r in reviews if r.get('rating')]
            avg_rating = sum(ratings) / len(ratings) if ratings else 0
            
            print(f'\n📝 Review Quality Metrics:')
            print(f'Average review length: {avg_length:.0f} characters')
            print(f'Average rating: {avg_rating:.1f}/5')
            print(f'Reviews with ratings: {len(ratings)}/{len(reviews)} ({len(ratings)/len(reviews)*100:.1f}%)')
            print(f'Reviews with dates: {sum(1 for r in reviews if r.get("date"))}/{len(reviews)}')
            print(f'Reviews with reviewer names: {sum(1 for r in reviews if r.get("reviewer") != "Anonymous")}/{len(reviews)}')
            print(f'Verified reviews: {sum(1 for r in reviews if r.get("verified"))}/{len(reviews)}')
            
            # Rating distribution
            rating_dist = {}
            for rating in ratings:
                rating_dist[rating] = rating_dist.get(rating, 0) + 1
            
            print(f'\n⭐ Rating Distribution:')
            for rating in sorted(rating_dist.keys(), reverse=True):
                count = rating_dist[rating]
                percentage = count / len(ratings) * 100
                print(f'{rating}⭐: {count} reviews ({percentage:.1f}%)')
            
            # Sample reviews
            print(f'\n📋 Sample Reviews:')
            for i, review in enumerate(reviews[:5], 1):
                reviewer = review.get("reviewer", "Anonymous")
                rating = review.get("rating", "No rating")
                text_preview = review["text"][:120] + "..." if len(review["text"]) > 120 else review["text"]
                print(f'\n{i}. [{review["review_id"]}] {reviewer} - {rating}/5')
                print(f'   "{text_preview}"')
        
        # Products analysis
        print(f'\n🛍️ Products Found:')
        for i, product in enumerate(data["products"], 1):
            print(f'{i}. {product["title"]} - {product.get("price", "No price")}')
        
        # Overall assessment
        print(f'\n🎯 Overall Assessment:')
        if len(reviews) >= 20:
            print('✅ Excellent data volume (20+ reviews)')
        elif len(reviews) >= 10:
            print('✅ Good data volume (10+ reviews)')
        else:
            print('⚠️  Limited data volume (< 10 reviews)')
        
        if avg_rating >= 4.5:
            print('✅ High customer satisfaction (4.5+ average rating)')
        elif avg_rating >= 4.0:
            print('✅ Good customer satisfaction (4.0+ average rating)')
        else:
            print('⚠️  Mixed customer satisfaction (< 4.0 average rating)')
        
        if avg_length >= 100:
            print('✅ Detailed reviews (100+ characters average)')
        elif avg_length >= 50:
            print('✅ Moderate detail reviews (50+ characters average)')
        else:
            print('⚠️  Brief reviews (< 50 characters average)')
        
        # Tier comparison
        print(f'\n📊 Tier Limit Comparison:')
        print(f'Current data: {len(reviews)} reviews')
        print(f'Basic tier limit: 20 reviews -> Would get: {min(len(reviews), 20)} reviews')
        print(f'Premium tier limit: 200 reviews -> Would get: {min(len(reviews), 200)} reviews')
        
        if len(reviews) > 20:
            print('⚠️  Basic tier customers would miss additional review data')
        else:
            print('✅ All customers would get complete dataset')
        
    except FileNotFoundError:
        print('❌ groundluxe_scraped_output.json not found')
    except Exception as e:
        print(f'❌ Error: {str(e)}')

if __name__ == "__main__":
    analyze_groundluxe_data()