import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const functionsBase = "https://us-central1-pmw-visuals-b14e8.cloudfunctions.net";

sanitizeFile("wallpapers-data.js", "PMW_WALLPAPERS");
sanitizeFile("desktop-wallpapers-data.js", "PMW_DESKTOP_WALLPAPERS");

function sanitizeFile(fileName, globalName) {
  const file = path.join(root, fileName);
  const source = fs.readFileSync(file, "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context);
  const items = context.window[globalName];
  if (!Array.isArray(items)) {
    throw new Error(`${fileName} does not define window.${globalName}`);
  }

  const sanitized = items.map((item, index) => {
    const id = String(item.id || `wallpaper-${index + 1}`).trim();
    const next = { ...item, id };
    const thumbnail = previewUrl(id, "thumbnail");
    const preview = previewUrl(id, "detail");

    delete next.cloudinaryPublicId;
    delete next.publicId;
    delete next.public_id;
    delete next.imageUrl;
    next.image = preview;
    next.preview = preview;
    next.thumbnail = thumbnail;
    next.download = "";
    return next;
  });

  fs.writeFileSync(
    file,
    `window.${globalName} = ${JSON.stringify(sanitized, null, 2)};\n`
  );
  console.log(`Sanitized ${sanitized.length} records in ${fileName}.`);
}

function previewUrl(id, variant) {
  return `${functionsBase}/wallpaperPreview?id=${encodeURIComponent(id)}&variant=${variant}`;
}
