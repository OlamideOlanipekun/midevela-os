-- ═══════════════════════════════════════════════════════════
-- MIDEVELA MVP — Database Schema (PostgreSQL + pgvector)
-- ═══════════════════════════════════════════════════════════

-- Enable the pgvector extension to work with embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Tenants (Organizations)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    website_url VARCHAR(255),
    industry VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Nigeria',
    logo_url TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Business Team Members
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'Agent', -- Owner, Admin, Manager, Agent
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Product Categories
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Product Catalog Items
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'NGN',
    images JSONB DEFAULT '[]'::jsonb, -- Array of image URLs
    attributes JSONB DEFAULT '{}'::jsonb, -- Custom specifications (e.g. sizes, colors)
    inventory_status VARCHAR(50) DEFAULT 'In Stock', -- In Stock, Low Stock, Out of Stock
    source VARCHAR(50) DEFAULT 'Manual', -- Manual, CSV, Shopify, Scraper
    source_url TEXT,
    ai_description TEXT, -- Optimization details generated for RAG
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Business Knowledge Entries (FAQ, Policies, docs)
CREATE TABLE IF NOT EXISTS knowledge_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- faq, policy, brand_info, document, product_knowledge
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Knowledge Embeddings (pgvector dimension 1536 for text-embedding-3-small)
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL, -- product, knowledge_entry
    source_id UUID NOT NULL,
    embedding VECTOR(1536), -- Vector store column
    chunk_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index vector similarity search (IVFFlat or HNSW)
CREATE INDEX IF NOT EXISTS embeddings_vector_idx ON embeddings 
USING hnsw (embedding vector_cosine_ops);

-- 7. Shoppers (Customers)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    external_id VARCHAR(255), -- ID from WhatsApp, Shopify, Cookie, etc.
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    preferences JSONB DEFAULT '[]'::jsonb, -- Extracted preferences
    buying_stage VARCHAR(50) DEFAULT 'Exploring', -- Exploring, Comparing, Ready, Purchased, Returning
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Chat Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    channel VARCHAR(50) DEFAULT 'Website', -- Website, WhatsApp, Instagram
    status VARCHAR(50) DEFAULT 'Active', -- Active, Resolved, Escalated
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    summary TEXT,
    intent VARCHAR(50) DEFAULT 'Greeting', -- Discovery, Comparison, Purchase, Support
    ai_confidence INT DEFAULT 100,
    outcome VARCHAR(50) DEFAULT 'Pending' -- Purchased, Lost, Handoff
);

-- 9. Conversational Message History
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- customer, ai, human_agent
    content TEXT NOT NULL,
    intent VARCHAR(50),
    recommendations JSONB DEFAULT '[]'::jsonb, -- Array of product IDs suggested
    tokens_used INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Customer Behavioral Events
CREATE TABLE IF NOT EXISTS customer_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- page_view, product_view, add_to_cart, search, exit_intent
    page_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Brand Customization & Theme Table
CREATE TABLE IF NOT EXISTS brand_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID UNIQUE REFERENCES website_registry(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    logo_url TEXT,
    favicon_url TEXT,
    primary_color VARCHAR(50),
    secondary_color VARCHAR(50),
    accent_color VARCHAR(50),
    background_color VARCHAR(50),
    font_family VARCHAR(100),
    border_radius VARCHAR(50),
    border_radius_style VARCHAR(50),
    button_style JSONB,
    theme_mode VARCHAR(20) DEFAULT 'AUTO',
    widget_theme JSONB DEFAULT '{}'::jsonb,
    overrides JSONB DEFAULT '{}'::jsonb,
    is_auto_detected BOOLEAN DEFAULT true,
    business_name VARCHAR(255),
    assistant_name VARCHAR(255),
    launcher_style VARCHAR(50) DEFAULT 'CIRCLE',
    widget_position VARCHAR(50) DEFAULT 'BOTTOM_RIGHT',
    animation VARCHAR(50) DEFAULT 'FADE',
    launcher_size INT DEFAULT 56,
    header_height INT DEFAULT 64,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Security policies (Row Level Security - RLS)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_themes ENABLE ROW LEVEL SECURITY;

