import { auth, db } from "./firebase.js";
import { requireAdmin } from "./admin-auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const CLOUDINARY_CLOUD_NAME = "udl5ib1p";
const CLOUDINARY_UPLOAD_PRESET = "PMWVISUALS";

const loadingPanel = document.querySelector("#adminLoadingPanel");
const deniedPanel = document.querySelector("#adminDeniedPanel");
const dashboardPanel = document.querySelector("#adminDashboardPanel");
const adminEmail = document.querySelector("#adminEmail");
const logoutButton = document.querySelector("#adminLogoutButton");
const deniedLogoutButton = document.querySelector("#adminDeniedLogoutButton");
const form = document.querySelector("#addWallpaperForm");
const titleInput = document.querySelector("#wallpaperTitle");
const descriptionInput = document.querySelector("#wallpaperDescription");
const imageUrlInput = document.querySelector("#wallpaperImageUrl");
const publicIdInput = document.querySelector("#wallpaperPublicId");
const hashtagsInput = document.querySelector("#wallpaperHashtags");
const accessInput = document.querySelector("#wallpaperAccess");
const visibleInput = document.querySelector("#wallpaperVisible");
const typeList = document.querySelector("#wallpaperTypes");
const deviceTypeList = document.querySelector("#wallpaperDeviceTypes");
const uploadButton = document.querySelector("#cloudinaryUploadButton");
const uploadStatus = document.querySelector("#uploadStatus");
const previewPanel = document.querySelector("#imagePreviewPanel");
const previewImage = document.querySelector("#imagePreview");
const imageMeta = document.querySelector("#imageMeta");
const publishButton = document.querySelector("#publishWallpaperButton");
const resetButton = document.querySelector("#resetWallpaperButton");
const formMessage = document.querySelector("#wallpaperFormMessage");
const reloadWallpapersButton = document.querySelector("#reloadWallpapersButton");
const wallpaperSearchInput = document.querySelector("#wallpaperSearch");
const manageMessage = document.querySelector("#manageWallpapersMessage");
const wallpapersList = document.querySelector("#wallpapersList");
const screenFilterInput = document.querySelector("#wallpaperScreenFilter");
const sourceFilterInput = document.querySelector("#wallpaperSourceFilter");
const accessFilterInput = document.querySelector("#wallpaperAccessFilter");
const visibleFilterInput = document.querySelector("#wallpaperVisibleFilter");
const sortInput = document.querySelector("#wallpaperSort");
const editPanel = document.querySelector("#editWallpaperPanel");
const editForm = document.querySelector("#editWallpaperForm");
const editId = document.querySelector("#editWallpaperId");
const editTitleInput = document.querySelector("#editWallpaperTitle");
const editDescriptionInput = document.querySelector("#editWallpaperDescription");
const editImageUrlInput = document.querySelector("#editWallpaperImageUrl");
const editPublicIdInput = document.querySelector("#editWallpaperPublicId");
const editHashtagsInput = document.querySelector("#editWallpaperHashtags");
const editAccessInput = document.querySelector("#editWallpaperAccess");
const editVisibleInput = document.querySelector("#editWallpaperVisible");
const editTypeList = document.querySelector("#editWallpaperTypes");
const editDeviceTypeList = document.querySelector("#editWallpaperDeviceTypes");
const editPreviewPanel = document.querySelector("#editImagePreviewPanel");
const editPreviewImage = document.querySelector("#editImagePreview");
const saveEditButton = document.querySelector("#saveEditWallpaperButton");
const cancelEditButton = document.querySelector("#cancelEditWallpaperButton");
const cancelEditButtonBottom = document.querySelector("#cancelEditWallpaperButtonBottom");
const editMessage = document.querySelector("#editWallpaperMessage");

let cloudinaryWidget = null;
let uploadInProgress = false;
let wallpapers = [];
let editingWallpaperId = "";
let imageDetails = {
  width: 0,
  height: 0,
  format: ""
};

const DEVICE_TYPES = [
  { value: "mobile", label: "Mobile / Phone" },
  { value: "desktop", label: "Desktop / Wide screen" }
];

function showPanel(panel) {
  [loadingPanel, deniedPanel, dashboardPanel].forEach((item) => {
    item.hidden = item !== panel;
  });
}

async function logout() {
  await signOut(auth);
  window.location.replace("admin-login.html");
}

function setMessage(element, text, type = "") {
  element.textContent = text;
  element.className = type ? `admin-message ${type}` : "admin-message";
}

function setPublishState() {
  publishButton.disabled = uploadInProgress;
}

function getCategories() {
  const categories = [
    ...(window.PMW_WALLPAPER_CATEGORIES || []),
    ...(window.PMW_DESKTOP_WALLPAPER_CATEGORIES || [])
  ].filter(Boolean);

  if (categories.length) return Array.from(new Set(categories));

  return [
    "AMOLED",
    "Anime",
    "Celestial Samurai",
    "Dark Aesthetic",
    "Dark Fantasy",
    "Fantasy",
    "Minimalist",
    "Nature",
    "Nature Desktop",
    "Romantic",
    "Space",
    "Space and Galaxy"
  ];
}

function renderCheckboxOptions(container, idPrefix, selectedTypes = []) {
  const selected = new Set(selectedTypes);
  container.innerHTML = getCategories().map((category, index) => `
    <label class="admin-check" for="${idPrefix}${index}">
      <input id="${idPrefix}${index}" type="checkbox" value="${category}" ${selected.has(category) ? "checked" : ""}>
      <span>${category}</span>
    </label>
  `).join("");
}

function renderTypeOptions() {
  renderCheckboxOptions(typeList, "wallpaperType");
}

function getSelectedTypes(container = typeList) {
  return Array.from(container.querySelectorAll("input:checked")).map((input) => input.value);
}

function normalizeDeviceTypes(values) {
  const allowed = new Set(DEVICE_TYPES.map((item) => item.value));
  const normalized = Array.isArray(values) ? values : [values];
  return Array.from(new Set(
    normalized
      .flat()
      .map((value) => String(value || "").trim().toLowerCase())
      .filter((value) => allowed.has(value))
  ));
}

function inferDeviceTypes(data = {}) {
  const explicit = normalizeDeviceTypes([
    data.deviceTypes || [],
    data.deviceType || "",
    data.device || ""
  ]);
  if (explicit.length) return explicit;

  const width = Number(data.width) || 0;
  const height = Number(data.height) || 0;
  if (width && height && width > height) return ["desktop"];
  return ["mobile"];
}

function renderDeviceOptions(container, idPrefix, selectedTypes = ["mobile"]) {
  const selected = new Set(normalizeDeviceTypes(selectedTypes));
  if (!selected.size) selected.add("mobile");

  container.innerHTML = DEVICE_TYPES.map((item, index) => `
    <label class="admin-check" for="${idPrefix}${index}">
      <input id="${idPrefix}${index}" type="checkbox" value="${item.value}" ${selected.has(item.value) ? "checked" : ""}>
      <span>${item.label}</span>
    </label>
  `).join("");
}

function renderDeviceTypeOptions() {
  renderDeviceOptions(deviceTypeList, "wallpaperDeviceType", ["mobile"]);
}

function getSelectedDeviceTypes(container = deviceTypeList) {
  return normalizeDeviceTypes(Array.from(container.querySelectorAll("input:checked")).map((input) => input.value));
}

function setSelectedDeviceTypes(container, selectedTypes) {
  const selected = new Set(normalizeDeviceTypes(selectedTypes));
  container.querySelectorAll("input").forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function setDeviceTypesFromDimensions(width, height) {
  if (!width || !height) return;
  setSelectedDeviceTypes(deviceTypeList, width > height ? ["desktop"] : ["mobile"]);
}

function parseHashtags(value) {
  const seen = new Set();
  return String(value || "")
    .split(/[\s,]+/)
    .map((tag) => tag.replace(/^#+/, "").trim().toLowerCase())
    .filter(Boolean)
    .filter((tag) => {
      if (seen.has(tag)) return false;
      seen.add(tag);
      return true;
    });
}

function isCloudinaryUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com";
  } catch (error) {
    return false;
  }
}

function updatePreview() {
  const imageUrl = imageUrlInput.value.trim();
  if (!imageUrl) {
    previewPanel.hidden = true;
    previewImage.removeAttribute("src");
    return;
  }

  previewImage.src = imageUrl;
  previewPanel.hidden = false;
  const details = [];
  if (imageDetails.width && imageDetails.height) details.push(`${imageDetails.width}x${imageDetails.height}`);
  if (imageDetails.format) details.push(imageDetails.format.toUpperCase());
  if (imageDetails.width && imageDetails.height) details.push(imageDetails.width > imageDetails.height ? "desktop" : "mobile");
  imageMeta.textContent = details.length
    ? details.join(" - ")
    : "Preview loaded from the image URL. Width, height, and format are saved when available from upload.";
}

function resetImageDetails() {
  imageDetails = {
    width: 0,
    height: 0,
    format: ""
  };
}

function fillFromCloudinaryUpload(info) {
  imageUrlInput.value = info.secure_url || "";
  publicIdInput.value = info.public_id || "";
  imageDetails = {
    width: Number(info.width) || 0,
    height: Number(info.height) || 0,
    format: String(info.format || "").toUpperCase()
  };
  setDeviceTypesFromDimensions(imageDetails.width, imageDetails.height);
  updatePreview();
}

function initCloudinaryWidget() {
  if (!CLOUDINARY_UPLOAD_PRESET) {
    uploadButton.disabled = true;
    setMessage(uploadStatus, "Add your unsigned Cloudinary upload preset in js/admin.js to enable direct uploads.");
    return;
  }

  if (!window.cloudinary?.createUploadWidget) {
    uploadButton.disabled = true;
    setMessage(uploadStatus, "Cloudinary Upload Widget could not be loaded.", "error");
    return;
  }

  cloudinaryWidget = window.cloudinary.createUploadWidget(
    {
      cloudName: CLOUDINARY_CLOUD_NAME,
      uploadPreset: CLOUDINARY_UPLOAD_PRESET,
      sources: ["local"],
      multiple: false,
      resourceType: "image",
      clientAllowedFormats: ["png", "jpg", "jpeg", "webp"],
      maxFileSize: 12000000
    },
    (error, result) => {
      if (error) {
        uploadInProgress = false;
        setPublishState();
        setMessage(uploadStatus, error.message || "Cloudinary upload failed.", "error");
        return;
      }

      if (!result) return;

      if (result.event === "upload-added" || result.event === "queues-start") {
        uploadInProgress = true;
        setPublishState();
        setMessage(uploadStatus, "Uploading image to Cloudinary...");
      }

      if (result.event === "success") {
        fillFromCloudinaryUpload(result.info || {});
        setMessage(uploadStatus, "Upload complete. Image details were added to the form.", "success");
      }

      if (result.event === "queues-end" || result.event === "close") {
        uploadInProgress = false;
        setPublishState();
      }
    }
  );
}

function validateWallpaper() {
  const title = titleInput.value.trim();
  const imageUrl = imageUrlInput.value.trim();
  const types = getSelectedTypes();
  const deviceTypes = getSelectedDeviceTypes();
  const access = accessInput.value;

  if (!title) return "Title is required.";
  if (!imageUrl) return "Image URL is required.";
  if (!isCloudinaryUrl(imageUrl)) return "Image URL must be a secure Cloudinary URL.";
  if (!types.length) return "Select at least one image type.";
  if (!deviceTypes.length) return "Select at least one wallpaper screen type.";
  if (!["free", "premium"].includes(access)) return "Choose a valid access level.";
  if (uploadInProgress) return "Wait for the Cloudinary upload to finish before publishing.";
  return "";
}

function getWallpaperPayload() {
  return {
    title: titleInput.value.trim(),
    description: descriptionInput.value.trim(),
    imageUrl: imageUrlInput.value.trim(),
    cloudinaryPublicId: publicIdInput.value.trim(),
    types: getSelectedTypes(),
    deviceTypes: getSelectedDeviceTypes(),
    hashtags: parseHashtags(hashtagsInput.value),
    access: accessInput.value,
    visible: visibleInput.value === "true",
    width: imageDetails.width,
    height: imageDetails.height,
    format: imageDetails.format,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

function resetForm() {
  form.reset();
  resetImageDetails();
  renderDeviceTypeOptions();
  previewPanel.hidden = true;
  previewImage.removeAttribute("src");
  setMessage(uploadStatus, CLOUDINARY_UPLOAD_PRESET ? "" : "Add your unsigned Cloudinary upload preset in js/admin.js to enable direct uploads.");
  setMessage(formMessage, "");
  setPublishState();
}

function setSavingState(isSaving) {
  publishButton.disabled = isSaving || uploadInProgress;
  publishButton.textContent = isSaving ? "Saving..." : "Publish wallpaper";
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.href;
  } catch (error) {
    return String(value || "").trim();
  }
}

function normalizeWallpaper(docSnap) {
  const data = docSnap.data() || {};
  const createdAtMillis = typeof data.createdAt?.toMillis === "function" ? data.createdAt.toMillis() : 0;
  const updatedAtMillis = typeof data.updatedAt?.toMillis === "function" ? data.updatedAt.toMillis() : createdAtMillis;
  return {
    id: docSnap.id,
    source: "firestore",
    title: String(data.title || ""),
    description: String(data.description || ""),
    imageUrl: String(data.imageUrl || ""),
    cloudinaryPublicId: String(data.cloudinaryPublicId || ""),
    types: Array.isArray(data.types) ? data.types.map(String) : [],
    deviceTypes: inferDeviceTypes(data),
    hashtags: Array.isArray(data.hashtags) ? data.hashtags.map(String) : [],
    access: data.access === "premium" ? "premium" : "free",
    visible: data.visible !== false,
    width: Number(data.width) || 0,
    height: Number(data.height) || 0,
    format: String(data.format || ""),
    createdAtMillis,
    updatedAtMillis
  };
}

function getStaticDesktopUrls(item) {
  return [
    item.image,
    item.imageUrl,
    item.download,
    item.preview,
    item.thumbnail
  ].map(normalizeUrl).filter(Boolean);
}

function normalizeStaticDesktopWallpaper(item, index) {
  const id = String(item.id || `desktop-wallpaper-${index + 1}`).trim();
  const imageUrl = String(item.image || item.imageUrl || item.download || item.preview || item.thumbnail || "").trim();
  const types = [item.category, ...(Array.isArray(item.types) ? item.types : [])]
    .map((type) => String(type || "").trim())
    .filter(Boolean);

  return {
    id,
    source: "static-desktop",
    title: String(item.title || ""),
    description: String(item.description || ""),
    imageUrl,
    cloudinaryCloudName: "nhxfoykh",
    cloudinaryPublicId: String(item.publicId || item.public_id || item.cloudinaryPublicId || ""),
    types: Array.from(new Set(types)),
    deviceTypes: ["desktop"],
    hashtags: parseHashtags(Array.isArray(item.tags) ? item.tags.join(",") : item.hashtags || ""),
    access: item.access === "premium" || item.premium || item.isPremium ? "premium" : "free",
    visible: item.visible !== false,
    width: Number(item.width) || 0,
    height: Number(item.height) || 0,
    format: String(item.format || "").toUpperCase(),
    staticUrls: getStaticDesktopUrls(item)
  };
}

function getMissingStaticDesktopWallpapers(firestoreItems) {
  const existingIds = new Set(firestoreItems.map((item) => item.id));
  const existingPublicIds = new Set(
    firestoreItems
      .map((item) => normalizeText(item.cloudinaryPublicId))
      .filter(Boolean)
  );
  const existingUrls = new Set(
    firestoreItems
      .map((item) => normalizeUrl(item.imageUrl))
      .filter(Boolean)
  );

  return (window.PMW_DESKTOP_WALLPAPERS || [])
    .map(normalizeStaticDesktopWallpaper)
    .filter((item) => item.id && item.title && item.imageUrl && item.types.length)
    .filter((item) => {
      const publicId = normalizeText(item.cloudinaryPublicId);
      return !existingIds.has(item.id)
        && (!publicId || !existingPublicIds.has(publicId))
        && !item.staticUrls.some((url) => existingUrls.has(url));
    });
}

function getFirestorePayloadFromWallpaper(wallpaper, access = wallpaper.access) {
  return {
    title: wallpaper.title.trim(),
    description: wallpaper.description.trim(),
    imageUrl: wallpaper.imageUrl.trim(),
    cloudinaryCloudName: wallpaper.cloudinaryCloudName || "",
    cloudinaryPublicId: wallpaper.cloudinaryPublicId.trim(),
    types: wallpaper.types,
    deviceTypes: wallpaper.deviceTypes,
    hashtags: wallpaper.hashtags,
    access,
    visible: wallpaper.visible,
    width: wallpaper.width,
    height: wallpaper.height,
    format: wallpaper.format,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

function matchesWallpaper(wallpaper, query) {
  const term = query.trim();
  if (!term) return true;

  const lowered = normalizeText(term);
  const exactUrl = normalizeUrl(term);
  return normalizeText(wallpaper.title).includes(lowered)
    || normalizeText(wallpaper.cloudinaryPublicId).includes(lowered)
    || normalizeText(wallpaper.id).includes(lowered)
    || normalizeUrl(wallpaper.imageUrl) === exactUrl
    || (Array.isArray(wallpaper.staticUrls) && wallpaper.staticUrls.includes(exactUrl));
}

function hasDeviceType(wallpaper, type) {
  return Array.isArray(wallpaper.deviceTypes) && wallpaper.deviceTypes.includes(type);
}

function getScreenGroup(wallpaper) {
  const hasMobile = hasDeviceType(wallpaper, "mobile");
  const hasDesktop = hasDeviceType(wallpaper, "desktop");
  if (hasMobile && hasDesktop) return "both";
  if (hasDesktop) return "desktop";
  if (hasMobile) return "mobile";
  return "unknown";
}

function matchesScreenFilter(wallpaper) {
  const value = screenFilterInput.value;
  if (value === "all") return true;
  return getScreenGroup(wallpaper) === value;
}

function matchesSourceFilter(wallpaper) {
  const value = sourceFilterInput.value;
  if (value === "all") return true;
  return wallpaper.source === value;
}

function matchesAccessFilter(wallpaper) {
  const value = accessFilterInput.value;
  if (value === "all") return true;
  return wallpaper.access === value;
}

function matchesVisibleFilter(wallpaper) {
  const value = visibleFilterInput.value;
  if (value === "all") return true;
  return value === "visible" ? wallpaper.visible : !wallpaper.visible;
}

function getUpdatedMillis(wallpaper) {
  return Number(wallpaper.updatedAtMillis || wallpaper.createdAtMillis) || 0;
}

function sortWallpapers(items) {
  const sorted = [...items];
  const sortValue = sortInput.value;

  sorted.sort((a, b) => {
    if (sortValue === "title-desc") return b.title.localeCompare(a.title);
    if (sortValue === "updated-desc") return getUpdatedMillis(b) - getUpdatedMillis(a) || a.title.localeCompare(b.title);
    if (sortValue === "updated-asc") return getUpdatedMillis(a) - getUpdatedMillis(b) || a.title.localeCompare(b.title);
    if (sortValue === "category-asc") return (a.types[0] || "").localeCompare(b.types[0] || "") || a.title.localeCompare(b.title);
    if (sortValue === "access-asc") return a.access.localeCompare(b.access) || a.title.localeCompare(b.title);
    return a.title.localeCompare(b.title);
  });

  return sorted;
}

function getFilteredWallpapers() {
  const query = wallpaperSearchInput.value;
  return sortWallpapers(wallpapers.filter((wallpaper) => (
    matchesWallpaper(wallpaper, query)
    && matchesScreenFilter(wallpaper)
    && matchesSourceFilter(wallpaper)
    && matchesAccessFilter(wallpaper)
    && matchesVisibleFilter(wallpaper)
  )));
}

function createPill(text, muted = false) {
  const pill = document.createElement("span");
  pill.className = muted ? "admin-pill is-muted" : "admin-pill";
  pill.textContent = text;
  return pill;
}

function createActionButton(label, action, id, variant = "secondary") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `admin-button ${variant}`;
  button.dataset.action = action;
  button.dataset.id = id;
  button.textContent = label;
  return button;
}

function getScreenGroupLabel(group) {
  if (group === "desktop") return "Desktop Wallpapers";
  if (group === "mobile") return "Mobile Wallpapers";
  if (group === "both") return "Mobile and Desktop";
  return "No Screen Type";
}

function createWallpaperSection(group, count) {
  const section = document.createElement("section");
  section.className = "admin-wallpaper-group";
  section.dataset.group = group;

  const heading = document.createElement("div");
  heading.className = "admin-wallpaper-group-heading";

  const title = document.createElement("h3");
  title.textContent = getScreenGroupLabel(group);

  const countText = document.createElement("span");
  countText.textContent = `${count} item${count === 1 ? "" : "s"}`;

  heading.append(title, countText);
  section.append(heading);
  return section;
}

function createWallpaperItem(wallpaper) {
  const item = document.createElement("article");
  item.className = "admin-wallpaper-item";

  const thumbnail = document.createElement("img");
  thumbnail.className = "admin-wallpaper-thumb";
  thumbnail.src = wallpaper.imageUrl;
  thumbnail.alt = "";
  thumbnail.loading = "lazy";

  const details = document.createElement("div");
  const title = document.createElement("p");
  title.className = "admin-wallpaper-title";
  title.textContent = wallpaper.title || "Untitled wallpaper";
  const publicId = document.createElement("p");
  publicId.className = "admin-wallpaper-meta";
  publicId.textContent = wallpaper.cloudinaryPublicId
    ? `Cloudinary: ${wallpaper.cloudinaryPublicId}`
    : "Cloudinary public ID is empty";
  const docId = document.createElement("p");
  docId.className = "admin-wallpaper-id";
  docId.textContent = wallpaper.source === "static-desktop"
    ? `Static desktop ID: ${wallpaper.id}`
    : `Doc: ${wallpaper.id}`;
  details.append(title, publicId, docId);

  const tags = document.createElement("div");
  tags.className = "admin-wallpaper-tags";
  const typeText = wallpaper.types.length ? wallpaper.types.join(", ") : "No type";
  const deviceText = wallpaper.deviceTypes.length
    ? wallpaper.deviceTypes.map((type) => type === "desktop" ? "Desktop" : "Mobile").join(", ")
    : "No screen type";
  tags.append(
    createPill(typeText, !wallpaper.types.length),
    createPill(deviceText, !wallpaper.deviceTypes.length),
    wallpaper.source === "static-desktop" ? createPill("Not in Firestore", true) : createPill("Firestore"),
    createPill(wallpaper.access === "premium" ? "Premium" : "Free"),
    createPill(wallpaper.visible ? "Visible" : "Hidden", !wallpaper.visible)
  );

  const actions = document.createElement("div");
  actions.className = "admin-wallpaper-actions";
  if (wallpaper.source === "static-desktop") {
    actions.append(
      createActionButton("Add to Firestore", "import-static", wallpaper.id),
      createActionButton("Make Premium", "import-static-premium", wallpaper.id)
    );
  } else {
    actions.append(
      createActionButton("Edit", "edit", wallpaper.id),
      createActionButton(wallpaper.access === "premium" ? "Make Free" : "Make Premium", "toggle-access", wallpaper.id),
      createActionButton(wallpaper.visible ? "Hide" : "Show", "toggle-visible", wallpaper.id),
      createActionButton("Delete", "delete", wallpaper.id, "danger")
    );
  }

  item.append(thumbnail, details, tags, actions);
  return item;
}

function renderWallpaperItems(items) {
  const shouldGroup = screenFilterInput.value === "all";
  if (!shouldGroup) {
    items.forEach((wallpaper) => wallpapersList.append(createWallpaperItem(wallpaper)));
    return;
  }

  const groups = ["desktop", "mobile", "both", "unknown"];
  groups.forEach((group) => {
    const groupItems = items.filter((wallpaper) => getScreenGroup(wallpaper) === group);
    if (!groupItems.length) return;

    const section = createWallpaperSection(group, groupItems.length);
    groupItems.forEach((wallpaper) => section.append(createWallpaperItem(wallpaper)));
    wallpapersList.append(section);
  });
}

function renderWallpapers() {
  wallpapersList.replaceChildren();
  const filtered = getFilteredWallpapers();

  if (!wallpapers.length) {
    setMessage(manageMessage, "No Firestore or static desktop wallpaper records found.");
    return;
  }

  if (!filtered.length) {
    setMessage(manageMessage, "No wallpapers match that search.");
    return;
  }

  setMessage(manageMessage, `Showing ${filtered.length} of ${wallpapers.length} wallpaper record${wallpapers.length === 1 ? "" : "s"}. Static desktop items must be added to Firestore before full editing.`);
  renderWallpaperItems(filtered);
}

async function loadWallpapers(successText = "") {
  reloadWallpapersButton.disabled = true;
  setMessage(manageMessage, "Loading wallpapers...");
  wallpapersList.replaceChildren();

  try {
    const snapshot = await getDocs(collection(db, "wallpapers"));
    const firestoreWallpapers = snapshot.docs.map(normalizeWallpaper);
    const staticDesktopWallpapers = getMissingStaticDesktopWallpapers(firestoreWallpapers);
    wallpapers = [...firestoreWallpapers, ...staticDesktopWallpapers]
      .sort((a, b) => a.title.localeCompare(b.title));
    renderWallpapers();
    if (successText) setMessage(manageMessage, successText, "success");
  } catch (error) {
    console.error("Unable to load wallpapers.", error);
    setMessage(manageMessage, error.message.replace("Firebase: ", ""), "error");
  } finally {
    reloadWallpapersButton.disabled = false;
  }
}

function findWallpaper(id) {
  return wallpapers.find((wallpaper) => wallpaper.id === id);
}

function updateEditPreview() {
  const imageUrl = editImageUrlInput.value.trim();
  if (!imageUrl) {
    editPreviewPanel.hidden = true;
    editPreviewImage.removeAttribute("src");
    return;
  }

  editPreviewImage.src = imageUrl;
  editPreviewPanel.hidden = false;
}

function openEditWallpaper(id) {
  const wallpaper = findWallpaper(id);
  if (!wallpaper) {
    setMessage(manageMessage, "That wallpaper record could not be found. Reload and try again.", "error");
    return;
  }

  editingWallpaperId = id;
  editId.textContent = id;
  editTitleInput.value = wallpaper.title;
  editDescriptionInput.value = wallpaper.description;
  editImageUrlInput.value = wallpaper.imageUrl;
  editPublicIdInput.value = wallpaper.cloudinaryPublicId;
  editHashtagsInput.value = wallpaper.hashtags.join(", ");
  editAccessInput.value = wallpaper.access;
  editVisibleInput.value = String(wallpaper.visible);
  renderCheckboxOptions(editTypeList, "editWallpaperType", wallpaper.types);
  renderDeviceOptions(editDeviceTypeList, "editWallpaperDeviceType", wallpaper.deviceTypes);
  updateEditPreview();
  setMessage(editMessage, "");
  editPanel.hidden = false;
  editPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeEditWallpaper() {
  editingWallpaperId = "";
  editForm.reset();
  editPanel.hidden = true;
  editPreviewPanel.hidden = true;
  editPreviewImage.removeAttribute("src");
  setMessage(editMessage, "");
}

function validateEditWallpaper() {
  const title = editTitleInput.value.trim();
  const imageUrl = editImageUrlInput.value.trim();
  const types = getSelectedTypes(editTypeList);
  const deviceTypes = getSelectedDeviceTypes(editDeviceTypeList);
  const access = editAccessInput.value;

  if (!editingWallpaperId) return "Choose a wallpaper to edit first.";
  if (!title) return "Title is required.";
  if (!imageUrl) return "Image URL is required.";
  if (!isCloudinaryUrl(imageUrl)) return "Image URL must be a secure Cloudinary URL.";
  if (!types.length) return "Select at least one image type.";
  if (!deviceTypes.length) return "Select at least one wallpaper screen type.";
  if (!["free", "premium"].includes(access)) return "Choose a valid access level.";
  return "";
}

function getEditPayload() {
  const existing = findWallpaper(editingWallpaperId);
  return {
    title: editTitleInput.value.trim(),
    description: editDescriptionInput.value.trim(),
    imageUrl: editImageUrlInput.value.trim(),
    cloudinaryPublicId: editPublicIdInput.value.trim(),
    types: getSelectedTypes(editTypeList),
    deviceTypes: getSelectedDeviceTypes(editDeviceTypeList),
    hashtags: parseHashtags(editHashtagsInput.value),
    access: editAccessInput.value,
    visible: editVisibleInput.value === "true",
    width: existing?.width || 0,
    height: existing?.height || 0,
    format: existing?.format || "",
    updatedAt: serverTimestamp()
  };
}

function setEditSavingState(isSaving) {
  saveEditButton.disabled = isSaving;
  saveEditButton.textContent = isSaving ? "Saving..." : "Save changes";
}

async function updateWallpaperFields(id, fields, successText) {
  setMessage(manageMessage, "Saving changes...");
  try {
    await updateDoc(doc(db, "wallpapers", id), {
      ...fields,
      updatedAt: serverTimestamp()
    });
    await loadWallpapers(successText);
  } catch (error) {
    console.error("Unable to update wallpaper.", error);
    setMessage(manageMessage, error.message.replace("Firebase: ", ""), "error");
  }
}

async function importStaticDesktopWallpaper(wallpaper, access) {
  setMessage(manageMessage, `Adding "${wallpaper.title}" to Firestore...`);
  try {
    await setDoc(doc(db, "wallpapers", wallpaper.id), getFirestorePayloadFromWallpaper(wallpaper, access));
    await loadWallpapers(`Desktop wallpaper added to Firestore as ${access}.`);
  } catch (error) {
    console.error("Unable to import static desktop wallpaper.", error);
    setMessage(manageMessage, error.message.replace("Firebase: ", ""), "error");
  }
}

async function handleWallpaperAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  const wallpaper = findWallpaper(id);
  if (!wallpaper) {
    setMessage(manageMessage, "That wallpaper record could not be found. Reload and try again.", "error");
    return;
  }

  if (action === "edit") {
    openEditWallpaper(id);
    return;
  }

  button.disabled = true;

  if (action === "import-static" || action === "import-static-premium") {
    const nextAccess = action === "import-static-premium" ? "premium" : "free";
    await importStaticDesktopWallpaper(wallpaper, nextAccess);
  }

  if (action === "toggle-access") {
    const nextAccess = wallpaper.access === "premium" ? "free" : "premium";
    await updateWallpaperFields(id, { access: nextAccess }, `Wallpaper changed to ${nextAccess}.`);
  }

  if (action === "toggle-visible") {
    const nextVisible = !wallpaper.visible;
    await updateWallpaperFields(id, { visible: nextVisible }, `Wallpaper is now ${nextVisible ? "visible" : "hidden"}.`);
  }

  if (action === "delete") {
    const confirmed = window.confirm(`Delete Firestore metadata for "${wallpaper.title || wallpaper.id}"? The Cloudinary image will not be deleted.`);
    if (!confirmed) {
      button.disabled = false;
      return;
    }

    setMessage(manageMessage, "Deleting wallpaper metadata...");
    try {
      await deleteDoc(doc(db, "wallpapers", id));
      if (editingWallpaperId === id) closeEditWallpaper();
      await loadWallpapers("Wallpaper metadata deleted. The Cloudinary image was not deleted.");
    } catch (error) {
      console.error("Unable to delete wallpaper.", error);
      setMessage(manageMessage, error.message.replace("Firebase: ", ""), "error");
      button.disabled = false;
    }
  }

  if (button.isConnected) button.disabled = false;
}

requireAdmin({
  onAllowed(user) {
    adminEmail.textContent = user.email || user.uid;
    showPanel(dashboardPanel);
    loadWallpapers();
  },
  onDenied(user) {
    adminEmail.textContent = user.email || user.uid;
    showPanel(deniedPanel);
  }
});

logoutButton.addEventListener("click", logout);
deniedLogoutButton.addEventListener("click", logout);

renderTypeOptions();
renderDeviceTypeOptions();
initCloudinaryWidget();
setPublishState();

uploadButton.addEventListener("click", () => {
  if (!cloudinaryWidget) return;
  cloudinaryWidget.open();
});

imageUrlInput.addEventListener("input", () => {
  resetImageDetails();
  updatePreview();
});

resetButton.addEventListener("click", resetForm);
reloadWallpapersButton.addEventListener("click", loadWallpapers);
wallpaperSearchInput.addEventListener("input", renderWallpapers);
screenFilterInput.addEventListener("change", renderWallpapers);
sourceFilterInput.addEventListener("change", renderWallpapers);
accessFilterInput.addEventListener("change", renderWallpapers);
visibleFilterInput.addEventListener("change", renderWallpapers);
sortInput.addEventListener("change", renderWallpapers);
wallpapersList.addEventListener("click", handleWallpaperAction);
editImageUrlInput.addEventListener("input", updateEditPreview);
cancelEditButton.addEventListener("click", closeEditWallpaper);
cancelEditButtonBottom.addEventListener("click", closeEditWallpaper);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(formMessage, "");

  const validationMessage = validateWallpaper();
  if (validationMessage) {
    setMessage(formMessage, validationMessage, "error");
    return;
  }

  setSavingState(true);
  setMessage(formMessage, "Saving wallpaper...");

  try {
    const docRef = await addDoc(collection(db, "wallpapers"), getWallpaperPayload());
    resetForm();
    setMessage(formMessage, `Wallpaper saved with ID ${docRef.id}.`, "success");
    await loadWallpapers();
  } catch (error) {
    console.error("Unable to save wallpaper.", error);
    setMessage(formMessage, error.message.replace("Firebase: ", ""), "error");
  } finally {
    setSavingState(false);
  }
});

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(editMessage, "");

  const validationMessage = validateEditWallpaper();
  if (validationMessage) {
    setMessage(editMessage, validationMessage, "error");
    return;
  }

  setEditSavingState(true);
  setMessage(editMessage, "Saving changes...");

  try {
    await updateDoc(doc(db, "wallpapers", editingWallpaperId), getEditPayload());
    const savedId = editingWallpaperId;
    closeEditWallpaper();
    await loadWallpapers(`Wallpaper ${savedId} updated.`);
  } catch (error) {
    console.error("Unable to save wallpaper edits.", error);
    setMessage(editMessage, error.message.replace("Firebase: ", ""), "error");
  } finally {
    setEditSavingState(false);
  }
});
