-- Mock Redshift system tables and views for testing
-- This script creates PostgreSQL equivalents of Redshift system objects

-- Mock SVV_TABLES (Redshift system view for tables)
CREATE OR REPLACE VIEW SVV_TABLES AS
SELECT 
    schemaname as table_schema,
    tablename as table_name,
    tableowner as table_owner
FROM pg_tables
WHERE schemaname NOT LIKE 'pg_%' 
AND schemaname != 'information_schema';

-- Mock SVV_COLUMNS (Redshift system view for columns)
CREATE OR REPLACE VIEW SVV_COLUMNS AS
SELECT 
    table_schema,
    table_name,
    column_name,
    data_type,
    character_maximum_length,
    numeric_precision,
    numeric_scale,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns
WHERE table_schema NOT LIKE 'pg_%' 
AND table_schema != 'information_schema';

-- Mock STL_QUERY (Redshift query history table)
CREATE TABLE IF NOT EXISTS STL_QUERY (
    query INTEGER PRIMARY KEY,
    userid INTEGER,
    database VARCHAR(128),
    querytxt TEXT,
    starttime TIMESTAMP,
    endtime TIMESTAMP,
    aborted INTEGER DEFAULT 0,
    suspended INTEGER DEFAULT 0
);

-- Mock SVV_TABLE_INFO (Redshift table statistics view)
CREATE TABLE IF NOT EXISTS SVV_TABLE_INFO (
    database VARCHAR(128),
    schema VARCHAR(128),
    "table" VARCHAR(128),
    table_id INTEGER,
    size BIGINT,
    pct_used DECIMAL(5,2),
    tbl_rows BIGINT,
    encoded BOOLEAN,
    diststyle VARCHAR(32),
    sortkey1 VARCHAR(128),
    max_varchar INTEGER,
    create_time TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stl_query_starttime ON STL_QUERY(starttime);
CREATE INDEX IF NOT EXISTS idx_stl_query_userid ON STL_QUERY(userid);
CREATE INDEX IF NOT EXISTS idx_svv_table_info_schema_table ON SVV_TABLE_INFO(schema, "table");

-- Insert some mock query history data
INSERT INTO STL_QUERY (query, userid, database, querytxt, starttime, endtime, aborted, suspended) VALUES
(1001, 100, 'test_redshift', 'SELECT * FROM public.users LIMIT 10', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour' + INTERVAL '2 seconds', 0, 0),
(1002, 100, 'test_redshift', 'SELECT COUNT(*) FROM public.orders', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours' + INTERVAL '1 second', 0, 0),
(1003, 101, 'test_redshift', 'SELECT * FROM analytics.sales_summary', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours' + INTERVAL '5 seconds', 0, 0),
(1004, 100, 'test_redshift', 'SELECT name, email FROM public.users WHERE created_at > ''2024-01-01''', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours' + INTERVAL '3 seconds', 0, 0),
(1005, 102, 'test_redshift', 'DROP TABLE malicious_table', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours' + INTERVAL '1 second', 1, 0);

-- Function to simulate EXPLAIN output
CREATE OR REPLACE FUNCTION mock_explain(query_text TEXT)
RETURNS TABLE(query_plan TEXT) AS $$
BEGIN
    RETURN QUERY SELECT 
        CASE 
            WHEN query_text ILIKE '%SELECT%' THEN 'Seq Scan on ' || split_part(split_part(query_text, 'FROM ', 2), ' ', 1) || ' (cost=0.00..1000.00 rows=100 width=32)'
            WHEN query_text ILIKE '%JOIN%' THEN 'Hash Join (cost=1000.00..2000.00 rows=500 width=64)'
            ELSE 'Unknown query plan'
        END as query_plan;
END;
$$ LANGUAGE plpgsql;
