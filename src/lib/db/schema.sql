-- Simplified Persona Analysis Database Schema
-- This replaces the complex multi-table structure with a single, clean table

-- Drop existing tables if they exist
DROP TABLE IF EXISTS persona_analyses CASCADE;

-- Create the main persona analysis table
CREATE TABLE persona_analyses (
    -- Primary identification
    analysis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User input
    user_url TEXT NOT NULL,
    
    -- Analysis results
    structured_data JSONB NOT NULL DEFAULT '{}',
    raw_quotes JSONB NOT NULL DEFAULT '[]',
    
    -- Full persona report (generated from the prompt)
    persona_report TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Optional fields for future enhancements
    user_email TEXT,
    status TEXT DEFAULT 'pending',
    error_message TEXT
);

-- Create indexes for better query performance
CREATE INDEX idx_persona_analyses_created_at ON persona_analyses(created_at DESC);
CREATE INDEX idx_persona_analyses_user_url ON persona_analyses(user_url);
CREATE INDEX idx_persona_analyses_status ON persona_analyses(status);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_persona_analyses_updated_at 
    BEFORE UPDATE ON persona_analyses 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Example of structured_data JSON structure:
-- {
--   "demographics": {
--     "age_range": "25-45",
--     "location": "Urban areas",
--     "income": "$50k-$100k"
--   },
--   "pain_points": ["issue1", "issue2"],
--   "motivations": ["goal1", "goal2"],
--   "behaviors": ["behavior1", "behavior2"],
--   "preferred_channels": ["email", "social media"]
-- }

-- Example of raw_quotes JSON structure:
-- [
--   {
--     "source": "website",
--     "quote": "actual customer testimonial",
--     "context": "product review"
--   }
-- ]