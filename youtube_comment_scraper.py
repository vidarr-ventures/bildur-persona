#!/usr/bin/env python3
"""
YouTube Comment Scraper for Customer Persona Generation
Integrates with YouTube Data API v3 to collect customer comments for persona analysis.

Author: Claude Code Assistant
Date: 2025-01-09
"""

import os
import json
import re
import time
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
from collections import defaultdict
import logging

try:
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError:
    print("Error: google-api-python-client not installed.")
    print("Install with: pip install google-api-python-client")
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
class Comment:
    """Data structure for YouTube comment"""
    comment_id: str
    text: str
    commenter: str
    date: str
    video_title: str
    video_url: str
    keyword_phrase: str
    relevance_score: float
    likes: int
    replies: int
    source_url: str

@dataclass
class EmotionalQuote:
    """Data structure for emotionally resonant customer quotes"""
    quote_text: str
    emotion_type: str
    emotional_intensity: float
    context: str
    commenter: str
    engagement_score: float
    marketing_potential: str
    psychological_trigger: str
    source_video: str
    keyword_context: str

@dataclass
class ScrapingResult:
    """Data structure for scraping results"""
    source: str
    scrape_date: str
    total_comments: int
    keywords_searched: List[str]
    comments: List[Dict[str, Any]]
    emotional_quotes: List[Dict[str, Any]]
    data_quality: Dict[str, Any]

class YouTubeQuotaManager:
    """Manages YouTube API quota usage"""
    
    def __init__(self):
        self.quota_used = 0
        self.max_quota = 10000  # Daily limit
        self.operation_costs = {
            'search': 100,
            'comment_threads': 1,
            'videos': 1
        }
    
    def can_perform_operation(self, operation: str, count: int = 1) -> bool:
        """Check if operation is within quota limits"""
        cost = self.operation_costs.get(operation, 1) * count
        return (self.quota_used + cost) <= self.max_quota
    
    def record_operation(self, operation: str, count: int = 1):
        """Record quota usage for operation"""
        cost = self.operation_costs.get(operation, 1) * count
        self.quota_used += cost
        logger.info(f"Quota used: {cost} units. Total: {self.quota_used}/{self.max_quota}")
    
    def get_remaining_quota(self) -> int:
        """Get remaining quota units"""
        return self.max_quota - self.quota_used

class YouTubeCommentScraper:
    """Main scraper class for YouTube comments"""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize scraper with API key"""
        self.api_key = api_key or os.getenv('YOUTUBE_API_KEY')
        if not self.api_key:
            raise ValueError("YouTube API key required. Set YOUTUBE_API_KEY environment variable.")
        
        self.youtube = build('youtube', 'v3', developerKey=self.api_key)
        self.quota_manager = YouTubeQuotaManager()
        self.comments_collected = []
        
        # Initialize TF-IDF vectorizer if sklearn is available
        self.tfidf_vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            lowercase=True,
            ngram_range=(1, 2)
        ) if SKLEARN_AVAILABLE else None
    
    def validate_api_key(self) -> bool:
        """Validate YouTube API key by making a test request"""
        try:
            request = self.youtube.search().list(
                q="test",
                part="id",
                maxResults=1
            )
            request.execute()
            logger.info("API key validation successful")
            return True
        except HttpError as e:
            logger.error(f"API key validation failed: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error during validation: {e}")
            return False
    
    def search_videos_by_keyword(self, keyword: str, max_results: int = 3) -> List[Dict[str, Any]]:
        """Search for videos by keyword phrase"""
        if not self.quota_manager.can_perform_operation('search'):
            logger.warning("Insufficient quota for search operation")
            return []
        
        try:
            logger.info(f"Searching for videos with keyword: '{keyword}'")
            
            request = self.youtube.search().list(
                q=keyword,
                part='id,snippet',
                type='video',
                order='relevance',
                maxResults=max_results,
                safeSearch='moderate',
                relevanceLanguage='en'
            )
            
            response = request.execute()
            self.quota_manager.record_operation('search')
            
            videos = []
            for item in response.get('items', []):
                video_data = {
                    'video_id': item['id']['videoId'],
                    'title': item['snippet']['title'],
                    'description': item['snippet']['description'],
                    'channel': item['snippet']['channelTitle'],
                    'published_at': item['snippet']['publishedAt'],
                    'url': f"https://www.youtube.com/watch?v={item['id']['videoId']}"
                }
                videos.append(video_data)
                logger.info(f"Found video: {video_data['title'][:50]}...")
            
            return videos
            
        except HttpError as e:
            logger.error(f"Error searching videos for keyword '{keyword}': {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in video search: {e}")
            return []
    
    def get_video_comments(self, video_id: str, max_comments: int = 20) -> List[Dict[str, Any]]:
        """Get comments from a specific video"""
        if not self.quota_manager.can_perform_operation('comment_threads', max_comments):
            logger.warning(f"Insufficient quota for getting {max_comments} comments")
            max_comments = min(max_comments, self.quota_manager.get_remaining_quota())
        
        comments = []
        next_page_token = None
        comments_fetched = 0
        
        try:
            while comments_fetched < max_comments:
                request = self.youtube.commentThreads().list(
                    part='snippet,replies',
                    videoId=video_id,
                    maxResults=min(20, max_comments - comments_fetched),
                    order='relevance',
                    textFormat='plainText',
                    pageToken=next_page_token
                )
                
                response = request.execute()
                self.quota_manager.record_operation('comment_threads')
                
                for item in response.get('items', []):
                    comment_data = item['snippet']['topLevelComment']['snippet']
                    
                    comment = {
                        'comment_id': item['snippet']['topLevelComment']['id'],
                        'text': comment_data['textDisplay'],
                        'commenter': comment_data['authorDisplayName'],
                        'channel_id': comment_data.get('authorChannelId', {}).get('value', ''),
                        'date': comment_data['publishedAt'],
                        'updated_date': comment_data['updatedAt'],
                        'likes': comment_data['likeCount'],
                        'replies': item['snippet']['totalReplyCount'],
                        'parent_id': None
                    }
                    
                    comments.append(comment)
                    comments_fetched += 1
                    
                    if comments_fetched >= max_comments:
                        break
                
                next_page_token = response.get('nextPageToken')
                if not next_page_token:
                    break
                
                # Small delay to be respectful to API
                time.sleep(0.1)
            
            logger.info(f"Retrieved {len(comments)} comments from video {video_id}")
            return comments
            
        except HttpError as e:
            if e.resp.status == 403 and 'commentsDisabled' in str(e):
                logger.warning(f"Comments disabled for video {video_id}")
            else:
                logger.error(f"Error getting comments for video {video_id}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error getting comments: {e}")
            return []
    
    def calculate_relevance_score(self, comment_text: str, keyword_phrase: str) -> float:
        """Calculate relevance score between comment and keyword phrase"""
        if not comment_text or not keyword_phrase:
            return 0.0
        
        # Convert to lowercase for comparison
        comment_lower = comment_text.lower()
        keyword_lower = keyword_phrase.lower()
        
        # Basic keyword matching score
        keyword_words = keyword_lower.split()
        comment_words = comment_lower.split()
        
        # Direct keyword phrase match (high score)
        if keyword_lower in comment_lower:
            base_score = 0.8
        else:
            # Count individual keyword matches
            matches = sum(1 for word in keyword_words if word in comment_words)
            base_score = (matches / len(keyword_words)) * 0.6
        
        # Boost score based on comment quality indicators
        quality_boost = 0.0
        
        # Longer comments tend to be more substantive
        if len(comment_text) > 100:
            quality_boost += 0.1
        elif len(comment_text) > 50:
            quality_boost += 0.05
        
        # Check for question marks (engaging comments)
        if '?' in comment_text:
            quality_boost += 0.05
        
        # Check for emotional indicators
        emotional_words = ['love', 'hate', 'amazing', 'terrible', 'awesome', 'disappointed', 
                          'excited', 'frustrated', 'happy', 'sad', 'angry', 'pleased']
        if any(word in comment_lower for word in emotional_words):
            quality_boost += 0.1
        
        # Advanced similarity using TF-IDF if available
        if SKLEARN_AVAILABLE and self.tfidf_vectorizer:
            try:
                # Create corpus with keyword and comment
                corpus = [keyword_phrase, comment_text]
                tfidf_matrix = self.tfidf_vectorizer.fit_transform(corpus)
                similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
                
                # Combine basic score with TF-IDF similarity
                final_score = (base_score * 0.6) + (similarity * 0.4) + quality_boost
            except:
                final_score = base_score + quality_boost
        else:
            final_score = base_score + quality_boost
        
        return min(1.0, final_score)
    
    def filter_relevant_comments(self, comments: List[Dict], keyword_phrase: str, 
                               min_score: float = 0.3) -> List[Dict]:
        """Filter comments by relevance to keyword phrase"""
        relevant_comments = []
        
        for comment in comments:
            # Calculate relevance score
            relevance_score = self.calculate_relevance_score(comment['text'], keyword_phrase)
            comment['relevance_score'] = relevance_score
            comment['keyword_phrase'] = keyword_phrase
            
            # Apply filters
            if (relevance_score >= min_score and 
                len(comment['text']) >= 20 and  # Minimum length
                not self._is_spam_comment(comment['text'])):
                
                relevant_comments.append(comment)
        
        # Sort by relevance score and engagement
        relevant_comments.sort(
            key=lambda x: (x['relevance_score'] * 0.7) + (min(x['likes'], 100) / 100 * 0.3),
            reverse=True
        )
        
        logger.info(f"Filtered {len(relevant_comments)} relevant comments from {len(comments)} total")
        return relevant_comments
    
    def _is_spam_comment(self, text: str) -> bool:
        """Basic spam detection for comments"""
        text_lower = text.lower()
        
        # Common spam indicators
        spam_indicators = [
            'click here', 'check out my', 'subscribe to my', 'follow me',
            'make money', 'work from home', 'free gift', 'special offer',
            'www.', 'http', '.com', 'bit.ly'
        ]
        
        # Check for excessive repetition
        words = text.split()
        if len(set(words)) < len(words) * 0.5 and len(words) > 5:
            return True
        
        # Check for spam phrases
        for indicator in spam_indicators:
            if indicator in text_lower:
                return True
        
        # Check for excessive caps
        if len(text) > 10 and sum(1 for c in text if c.isupper()) / len(text) > 0.7:
            return True
        
        return False
    
    def extract_emotional_quotes(self, comments: List[Dict], max_quotes: int = 20) -> List[Dict]:
        """Extract emotionally resonant quotes from comments for marketing use"""
        emotional_quotes = []
        
        # Enhanced emotional indicators with intensity scores
        emotion_patterns = {
            'frustration': {
                'words': ['frustrated', 'annoying', 'terrible', 'awful', 'hate', 'worst', 'broken', 'useless', 'disappointed', 'fed up', 'sick of', 'can\'t stand'],
                'phrases': ['doesn\'t work', 'waste of time', 'so annoying', 'driving me crazy', 'had enough'],
                'intensity_multiplier': 1.0
            },
            'excitement': {
                'words': ['amazing', 'awesome', 'incredible', 'fantastic', 'love', 'brilliant', 'perfect', 'outstanding', 'exceptional', 'thrilled', 'excited'],
                'phrases': ['game changer', 'life saver', 'best thing ever', 'can\'t believe', 'so happy'],
                'intensity_multiplier': 0.9
            },
            'relief': {
                'words': ['finally', 'relief', 'solved', 'fixed', 'working', 'better', 'thankful', 'grateful'],
                'phrases': ['thank god', 'about time', 'so glad', 'finally works', 'what a relief'],
                'intensity_multiplier': 0.8
            },
            'anxiety': {
                'words': ['worried', 'scared', 'nervous', 'anxious', 'concerned', 'afraid', 'unsure', 'hesitant'],
                'phrases': ['not sure', 'what if', 'hope it works', 'fingers crossed', 'bit worried'],
                'intensity_multiplier': 0.7
            },
            'pride': {
                'words': ['proud', 'accomplished', 'achieved', 'successful', 'impressed', 'satisfied'],
                'phrases': ['so proud', 'really happy with', 'great results', 'exceeded expectations'],
                'intensity_multiplier': 0.8
            },
            'desperation': {
                'words': ['desperate', 'help', 'struggling', 'need', 'stuck', 'lost', 'confused'],
                'phrases': ['please help', 'don\'t know what to do', 'running out of options', 'at my wit\'s end'],
                'intensity_multiplier': 1.1
            }
        }
        
        # Psychological trigger patterns
        psychological_triggers = {
            'social_proof': ['everyone', 'most people', 'all my friends', 'colleagues', 'team'],
            'authority': ['expert', 'professional', 'recommended', 'approved', 'certified'],
            'scarcity': ['limited', 'exclusive', 'rare', 'only', 'last chance'],
            'loss_aversion': ['losing', 'missing out', 'behind', 'competitor', 'falling behind'],
            'achievement': ['success', 'win', 'accomplish', 'achieve', 'goal', 'milestone'],
            'belonging': ['community', 'team', 'group', 'together', 'part of', 'belong'],
            'autonomy': ['control', 'freedom', 'choice', 'independent', 'my way', 'customize'],
            'security': ['safe', 'secure', 'protected', 'reliable', 'stable', 'guarantee']
        }
        
        for comment in comments:
            text = comment['text'].lower()
            original_text = comment['text']
            
            # Calculate emotional intensity
            emotion_scores = {}
            for emotion, patterns in emotion_patterns.items():
                score = 0
                
                # Check individual words
                for word in patterns['words']:
                    if word in text:
                        score += 1
                
                # Check phrases (higher weight)
                for phrase in patterns['phrases']:
                    if phrase in text:
                        score += 2
                
                if score > 0:
                    emotion_scores[emotion] = score * patterns['intensity_multiplier']
            
            # Skip comments without emotional content
            if not emotion_scores:
                continue
            
            # Get dominant emotion
            dominant_emotion = max(emotion_scores.items(), key=lambda x: x[1])
            emotion_type = dominant_emotion[0]
            emotional_intensity = min(1.0, dominant_emotion[1] / 5.0)  # Normalize to 0-1
            
            # Calculate marketing potential
            marketing_score = 0
            
            # Length bonus (longer quotes often more compelling)
            if len(original_text) > 80:
                marketing_score += 0.3
            elif len(original_text) > 50:
                marketing_score += 0.2
            
            # Engagement bonus
            engagement_score = (comment['likes'] + comment['replies'] * 2) / 100
            marketing_score += min(0.3, engagement_score)
            
            # Emotional intensity bonus
            marketing_score += emotional_intensity * 0.4
            
            # Identify psychological triggers
            detected_triggers = []
            for trigger, keywords in psychological_triggers.items():
                if any(keyword in text for keyword in keywords):
                    detected_triggers.append(trigger)
                    marketing_score += 0.1
            
            primary_trigger = detected_triggers[0] if detected_triggers else 'none'
            
            # Determine marketing potential category
            if marketing_score >= 0.7:
                marketing_potential = 'high'
            elif marketing_score >= 0.4:
                marketing_potential = 'medium'
            else:
                marketing_potential = 'low'
            
            # Create emotional quote object
            quote = EmotionalQuote(
                quote_text=original_text,
                emotion_type=emotion_type,
                emotional_intensity=emotional_intensity,
                context=f"YouTube comment on '{comment.get('video_title', 'video')}'",
                commenter=comment['commenter'],
                engagement_score=engagement_score,
                marketing_potential=marketing_potential,
                psychological_trigger=primary_trigger,
                source_video=comment.get('video_url', ''),
                keyword_context=comment.get('keyword_phrase', '')
            )
            
            emotional_quotes.append(asdict(quote))
        
        # Sort by marketing potential and emotional intensity
        emotional_quotes.sort(
            key=lambda x: (
                {'high': 3, 'medium': 2, 'low': 1}[x['marketing_potential']] * 0.6 +
                x['emotional_intensity'] * 0.4
            ),
            reverse=True
        )
        
        # Return top quotes up to max_quotes limit
        selected_quotes = emotional_quotes[:max_quotes]
        
        logger.info(f"Extracted {len(selected_quotes)} emotional quotes from {len(comments)} comments")
        if selected_quotes:
            high_potential = sum(1 for q in selected_quotes if q['marketing_potential'] == 'high')
            logger.info(f"High marketing potential quotes: {high_potential}/{len(selected_quotes)}")
        
        return selected_quotes
    
    def scrape_comments_for_keywords(self, keyword_list: List[str], 
                                   total_limit: int = 50) -> ScrapingResult:
        """Main function to scrape comments for multiple keywords"""
        logger.info(f"Starting comment scraping for {len(keyword_list)} keywords")
        logger.info(f"Target: {total_limit} total comments")
        
        start_time = datetime.now(timezone.utc)
        all_comments = []
        videos_analyzed = 0
        comments_per_keyword = {}
        
        # Distribute comment quota across keywords
        comments_per_keyword_target = max(1, total_limit // len(keyword_list))
        
        for i, keyword in enumerate(keyword_list):
            if len(all_comments) >= total_limit:
                logger.info(f"Reached total comment limit of {total_limit}")
                break
            
            logger.info(f"Processing keyword {i+1}/{len(keyword_list)}: '{keyword}'")
            keyword_comments = []
            
            # Search for videos
            videos = self.search_videos_by_keyword(keyword, max_results=3)
            
            for video in videos:
                if len(all_comments) >= total_limit:
                    break
                
                video_id = video['video_id']
                video_title = video['title']
                video_url = video['url']
                
                # Get comments from this video
                remaining_for_keyword = comments_per_keyword_target - len(keyword_comments)
                remaining_total = total_limit - len(all_comments)
                max_comments_this_video = min(20, remaining_for_keyword, remaining_total)
                
                if max_comments_this_video <= 0:
                    break
                
                raw_comments = self.get_video_comments(video_id, max_comments_this_video)
                videos_analyzed += 1
                
                # Add video info to comments and filter for relevance
                for comment in raw_comments:
                    comment['video_title'] = video_title
                    comment['video_url'] = video_url
                    comment['source_url'] = f"https://www.youtube.com/watch?v={video_id}&lc={comment['comment_id']}"
                
                # Filter for relevance
                relevant_comments = self.filter_relevant_comments(raw_comments, keyword)
                
                # Add to keyword comments
                keyword_comments.extend(relevant_comments)
                
                # Small delay between videos
                time.sleep(0.2)
            
            # Add keyword comments to total (up to limit)
            remaining_spots = total_limit - len(all_comments)
            if remaining_spots > 0:
                keyword_comments_to_add = keyword_comments[:remaining_spots]
                all_comments.extend(keyword_comments_to_add)
                comments_per_keyword[keyword] = len(keyword_comments_to_add)
            
            logger.info(f"Collected {len(keyword_comments)} comments for keyword '{keyword}'")
        
        # Calculate quality metrics
        total_filtered = len(all_comments)
        filter_ratio = total_filtered / max(1, sum(len(self.get_video_comments(v['video_id'], 5)) 
                                                  for kw in keyword_list 
                                                  for v in self.search_videos_by_keyword(kw, 1)))
        
        # Extract emotional quotes from all comments
        logger.info("Extracting emotionally resonant quotes for marketing use...")
        emotional_quotes = self.extract_emotional_quotes(all_comments, max_quotes=15)
        
        # Convert comments to proper format
        formatted_comments = []
        for comment in all_comments:
            formatted_comment = Comment(
                comment_id=comment['comment_id'],
                text=comment['text'],
                commenter=comment['commenter'],
                date=comment['date'],
                video_title=comment['video_title'],
                video_url=comment['video_url'],
                keyword_phrase=comment['keyword_phrase'],
                relevance_score=comment['relevance_score'],
                likes=comment['likes'],
                replies=comment['replies'],
                source_url=comment['source_url']
            )
            formatted_comments.append(asdict(formatted_comment))
        
        # Create result object
        result = ScrapingResult(
            source="youtube_comments",
            scrape_date=start_time.isoformat(),
            total_comments=len(formatted_comments),
            keywords_searched=keyword_list,
            comments=formatted_comments,
            emotional_quotes=emotional_quotes,
            data_quality={
                "api_quota_used": self.quota_manager.quota_used,
                "videos_analyzed": videos_analyzed,
                "comment_filter_ratio": round(filter_ratio, 3),
                "comments_per_keyword": comments_per_keyword,
                "emotional_quotes_extracted": len(emotional_quotes),
                "high_potential_quotes": sum(1 for q in emotional_quotes if q['marketing_potential'] == 'high'),
                "scraping_duration_seconds": (datetime.now(timezone.utc) - start_time).total_seconds()
            }
        )
        
        logger.info(f"Scraping completed. Collected {len(formatted_comments)} comments")
        logger.info(f"API quota used: {self.quota_manager.quota_used} units")
        
        return result
    
    def save_comments_data(self, data: ScrapingResult, filename: str):
        """Save scraped data to JSON file"""
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(asdict(data), f, indent=2, ensure_ascii=False)
            logger.info(f"Data saved to {filename}")
        except Exception as e:
            logger.error(f"Error saving data to {filename}: {e}")

def main():
    """Example usage of the YouTube comment scraper"""
    # Initialize scraper
    try:
        scraper = YouTubeCommentScraper()
    except ValueError as e:
        print(f"Error: {e}")
        print("Please set your YouTube API key:")
        print("export YOUTUBE_API_KEY='your_api_key_here'")
        return
    
    # Validate API key
    if not scraper.validate_api_key():
        print("API key validation failed. Please check your YouTube API key.")
        return
    
    # Example keywords for customer persona research
    keywords = [
        "customer service problems",
        "frustrated with software",
        "small business challenges"
    ]
    
    print("YouTube Comment Scraper for Customer Persona Generation")
    print("=" * 50)
    print(f"Keywords to search: {keywords}")
    print(f"Target comments: 50")
    print()
    
    # Scrape comments
    data = scraper.scrape_comments_for_keywords(keywords, total_limit=50)
    
    # Save results
    filename = f"youtube_comments_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    scraper.save_comments_data(data, filename)
    
    # Print summary
    print("\nScraping Results:")
    print(f"Total comments collected: {data.total_comments}")
    print(f"Videos analyzed: {data.data_quality['videos_analyzed']}")
    print(f"API quota used: {data.data_quality['api_quota_used']} units")
    print(f"Data saved to: {filename}")
    
    if data.comments:
        print(f"\nSample comment:")
        sample = data.comments[0]
        print(f"Text: {sample['text'][:100]}...")
        print(f"Relevance: {sample['relevance_score']:.2f}")
        print(f"Engagement: {sample['likes']} likes, {sample['replies']} replies")

if __name__ == "__main__":
    main()