"""
Integration script for Customer Site Scraper with Demographics Foundation prompt
Converts scraped customer website data into format compatible with persona analysis pipeline

Author: Customer Persona Pipeline
"""

import json
import sys
import os
from pathlib import Path
from typing import Dict, List, Any, Optional
from customer_site_scraper import CustomerSiteScraper
from datetime import datetime

class CustomerSiteIntegrator:
    """
    Integrates customer site scraping with Demographics Foundation prompt system.
    Converts scraped data into format expected by the persona analysis pipeline.
    """
    
    def __init__(self):
        self.scraper = CustomerSiteScraper()
    
    def scrape_and_integrate(self, customer_url: str, job_id: str, keywords: str = "") -> Dict[str, Any]:
        """
        Scrape customer website and format for Demographics Foundation analysis.
        
        Args:
            customer_url: Customer's website URL
            job_id: Job identifier for tracking
            keywords: Target keywords for analysis
            
        Returns:
            Dictionary formatted for Demographics Foundation prompt
        """
        print(f"🔍 Starting customer site analysis for job {job_id}")
        print(f"📍 Target URL: {customer_url}")
        print(f"🎯 Keywords: {keywords}")
        
        # Scrape the customer site
        scraped_data = self.scraper.scrape_customer_site(customer_url)
        
        # Validate the scraped data
        validation = self.scraper.validate_scraped_data(scraped_data)
        
        # Convert to Demographics Foundation format
        foundation_data = self.convert_to_foundation_format(scraped_data, job_id, keywords)
        
        # Add validation metrics
        foundation_data["data_quality"].update({
            "validation_score": validation["quality_score"],
            "validation_warnings": validation["warnings"],
            "validation_recommendations": validation["recommendations"]
        })
        
        # Save intermediate data for debugging
        self._save_debug_data(scraped_data, foundation_data, job_id)
        
        print(f"✅ Customer site analysis complete:")
        print(f"   📊 Reviews found: {foundation_data['review_count']}")
        print(f"   🏢 Products found: {len(foundation_data['products'])}")
        print(f"   📈 Quality score: {validation['quality_score']}/100")
        
        return foundation_data
    
    def convert_to_foundation_format(self, scraped_data: Dict[str, Any], job_id: str, keywords: str) -> Dict[str, Any]:
        """
        Convert scraped data to Demographics Foundation prompt format.
        
        Args:
            scraped_data: Raw scraped data from customer site
            job_id: Job identifier
            keywords: Target keywords
            
        Returns:
            Dictionary formatted for Demographics Foundation analysis
        """
        # Convert reviews to foundation format with proper attribution
        foundation_reviews = []
        for i, review in enumerate(scraped_data.get("reviews", []), 1):
            foundation_review = {
                "review_id": f"R{i:03d}",
                "text": review["text"],
                "title": review.get("reviewer", f"Customer Review {i}"),
                "rating": self._parse_rating(review.get("rating")),
                "source_url": review["source_url"],
                "verified": False,  # Customer site reviews are not verified purchases
                "date": review.get("date"),
                "metadata": {
                    "source": "customer_website",
                    "reviewer": review.get("reviewer"),
                    "original_rating": review.get("rating")
                }
            }
            foundation_reviews.append(foundation_review)
        
        # Convert products to foundation format
        foundation_products = []
        for product in scraped_data.get("products", []):
            foundation_product = {
                "title": product["title"],
                "description": product["description"],
                "price": product.get("price"),
                "source": "customer_website"
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
            "company_info": scraped_data.get("company_info", {}),
            
            # Products
            "products": foundation_products,
            
            # Analysis metadata for prompt
            "analysis": {
                "total_reviews": len(foundation_reviews),
                "has_ratings": any(r.get("rating") for r in foundation_reviews),
                "has_dates": any(r.get("date") for r in foundation_reviews),
                "average_review_length": self._calculate_avg_review_length(foundation_reviews),
                "review_quality": self._assess_review_quality(foundation_reviews),
                "value_propositions": self._extract_value_propositions(scraped_data),
                "features": self._extract_features(scraped_data),
                "brand_messaging": scraped_data.get("company_info", {}).get("description", "")
            },
            
            # Data quality metrics
            "data_quality": {
                "scrape_successful": scraped_data.get("data_quality", {}).get("scrape_successful", False),
                "pages_scraped": scraped_data.get("data_quality", {}).get("pages_scraped", 0),
                "reviews_found": len(foundation_reviews) > 0,
                "has_minimum_reviews": len(foundation_reviews) >= 20,
                "confidence_level": self._calculate_confidence_level(scraped_data),
                "extraction_method": "beautifulsoup_scraper",
                "geographic_scope": "Unknown (customer website)",
                "verification_rate": 0.0  # Customer site reviews are not verified
            },
            
            # Metadata for pipeline
            "metadata": {
                "pipeline_stage": "customer_site_collection",
                "next_stage": "demographics_foundation",
                "processing_notes": self._generate_processing_notes(scraped_data),
                "timestamp": datetime.now().isoformat()
            }
        }
        
        return foundation_data
    
    def _parse_rating(self, rating_str: Optional[str]) -> Optional[float]:
        """Parse rating string to float value."""
        if not rating_str:
            return None
        
        try:
            # Extract numeric value from rating string
            import re
            match = re.search(r'(\d+(?:\.\d+)?)', str(rating_str))
            if match:
                return float(match.group(1))
        except:
            pass
        
        return None
    
    def _calculate_avg_review_length(self, reviews: List[Dict]) -> float:
        """Calculate average review text length."""
        if not reviews:
            return 0.0
        
        total_length = sum(len(review.get("text", "")) for review in reviews)
        return total_length / len(reviews)
    
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
    
    def _extract_value_propositions(self, scraped_data: Dict) -> List[str]:
        """Extract value propositions from scraped data."""
        value_props = []
        
        # From company description
        company_desc = scraped_data.get("company_info", {}).get("description", "")
        if company_desc:
            # Split into sentences and take meaningful ones
            sentences = [s.strip() for s in company_desc.split('.') if len(s.strip()) > 20]
            value_props.extend(sentences[:3])
        
        # From product titles/descriptions
        for product in scraped_data.get("products", []):
            if product.get("title"):
                value_props.append(product["title"])
        
        return value_props[:5]  # Limit to top 5
    
    def _extract_features(self, scraped_data: Dict) -> List[str]:
        """Extract features from scraped data."""
        features = []
        
        # From product descriptions
        for product in scraped_data.get("products", []):
            desc = product.get("description", "")
            if desc and len(desc) > 20:
                features.append(desc[:100] + "..." if len(desc) > 100 else desc)
        
        return features[:8]  # Limit to top 8
    
    def _calculate_confidence_level(self, scraped_data: Dict) -> str:
        """Calculate confidence level based on data quality."""
        review_count = scraped_data.get("total_reviews", 0)
        pages_scraped = scraped_data.get("data_quality", {}).get("pages_scraped", 0)
        
        if review_count >= 20 and pages_scraped > 1:
            return "high"
        elif review_count >= 10 or pages_scraped > 0:
            return "medium"
        else:
            return "low"
    
    def _generate_processing_notes(self, scraped_data: Dict) -> List[str]:
        """Generate processing notes for transparency."""
        notes = []
        
        data_quality = scraped_data.get("data_quality", {})
        
        notes.append(f"Scraped {data_quality.get('pages_scraped', 0)} pages")
        notes.append(f"Found {scraped_data.get('total_reviews', 0)} reviews")
        
        if data_quality.get("errors"):
            notes.append(f"Encountered {len(data_quality['errors'])} errors during scraping")
        
        if scraped_data.get("total_reviews", 0) < 20:
            notes.append("WARNING: Below minimum recommended review count for reliable analysis")
        
        return notes
    
    def _save_debug_data(self, scraped_data: Dict, foundation_data: Dict, job_id: str):
        """Save debug data for troubleshooting."""
        debug_dir = Path("debug_data")
        debug_dir.mkdir(exist_ok=True)
        
        # Save raw scraped data
        with open(debug_dir / f"raw_scraped_{job_id}.json", "w", encoding="utf-8") as f:
            json.dump(scraped_data, f, indent=2, ensure_ascii=False)
        
        # Save foundation-formatted data
        with open(debug_dir / f"foundation_formatted_{job_id}.json", "w", encoding="utf-8") as f:
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
        
        filename = f"customer_site_{job_id}.json"
        filepath = output_path / filename
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(foundation_data, f, indent=2, ensure_ascii=False)
        
        print(f"💾 Pipeline data saved to: {filepath}")
        return str(filepath)


def main():
    """Command line interface for customer site integration."""
    if len(sys.argv) < 3:
        print("Usage: python integrate_customer_scraper.py <URL> <JOB_ID> [KEYWORDS]")
        print("Example: python integrate_customer_scraper.py https://example.com job_123 'health supplements, wellness'")
        sys.exit(1)
    
    url = sys.argv[1]
    job_id = sys.argv[2]
    keywords = sys.argv[3] if len(sys.argv) > 3 else ""
    
    # Create integrator and process
    integrator = CustomerSiteIntegrator()
    
    try:
        # Scrape and integrate
        foundation_data = integrator.scrape_and_integrate(url, job_id, keywords)
        
        # Save for pipeline
        pipeline_file = integrator.save_for_pipeline(foundation_data, job_id)
        
        print(f"\n🎉 Customer site integration complete!")
        print(f"📁 Pipeline data: {pipeline_file}")
        print(f"📊 Reviews extracted: {foundation_data['review_count']}")
        print(f"🎯 Quality level: {foundation_data['data_quality']['confidence_level']}")
        
        if foundation_data['review_count'] < 20:
            print("⚠️  Warning: Below minimum 20 reviews for reliable Demographics Foundation analysis")
            print("💡 Consider checking if the site has dedicated review/testimonial pages")
        
    except Exception as e:
        print(f"❌ Error during integration: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()