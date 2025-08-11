#!/usr/bin/env python3
"""
Social Media Integration Test
Tests both YouTube and Reddit scrapers working together for comprehensive social insights.
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Any

# Import our scrapers
try:
    from youtube_comment_scraper import YouTubeCommentScraper, ScrapingResult as YouTubeResult
    from reddit_scraper import RedditScraper, RedditScrapingResult
    SCRAPERS_AVAILABLE = True
except ImportError as e:
    print(f"Error importing scrapers: {e}")
    SCRAPERS_AVAILABLE = False

class SocialMediaIntegrator:
    """Integrates multiple social media scrapers for comprehensive customer insights"""
    
    def __init__(self):
        self.youtube_scraper = None
        self.reddit_scraper = None
        
    def setup_youtube(self) -> bool:
        """Setup YouTube scraper if API key available"""
        try:
            if os.getenv('YOUTUBE_API_KEY'):
                self.youtube_scraper = YouTubeCommentScraper()
                if self.youtube_scraper.validate_api_key():
                    print("✓ YouTube scraper initialized successfully")
                    return True
            print("⚠ YouTube API key not available - skipping YouTube integration")
            return False
        except Exception as e:
            print(f"✗ YouTube setup failed: {e}")
            return False
    
    def setup_reddit(self) -> bool:
        """Setup Reddit scraper if API credentials available"""
        try:
            if os.getenv('REDDIT_CLIENT_ID') and os.getenv('REDDIT_CLIENT_SECRET'):
                self.reddit_scraper = RedditScraper()
                print("✓ Reddit scraper initialized successfully")
                return True
            print("⚠ Reddit API credentials not available - skipping Reddit integration")
            return False
        except Exception as e:
            print(f"✗ Reddit setup failed: {e}")
            return False
    
    def scrape_social_insights(self, keywords: List[str], total_limit: int = 100) -> Dict[str, Any]:
        """Scrape insights from multiple social platforms"""
        results = {
            "source": "social_media_integration",
            "scrape_date": datetime.now().isoformat(),
            "keywords_searched": keywords,
            "platforms": {},
            "combined_insights": {
                "total_items": 0,
                "youtube_items": 0,
                "reddit_items": 0,
                "youtube_emotional_quotes": 0,
                "combined_api_usage": {}
            }
        }
        
        # Distribute quota: 50% YouTube comments, 50% Reddit content
        youtube_limit = total_limit // 2
        reddit_limit = total_limit // 2
        
        print(f"Starting social media scraping for keywords: {', '.join(keywords)}")
        print(f"Total target: {total_limit} items ({youtube_limit} YouTube + {reddit_limit} Reddit)")
        print()
        
        # Scrape YouTube
        if self.youtube_scraper:
            print("🎬 Scraping YouTube comments...")
            try:
                youtube_data = self.youtube_scraper.scrape_comments_for_keywords(
                    keywords, total_limit=youtube_limit
                )
                
                results["platforms"]["youtube"] = {
                    "success": True,
                    "total_comments": youtube_data.total_comments,
                    "emotional_quotes": len(youtube_data.emotional_quotes),
                    "api_quota_used": youtube_data.data_quality["api_quota_used"],
                    "videos_analyzed": youtube_data.data_quality["videos_analyzed"],
                    "high_potential_quotes": youtube_data.data_quality["high_potential_quotes"],
                    "comments": youtube_data.comments[:5],  # Sample for display
                    "emotional_quotes": youtube_data.emotional_quotes[:10]  # Top quotes
                }
                
                results["combined_insights"]["youtube_items"] = youtube_data.total_comments
                results["combined_insights"]["youtube_emotional_quotes"] = len(youtube_data.emotional_quotes)
                results["combined_insights"]["combined_api_usage"]["youtube_quota"] = youtube_data.data_quality["api_quota_used"]
                
                print(f"  ✓ Collected {youtube_data.total_comments} YouTube comments")
                print(f"  ✓ Extracted {len(youtube_data.emotional_quotes)} emotional quotes")
                
            except Exception as e:
                print(f"  ✗ YouTube scraping failed: {e}")
                results["platforms"]["youtube"] = {"success": False, "error": str(e)}
        
        # Scrape Reddit
        if self.reddit_scraper:
            print("\n🔴 Scraping Reddit discussions...")
            try:
                reddit_data = self.reddit_scraper.scrape_content_for_keywords(
                    keywords, total_limit=reddit_limit
                )
                
                results["platforms"]["reddit"] = {
                    "success": True,
                    "total_items": reddit_data.total_items,
                    "posts": len([c for c in reddit_data.content if c['content_type'] == 'post']),
                    "comments": len([c for c in reddit_data.content if c['content_type'] == 'comment']),
                    "subreddits_searched": reddit_data.data_quality["subreddits_searched"],
                    "api_calls_made": reddit_data.data_quality["api_calls_made"],
                    "avg_relevance": reddit_data.data_quality["avg_relevance_score"],
                    "content_sample": reddit_data.content[:5]  # Sample for display
                }
                
                results["combined_insights"]["reddit_items"] = reddit_data.total_items
                results["combined_insights"]["combined_api_usage"]["reddit_calls"] = reddit_data.data_quality["api_calls_made"]
                
                print(f"  ✓ Collected {reddit_data.total_items} Reddit items")
                print(f"  ✓ Searched {len(reddit_data.data_quality['subreddits_searched'])} subreddits")
                
            except Exception as e:
                print(f"  ✗ Reddit scraping failed: {e}")
                results["platforms"]["reddit"] = {"success": False, "error": str(e)}
        
        # Calculate combined totals
        results["combined_insights"]["total_items"] = (
            results["combined_insights"]["youtube_items"] + 
            results["combined_insights"]["reddit_items"]
        )
        
        return results
    
    def analyze_combined_insights(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze patterns across both platforms"""
        analysis = {
            "cross_platform_patterns": {},
            "content_quality_comparison": {},
            "keyword_performance": {},
            "insights_summary": []
        }
        
        # Platform comparison
        youtube_success = results["platforms"].get("youtube", {}).get("success", False)
        reddit_success = results["platforms"].get("reddit", {}).get("success", False)
        
        if youtube_success and reddit_success:
            youtube_data = results["platforms"]["youtube"]
            reddit_data = results["platforms"]["reddit"]
            
            # Content quality comparison
            analysis["content_quality_comparison"] = {
                "youtube_avg_engagement": "calculated from likes/replies",
                "reddit_avg_score": reddit_data.get("avg_relevance", 0),
                "emotional_content_ratio": youtube_data.get("emotional_quotes", 0) / max(1, youtube_data.get("total_comments", 1))
            }
            
            # Platform insights
            analysis["insights_summary"] = [
                f"YouTube provided {youtube_data.get('total_comments', 0)} customer comments with emotional analysis",
                f"Reddit provided {reddit_data.get('total_items', 0)} authentic discussions from {len(reddit_data.get('subreddits_searched', []))} communities",
                f"Combined: {results['combined_insights']['total_items']} total social media insights",
                f"High-value emotional quotes: {youtube_data.get('high_potential_quotes', 0)}"
            ]
        
        return analysis

def simulate_social_integration():
    """Simulate social media integration with mock data if APIs unavailable"""
    print("Social Media Integration Simulation")
    print("=" * 40)
    
    keywords = ["customer service problems", "software frustrations", "small business tools"]
    
    mock_results = {
        "source": "social_media_integration_simulation",
        "scrape_date": datetime.now().isoformat(),
        "keywords_searched": keywords,
        "platforms": {
            "youtube": {
                "success": True,
                "total_comments": 25,
                "emotional_quotes": 8,
                "api_quota_used": 325,
                "videos_analyzed": 9,
                "high_potential_quotes": 3,
                "sample_quotes": [
                    {
                        "quote": "I'm so frustrated with customer service - they never understand my business needs!",
                        "emotion": "frustration",
                        "intensity": 0.85,
                        "marketing_potential": "high"
                    },
                    {
                        "quote": "Finally found software that actually works for small businesses like mine.",
                        "emotion": "relief",
                        "intensity": 0.78,
                        "marketing_potential": "high"
                    }
                ]
            },
            "reddit": {
                "success": True,
                "total_items": 25,
                "posts": 8,
                "comments": 17,
                "subreddits_searched": ["smallbusiness", "Entrepreneur", "software", "CustomerService"],
                "api_calls_made": 15,
                "avg_relevance": 0.72,
                "sample_discussions": [
                    {
                        "type": "post",
                        "subreddit": "smallbusiness",
                        "title": "Struggling with customer service software - any recommendations?",
                        "score": 34,
                        "relevance": 0.89
                    },
                    {
                        "type": "comment",
                        "subreddit": "Entrepreneur",
                        "text": "Been using this tool for 3 years. Game changer for customer management.",
                        "score": 18,
                        "relevance": 0.76
                    }
                ]
            }
        },
        "combined_insights": {
            "total_items": 50,
            "youtube_items": 25,
            "reddit_items": 25,
            "youtube_emotional_quotes": 8,
            "cross_platform_themes": [
                "Customer service frustrations are consistent across platforms",
                "Small business owners actively seek recommendations on Reddit",
                "YouTube comments show more emotional intensity",
                "Reddit provides detailed experience sharing"
            ]
        }
    }
    
    print("Simulation Results:")
    print(f"✓ Total social insights: {mock_results['combined_insights']['total_items']}")
    print(f"✓ YouTube emotional quotes: {mock_results['combined_insights']['youtube_emotional_quotes']}")
    print(f"✓ Reddit subreddits: {len(mock_results['platforms']['reddit']['subreddits_searched'])}")
    print()
    
    print("Cross-Platform Insights:")
    for insight in mock_results['combined_insights']['cross_platform_themes']:
        print(f"  • {insight}")
    
    return mock_results

def main():
    """Main function to test social media integration"""
    if not SCRAPERS_AVAILABLE:
        print("Scrapers not available - running simulation")
        simulate_social_integration()
        return
    
    # Test with actual scrapers if available
    integrator = SocialMediaIntegrator()
    
    youtube_ready = integrator.setup_youtube()
    reddit_ready = integrator.setup_reddit()
    
    if not youtube_ready and not reddit_ready:
        print("\nNo API credentials available - running simulation instead")
        simulate_social_integration()
        return
    
    # Test keywords
    keywords = [
        "customer service problems", 
        "frustrated with software",
        "small business challenges"
    ]
    
    print("\nTesting Social Media Integration")
    print("=" * 35)
    
    # Scrape social insights
    results = integrator.scrape_social_insights(keywords, total_limit=50)
    
    # Analyze results
    analysis = integrator.analyze_combined_insights(results)
    
    # Save results
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"social_media_insights_{timestamp}.json"
    
    combined_output = {
        "scraping_results": results,
        "analysis": analysis
    }
    
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(combined_output, f, indent=2, ensure_ascii=False)
    
    print(f"\n📊 Results Summary:")
    print(f"Total items collected: {results['combined_insights']['total_items']}")
    print(f"YouTube items: {results['combined_insights']['youtube_items']}")
    print(f"Reddit items: {results['combined_insights']['reddit_items']}")
    print(f"Results saved to: {filename}")
    
    # Print insights
    if analysis["insights_summary"]:
        print(f"\n🔍 Key Insights:")
        for insight in analysis["insights_summary"]:
            print(f"  • {insight}")

if __name__ == "__main__":
    main()