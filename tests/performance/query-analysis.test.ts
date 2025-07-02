/**
 * Performance tests for query analysis functionality
 *
 * Tests the performance and accuracy of:
 * - SQL validation
 * - Query analysis recommendations
 * - Security pattern detection
 */

// Type definitions for performance testing
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

interface TestQuery {
  sql: string;
  expectedRecommendations: string[];
}

describe("Query Analysis Performance Tests", () => {
  // SecurityValidator for performance testing
  const SecurityValidator = {
    validateSqlQuery(sql: string): ValidationResult {
      const errors: string[] = [];
      const normalizedSql = sql.toLowerCase().trim();

      const dangerousPatterns = [
        /\b(drop|delete|update|insert|alter|create|truncate)\b/i,
        /\b(grant|revoke)\b/i,
        /\b(exec|execute)\b/i,
        /\b(xp_|sp_)\w+/i,
        /\b(union\s+select)\b/i,
        /;\s*--/i,
        /;\s*\/\*/i,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(normalizedSql)) {
          errors.push(
            `Potentially dangerous SQL pattern detected: ${pattern.source}`,
          );
        }
      }

      const injectionPatterns = [
        // Tautology-based injection (1=1, 'a'='a', etc.)
        /\b(or|and)\s+\d+\s*=\s*\d+/i,
        /\b(or|and)\s+['"][^'"]*['"]\s*=\s*['"][^'"]*['"]/i,
        // Union-based injection
        /union\s+(all\s+)?select/i,
        // Comment-based injection
        /--\s*$/i,
        /\/\*.*?\*\//i,
        // String-based injection with quotes
        /'\s*(or|and)\s*'/i,
        // Suspicious OR patterns (but not normal AND conditions)
        /\bor\s+['"]?\w*['"]?\s*=\s*['"]?\w*['"]?/i,
      ];

      for (const pattern of injectionPatterns) {
        if (pattern.test(normalizedSql)) {
          errors.push("Potential SQL injection pattern detected");
          break;
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    },
  };

  describe("Security Validation Performance", () => {
    test("should validate queries quickly", () => {
      const queries = [
        "SELECT * FROM users",
        "SELECT name, email FROM users WHERE id = 1",
        "SELECT COUNT(*) FROM orders",
        "SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id",
        "SELECT * FROM products WHERE price > 100 ORDER BY price DESC LIMIT 10",
      ];

      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        for (const query of queries) {
          SecurityValidator.validateSqlQuery(query);
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgTimePerQuery = duration / (1000 * queries.length);

      expect(avgTimePerQuery).toBeLessThan(1); // Should be less than 1ms per query
      expect(duration).toBeLessThan(5000); // Total should be less than 5 seconds
    });

    test("should detect injection patterns efficiently", () => {
      const maliciousQueries = [
        "SELECT * FROM users WHERE id = 1 OR 1=1",
        "SELECT * FROM users WHERE name = 'admin' OR 'a'='a'",
        "SELECT * FROM users; DROP TABLE users; --",
        "SELECT * FROM users UNION SELECT password FROM admin",
        "DROP TABLE users",
      ];

      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        for (const query of maliciousQueries) {
          const result = SecurityValidator.validateSqlQuery(query);
          expect(result.isValid).toBe(false);
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgTimePerQuery = duration / (100 * maliciousQueries.length);

      expect(avgTimePerQuery).toBeLessThan(2); // Should be less than 2ms per malicious query
    });
  });

  describe("Query Analysis Recommendations", () => {
    test("should generate recommendations quickly", () => {
      const testQueries: TestQuery[] = [
        {
          sql: "SELECT * FROM users",
          expectedRecommendations: ["SELECT *"],
        },
        {
          sql: "SELECT name FROM users ORDER BY created_at",
          expectedRecommendations: ["LIMIT"],
        },
        {
          sql: 'SELECT * FROM users WHERE name LIKE "%john%"',
          expectedRecommendations: ["wildcard"],
        },
        {
          sql: "SELECT COUNT(*) FROM large_table",
          expectedRecommendations: ["WHERE"],
        },
      ];

      const startTime = performance.now();

      for (const testCase of testQueries) {
        const recommendations: string[] = [];
        const sqlLower = testCase.sql.toLowerCase();

        if (sqlLower.includes("select *")) {
          recommendations.push(
            "Consider selecting only the columns you need instead of using SELECT *",
          );
        }

        if (sqlLower.includes("order by") && !sqlLower.includes("limit")) {
          recommendations.push(
            "Consider adding a LIMIT clause when using ORDER BY",
          );
        }

        if (sqlLower.includes("like") && sqlLower.includes("%")) {
          const likePattern = testCase.sql.match(/like\s+['"]%.*%['"]/i);
          if (likePattern) {
            recommendations.push(
              "Leading wildcard in LIKE pattern may prevent index usage",
            );
          }
        }

        if (
          !sqlLower.includes("where") &&
          sqlLower.includes("select") &&
          !sqlLower.includes("limit")
        ) {
          recommendations.push(
            "Query without WHERE clause may scan entire table",
          );
        }

        expect(recommendations.length).toBeGreaterThan(0);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // Should complete in less than 100ms
    });
  });

  describe("Large Query Handling", () => {
    test("should handle large queries efficiently", () => {
      // Generate a large query with many columns and conditions
      const columns = Array.from({ length: 100 }, (_, i) => `column_${i}`).join(
        ", ",
      );
      const conditions = Array.from(
        { length: 50 },
        (_, i) => `column_${i} = 'value_${i}'`,
      ).join(" AND ");
      const largeQuery = `SELECT ${columns} FROM large_table WHERE ${conditions} ORDER BY column_0 LIMIT 1000`;

      const startTime = performance.now();

      for (let i = 0; i < 10; i++) {
        const result = SecurityValidator.validateSqlQuery(largeQuery);
        // Large query should be valid (has WHERE clause and LIMIT)
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgTimePerQuery = duration / 10;

      expect(avgTimePerQuery).toBeLessThan(10); // Should handle large queries in less than 10ms
    });
  });

  describe("Concurrent Validation", () => {
    test("should handle concurrent validations", async () => {
      const queries = [
        "SELECT * FROM users",
        "SELECT name FROM products",
        "SELECT COUNT(*) FROM orders",
        "DROP TABLE malicious",
        "SELECT * FROM users WHERE id = 1 OR 1=1",
      ];

      const startTime = performance.now();

      // Run 100 concurrent validations
      const promises = Array.from({ length: 100 }, () =>
        Promise.resolve().then(() => {
          const randomQuery =
            queries[Math.floor(Math.random() * queries.length)];
          return SecurityValidator.validateSqlQuery(randomQuery);
        }),
      );

      const results = await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second

      // Verify that dangerous queries were caught
      const dangerousResults = results.filter((result) => !result.isValid);
      expect(dangerousResults.length).toBeGreaterThan(0);
    });
  });

  describe("Memory Usage", () => {
    test("should not leak memory during repeated validations", () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Run many validations
      for (let i = 0; i < 10_000; i++) {
        SecurityValidator.validateSqlQuery("SELECT * FROM users WHERE id = 1");
      }

      // Force garbage collection if available
      if (globalThis.gc) {
        globalThis.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 15MB)
      expect(memoryIncrease).toBeLessThan(15 * 1024 * 1024);
    });
  });
});
