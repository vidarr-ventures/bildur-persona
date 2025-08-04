# Customer Site Scraper Setup Guide

Free web scraper for customer websites using requests + BeautifulSoup. Extracts reviews, testimonials, and product information for Demographics Foundation analysis.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

Required packages:
- `requests>=2.31.0`
- `beautifulsoup4>=4.12.0` 
- `lxml>=4.9.0`

### 2. Basic Usage

```python
from customer_site_scraper import CustomerSiteScraper

# Create scraper instance
scraper = CustomerSiteScraper()

# Scrape a customer website
data = scraper.scrape_customer_site("https://customer-website.com")

# Save the results
scraper.save_scraped_data(data, "customer_data.json")
```

### 3. Integration with Demographics Foundation

```python
from integrate_customer_scraper import CustomerSiteIntegrator

# Create integrator
integrator = CustomerSiteIntegrator()

# Scrape and format for pipeline
foundation_data = integrator.scrape_and_integrate(
    "https://customer-website.com", 
    "job_123", 
    "health supplements, wellness"
)

# Save for pipeline processing
pipeline_file = integrator.save_for_pipeline(foundation_data, "job_123")
```

## 📋 Command Line Usage

### Test the scraper:
```bash
python test_customer_scraper.py https://example.com
```

### Run integration:
```bash
python integrate_customer_scraper.py https://customer-site.com job_123 "keywords"
```

## 📊 Data Output Format

The scraper outputs data compatible with your Demographics Foundation prompt:

```json
{
  "source_type": "customer_url",
  "source_url": "https://customer-site.com",
  "reviews": [
    {
      "review_id": "R001",
      "text": "Great product, highly recommend!",
      "rating": 5.0,
      "reviewer": "John D.",
      "date": "2024-01-15",
      "source_url": "https://customer-site.com"
    }
  ],
  "review_count": 25,
  "products": [
    {
      "title": "Product Name",
      "description": "Product description",
      "price": "$29.99"
    }
  ],
  "company_info": {
    "name": "Company Name",
    "description": "About us text"
  },
  "data_quality": {
    "confidence_level": "high",
    "has_minimum_reviews": true,
    "validation_score": 85
  }
}
```

## 🎯 What Gets Extracted

### Reviews & Testimonials:
- Customer review text
- Star ratings (when available)
- Reviewer names/initials
- Review dates
- Source URLs for attribution

### Product Information:
- Product titles
- Descriptions
- Pricing (when available)
- Product features

### Company Details:
- Company name
- About us information
- Brand messaging
- Contact information

### Data Quality Metrics:
- Number of reviews found
- Confidence levels
- Validation scores
- Processing notes

## ⚙️ Configuration Options

### Scraper Settings:
```python
# Custom delay between requests (respectful scraping)
scraper = CustomerSiteScraper(delay_between_requests=2.0)

# Custom selectors for specific site structures
scraper.review_selectors.append('.custom-review-class')
```

### Common Review Selectors:
The scraper tries multiple selectors to find reviews:
- `.review`, `.testimonial`, `.feedback`
- `[class*="review"]`, `[class*="testimonial"]`
- `.customer-review`, `.user-review`
- `blockquote`, `.quote`

## 🔧 Troubleshooting

### No Reviews Found:
1. Check if the site has a dedicated reviews/testimonials page
2. Inspect the HTML to identify custom review selectors
3. Add custom selectors to the scraper configuration

### Low Quality Score:
- Ensure reviews are substantial (>20 characters)
- Check for proper HTML structure
- Verify the site isn't blocking the scraper

### Integration Issues:
- Validate output format with `test_customer_scraper.py`
- Check debug data in `debug_data/` directory
- Review processing notes in the output

## 📁 File Structure

```
customer-persona-app/
├── customer_site_scraper.py      # Main scraper class
├── integrate_customer_scraper.py # Pipeline integration
├── test_customer_scraper.py      # Testing script
├── requirements.txt              # Python dependencies
├── debug_data/                   # Debug output (auto-created)
└── pipeline_data/                # Pipeline-ready data (auto-created)
```

## 🔗 Pipeline Integration

The scraped data integrates seamlessly with your existing Demographics Foundation prompt:

1. **Data Collection**: Scrapes customer website
2. **Format Conversion**: Converts to Demographics Foundation format
3. **Quality Validation**: Ensures minimum data requirements
4. **Attribution System**: Creates [R001] style quote references
5. **Pipeline Handoff**: Saves data for Demographics Foundation analysis

## 💡 Best Practices

1. **Respectful Scraping**: Built-in delays between requests
2. **Error Handling**: Graceful fallbacks for different site structures
3. **Data Validation**: Quality checks and confidence scoring
4. **Debug Support**: Comprehensive logging and debug output
5. **Format Compatibility**: Seamless integration with existing pipeline

## 🚨 Important Notes

- This is designed for scraping the customer's **own website**
- Most customer sites don't rate limit their own content
- Always respect robots.txt and terms of service
- Free alternative to paid scraping services
- Works best with sites that have structured review sections

## 🧪 Testing

Test with your customer sites:

```bash
# Test basic functionality
python test_customer_scraper.py

# Test specific customer site
python test_customer_scraper.py https://your-customer-site.com

# Test full pipeline integration
python integrate_customer_scraper.py https://customer-site.com test_job "keywords"
```

The scraper will create detailed logs and save debug data to help troubleshoot any issues.