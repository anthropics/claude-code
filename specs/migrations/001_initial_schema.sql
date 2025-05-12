-- Migration: 001_initial_schema.sql
-- Description: Initial database schema for Claude Neural Framework
-- Date: 2025-05-11

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agents table
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    capabilities JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(50) NOT NULL DEFAULT 'inactive',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Agent messages table
CREATE TABLE agent_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id VARCHAR(255) NOT NULL UNIQUE,
    conversation_id VARCHAR(255) NOT NULL,
    from_agent UUID REFERENCES agents(id),
    to_agent UUID REFERENCES agents(id),
    type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index on conversation_id
CREATE INDEX idx_agent_messages_conversation_id ON agent_messages(conversation_id);

-- Code analysis table
CREATE TABLE code_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    language VARCHAR(50) NOT NULL,
    code TEXT NOT NULL,
    patterns JSONB,
    metrics JSONB,
    suggestions JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Update function for automatically setting updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_agents_updated_at
BEFORE UPDATE ON agents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create view for agent capabilities
CREATE VIEW agent_capabilities AS
SELECT 
    a.id AS agent_id,
    a.name AS agent_name,
    jsonb_array_elements(a.capabilities) AS capability
FROM agents a;

-- Comments
COMMENT ON TABLE agents IS 'Stores information about cognitive agents in the system';
COMMENT ON TABLE documents IS 'Stores documents and their metadata';
COMMENT ON TABLE agent_messages IS 'Stores messages exchanged between agents';
COMMENT ON TABLE code_analyses IS 'Stores code analysis results';
COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates the updated_at column';
