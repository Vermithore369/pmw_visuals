(function () {
    const STORAGE_KEY = 'pmw_download_events_v1';

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

    function getDownloadEvents() {
        return readEvents();
    }

    function clearDownloadEvents() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            // Ignore unavailable storage.
        }
    }

    window.PMW_DOWNLOAD_TRACKING = {
        trackDownload,
        getDownloadEvents,
        clearDownloadEvents
    };
})();
