(function () {
    const STORAGE_KEY = 'pmw_download_events_v1';
    const VIEW_STORAGE_KEY = 'pmw_view_events_v1';

    function readEvents() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        } catch (error) {
            return [];
        }
    }

    function writeEvents(events) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-5000)));
        } catch (error) {
            // Storage can be unavailable in strict browser modes.
        }
    }

    function getPageImage() {
        return document.querySelector('meta[property="og:image"]')?.content
            || document.querySelector('.preview-card img, #panelImage, .wallpaper-panel img, .wallpaper-thumb img')?.src
            || '';
    }

    function trackDownload(payload) {
        const event = {
            id: payload.id || '',
            title: payload.title || '',
            category: payload.category || '',
            image: payload.image || payload.thumbnail || getPageImage(),
            url: payload.url || location.href,
            type: payload.type || 'wallpaper',
            time: new Date().toISOString()
        };

        const events = readEvents();
        events.push(event);
        writeEvents(events);
    }

    function getPageWallpaperPayload() {
        const title = document.querySelector('h1')?.textContent?.trim()
            || document.querySelector('meta[property="og:title"]')?.content
            || document.title
            || 'Wallpaper';
        const category = document.querySelector('.kicker, #panelCategory')?.textContent?.trim() || '';
        const image = getPageImage();
        const id = location.pathname
            .replace(/^\/+|\.html$/gi, '')
            .replace(/[^\w.-]+/g, '-')
            .replace(/^-+|-+$/g, '');

        return {
            id,
            title,
            category,
            image,
            url: location.href,
            type: 'wallpaper'
        };
    }

    function readViews() {
        try {
            return JSON.parse(localStorage.getItem(VIEW_STORAGE_KEY) || '[]');
        } catch (error) {
            return [];
        }
    }

    function writeViews(events) {
        try {
            localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(events.slice(-5000)));
        } catch (error) {
            // Storage can be unavailable in strict browser modes.
        }
    }

    function trackView(payload = {}) {
        const pagePayload = getPageWallpaperPayload();
        const event = {
            ...pagePayload,
            ...payload,
            image: payload.image || payload.thumbnail || pagePayload.image,
            type: 'wallpaper',
            time: new Date().toISOString()
        };

        if (!event.id && !event.url) return;

        const events = readViews();
        events.push(event);
        writeViews(events);
    }

    function getDownloadEvents() {
        return readEvents();
    }

    function getViewEvents() {
        return readViews();
    }

    function clearDownloadEvents() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            // Ignore unavailable storage.
        }
    }

    window.PMW_DOWNLOAD_TRACKING = {
        trackView,
        trackDownload,
        getDownloadEvents,
        getViewEvents,
        clearDownloadEvents
    };

    if (/\/wallpapers\/.+\.html$/i.test(location.pathname) && !/\/wallpapers\/index\.html$/i.test(location.pathname)) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => trackView(), { once: true });
        } else {
            trackView();
        }
    }
})();
