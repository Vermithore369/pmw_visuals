(() => {
  const loadWallpaperToolsPanel = () => {
    if (!document.getElementById('downloadButton')) return;
    if (document.querySelector('script[src$="js/wallpaper-tools-panel.js"]')) return;

    const rootPrefix = window.location.protocol === 'file:'
      ? `${'../'.repeat(Math.max(0, window.location.pathname.split('/').filter(Boolean).length - 1))}`
      : '/';
    const script = document.createElement('script');
    script.src = `${rootPrefix}js/wallpaper-tools-panel.js`;
    script.defer = true;
    document.head.appendChild(script);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadWallpaperToolsPanel, { once: true });
  } else {
    loadWallpaperToolsPanel();
  }

  const key = 'pmw_cookie_consent';
  const existing = localStorage.getItem(key);

  const applyConsent = (choice) => {
    if (typeof window.gtag !== 'function') return;
    const granted = choice === 'accepted';
    window.gtag('consent', 'update', {
      ad_storage: granted ? 'granted' : 'denied',
      ad_user_data: granted ? 'granted' : 'denied',
      ad_personalization: granted ? 'granted' : 'denied',
      analytics_storage: 'granted'
    });
  };

  applyConsent(existing);
  if (existing) return;

  const style = document.createElement('style');
  style.textContent = `
    .pmw-cookie-banner {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 100000;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 14px;
      min-height: 46px;
      padding: 8px 16px;
      border-top: 1px solid rgba(255,255,255,.12);
      background: rgba(5,5,5,.94);
      color: #fff;
      box-shadow: 0 -10px 34px rgba(0,0,0,.28);
      backdrop-filter: blur(18px);
      font-family: Inter, system-ui, sans-serif;
    }
    .pmw-cookie-banner p {
      margin: 0;
      color: rgba(255,255,255,.78);
      font-size: .84rem;
      line-height: 1.35;
    }
    .pmw-cookie-banner a { color: #fff; font-weight: 800; }
    .pmw-cookie-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
    .pmw-cookie-actions button {
      min-height: 30px;
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 999px;
      padding: 0 13px;
      color: #fff;
      background: rgba(255,255,255,.08);
      font: 800 .78rem Inter, system-ui, sans-serif;
      cursor: pointer;
    }
    .pmw-cookie-actions [data-choice="accepted"] { background: #fff; color: #050505; }
    @media (max-width: 680px) {
      .pmw-cookie-banner {
        justify-content: space-between;
        gap: 10px;
        padding: 8px 10px;
      }
      .pmw-cookie-banner p { font-size: .76rem; }
      .pmw-cookie-actions { gap: 6px; }
      .pmw-cookie-actions button {
        min-height: 28px;
        padding: 0 10px;
        font-size: .72rem;
      }
    }
  `;

  const banner = document.createElement('div');
  banner.className = 'pmw-cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Cookie choices');
  banner.innerHTML = `
    <p>PMW Visuals uses cookies to improve your experience and analyze website traffic. <a href="/cookie-policy.html">Learn more</a></p>
    <div class="pmw-cookie-actions">
      <button type="button" data-choice="declined">Decline</button>
      <button type="button" data-choice="accepted">Accept</button>
    </div>
  `;

  banner.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-choice]');
    if (!button) return;
    const choice = button.dataset.choice;
    localStorage.setItem(key, choice);
    applyConsent(choice);
    banner.remove();
    style.remove();
  });

  document.head.appendChild(style);
  document.body.appendChild(banner);
})();
