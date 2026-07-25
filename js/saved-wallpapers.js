import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const SAVE_SELECTOR = "[data-save-wallpaper]";
const savedIds = new Set();
let currentUser = auth.currentUser || null;
let observerStarted = false;
let stylesInjected = false;
let authReadyResolve;
const authReady = new Promise((resolve) => {
  authReadyResolve = resolve;
});

function safeId(value) {
  return String(value || "")
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function getCollectionRef(user = currentUser) {
  if (!user) return null;
  return collection(db, "users", user.uid, "savedWallpapers");
}

function getDocRef(id, user = currentUser) {
  if (!user || !id) return null;
  return doc(db, "users", user.uid, "savedWallpapers", id);
}

function getPagePayload() {
  const imageObject = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map((script) => {
      try {
        return JSON.parse(script.textContent || "{}");
      } catch {
        return null;
      }
    })
    .find((item) => item && item["@type"] === "ImageObject");

  const title = imageObject?.name || document.querySelector("h1")?.textContent || document.title;
  const image = imageObject?.thumbnailUrl
    || imageObject?.contentUrl
    || document.querySelector('meta[property="og:image"]')?.content
    || document.querySelector(".preview-card img, #panelImage")?.src
    || "";

  return {
    id: safeId(location.pathname.replace(/\.html$/i, "")) || safeId(title),
    title,
    image,
    url: location.href,
    category: document.querySelector(".kicker, #panelCategory")?.textContent || "",
  };
}

function getButtonPayload(button) {
  const pagePayload = getPagePayload();
  return {
    id: safeId(button.dataset.wallpaperId || pagePayload.id),
    title: button.dataset.wallpaperTitle || pagePayload.title,
    image: button.dataset.wallpaperImage || pagePayload.image,
    url: button.dataset.wallpaperUrl || pagePayload.url,
    category: button.dataset.wallpaperCategory || pagePayload.category,
  };
}

function saveIconMarkup(saved, label = "") {
  return `
    <svg class="save-wallpaper-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6.5 4.75A2.25 2.25 0 0 1 8.75 2.5h6.5a2.25 2.25 0 0 1 2.25 2.25v16.1l-5.5-3.35-5.5 3.35V4.75Z"${saved ? " fill=\"currentColor\"" : " fill=\"none\""} stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    </svg>
    ${label ? `<span>${label}</span>` : `<span class="save-wallpaper-sr">${saved ? "Saved wallpaper" : "Save wallpaper"}</span>`}
  `;
}

function updateButton(button) {
  const payload = getButtonPayload(button);
  const isSaved = savedIds.has(payload.id);
  button.classList.toggle("is-saved", isSaved);
  button.setAttribute("aria-pressed", isSaved ? "true" : "false");
  button.setAttribute("title", isSaved ? "Remove from saved wallpapers" : "Save wallpaper");
  const label = button.classList.contains("wallpaper-save-chip") ? "" : (isSaved ? "Saved" : "Save");
  button.innerHTML = saveIconMarkup(isSaved, label);
}

function refreshButtons(root = document) {
  root.querySelectorAll(SAVE_SELECTOR).forEach(updateButton);
}

async function loadSavedIds(user = currentUser) {
  savedIds.clear();
  if (!user) {
    refreshButtons();
    return;
  }

  try {
    const snapshot = await getDocs(getCollectionRef(user));
    snapshot.forEach((item) => savedIds.add(item.id));
  } catch (error) {
    console.warn("Unable to load saved wallpapers.", error);
  }
  refreshButtons();
}

async function isWallpaperSaved(id, user = currentUser) {
  await authReady;
  const cleanId = safeId(id);
  if (!user || !cleanId) return false;
  if (savedIds.has(cleanId)) return true;

  const ref = getDocRef(cleanId, user);
  if (!ref) return false;
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) {
    savedIds.add(cleanId);
    return true;
  }
  return false;
}

async function saveWallpaper(payload, user = currentUser) {
  await authReady;
  if (!user) {
    window.location.href = `/login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
    return false;
  }

  const cleanId = safeId(payload.id);
  const ref = getDocRef(cleanId, user);
  if (!ref) return false;

  await setDoc(ref, {
    id: cleanId,
    title: String(payload.title || "Untitled wallpaper"),
    image: String(payload.image || ""),
    url: String(payload.url || location.href),
    category: String(payload.category || ""),
    savedAt: serverTimestamp(),
  }, { merge: true });
  savedIds.add(cleanId);
  return true;
}

async function unsaveWallpaper(id, user = currentUser) {
  await authReady;
  if (!user) return false;

  const cleanId = safeId(id);
  const ref = getDocRef(cleanId, user);
  if (!ref) return false;

  await deleteDoc(ref);
  savedIds.delete(cleanId);
  return true;
}

async function toggleSaved(button) {
  const payload = getButtonPayload(button);
  if (!payload.id) return;

  button.classList.add("is-busy");
  try {
    if (!currentUser) {
      window.location.href = `/login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
      return;
    }

    if (savedIds.has(payload.id) || await isWallpaperSaved(payload.id)) {
      await unsaveWallpaper(payload.id);
    } else {
      await saveWallpaper(payload);
    }
    refreshButtons();
  } catch (error) {
    console.error("Unable to update saved wallpaper.", error);
    button.textContent = "Try again";
  } finally {
    button.classList.remove("is-busy");
  }
}

function handleSaveClick(event) {
  const button = event.target.closest(SAVE_SELECTOR);
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  toggleSaved(button);
}

function addDetailSaveButton() {
  const actions = document.querySelector(".actions");
  if (!actions || actions.querySelector(SAVE_SELECTOR)) return;

  const payload = getPagePayload();
  const button = document.createElement("button");
  button.className = "save-wallpaper-btn";
  button.type = "button";
  button.dataset.saveWallpaper = "true";
  button.dataset.wallpaperId = payload.id;
  button.dataset.wallpaperTitle = payload.title;
  button.dataset.wallpaperImage = payload.image;
  button.dataset.wallpaperUrl = payload.url;
  button.dataset.wallpaperCategory = payload.category;
  button.setAttribute("aria-pressed", "false");

  const shareButton = actions.querySelector(".share-btn");
  if (shareButton) {
    shareButton.insertAdjacentElement("afterend", button);
  } else {
    actions.append(button);
  }
  updateButton(button);
}

function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    .save-wallpaper-btn,
    .wallpaper-save-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255,255,255,0.18);
      color: #fff;
      background: rgba(5,5,5,0.68);
      backdrop-filter: blur(14px);
      font: inherit;
      font-weight: 900;
      cursor: pointer;
      transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
    }
    .save-wallpaper-icon {
      width: 18px;
      height: 18px;
      display: block;
    }
    .save-wallpaper-sr {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
    }
    .save-wallpaper-btn {
      min-height: 48px;
      border-radius: 14px;
      padding: 13px 18px;
      gap: 9px;
    }
    .wallpaper-save-chip {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 3;
      width: 34px;
      height: 34px;
      border-radius: 999px;
      padding: 0;
      font-size: 0.72rem;
      box-shadow: 0 8px 24px rgba(0,0,0,0.34);
    }
    .save-wallpaper-btn:hover,
    .wallpaper-save-chip:hover {
      transform: translateY(-1px);
      border-color: rgba(216,173,76,0.48);
      background: rgba(216,173,76,0.16);
    }
    .save-wallpaper-btn.is-saved,
    .wallpaper-save-chip.is-saved {
      color: #111;
      border-color: rgba(255,231,169,0.5);
      background: linear-gradient(135deg, #fff3bd, #d8ad4c);
      box-shadow: 0 12px 28px rgba(216,173,76,0.2);
    }
    .save-wallpaper-btn.is-busy,
    .wallpaper-save-chip.is-busy {
      opacity: 0.7;
      pointer-events: none;
    }
  `;
  document.head.append(style);
}

function startObserver() {
  if (observerStarted) return;
  observerStarted = true;
  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          refreshButtons(node);
        }
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

async function getSavedWallpapers(user = currentUser) {
  await authReady;
  if (!user) return [];
  const snapshot = await getDocs(getCollectionRef(user));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function initializeSavedWallpaperButtons() {
  injectStyles();
  addDetailSaveButton();
  refreshButtons();
  startObserver();
  document.addEventListener("click", handleSaveClick);
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  loadSavedIds(user).finally(() => {
    authReadyResolve();
  });
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeSavedWallpaperButtons, { once: true });
} else {
  initializeSavedWallpaperButtons();
}

window.PMW_SAVED_WALLPAPERS = {
  getSavedWallpapers,
  isWallpaperSaved,
  refreshButtons,
  saveWallpaper,
  unsaveWallpaper,
};

export {
  getSavedWallpapers,
  initializeSavedWallpaperButtons,
  isWallpaperSaved,
  saveWallpaper,
  unsaveWallpaper,
};
