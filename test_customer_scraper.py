#!/usr/bin/env python3
"""
Test script for Customer Site Scraper
Tests the scraper with sample URLs and validates output format

Usage: python test_customer_scraper.py
"""

import json
import sys
from customer_site_scraper import CustomerSiteScraper
from integrate_customer_scraper import CustomerSiteIntegrator

def test_scraper():
    """Test the customer site scraper with sample URLs."""
    
    # Test URLs (replace with actual customer sites for real testing)
    test_urls = [
        "https://httpbin.org/html",  # Simple HTML for testing
        "https://example.com",        # Basic site
    ]
    
    print("🧪 Testing Customer Site Scraper")
    print("=" * 50)
    
    scraper = CustomerSiteScraper()
    integrator = CustomerSiteIntegrator()
    
    for i, url in enumerate(test_urls, 1):
        print(f"\n📍 Test {i}: {url}")
        print("-" * 30)
        
        try:
            # Test basic scraping
            scraped_data = scraper.scrape_customer_site(url)
            
            # Validate data
            validation = scraper.validate_scraped_data(scraped_data)
            
            # Test integration
            foundation_data = integrator.convert_to_foundation_format(
                scraped_data, f"test_job_{i}", "test keywords"
            )
            
            # Print results
            print(f"✅ Scraping successful: {scraped_data['data_quality']['scrape_successful']}")
            print(f"📊 Reviews found: {scraped_data['total_reviews']}")
            print(f"🏢 Products found: {len(scraped_data['products'])}")
            print(f"📈 Quality score: {validation['quality_score']}/100")
            print(f"🔗 Pages scraped: {scraped_data['data_quality']['pages_scraped']}")
            
            # Check integration format
            print(f"🔄 Integration format valid: {isinstance(foundation_data, dict)}")
            print(f"📋 Foundation reviews: {foundation_data['review_count']}")
            
            if validation['warnings']:
                print("⚠️  Warnings:")
                for warning in validation['warnings']:
                    print(f"   - {warning}")
            
            # Save test output
            test_filename = f"test_output_{i}.json"
            scraper.save_scraped_data(scraped_data, test_filename)
            print(f"💾 Test data saved to: {test_filename}")
            
        except Exception as e:
            print(f"❌ Test failed: {str(e)}")
            continue
    
    print(f"\n🎉 Testing complete!")

def test_specific_url(url: str):
    """Test scraper with a specific URL provided by user."""
    print(f"🎯 Testing specific URL: {url}")
    print("=" * 50)
    
    try:
        integrator = CustomerSiteIntegrator()
        foundation_data = integrator.scrape_and_integrate(url, "test_specific", "test keywords")
        
        # Save test results
        output_file = "test_specific_output.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(foundation_data, f, indent=2, ensure_ascii=False)
        
        print(f"\n📋 Test Results Summary:")
        print(f"   Reviews: {foundation_data['review_count']}")
        print(f"   Products: {len(foundation_data['products'])}")
        print(f"   Quality: {foundation_data['data_quality']['confidence_level']}")
        print(f"   Output: {output_file}")
        
        return foundation_data
        
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return None

def validate_output_format(data: dict):
    """Validate that output matches expected Demographics Foundation format."""
    print("\n🔍 Validating output format...")
    
    required_fields = [
        "source_type", "source_url", "reviews", "review_count",
        "analysis", "data_quality", "metadata"
    ]
    
    missing_fields = []
    for field in required_fields:
        if field not in data:
            missing_fields.append(field)
    
    if missing_fields:
        print(f"❌ Missing required fields: {missing_fields}")
        return False
    
    # Validate review format
    if data["reviews"]:
        sample_review = data["reviews"][0]
        review_required = ["review_id", "text", "source_url"]
        
        missing_review_fields = []
        for field in review_required:
            if field not in sample_review:
                missing_review_fields.append(field)
        
        if missing_review_fields:
            print(f"❌ Missing review fields: {missing_review_fields}")
            return False
    
    print("✅ Output format validation passed!")
    return True

def main():
    """Main test function."""
    if len(sys.argv) > 1:
        # Test specific URL if provided
        test_url = sys.argv[1]
        result = test_specific_url(test_url)
        
        if result:
            validate_output_format(result)
    else:
        # Run general tests
        test_scraper()

if __name__ == "__main__":
    main()