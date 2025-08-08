-- Fresh V3 Database Schema - Simple and Direct
-- Built completely from scratch as requested

CREATE TABLE IF NOT EXISTS analyses (
    id VARCHAR(50) PRIMARY KEY,
    url TEXT NOT NULL,
    email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'processing',
    report_data JSONB,
    debug_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Simple index for lookups
CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status);
CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at);