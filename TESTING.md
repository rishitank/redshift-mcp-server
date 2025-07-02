# Comprehensive Testing Guide for Redshift MCP Server

This document describes the complete testing infrastructure for the Redshift MCP Server, including unit tests, integration tests with test containers, and performance testing.

## 🎯 Testing Overview

Our testing strategy ensures all extensions and functionality work correctly:

- **Unit Tests**: SecurityValidator, input sanitization, core functionality
- **Integration Tests**: Full MCP server with PostgreSQL test containers
- **Performance Tests**: Query analysis speed and memory usage
- **Coverage Analysis**: Code coverage reporting

## 🚀 Quick Start

### Run All Tests

```bash
# Run the comprehensive test suite
./run-all-tests.js

# Or use npm scripts
npm test                    # All tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:coverage      # Coverage analysis
```

### Prerequisites

- **Node.js 18+**: For running tests
- **Docker**: For integration tests with PostgreSQL containers
- **npm**: For dependency management

## 📁 Test Structure

```
tests/
├── setup.ts                    # Global test configuration
├── types.d.ts                  # TypeScript type definitions
├── fixtures/                   # Test data and database setup
│   ├── init-test-db.sql        # Database initialization
│   ├── mock-redshift-schema.sql # Mock Redshift system tables
│   └── test-data.sql           # Sample test data
├── unit/                       # Unit tests
│   └── security-validator.test.ts
├── integration/                # Integration tests
│   ├── mcp-server.test.ts      # Core MCP functionality
│   ├── new-tools.test.ts       # New tool testing
│   └── new-resources.test.ts   # New resource testing
└── performance/                # Performance tests
    └── query-analysis.test.ts  # Query analysis performance
```

## 🧪 Unit Tests

### SecurityValidator Tests

Tests the enhanced security validation system:

```typescript
// Example test
test("should block SQL injection attempts", () => {
  const injectionQueries = [
    "SELECT * FROM users WHERE id = 1 OR 1=1",
    "SELECT * FROM users; DROP TABLE users; --",
    "SELECT * FROM users UNION SELECT password FROM admin",
  ];

  injectionQueries.forEach((query) => {
    const result = SecurityValidator.validateSqlQuery(query);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
```

### Coverage Areas

- ✅ SQL injection detection (OR-based, Union-based, Comment-based)
- ✅ Dangerous operation blocking (DROP, DELETE, UPDATE, etc.)
- ✅ Input sanitization (schema names, table names)
- ✅ Pattern matching performance
- ✅ Edge cases (empty queries, whitespace, case sensitivity)

## 🔗 Integration Tests

### Test Container Setup

Uses PostgreSQL containers to mock Redshift:

```yaml
# docker-compose.test.yml
services:
  test-postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: test_redshift
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_password
```

### Mock Redshift System Tables

- `SVV_TABLES` - Table metadata
- `SVV_COLUMNS` - Column information
- `STL_QUERY` - Query history
- `SVV_TABLE_INFO` - Table statistics

### Test Scenarios

1. **Resource Listing**: Verify all new resources are available
2. **Tool Execution**: Test all new tools with real data
3. **Security Validation**: Ensure dangerous queries are blocked
4. **Data Accuracy**: Verify correct data retrieval and formatting

## 🏃‍♂️ Performance Tests

### Query Validation Performance

```typescript
test("should validate queries quickly", () => {
  const startTime = performance.now();

  for (let i = 0; i < 1000; i++) {
    SecurityValidator.validateSqlQuery("SELECT * FROM users");
  }

  const duration = performance.now() - startTime;
  expect(duration).toBeLessThan(5000); // < 5 seconds for 1000 queries
});
```

### Performance Benchmarks

- **Query Validation**: < 1ms per query
- **Injection Detection**: < 2ms per malicious query
- **Large Query Handling**: < 10ms for complex queries
- **Memory Usage**: < 10MB increase for 10,000 validations

## 🐳 Test Containers

### PostgreSQL Mock Setup

The integration tests use PostgreSQL to simulate Redshift:

1. **Container Startup**: Automatic PostgreSQL container creation
2. **Schema Setup**: Mock Redshift system tables and views
3. **Test Data**: Sample users, orders, products tables
4. **Cleanup**: Automatic container teardown

### Benefits of Test Containers

- **Isolation**: Each test run uses a fresh database
- **Consistency**: Same environment across different machines
- **Realism**: Tests against actual SQL database
- **CI/CD Ready**: Works in containerized environments

## 📊 Coverage Analysis

### Coverage Reports

```bash
npm run test:coverage
```

Generates reports in multiple formats:

- **Terminal**: Summary in console
- **HTML**: Detailed report in `coverage/` directory
- **LCOV**: For CI/CD integration

### Coverage Targets

- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 95%
- **Lines**: > 90%

## 🔧 Test Configuration

### Jest Configuration (`jest.config.ts`)

```typescript
const config: Config = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testTimeout: 30000,
  maxWorkers: 1, // Important for test containers
  collectCoverageFrom: ["src/**/*.ts"],
};
```

### Key Settings

- **ESM Support**: Modern JavaScript modules
- **TypeScript**: Full TypeScript support
- **Test Containers**: Single worker for container isolation
- **Extended Timeout**: 30s for container operations

## 🚨 Troubleshooting

### Common Issues

#### Docker Not Available

```bash
# Error: Docker not found
⚠️ Docker not available - integration tests will be skipped
```

**Solution**: Install Docker or run unit tests only

#### Port Conflicts

```bash
# Error: Port 5432 already in use
```

**Solution**: Stop other PostgreSQL instances or change test port

#### Memory Issues

```bash
# Error: JavaScript heap out of memory
```

**Solution**: Increase Node.js memory limit:

```bash
export NODE_OPTIONS="--max-old-space-size=4096"
```

### Debug Mode

Enable verbose logging:

```bash
DEBUG=testcontainers* npm test
```

## 📈 Continuous Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
      - run: npm ci
      - run: npm run build
      - run: npm test
```

### Test Results

The test runner provides comprehensive results:

- ✅ **Unit Tests**: SecurityValidator and core functionality
- ✅ **Integration Tests**: Full MCP server with containers
- ✅ **Performance Tests**: Speed and memory benchmarks
- ✅ **Coverage Analysis**: Code coverage reporting

## 🎉 Success Criteria

All tests passing indicates:

- **Security**: Enhanced SQL injection protection works
- **Functionality**: All new tools and resources work correctly
- **Performance**: Query analysis is fast and efficient
- **Reliability**: Code is well-tested and maintainable

## 📚 Additional Resources

- **Jest Documentation**: https://jestjs.io/docs/getting-started
- **Testcontainers**: https://testcontainers.com/
- **PostgreSQL**: https://www.postgresql.org/docs/
- **MCP Specification**: https://modelcontextprotocol.io/

---

**The Force is strong with this testing infrastructure. Your Redshift MCP Server extensions are battle-tested and ready for production deployment.**
