(function () {
  "use strict";

  const STORAGE_KEY = "pmw_theme_preference";
  const DARK_COLOR = "#050505";
  const LIGHT_COLOR = "#f5f7fb";

  const normalizeTheme = (value) => value === "light" ? "light" : "dark";

  const readTheme = () => {
    try {
      return normalizeTheme(window.localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      return "dark";
    }
  };

  const updateThemeColor = (theme) => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = theme === "light" ? LIGHT_COLOR : DARK_COLOR;
  };

  const updateRecaptchaTheme = (theme) => {
    document.querySelectorAll(".g-recaptcha").forEach((element) => {
      element.dataset.theme = theme;
    });
  };

  const watchForRecaptcha = (theme) => {
    if (!window.MutationObserver || !document.documentElement) return null;

    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;

          if (node.matches(".g-recaptcha")) {
            node.dataset.theme = theme;
          }

          node.querySelectorAll?.(".g-recaptcha").forEach((element) => {
            element.dataset.theme = theme;
          });
        });
      });
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
    return observer;
  };

  const applyTheme = (value, options = {}) => {
    const theme = normalizeTheme(value);
    const root = document.documentElement;

    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    updateThemeColor(theme);

    if (document.body) {
      updateRecaptchaTheme(theme);
    }

    if (options.persist !== false) {
      try {
        window.localStorage.setItem(STORAGE_KEY, theme);
      } catch (error) {
        // The preference still applies for this page when storage is unavailable.
      }
    }

    if (options.announce !== false) {
      window.dispatchEvent(new CustomEvent("pmw:themechange", { detail: { theme } }));
    }

    return theme;
  };

  const initialTheme = readTheme();
  const recaptchaObserver = watchForRecaptcha(initialTheme);
  applyTheme(initialTheme, { persist: false, announce: false });

  window.PMWTheme = Object.freeze({
    storageKey: STORAGE_KEY,
    get: () => normalizeTheme(document.documentElement.dataset.theme || readTheme()),
    set: (theme) => applyTheme(theme),
    toggle: () => applyTheme(
      document.documentElement.dataset.theme === "light" ? "dark" : "light"
    )
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      updateRecaptchaTheme(initialTheme);
      window.setTimeout(() => recaptchaObserver?.disconnect(), 0);
    }, { once: true });
  } else {
    updateRecaptchaTheme(initialTheme);
    recaptchaObserver?.disconnect();
  }

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      applyTheme(event.newValue, { persist: false });
    }
  });
})();
