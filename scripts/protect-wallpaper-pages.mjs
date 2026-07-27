import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const functionsBase = "https://us-central1-pmw-visuals-b14e8.cloudfunctions.net";
const mappingSource = fs.readFileSync(path.join(root, "wallpaper-pages.js"), "utf8");
const context = { window: {} };
vm.runInNewContext(mappingSource, context);

const pageMap = context.window.PMW_WALLPAPER_PAGES || {};
const normalizedToId = new Map(
  Object.entries(pageMap).map(([id, file]) => [normalizePath(file), id])
);

const protectionCss = `
        .preview-card {
            position: relative;
            isolation: isolate;
        }
        .preview-card::after {
            content: '';
            position: absolute;
            inset: 0;
            z-index: 2;
            pointer-events: none;
            user-select: none;
            -webkit-user-select: none;
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        .preview-card.has-premium-watermark::after {
            opacity: 0.72;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='150' viewBox='0 0 260 150'%3E%3Ctext x='18' y='88' fill='white' fill-opacity='.42' font-family='Arial,sans-serif' font-size='21' font-weight='700' transform='rotate(-28 130 75)'%3EPMW VISUALS%3C/text%3E%3C/svg%3E");
            background-repeat: repeat;
            background-size: clamp(180px, 22vw, 260px) auto;
            filter: drop-shadow(0 1px 2px rgba(0,0,0,.55));
        }
        .wallpaper-layout.protection-pending .preview-card img {
            opacity: 0.18;
            filter: blur(12px);
        }
        .download-btn:disabled {
            cursor: wait;
            opacity: 0.64;
        }
        @media (max-width: 520px) {
            .preview-card.has-premium-watermark::after {
                background-size: 170px auto;
            }
        }
`;

let updated = 0;
const missing = [];

for (const [id, relativeFile] of Object.entries(pageMap)) {
  const normalizedFile = normalizePath(relativeFile);
  const absoluteFile = path.join(root, ...normalizedFile.split("/"));
  if (!fs.existsSync(absoluteFile)) {
    missing.push(normalizedFile);
    continue;
  }

  const pageDirectory = path.posix.dirname(normalizedFile);
  const rootPrefix = path.posix.relative(pageDirectory, ".") || ".";
  const assetPrefix = rootPrefix === "." ? "./" : `${rootPrefix}/`;
  const detailPreview = previewUrl(id, "detail");
  const detailPreviewAttribute = escapeAttribute(detailPreview);
  let html = fs.readFileSync(absoluteFile, "utf8");
  const lineEnding = "\r\n";

  html = html.replace(
    /<meta property="og:image" content="[^"]*">/,
    `<meta property="og:image" content="${detailPreviewAttribute}">`
  );
  html = html.replace(
    /<meta name="twitter:image" content="[^"]*">/,
    `<meta name="twitter:image" content="${detailPreviewAttribute}">`
  );
  html = html.replace(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    (block, jsonText) => {
      try {
        const value = JSON.parse(jsonText);
        if (value?.["@type"] === "ImageObject") {
          value.contentUrl = detailPreview;
          value.thumbnailUrl = previewUrl(id, "thumbnail");
          return `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
        }
      } catch (error) {
        // Preserve unrelated or malformed JSON-LD blocks.
      }
      return block;
    }
  );

  html = html.replace(
    /<section class="wallpaper-layout"(?:\s+data-protected-wallpaper(?:\s+data-wallpaper-id="[^"]*")?)?>/,
    `<section class="wallpaper-layout" data-protected-wallpaper data-wallpaper-id="${escapeAttribute(id)}">`
  );
  html = html.replace(
    /(<div class="preview-card">\s*<img\s+src=")[^"]*(")/,
    `$1${detailPreviewAttribute}$2`
  );

  html = html.replace(
    /(<a class="related-card" href="([^"]+)"><img src=")[^"]*(")/g,
    (match, prefix, href, suffix) => {
      const target = resolveRelatedPath(normalizedFile, href);
      const relatedId = normalizedToId.get(target);
      return relatedId
        ? `${prefix}${escapeAttribute(previewUrl(relatedId, "thumbnail"))}${suffix}`
        : match;
    }
  );

  if (!html.includes(".preview-card.has-premium-watermark::after")) {
    html = html.replace("</style>", `${protectionCss}    </style>`);
  }

  html = html.replace(/^\s*const downloadUrl = "[^"]*";\r?\n/m, "");
  html = html.replace(
    /const wallpaperDownloadItem = (\{[^\r\n]*\});/,
    "window.wallpaperDownloadItem = $1;"
  );
  html = html.replace(
    /\s*document\.getElementById\('downloadButton'\)\.addEventListener\('click', \(\) => \{[\s\S]*?\n\s*\}\);\s*\n\s*(?=document\.getElementById\('shareButton'\))/,
    "\n\n        "
  );

  const protectionScript = `<script type="module" src="${assetPrefix}js/wallpaper-protection.js"></script>`;
  if (!html.includes("js/wallpaper-protection.js")) {
    html = html.replace(
      /(\s*<script type="module" src="[^"]*js\/saved-wallpapers\.js"><\/script>)/,
      `\n    ${protectionScript}$1`
    );
  }

  fs.writeFileSync(absoluteFile, normalizeLineEndings(html, lineEnding));
  updated += 1;
}

let categoryIndexesUpdated = 0;
const wallpapersDirectory = path.join(root, "wallpapers");
for (const categoryIndex of findCategoryIndexes(wallpapersDirectory)) {
  if (categoryIndex === path.join(wallpapersDirectory, "index.html")) continue;
  const relativeIndex = normalizePath(path.relative(root, categoryIndex));
  const lineEnding = "\r\n";
  let html = fs.readFileSync(categoryIndex, "utf8");
  const nextHtml = html.replace(
    /(<a class="wallpaper-card" href="([^"]+)">\s*<img src=")[^"]*(")/g,
    (match, prefix, href, suffix) => {
      const target = resolveRelatedPath(relativeIndex, href);
      const wallpaperId = normalizedToId.get(target);
      return wallpaperId
        ? `${prefix}${escapeAttribute(previewUrl(wallpaperId, "thumbnail"))}${suffix}`
        : match;
    }
  );
  if (nextHtml !== html) {
    fs.writeFileSync(categoryIndex, normalizeLineEndings(nextHtml, lineEnding));
    categoryIndexesUpdated += 1;
  }
}

console.log(`Protected ${updated} wallpaper detail pages.`);
console.log(`Sanitized ${categoryIndexesUpdated} wallpaper category indexes.`);
if (missing.length) {
  console.warn(`Missing ${missing.length} mapped pages.`);
}

function normalizePath(value) {
  return String(value || "").replaceAll("\\", "/").replace(/^\.?\//, "");
}

function previewUrl(id, variant) {
  return `${functionsBase}/wallpaperPreview?id=${encodeURIComponent(id)}&variant=${variant}`;
}

function resolveRelatedPath(currentFile, href) {
  const cleanHref = String(href || "").split(/[?#]/)[0];
  if (cleanHref.startsWith("/")) {
    return normalizePath(cleanHref);
  }
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(currentFile), cleanHref));
  return normalizePath(resolved);
}

function escapeAttribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function normalizeLineEndings(value, lineEnding) {
  return value.replace(/\r?\n/g, lineEnding);
}

function findCategoryIndexes(directory) {
  if (!fs.existsSync(directory)) return [];
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...findCategoryIndexes(fullPath));
    } else if (entry.name === "index.html") {
      results.push(fullPath);
    }
  }
  return results;
}
