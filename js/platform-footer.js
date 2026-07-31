(function () {
  "use strict";

  if (document.querySelector(".pmw-platform-footer")) return;

  const script = document.currentScript;
  if (!script || !script.src) return;

  const siteRoot = new URL("../", script.src);
  const siteUrl = (path) => new URL(path.replace(/^\//, ""), siteRoot).href;

  if (!document.querySelector('link[data-pmw-platform-footer-css]')) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = siteUrl("css/platform-footer.css");
    stylesheet.dataset.pmwPlatformFooterCss = "";
    document.head.appendChild(stylesheet);
  }

  const socialIcon = {
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
    pinterest: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.65 19.31c-.09-1.58-.02-3.47.4-5.26l1.29-5.45s-.32-.65-.32-1.61c0-1.51.87-2.64 1.96-2.64.93 0 1.37.7 1.37 1.53 0 .93-.59 2.32-.9 3.61-.26 1.08.54 1.96 1.61 1.96 1.93 0 3.41-2.03 3.41-4.97 0-2.6-1.87-4.42-4.54-4.42-3.09 0-4.91 2.32-4.91 4.72 0 .94.36 1.94.81 2.49.09.11.1.2.08.31l-.3 1.23c-.05.2-.16.24-.37.15-1.39-.65-2.26-2.68-2.26-4.31 0-3.51 2.55-6.73 7.35-6.73 3.86 0 6.86 2.75 6.86 6.43 0 3.84-2.42 6.93-5.78 6.93-1.13 0-2.19-.59-2.55-1.28l-.69 2.64c-.25.97-.93 2.18-1.38 2.92.84.26 1.71.4 2.62.4A10 10 0 0 0 12 2z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 22v-9h3l.45-3.5H13.5V7.26c0-1.01.28-1.7 1.73-1.7H17V2.43c-.31-.04-1.37-.13-2.61-.13-2.58 0-4.35 1.58-4.35 4.47V9.5H7.12V13h2.92v9h3.46z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z"/></svg>'
  };

  const columns = [
    {
      title: "Platform",
      links: [
        ["Home", "index.html"],
        ["PMW Tools", "tools/"],
        ["PMW Wallpapers", "pmw-wallpapers.html"],
        ["PMW Studio", "pmw-studio.html"],
        ["About", "index.html?section=about"]
      ]
    },
    {
      title: "Tools",
      links: [
        ["Media Converter", "tools/image-converter/"],
        ["Image Resizer", "tools/image-resizer/"],
        ["Image Compressor", "tools/image-compressor/"],
        ["All Tools", "tools/"]
      ]
    },
    {
      title: "Wallpapers",
      links: [
        ["PMW Wallpapers", "pmw-wallpapers.html"],
        ["Mobile Wallpapers", "pmw-wallpapers.html?device=mobile#latest-wallpapers"],
        ["Laptop & Desktop", "pmw-wallpapers.html?device=desktop#latest-wallpapers"],
        ["AMOLED Wallpapers", "wallpapers/amoled/"],
        ["Anime Wallpapers", "wallpapers/anime/"],
        ["Nature Wallpapers", "wallpapers/nature/"],
        ["All Wallpaper Pages", "wallpapers/"]
      ]
    },
    {
      title: "Support & Legal",
      links: [
        ["Contact", "index.html?section=contact"],
        ["Privacy Policy", "privacy-policy.html"],
        ["Terms of Service", "terms.html"],
        ["Cookie Policy", "cookie-policy.html"],
        ["Image License", "license.html"],
        ["Return Money Policy", "returnmoney-policy.html"],
        ["Sitemap", "sitemap.xml"]
      ]
    }
  ];

  const footer = document.createElement("footer");
  footer.className = "pmw-platform-footer";
  footer.setAttribute("aria-label", "PMW Visuals footer");
  footer.innerHTML = `
    <div class="pmw-platform-footer__inner">
      <div class="pmw-platform-footer__grid">
        <div class="pmw-platform-footer__brand">
          <a class="pmw-platform-footer__brand-link" href="${siteUrl("index.html")}" aria-label="PMW Visuals home">
            <img class="pmw-platform-footer__logo" src="${siteUrl("pmw-wordmark.png")}" alt="PMW">
            <span class="pmw-platform-footer__brand-name">Visuals</span>
          </a>
          <p class="pmw-platform-footer__description">PMW Visuals brings together browser-based media tools, wallpaper collections, and PMW creative projects in one digital platform.</p>
          <div class="pmw-platform-footer__socials" aria-label="PMW Visuals social media">
            <a class="pmw-platform-footer__social" href="https://www.instagram.com/pmw_wallpapers/" target="_blank" rel="noopener noreferrer" aria-label="PMW Visuals on Instagram">${socialIcon.instagram}</a>
            <a class="pmw-platform-footer__social" href="https://uk.pinterest.com/pmw_wallpapers/" target="_blank" rel="noopener noreferrer" aria-label="PMW Visuals on Pinterest">${socialIcon.pinterest}</a>
            <a class="pmw-platform-footer__social" href="https://www.facebook.com/people/Apollo-Sounds/61579450350429/?sk=about" target="_blank" rel="noopener noreferrer" aria-label="PMW Visuals on Facebook">${socialIcon.facebook}</a>
            <a class="pmw-platform-footer__social" href="https://www.youtube.com/@PMW_Studio" target="_blank" rel="noopener noreferrer" aria-label="PMW Visuals on YouTube">${socialIcon.youtube}</a>
          </div>
        </div>
        ${columns.map((column) => `
          <nav class="pmw-platform-footer__column" aria-label="${column.title}">
            <h2>${column.title}</h2>
            <div class="pmw-platform-footer__links">
              ${column.links.map(([label, path]) => `<a href="${siteUrl(path)}">${label}</a>`).join("")}
            </div>
          </nav>
        `).join("")}
      </div>
      <div class="pmw-platform-footer__bottom">
        <div class="pmw-platform-footer__bottom-copy">
          <span>&copy; 2026 PMW Visuals. All rights reserved.</span>
          <span>Made for creators, students, and everyday users.</span>
        </div>
        <button class="pmw-platform-footer__top" type="button" aria-label="Back to top">Back to top <span aria-hidden="true">&uarr;</span></button>
      </div>
    </div>`;

  const oldFooter = document.querySelector("footer.footer, footer.tools-footer, footer.converter-footer");
  if (oldFooter) {
    oldFooter.replaceWith(footer);
  } else {
    document.body.appendChild(footer);
  }

  footer.querySelector(".pmw-platform-footer__top").addEventListener("click", function () {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  });
})();
