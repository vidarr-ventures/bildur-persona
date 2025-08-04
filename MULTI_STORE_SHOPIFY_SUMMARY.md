# Multi-Store Shopify Scraper Implementation

## Overview

Successfully extended the existing Shopify scraper to handle customer + competitor URL scraping with Demographics Foundation integration.

## Key Features ✅

### 1. Multi-Store Scraping
- **Customer Store**: Primary business being analyzed
- **Competitor Stores**: Multiple competing Shopify stores
- **Separate JSON Files**: Each competitor gets individual output file
- **Clean Review IDs**: R001, R002 format (no extraction method revealed)
- **Competitor Prefixes**: C1-R001, C2-R001 for competitor reviews

### 2. API-First Approach
- **Judge.me API**: Tries authenticated endpoints first
- **Shopify Product API**: Native Shopify review system
- **Yotpo API**: Popular review platform integration  
- **Selenium Fallback**: Guaranteed data extraction for JavaScript-rendered content

### 3. Demographics Foundation Integration
- **Multi-Store Format**: Combines customer + competitor data
- **Quote Attribution**: [R001], [C1-R001] format for referencing reviews
- **Data Validation**: Minimum review count tracking
- **Quality Metrics**: Confidence levels, verification rates, review quality assessment

## Usage Examples

### Single Store (Backward Compatible)
```bash
python integrate_shopify_scraper.py https://groundluxe.com job_123 "grounding sheets, wellness"
```

### Multi-Store with Competitors
```bash
python integrate_shopify_scraper.py https://groundluxe.com job_123 "grounding sheets" https://competitor1.com https://competitor2.com
```

## File Structure

### Core Files
- `shopify_review_scraper.py` - Main scraper with multi-store capabilities
- `integrate_shopify_scraper.py` - Demographics Foundation integration
- `demo_multi_store_pipeline.py` - Complete pipeline demonstration

### Output Files
- `competitor_1_reviews.json` - Individual competitor data
- `competitor_2_reviews.json` - Individual competitor data  
- `pipeline_data/shopify_store_{job_id}.json` - Foundation-formatted data
- `debug_data/` - Raw scraping data for troubleshooting

## Data Flow

```
Customer URL + Competitor URLs
           ↓
Multi-Store Scraper (API → Selenium)
           ↓
Individual Competitor JSON Files
           ↓
Demographics Foundation Format
           ↓
Ready for Persona Analysis
```

## Review ID System

- **Customer Reviews**: R001, R002, R003...
- **Competitor 1 Reviews**: C1-R001, C1-R002, C1-R003...
- **Competitor 2 Reviews**: C2-R001, C2-R002, C2-R003...

This allows clear attribution in Demographics Foundation analysis while keeping extraction methods private.

## Quality Metrics

### Confidence Levels
- **High**: 50+ reviews, 80%+ successful scrapes
- **Medium**: 20+ reviews, 60%+ successful scrapes  
- **Low**: 10+ reviews
- **Very Low**: <10 reviews

### Data Quality Tracking
- API attempt success/failure rates
- Extraction method per store
- Review verification rates
- Geographic scope assessment

## Integration with Demographics Foundation

The multi-store data seamlessly integrates with the existing Demographics Foundation prompt system:

1. **Customer Analysis**: Primary business review analysis
2. **Competitive Intelligence**: Competitor review insights
3. **Market Positioning**: Cross-brand comparison data
4. **Value Proposition Extraction**: Customer vs competitor strengths

## Testing Results

- ✅ Command-line argument parsing
- ✅ Multi-store data structure creation
- ✅ Competitor review ID formatting (C1-R001, C2-R001)
- ✅ Demographics Foundation integration
- ✅ Pipeline data format compatibility
- ✅ Backward compatibility with single-store usage

## Demo Output

Run `python3 demo_multi_store_pipeline.py` to see:
- 52 total reviews (22 customer + 30 competitor)
- Multi-store Demographics Foundation formatting
- Quality metrics and insights
- Ready-to-use pipeline data

The implementation is production-ready and maintains full backward compatibility while adding powerful competitive analysis capabilities.