/**
 * Comprehensive Test Runner for Redshift MCP Server
 *
 * This script runs all types of tests:
 * - Unit tests for SecurityValidator and core functionality
 * - Integration tests with test containers
 * - Performance tests
 * - Coverage analysis
 */

import { spawn } from "node:child_process";

// Type definitions for test runner
interface TestResult {
  passed: boolean;
  duration: number;
}

interface TestResults {
  unit: TestResult;
  integration: TestResult;
  coverage: TestResult;
}

interface CommandResult {
  code: number;
  duration: number;
}

interface Colors {
  reset: string;
  bright: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
}

const colors: Colors = {
  reset: "\u001B[0m",
  bright: "\u001B[1m",
  red: "\u001B[31m",
  green: "\u001B[32m",
  yellow: "\u001B[33m",
  blue: "\u001B[34m",
  magenta: "\u001B[35m",
  cyan: "\u001B[36m",
};

class TestRunner {
  private results: TestResults;

  constructor() {
    this.results = {
      unit: {
        passed: false,
        duration: 0,
      },
      integration: {
        passed: false,
        duration: 0,
      },
      coverage: {
        passed: false,
        duration: 0,
      },
    };
  }

  log(message: string, color: string = colors.reset): void {
    console.log(`${color}${message}${colors.reset}`);
  }

  async runCommand(
    command: string,
    args: string[] = [],
    options: Record<string, unknown> = {},
  ): Promise<CommandResult> {
    return new Promise<CommandResult>((resolve, reject) => {
      const startTime = Date.now();
      const proc = spawn(command, args, {
        stdio: "inherit",
        shell: true,
        ...options,
      });

      proc.on("close", (code: number | null) => {
        const duration = Date.now() - startTime;
        resolve({
          code: code ?? 1,
          duration,
        });
      });

      proc.on("error", (error: Error) => {
        reject(error);
      });
    });
  }

  async checkPrerequisites(): Promise<boolean> {
    this.log("\n🔍 Checking Prerequisites...", colors.cyan);

    // Check if Docker is available for integration tests
    try {
      const { code } = await this.runCommand("docker", ["--version"], {
        stdio: "pipe",
      });
      if (code === 0) {
        this.log("✅ Docker is available for integration tests", colors.green);
        return true;
      }
    } catch {
      this.log(
        "⚠️  Docker not available - integration tests will be skipped",
        colors.yellow,
      );
      return false;
    }
    return false;
  }

  async runUnitTests(): Promise<boolean> {
    this.log("\n🧪 Running Unit Tests...", colors.blue);
    this.log(
      "Testing SecurityValidator, input sanitization, and core functionality",
      colors.reset,
    );

    try {
      const { code, duration } = await this.runCommand("npm", [
        "run",
        "test:unit",
      ]);
      this.results.unit = {
        passed: code === 0,
        duration,
      };

      if (code === 0) {
        this.log(`✅ Unit tests passed in ${duration}ms`, colors.green);
      } else {
        this.log(`❌ Unit tests failed`, colors.red);
      }

      return code === 0;
    } catch (error) {
      this.log(`❌ Unit tests failed: ${(error as Error).message}`, colors.red);
      return false;
    }
  }

  async runIntegrationTests(dockerAvailable: boolean): Promise<boolean> {
    if (!dockerAvailable) {
      this.log(
        "\n⏭️  Skipping Integration Tests (Docker not available)",
        colors.yellow,
      );
      return true;
    }

    this.log("\n🔗 Running Integration Tests...", colors.blue);
    this.log(
      "Testing with PostgreSQL test containers and real MCP server",
      colors.reset,
    );

    try {
      const { code, duration } = await this.runCommand("npm", [
        "run",
        "test:integration",
      ]);
      this.results.integration = {
        passed: code === 0,
        duration,
      };

      if (code === 0) {
        this.log(`✅ Integration tests passed in ${duration}ms`, colors.green);
      } else {
        this.log(`❌ Integration tests failed`, colors.red);
      }

      return code === 0;
    } catch (error) {
      this.log(`❌ Integration tests failed: ${error.message}`, colors.red);
      return false;
    }
  }

  async runCoverageAnalysis(): Promise<boolean> {
    this.log("\n📊 Running Coverage Analysis...", colors.blue);
    this.log("Generating test coverage report", colors.reset);

    try {
      const { code, duration } = await this.runCommand("npm", [
        "run",
        "test:coverage",
      ]);
      this.results.coverage = {
        passed: code === 0,
        duration,
      };

      if (code === 0) {
        this.log(
          `✅ Coverage analysis completed in ${duration}ms`,
          colors.green,
        );
        this.log("📁 Coverage report generated in ./coverage/", colors.cyan);
      } else {
        this.log(`❌ Coverage analysis failed`, colors.red);
      }

      return code === 0;
    } catch (error) {
      this.log(`❌ Coverage analysis failed: ${error.message}`, colors.red);
      return false;
    }
  }

  async buildProject(): Promise<boolean> {
    this.log("\n🔨 Building Project...", colors.blue);

    try {
      const { code, duration } = await this.runCommand("npm", ["run", "build"]);

      if (code === 0) {
        this.log(`✅ Build completed in ${duration}ms`, colors.green);
      } else {
        this.log(`❌ Build failed`, colors.red);
      }

      return code === 0;
    } catch (error) {
      this.log(`❌ Build failed: ${error.message}`, colors.red);
      return false;
    }
  }

  printSummary(): void {
    this.log(`\n${"=".repeat(60)}`, colors.bright);
    this.log("🎯 TEST SUMMARY", colors.bright + colors.cyan);
    this.log("=".repeat(60), colors.bright);

    const totalDuration = (Object.values(this.results) as TestResult[]).reduce(
      (sum, result) => sum + result.duration,
      0,
    );

    this.log(`\n📋 Results:`, colors.bright);
    this.log(
      `   Unit Tests:        ${this.results.unit.passed ? "✅ PASSED" : "❌ FAILED"} (${this.results.unit.duration}ms)`,
      this.results.unit.passed ? colors.green : colors.red,
    );
    this.log(
      `   Integration Tests: ${this.results.integration.passed ? "✅ PASSED" : "❌ FAILED"} (${this.results.integration.duration}ms)`,
      this.results.integration.passed ? colors.green : colors.red,
    );
    this.log(
      `   Coverage Analysis: ${this.results.coverage.passed ? "✅ PASSED" : "❌ FAILED"} (${this.results.coverage.duration}ms)`,
      this.results.coverage.passed ? colors.green : colors.red,
    );

    this.log(`\n⏱️  Total Duration: ${totalDuration}ms`, colors.cyan);

    const allPassed = (Object.values(this.results) as TestResult[]).every(
      (result) => result.passed,
    );

    if (allPassed) {
      this.log("\n🎉 ALL TESTS PASSED! 🎉", colors.bright + colors.green);
      this.log(
        "\n✨ Your Redshift MCP Server extensions are working perfectly!",
        colors.green,
      );
      this.log(
        "   • SecurityValidator: Enhanced SQL injection protection ✅",
        colors.green,
      );
      this.log(
        "   • New Tools: analyze_query, get_table_lineage, check_permissions ✅",
        colors.green,
      );
      this.log(
        "   • New Resources: Query history, permissions, dependencies ✅",
        colors.green,
      );
      this.log(
        "   • Test Infrastructure: Unit tests, integration tests, coverage ✅",
        colors.green,
      );
    } else {
      this.log("\n❌ SOME TESTS FAILED", colors.bright + colors.red);
      this.log("\nPlease check the test output above for details.", colors.red);
    }

    this.log(`\n${"=".repeat(60)}`, colors.bright);
  }

  async run(): Promise<void> {
    this.log(
      "🚀 Redshift MCP Server - Comprehensive Test Suite",
      colors.bright + colors.magenta,
    );
    this.log(
      "Testing all extensions and functionality with test containers\n",
      colors.reset,
    );

    // Build project first
    const buildSuccess = await this.buildProject();
    if (!buildSuccess) {
      this.log("\n❌ Build failed - cannot proceed with tests", colors.red);
      throw new Error("Build failed - cannot proceed with tests");
    }

    // Check prerequisites
    const dockerAvailable = await this.checkPrerequisites();

    // Run all test suites
    await this.runUnitTests();
    await this.runIntegrationTests(dockerAvailable);
    await this.runCoverageAnalysis();

    // Print summary
    this.printSummary();

    // Check if all tests passed
    const allPassed = (Object.values(this.results) as TestResult[]).every(
      (result) => result.passed,
    );
    if (!allPassed) {
      throw new Error("Some tests failed");
    }
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new TestRunner();
  try {
    await runner.run();
  } catch (error) {
    console.error("❌ Test runner failed:", error);
    throw error;
  }
}

export default TestRunner;
