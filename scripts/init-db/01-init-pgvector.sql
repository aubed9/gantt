-- scripts/init-db/01-init-pgvector.sql
-- Initialize pgvector extension and schemas for rpm_V1 and Mastra

CREATE EXTENSION IF NOT EXISTS vector;

-- Ensure schema for Mastra storage and knowledge vectors
CREATE SCHEMA IF NOT EXISTS mastra;
CREATE SCHEMA IF NOT EXISTS mastra_vectors;

-- Grant permissions to default application user
GRANT ALL ON SCHEMA mastra TO CURRENT_USER;
GRANT ALL ON SCHEMA mastra_vectors TO CURRENT_USER;
