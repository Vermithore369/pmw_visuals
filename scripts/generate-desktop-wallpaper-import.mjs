import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const manifestFile = path.join(root, "work", "desktop-wallpaper-import", "cloudinary-assets.json");
const titlesFile = path.join(root, "scripts", "desktop-import-titles-2026-08.txt");
const dataFile = path.join(root, "desktop-wallpapers-data.js");
const mapFile = path.join(root, "wallpaper-pages.js");
const sitemapFile = path.join(root, "sitemap.xml");
const duplicateIndexes = new Set([345, 346, 347, 348, 349, 350, 351]);
const batchMarker = "desktop-import-2026-08";
const siteOrigin = "https://pmwvisuals.com";

const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
const titles = parseTitles(fs.readFileSync(titlesFile, "utf8"));

if (manifest.length !== 408 || titles.size !== 408) {
  throw new Error(`Expected 408 manifest items and titles; found ${manifest.length} and ${titles.size}.`);
}

const oldData = loadWindowValue(dataFile, "PMW_DESKTOP_WALLPAPERS");
const oldMap = loadWindowValue(mapFile, "PMW_WALLPAPER_PAGES");
const incomingPublicIds = new Set(manifest.map(item => item.public_id));
const retainedData = oldData.filter(item => !incomingPublicIds.has(item.publicId));
const usedSlugs = new Set(retainedData.map(item => item.slug).filter(Boolean));
const usedTitles = new Set(retainedData.map(item => normalize(item.title)).filter(Boolean));
let serial = Math.max(0, ...retainedData.map(item => Number(String(item.id || "").match(/-(\d+)$/)?.[1]) || 0));

const records = [];
for (let index = 1; index <= manifest.length; index += 1) {
  if (duplicateIndexes.has(index)) continue;
  const asset = manifest[index - 1];
  const title = titles.get(index);
  if (!title) throw new Error(`Missing visual title for manifest item ${index}.`);
  if (usedTitles.has(normalize(title))) throw new Error(`Title is not unique: ${title}`);
  usedTitles.add(normalize(title));

  serial += 1;
  const category = normalizeCategory(asset.category || asset.asset_folder);
  const slug = uniqueSlug(slugify(title), usedSlugs);
  const resolution = `${asset.width}x${asset.height}`;
  const description = buildDescription(title, category, resolution);
  const publicId = asset.public_id;
  const extension = String(asset.format || "png").toLowerCase();
  const baseDelivery = `https://res.cloudinary.com/nhxfoykh/image/upload/v${asset.version}/${encodeCloudinaryPath(publicId)}.${extension}`;
  const pagePath = `wallpapers/desktop/${slugify(category)}/${slug}.html`;
  const id = `desktop-${slug}-${String(serial).padStart(3, "0")}`;
  const tags = buildTags(title, category);

  records.push({
    id,
    title,
    description,
    category,
    categories: [category],
    deviceTypes: ["desktop"],
    resolution,
    width: Number(asset.width),
    height: Number(asset.height),
    format: String(asset.format || "PNG").toUpperCase(),
    bytes: Number(asset.bytes) || 0,
    tags,
    source: "cloudinary-desktop",
    image: baseDelivery,
    preview: baseDelivery.replace("/upload/", "/upload/c_fit,w_1200,h_675,q_auto,f_auto/"),
    thumbnail: baseDelivery.replace("/upload/", "/upload/c_fill,w_640,h_360,q_auto,f_auto/"),
    download: baseDelivery.replace("/upload/", `/upload/fl_attachment:PMW_Visuals_${String(serial).padStart(5, "0")}/`),
    slug,
    publicId,
    pageUrl: pagePath,
    createdAt: asset.created_at || "2026-08-05T00:00:00Z",
    importBatch: batchMarker
  });
}

validateRecords(records);

const allData = [...retainedData, ...records];
fs.writeFileSync(dataFile, `window.PMW_DESKTOP_WALLPAPERS = ${JSON.stringify(allData, null, 2)};\n`);

const nextMap = { ...oldMap };
for (const [key, value] of Object.entries(nextMap)) {
  if (String(value).startsWith("wallpapers/desktop/")) delete nextMap[key];
}
for (const item of records) nextMap[item.id] = item.pageUrl;
fs.writeFileSync(mapFile, `window.PMW_WALLPAPER_PAGES = ${JSON.stringify(nextMap, null, 2)};\n`);

for (const item of records) {
  const related = relatedItems(item, records);
  const output = path.join(root, ...item.pageUrl.split("/"));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, renderPage(item, related));
}

updateSitemap(records);

console.log(`Imported ${records.length} visually analyzed desktop wallpapers.`);
console.log(`Retained ${retainedData.length} existing desktop wallpapers.`);
console.log(`Generated ${records.length} dedicated SEO detail pages.`);
console.log(`Excluded ${duplicateIndexes.size} exact duplicates: ${[...duplicateIndexes].join(", ")}.`);

function parseTitles(source) {
  const result = new Map();
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = line.match(/^(\d{3})\|(.+)$/);
    if (!match) throw new Error(`Invalid visual title line: ${line}`);
    result.set(Number(match[1]), match[2].trim());
  }
  return result;
}

function loadWindowValue(file, key) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), context);
  return context.window[key] || (key === "PMW_DESKTOP_WALLPAPERS" ? [] : {});
}

function normalizeCategory(value) {
  const normalized = normalize(value);
  if (normalized.includes("fantasy")) return "Fantasy";
  if (normalized.includes("nature")) return "Nature";
  if (normalized.includes("cityscape")) return "Cityscape";
  if (normalized.includes("aesthetic")) return "Aesthetic";
  if (normalized.includes("anime")) return "Anime";
  return "Abstract";
}

function buildDescription(title, category, resolution) {
  const phrases = {
    Abstract: "polished forms, rich color, and a modern wide-screen composition",
    Aesthetic: "atmospheric color, elegant detail, and a cinematic wide-screen mood",
    Anime: "detailed anime art, expressive lighting, and a cinematic landscape composition",
    Cityscape: "architectural detail, dramatic city light, and a polished urban atmosphere",
    Fantasy: "imaginative scenery, dramatic light, and richly detailed fantasy atmosphere",
    Nature: "natural color, scenic depth, and a calm landscape composition"
  };
  let text = `Download ${title}, a free ${resolution} ${category.toLowerCase()} desktop wallpaper featuring ${phrases[category]}.`;
  if (text.length < 120) text += " Made for laptops and monitors.";
  if (text.length > 158) text = text.replace(" a free ", " ").replace("richly detailed ", "detailed ");
  if (text.length > 160) text = `${text.slice(0, 157).replace(/[ ,;]+$/g, "")}.`;
  return text;
}

function buildTags(title, category) {
  const categoryTags = {
    Abstract: ["abstract wallpaper", "modern wallpaper", "colorful wallpaper"],
    Aesthetic: ["aesthetic wallpaper", "cinematic wallpaper", "moody wallpaper"],
    Anime: ["anime wallpaper", "anime landscape", "digital art wallpaper"],
    Cityscape: ["cityscape wallpaper", "urban wallpaper", "city wallpaper"],
    Fantasy: ["fantasy wallpaper", "fantasy landscape", "cinematic wallpaper"],
    Nature: ["nature wallpaper", "landscape wallpaper", "scenic wallpaper"]
  };
  const stop = new Set(["a", "an", "and", "at", "above", "beneath", "between", "beyond", "by", "in", "into", "of", "on", "over", "the", "through", "under", "with"]);
  const words = slugify(title).split("-").filter(word => word.length > 2 && !stop.has(word)).slice(0, 6);
  return [...new Set(["desktop wallpaper", "16:9 wallpaper", "hd wallpaper", ...categoryTags[category], ...words])];
}

function validateRecords(items) {
  if (items.length !== 401) throw new Error(`Expected 401 unique records; found ${items.length}.`);
  for (const field of ["id", "title", "description", "slug", "publicId", "pageUrl"]) {
    const values = items.map(item => item[field]);
    if (new Set(values).size !== values.length) throw new Error(`Duplicate ${field} detected.`);
  }
  const invalidDescriptions = items.filter(item => item.description.length < 120 || item.description.length > 160);
  if (invalidDescriptions.length) {
    throw new Error(`Descriptions outside 120-160 characters: ${invalidDescriptions.slice(0, 5).map(item => item.title).join(", ")}`);
  }
}

function relatedItems(item, items) {
  const peers = items.filter(candidate => candidate.id !== item.id && candidate.category === item.category);
  const start = hashString(item.id) % Math.max(1, peers.length);
  return Array.from({ length: Math.min(6, peers.length) }, (_, offset) => peers[(start + offset * 7) % peers.length]);
}

function renderPage(item, related) {
  const canonical = `${siteOrigin}/${item.pageUrl}`;
  const categoryUrl = `../../../pmw-wallpapers.html?category=${encodeURIComponent(item.category)}&device=desktop#latest-wallpapers`;
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ImageObject",
    name: item.title,
    description: item.description,
    contentUrl: item.image,
    thumbnailUrl: item.thumbnail,
    encodingFormat: item.format,
    width: item.width,
    height: item.height,
    keywords: item.tags.join(", "),
    url: canonical,
    creator: { "@type": "Organization", name: "PMW Visuals", url: siteOrigin },
    creditText: "PMW Visuals",
    copyrightNotice: "Copyright PMW Visuals",
    acquireLicensePage: `${siteOrigin}/license.html`,
    license: `${siteOrigin}/license.html`
  });
  const relatedMarkup = related.map(candidate => `<a class="related-card" href="../../../${escapeAttribute(candidate.pageUrl)}"><img src="${escapeAttribute(candidate.thumbnail)}" alt="${escapeAttribute(candidate.title)}" loading="lazy"><span>${escapeHtml(candidate.title)}</span></a>`).join("");
  const tags = item.tags.map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join("");
  const downloadItem = JSON.stringify({ id: item.id, title: item.title, category: item.category, image: item.thumbnail, url: canonical, type: "wallpaper" });
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <script src="../../../js/pmw-theme.js"></script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow">
  <title>${escapeHtml(item.title)} Desktop Wallpaper | PMW Visuals</title>
  <meta name="description" content="${escapeAttribute(item.description)}">
  <link rel="canonical" href="${escapeAttribute(canonical)}">
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="shortcut icon" href="/favicon.png">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="PMW Visuals">
  <meta property="og:title" content="${escapeAttribute(item.title)} Desktop Wallpaper | PMW Visuals">
  <meta property="og:description" content="${escapeAttribute(item.description)}">
  <meta property="og:url" content="${escapeAttribute(canonical)}">
  <meta property="og:image" content="${escapeAttribute(item.preview)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttribute(item.title)} Desktop Wallpaper | PMW Visuals">
  <meta name="twitter:description" content="${escapeAttribute(item.description)}">
  <meta name="twitter:image" content="${escapeAttribute(item.preview)}">
  <script type="application/ld+json">${jsonLd.replaceAll("<", "\\u003c")}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../../../css/pmw-theme.css">
  <style>${detailPageCss()}</style>
</head>
<body>
  <nav class="navbar"><div class="nav-inner">
    <a class="brand" href="../../../index.html"><img src="../../../pmw-wordmark.png" alt="PMW"><span>Visuals</span></a>
    <div class="nav-links"><a href="../../../pmw-wallpapers.html">PMW Wallpapers</a><a href="../../../pmw-studio.html">PMW Studio</a></div>
  </div></nav>
  <main>
    <div class="breadcrumb"><a href="../../../index.html">Home</a><span>/</span><a href="../../../pmw-wallpapers.html">PMW Wallpapers</a><span>/</span><a href="${categoryUrl}">${escapeHtml(item.category)}</a><span>/</span><span>${escapeHtml(item.title)}</span></div>
    <section class="wallpaper-layout">
      <div class="preview-card"><img src="${escapeAttribute(item.preview)}" alt="${escapeAttribute(item.title)}"></div>
      <article>
        <p class="kicker">${escapeHtml(item.category)} Desktop Wallpaper</p>
        <h1>${escapeHtml(item.title)}</h1>
        <p class="description">${escapeHtml(item.description)}</p>
        <div class="details"><div class="detail"><span>Resolution</span><strong>${item.resolution}</strong></div><div class="detail"><span>Ratio</span><strong>16:9</strong></div><div class="detail"><span>Category</span><strong>${escapeHtml(item.category)}</strong></div><div class="detail"><span>Format</span><strong>${item.format}</strong></div></div>
        <div class="tags">${tags}</div>
        <div class="actions"><a class="download-btn" id="downloadButton" href="${escapeAttribute(item.download)}">Download Wallpaper</a><button class="share-btn" id="shareButton" type="button" aria-label="Share wallpaper page" title="Share wallpaper page">↗</button><a class="secondary-link" href="${categoryUrl}">Browse Collection</a><span id="shareStatus" aria-live="polite"></span></div>
      </article>
    </section>
    <section class="related"><h2>Related Wallpapers</h2><div class="related-grid">${relatedMarkup}</div></section>
  </main>
  <script src="../../../download-tracking.js"></script>
  <script>
    window.wallpaperDownloadItem = ${downloadItem.replaceAll("<", "\\u003c")};
    document.getElementById('downloadButton').addEventListener('click', () => { if (window.PMW_DOWNLOAD_TRACKING) window.PMW_DOWNLOAD_TRACKING.trackDownload(window.wallpaperDownloadItem); });
    document.getElementById('shareButton').addEventListener('click', async () => { const status = document.getElementById('shareStatus'); try { if (navigator.share) { await navigator.share({ title: ${JSON.stringify(item.title)}, text: ${JSON.stringify(item.description)}, url: ${JSON.stringify(canonical)} }); status.textContent = 'Shared'; } else { await navigator.clipboard.writeText(${JSON.stringify(canonical)}); status.textContent = 'Link copied'; } } catch { status.textContent = 'Share canceled'; } });
  </script>
  <script type="module" src="../../../js/saved-wallpapers.js"></script>
  <script src="../../../js/wallpaper-tools-panel.js" defer></script>
  <script src="../../../consent.js" defer></script>
</body>
</html>
`;
}

function detailPageCss() {
  return `:root{color-scheme:dark;--bg:#050505;--card:#0d0d0d;--text:#fff;--muted:#aaa;--border:rgba(255,255,255,.11)}*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:Inter,system-ui,sans-serif;background:radial-gradient(circle at 18% 0%,rgba(255,255,255,.07),transparent 34%),var(--bg);color:var(--text)}a{color:inherit}.navbar{position:sticky;top:0;z-index:20;margin:14px;border:1px solid var(--border);border-radius:999px;background:rgba(5,5,5,.82);backdrop-filter:blur(18px)}.nav-inner{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:12px 22px}.brand{display:inline-flex;align-items:center;gap:8px;font-family:'Space Grotesk',sans-serif;font-weight:900;text-decoration:none}.brand img{width:68px;height:auto}.nav-links{display:flex;gap:8px}.nav-links a{color:var(--muted);text-decoration:none;font-size:.875rem;font-weight:800;padding:9px 14px;border-radius:999px}.nav-links a:hover{color:#fff;background:rgba(255,255,255,.07)}main{width:min(1240px,calc(100% - 32px));margin:0 auto;padding:46px 0 76px}.breadcrumb{display:flex;gap:10px;flex-wrap:wrap;color:#686868;font-size:.875rem;font-weight:700;margin-bottom:28px}.breadcrumb a{color:var(--muted);text-decoration:none}.wallpaper-layout{display:grid;grid-template-columns:minmax(0,1.18fr) minmax(340px,.82fr);gap:clamp(28px,5vw,64px);align-items:start}.preview-card{border:1px solid var(--border);border-radius:22px;overflow:hidden;background:#111;box-shadow:0 28px 80px rgba(0,0,0,.5)}.preview-card img{width:100%;display:block;aspect-ratio:16/9;object-fit:cover}.kicker{margin:0 0 14px;color:#c9a647;text-transform:uppercase;letter-spacing:.14em;font-size:.76rem;font-weight:900}h1{margin:0 0 20px;font-family:'Space Grotesk',sans-serif;font-size:clamp(2.2rem,4.8vw,4.8rem);line-height:1;letter-spacing:0}.description{margin:0 0 24px;color:var(--muted);font-size:1.02rem;line-height:1.7}.details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:25px 0}.detail{border:1px solid var(--border);border-radius:14px;padding:15px;background:rgba(255,255,255,.035)}.detail span{display:block;margin-bottom:7px;color:#676767;font-size:.7rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.tags,.actions{display:flex;flex-wrap:wrap;gap:8px}.tag{color:var(--muted);border:1px solid var(--border);border-radius:999px;padding:7px 11px;background:rgba(255,255,255,.025);font-size:.8rem;font-weight:700}.actions{margin-top:28px;align-items:center}.download-btn,.share-btn,.secondary-link{display:inline-flex;align-items:center;justify-content:center;min-height:48px;border-radius:13px;padding:12px 17px;font:inherit;font-weight:900;text-decoration:none;cursor:pointer}.download-btn{background:#fff;color:#000}.share-btn,.secondary-link{color:#fff;border:1px solid var(--border);background:rgba(255,255,255,.045)}.share-btn{width:48px;padding:0}.related{margin-top:72px}.related h2{font-family:'Space Grotesk',sans-serif;font-size:clamp(1.8rem,3vw,2.5rem)}.related-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.related-card{overflow:hidden;border:1px solid var(--border);border-radius:14px;background:var(--card);text-decoration:none}.related-card img{width:100%;display:block;aspect-ratio:16/9;object-fit:cover}.related-card span{display:block;padding:12px;font-size:.85rem;font-weight:850;line-height:1.35}@media(max-width:850px){.navbar{border-radius:20px}.wallpaper-layout{grid-template-columns:1fr}.related-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:540px){.nav-inner{align-items:flex-start;flex-direction:column}.details,.related-grid{grid-template-columns:1fr}main{width:min(100% - 22px,1240px)}}`;
}

function updateSitemap(items) {
  let xml = fs.readFileSync(sitemapFile, "utf8");
  const start = `  <!-- ${batchMarker}:start -->`;
  const end = `  <!-- ${batchMarker}:end -->`;
  xml = xml.replace(new RegExp(`\\s*${escapeRegex(start)}[\\s\\S]*?${escapeRegex(end)}\\s*`, "g"), "\n");
  const entries = items.map(item => `  <url>\n    <loc>${siteOrigin}/${escapeXml(item.pageUrl)}</loc>\n    <lastmod>2026-08-07</lastmod>\n  </url>`).join("\n");
  xml = xml.replace("</urlset>", `${start}\n${entries}\n${end}\n</urlset>`);
  fs.writeFileSync(sitemapFile, xml);
}

function slugify(value) { return String(value || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-"); }
function uniqueSlug(base, used) { let slug = base || "desktop-wallpaper"; let suffix = 2; while (used.has(slug)) slug = `${base}-${suffix++}`; used.add(slug); return slug; }
function normalize(value) { return String(value || "").trim().toLowerCase().replace(/\s+/g, " "); }
function hashString(value) { return [...String(value)].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 2166136261); }
function encodeCloudinaryPath(value) { return String(value).split("/").map(encodeURIComponent).join("/"); }
function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function escapeAttribute(value) { return escapeHtml(value); }
function escapeXml(value) { return escapeHtml(value); }
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
