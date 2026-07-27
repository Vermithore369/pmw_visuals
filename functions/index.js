const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const crypto = require("node:crypto");
const { defineSecret, defineString } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, Timestamp, getFirestore } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });
const auth = getAuth();
const FIELD_VALUE = FieldValue;
const REGION = "us-central1";

const ACCESS_STATUSES = new Set(["active", "trialing"]);
const LIVE_PRICE_PLANS = {
  pri_01kxsfyk134yk1y741d0vcm45c: "pro",
  pri_01kxsfyktcfcqnckvgjchebghv: "pro",
  pri_01kxsfymg1vph3sg7dw4amqcq6: "advance",
  pri_01kxsfymt7297wfdk1a4s5vgsv: "advance",
  pri_01kxsfynf6yx2790jnrheb3hp4: "elite",
  pri_01kxsfynvy8602e8pyyx255wvc: "elite",
};
const PADDLE_API_KEY = defineSecret("PADDLE_API_KEY");
const PADDLE_NOTIFICATION_WEBHOOK_SECRET = defineSecret("PADDLE_NOTIFICATION_WEBHOOK_SECRET");
const CLOUDINARY_ACCOUNTS_JSON = defineSecret("CLOUDINARY_ACCOUNTS_JSON");
const PADDLE_ENV = defineString("PADDLE_ENV");
const ALLOWED_ORIGINS = new Set([
  "https://pmwvisuals.com",
  "https://www.pmwvisuals.com",
  "https://pmwvisuals.github.io",
  "http://localhost:4181",
  "http://127.0.0.1:4181",
]);

let paddleClient;
let paddleSdk;
let paddleIpCache = null;

function readValue(name, param) {
  let value = process.env[name];
  if (!value && param) {
    value = param.value();
  }
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return String(value).trim();
}

function getPaddle() {
  if (paddleClient) return paddleClient;

  if (!paddleSdk) {
    paddleSdk = require("@paddle/paddle-node-sdk");
  }

  const apiKey = readValue("PADDLE_API_KEY", PADDLE_API_KEY);
  const environmentName = readValue("PADDLE_ENV", PADDLE_ENV).toLowerCase();
  const environmentMap = {
    sandbox: paddleSdk.Environment.sandbox,
    production: paddleSdk.Environment.production,
    live: paddleSdk.Environment.production,
  };
  const environment = environmentMap[environmentName];

  if (!environment) {
    throw new Error("PADDLE_ENV must be sandbox or production");
  }

  paddleClient = new paddleSdk.Paddle(apiKey, { environment });
  return paddleClient;
}

function getPaddleEnvironmentName() {
  return readValue("PADDLE_ENV", PADDLE_ENV).toLowerCase();
}

function getPaddleApiBaseUrl() {
  return getPaddleEnvironmentName() === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
}

function getRequestIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "");
  const firstForwarded = forwarded.split(",")[0]?.trim();
  return firstForwarded || req.ip || req.socket?.remoteAddress || "";
}

function normalizeIpv4(ip) {
  if (!ip) return "";
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  return ip;
}

async function getPaddleWebhookIps() {
  const now = Date.now();
  if (paddleIpCache && paddleIpCache.expiresAt > now) {
    return paddleIpCache.addresses;
  }

  const response = await fetch("https://api.paddle.com/ips");
  if (!response.ok) {
    throw new Error(`Unable to fetch Paddle IP allowlist: ${response.status}`);
  }

  const payload = await response.json();
  const cidrs = payload?.data?.ipv4_cidrs || [];
  const addresses = new Set(
    cidrs
      .filter((cidr) => typeof cidr === "string" && cidr.endsWith("/32"))
      .map((cidr) => cidr.replace("/32", "")),
  );

  paddleIpCache = {
    addresses,
    expiresAt: now + 60 * 60 * 1000,
  };

  return addresses;
}

async function rejectNonPaddleWebhookSource(req, res) {
  if (getPaddleEnvironmentName() === "sandbox") return false;

  const requestIp = normalizeIpv4(getRequestIp(req));
  const allowedIps = await getPaddleWebhookIps();
  if (allowedIps.has(requestIp)) return false;

  logger.warn("Rejected Paddle webhook from non-allowlisted IP", { requestIp });
  res.status(403).send("Forbidden");
  return true;
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.has(origin) || origin.startsWith("http://localhost:"))) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

function normalizeWallpaperAccess(data = {}) {
  const explicit = String(data.access || "").trim().toLowerCase();
  if (explicit === "premium") return "premium";
  return data.premium === true || data.isPremium === true ? "premium" : "free";
}

function getFunctionsBaseUrl() {
  return `https://${REGION}-pmw-visuals-b14e8.cloudfunctions.net`;
}

function sanitizeWallpaperDocument(doc) {
  const data = doc.data() || {};
  const id = doc.id;
  const types = Array.isArray(data.types)
    ? data.types
    : Array.isArray(data.categories)
      ? data.categories
      : data.category
        ? [data.category]
        : [];
  const hashtags = Array.isArray(data.hashtags)
    ? data.hashtags
    : Array.isArray(data.tags)
      ? data.tags
      : [];
  const deviceTypes = Array.isArray(data.deviceTypes)
    ? data.deviceTypes
    : data.deviceType
      ? [data.deviceType]
      : [];
  const baseUrl = getFunctionsBaseUrl();

  return {
    id,
    title: String(data.title || ""),
    description: String(data.description || ""),
    types,
    category: types[0] || String(data.category || "Wallpapers"),
    hashtags,
    tags: hashtags,
    deviceTypes,
    access: normalizeWallpaperAccess(data),
    visible: data.visible !== false,
    width: Number(data.width) || 0,
    height: Number(data.height) || 0,
    format: String(data.format || "Image"),
    thumbnail: `${baseUrl}/wallpaperPreview?id=${encodeURIComponent(id)}&variant=thumbnail`,
    preview: `${baseUrl}/wallpaperPreview?id=${encodeURIComponent(id)}&variant=detail`,
  };
}

function getCloudinarySource(data = {}) {
  const imageUrl = String(data.imageUrl || data.image || data.preview || "").trim();
  const previewUrl = String(
    data.previewUrl || data.protectedPreviewUrl || imageUrl,
  ).trim();
  const publicId = String(
    data.cloudinaryPublicId || data.public_id || data.publicId || "",
  ).trim();
  const cloudNameMatch = imageUrl.match(/res\.cloudinary\.com\/([^/]+)\//i);
  const cloudName = String(data.cloudinaryCloudName || cloudNameMatch?.[1] || "").trim();
  return {
    imageUrl,
    previewUrl,
    publicId,
    cloudName,
    format: String(data.format || "").replace(/^\./, "").toLowerCase(),
    resourceType: String(data.resourceType || "image"),
    deliveryType: String(data.deliveryType || data.cloudinaryDeliveryType || "upload"),
  };
}

function addCloudinaryTransformation(url, transformation) {
  const value = String(url || "");
  const marker = "/image/upload/";
  const markerIndex = value.indexOf(marker);
  if (markerIndex < 0) return value;

  const prefix = value.slice(0, markerIndex + marker.length);
  const suffix = value.slice(markerIndex + marker.length)
    .replace(/^(?:[a-z][a-z0-9_:-]*(?:,[a-z0-9_:.()-]+)*\/)+(?=v\d+\/)/i, "");
  return `${prefix}${transformation}/${suffix}`;
}

function parseCloudinaryAccounts() {
  const raw = readValue("CLOUDINARY_ACCOUNTS_JSON", CLOUDINARY_ACCOUNTS_JSON);
  let accounts;
  try {
    accounts = JSON.parse(raw);
  } catch (error) {
    throw new Error("CLOUDINARY_ACCOUNTS_JSON must be valid JSON");
  }
  if (!accounts || typeof accounts !== "object") {
    throw new Error("CLOUDINARY_ACCOUNTS_JSON must contain a Cloudinary account map");
  }
  return accounts;
}

function getCloudinaryCredentials(cloudName) {
  const account = parseCloudinaryAccounts()[cloudName];
  const apiKey = String(account?.apiKey || account?.api_key || "").trim();
  const apiSecret = String(account?.apiSecret || account?.api_secret || "").trim();
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(`Cloudinary credentials are not configured for ${cloudName || "this wallpaper"}`);
  }
  return { cloudName, apiKey, apiSecret };
}

async function getWallpaperDocument(id) {
  const wallpaperId = String(id || "").trim();
  if (!wallpaperId || wallpaperId.length > 220 || wallpaperId.includes("/")) {
    return null;
  }
  const snap = await db.collection("wallpapers").doc(wallpaperId).get();
  return snap.exists ? snap : null;
}

async function getOptionalUser(req) {
  const authHeader = req.header("authorization") || "";
  const match = authHeader.match(/^Bearer (.+)$/i);
  if (!match) return null;
  return auth.verifyIdToken(match[1]);
}

async function hasActivePaddleSubscription(uid) {
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) return false;
  const user = userSnap.data() || {};
  const customerId = String(user.paddleCustomerId || user.paddle_customer_id || "");
  if (!customerId) return false;

  const subscriptions = await db
    .collection("paddleSubscriptions")
    .where("customer_id", "==", customerId)
    .get();

  return subscriptions.docs.some((doc) => (
    ACCESS_STATUSES.has(String(doc.data()?.status || "").toLowerCase())
  ));
}

function buildFreeDownloadUrl(source, fileName) {
  if (!source.imageUrl) {
    throw new Error("Wallpaper source is not configured");
  }
  const attachment = `fl_attachment:${fileName}`;
  return addCloudinaryTransformation(source.imageUrl, attachment);
}

function buildSignedCloudinaryDownload(source, fileName) {
  if (!source.publicId || !source.cloudName) {
    throw new Error("Secure Cloudinary source is incomplete");
  }
  const credentials = getCloudinaryCredentials(source.cloudName);
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    attachment: "true",
    expires_at: String(timestamp + 5 * 60),
    format: source.format || "png",
    public_id: source.publicId,
    timestamp: String(timestamp),
    type: source.deliveryType,
  };
  const signaturePayload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  const signature = crypto
    .createHash("sha1")
    .update(`${signaturePayload}${credentials.apiSecret}`)
    .digest("hex");
  const query = new URLSearchParams({
    ...params,
    signature,
    api_key: credentials.apiKey,
  });
  // The private download endpoint is time limited. Cloudinary controls the
  // attachment filename for this endpoint, so fileName is intentionally not
  // sent as an unsigned parameter.
  void fileName;
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(credentials.cloudName)}/${encodeURIComponent(source.resourceType)}/download?${query}`;
}

function isoToDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : Timestamp.fromDate(date);
}

function serializeForFirestore(value) {
  if (value == null) return null;
  return JSON.parse(JSON.stringify(value));
}

function getFirstItem(data) {
  return Array.isArray(data.items) && data.items.length > 0 ? data.items[0] : {};
}

function getCustomerId(data) {
  return data.customerId || data.customer_id || "";
}

function getPriceId(data) {
  const item = getFirstItem(data);
  return item.price?.id || item.priceId || item.price_id || "";
}

function getProductId(data) {
  const item = getFirstItem(data);
  return item.price?.productId || item.price?.product_id || item.product?.id || item.productId || item.product_id || "";
}

function getPlanFromPrice(priceId) {
  const planMap = {
    ...LIVE_PRICE_PLANS,
    [process.env.PADDLE_PRO_MONTHLY_PRICE_ID]: "pro",
    [process.env.PADDLE_PRO_YEARLY_PRICE_ID]: "pro",
    [process.env.PADDLE_ADVANCE_MONTHLY_PRICE_ID]: "advance",
    [process.env.PADDLE_ADVANCE_YEARLY_PRICE_ID]: "advance",
    [process.env.PADDLE_ELITE_MONTHLY_PRICE_ID]: "elite",
    [process.env.PADDLE_ELITE_YEARLY_PRICE_ID]: "elite",
  };

  return planMap[priceId] || "premium";
}

async function upsertWebhookEvent(event) {
  if (!event.eventId) return;
  await db.collection("paddleWebhookEvents").doc(event.eventId).set(
    {
      event_id: event.eventId,
      event_type: event.eventType,
      occurred_at: isoToDate(event.occurredAt),
      processed_at: FIELD_VALUE.serverTimestamp(),
    },
    { merge: true },
  );
}

async function mirrorCustomer(data, event = {}) {
  if (!data?.id) return null;

  const email = data.email || "";
  await db.collection("paddleCustomers").doc(data.id).set(
    {
      customer_id: data.id,
      email,
      email_lower: String(email).toLowerCase(),
      name: data.name || "",
      status: data.status || "",
      created_at: isoToDate(data.createdAt || data.created_at) || FIELD_VALUE.serverTimestamp(),
      updated_at: FIELD_VALUE.serverTimestamp(),
      paddle_updated_at: isoToDate(data.updatedAt || data.updated_at),
      source_event_id: event.eventId || "",
      source_event_type: event.eventType || "",
    },
    { merge: true },
  );

  return {
    customer_id: data.id,
    email,
    email_lower: String(email).toLowerCase(),
  };
}

async function fetchPaddleEntity(path) {
  const response = await fetch(`${getPaddleApiBaseUrl()}${path}`, {
    headers: {
      Authorization: `Bearer ${readValue("PADDLE_API_KEY", PADDLE_API_KEY)}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Paddle API request failed for ${path}: ${response.status}`);
  }

  const payload = await response.json();
  return payload?.data || null;
}

async function ensureCustomerMirror(customerId) {
  if (!customerId) return null;

  const customerRef = db.collection("paddleCustomers").doc(customerId);
  const customerSnap = await customerRef.get();
  const existing = customerSnap.exists ? customerSnap.data() : null;
  if (existing?.email) return existing;

  const customer = await fetchPaddleEntity(`/customers/${customerId}`);
  if (!customer?.id) return existing;
  return mirrorCustomer(customer, {
    eventId: existing?.source_event_id || "",
    eventType: existing?.source_event_type || "customer.backfill",
  });
}

async function handleCustomer(event) {
  const data = event.data || {};
  if (!data.id) return;

  await mirrorCustomer(data, event);
  await syncAccessForCustomer(data.id);
}

async function handleSubscription(event) {
  const data = event.data || {};
  if (!data.id) return;

  const priceId = getPriceId(data);
  const scheduledChange = data.scheduledChange || {};

  await db.collection("paddleSubscriptions").doc(data.id).set(
    {
      subscription_id: data.id,
      customer_id: getCustomerId(data),
      status: data.status || "",
      price_id: priceId,
      product_id: getProductId(data),
      plan: getPlanFromPrice(priceId),
      scheduled_change_action: scheduledChange.action || null,
      scheduled_change_at: isoToDate(scheduledChange.effectiveAt),
      created_at: isoToDate(data.createdAt) || FIELD_VALUE.serverTimestamp(),
      updated_at: FIELD_VALUE.serverTimestamp(),
      current_billing_period: serializeForFirestore(data.currentBillingPeriod),
      source_event_id: event.eventId || "",
      source_event_type: event.eventType,
    },
    { merge: true },
  );

  const customerId = getCustomerId(data);
  if (customerId) {
    await ensureCustomerMirror(customerId);
    await syncAccessForCustomer(customerId);
  }
}

async function handleTransactionCompleted(event) {
  const data = event.data || {};
  if (!data.id) return;

  await db.collection("paddleTransactions").doc(data.id).set(
    {
      transaction_id: data.id,
      customer_id: getCustomerId(data),
      subscription_id: data.subscriptionId || data.subscription_id || "",
      status: data.status || "",
      currency_code: data.currencyCode || "",
      totals: serializeForFirestore(data.totals),
      items: serializeForFirestore(data.items) || [],
      created_at: isoToDate(data.createdAt) || FIELD_VALUE.serverTimestamp(),
      updated_at: FIELD_VALUE.serverTimestamp(),
      billed_at: isoToDate(data.billedAt),
      source_event_id: event.eventId || "",
      source_event_type: event.eventType,
    },
    { merge: true },
  );

  const customerId = getCustomerId(data);
  if (customerId) {
    await ensureCustomerMirror(customerId);
    await syncAccessForCustomer(customerId);
  }
}

async function getBestSubscription(customerId) {
  const snap = await db
    .collection("paddleSubscriptions")
    .where("customer_id", "==", customerId)
    .get();

  let best = null;
  snap.forEach((doc) => {
    const data = doc.data();
    if (!best) {
      best = data;
      return;
    }
    const bestGrants = ACCESS_STATUSES.has(String(best.status || "").toLowerCase());
    const currentGrants = ACCESS_STATUSES.has(String(data.status || "").toLowerCase());
    if (currentGrants && !bestGrants) best = data;
  });

  return best;
}

async function syncAccessForCustomer(customerId) {
  await ensureCustomerMirror(customerId);

  const customerSnap = await db.collection("paddleCustomers").doc(customerId).get();
  if (!customerSnap.exists) return;
  const customer = customerSnap.data();
  const email = customer.email || "";
  if (!email) return;
  const emailLower = email.toLowerCase();

  const subscription = await getBestSubscription(customerId);
  const grantsAccess = ACCESS_STATUSES.has(String(subscription?.status || "").toLowerCase());
  const plan = grantsAccess ? subscription.plan || "premium" : "free";

  const usersSnap = await db.collection("users").where("email", "==", email).get();
  const lowerUsersSnap = await db.collection("users").where("email_lower", "==", emailLower).get();
  const batch = db.batch();
  const userRefs = new Map();

  usersSnap.forEach((userDoc) => userRefs.set(userDoc.id, userDoc.ref));
  lowerUsersSnap.forEach((userDoc) => userRefs.set(userDoc.id, userDoc.ref));

  try {
    const authUser = await auth.getUserByEmail(email);
    userRefs.set(authUser.uid, db.collection("users").doc(authUser.uid));
  } catch (error) {
    logger.warn("No Firebase Auth user found for Paddle customer email", { emailLower });
  }

  userRefs.forEach((userRef) => {
    batch.set(
      userRef,
      {
        email,
        email_lower: emailLower,
        premium: grantsAccess,
        role: grantsAccess ? "premium" : "member",
        plan,
        paddleCustomerId: customerId,
        paddleSubscriptionId: subscription?.subscription_id || null,
        paddleSubscriptionStatus: subscription?.status || null,
        premiumUpdatedAt: FIELD_VALUE.serverTimestamp(),
      },
      { merge: true },
    );
  });

  if (userRefs.size) {
    await batch.commit();
  }
}

async function routePaddleEvent(event) {
  await upsertWebhookEvent(event);

  switch (event.eventType) {
    case "customer.created":
    case "customer.updated":
      await handleCustomer(event);
      break;
    case "subscription.created":
    case "subscription.activated":
    case "subscription.updated":
    case "subscription.canceled":
      await handleSubscription(event);
      break;
    case "transaction.completed":
      await handleTransactionCompleted(event);
      break;
    default:
      logger.info("Ignoring Paddle event", { eventType: event.eventType });
  }
}

exports.paddleWebhook = onRequest(
  {
    region: REGION,
    invoker: "public",
    secrets: [PADDLE_API_KEY, PADDLE_NOTIFICATION_WEBHOOK_SECRET],
  },
  async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  if (await rejectNonPaddleWebhookSource(req, res)) {
    return;
  }

  const signature = req.header("paddle-signature");
  if (!signature) {
    res.status(400).send("Missing Paddle signature");
    return;
  }

  const rawBody = req.rawBody ? req.rawBody.toString("utf8") : "";
  if (!rawBody) {
    res.status(400).send("Missing raw request body");
    return;
  }

  try {
    const secret = readValue("PADDLE_NOTIFICATION_WEBHOOK_SECRET", PADDLE_NOTIFICATION_WEBHOOK_SECRET);
    const event = await getPaddle().webhooks.unmarshal(rawBody, secret, signature);
    await routePaddleEvent(event);
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error("Paddle webhook failed", error);
    res.status(400).send(`Webhook failed: ${error.message || "Unknown error"}`);
  }
});

exports.createPaddlePortalSession = onRequest(
  {
    region: REGION,
    invoker: "public",
    secrets: [PADDLE_API_KEY],
  },
  async (req, res) => {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const authHeader = req.header("authorization") || "";
    const match = authHeader.match(/^Bearer (.+)$/i);
    if (!match) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const decodedToken = await auth.verifyIdToken(match[1]);
    const userRecord = await auth.getUser(decodedToken.uid);
    const email = userRecord.email || decodedToken.email || "";
    if (!email) {
      res.status(400).json({ error: "Account email is required" });
      return;
    }

    const customerSnap = await db
      .collection("paddleCustomers")
      .where("email_lower", "==", email.toLowerCase())
      .limit(1)
      .get();

    if (customerSnap.empty) {
      res.status(404).json({ error: "No Paddle customer found for this account" });
      return;
    }

    const customer = customerSnap.docs[0].data();
    const subscriptionSnap = await db
      .collection("paddleSubscriptions")
      .where("customer_id", "==", customer.customer_id)
      .get();
    const subscriptionIds = subscriptionSnap.docs.map((doc) => doc.id);

    const session = await getPaddle().customerPortalSessions.create(
      customer.customer_id,
      subscriptionIds,
    );

    const portalUrl =
      session.urls?.general?.overview ||
      session.urls?.subscriptions ||
      session.urls?.overview;

    if (!portalUrl) {
      throw new Error("Paddle did not return a customer portal URL");
    }

    res.status(200).json({ url: portalUrl });
  } catch (error) {
    logger.error("Unable to create Paddle portal session", error);
    res.status(500).json({ error: "Unable to open billing portal" });
  }
});

exports.listWallpapers = onRequest(
  {
    region: REGION,
    invoker: "public",
  },
  async (req, res) => {
    setCors(req, res);
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    try {
      const requestedAccess = String(req.body?.access || "").toLowerCase();
      const snapshot = await db.collection("wallpapers").where("visible", "==", true).get();
      const items = snapshot.docs
        .map(sanitizeWallpaperDocument)
        .filter((item) => (
          requestedAccess !== "free" && requestedAccess !== "premium"
            ? true
            : item.access === requestedAccess
        ));
      res.set("Cache-Control", "public, max-age=60, s-maxage=300");
      res.status(200).json({ items });
    } catch (error) {
      logger.error("Unable to list sanitized wallpapers", error);
      res.status(500).json({ error: "Unable to load wallpapers" });
    }
  },
);

exports.getWallpaperMetadata = onRequest(
  {
    region: REGION,
    invoker: "public",
  },
  async (req, res) => {
    setCors(req, res);
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    try {
      const wallpaper = await getWallpaperDocument(req.body?.id);
      if (!wallpaper || wallpaper.data()?.visible === false) {
        res.status(404).json({ error: "Wallpaper not found" });
        return;
      }
      res.set("Cache-Control", "no-store");
      res.status(200).json(sanitizeWallpaperDocument(wallpaper));
    } catch (error) {
      logger.error("Unable to load sanitized wallpaper metadata", error);
      res.status(500).json({ error: "Unable to load wallpaper" });
    }
  },
);

exports.wallpaperPreview = onRequest(
  {
    region: REGION,
    invoker: "public",
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    try {
      const wallpaper = await getWallpaperDocument(req.query.id);
      if (!wallpaper || wallpaper.data()?.visible === false) {
        res.status(404).send("Wallpaper not found");
        return;
      }
      const source = getCloudinarySource(wallpaper.data());
      if (!source.previewUrl) {
        res.status(404).send("Wallpaper preview is unavailable");
        return;
      }
      const variant = req.query.variant === "thumbnail" ? "thumbnail" : "detail";
      const transformation = variant === "thumbnail"
        ? "c_limit,w_640,q_68,f_auto"
        : "c_limit,w_1400,q_76,f_auto";
      const upstream = await fetch(addCloudinaryTransformation(source.previewUrl, transformation));
      if (!upstream.ok) {
        throw new Error(`Cloudinary preview returned ${upstream.status}`);
      }
      const bytes = Buffer.from(await upstream.arrayBuffer());
      res.set("Content-Type", upstream.headers.get("content-type") || "image/jpeg");
      res.set("Content-Length", String(bytes.length));
      res.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
      res.set("X-Content-Type-Options", "nosniff");
      res.status(200).send(bytes);
    } catch (error) {
      logger.error("Unable to serve wallpaper preview", error);
      res.status(502).send("Wallpaper preview is unavailable");
    }
  },
);

exports.downloadWallpaper = onRequest(
  {
    region: REGION,
    invoker: "public",
    secrets: [CLOUDINARY_ACCOUNTS_JSON],
  },
  async (req, res) => {
    setCors(req, res);
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    try {
      const wallpaper = await getWallpaperDocument(req.body?.id);
      if (!wallpaper || wallpaper.data()?.visible === false) {
        res.status(404).json({ error: "Wallpaper not found" });
        return;
      }

      const data = wallpaper.data() || {};
      const access = normalizeWallpaperAccess(data);
      const source = getCloudinarySource(data);
      const randomNumber = Math.floor(10000 + Math.random() * 90000);
      const fileName = `PMW_Wallpapers_${randomNumber}`;

      if (access === "premium") {
        const user = await getOptionalUser(req);
        if (!user) {
          res.status(401).json({ error: "Sign in to download this premium wallpaper" });
          return;
        }
        if (!await hasActivePaddleSubscription(user.uid)) {
          res.status(403).json({ error: "An active premium subscription is required" });
          return;
        }
      }

      const downloadUrl = access === "premium"
        ? buildSignedCloudinaryDownload(source, fileName)
        : buildFreeDownloadUrl(source, fileName);

      res.set("Cache-Control", "no-store");
      res.status(200).json({
        downloadUrl,
        expiresIn: access === "premium" ? 300 : null,
      });
    } catch (error) {
      logger.error("Wallpaper download failed", error);
      res.status(500).json({ error: "Unable to prepare this download" });
    }
  },
);
