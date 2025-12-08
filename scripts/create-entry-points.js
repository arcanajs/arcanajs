const fs = require("fs");
const path = require("path");

const distDir = path.resolve(__dirname, "../dist");

const entryPoints = [
  "arcanajs",
  "arcanox",
  "arcanajs.client",
  "arcanajs.di",
  "arcanajs.validator",
  "arcanajs.auth",
  "arcanajs.mail",
  "cli/index",
];

if (!fs.existsSync(distDir)) {
  console.error("Dist directory does not exist. Run build first.");
  process.exit(1);
}

entryPoints.forEach((entryName) => {
  const fileName = `${entryName}.js`;
  const filePath = path.join(distDir, fileName);
  // Calculate relative path to dist dir from the entry point file
  const relativeDist = path.relative(path.dirname(filePath), distDir);

  // Helper to normalize paths with forward slashes and ensure ./ prefix
  const normalizePath = (p) => {
    let normalized = p.split(path.sep).join("/");
    if (!normalized.startsWith(".")) {
      normalized = "./" + normalized;
    }
    return normalized;
  };

  // Construct bundle paths preserving the entry name structure
  // For cli/index: ../development/cli/index.js
  // For arcanajs: ./development/arcanajs.js
  const devBundlePath = path.join(
    relativeDist,
    "development",
    `${entryName}.js`
  );
  const prodBundlePath = path.join(
    relativeDist,
    "production",
    `${entryName}.min.js`
  );

  const devBundle = normalizePath(devBundlePath);
  const prodBundle = normalizePath(prodBundlePath);

  const content = `'use strict';

if (process.env.NODE_ENV === 'production') {
  module.exports = require('${prodBundle}');
} else {
  module.exports = require('${devBundle}');
}
`;

  // Ensure directory exists for nested entry points like cli/index
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content);
  console.log(`Created entry point: ${fileName}`);
});

console.log("Entry points created successfully.");
