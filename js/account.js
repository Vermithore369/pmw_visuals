import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { isPremiumUser } from "./premium-access.js";
import { getSavedWallpapers } from "./saved-wallpapers.js";

const nameEl = document.querySelector("#accountName");
const emailEl = document.querySelector("#accountEmail");
const planEl = document.querySelector("#accountPlan");
const msg = document.querySelector("#accountMessage");
const logoutBtn = document.querySelector("#logoutBtn");
const premiumAction = document.querySelector("#premiumAction");
const accountTierStat = document.querySelector("#accountTierStat");
const billingPortalBtn = document.querySelector("#billingPortalBtn");
const billingPortalCopy = document.querySelector("#billingPortalCopy");
const accountPlanSummary = document.querySelector("#accountPlanSummary");
const accountEmailSummary = document.querySelector("#accountEmailSummary");
const memberSince = document.querySelector("#memberSince");

const BILLING_PORTAL_LABEL = "Manage or Cancel Subscription";
const savedWallpapersCount = document.querySelector("#savedWallpapersCount");
const savedWallpaperPreviewStrip = document.querySelector("#savedWallpaperPreviewStrip");
const downloadedWallpapersCount = document.querySelector("#downloadedWallpapersCount");
const downloadedWallpaperPreviewStrip = document.querySelector("#downloadedWallpaperPreviewStrip");
const recentActivityEmpty = document.querySelector("#recentActivityEmpty");
const DOWNLOAD_STORAGE_KEY = "pmw_download_events_v1";
const FUNCTIONS_BASE_URL =
  window.PMW_FUNCTIONS_BASE_URL || "https://us-central1-pmw-visuals-b14e8.cloudfunctions.net";

const setText = (element, value) => {
  if (element) {
    element.textContent = value;
  }
};

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#039;",
}[char]));

const getSavedTime = (item) => {
  if (item.savedAt?.toMillis) return item.savedAt.toMillis();
  if (item.savedAt) return new Date(item.savedAt).getTime() || 0;
  return 0;
};

const getDownloadEvents = () => {
  try {
    return JSON.parse(localStorage.getItem(DOWNLOAD_STORAGE_KEY) || "[]")
      .filter((item) => item && item.type === "wallpaper");
  } catch {
    return [];
  }
};

const renderSavedWallpapers = (savedWallpapers) => {
  setText(savedWallpapersCount, String(savedWallpapers.length));

  if (!savedWallpapers.length) return;

  const previewItems = savedWallpapers
    .slice()
    .sort((a, b) => getSavedTime(b) - getSavedTime(a))
    .slice(0, 4);

  if (savedWallpaperPreviewStrip) {
    savedWallpaperPreviewStrip.innerHTML = previewItems.map((item) => `
      <a href="${escapeHtml(item.url || "pmw-wallpapers.html")}" title="${escapeHtml(item.title || "Saved wallpaper")}">
        <img src="${escapeHtml(item.image || "")}" alt="${escapeHtml(item.title || "Saved wallpaper")}">
      </a>
    `).join("");
  }

  if (recentActivityEmpty) {
    setText(recentActivityEmpty.querySelector("strong"), `${savedWallpapers.length} saved wallpaper${savedWallpapers.length === 1 ? "" : "s"}`);
    setText(recentActivityEmpty.querySelector("p"), "Your saved wallpapers are ready from this account.");
  }
};

const renderDownloadedWallpapers = () => {
  const downloads = getDownloadEvents()
    .slice()
    .reverse()
    .filter((item, index, items) => {
      const key = `${item.id || ""}|${item.url || ""}`;
      return items.findIndex((candidate) => `${candidate.id || ""}|${candidate.url || ""}` === key) === index;
    });

  setText(downloadedWallpapersCount, String(downloads.length));

  const previewItems = downloads
    .filter((item) => item.image)
    .slice(0, 4);

  if (downloadedWallpaperPreviewStrip && previewItems.length) {
    downloadedWallpaperPreviewStrip.innerHTML = previewItems.map((item) => `
      <a href="${escapeHtml(item.url || "pmw-wallpapers.html")}" title="${escapeHtml(item.title || "Downloaded wallpaper")}">
        <img src="${escapeHtml(item.image || "")}" alt="${escapeHtml(item.title || "Downloaded wallpaper")}">
      </a>
    `).join("");
  }
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const displayName = user.displayName || "PMW Member";
  const email = user.email || "No email available";
  const createdAt = user.metadata?.creationTime ? new Date(user.metadata.creationTime) : null;

  setText(nameEl, displayName);
  setText(emailEl, email);
  setText(accountEmailSummary, email);
  setText(
    memberSince,
    createdAt
      ? createdAt.toLocaleDateString(undefined, { month: "short", year: "numeric" })
      : "Today"
  );

  const isPremium = await isPremiumUser(user);
  const planName = isPremium ? "Premium Member" : "Free Member";
  const accountStatus = isPremium ? "Premium access active." : "Free Plan";

  setText(planEl, planName);
  setText(accountPlanSummary, planName);
  setText(msg, accountStatus);
  setText(accountTierStat, isPremium ? "Premium" : "Free Plan");
  if (isPremium) {
    premiumAction.textContent = "Open Premium";
    premiumAction.href = "premium-wallpapers.html";
    billingPortalBtn.hidden = false;
    billingPortalBtn.textContent = BILLING_PORTAL_LABEL;
    billingPortalBtn.dataset.defaultLabel = BILLING_PORTAL_LABEL;
    setText(
      billingPortalCopy,
      "Manage your subscription, cancel your plan, update payment details, or view invoices through the secure Paddle customer portal."
    );
  } else {
    premiumAction.textContent = "Go Premium";
    premiumAction.href = "premium.html";
    billingPortalBtn.hidden = true;
    billingPortalBtn.textContent = BILLING_PORTAL_LABEL;
    billingPortalBtn.dataset.defaultLabel = BILLING_PORTAL_LABEL;
    setText(
      billingPortalCopy,
      "Free users can upgrade anytime. Subscription management appears here after you become a premium member."
    );
  }

  try {
    renderSavedWallpapers(await getSavedWallpapers(user));
  } catch (error) {
    console.warn("Unable to load saved wallpapers.", error);
  }

  renderDownloadedWallpapers();
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

billingPortalBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  billingPortalBtn.disabled = true;
  billingPortalBtn.dataset.defaultLabel = billingPortalBtn.textContent;
  billingPortalBtn.textContent = "Opening...";
  msg.textContent = "Opening secure Paddle billing portal...";

  try {
    const token = await user.getIdToken();
    const response = await fetch(`${FUNCTIONS_BASE_URL}/createPaddlePortalSession`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.url) {
      throw new Error(payload.error || "Unable to open billing portal.");
    }

    window.location.href = payload.url;
  } catch (error) {
    console.error(error);
    msg.textContent = error.message || "Unable to open billing portal.";
    billingPortalBtn.disabled = false;
    billingPortalBtn.textContent = billingPortalBtn.dataset.defaultLabel || BILLING_PORTAL_LABEL;
  }
});
