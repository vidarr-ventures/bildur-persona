#!/usr/bin/env python3
"""
Reddit Content Scraper for Customer Persona Generation
Integrates with Reddit API (PRAW) to collect authentic customer discussions and insights.

Author: Claude Code Assistant
Date: 2025-01-11
"""

import os
import json
import re
import time
import hashlib
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
import logging

try:
    import praw
    from praw.exceptions import RedditException, RedditAPIException
except ImportError:
    print("Error: praw not installed.")
    print("Install with: pip install praw")
    exit(1)

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    print("Warning: scikit-learn not available. Using basic text matching for relevance.")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class RedditContent:
    """Data structure for Reddit post or comment"""
    content_id: str
    content_type: str  # 'post' or 'comment'
    text: str
    title: Optional[str]
    username: str  # anonymized
    date: str
    subreddit: str
    score: int
    num_comments: int
    keyword_phrase: str
    relevance_score: float
    post_url: str
    source_url: str

@dataclass
class RedditScrapingResult:
    """Data structure for Reddit scraping results"""
    source: str
    scrape_date: str
    total_items: int
    keywords_searched: List[str]
    content: List[Dict[str, Any]]
    data_quality: Dict[str, Any]

class RedditScraper:
    """Main scraper class for Reddit content"""
    
    def __init__(self, client_id: Optional[str] = None, client_secret: Optional[str] = None, user_agent: str = "PersonaPipeline/1.0"):
        """Initialize Reddit scraper with API credentials"""
        self.client_id = client_id or os.getenv('REDDIT_CLIENT_ID')
        self.client_secret = client_secret or os.getenv('REDDIT_CLIENT_SECRET')
        self.user_agent = user_agent
        
        if not self.client_id or not self.client_secret:
            raise ValueError("Reddit API credentials required. Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET environment variables.")
        
        self.reddit = self.setup_reddit_client()
        self.api_calls_made = 0
        self.content_collected = []
        
        # Initialize TF-IDF vectorizer if sklearn is available
        self.tfidf_vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            lowercase=True,
            ngram_range=(1, 2),
            min_df=1
        ) if SKLEARN_AVAILABLE else None
    
    def setup_reddit_client(self) -> praw.Reddit:
        """Set up Reddit API client"""
        try:
            reddit = praw.Reddit(
                client_id=self.client_id,
                client_secret=self.client_secret,
                user_agent=self.user_agent,
                read_only=True  # Read-only mode for safety
            )
            
            # Test the connection
            logger.info("Testing Reddit API connection...")
            reddit.user.me()  # This will raise exception if not authenticated properly
            logger.info("Reddit API connection successful")
            
            return reddit
            
        except Exception as e:
            logger.error(f"Failed to setup Reddit client: {e}")
            raise ValueError(f"Reddit API setup failed: {e}")
    
    def anonymize_username(self, username: str) -> str:
        """Anonymize username for privacy protection"""
        if not username or username in ['[deleted]', '[removed]', 'AutoModerator']:
            return 'AnonymousUser'
        
        # Create a consistent hash of the username
        hash_object = hashlib.sha256(username.encode())
        hex_dig = hash_object.hexdigest()[:8]
        return f"User_{hex_dig}"
    
    def calculate_relevance_score(self, content_text: str, keyword_phrase: str) -> float:
        """Calculate relevance score between content and keyword phrase"""
        if not content_text or not keyword_phrase:
            return 0.0
        
        # Convert to lowercase for comparison
        content_lower = content_text.lower()
        keyword_lower = keyword_phrase.lower()
        
        # Basic keyword matching score
        keyword_words = keyword_lower.split()
        content_words = content_lower.split()
        
        # Direct keyword phrase match (high score)
        if keyword_lower in content_lower:
            base_score = 0.8
        else:
            # Count individual keyword matches
            matches = sum(1 for word in keyword_words if word in content_words)
            base_score = (matches / len(keyword_words)) * 0.6
        
        # Boost score based on content quality indicators
        quality_boost = 0.0
        
        # Longer content tends to be more substantive
        if len(content_text) > 200:
            quality_boost += 0.15
        elif len(content_text) > 100:
            quality_boost += 0.1
        elif len(content_text) > 50:
            quality_boost += 0.05
        
        # Check for question marks (engaging discussions)
        if '?' in content_text:
            quality_boost += 0.05
        
        # Check for experience indicators
        experience_words = ['i use', 'i tried', 'my experience', 'i found', 'works for me', 
                           'i recommend', 'been using', 'have used', 'in my case']
        if any(phrase in content_lower for phrase in experience_words):
            quality_boost += 0.1
        
        # Advanced similarity using TF-IDF if available
        if SKLEARN_AVAILABLE and self.tfidf_vectorizer and len(content_text) > 20:
            try:
                # Create corpus with keyword and content
                corpus = [keyword_phrase, content_text]
                tfidf_matrix = self.tfidf_vectorizer.fit_transform(corpus)
                similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
                
                # Combine basic score with TF-IDF similarity
                final_score = (base_score * 0.6) + (similarity * 0.4) + quality_boost
            except:
                final_score = base_score + quality_boost
        else:
            final_score = base_score + quality_boost
        
        return min(1.0, final_score)
    
    def is_quality_content(self, text: str, score: int = 0) -> bool:
        """Filter for quality content"""
        if not text or len(text.strip()) < 20:
            return False
        
        text_lower = text.lower()
        
        # Filter out common spam/low-quality indicators
        spam_indicators = [
            '[deleted]', '[removed]', 'this post has been removed',
            'your submission has been removed', 'click here', 'check out my',
            'dm me', 'pm me for', 'follow me', 'subscribe to my'
        ]
        
        for indicator in spam_indicators:
            if indicator in text_lower:
                return False
        
        # Filter out very short or low-effort content
        if len(text.split()) < 5:
            return False
        
        # Boost content with positive engagement
        if score < -5:  # Heavily downvoted content
            return False
        
        return True
    
    def get_relevant_subreddits(self, keyword: str) -> List[str]:
        """Get list of relevant subreddits for keyword"""
        # Base subreddits for general search
        base_subreddits = ['all']
        
        # Industry/category-specific subreddits based on keywords
        keyword_lower = keyword.lower()
        
        subreddit_mappings = {
            'customer service': ['CustomerService', 'TalesFromRetail', 'TalesFromCallCenters'],
            'software': ['programming', 'software', 'techsupport', 'SoftwareGore'],
            'business': ['Entrepreneur', 'smallbusiness', 'business'],
            'marketing': ['marketing', 'advertising', 'socialmedia'],
            'product': ['BuyItForLife', 'reviews', 'ProductPorn'],
            'app': ['apps', 'androidapps', 'iphone'],
            'tool': ['tools', 'specializedtools', 'BuyItForLife'],
            'service': ['reviews', 'Scams', 'YouShouldKnow'],
            'price': ['frugal', 'deals', 'personalfinance'],
            'review': ['reviews', 'BuyItForLife', 'whatsthatbook'],
        }
        
        # Add relevant subreddits based on keyword content
        for key, subreddits in subreddit_mappings.items():
            if key in keyword_lower:
                base_subreddits.extend(subreddits)
        
        # Remove duplicates and limit
        return list(set(base_subreddits))[:5]
    
    def search_posts_by_keyword(self, keyword: str, limit: int = 3) -> List[Dict]:
        """Search for posts by keyword phrase"""
        posts = []
        relevant_subreddits = self.get_relevant_subreddits(keyword)
        
        logger.info(f"Searching Reddit for keyword: '{keyword}' in subreddits: {relevant_subreddits}")
        
        for subreddit_name in relevant_subreddits:
            if len(posts) >= limit:
                break
            
            try:
                subreddit = self.reddit.subreddit(subreddit_name)
                self.api_calls_made += 1
                
                # Search posts in this subreddit
                search_results = list(subreddit.search(keyword, sort='relevance', time_filter='all', limit=limit*2))
                
                for post in search_results:
                    if len(posts) >= limit:
                        break
                    
                    # Skip if post is deleted or has no content
                    if not post.title or post.selftext in ['[deleted]', '[removed]', '']:
                        continue
                    
                    # Calculate relevance score
                    full_text = f"{post.title} {post.selftext}"
                    relevance = self.calculate_relevance_score(full_text, keyword)
                    
                    if relevance >= 0.3 and self.is_quality_content(full_text, post.score):
                        post_data = {
                            'post_id': post.id,
                            'title': post.title,
                            'selftext': post.selftext,
                            'author': str(post.author) if post.author else '[deleted]',
                            'created_utc': post.created_utc,
                            'subreddit': post.subreddit.display_name,
                            'score': post.score,
                            'num_comments': post.num_comments,
                            'url': f"https://reddit.com{post.permalink}",
                            'relevance_score': relevance,
                            'post_obj': post  # Keep reference for getting comments
                        }
                        posts.append(post_data)
                
                # Small delay between subreddit searches
                time.sleep(0.5)
                
            except Exception as e:
                logger.error(f"Error searching subreddit {subreddit_name}: {e}")
                continue
        
        # Sort by relevance and engagement
        posts.sort(key=lambda x: (x['relevance_score'] * 0.7) + (min(x['score'], 100) / 100 * 0.3), reverse=True)
        
        logger.info(f"Found {len(posts)} relevant posts for keyword '{keyword}'")
        return posts[:limit]
    
    def get_post_comments(self, post_data: Dict, max_comments: int = 10) -> List[Dict]:
        """Get top comments from a post"""
        comments = []
        
        try:
            post = post_data['post_obj']
            post.comments.replace_more(limit=0)  # Don't expand "more comments"
            
            # Get top-level comments sorted by score
            top_comments = sorted(post.comments.list()[:max_comments*2], 
                                key=lambda x: x.score, reverse=True)
            
            for comment in top_comments[:max_comments]:
                if len(comments) >= max_comments:
                    break
                
                if not comment.body or comment.body in ['[deleted]', '[removed]']:
                    continue
                
                if self.is_quality_content(comment.body, comment.score):
                    comment_data = {
                        'comment_id': comment.id,
                        'body': comment.body,
                        'author': str(comment.author) if comment.author else '[deleted]',
                        'created_utc': comment.created_utc,
                        'score': comment.score,
                        'parent_post_id': post_data['post_id'],
                        'permalink': f"https://reddit.com{comment.permalink}"
                    }
                    comments.append(comment_data)
            
            self.api_calls_made += 1
            logger.info(f"Retrieved {len(comments)} quality comments from post: {post_data['title'][:50]}...")
            
        except Exception as e:
            logger.error(f"Error getting comments for post {post_data['post_id']}: {e}")
        
        return comments
    
    def filter_relevant_content(self, content_list: List[Dict], keyword_phrase: str, min_score: float = 0.3) -> List[Dict]:
        """Filter content by relevance to keyword phrase"""
        relevant_content = []
        
        for item in content_list:
            # Calculate relevance score based on content type
            if item.get('content_type') == 'post':
                text_content = f"{item.get('title', '')} {item.get('text', '')}"
            else:
                text_content = item.get('text', '')
            
            relevance_score = self.calculate_relevance_score(text_content, keyword_phrase)
            item['relevance_score'] = relevance_score
            item['keyword_phrase'] = keyword_phrase
            
            if relevance_score >= min_score:
                relevant_content.append(item)
        
        # Sort by relevance and engagement
        relevant_content.sort(
            key=lambda x: (x['relevance_score'] * 0.8) + (min(max(x.get('score', 0), 0), 100) / 100 * 0.2),
            reverse=True
        )
        
        logger.info(f"Filtered {len(relevant_content)} relevant items from {len(content_list)} total")
        return relevant_content
    
    def scrape_content_for_keywords(self, keyword_list: List[str], total_limit: int = 50) -> RedditScrapingResult:
        """Main function to scrape Reddit content for multiple keywords"""
        logger.info(f"Starting Reddit scraping for {len(keyword_list)} keywords")
        logger.info(f"Target: {total_limit} total items")
        
        start_time = datetime.now(timezone.utc)
        all_content = []
        subreddits_searched = set()
        content_per_keyword = {}
        
        # Distribute content quota across keywords
        content_per_keyword_target = max(1, total_limit // len(keyword_list))
        
        for i, keyword in enumerate(keyword_list):
            if len(all_content) >= total_limit:
                logger.info(f"Reached total content limit of {total_limit}")
                break
            
            logger.info(f"Processing keyword {i+1}/{len(keyword_list)}: '{keyword}'")
            keyword_content = []
            
            # Search for posts
            posts = self.search_posts_by_keyword(keyword, limit=3)
            
            for post_data in posts:
                if len(all_content) >= total_limit:
                    break
                
                subreddits_searched.add(post_data['subreddit'])
                
                # Add post content
                post_content = {
                    'content_id': f"RP_{post_data['post_id']}",
                    'content_type': 'post',
                    'text': f"{post_data['selftext']}",
                    'title': post_data['title'],
                    'username': self.anonymize_username(post_data['author']),
                    'date': datetime.fromtimestamp(post_data['created_utc'], tz=timezone.utc).isoformat(),
                    'subreddit': post_data['subreddit'],
                    'score': post_data['score'],
                    'num_comments': post_data['num_comments'],
                    'keyword_phrase': keyword,
                    'relevance_score': post_data['relevance_score'],
                    'post_url': post_data['url'],
                    'source_url': post_data['url']
                }
                
                if self.is_quality_content(post_content['text'], post_content['score']):
                    keyword_content.append(post_content)
                
                # Get comments from this post
                remaining_for_keyword = content_per_keyword_target - len(keyword_content)
                remaining_total = total_limit - len(all_content)
                max_comments = min(8, remaining_for_keyword, remaining_total)
                
                if max_comments > 0:
                    comments = self.get_post_comments(post_data, max_comments)
                    
                    for comment in comments:
                        if len(keyword_content) >= content_per_keyword_target or len(all_content) >= total_limit:
                            break
                        
                        comment_content = {
                            'content_id': f"RC_{comment['comment_id']}",
                            'content_type': 'comment',
                            'text': comment['body'],
                            'title': None,
                            'username': self.anonymize_username(comment['author']),
                            'date': datetime.fromtimestamp(comment['created_utc'], tz=timezone.utc).isoformat(),
                            'subreddit': post_data['subreddit'],
                            'score': comment['score'],
                            'num_comments': 0,
                            'keyword_phrase': keyword,
                            'relevance_score': self.calculate_relevance_score(comment['body'], keyword),
                            'post_url': post_data['url'],
                            'source_url': comment['permalink']
                        }
                        
                        if comment_content['relevance_score'] >= 0.3:
                            keyword_content.append(comment_content)
                
                # Delay between posts
                time.sleep(0.3)
            
            # Filter content for relevance
            relevant_content = self.filter_relevant_content(keyword_content, keyword, min_score=0.3)
            
            # Add to total (up to limit)
            remaining_spots = total_limit - len(all_content)
            if remaining_spots > 0:
                content_to_add = relevant_content[:remaining_spots]
                all_content.extend(content_to_add)
                content_per_keyword[keyword] = len(content_to_add)
            
            logger.info(f"Collected {len(relevant_content)} items for keyword '{keyword}'")
        
        # Calculate quality metrics
        total_filtered = len(all_content)
        avg_relevance = sum(item['relevance_score'] for item in all_content) / max(1, total_filtered)
        
        # Convert to proper format
        formatted_content = []
        for item in all_content:
            content_obj = RedditContent(
                content_id=item['content_id'],
                content_type=item['content_type'],
                text=item['text'],
                title=item['title'],
                username=item['username'],
                date=item['date'],
                subreddit=item['subreddit'],
                score=item['score'],
                num_comments=item['num_comments'],
                keyword_phrase=item['keyword_phrase'],
                relevance_score=item['relevance_score'],
                post_url=item['post_url'],
                source_url=item['source_url']
            )
            formatted_content.append(asdict(content_obj))
        
        # Create result object
        result = RedditScrapingResult(
            source="reddit_discussions",
            scrape_date=start_time.isoformat(),
            total_items=len(formatted_content),
            keywords_searched=keyword_list,
            content=formatted_content,
            data_quality={
                "api_calls_made": self.api_calls_made,
                "subreddits_searched": list(subreddits_searched),
                "content_filter_ratio": round(total_filtered / max(1, self.api_calls_made * 10), 3),
                "content_per_keyword": content_per_keyword,
                "avg_relevance_score": round(avg_relevance, 3),
                "scraping_duration_seconds": (datetime.now(timezone.utc) - start_time).total_seconds()
            }
        )
        
        logger.info(f"Reddit scraping completed. Collected {len(formatted_content)} items")
        logger.info(f"API calls made: {self.api_calls_made}")
        logger.info(f"Subreddits searched: {len(subreddits_searched)}")
        
        return result
    
    def save_reddit_data(self, data: RedditScrapingResult, filename: str):
        """Save scraped data to JSON file"""
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(asdict(data), f, indent=2, ensure_ascii=False)
            logger.info(f"Data saved to {filename}")
        except Exception as e:
            logger.error(f"Error saving data to {filename}: {e}")

def main():
    """Example usage of the Reddit scraper"""
    # Initialize scraper
    try:
        scraper = RedditScraper()
    except ValueError as e:
        print(f"Error: {e}")
        print("Please set your Reddit API credentials:")
        print("export REDDIT_CLIENT_ID='your_client_id'")
        print("export REDDIT_CLIENT_SECRET='your_client_secret'")
        print("\nTo get credentials:")
        print("1. Go to https://www.reddit.com/prefs/apps")
        print("2. Click 'Create App' or 'Create Another App'")
        print("3. Choose 'script' type")
        print("4. Use any URL for redirect uri (not used)")
        return
    
    # Example keywords for customer persona research
    keywords = [
        "customer service problems",
        "frustrated with software",
        "small business challenges"
    ]
    
    print("Reddit Content Scraper for Customer Persona Generation")
    print("=" * 55)
    print(f"Keywords to search: {keywords}")
    print(f"Target content items: 50")
    print()
    
    # Scrape content
    data = scraper.scrape_content_for_keywords(keywords, total_limit=50)
    
    # Save results
    filename = f"reddit_discussions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    scraper.save_reddit_data(data, filename)
    
    # Print summary
    print("\nScraping Results:")
    print(f"Total content collected: {data.total_items}")
    print(f"Subreddits searched: {', '.join(data.data_quality['subreddits_searched'][:5])}")
    print(f"API calls made: {data.data_quality['api_calls_made']}")
    print(f"Average relevance score: {data.data_quality['avg_relevance_score']}")
    print(f"Data saved to: {filename}")
    
    if data.content:
        print(f"\nSample content:")
        sample = data.content[0]
        print(f"Type: {sample['content_type']}")
        print(f"Text: {sample['text'][:100]}...")
        print(f"Subreddit: r/{sample['subreddit']}")
        print(f"Score: {sample['score']}")
        print(f"Relevance: {sample['relevance_score']:.2f}")

if __name__ == "__main__":
    main()