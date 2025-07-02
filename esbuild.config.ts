// eslint-disable-next-line n/no-unpublished-import
import { build, type BuildOptions } from "esbuild";

const config: BuildOptions = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: "dist/index.js",
  sourcemap: true,
  tsconfig: "tsconfig.build.json",
  external: ["pg", "pg-native", "sql-template-tag"],
  // Tree shaking and optimization
  treeShaking: true,
  minify: true,
  // Handle Node.js built-ins
  packages: "external",
  // Show build info
  logLevel: "info",
  metafile: false,
};

try {
  await build(config);
} catch (error) {
  console.error("Build failed:", error);
  throw error;
}
