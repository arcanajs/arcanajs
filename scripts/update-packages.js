const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

async function getLatest(pkg) {
  const res = await fetch(`https://registry.npmjs.org/${pkg}`);
  if (!res.ok) return null;

  const data = await res.json();
  return data["dist-tags"]?.latest || null;
}

async function updateSection(section, pkgJson) {
  if (!pkgJson[section]) return;

  console.log(`\n🔧 Updating ${section} ...`);
  const entries = Object.entries(pkgJson[section]);

  for (const [pkg, currentRange] of entries) {
    const latest = await getLatest(pkg);

    if (!latest) {
      console.log(`❌ Failed to fetch ${pkg}`);
      continue;
    }

    if (currentRange.replace("^", "") !== latest) {
      pkgJson[section][pkg] = "^" + latest;
      console.log(`✔ Updated ${pkg}: ${currentRange} → ^${latest}`);
    } else {
      console.log(`✓ ${pkg} already up to date (${currentRange})`);
    }
  }
}

async function run() {
  const filePath = path.resolve("package.json");
  const pkgJson = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  await updateSection("dependencies", pkgJson);
  await updateSection("devDependencies", pkgJson);
  await updateSection("peerDependencies", pkgJson);

  fs.writeFileSync(filePath, JSON.stringify(pkgJson, null, 2));

  console.log("\n🎉 All packages updated successfully!");

  console.log("\n📦 Running npm install...");
  execSync("npm install", { stdio: "inherit" });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
