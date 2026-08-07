const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const targetRoots = [root, path.join(root, "tools"), path.join(root, "welcome"), path.join(root, "wallpapers")];
const excludedNames = /^(admin|pinterest-|yandex_|google)/i;

const collectHtml = (directory, recursive) => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return recursive ? collectHtml(filePath, true) : [];
    }
    return entry.isFile() && entry.name.endsWith(".html") ? [filePath] : [];
  });

const files = [
  ...collectHtml(root, false),
  ...collectHtml(path.join(root, "tools"), true),
  ...collectHtml(path.join(root, "welcome"), true),
  ...collectHtml(path.join(root, "wallpapers"), true)
].filter((filePath, index, all) => (
  all.indexOf(filePath) === index
  && !excludedNames.test(path.basename(filePath))
  && !filePath.includes(`${path.sep}admin${path.sep}`)
));

let changed = 0;

for (const filePath of files) {
  let html = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
  if (!/<head(?:\s[^>]*)?>/i.test(html) || !/<\/head>/i.test(html)) continue;

  const relativeRoot = path.relative(path.dirname(filePath), root).replaceAll(path.sep, "/");
  const prefix = relativeRoot ? `${relativeRoot}/` : "";

  if (!html.includes("pmw-theme.js")) {
    html = html.replace(/<head(?:\s[^>]*)?>/i, (match) => (
      `${match}\n  <script src="${prefix}js/pmw-theme.js"></script>`
    ));
  }

  if (!html.includes("pmw-theme.css")) {
    html = html.replace(/<\/head>/i, `  <link rel="stylesheet" href="${prefix}css/pmw-theme.css">\n</head>`);
  }

  fs.writeFileSync(filePath, html.replace(/\n/g, "\r\n"), "utf8");
  changed += 1;
}

console.log(`Theme includes verified in ${changed} HTML files.`);
