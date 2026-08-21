const CACHE_TTL_MS = 0;
const FUNCTIONS_BASE_URL = window.PMW_FUNCTIONS_BASE_URL
  || "https://us-central1-pmw-visuals-b14e8.cloudfunctions.net";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeAccess(value) {
  return normalizeText(value).toLowerCase() === "premium" ? "premium" : "free";
}

function cleanList(values) {
  const seen = new Set();
  return values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .flatMap((value) => String(value || "").split(/[\s,]+/))
    .map((value) => value.replace(/^#+/, "").trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function cleanTypes(item) {
  const values = [];
  if (Array.isArray(item.types)) values.push(...item.types);
  if (Array.isArray(item.categories)) values.push(...item.categories);
  if (item.category) values.push(item.category);

  const seen = new Set();
  return values
    .map(normalizeText)
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildResolution(item) {
  const width = Number(item.width) || 0;
  const height = Number(item.height) || 0;
  return item.resolution || (width && height ? `${width}x${height}` : "Mobile");
}

function normalizeWallpaper(id, item, source) {
  const imageUrl = source === "static"
    ? normalizeText(item.imageUrl || item.preview || item.download || item.thumbnail)
    : "";
  const types = cleanTypes(item);
  const access = normalizeAccess(item.access || (item.premium || item.isPremium ? "premium" : "free"));
  const tags = cleanList([item.hashtags || [], item.tags || []]).map((tag) => tag.toLowerCase());
  const deviceTypes = cleanList([item.deviceTypes || [], item.deviceType || "", item.device || ""]).map((type) => type.toLowerCase());

  return {
    id: normalizeText(id || item.id),
    title: normalizeText(item.title),
    description: normalizeText(item.description),
    imageUrl,
    cloudinaryPublicId: source === "static"
      ? normalizeText(item.cloudinaryPublicId || item.public_id || item.publicId)
      : "",
    types,
    category: types[0] || normalizeText(item.category) || "Wallpapers",
    tags,
    deviceTypes,
    access,
    visible: item.visible !== false,
    width: Number(item.width) || 0,
    height: Number(item.height) || 0,
    resolution: buildResolution(item),
    format: normalizeText(item.format).toUpperCase() || "Image",
    thumbnail: normalizeText(item.thumbnail) || imageUrl,
    preview: normalizeText(item.preview) || imageUrl,
    download: source === "static"
      ? normalizeText(item.download) || imageUrl
      : "",
    source
  };
}

function staticFallbackWallpapers(fallback, access) {
  return (Array.isArray(fallback) ? fallback : [])
    .map((item) => normalizeWallpaper(item.id, item, "static"))
    .filter((item) => item.visible && item.access === access);
}

function cacheKey(access) {
  return `pmw:wallpapers:${access}:v2`;
}

function readCache(access) {
  if (CACHE_TTL_MS <= 0) return null;
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey(access)) || "null");
    if (!cached || Date.now() - cached.savedAt > CACHE_TTL_MS) return null;
    return Array.isArray(cached.items) ? cached.items : null;
  } catch (error) {
    return null;
  }
}

function writeCache(access, items) {
  if (CACHE_TTL_MS <= 0) return;
  try {
    sessionStorage.setItem(cacheKey(access), JSON.stringify({
      savedAt: Date.now(),
      items
    }));
  } catch (error) {
    // Cache is only an optimization. Ignore quota or privacy-mode failures.
  }
}

async function fetchProtectedWallpapers(access) {
  const cached = readCache(access);
  if (cached) return cached;

  const response = await fetch(`${FUNCTIONS_BASE_URL}/listWallpapers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Unable to load protected wallpaper metadata");
  }

  const items = (Array.isArray(payload.items) ? payload.items : [])
    .map((item) => normalizeWallpaper(item.id, item, "protected"))
    .filter((item) => item.visible && item.access === access);

  writeCache(access, items);
  return items;
}

export async function loadVisibleWallpapers({ access = "free", fallback = [], allowFallback = true } = {}) {
  const normalizedAccess = normalizeAccess(access);
  const fallbackItems = staticFallbackWallpapers(fallback, normalizedAccess);

  if (normalizedAccess === "free" && fallbackItems.length) {
    return {
      items: fallbackItems,
      source: "static",
      error: null
    };
  }

  try {
    const protectedItems = await fetchProtectedWallpapers(normalizedAccess);
    if (protectedItems.length || !allowFallback) {
      return {
        items: protectedItems,
        source: "protected",
        error: null
      };
    }
  } catch (error) {
    if (!allowFallback) throw error;
    return {
      items: fallbackItems,
      source: "static",
      error
    };
  }

  return {
    items: fallbackItems,
    source: "static",
    error: null
  };
}

export function normalizeStaticWallpapers({ access = "free", fallback = [] } = {}) {
  return staticFallbackWallpapers(fallback, normalizeAccess(access));
}
