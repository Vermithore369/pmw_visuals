import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const mappingContext = { window: {} };
vm.runInNewContext(
  fs.readFileSync(path.join(root, "wallpaper-pages.js"), "utf8"),
  mappingContext
);

const pageMap = mappingContext.window.PMW_WALLPAPER_PAGES || {};
const failures = [];

for (const [id, relativeFile] of Object.entries(pageMap)) {
  const absoluteFile = path.join(root, ...relativeFile.split("/"));
  if (!fs.existsSync(absoluteFile)) {
    failures.push(`${relativeFile}: mapped file is missing`);
    continue;
  }

  const html = fs.readFileSync(absoluteFile, "utf8");
  assertCount(html, "data-protected-wallpaper", 1, relativeFile);
  assertCount(html, `data-wallpaper-id="${id}"`, 1, relativeFile);
  assertCount(html, "js/wallpaper-protection.js", 1, relativeFile);
  assertCount(html, ".preview-card.has-premium-watermark::after", 2, relativeFile);

  if (html.includes("res.cloudinary.com")) {
    failures.push(`${relativeFile}: exposes a direct Cloudinary URL`);
  }
  if (/const\s+downloadUrl\s*=/.test(html)) {
    failures.push(`${relativeFile}: embeds a direct download URL`);
  }
  if (/"(?:contentUrl|thumbnailUrl)":"[^"]*&amp;variant=/.test(html)) {
    failures.push(`${relativeFile}: JSON-LD contains an HTML-escaped preview query`);
  }
}

for (const categoryIndex of findFiles(path.join(root, "wallpapers"), "index.html")) {
  const relativeFile = normalizePath(path.relative(root, categoryIndex));
  const html = fs.readFileSync(categoryIndex, "utf8");
  if (html.includes("res.cloudinary.com")) {
    failures.push(`${relativeFile}: exposes direct gallery image URLs`);
  }
  if (html.includes("has-premium-watermark")) {
    failures.push(`${relativeFile}: gallery page contains a watermark overlay`);
  }
}

const mainGallery = fs.readFileSync(path.join(root, "pmw-wallpapers.html"), "utf8");
if (mainGallery.includes("has-premium-watermark")) {
  failures.push("pmw-wallpapers.html: gallery page contains a watermark overlay");
}

for (const dataFile of ["wallpapers-data.js", "desktop-wallpapers-data.js"]) {
  const source = fs.readFileSync(path.join(root, dataFile), "utf8");
  if (/res\.cloudinary\.com|cloudinaryPublicId|public_id|imageUrl\s*:/.test(source)) {
    failures.push(`${dataFile}: exposes an original Cloudinary delivery field`);
  }
}

if (failures.length) {
  console.error(`Wallpaper protection verification failed (${failures.length} issues):`);
  failures.slice(0, 50).forEach((failure) => console.error(`- ${failure}`));
  if (failures.length > 50) {
    console.error(`- ...and ${failures.length - 50} more`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Wallpaper protection verified across ${Object.keys(pageMap).length} detail pages.`
  );
}

function assertCount(source, needle, expected, file) {
  const count = source.split(needle).length - 1;
  if (count !== expected) {
    failures.push(`${file}: expected ${expected} occurrence(s) of ${needle}, found ${count}`);
  }
}

function findFiles(directory, fileName) {
  if (!fs.existsSync(directory)) return [];
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, fileName));
    } else if (entry.name === fileName) {
      results.push(fullPath);
    }
  }
  return results;
}

function normalizePath(value) {
  return String(value || "").replaceAll("\\", "/");
}
