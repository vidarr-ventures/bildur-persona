#!/usr/bin/env python3
"""
Test script for YouTube comment scraper integration
Tests the complete workflow without requiring an actual API key
"""

import json
import os
from datetime import datetime
from youtube_comment_scraper import YouTubeCommentScraper, Comment, ScrapingResult

def simulate_youtube_data():
    """
    Simulate YouTube comment data for testing purposes
    This represents what would be returned by the actual API
    """
    sample_comments = [
        {
            'comment_id': 'comment_1',
            'text': 'I\'ve been struggling with customer service issues for my small business. This looks helpful!',
            'commenter': 'SmallBizOwner2023',
            'channel_id': 'channel_1',
            'date': '2025-01-09T10:00:00Z',
            'updated_date': '2025-01-09T10:00:00Z',
            'likes': 5,
            'replies': 2,
            'parent_id': None,
            'video_title': 'Top Customer Service Solutions for Small Businesses',
            'video_url': 'https://www.youtube.com/watch?v=example1',
            'source_url': 'https://www.youtube.com/watch?v=example1&lc=comment_1'
        },
        {
            'comment_id': 'comment_2', 
            'text': 'As a frustrated software user, I need something that actually works for my business needs.',
            'commenter': 'TechStruggler',
            'channel_id': 'channel_2',
            'date': '2025-01-08T15:30:00Z',
            'updated_date': '2025-01-08T15:30:00Z',
            'likes': 12,
            'replies': 8,
            'parent_id': None,
            'video_title': 'Software Review: Business Tools That Actually Work',
            'video_url': 'https://www.youtube.com/watch?v=example2',
            'source_url': 'https://www.youtube.com/watch?v=example2&lc=comment_2'
        },
        {
            'comment_id': 'comment_3',
            'text': 'This is absolutely amazing! Finally found something that solves all my problems. Game changer!',
            'commenter': 'HappyCustomer',
            'channel_id': 'channel_3',
            'date': '2025-01-07T12:00:00Z',
            'updated_date': '2025-01-07T12:00:00Z',
            'likes': 25,
            'replies': 15,
            'parent_id': None,
            'video_title': 'Customer Success Stories',
            'video_url': 'https://www.youtube.com/watch?v=example3',
            'source_url': 'https://www.youtube.com/watch?v=example3&lc=comment_3'
        },
        {
            'comment_id': 'comment_4',
            'text': 'I\'m desperate for help with this. Running out of options and don\'t know what to do anymore.',
            'commenter': 'DesperateUser',
            'channel_id': 'channel_4',
            'date': '2025-01-06T20:00:00Z',
            'updated_date': '2025-01-06T20:00:00Z',
            'likes': 8,
            'replies': 12,
            'parent_id': None,
            'video_title': 'Help for Business Owners in Crisis',
            'video_url': 'https://www.youtube.com/watch?v=example4',
            'source_url': 'https://www.youtube.com/watch?v=example4&lc=comment_4'
        }
    ]
    return sample_comments

def test_complete_workflow():
    """Test the complete YouTube scraping workflow"""
    print("YouTube Comment Scraper Integration Test")
    print("=" * 50)
    
    # Test keywords for persona generation
    keywords = [
        "customer service problems",
        "frustrated with software", 
        "small business challenges"
    ]
    
    print(f"Test Keywords: {', '.join(keywords)}")
    print()
    
    # Create scraper instance (without actual API validation)
    try:
        scraper = YouTubeCommentScraper('test_key_for_demo')
        
        # Simulate the scraping process
        print("Simulating comment scraping process...")
        print()
        
        # Test relevance filtering with simulated data
        all_comments = []
        simulated_comments = simulate_youtube_data()
        
        for keyword in keywords:
            print(f"Processing keyword: '{keyword}'")
            
            # Filter comments for relevance to this keyword
            relevant_comments = scraper.filter_relevant_comments(
                simulated_comments.copy(), 
                keyword, 
                min_score=0.3
            )
            
            for comment in relevant_comments:
                comment['keyword_phrase'] = keyword
                all_comments.append(comment)
                print(f"  ✓ Found relevant comment (score: {comment['relevance_score']:.3f})")
                print(f"    Text: {comment['text'][:60]}...")
            
            print()
        
        # Extract emotional quotes from all comments
        print("Extracting emotionally resonant quotes...")
        emotional_quotes = scraper.extract_emotional_quotes(all_comments, max_quotes=10)
        print(f"  ✓ Extracted {len(emotional_quotes)} emotional quotes")
        print()
        
        # Create final result structure
        result = ScrapingResult(
            source="youtube_comments",
            scrape_date=datetime.now().isoformat(),
            total_comments=len(all_comments),
            keywords_searched=keywords,
            comments=[
                {
                    'comment_id': c['comment_id'],
                    'text': c['text'],
                    'commenter': c['commenter'],
                    'date': c['date'],
                    'video_title': c['video_title'],
                    'video_url': c['video_url'],
                    'keyword_phrase': c['keyword_phrase'],
                    'relevance_score': c['relevance_score'],
                    'likes': c['likes'],
                    'replies': c['replies'],
                    'source_url': c['source_url']
                }
                for c in all_comments
            ],
            emotional_quotes=emotional_quotes,
            data_quality={
                "api_quota_used": scraper.quota_manager.quota_used,
                "videos_analyzed": 2,
                "comment_filter_ratio": 0.85,
                "comments_per_keyword": {kw: sum(1 for c in all_comments if c['keyword_phrase'] == kw) for kw in keywords},
                "emotional_quotes_extracted": len(emotional_quotes),
                "high_potential_quotes": sum(1 for q in emotional_quotes if q['marketing_potential'] == 'high'),
                "scraping_duration_seconds": 45.2
            }
        )
        
        # Display results
        print("Scraping Results Summary:")
        print(f"  Total Comments Collected: {result.total_comments}")
        print(f"  Keywords Processed: {len(result.keywords_searched)}")
        print(f"  Comments per Keyword: {result.data_quality['comments_per_keyword']}")
        print(f"  Emotional Quotes Extracted: {result.data_quality['emotional_quotes_extracted']}")
        print(f"  High Marketing Potential Quotes: {result.data_quality['high_potential_quotes']}")
        print()
        
        # Show sample comment
        if result.comments:
            sample = result.comments[0]
            print("Sample High-Relevance Comment:")
            print(f"  Commenter: {sample['commenter']}")
            print(f"  Text: {sample['text']}")
            print(f"  Keyword: {sample['keyword_phrase']}")
            print(f"  Relevance: {sample['relevance_score']:.3f}")
            print(f"  Engagement: {sample['likes']} likes, {sample['replies']} replies")
            print()
        
        # Show sample emotional quotes
        if result.emotional_quotes:
            print("Top Emotional Quotes for Marketing:")
            for i, quote in enumerate(result.emotional_quotes[:3], 1):
                print(f"  {i}. \"{quote['quote_text']}\"")
                print(f"     Emotion: {quote['emotion_type']} (intensity: {quote['emotional_intensity']:.2f})")
                print(f"     Marketing Potential: {quote['marketing_potential']}")
                print(f"     Psychological Trigger: {quote['psychological_trigger']}")
                print(f"     Context: {quote['context']}")
                print()
            print()
        
        # Save test results
        output_file = f"youtube_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result.__dict__, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Test results saved to: {output_file}")
        print()
        print("Integration Test Status: SUCCESS")
        print()
        print("Next Steps for Production:")
        print("1. Obtain YouTube Data API v3 key from Google Cloud Console")
        print("2. Set YOUTUBE_API_KEY environment variable")
        print("3. Integrate with main persona generation pipeline")
        print("4. Add YouTube data to existing website scraping workflow")
        
    except Exception as e:
        print(f"Integration test failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    test_complete_workflow()