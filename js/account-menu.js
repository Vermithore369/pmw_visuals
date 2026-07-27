(function () {
  const scriptUrl = new URL(document.currentScript?.src || "js/account-menu.js", document.baseURI);
  const rootUrl = new URL("../", scriptUrl);
  const skipPatterns = [
    /\/admin(?:-|\.html|\/|$)/i,
    /\/account\.html$/i,
    /\/login\.html$/i,
    /\/signup\.html$/i,
    /\/premium\.html$/i,
    /\/privacy-policy\.html$/i,
    /\/terms\.html$/i,
    /\/cookie-policy\.html$/i,
    /\/returnmoney-policy\.html$/i,
    /\/license\.html$/i
  ];

  if (window.PMW_ACCOUNT_MENU_LOADED || skipPatterns.some((pattern) => pattern.test(location.pathname))) {
    return;
  }
  window.PMW_ACCOUNT_MENU_LOADED = true;

  const href = (path) => new URL(path, rootUrl).href;
  const iconUser = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 21a8 8 0 0 0-16 0"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  `;
  const iconSignOut = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <path d="M16 17l5-5-5-5"></path>
      <path d="M21 12H9"></path>
    </svg>
  `;

  const styles = document.createElement("style");
  styles.textContent = `
    .pmw-account-menu-root {
      position: fixed;
      top: 24px;
      right: clamp(18px, 3vw, 42px);
      z-index: 5200;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #fff;
    }
    .pmw-account-trigger {
      width: 42px;
      height: 42px;
      display: inline-grid;
      place-items: center;
      border: 1px solid rgba(255,255,255,0.16);
      border-radius: 999px;
      color: #f8f8f8;
      background: rgba(10,10,10,0.74);
      box-shadow: 0 12px 34px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      cursor: pointer;
      transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
      overflow: hidden;
    }
    .pmw-account-trigger:hover,
    .pmw-account-trigger[aria-expanded="true"] {
      transform: translateY(-1px);
      border-color: rgba(255,255,255,0.32);
      background: rgba(22,22,22,0.9);
    }
    .pmw-account-trigger svg {
      width: 19px;
      height: 19px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .pmw-account-avatar-img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }
    .pmw-account-avatar-initial {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      box-sizing: border-box;
      border: 1px solid rgba(255,255,255,0.48);
      color: #ffffff;
      background:
        radial-gradient(circle at 34% 24%, rgba(255,255,255,0.3), transparent 32%),
        linear-gradient(145deg, rgba(255,255,255,0.12), rgba(6,6,6,0.92));
      box-shadow:
        inset 0 0 0 1px rgba(255,255,255,0.1),
        inset 0 -10px 18px rgba(255,255,255,0.06),
        0 0 18px rgba(255,255,255,0.12);
      font-size: 0.92rem;
      font-weight: 900;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      text-shadow: 0 1px 8px rgba(255,255,255,0.42);
    }
    .pmw-account-panel {
      position: absolute;
      top: calc(100% + 12px);
      right: 0;
      width: min(330px, calc(100vw - 28px));
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 22px;
      background:
        radial-gradient(circle at top right, rgba(216,173,76,0.14), transparent 34%),
        linear-gradient(145deg, rgba(18,18,18,0.98), rgba(7,7,7,0.98));
      box-shadow: 0 26px 80px rgba(0,0,0,0.58), inset 0 1px 0 rgba(255,255,255,0.06);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      overflow: hidden;
      opacity: 0;
      visibility: hidden;
      transform: translateY(-8px) scale(0.98);
      transform-origin: top right;
      transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s ease;
    }
    .pmw-account-menu-root.is-open .pmw-account-panel {
      opacity: 1;
      visibility: visible;
      transform: translateY(0) scale(1);
    }
    .pmw-account-head {
      display: grid;
      grid-template-columns: 50px minmax(0, 1fr);
      gap: 12px;
      padding: 18px;
      align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .pmw-account-head-avatar {
      width: 50px;
      height: 50px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(255,255,255,0.34);
      border-radius: 999px;
      overflow: hidden;
      color: #fff;
      background:
        radial-gradient(circle at 36% 24%, rgba(255,255,255,0.18), transparent 34%),
        linear-gradient(145deg, rgba(255,255,255,0.08), rgba(8,8,8,0.88));
      box-shadow:
        inset 0 0 0 1px rgba(255,255,255,0.08),
        0 0 22px rgba(255,255,255,0.08);
    }
    .pmw-account-head-avatar svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
    }
    .pmw-account-head strong {
      display: block;
      color: #fff;
      font-size: 0.98rem;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pmw-account-head div > span,
    .pmw-account-head div > p {
      display: block;
      margin: 4px 0 0;
      color: rgba(255,255,255,0.62);
      font-size: 0.82rem;
      line-height: 1.35;
    }
    .pmw-account-actions {
      display: grid;
      gap: 8px;
      padding: 14px;
    }
    .pmw-account-primary-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      padding-bottom: 8px;
    }
    .pmw-account-button,
    .pmw-account-link {
      min-height: 42px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 10px;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      padding: 10px 12px;
      color: rgba(255,255,255,0.86);
      background: rgba(255,255,255,0.035);
      font: inherit;
      font-size: 0.9rem;
      font-weight: 750;
      text-decoration: none;
      cursor: pointer;
      transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
    }
    .pmw-account-button:hover,
    .pmw-account-link:hover {
      transform: translateY(-1px);
      border-color: rgba(255,255,255,0.18);
      background: rgba(255,255,255,0.08);
    }
    .pmw-account-primary {
      justify-content: center;
      color: #090909;
      border-color: rgba(255,255,255,0.58);
      background: linear-gradient(135deg, #fff, #cfcfcf);
    }
    .pmw-account-secondary {
      justify-content: center;
      color: #f4d77d;
      border-color: rgba(216,173,76,0.26);
      background: rgba(216,173,76,0.08);
    }
    .pmw-account-button svg,
    .pmw-account-link svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .pmw-account-stars {
      margin-left: auto;
      color: #f4d77d;
      font-size: 0.72rem;
      letter-spacing: 0.08em;
      white-space: nowrap;
    }
    .pmw-account-signout {
      color: #f5f5f5;
      width: 100%;
    }
    @media (max-width: 720px) {
      .pmw-account-menu-root {
        top: 18px;
        right: 16px;
      }
      .pmw-account-trigger {
        width: 44px;
        height: 44px;
      }
      .pmw-account-panel {
        top: calc(100% + 10px);
        max-height: min(78vh, 560px);
        overflow-y: auto;
      }
      .pmw-account-link,
      .pmw-account-button {
        min-height: 46px;
      }
    }
  `;
  document.head.append(styles);

  const root = document.createElement("div");
  root.className = "pmw-account-menu-root";
  root.innerHTML = `
    <button class="pmw-account-trigger" type="button" aria-label="Open account menu" aria-expanded="false" aria-controls="pmwAccountPanel">
      ${iconUser}
    </button>
    <section class="pmw-account-panel" id="pmwAccountPanel" aria-label="Account menu"></section>
  `;

  const nav = document.querySelector(".navbar, .tools-nav, .converter-nav, nav");
  (nav || document.body).append(root);

  const trigger = root.querySelector(".pmw-account-trigger");
  const panel = root.querySelector(".pmw-account-panel");
  let currentUser = null;
  let firebaseReady = false;
  let signOutFn = null;
  let authInstance = null;

  const closeMenu = () => {
    root.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
  };

  const openMenu = () => {
    root.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    const firstLink = panel.querySelector("a, button");
    setTimeout(() => firstLink?.focus?.(), 0);
  };

  const toggleMenu = () => {
    if (root.classList.contains("is-open")) closeMenu();
    else openMenu();
  };

  const userLabel = (user) => user?.displayName || user?.email?.split("@")[0] || "PMW Member";
  const userInitial = (user) => (userLabel(user).trim()[0] || "P").toUpperCase();

  const setTriggerAvatar = (user) => {
    if (user?.photoURL) {
      trigger.innerHTML = `<img class="pmw-account-avatar-img" src="${user.photoURL}" alt="">`;
      return;
    }
    if (user) {
      trigger.innerHTML = `<span class="pmw-account-avatar-initial">${userInitial(user)}</span>`;
      return;
    }
    trigger.innerHTML = iconUser;
  };

  const premiumLabel = `PREMIUM PLAN <span class="pmw-account-stars" aria-hidden="true">✦ ✦ ✦</span>`;
  const menuLink = (label, path) => `<a class="pmw-account-link" href="${href(path)}">${label}</a>`;

  const renderGuest = () => {
    setTriggerAvatar(null);
    panel.innerHTML = `
      <div class="pmw-account-head">
        <span class="pmw-account-head-avatar">${iconUser}</span>
        <div>
          <strong>Welcome to PMW Visuals</strong>
          <p>Sign in to access your profile, downloads, and premium features.</p>
        </div>
      </div>
      <div class="pmw-account-actions">
        <div class="pmw-account-primary-row">
          <a class="pmw-account-button pmw-account-primary" href="${href("login.html")}">Sign In</a>
          <a class="pmw-account-button pmw-account-secondary" href="${href("signup.html")}">Create Account</a>
        </div>
        ${menuLink("PMW Wallpapers", "pmw-wallpapers.html")}
        ${menuLink("PMW Tools", "tools/")}
        ${menuLink(premiumLabel, "premium.html")}
        ${menuLink("Contact Us", "index.html#contact")}
      </div>
    `;
  };

  const renderUser = (user) => {
    setTriggerAvatar(user);
    const avatar = user.photoURL
      ? `<img class="pmw-account-avatar-img" src="${user.photoURL}" alt="">`
      : `<span class="pmw-account-avatar-initial">${userInitial(user)}</span>`;
    panel.innerHTML = `
      <div class="pmw-account-head">
        <span class="pmw-account-head-avatar">${avatar}</span>
        <div>
          <strong>${userLabel(user)}</strong>
          <span>${user.email || ""}</span>
        </div>
      </div>
      <div class="pmw-account-actions">
        ${menuLink("My Profile", "account.html")}
        ${menuLink(premiumLabel, "premium.html")}
        ${menuLink("PMW Tools", "tools/")}
        ${menuLink("PMW Wallpapers", "pmw-wallpapers.html")}
        <button class="pmw-account-link pmw-account-signout" type="button" data-pmw-signout>${iconSignOut} Sign Out</button>
      </div>
    `;
  };

  const render = () => {
    if (currentUser) renderUser(currentUser);
    else renderGuest();
  };

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMenu();
  });

  panel.addEventListener("click", async (event) => {
    const signOutButton = event.target.closest("[data-pmw-signout]");
    if (signOutButton) {
      event.preventDefault();
      if (firebaseReady && authInstance && signOutFn) {
        signOutButton.disabled = true;
        signOutButton.textContent = "Signing out...";
        await signOutFn(authInstance);
      }
      closeMenu();
      return;
    }
    if (event.target.closest("a")) closeMenu();
  });

  document.addEventListener("click", (event) => {
    if (!root.contains(event.target)) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
      trigger.focus();
    }
  });

  renderGuest();

  Promise.all([
    import(new URL("firebase.js", scriptUrl).href),
    import("https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js")
  ]).then(([firebaseModule, authModule]) => {
    authInstance = firebaseModule.auth;
    signOutFn = authModule.signOut;
    firebaseReady = true;
    authModule.onAuthStateChanged(authInstance, (user) => {
      currentUser = user;
      render();
    });
  }).catch((error) => {
    console.warn("PMW account menu auth unavailable.", error);
    renderGuest();
  });
})();
