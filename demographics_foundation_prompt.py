"""
Demographics Foundation Prompt Implementation
ICP Development Pipeline - Stage 1 of 9

This module implements the Demographics_Foundation prompt for analyzing customer review data
to create detailed demographic and psychographic profiles as the foundation for customer persona development.

CRITICAL REQUIREMENTS:
- Temperature: 0.1 for strict consistency
- Base ALL analysis exclusively on collected data
- Maximum 500 words per section
- Include confidence percentages for all major insights
- Quote attribution with systematic numbering [R001, R002, etc.]
- US market focus unless specified otherwise
- Minimum 20 reviews for reliable analysis

Author: ICP Pipeline
Temperature: 0.1
Max Output: 500 words per section
"""

import json
import logging
import os
import glob
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Set, Union
from dataclasses import dataclass, field
from datetime import datetime
import re
from urllib.parse import quote as url_encode

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class ReviewWithSource:
    """Review with source tracking for quote attribution"""
    review_id: str
    text: str
    title: str
    rating: float
    source_url: str
    source_type: str  # 'amazon', 'competitor', 'youtube', 'reddit', etc.
    platform_id: str  # 'Amazon', 'Competitor1', 'YouTube', 'Reddit', etc.
    verified: bool = False
    date: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class IntegratedDataSource:
    """Container for data from a specific source"""
    source_type: str  # 'customer_url', 'customer_amazon', 'competitor', 'youtube', 'reddit'
    source_url: str
    reviews: List[Dict[str, Any]]
    metadata: Dict[str, Any]
    data_quality: Dict[str, Any]
    
@dataclass
class ReviewData:
    """Structure for review data inputs with source tracking"""
    amazon_reviews: List[Dict[str, Any]]
    competitor_reviews: List[Dict[str, Any]]
    review_insights: Dict[str, Any]
    target_keywords: List[str]
    amazon_url: str
    primary_website: str
    competitor_products: List[Dict[str, Any]]
    review_sources: Dict[str, ReviewWithSource] = field(default_factory=dict)
    
    # Extended data sources
    customer_url_data: Optional[IntegratedDataSource] = None
    customer_amazon_data: Optional[IntegratedDataSource] = None
    competitor_data: List[IntegratedDataSource] = field(default_factory=list)
    youtube_data: Optional[IntegratedDataSource] = None
    reddit_data: Optional[IntegratedDataSource] = None

@dataclass
class DataQualityReport:
    """Data quality assessment results"""
    total_reviews: int
    has_minimum_reviews: bool
    missing_sources: List[str]
    geographic_coverage: str
    verification_rate: Optional[float]
    warnings: List[str]
    quality_score: float
    time_period_coverage: str

@dataclass 
class QuoteAttribution:
    """Track quote attribution for hyperlink generation"""
    quote_id: str  # R001, R002, etc.
    quote_text: str
    source_url: str
    review_id: str
    context: str

class DemographicsFoundationPrompt:
    """
    Implements the Demographics_Foundation prompt for ICP development pipeline.
    
    This is the first stage in a 9-prompt series that analyzes customer review data
    to build comprehensive customer personas with demographic and psychographic profiles.
    """
    
    PROMPT_TEMPLATE = """# Demographics_Foundation Prompt

**TEMPERATURE: 0.1**

**Objective**: Establish core customer demographics and deep psychographic insights based exclusively on collected data.

## Instructions

Using ONLY the collected review data, competitor analysis, and product context, create a detailed demographic and psychographic profile. Show your analytical reasoning process and assess data quality throughout.

## Analysis Process Required:

1. **Data Quality Assessment**: Review sample size, geographic coverage, verification rates
2. **Pattern Identification**: Note recurring themes in customer language and behavior  
3. **Evidence Weighting**: Prioritize insights with strongest data support
4. **Confidence Evaluation**: Assess reliability of each demographic inference

## Required Output Format:

### Data Quality Summary

- Total review count and verification percentage
- Geographic representation (US focus)
- Time period coverage of reviews
- Missing data sources disclosure

### Demographics Analysis (Max 500 words)

**Key Insights Summary:**
- Primary age range and generation (X% confidence)
- Gender distribution if evident (X% confidence)
- Income indicators from price sensitivity (X% confidence)
- Education level from language patterns (X% confidence)

#### Age Range and Generation

Based on language patterns, cultural references, and technology comfort levels evident in reviews. Quote specific examples with reference codes: "Example quote demonstrating generational indicator" [R001].

**Confidence Assessment**: X% confident based on [specific evidence type and volume]

#### Economic Demographics

Income and financial stability inferred from price sensitivity comments, purchase decision factors, and value perception language in reviews.

**Sample Supporting Evidence:**
- "Quote showing price sensitivity" [R002]
- "Quote showing quality vs. cost priority" [R003]

**Confidence Assessment**: X% confident based on [number] price-related review comments

### Psychographic Deep Dive (Max 500 words)

**Key Insights Summary:**
- Primary values driving decisions (X% confidence)
- Risk tolerance patterns (X% confidence)
- Life priorities and resource allocation (X% confidence)

#### Core Values and Attitudes

Extract values explicitly stated or strongly implied in review language. Focus on what customers say they prioritize.

**Evidence Examples:**
- "Quote revealing core values" [R004]  
- "Quote showing life priorities" [R005]

#### Hopes, Dreams, and Fears

Emotional drivers extracted from review explanations of motivations, desired outcomes, and concerns.

**Aspirational Language:**
- "Quote showing aspirations" [R006]

**Fear/Concern Indicators:**
- "Quote revealing anxieties" [R007]

### Contradictory Evidence Analysis

- Conflicting patterns identified in data
- Alternative interpretations considered
- Minority viewpoints that represent edge cases

### Summary for Pipeline

**Key Demographics**: [3-5 bullet points with confidence levels]
**Key Psychographics**: [3-5 bullet points with confidence levels]
**Data Gaps Identified**: [Areas needing more information]
**Confidence Ranges**: [Overall reliability assessment]

## Error Handling Requirements:

- If fewer than 20 reviews available, include warning: "WARNING: Sample size below recommended minimum (20 reviews). Insights should be considered preliminary."
- If any data sources are missing, state: "DATA LIMITATION: [Specific missing source] not available for analysis."
- If insufficient evidence for any insight, state: "Insufficient data in collected reviews to determine [specific category]."
- Include data confidence levels for each major insight based on supporting evidence volume.

## CUSTOMER PRODUCT DATA:

### Customer URL: 
{customer_url_data}

### Amazon Product Page:
{customer_amazon_data}

## COMPETITOR DATA:
{competitor_data}

## SOCIAL/COMMUNITY DATA:

### YouTube Comments:
{youtube_data}

### Reddit Discussions:
{reddit_data}

## TOTAL REVIEW COUNT: {total_review_count}

## Target Keywords: {target_keywords}
## Amazon Product URL: {amazon_url}
## Primary Website: {primary_website}
"""

    def __init__(self):
        """Initialize the Demographics Foundation Prompt processor"""
        self.minimum_reviews = 20
        self.required_confidence_fields = [
            'age_distribution_confidence',
            'income_analysis_confidence', 
            'geographic_analysis_confidence',
            'gender_analysis_confidence',
            'education_analysis_confidence'
        ]
        self.quote_attributions: Dict[str, QuoteAttribution] = {}
        self.review_id_counter = 0

    def validate_data_quality(self, review_data: ReviewData) -> DataQualityReport:
        """
        Validate data quality and generate quality assessment report.
        
        Args:
            review_data: ReviewData object containing all input data
            
        Returns:
            DataQualityReport with quality metrics and warnings
        """
        # Calculate total reviews from all sources
        total_reviews = (
            len(review_data.amazon_reviews) +
            len(review_data.competitor_reviews) +
            (len(review_data.customer_url_data.reviews) if review_data.customer_url_data else 0) +
            (len(review_data.customer_amazon_data.reviews) if review_data.customer_amazon_data else 0) +
            (len(review_data.youtube_data.reviews) if review_data.youtube_data else 0) +
            (len(review_data.reddit_data.reviews) if review_data.reddit_data else 0) +
            sum(len(cd.reviews) for cd in review_data.competitor_data)
        )
        
        warnings = []
        missing_sources = []
        
        # Check minimum review threshold
        has_minimum_reviews = total_reviews >= self.minimum_reviews
        if not has_minimum_reviews:
            warnings.append(f"WARNING: Sample size below recommended minimum (20 reviews). Insights should be considered preliminary. Current: {total_reviews} reviews.")
        
        # Check required data sources
        if not review_data.amazon_reviews and not review_data.customer_amazon_data:
            missing_sources.append("Amazon reviews")
            warnings.append("DATA LIMITATION: Amazon reviews not available for analysis.")
            
        if not review_data.competitor_reviews and not review_data.competitor_data:
            missing_sources.append("Competitor reviews")
            warnings.append("DATA LIMITATION: Competitor reviews not available for analysis.")
            
        if not review_data.youtube_data:
            missing_sources.append("YouTube comments")
            
        if not review_data.reddit_data:
            missing_sources.append("Reddit discussions")
            
        if not review_data.target_keywords:
            missing_sources.append("Target keywords")
            
        if not review_data.amazon_url:
            missing_sources.append("Amazon product URL")
            
        if not review_data.primary_website:
            missing_sources.append("Primary website")
        
        # Assess geographic coverage
        geographic_coverage = "United States (primary focus)"
        
        # Calculate verification rate from Amazon data
        verification_rate = None
        if review_data.customer_amazon_data and review_data.customer_amazon_data.metadata:
            verification_rate = review_data.customer_amazon_data.metadata.get('verified_purchase_rate')
        elif review_data.review_insights and 'verification_rate' in review_data.review_insights:
            verification_rate = review_data.review_insights['verification_rate']
        
        # Calculate quality score
        quality_score = self._calculate_quality_score(
            total_reviews, has_minimum_reviews, len(missing_sources), verification_rate
        )
        
        # Calculate time period coverage
        time_period_coverage = self._calculate_time_period_coverage(review_data)
        
        # Add source breakdown to warnings if helpful
        if total_reviews > 0:
            source_breakdown = []
            if review_data.customer_amazon_data:
                source_breakdown.append(f"Amazon: {len(review_data.customer_amazon_data.reviews)}")
            if review_data.competitor_data:
                comp_total = sum(len(cd.reviews) for cd in review_data.competitor_data)
                source_breakdown.append(f"Competitors: {comp_total}")
            if review_data.youtube_data:
                source_breakdown.append(f"YouTube: {len(review_data.youtube_data.reviews)}")
            if review_data.reddit_data:
                source_breakdown.append(f"Reddit: {len(review_data.reddit_data.reviews)}")
            
            logger.info(f"Review source breakdown: {', '.join(source_breakdown)}")
        
        return DataQualityReport(
            total_reviews=total_reviews,
            has_minimum_reviews=has_minimum_reviews,
            missing_sources=missing_sources,
            geographic_coverage=geographic_coverage,
            verification_rate=verification_rate,
            warnings=warnings,
            quality_score=quality_score,
            time_period_coverage=time_period_coverage
        )

    def _calculate_quality_score(self, total_reviews: int, has_minimum: bool, missing_count: int, verification_rate: Optional[float]) -> float:
        """Calculate overall data quality score (0-100)"""
        score = 100.0
        
        # Deduct for insufficient reviews
        if not has_minimum:
            score -= 30
        elif total_reviews < 50:
            score -= 15
            
        # Deduct for missing sources
        score -= missing_count * 10
        
        # Deduct for low verification rate
        if verification_rate is not None and verification_rate < 0.5:
            score -= 20
            
        return max(0.0, score)
    
    def _calculate_time_period_coverage(self, review_data: ReviewData) -> str:
        """Calculate the time period coverage of reviews"""
        # Extract dates from reviews if available
        dates = []
        for review in review_data.amazon_reviews + review_data.competitor_reviews:
            if 'date' in review and review['date']:
                dates.append(review['date'])
        
        if not dates:
            return "Date information not available"
        
        # Simple time period description
        return f"Reviews from {len(set(dates))} different time periods"

    def format_prompt_with_data(self, review_data: ReviewData, quality_report: DataQualityReport) -> str:
        """
        Format the Demographics Foundation prompt with actual review data.
        
        Args:
            review_data: ReviewData object containing all input data
            quality_report: DataQualityReport from validation
            
        Returns:
            Formatted prompt string ready for API submission
        """
        # Format data quality warnings
        warnings_text = ""
        if quality_report.warnings:
            warnings_text = "## ⚠️ Data Quality Warnings\n" + "\n".join([f"- {warning}" for warning in quality_report.warnings]) + "\n"
        
        # Use DataIntegrator to format integrated data
        integrator = DataIntegrator()
        
        # Format customer URL data
        customer_url_text = "No customer website data available."
        if review_data.customer_url_data:
            formatted, attrs = integrator.format_reviews_with_attribution(
                review_data.customer_url_data.reviews, 
                'customer_url', 
                'CustomerSite',
                1
            )
            customer_url_text = "\n".join(formatted)
            self.quote_attributions.update(attrs)
        
        # Format customer Amazon data
        customer_amazon_text = "No customer Amazon data available."
        start_idx = len(self.quote_attributions) + 1
        if review_data.customer_amazon_data:
            formatted, attrs = integrator.format_reviews_with_attribution(
                review_data.customer_amazon_data.reviews,
                'customer_amazon',
                'Amazon',
                start_idx
            )
            customer_amazon_text = "\n".join(formatted)
            self.quote_attributions.update(attrs)
        
        # Format competitor data
        competitor_data_text = "No competitor data available."
        if review_data.competitor_data:
            competitor_sections = []
            start_idx = len(self.quote_attributions) + 1
            
            for i, comp_data in enumerate(review_data.competitor_data[:5], 1):
                formatted, attrs = integrator.format_reviews_with_attribution(
                    comp_data.reviews,
                    'competitor',
                    f'Competitor{i}',
                    start_idx
                )
                competitor_sections.append(f"\n**Competitor {i}** ({comp_data.source_url}):\n" + "\n".join(formatted))
                self.quote_attributions.update(attrs)
                start_idx += len(formatted)
            
            competitor_data_text = "\n\n".join(competitor_sections)
        
        # Format YouTube data
        youtube_text = "No YouTube data available."
        if review_data.youtube_data:
            start_idx = len(self.quote_attributions) + 1
            formatted, attrs = integrator.format_reviews_with_attribution(
                review_data.youtube_data.reviews,
                'youtube',
                'YouTube',
                start_idx
            )
            youtube_text = "\n".join(formatted)
            self.quote_attributions.update(attrs)
        
        # Format Reddit data
        reddit_text = "No Reddit data available."
        if review_data.reddit_data:
            start_idx = len(self.quote_attributions) + 1
            formatted, attrs = integrator.format_reviews_with_attribution(
                review_data.reddit_data.reviews,
                'reddit',
                'Reddit',
                start_idx
            )
            reddit_text = "\n".join(formatted)
            self.quote_attributions.update(attrs)
        
        # Calculate total review count
        total_review_count = (
            len(review_data.amazon_reviews) +
            len(review_data.competitor_reviews) +
            (len(review_data.customer_url_data.reviews) if review_data.customer_url_data else 0) +
            (len(review_data.youtube_data.reviews) if review_data.youtube_data else 0) +
            (len(review_data.reddit_data.reviews) if review_data.reddit_data else 0) +
            sum(len(cd.reviews) for cd in review_data.competitor_data)
        )
        
        # Format the complete prompt
        formatted_prompt = self.PROMPT_TEMPLATE.format(
            review_count=len(review_data.amazon_reviews),
            competitor_count=len(review_data.competitor_products),
            verification_rate=quality_report.verification_rate or "Unknown",
            target_keywords=', '.join(review_data.target_keywords),
            geographic_scope=quality_report.geographic_coverage,
            time_period=quality_report.time_period_coverage,
            data_quality_warnings=warnings_text,
            customer_url_data=customer_url_text,
            customer_amazon_data=customer_amazon_text,
            competitor_data=competitor_data_text,
            youtube_data=youtube_text,
            reddit_data=reddit_text,
            total_review_count=total_review_count,
            amazon_url=review_data.amazon_url,
            primary_website=review_data.primary_website
        )
        
        logger.info(f"Formatted Demographics Foundation prompt with {total_review_count} total reviews")
        return formatted_prompt

    def _format_review_data(self, review_data: ReviewData) -> str:
        """Format review data for prompt inclusion with quote attribution tracking"""
        formatted_reviews = []
        self.quote_attributions.clear()  # Reset quote attributions
        
        # Process Amazon reviews
        for i, review in enumerate(review_data.amazon_reviews[:50], 1):  # Limit to 50 reviews for prompt size
            review_id = f"R{i:03d}"
            review_text = f"[{review_id}] **Amazon Review** (Rating: {review.get('rating', 'N/A')}/5): {review.get('title', '')} - {review.get('text', '')[:200]}..."
            formatted_reviews.append(review_text)
            
            # Track quote attribution
            source_url = f"{review_data.amazon_url}#review-{i}"
            self.quote_attributions[review_id] = QuoteAttribution(
                quote_id=review_id,
                quote_text=review.get('text', ''),
                source_url=source_url,
                review_id=str(i),
                context=f"Amazon review - {review.get('title', '')}"
            )
        
        # Process competitor reviews
        start_idx = len(formatted_reviews) + 1
        for i, review in enumerate(review_data.competitor_reviews[:50], start_idx):
            review_id = f"R{i:03d}"
            review_text = f"[{review_id}] **Competitor Review** (Rating: {review.get('rating', 'N/A')}/5): {review.get('title', '')} - {review.get('text', '')[:200]}..."
            formatted_reviews.append(review_text)
            
            # Track quote attribution
            competitor_source = review.get('source_url', 'competitor-product')
            source_url = f"{competitor_source}#review-{i-start_idx+1}"
            self.quote_attributions[review_id] = QuoteAttribution(
                quote_id=review_id,
                quote_text=review.get('text', ''),
                source_url=source_url,
                review_id=str(i),
                context=f"Competitor review - {review.get('title', '')}"
            )
        
        return "\n".join(formatted_reviews)

    def _format_competitor_data(self, competitor_products: List[Dict[str, Any]]) -> str:
        """Format competitor product data for analysis context"""
        if not competitor_products:
            return "No competitor product data available."
        
        formatted_products = []
        for product in competitor_products[:10]:  # Limit to 10 competitors
            product_info = f"""
**Product**: {product.get('title', 'Unknown')}
**Price**: ${product.get('price', 'Unknown')}
**Rating**: {product.get('rating', 'Unknown')}/5
**Review Count**: {product.get('review_count', 'Unknown')}
"""
            formatted_products.append(product_info)
        
        return "\n".join(formatted_products)

    def validate_response_format(self, response: str) -> Tuple[bool, List[str]]:
        """
        Validate that the AI response follows the required format.
        
        Args:
            response: AI-generated response string
            
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        # Check for required sections
        required_sections = [
            "### Data Quality Summary",
            "### Demographics Analysis",
            "#### Age Range and Generation", 
            "#### Economic Demographics",
            "### Psychographic Deep Dive",
            "#### Core Values and Attitudes",
            "#### Hopes, Dreams, and Fears",
            "### Contradictory Evidence Analysis",
            "### Summary for Pipeline"
        ]
        
        for section in required_sections:
            if section not in response:
                errors.append(f"Missing required section: {section}")
        
        # Check for confidence percentages
        confidence_pattern = r'Confidence.*?(\d+)%'
        confidence_matches = re.findall(confidence_pattern, response, re.IGNORECASE)
        
        if len(confidence_matches) < 5:
            errors.append(f"Missing confidence percentages. Found {len(confidence_matches)}, expected at least 5")
        
        # Check for quote references
        quote_pattern = r'\[R\d{3}\]'
        quote_matches = re.findall(quote_pattern, response)
        
        if len(quote_matches) < 5:
            errors.append(f"Insufficient quote references. Found {len(quote_matches)}, expected at least 5")
        
        # Check word count per section (approximately)
        sections = response.split('##')
        for i, section in enumerate(sections[1:], 1):  # Skip first empty section
            word_count = len(section.split())
            if word_count > 600:  # Allow some buffer over 500
                errors.append(f"Section {i} exceeds word limit: {word_count} words")
        
        is_valid = len(errors) == 0
        return is_valid, errors

    def extract_insights_for_pipeline(self, response: str) -> Dict[str, Any]:
        """
        Extract key insights from the response for handoff to next pipeline stage.
        
        Args:
            response: AI-generated response string
            
        Returns:
            Dictionary of extracted insights for Generational_Analysis stage
        """
        insights = {
            'stage': 'demographics_foundation',
            'timestamp': datetime.now().isoformat(),
            'confidence_scores': {},
            'demographic_clusters': [],
            'key_findings': [],
            'pipeline_handoff': {},
            'data_quality': {}
        }
        
        # Extract confidence scores
        confidence_pattern = r'(\w+.*?)Confidence.*?(\d+)%'
        confidence_matches = re.findall(confidence_pattern, response, re.IGNORECASE)
        
        for match in confidence_matches:
            field_name = match[0].strip().lower().replace(' ', '_')
            confidence_value = int(match[1])
            insights['confidence_scores'][field_name] = confidence_value
        
        # Extract demographic insights from Demographics Analysis section
        demographics_section = self._extract_section(response, "### Demographics Analysis")
        if demographics_section:
            demographic_bullets = re.findall(r'[•\-\*]\s*(.+)', demographics_section)
            insights['demographic_clusters'] = demographic_bullets[:5]  # Top 5 demographics
        
        # Extract psychographic insights
        psychographic_section = self._extract_section(response, "### Psychographic Deep Dive")
        if psychographic_section:
            psychographic_bullets = re.findall(r'[•\-\*]\s*(.+)', psychographic_section)
            insights['psychographic_insights'] = psychographic_bullets[:5]
        
        # Extract key findings for pipeline from Summary
        summary_section = self._extract_section(response, "### Summary for Pipeline")
        if summary_section:
            # Extract Key Demographics
            key_demo_match = re.search(r'\*\*Key Demographics\*\*:\s*((?:[•\-\*].+\n?)+)', summary_section)
            if key_demo_match:
                insights['key_demographics'] = re.findall(r'[•\-\*]\s*(.+)', key_demo_match.group(1))
            
            # Extract Key Psychographics
            key_psycho_match = re.search(r'\*\*Key Psychographics\*\*:\s*((?:[•\-\*].+\n?)+)', summary_section)
            if key_psycho_match:
                insights['key_psychographics'] = re.findall(r'[•\-\*]\s*(.+)', key_psycho_match.group(1))
            
            # Extract Data Gaps
            data_gaps_match = re.search(r'\*\*Data Gaps Identified\*\*:\s*((?:[•\-\*].+\n?)+)', summary_section)
            if data_gaps_match:
                insights['data_gaps'] = re.findall(r'[•\-\*]\s*(.+)', data_gaps_match.group(1))
        
        # Prepare handoff data for Generational Analysis
        insights['pipeline_handoff'] = {
            'next_stage': 'generational_analysis',
            'focus_areas': insights.get('key_demographics', [])[:3] + insights.get('key_psychographics', [])[:2],
            'high_confidence_insights': [
                k for k, v in insights['confidence_scores'].items() if v >= 70
            ],
            'requires_deeper_analysis': [
                k for k, v in insights['confidence_scores'].items() if v < 50
            ],
            'data_gaps': insights.get('data_gaps', [])
        }
        
        total_findings = len(insights.get('key_demographics', [])) + len(insights.get('key_psychographics', []))
        logger.info(f"Extracted insights for pipeline handoff: {total_findings} findings")
        return insights

    def _extract_section(self, response: str, section_header: str) -> Optional[str]:
        """Extract a specific section from the response"""
        pattern = rf'{re.escape(section_header)}(.*?)(?=##|\Z)'
        match = re.search(pattern, response, re.DOTALL)
        return match.group(1).strip() if match else None

    def process_full_pipeline(self, review_data: ReviewData) -> Dict[str, Any]:
        """
        Execute the complete Demographics Foundation analysis pipeline.
        
        Args:
            review_data: ReviewData object containing all input data
            
        Returns:
            Dictionary containing the formatted prompt, quality report, and extracted insights
        """
        logger.info("Starting Demographics Foundation analysis pipeline")
        
        # Step 1: Validate data quality
        quality_report = self.validate_data_quality(review_data)
        logger.info(f"Data quality assessment: {quality_report.quality_score}/100")
        
        # Step 2: Format prompt with data
        formatted_prompt = self.format_prompt_with_data(review_data, quality_report)
        
        # Step 3: Prepare for API submission
        api_payload = {
            'model': 'gpt-4',  # or preferred model
            'messages': [
                {
                    'role': 'system',
                    'content': 'You are an expert demographic analyst specializing in customer persona development. Follow the analysis framework exactly as specified.'
                },
                {
                    'role': 'user', 
                    'content': formatted_prompt
                }
            ],
            'temperature': 0.1,
            'max_tokens': 4000
        }
        
        # Step 4: Return pipeline results
        pipeline_result = {
            'stage': 'demographics_foundation',
            'prompt': formatted_prompt,
            'api_payload': api_payload,
            'quality_report': quality_report.__dict__,
            'ready_for_submission': quality_report.quality_score >= 50,
            'next_stage': 'generational_analysis',
            'timestamp': datetime.now().isoformat()
        }
        
        logger.info("Demographics Foundation pipeline processing complete")
        return pipeline_result
    
    def generate_quote_hyperlinks(self, response: str) -> str:
        """
        Replace quote references with hyperlinked versions.
        
        Args:
            response: AI-generated response with [R001] style references
            
        Returns:
            Response with hyperlinked quote references
        """
        def replace_reference(match):
            ref_code = match.group(0)
            ref_id = ref_code.strip('[]')
            
            if ref_id in self.quote_attributions:
                attribution = self.quote_attributions[ref_id]
                # Create markdown hyperlink
                return f"[{ref_code}]({attribution.source_url})"
            return ref_code
        
        # Replace all [R###] references with hyperlinks
        hyperlinked_response = re.sub(r'\[R\d{3}\]', replace_reference, response)
        return hyperlinked_response
    
    def get_quote_attribution_report(self) -> str:
        """Generate a report of all quote attributions for transparency"""
        report_lines = ["## Quote Attribution Report\n"]
        
        for ref_id, attribution in sorted(self.quote_attributions.items()):
            report_lines.append(f"**{ref_id}**: {attribution.context}")
            report_lines.append(f"  - Source: {attribution.source_url}")
            report_lines.append(f"  - Quote: \"{attribution.quote_text[:100]}...\"")
            report_lines.append("")
        
        return "\n".join(report_lines)

# Example usage and testing
if __name__ == "__main__":
    # Example data structure for testing
    sample_review_data = ReviewData(
        amazon_reviews=[
            {"title": "Great product", "text": "Love this for my morning routine", "rating": 5},
            {"title": "Works well", "text": "Been using for 6 months, helps with my arthritis", "rating": 4}
        ],
        competitor_reviews=[
            {"title": "Expensive but good", "text": "Worth the investment for quality", "rating": 4}
        ],
        review_insights={"verification_rate": 0.75},
        target_keywords=["pain relief", "natural supplement"],
        amazon_url="https://amazon.com/dp/B123456789",
        primary_website="https://example.com",
        competitor_products=[
            {"title": "Competitor A", "price": 29.99, "rating": 4.2, "review_count": 150}
        ]
    )
    
    # Initialize and run pipeline
    processor = DemographicsFoundationPrompt()
    result = processor.process_full_pipeline(sample_review_data)
    
    print(f"Pipeline Status: {'Ready' if result['ready_for_submission'] else 'Needs Attention'}")
    print(f"Data Quality Score: {result['quality_report']['quality_score']}")
    print(f"Total Reviews: {result['quality_report']['total_reviews']}")
    
    # Simulate response processing
    sample_response = """
### Data Quality Summary
- Total review count and verification percentage: 3 reviews, 75% verified
- Geographic representation (US focus): United States (primary focus)
- Time period coverage of reviews: Date information not available
- Missing data sources disclosure: None

### Demographics Analysis (Max 500 words)

**Key Insights Summary:**
- Primary age range and generation (65% confidence)
- Gender distribution if evident (45% confidence)
- Income indicators from price sensitivity (55% confidence)
- Education level from language patterns (60% confidence)

#### Age Range and Generation

Based on language patterns, I found "Been using for 6 months, helps with my arthritis" [R002].

**Confidence Assessment**: 65% confident based on arthritis mention and health concerns

#### Economic Demographics

Income indicators show "Worth the investment for quality" [R003].

**Confidence Assessment**: 55% confident based on 2 price-related review comments

### Summary for Pipeline

**Key Demographics**: 
- Age 45-65, health-conscious consumers (65% confidence)
- Middle to upper-middle income (55% confidence)

**Key Psychographics**: 
- Value quality over price (60% confidence)
- Health and wellness focused (70% confidence)
    """
    
    is_valid, errors = processor.validate_response_format(sample_response)
    print(f"Response Validation: {'Valid' if is_valid else 'Invalid'}")
    if errors:
        print("Validation Errors:", errors)
    
    # Test hyperlink generation
    hyperlinked_response = processor.generate_quote_hyperlinks(sample_response)
    print("\nHyperlinked Response Preview:")
    print(hyperlinked_response[:200] + "...")
    
    # Show quote attribution report
    print("\n" + processor.get_quote_attribution_report())


class DataIntegrator:
    """
    Handles discovery, loading, and integration of data from multiple sources
    for the Demographics Foundation prompt.
    """
    
    def __init__(self, base_path: Optional[str] = None):
        """
        Initialize the data integrator.
        
        Args:
            base_path: Base directory for data files. If None, uses current directory.
        """
        self.base_path = Path(base_path) if base_path else Path.cwd()
        self.data_formats = ['.json', '.csv', '.txt']
        self.source_mappings = {
            'amazon_reviews': 'customer_amazon',
            'website_data': 'customer_url',
            'youtube_comments': 'youtube',
            'reddit_data': 'reddit',
            'competitor_': 'competitor'
        }
        
    def discover_data_sources(self, job_id: str) -> Dict[str, List[Path]]:
        """
        Discover available data files for a specific job.
        
        Args:
            job_id: The job identifier to search for
            
        Returns:
            Dictionary mapping source types to list of file paths
        """
        discovered_sources = {
            'customer_url': [],
            'customer_amazon': [],
            'competitor': [],
            'youtube': [],
            'reddit': []
        }
        
        # Search patterns for different data sources
        search_patterns = [
            f"*{job_id}*.json",
            f"*{job_id}*.csv",
            f"job_{job_id}_*.json",
            f"{job_id}_*.json"
        ]
        
        for pattern in search_patterns:
            for file_path in self.base_path.rglob(pattern):
                file_str = str(file_path).lower()
                
                # Categorize files by source type
                for key, source_type in self.source_mappings.items():
                    if key in file_str:
                        if source_type == 'competitor':
                            discovered_sources['competitor'].append(file_path)
                        else:
                            discovered_sources[source_type].append(file_path)
                        break
        
        # Log discovered sources
        for source_type, files in discovered_sources.items():
            if files:
                logger.info(f"Discovered {len(files)} files for {source_type}")
                for file in files:
                    logger.debug(f"  - {file}")
                    
        return discovered_sources
    
    def load_json_data(self, file_path: Path) -> Optional[Dict[str, Any]]:
        """Load JSON data from file."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading JSON from {file_path}: {e}")
            return None
    
    def extract_reviews_from_source(self, data: Dict[str, Any], source_type: str) -> List[Dict[str, Any]]:
        """
        Extract reviews from a data source based on its structure.
        
        Args:
            data: Raw data from source
            source_type: Type of data source
            
        Returns:
            List of standardized review dictionaries
        """
        reviews = []
        
        if source_type == 'customer_amazon':
            # Handle Amazon review structure
            if 'reviews' in data:
                reviews = data['reviews']
            elif 'analysis' in data and 'reviews' in data['analysis']:
                reviews = data['analysis']['reviews']
                
        elif source_type == 'youtube':
            # Handle YouTube comment structure
            if 'comments' in data:
                reviews = [
                    {
                        'text': comment.get('text', ''),
                        'title': f"YouTube comment on {comment.get('video_title', 'video')}",
                        'rating': 0,  # YouTube doesn't have ratings
                        'author': comment.get('author', 'Anonymous'),
                        'likes': comment.get('likes', 0)
                    }
                    for comment in data.get('comments', [])
                ]
                
        elif source_type == 'reddit':
            # Handle Reddit post/comment structure
            if 'posts' in data:
                for post in data['posts']:
                    reviews.append({
                        'text': post.get('content', '') or post.get('selftext', ''),
                        'title': post.get('title', ''),
                        'rating': 0,  # Reddit doesn't have ratings
                        'score': post.get('score', 0),
                        'subreddit': post.get('subreddit', ''),
                        'url': post.get('url', '')
                    })
                    
        elif source_type == 'competitor':
            # Handle competitor review structure
            if 'reviews' in data:
                reviews = data['reviews']
            elif isinstance(data, list):
                reviews = data
                
        return reviews
    
    def integrate_all_sources(self, job_id: str, review_data: ReviewData) -> ReviewData:
        """
        Integrate all discovered data sources into the ReviewData object.
        
        Args:
            job_id: Job identifier
            review_data: Existing ReviewData object to enhance
            
        Returns:
            Enhanced ReviewData with integrated sources
        """
        discovered = self.discover_data_sources(job_id)
        total_reviews = 0
        
        # Process customer URL data
        if discovered['customer_url']:
            data = self.load_json_data(discovered['customer_url'][0])
            if data:
                reviews = self.extract_reviews_from_source(data, 'customer_url')
                review_data.customer_url_data = IntegratedDataSource(
                    source_type='customer_url',
                    source_url=review_data.primary_website,
                    reviews=reviews,
                    metadata=data.get('metadata', {}),
                    data_quality={'review_count': len(reviews)}
                )
                total_reviews += len(reviews)
        
        # Process customer Amazon data
        if discovered['customer_amazon'] or review_data.amazon_reviews:
            reviews = review_data.amazon_reviews
            if discovered['customer_amazon']:
                data = self.load_json_data(discovered['customer_amazon'][0])
                if data:
                    additional_reviews = self.extract_reviews_from_source(data, 'customer_amazon')
                    reviews.extend(additional_reviews)
            
            review_data.customer_amazon_data = IntegratedDataSource(
                source_type='customer_amazon',
                source_url=review_data.amazon_url,
                reviews=reviews,
                metadata={'verified_purchase_rate': review_data.review_insights.get('verification_rate', 0)},
                data_quality={'review_count': len(reviews), 'has_verified': True}
            )
            total_reviews += len(reviews)
        
        # Process competitor data
        competitor_counter = 1
        for comp_file in discovered['competitor'][:5]:  # Limit to 5 competitors
            data = self.load_json_data(comp_file)
            if data:
                reviews = self.extract_reviews_from_source(data, 'competitor')
                comp_url = data.get('url', f'Competitor{competitor_counter}')
                
                review_data.competitor_data.append(IntegratedDataSource(
                    source_type='competitor',
                    source_url=comp_url,
                    reviews=reviews,
                    metadata=data.get('metadata', {'competitor_id': f'Competitor{competitor_counter}'}),
                    data_quality={'review_count': len(reviews)}
                ))
                total_reviews += len(reviews)
                competitor_counter += 1
        
        # Process YouTube data
        if discovered['youtube']:
            data = self.load_json_data(discovered['youtube'][0])
            if data:
                reviews = self.extract_reviews_from_source(data, 'youtube')
                review_data.youtube_data = IntegratedDataSource(
                    source_type='youtube',
                    source_url='YouTube',
                    reviews=reviews,
                    metadata=data.get('metadata', {}),
                    data_quality={'comment_count': len(reviews)}
                )
                total_reviews += len(reviews)
        
        # Process Reddit data
        if discovered['reddit']:
            data = self.load_json_data(discovered['reddit'][0])
            if data:
                reviews = self.extract_reviews_from_source(data, 'reddit')
                review_data.reddit_data = IntegratedDataSource(
                    source_type='reddit',
                    source_url='Reddit',
                    reviews=reviews,
                    metadata=data.get('metadata', {}),
                    data_quality={'post_count': len(reviews)}
                )
                total_reviews += len(reviews)
        
        # Update total review count
        review_data.review_insights['total_integrated_reviews'] = total_reviews
        
        logger.info(f"Integrated {total_reviews} total reviews from all sources")
        return review_data
    
    def format_reviews_with_attribution(self, reviews: List[Dict[str, Any]], 
                                      source_type: str, platform_id: str,
                                      start_index: int = 1) -> Tuple[List[str], Dict[str, QuoteAttribution]]:
        """
        Format reviews with proper attribution codes.
        
        Args:
            reviews: List of review dictionaries
            source_type: Type of source (amazon, youtube, etc.)
            platform_id: Platform identifier for attribution
            start_index: Starting index for review numbering
            
        Returns:
            Tuple of (formatted review strings, attribution dictionary)
        """
        formatted_reviews = []
        attributions = {}
        
        for i, review in enumerate(reviews, start_index):
            review_id = f"R{i:03d}-{platform_id}"
            
            # Extract review text
            text = review.get('text', '') or review.get('content', '') or review.get('comment', '')
            title = review.get('title', '') or f"{platform_id} Review"
            rating = review.get('rating', 'N/A')
            
            # Format review string
            if source_type in ['youtube', 'reddit']:
                review_str = f"[{review_id}] **{platform_id}**: {title[:100]} - {text[:200]}..."
            else:
                review_str = f"[{review_id}] **{platform_id}** (Rating: {rating}/5): {title[:100]} - {text[:200]}..."
            
            formatted_reviews.append(review_str)
            
            # Create attribution
            source_url = review.get('url', '') or review.get('source_url', '') or f"{platform_id.lower()}.com"
            attributions[review_id] = QuoteAttribution(
                quote_id=review_id,
                quote_text=text,
                source_url=source_url,
                review_id=str(i),
                context=f"{platform_id} - {title}"
            )
        
        return formatted_reviews, attributions


def integrate_pipeline_data(job_id: str, base_review_data: ReviewData, data_path: Optional[str] = None) -> ReviewData:
    """
    Main function to integrate all pipeline data sources for Demographics Foundation analysis.
    
    Args:
        job_id: The job identifier to search for
        base_review_data: Basic ReviewData object with essential info
        data_path: Path to search for data files
        
    Returns:
        Enhanced ReviewData with all integrated sources
    """
    logger.info(f"Starting data integration for job {job_id}")
    
    # Initialize data integrator
    integrator = DataIntegrator(data_path)
    
    # Integrate all sources
    enhanced_data = integrator.integrate_all_sources(job_id, base_review_data)
    
    # Log integration summary
    sources_found = []
    if enhanced_data.customer_url_data:
        sources_found.append(f"Customer URL ({len(enhanced_data.customer_url_data.reviews)} reviews)")
    if enhanced_data.customer_amazon_data:
        sources_found.append(f"Amazon ({len(enhanced_data.customer_amazon_data.reviews)} reviews)")
    if enhanced_data.competitor_data:
        comp_total = sum(len(cd.reviews) for cd in enhanced_data.competitor_data)
        sources_found.append(f"Competitors ({comp_total} reviews)")
    if enhanced_data.youtube_data:
        sources_found.append(f"YouTube ({len(enhanced_data.youtube_data.reviews)} comments)")
    if enhanced_data.reddit_data:
        sources_found.append(f"Reddit ({len(enhanced_data.reddit_data.reviews)} posts)")
    
    logger.info(f"Data integration complete. Sources: {', '.join(sources_found)}")
    
    return enhanced_data


# Example usage and testing
if __name__ == "__main__":
    # Example data integration workflow
    print("=== Demographics Foundation Data Integration Test ===")
    
    # Create base review data
    base_data = ReviewData(
        amazon_reviews=[
            {"title": "Great product", "text": "Love this for my morning routine", "rating": 5},
            {"title": "Works well", "text": "Been using for 6 months, helps with my arthritis", "rating": 4}
        ],
        competitor_reviews=[
            {"title": "Expensive but good", "text": "Worth the investment for quality", "rating": 4}
        ],
        review_insights={"verification_rate": 0.75},
        target_keywords=["pain relief", "natural supplement"],
        amazon_url="https://amazon.com/dp/B123456789",
        primary_website="https://example.com",
        competitor_products=[
            {"title": "Competitor A", "price": 29.99, "rating": 4.2, "review_count": 150}
        ]
    )
    
    # Simulate data integration (would normally discover actual files)
    print("\n1. Integrating pipeline data sources...")
    enhanced_data = integrate_pipeline_data("test_job_123", base_data)
    
    # Initialize processor with integrated data
    print("\n2. Processing with Demographics Foundation prompt...")
    processor = DemographicsFoundationPrompt()
    
    # Validate data quality
    quality_report = processor.validate_data_quality(enhanced_data)
    print(f"\nData Quality Report:")
    print(f"- Total reviews: {quality_report.total_reviews}")
    print(f"- Quality score: {quality_report.quality_score}/100")
    print(f"- Missing sources: {quality_report.missing_sources}")
    print(f"- Warnings: {len(quality_report.warnings)}")
    
    # Format prompt with integrated data
    formatted_prompt = processor.format_prompt_with_data(enhanced_data, quality_report)
    print(f"\n3. Generated prompt length: {len(formatted_prompt)} characters")
    print(f"4. Quote attributions tracked: {len(processor.quote_attributions)}")
    
    # Show sample of formatted prompt
    print("\n5. Sample of formatted prompt:")
    print(formatted_prompt[:500] + "...\n")
    
    # Test API payload generation
    pipeline_result = processor.process_full_pipeline(enhanced_data)
    print(f"6. Pipeline ready for submission: {pipeline_result['ready_for_submission']}")
    print(f"7. Next stage: {pipeline_result['next_stage']}")
    
    print("\n=== Integration Test Complete ===")