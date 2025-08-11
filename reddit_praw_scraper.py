#!/usr/bin/env python3
"""
Reddit Scraper using PRAW (Python Reddit API Wrapper)
Official Reddit API implementation for reliable Reddit content access
"""

import os
import json
import sys
import praw
from datetime import datetime
from typing import List, Dict, Any
import re

class RedditPRAWScraper:
    def __init__(self):
        """Initialize Reddit API client with credentials from environment variables"""
        self.reddit = praw.Reddit(
            client_id=os.environ.get('REDDIT_CLIENT_ID'),
            client_secret=os.environ.get('REDDIT_CLIENT_SECRET'),
            user_agent='PersonaBot/1.0 (Customer Research Tool)',
            # Read-only mode - no authentication needed for searching
            redirect_uri='http://localhost:8080',
            refresh_token=None
        )
        
        # Target subreddits for health/wellness topics
        self.health_subreddits = [
            'sleep', 'insomnia', 'biohacking',
            'wellness', 'naturalhealth', 'health',
            'reviews', 'BuyItForLife',
            'ChronicPain', 'inflammation',
            'Earthing', 'grounding', 'alternativehealth',
            'Supplements', 'Fibromyalgia'
        ]
        
    def calculate_relevance_score(self, text: str, keywords: List[str]) -> float:
        """Calculate relevance score based on keyword matching"""
        text_lower = text.lower()
        score = 0.0
        
        for keyword in keywords:
            keyword_lower = keyword.lower()
            # Direct keyword match
            if keyword_lower in text_lower:
                score += 0.3
            
            # Individual word matches
            words = keyword_lower.split()
            for word in words:
                if word in text_lower:
                    score += 0.1
        
        return min(score, 1.0)
    
    def search_reddit(self, keywords: List[str], total_limit: int = 25) -> Dict[str, Any]:
        """
        Search Reddit for content matching keywords
        
        Args:
            keywords: List of search terms
            total_limit: Maximum number of items to return
            
        Returns:
            Dictionary with Reddit content in specified format
        """
        all_content = []
        seen_ids = set()
        
        try:
            # Search across all of Reddit for each keyword
            for keyword in keywords:
                print(f"[PRAW] Searching Reddit for: {keyword}", file=sys.stderr)
                
                # Search all of Reddit
                try:
                    # Use Reddit search
                    search_results = self.reddit.subreddit('all').search(
                        query=keyword,
                        sort='relevance',
                        time_filter='all',
                        limit=10
                    )
                    
                    for submission in search_results:
                        if submission.id in seen_ids:
                            continue
                        seen_ids.add(submission.id)
                        
                        # Add post
                        post_item = {
                            "content_id": f"RP_{submission.id}",
                            "type": "post",
                            "text": submission.selftext or submission.title,
                            "title": submission.title,
                            "username": str(submission.author) if submission.author else "deleted",
                            "date": datetime.fromtimestamp(submission.created_utc).isoformat(),
                            "subreddit": submission.subreddit.display_name,
                            "score": submission.score,
                            "num_comments": submission.num_comments,
                            "keyword_phrase": keyword,
                            "relevance_score": self.calculate_relevance_score(
                                f"{submission.title} {submission.selftext}", 
                                keywords
                            ),
                            "post_url": f"https://reddit.com{submission.permalink}",
                            "source_url": submission.url
                        }
                        all_content.append(post_item)
                        
                        # Get top comments if post has high relevance
                        if post_item["relevance_score"] > 0.5 and submission.num_comments > 0:
                            submission.comments.replace_more(limit=0)
                            top_comments = submission.comments[:3]
                            
                            for comment in top_comments:
                                if hasattr(comment, 'body') and comment.body and len(comment.body) > 20:
                                    comment_item = {
                                        "content_id": f"RC_{comment.id}",
                                        "type": "comment",
                                        "text": comment.body,
                                        "title": None,
                                        "username": str(comment.author) if comment.author else "deleted",
                                        "date": datetime.fromtimestamp(comment.created_utc).isoformat(),
                                        "subreddit": submission.subreddit.display_name,
                                        "score": comment.score,
                                        "num_comments": 0,
                                        "keyword_phrase": keyword,
                                        "relevance_score": self.calculate_relevance_score(
                                            comment.body, 
                                            keywords
                                        ),
                                        "post_url": f"https://reddit.com{submission.permalink}",
                                        "source_url": f"https://reddit.com{comment.permalink}"
                                    }
                                    all_content.append(comment_item)
                
                except Exception as e:
                    print(f"[PRAW] Error searching all of Reddit: {e}", file=sys.stderr)
                
                # Also search specific health subreddits
                for subreddit_name in self.health_subreddits[:5]:  # Limit to 5 subreddits
                    try:
                        subreddit = self.reddit.subreddit(subreddit_name)
                        search_results = subreddit.search(
                            query=keyword,
                            sort='relevance',
                            time_filter='all',
                            limit=3
                        )
                        
                        for submission in search_results:
                            if submission.id in seen_ids:
                                continue
                            seen_ids.add(submission.id)
                            
                            post_item = {
                                "content_id": f"RP_{submission.id}",
                                "type": "post",
                                "text": submission.selftext or submission.title,
                                "title": submission.title,
                                "username": str(submission.author) if submission.author else "deleted",
                                "date": datetime.fromtimestamp(submission.created_utc).isoformat(),
                                "subreddit": submission.subreddit.display_name,
                                "score": submission.score,
                                "num_comments": submission.num_comments,
                                "keyword_phrase": keyword,
                                "relevance_score": self.calculate_relevance_score(
                                    f"{submission.title} {submission.selftext}", 
                                    keywords
                                ),
                                "post_url": f"https://reddit.com{submission.permalink}",
                                "source_url": submission.url
                            }
                            all_content.append(post_item)
                            
                    except Exception as e:
                        print(f"[PRAW] Error searching r/{subreddit_name}: {e}", file=sys.stderr)
                
                # Break if we have enough content
                if len(all_content) >= total_limit:
                    break
            
            # Sort by relevance score and limit results
            all_content.sort(key=lambda x: x["relevance_score"], reverse=True)
            final_content = all_content[:total_limit]
            
            # Prepare response
            response = {
                "source": "reddit_discussions",
                "scrape_date": datetime.now().isoformat(),
                "total_items": len(final_content),
                "keywords_searched": keywords,
                "content": final_content,
                "data_quality": {
                    "api_calls_made": len(keywords) * 6,  # Approximate
                    "subreddits_searched": list(set([item["subreddit"] for item in final_content])),
                    "posts_vs_comments": {
                        "posts": len([item for item in final_content if item["type"] == "post"]),
                        "comments": len([item for item in final_content if item["type"] == "comment"])
                    }
                }
            }
            
            return response
            
        except Exception as e:
            print(f"[PRAW] Fatal error: {e}", file=sys.stderr)
            return {
                "source": "reddit_discussions",
                "scrape_date": datetime.now().isoformat(),
                "total_items": 0,
                "keywords_searched": keywords,
                "content": [],
                "error": str(e)
            }

def main():
    """Main function to run Reddit scraper"""
    # Get input from command line arguments or stdin
    if len(sys.argv) > 1:
        # Command line arguments
        keywords = sys.argv[1].split(',')
        total_limit = int(sys.argv[2]) if len(sys.argv) > 2 else 25
    else:
        # Read from stdin (for API integration)
        try:
            input_data = json.load(sys.stdin)
            keywords = input_data.get('keywords', [])
            total_limit = input_data.get('totalLimit', 25)
        except:
            print(json.dumps({
                "error": "Invalid input. Provide keywords as argument or JSON via stdin"
            }))
            sys.exit(1)
    
    # Check for Reddit credentials
    if not os.environ.get('REDDIT_CLIENT_ID') or not os.environ.get('REDDIT_CLIENT_SECRET'):
        print(json.dumps({
            "error": "Reddit API credentials not configured. Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET environment variables."
        }))
        sys.exit(1)
    
    # Create scraper and search
    scraper = RedditPRAWScraper()
    results = scraper.search_reddit(keywords, total_limit)
    
    # Output results as JSON
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()