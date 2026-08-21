import {
  navigateForDownloadError,
  requestWallpaperDownload,
  requestWallpaperMetadata
} from "./secure-wallpaper-download.js";

const root = document.querySelector("[data-protected-wallpaper]");
const preview = root?.querySelector(".preview-card");
const image = preview?.querySelector("img");
const downloadButton = document.getElementById("downloadButton");
const wallpaperId = root?.dataset.wallpaperId || "";
const staticDownloadUrl = root?.dataset.downloadUrl || "";

function setDownloadState(label, disabled) {
  if (!downloadButton) return;
  downloadButton.textContent = label;
  downloadButton.disabled = disabled;
  downloadButton.setAttribute("aria-busy", disabled ? "true" : "false");
}

async function initializeProtection() {
  if (!root || !preview || !image || !wallpaperId) return;

  if (staticDownloadUrl) {
    root.dataset.wallpaperAccess = "free";
    preview.classList.remove("has-premium-watermark");
    image.removeAttribute("srcset");
    setDownloadState("Download Wallpaper", false);
    return;
  }

  root.classList.add("protection-pending");
  setDownloadState("Checking access...", true);

  try {
    const metadata = await requestWallpaperMetadata(wallpaperId);
    const premium = metadata.access === "premium";
    root.dataset.wallpaperAccess = metadata.access;
    preview.classList.toggle("has-premium-watermark", premium);
    image.src = metadata.preview;
    image.removeAttribute("srcset");
    setDownloadState(premium ? "Download Premium Wallpaper" : "Download Wallpaper", false);
  } catch (error) {
    console.error("Wallpaper protection initialization failed.", error);
    root.classList.add("protection-error");
    setDownloadState("Preview unavailable", true);
  } finally {
    root.classList.remove("protection-pending");
  }
}

downloadButton?.addEventListener("click", async () => {
  if (!wallpaperId) return;
  setDownloadState("Preparing download...", true);
  try {
    const downloadUrl = staticDownloadUrl || await requestWallpaperDownload(wallpaperId);
    if (window.PMW_DOWNLOAD_TRACKING && window.wallpaperDownloadItem) {
      window.PMW_DOWNLOAD_TRACKING.trackDownload(window.wallpaperDownloadItem);
    }
    window.location.assign(downloadUrl);
  } catch (error) {
    if (!navigateForDownloadError(error)) {
      console.error("Wallpaper download failed.", error);
      setDownloadState(error.message || "Download failed. Try again.", false);
      return;
    }
  }
  setDownloadState("Download Wallpaper", false);
});

initializeProtection();
