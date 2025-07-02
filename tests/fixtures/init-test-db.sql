-- Initialize test database for Redshift MCP Server testing
-- This script sets up the basic database structure

-- Create test schemas
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS test_schema;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Create test users
CREATE USER IF NOT EXISTS test_user_2 WITH PASSWORD 'password2';
CREATE USER IF NOT EXISTS analytics_user WITH PASSWORD 'analytics_pass';

-- Grant permissions
GRANT USAGE ON SCHEMA public TO test_user_2;
GRANT USAGE ON SCHEMA test_schema TO test_user_2;
GRANT USAGE ON SCHEMA analytics TO analytics_user;

-- Set default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO test_user_2;
ALTER DEFAULT PRIVILEGES IN SCHEMA test_schema GRANT SELECT ON TABLES TO test_user_2;
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT SELECT ON TABLES TO analytics_user;
