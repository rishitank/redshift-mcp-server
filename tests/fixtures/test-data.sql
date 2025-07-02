-- Test data for Redshift MCP Server testing
-- This script creates sample tables and data for comprehensive testing

-- Create test tables in public schema
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES public.users(id),
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(100),
    in_stock BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create test tables in test_schema
CREATE TABLE IF NOT EXISTS test_schema.test_table (
    id SERIAL PRIMARY KEY,
    test_column VARCHAR(100),
    test_number INTEGER,
    test_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create test tables in analytics schema
CREATE TABLE IF NOT EXISTS analytics.sales_summary (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    total_sales DECIMAL(15,2),
    order_count INTEGER,
    avg_order_value DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert test data
INSERT INTO public.users (name, email, phone, created_at) VALUES
('John Doe', 'john.doe@example.com', '+1-555-0101', '2024-01-15 10:00:00'),
('Jane Smith', 'jane.smith@example.com', '+1-555-0102', '2024-01-16 11:00:00'),
('Bob Johnson', 'bob.johnson@example.com', '+1-555-0103', '2024-01-17 12:00:00'),
('Alice Brown', 'alice.brown@example.com', '+1-555-0104', '2024-01-18 13:00:00'),
('Charlie Wilson', 'charlie.wilson@example.com', '+1-555-0105', '2024-01-19 14:00:00');

INSERT INTO public.products (name, description, price, category) VALUES
('Laptop Pro', 'High-performance laptop for professionals', 1299.99, 'Electronics'),
('Wireless Mouse', 'Ergonomic wireless mouse', 29.99, 'Electronics'),
('Office Chair', 'Comfortable ergonomic office chair', 199.99, 'Furniture'),
('Desk Lamp', 'LED desk lamp with adjustable brightness', 49.99, 'Furniture'),
('Coffee Mug', 'Ceramic coffee mug with company logo', 12.99, 'Office Supplies');

INSERT INTO public.orders (user_id, product_name, quantity, price, status) VALUES
(1, 'Laptop Pro', 1, 1299.99, 'completed'),
(1, 'Wireless Mouse', 2, 29.99, 'completed'),
(2, 'Office Chair', 1, 199.99, 'pending'),
(3, 'Desk Lamp', 1, 49.99, 'shipped'),
(4, 'Coffee Mug', 3, 12.99, 'completed'),
(5, 'Laptop Pro', 1, 1299.99, 'processing');

INSERT INTO test_schema.test_table (test_column, test_number) VALUES
('Test Value 1', 100),
('Test Value 2', 200),
('Test Value 3', 300);

INSERT INTO analytics.sales_summary (date, total_sales, order_count, avg_order_value) VALUES
('2024-01-15', 1359.97, 2, 679.99),
('2024-01-16', 199.99, 1, 199.99),
('2024-01-17', 49.99, 1, 49.99),
('2024-01-18', 38.97, 1, 38.97),
('2024-01-19', 1299.99, 1, 1299.99);

-- Update SVV_TABLE_INFO with test data
INSERT INTO SVV_TABLE_INFO (database, schema, "table", table_id, size, pct_used, tbl_rows, encoded, diststyle, sortkey1, max_varchar, create_time) VALUES
('test_redshift', 'public', 'users', 1001, 1024, 75.5, 5, true, 'AUTO', 'id', 255, '2024-01-15 10:00:00'),
('test_redshift', 'public', 'orders', 1002, 2048, 60.2, 6, true, 'AUTO', 'id', 255, '2024-01-15 10:00:00'),
('test_redshift', 'public', 'products', 1003, 1536, 45.8, 5, true, 'AUTO', 'id', 255, '2024-01-15 10:00:00'),
('test_redshift', 'test_schema', 'test_table', 1004, 512, 30.1, 3, false, 'AUTO', 'id', 100, '2024-01-15 10:00:00'),
('test_redshift', 'analytics', 'sales_summary', 1005, 768, 55.3, 5, true, 'AUTO', 'date', 0, '2024-01-15 10:00:00');

-- Create some foreign key constraints for dependency testing
ALTER TABLE public.orders ADD CONSTRAINT fk_orders_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);

-- Grant permissions for testing
GRANT SELECT ON ALL TABLES IN SCHEMA public TO test_user_2;
GRANT SELECT ON ALL TABLES IN SCHEMA test_schema TO test_user_2;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO analytics_user;
