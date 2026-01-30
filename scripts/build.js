const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "src", "extension-trustflow.js");
const distDir = path.join(root, "dist");
const dest = path.join(distDir, "extension-trustflow.js");

fs.mkdirSync(distDir, { recursive: true });
fs.copyFileSync(src, dest);

console.log(`Wrote ${dest}`);
