const FUNCTIONS_BASE_URL = window.PMW_FUNCTIONS_BASE_URL
  || "https://us-central1-pmw-visuals-b14e8.cloudfunctions.net";

async function getCurrentUserToken() {
  try {
    const [{ auth }, { onAuthStateChanged }] = await Promise.all([
      import("./firebase.js"),
      import("https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js")
    ]);
    const user = auth.currentUser || await new Promise((resolve) => {
      let unsubscribe = () => {};
      unsubscribe = onAuthStateChanged(auth, (nextUser) => {
        unsubscribe();
        resolve(nextUser);
      });
    });
    return user ? user.getIdToken() : "";
  } catch (error) {
    return "";
  }
}

export async function requestWallpaperMetadata(id) {
  const response = await fetch(`${FUNCTIONS_BASE_URL}/getWallpaperMetadata`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Unable to load wallpaper protection status");
  }
  return payload;
}

export async function requestWallpaperDownload(id) {
  const token = await getCurrentUserToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${FUNCTIONS_BASE_URL}/downloadWallpaper`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Unable to prepare wallpaper download");
    error.status = response.status;
    throw error;
  }
  return payload.downloadUrl;
}

export function navigateForDownloadError(error) {
  if (error?.status === 401) {
    window.location.href = `/login.html?returnUrl=${encodeURIComponent(location.pathname)}`;
    return true;
  }
  if (error?.status === 403) {
    window.location.href = "/premium.html";
    return true;
  }
  return false;
}
