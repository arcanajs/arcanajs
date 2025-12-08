#!/usr/bin/env node

/**
 * Post-build script to add type references to generated .d.ts files
 * This ensures CSS and asset type declarations are available to external projects
 */

const fs = require("fs");
const path = require("path");

// Reference to add at the top of declaration files
const typeReference = '/// <reference path="../types/global.d.ts" />\n\n';

// Files to modify
const filesToModify = [
  "dist/lib/index.client.d.ts",
  "dist/lib/index.server.d.ts",
  "dist/lib/index.auth.d.ts",
  "dist/lib/index.di.d.ts",
  "dist/lib/index.arcanox.d.ts",
  "dist/lib/index.validator.d.ts",
  "dist/lib/index.mail.d.ts",
];

console.log("📝 Adding type references to declaration files...\n");

filesToModify.forEach((filePath) => {
  const fullPath = path.join(__dirname, "..", filePath);

  // Check if file exists
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipping ${filePath} (file not found)`);
    return;
  }

  // Read current content
  const content = fs.readFileSync(fullPath, "utf8");

  // Check if reference already exists
  if (content.includes('/// <reference path="../types/global.d.ts"')) {
    console.log(`✓ ${filePath} already has type reference`);
    return;
  }

  // Add reference at the beginning
  const newContent = typeReference + content;

  // Write back to file
  fs.writeFileSync(fullPath, newContent, "utf8");
  console.log(`✓ Added type reference to ${filePath}`);
});

console.log("\n✅ Post-build script completed successfully!");
