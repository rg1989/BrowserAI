import { execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

async function globalSetup() {
  console.log("Setting up E2E tests...");

  const buildPath = path.join(__dirname, "../build/chrome-mv3-prod");
  const manifestPath = path.join(buildPath, "manifest.json");

  // Check if build exists and is valid
  if (!existsSync(buildPath) || !existsSync(manifestPath)) {
    console.log("Extension build not found or invalid. Building extension...");

    try {
      // Build the extension for testing
      execSync("npm run build:test", {
        stdio: "inherit",
        cwd: path.join(__dirname, ".."),
      });

      console.log("Extension built successfully for E2E testing.");

      // Verify build was successful
      if (!existsSync(manifestPath)) {
        throw new Error("Extension build failed - manifest.json not found");
      }
    } catch (error) {
      console.error("Failed to build extension for E2E tests:", error);
      process.exit(1);
    }
  } else {
    console.log("Extension build found. Proceeding with E2E tests...");
  }

  // Additional setup can be added here
  console.log("E2E test setup complete.");
}

export default globalSetup;
