import { execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

/**
 * Setup script for E2E tests
 * Ensures the extension is built before running tests
 */
export async function setupE2ETests() {
  const buildPath = path.join(__dirname, "../build/chrome-mv3-prod");

  // Check if build exists
  if (!existsSync(buildPath)) {
    console.log("Extension build not found. Building extension for testing...");

    try {
      execSync("npm run build:test", {
        stdio: "inherit",
        cwd: path.join(__dirname, ".."),
      });
      console.log("Extension built successfully for testing.");
    } catch (error) {
      console.error("Failed to build extension:", error);
      throw error;
    }
  } else {
    console.log("Extension build found. Proceeding with tests...");
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupE2ETests().catch(console.error);
}
