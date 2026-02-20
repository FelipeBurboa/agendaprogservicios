const { cpSync, mkdirSync, readdirSync } = require("fs");
const os = require("os");
const path = require("path");

// Playwright browser cache location per platform
let src;
if (process.platform === "win32") {
  src = path.join(process.env.LOCALAPPDATA, "ms-playwright");
} else if (process.platform === "darwin") {
  src = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
} else {
  src = path.join(os.homedir(), ".cache", "ms-playwright");
}

const dest = path.join(__dirname, "..", ".playwright-browsers");

// Find the latest chromium-* folder
const entries = readdirSync(src).filter((d) => /^chromium-\d+$/.test(d));
if (entries.length === 0) {
  console.error("No chromium-* folder found in", src);
  process.exit(1);
}
entries.sort();
const latest = entries[entries.length - 1];

console.log(`Copying ${latest} from ${src} to ${dest}`);
mkdirSync(path.join(dest, latest), { recursive: true });
cpSync(path.join(src, latest), path.join(dest, latest), { recursive: true });
console.log("Done.");
