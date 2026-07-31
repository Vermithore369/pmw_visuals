(function () {
  const sourceScript = document.currentScript;
  if (sourceScript?.src && !document.querySelector('script[data-pmw-platform-footer]')) {
    const footerScript = document.createElement('script');
    footerScript.src = new URL('platform-footer.js', sourceScript.src).href;
    footerScript.dataset.pmwPlatformFooter = '';
    document.body.appendChild(footerScript);
  }

  const shuffleElements = (items) => {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }
    return shuffled;
  };

  const randomizeRelatedWallpapers = () => {
    document.querySelectorAll('.related-grid').forEach((grid) => {
      const cards = Array.from(grid.querySelectorAll('.related-card'));
      if (cards.length < 2 || grid.dataset.randomized === 'true') return;
      shuffleElements(cards).forEach((card) => grid.appendChild(card));
      grid.dataset.randomized = 'true';
    });
  };

  randomizeRelatedWallpapers();

  const actions = document.querySelector('.actions');
  const title = document.querySelector('h1')?.textContent?.trim() || 'PMW Wallpaper';
  const image = document.querySelector('.preview-card img')?.getAttribute('src') || '';
  const toolImage = image
    .replace('/q_auto,f_auto/', '/q_auto/')
    .replace(/\/c_fill,g_auto,w_\d+,h_\d+,q_auto,f_auto\//, '/q_auto/');
  const detailRows = Array.from(document.querySelectorAll('.detail'));
  const details = detailRows.reduce((values, row) => {
    const key = row.querySelector('span')?.textContent?.trim().toLowerCase();
    const value = row.querySelector('strong')?.textContent?.trim();
    if (key && value) values[key] = value;
    return values;
  }, {});

  if (!actions || document.querySelector('.wallpaper-tools-panel')) return;

  const rootPrefix = (() => {
    if (window.location.protocol !== 'file:') return '/';
    const normalizedPath = window.location.pathname.replace(/\\/g, '/');
    const marker = '/wallpapers/';
    const markerIndex = normalizedPath.indexOf(marker);
    if (markerIndex === -1) return '../../../';
    const relativePath = normalizedPath.slice(markerIndex + marker.length);
    const depth = relativePath.split('/').filter(Boolean).length - 1;
    return '../'.repeat(Math.max(depth, 0));
  })();

  const params = new URLSearchParams({
    source: toolImage || image,
    title
  });

  const getToolUrl = (toolPath, extra = {}) => {
    const next = new URLSearchParams(params);
    Object.entries(extra).forEach(([key, value]) => next.set(key, value));
    return `${rootPrefix}${toolPath}?${next.toString()}`;
  };

  const styles = document.createElement('style');
  styles.textContent = `
    .wallpaper-tools-panel {
      margin-top: 28px;
      padding: 18px;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 18px;
      background: linear-gradient(145deg, rgba(255,255,255,0.055), rgba(255,255,255,0.018));
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
    }
    .wallpaper-tools-panel h2 {
      margin: 0 0 8px;
      font-family: 'Space Grotesk', Inter, system-ui, sans-serif;
      font-size: 1rem;
      letter-spacing: 0;
    }
    .wallpaper-tools-panel p {
      margin: 0 0 16px;
      color: var(--text-secondary, #a3a3a3);
      font-size: 0.9rem;
      line-height: 1.55;
    }
    .wallpaper-tools-group {
      display: grid;
      gap: 13px;
    }
    .wallpaper-tools-row {
      display: grid;
      grid-template-columns: 118px 1fr;
      gap: 12px;
      align-items: start;
    }
    .wallpaper-tools-label {
      color: var(--text-muted, #606060);
      font-size: 0.72rem;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding-top: 9px;
    }
    .wallpaper-tools-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .wallpaper-tool-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 36px;
      padding: 8px 12px;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 999px;
      color: var(--text-primary, #fff);
      background: rgba(255,255,255,0.045);
      font-size: 0.82rem;
      font-weight: 900;
      text-decoration: none;
      transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
    }
    .wallpaper-tool-chip:hover {
      transform: translateY(-2px);
      border-color: rgba(220,173,63,0.55);
      background: rgba(220,173,63,0.13);
    }
    .wallpaper-tool-chip.primary {
      border-color: rgba(134,239,172,0.45);
      background: linear-gradient(135deg, rgba(255,255,255,0.94), rgba(134,239,172,0.86));
      color: #07100b;
    }
    @media (max-width: 620px) {
      .wallpaper-tools-row { grid-template-columns: 1fr; gap: 7px; }
      .wallpaper-tools-label { padding-top: 0; }
    }
  `;
  document.head.appendChild(styles);

  const ratio = String(details.ratio || '').trim();
  const isWide = ratio.includes('16:9') || ratio.includes('16 / 9');
  const resizePresets = isWide
    ? [
        ['1920x1080', 1920, 1080],
        ['2560x1440', 2560, 1440],
        ['3840x2160', 3840, 2160],
        ['1366x768', 1366, 768]
      ]
    : [
        ['1080x1920', 1080, 1920],
        ['1440x2560', 1440, 2560],
        ['1080x1080', 1080, 1080],
        ['720x1280', 720, 1280]
      ];

  const formatChips = [
    ['PNG', 'png'],
    ['JPG', 'jpg'],
    ['WEBP', 'webp']
  ].map(([label, format]) => `<a class="wallpaper-tool-chip" href="${getToolUrl('tools/image-converter/', { format })}">${label}</a>`).join('');

  const resizeChips = resizePresets
    .map(([label, width, height]) => `<a class="wallpaper-tool-chip" href="${getToolUrl('tools/image-resizer/', { width, height })}">${label}</a>`)
    .join('');

  const panel = document.createElement('section');
  panel.className = 'wallpaper-tools-panel';
  panel.setAttribute('aria-label', 'Wallpaper editing tools');
  panel.innerHTML = `
    <h2>Customize this wallpaper</h2>
    <p>Open this image in PMW Tools to resize it, convert the file type, or compress it for a lighter download.</p>
    <div class="wallpaper-tools-group">
      <div class="wallpaper-tools-row">
        <span class="wallpaper-tools-label">Format</span>
        <div class="wallpaper-tools-chips">${formatChips}</div>
      </div>
      <div class="wallpaper-tools-row">
        <span class="wallpaper-tools-label">Resolution</span>
        <div class="wallpaper-tools-chips">${resizeChips}</div>
      </div>
      <div class="wallpaper-tools-row">
        <span class="wallpaper-tools-label">Compress</span>
        <div class="wallpaper-tools-chips">
          <a class="wallpaper-tool-chip primary" href="${getToolUrl('tools/image-compressor/')}">Open Compressor</a>
        </div>
      </div>
    </div>
  `;

  actions.insertAdjacentElement('afterend', panel);
})();
