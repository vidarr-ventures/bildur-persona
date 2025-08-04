"""
Integration script for Shopify Review Scraper with Demographics Foundation prompt
Converts scraped Shopify review data into format compatible with persona analysis pipeline

Author: Customer Persona Pipeline
"""

import json
import sys
import os
from pathlib import Path
from typing import Dict, List, Any, Optional
from shopify_review_scraper import ShopifyReviewScraper
from datetime import datetime

class ShopifyIntegrator:
    """
    Integrates Shopify review scraping with Demographics Foundation prompt system.
    Converts scraped data into format expected by the persona analysis pipeline.
    """
    
    def __init__(self, tier: str = "basic"):
        """
        Initialize the Shopify integrator.
        
        Args:
            tier: Persona offering tier ("basic", "premium", "enterprise", "pro")
        """
        self.tier = tier
        self.scraper = ShopifyReviewScraper(tier=tier)
    
    def scrape_and_integrate(self, shopify_url: str, job_id: str, keywords: str = "", competitor_urls: List[str] = None) -> Dict[str, Any]:
        """
        Scrape Shopify store and competitors, format for Demographics Foundation analysis.
        
        Args:
            shopify_url: Primary Shopify store URL
            job_id: Job identifier for tracking
            keywords: Target keywords for analysis
            competitor_urls: List of competitor Shopify store URLs
            
        Returns:
            Dictionary formatted for Demographics Foundation prompt
        """
        print(f"🛍️ Starting Shopify analysis for job {job_id}")
        print(f"📍 Customer URL: {shopify_url}")
        print(f"🎯 Keywords: {keywords}")
        if competitor_urls:
            print(f"🏆 Competitors: {len(competitor_urls)} stores")
        
        # Scrape customer and competitors
        if competitor_urls:
            scraped_data = self.scraper.scrape_customer_and_competitors(shopify_url, competitor_urls)
        else:
            # Single store scraping (backward compatibility)
            single_data = self.scraper.scrape_shopify_reviews(shopify_url)
            scraped_data = {
                "scrape_type": "single_store",
                "customer_data": single_data,
                "competitor_data": [],
                "total_customer_reviews": single_data["total_reviews"],
                "total_competitor_reviews": 0
            }
        
        # Convert to Demographics Foundation format
        foundation_data = self.convert_multi_store_to_foundation_format(scraped_data, job_id, keywords)
        
        # Save intermediate data for debugging
        self._save_debug_data(scraped_data, foundation_data, job_id)
        
        print(f"✅ Shopify analysis complete:")
        print(f"   📊 Customer reviews: {foundation_data['customer_review_count']}")
        print(f"   🏆 Competitor reviews: {foundation_data['competitor_review_count']}")
        print(f"   📈 Total reviews: {foundation_data['total_review_count']}")
        print(f"   🔧 Quality score: {self._calculate_quality_score(foundation_data)}/100")
        
        return foundation_data
    
    def convert_to_foundation_format(self, scraped_data: Dict[str, Any], job_id: str, keywords: str) -> Dict[str, Any]:
        """
        Convert scraped Shopify data to Demographics Foundation prompt format.
        
        Args:
            scraped_data: Raw scraped data from Shopify store
            job_id: Job identifier
            keywords: Target keywords
            
        Returns:
            Dictionary formatted for Demographics Foundation analysis
        """
        # Convert reviews to foundation format with clean attribution
        foundation_reviews = []
        for review in scraped_data.get("reviews", []):
            foundation_review = {
                "review_id": review["review_id"],  # Already in R001 format
                "text": review["text"],
                "title": f"Customer Review from {review.get('reviewer', 'Anonymous')}",
                "rating": review.get("rating"),
                "source_url": scraped_data["url"],
                "verified": review.get("verified", False),
                "date": review.get("date"),
                "metadata": {
                    "source": "shopify_store",
                    "shop_name": scraped_data["shop_name"],
                    "reviewer": review.get("reviewer"),
                    "extraction_method": scraped_data["scrape_method"]
                }
            }
            foundation_reviews.append(foundation_review)
        
        # Convert products to foundation format
        foundation_products = []
        for product in scraped_data.get("products", []):
            foundation_product = {
                "title": product["title"],
                "price": product.get("price"),
                "source": "shopify_store"
            }
            foundation_products.append(foundation_product)
        
        # Create the foundation data structure
        foundation_data = {
            "source_type": "customer_url",
            "source_url": scraped_data["url"],
            "scrape_timestamp": scraped_data["scrape_date"],
            "job_id": job_id,
            "target_keywords": keywords.split(",") if keywords else [],
            
            # Reviews in foundation format
            "reviews": foundation_reviews,
            "review_count": len(foundation_reviews),
            
            # Company information
            "company_info": {
                "name": scraped_data["shop_name"].replace("-", " ").title(),
                "description": f"Shopify store specializing in {', '.join(keywords.split(',')[:3]) if keywords else 'e-commerce products'}",
                "website": scraped_data["url"],
                "platform": "Shopify"
            },
            
            # Products
            "products": foundation_products,
            
            # Analysis metadata for prompt
            "analysis": {
                "total_reviews": len(foundation_reviews),
                "has_ratings": any(r.get("rating") for r in foundation_reviews),
                "has_dates": any(r.get("date") for r in foundation_reviews),
                "average_review_length": self._calculate_avg_review_length(foundation_reviews),
                "review_quality": self._assess_review_quality(foundation_reviews),
                "average_rating": self._calculate_avg_rating(foundation_reviews),
                "verified_purchase_rate": self._calculate_verified_rate(foundation_reviews),
                "value_propositions": self._extract_value_propositions(foundation_reviews),
                "features": self._extract_features(foundation_reviews),
                "brand_messaging": f"Premium {scraped_data['shop_name'].replace('-', ' ').title()} products"
            },
            
            # Data quality metrics
            "data_quality": {
                "scrape_successful": scraped_data["total_reviews"] > 0,
                "pages_scraped": 1,
                "reviews_found": len(foundation_reviews) > 0,
                "has_minimum_reviews": len(foundation_reviews) >= 20,
                "confidence_level": self._calculate_confidence_level(scraped_data),
                "extraction_method": scraped_data["scrape_method"],
                "geographic_scope": "Unknown (Shopify store)",
                "verification_rate": self._calculate_verified_rate(foundation_reviews),
                "api_attempts": scraped_data.get("data_quality", {}).get("api_attempts", [])
            },
            
            # Metadata for pipeline
            "metadata": {
                "pipeline_stage": "shopify_collection",
                "next_stage": "demographics_foundation", 
                "processing_notes": self._generate_processing_notes(scraped_data),
                "timestamp": datetime.now().isoformat(),
                "shop_name": scraped_data["shop_name"],
                "extraction_method": scraped_data["scrape_method"]
            }
        }
        
        return foundation_data
    
    def convert_multi_store_to_foundation_format(self, scraped_data: Dict[str, Any], job_id: str, keywords: str) -> Dict[str, Any]:
        """
        Convert multi-store scraped data (customer + competitors) to Demographics Foundation format.
        
        Args:
            scraped_data: Raw scraped data from customer and competitors
            job_id: Job identifier
            keywords: Target keywords
            
        Returns:
            Dictionary formatted for Demographics Foundation analysis including competitor data
        """
        customer_data = scraped_data.get("customer_data")
        competitor_data_list = scraped_data.get("competitor_data", [])
        
        # Convert customer reviews
        customer_reviews = []
        if customer_data and customer_data.get("reviews"):
            for review in customer_data["reviews"]:
                customer_reviews.append({
                    "review_id": review["review_id"],
                    "text": review["text"],
                    "title": f"Customer Review from {review.get('reviewer', 'Anonymous')}",
                    "rating": review.get("rating"),
                    "source_url": customer_data["url"],
                    "verified": review.get("verified", False),
                    "date": review.get("date"),
                    "metadata": {
                        "source": "customer_shopify_store",
                        "shop_name": customer_data["shop_name"],
                        "reviewer": review.get("reviewer"),
                        "extraction_method": customer_data["scrape_method"]
                    }
                })
        
        # Convert competitor reviews
        competitor_reviews = []
        competitor_sources = []
        
        for i, comp_data in enumerate(competitor_data_list, 1):
            if comp_data.get("reviews"):
                comp_source = {
                    "competitor_number": i,
                    "shop_name": comp_data["shop_name"],
                    "url": comp_data["url"],
                    "total_reviews": comp_data["total_reviews"],
                    "scrape_method": comp_data["scrape_method"]
                }
                competitor_sources.append(comp_source)
                
                for review in comp_data["reviews"]:
                    competitor_reviews.append({
                        "review_id": f"C{i}-{review['review_id']}",  # C1-R001, C2-R001, etc.
                        "text": review["text"],
                        "title": f"Competitor {i} Review from {review.get('reviewer', 'Anonymous')}",
                        "rating": review.get("rating"),
                        "source_url": comp_data["url"],
                        "verified": review.get("verified", False),
                        "date": review.get("date"),
                        "metadata": {
                            "source": "competitor_shopify_store",
                            "competitor_number": i,
                            "shop_name": comp_data["shop_name"],
                            "reviewer": review.get("reviewer"),
                            "extraction_method": comp_data["scrape_method"]
                        }
                    })
        
        # Combine all reviews
        all_reviews = customer_reviews + competitor_reviews
        
        # Convert products from customer and competitors
        all_products = []
        
        # Customer products
        if customer_data and customer_data.get("products"):
            for product in customer_data["products"]:
                all_products.append({
                    "title": product["title"],
                    "price": product.get("price"),
                    "source": "customer_store"
                })
        
        # Competitor products
        for i, comp_data in enumerate(competitor_data_list, 1):
            if comp_data.get("products"):
                for product in comp_data["products"]:
                    all_products.append({
                        "title": product["title"],
                        "price": product.get("price"),
                        "source": f"competitor_{i}"
                    })
        
        # Create comprehensive foundation data structure
        foundation_data = {
            "source_type": "customer_and_competitors",
            "source_url": customer_data["url"] if customer_data else "",
            "scrape_timestamp": scraped_data.get("scrape_date"),
            "job_id": job_id,
            "target_keywords": keywords.split(",") if keywords else [],
            
            # All reviews combined
            "reviews": all_reviews,
            "total_review_count": len(all_reviews),
            "customer_review_count": len(customer_reviews),
            "competitor_review_count": len(competitor_reviews),
            
            # Company information
            "company_info": {
                "name": customer_data["shop_name"].replace("-", " ").title() if customer_data else "Unknown",
                "description": f"Shopify store analysis including competitor research for {', '.join(keywords.split(',')[:3]) if keywords else 'e-commerce products'}",
                "website": customer_data["url"] if customer_data else "",
                "platform": "Shopify"
            },
            
            # Competitor information
            "competitor_info": competitor_sources,
            
            # Products from all sources
            "products": all_products,
            
            # Enhanced analysis metadata
            "analysis": {
                "total_reviews": len(all_reviews),
                "customer_reviews": len(customer_reviews),
                "competitor_reviews": len(competitor_reviews),
                "has_ratings": any(r.get("rating") for r in all_reviews),
                "has_dates": any(r.get("date") for r in all_reviews),
                "average_review_length": self._calculate_avg_review_length(all_reviews),
                "review_quality": self._assess_review_quality(all_reviews),
                "average_rating": self._calculate_avg_rating(all_reviews),
                "customer_avg_rating": self._calculate_avg_rating(customer_reviews),
                "competitor_avg_rating": self._calculate_avg_rating(competitor_reviews),
                "verified_purchase_rate": self._calculate_verified_rate(all_reviews),
                "value_propositions": self._extract_value_propositions(customer_reviews),
                "competitor_insights": self._extract_competitor_insights(competitor_reviews),
                "features": self._extract_features(all_reviews),
                "brand_messaging": f"Multi-store analysis: {customer_data['shop_name'].replace('-', ' ').title()} vs competitors" if customer_data else "Competitor analysis"
            },
            
            # Enhanced data quality metrics
            "data_quality": {
                "scrape_successful": len(all_reviews) > 0,
                "stores_scraped": scraped_data.get("summary", {}).get("stores_scraped", 1),
                "successful_scrapes": scraped_data.get("summary", {}).get("successful_scrapes", 0),
                "reviews_found": len(all_reviews) > 0,
                "has_minimum_reviews": len(all_reviews) >= 20,
                "customer_has_minimum": len(customer_reviews) >= 10,
                "confidence_level": self._calculate_multi_store_confidence_level(scraped_data),
                "extraction_methods": list(set([
                    customer_data.get("scrape_method", "") if customer_data else ""
                ] + [comp.get("scrape_method", "") for comp in competitor_data_list])),
                "geographic_scope": "Multi-store (Shopify)",
                "verification_rate": self._calculate_verified_rate(all_reviews)
            },
            
            # Enhanced metadata for pipeline
            "metadata": {
                "pipeline_stage": "multi_store_shopify_collection",
                "next_stage": "demographics_foundation",
                "processing_notes": self._generate_multi_store_processing_notes(scraped_data),
                "timestamp": datetime.now().isoformat(),
                "customer_shop": customer_data["shop_name"] if customer_data else "",
                "competitor_shops": [comp["shop_name"] for comp in competitor_data_list],
                "extraction_methods": {
                    "customer": customer_data.get("scrape_method") if customer_data else "",
                    "competitors": [comp.get("scrape_method", "") for comp in competitor_data_list]
                }
            }
        }
        
        return foundation_data
    
    def _extract_competitor_insights(self, competitor_reviews: List[Dict]) -> List[str]:
        """Extract insights from competitor reviews."""
        insights = []
        
        # Group by competitor
        competitor_groups = {}
        for review in competitor_reviews:
            comp_num = review.get("metadata", {}).get("competitor_number", 1)
            if comp_num not in competitor_groups:
                competitor_groups[comp_num] = []
            competitor_groups[comp_num].append(review)
        
        # Extract insights from each competitor
        for comp_num, reviews in competitor_groups.items():
            if reviews:
                avg_rating = self._calculate_avg_rating(reviews)
                review_count = len(reviews)
                
                if avg_rating:
                    insights.append(f"Competitor {comp_num}: {review_count} reviews, {avg_rating:.1f}/5 avg rating")
                else:
                    insights.append(f"Competitor {comp_num}: {review_count} reviews")
        
        return insights[:5]
    
    def _calculate_multi_store_confidence_level(self, scraped_data: Dict) -> str:
        """Calculate confidence level for multi-store data."""
        total_reviews = scraped_data.get("summary", {}).get("total_reviews", 0)
        successful_scrapes = scraped_data.get("summary", {}).get("successful_scrapes", 0)
        total_stores = scraped_data.get("summary", {}).get("stores_scraped", 1)
        
        success_rate = successful_scrapes / total_stores if total_stores > 0 else 0
        
        if total_reviews >= 50 and success_rate >= 0.8:
            return "high"
        elif total_reviews >= 20 and success_rate >= 0.6:
            return "medium"
        elif total_reviews >= 10:
            return "low"
        else:
            return "very_low"
    
    def _generate_multi_store_processing_notes(self, scraped_data: Dict) -> List[str]:
        """Generate processing notes for multi-store scraping."""
        notes = []
        
        customer_data = scraped_data.get("customer_data")
        competitor_data = scraped_data.get("competitor_data", [])
        summary = scraped_data.get("summary", {})
        
        if customer_data:
            notes.append(f"Customer store: {customer_data['shop_name']} ({customer_data['total_reviews']} reviews)")
            notes.append(f"Customer extraction method: {customer_data['scrape_method']}")
        
        if competitor_data:
            notes.append(f"Competitors analyzed: {len(competitor_data)} stores")
            for i, comp in enumerate(competitor_data, 1):
                notes.append(f"Competitor {i}: {comp['shop_name']} ({comp['total_reviews']} reviews)")
        
        notes.append(f"Total reviews collected: {summary.get('total_reviews', 0)}")
        notes.append(f"Successful scrapes: {summary.get('successful_scrapes', 0)}/{summary.get('stores_scraped', 1)}")
        
        if summary.get("total_reviews", 0) < 20:
            notes.append("WARNING: Below minimum recommended review count for reliable analysis")
        
        return notes
    
    def _calculate_avg_review_length(self, reviews: List[Dict]) -> float:
        """Calculate average review text length."""
        if not reviews:
            return 0.0
        
        total_length = sum(len(review.get("text", "")) for review in reviews)
        return total_length / len(reviews)
    
    def _calculate_avg_rating(self, reviews: List[Dict]) -> Optional[float]:
        """Calculate average rating."""
        ratings = [r.get("rating") for r in reviews if r.get("rating") is not None]
        if not ratings:
            return None
        
        return sum(ratings) / len(ratings)
    
    def _calculate_verified_rate(self, reviews: List[Dict]) -> float:
        """Calculate verified purchase rate."""
        if not reviews:
            return 0.0
        
        verified_count = sum(1 for r in reviews if r.get("verified", False))
        return verified_count / len(reviews)
    
    def _assess_review_quality(self, reviews: List[Dict]) -> str:
        """Assess overall quality of extracted reviews."""
        if not reviews:
            return "poor"
        
        avg_length = self._calculate_avg_review_length(reviews)
        has_ratings = any(r.get("rating") for r in reviews)
        has_reviewers = any(r.get("metadata", {}).get("reviewer") for r in reviews)
        
        if avg_length > 100 and has_ratings and has_reviewers:
            return "excellent"
        elif avg_length > 50 and (has_ratings or has_reviewers):
            return "good"
        elif avg_length > 30:
            return "fair"
        else:
            return "poor"
    
    def _extract_value_propositions(self, reviews: List[Dict]) -> List[str]:
        """Extract value propositions from review content."""
        value_props = []
        
        # Look for common value phrases in reviews
        for review in reviews[:10]:  # Check first 10 reviews
            text = review.get("text", "").lower()
            
            # Extract sentences that sound like value props
            sentences = text.split('.')
            for sentence in sentences:
                sentence = sentence.strip()
                if (len(sentence) > 20 and len(sentence) < 150 and 
                    any(word in sentence for word in ['quality', 'excellent', 'amazing', 'perfect', 'best', 'love', 'recommend'])):
                    value_props.append(sentence.capitalize())
                    
                if len(value_props) >= 5:
                    break
            
            if len(value_props) >= 5:
                break
        
        return value_props[:5]
    
    def _extract_features(self, reviews: List[Dict]) -> List[str]:
        """Extract product features mentioned in reviews."""
        features = []
        
        # Look for feature-related phrases
        feature_keywords = ['material', 'quality', 'design', 'size', 'color', 'comfort', 'easy', 'soft', 'durable']
        
        for review in reviews[:10]:
            text = review.get("text", "").lower()
            sentences = text.split('.')
            
            for sentence in sentences:
                sentence = sentence.strip()
                if (len(sentence) > 15 and len(sentence) < 100 and
                    any(keyword in sentence for keyword in feature_keywords)):
                    features.append(sentence.capitalize())
                    
                if len(features) >= 8:
                    break
                    
            if len(features) >= 8:
                break
        
        return features[:8]
    
    def _calculate_confidence_level(self, scraped_data: Dict) -> str:
        """Calculate confidence level based on data quality."""
        review_count = scraped_data.get("total_reviews", 0)
        method = scraped_data.get("scrape_method", "")
        
        if review_count >= 20 and method in ["judge.me_api", "yotpo_api"]:
            return "high"
        elif review_count >= 20 or method == "selenium":
            return "medium"
        elif review_count >= 10:
            return "low"
        else:
            return "very_low"
    
    def _calculate_quality_score(self, foundation_data: Dict) -> int:
        """Calculate overall quality score."""
        score = 0
        
        # Review count
        review_count = foundation_data.get("review_count", 0)
        if review_count >= 20:
            score += 40
        elif review_count >= 10:
            score += 25
        elif review_count > 0:
            score += 10
        
        # Has ratings
        if foundation_data.get("analysis", {}).get("has_ratings"):
            score += 20
        
        # Has dates
        if foundation_data.get("analysis", {}).get("has_dates"):
            score += 15
        
        # Review quality
        quality = foundation_data.get("analysis", {}).get("review_quality", "poor")
        if quality == "excellent":
            score += 25
        elif quality == "good":
            score += 15
        elif quality == "fair":
            score += 10
        
        return min(score, 100)
    
    def _generate_processing_notes(self, scraped_data: Dict) -> List[str]:
        """Generate processing notes for transparency."""
        notes = []
        
        notes.append(f"Scraped Shopify store: {scraped_data['shop_name']}")
        notes.append(f"Method used: {scraped_data['scrape_method']}")
        notes.append(f"Found {scraped_data['total_reviews']} reviews")
        
        api_attempts = scraped_data.get("data_quality", {}).get("api_attempts", [])
        if api_attempts:
            notes.append(f"API attempts: {', '.join(api_attempts)}")
        
        if scraped_data.get("total_reviews", 0) < 20:
            notes.append("WARNING: Below minimum recommended review count for reliable analysis")
        
        return notes
    
    def _save_debug_data(self, scraped_data: Dict, foundation_data: Dict, job_id: str):
        """Save debug data for troubleshooting."""
        debug_dir = Path("debug_data")
        debug_dir.mkdir(exist_ok=True)
        
        # Save raw scraped data
        with open(debug_dir / f"shopify_raw_{job_id}.json", "w", encoding="utf-8") as f:
            json.dump(scraped_data, f, indent=2, ensure_ascii=False)
        
        # Save foundation-formatted data
        with open(debug_dir / f"shopify_foundation_{job_id}.json", "w", encoding="utf-8") as f:
            json.dump(foundation_data, f, indent=2, ensure_ascii=False)
        
        print(f"🐛 Debug data saved to debug_data/ directory")
    
    def save_for_pipeline(self, foundation_data: Dict, job_id: str, output_dir: str = "pipeline_data") -> str:
        """
        Save data in format expected by pipeline.
        
        Args:
            foundation_data: Formatted data for pipeline
            job_id: Job identifier
            output_dir: Output directory for pipeline data
            
        Returns:
            Path to saved file
        """
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        filename = f"shopify_store_{job_id}.json"
        filepath = output_path / filename
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(foundation_data, f, indent=2, ensure_ascii=False)
        
        print(f"💾 Pipeline data saved to: {filepath}")
        return str(filepath)


def main():
    """Command line interface for Shopify store integration."""
    if len(sys.argv) < 3:
        print("Usage: python integrate_shopify_scraper.py <SHOPIFY_URL> <JOB_ID> [KEYWORDS] [--tier TIER] [COMPETITOR_URLS...]")
        print("")
        print("Arguments:")
        print("  SHOPIFY_URL     Shopify store URL to scrape")  
        print("  JOB_ID          Job identifier for tracking")
        print("  KEYWORDS        Target keywords (optional)")
        print("  --tier TIER     Persona tier: basic (20 reviews), premium/enterprise/pro (200 reviews)")
        print("  COMPETITOR_URLS Additional competitor Shopify store URLs")
        print("")
        print("Examples:")
        print("  Basic tier: python integrate_shopify_scraper.py https://groundluxe.com job_123 'grounding sheets'")
        print("  Premium tier: python integrate_shopify_scraper.py https://groundluxe.com job_123 'grounding sheets' --tier premium")
        print("  With competitors: python integrate_shopify_scraper.py https://groundluxe.com job_123 'grounding sheets' --tier enterprise https://competitor1.com https://competitor2.com")
        sys.exit(1)
    
    url = sys.argv[1]
    job_id = sys.argv[2]
    
    # Parse arguments for keywords, tier, and competitor URLs
    keywords = ""
    tier = "basic"  # Default tier
    competitor_urls = []
    
    # Process remaining arguments
    i = 3
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == "--tier" and i + 1 < len(sys.argv):
            tier = sys.argv[i + 1].lower()
            i += 2
        elif arg.startswith("http"):
            # Competitor URL
            competitor_urls.append(arg)
            i += 1
        elif not keywords and not arg.startswith("--"):
            # First non-flag argument after job_id is keywords
            keywords = arg
            i += 1
        else:
            i += 1
    
    # Validate tier
    valid_tiers = ["basic", "premium", "enterprise", "pro"]
    if tier not in valid_tiers:
        print(f"❌ Invalid tier: {tier}. Valid options: {', '.join(valid_tiers)}")
        sys.exit(1)
    
    print(f"🎯 Tier: {tier.upper()} ({'20' if tier == 'basic' else '200'} reviews max per site)")
    if competitor_urls:
        print(f"🏆 Competitor URLs detected: {len(competitor_urls)} stores")
        for i, comp_url in enumerate(competitor_urls, 1):
            print(f"   Competitor {i}: {comp_url}")
    
    # Create integrator and process
    integrator = ShopifyIntegrator(tier=tier)
    
    try:
        # Scrape and integrate (with competitors if provided)
        foundation_data = integrator.scrape_and_integrate(url, job_id, keywords, competitor_urls)
        
        # Save for pipeline
        pipeline_file = integrator.save_for_pipeline(foundation_data, job_id)
        
        print(f"\n🎉 Shopify store integration complete!")
        print(f"📁 Pipeline data: {pipeline_file}")
        
        # Updated to handle both single and multi-store results
        if foundation_data.get('total_review_count'):  # Multi-store format
            print(f"📊 Total reviews extracted: {foundation_data['total_review_count']}")
            print(f"   👤 Customer reviews: {foundation_data['customer_review_count']}")
            print(f"   🏆 Competitor reviews: {foundation_data['competitor_review_count']}")
        else:  # Single store format
            print(f"📊 Reviews extracted: {foundation_data['review_count']}")
            
        print(f"🎯 Quality level: {foundation_data['data_quality']['confidence_level']}")
        
        # Handle extraction methods for multi-store
        if foundation_data.get('metadata', {}).get('extraction_methods'):
            methods = foundation_data['metadata']['extraction_methods']
            print(f"🔧 Customer method: {methods.get('customer', 'N/A')}")
            if methods.get('competitors'):
                print(f"🔧 Competitor methods: {', '.join(methods['competitors'])}")
        else:
            print(f"🔧 Method used: {foundation_data['metadata']['extraction_method']}")
        
        # Updated warning for multi-store
        total_reviews = foundation_data.get('total_review_count', foundation_data.get('review_count', 0))
        if total_reviews < 20:
            print("⚠️  Warning: Below minimum 20 reviews for reliable Demographics Foundation analysis")
        
    except Exception as e:
        print(f"❌ Error during integration: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()