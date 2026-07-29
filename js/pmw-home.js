(function () {
    "use strict";

    const home = document.querySelector(".platform-home");
    if (!home) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const precisePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const revealItems = Array.from(home.querySelectorAll("[data-home-reveal]"));
    const tiltItems = Array.from(home.querySelectorAll("[data-pmw-tilt]"));

    function revealAll() {
        revealItems.forEach((item) => item.classList.add("is-visible"));
    }

    if (reducedMotion.matches || !("IntersectionObserver" in window)) {
        revealAll();
    } else {
        document.documentElement.classList.add("js-home-motion");
        const revealObserver = new IntersectionObserver(
            (entries, observer) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                });
            },
            { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
        );

        revealItems.forEach((item) => revealObserver.observe(item));
    }

    if (reducedMotion.matches || !precisePointer.matches) return;

    tiltItems.forEach((item) => {
        let frame = 0;
        let targetX = 0;
        let targetY = 0;

        function renderTilt() {
            item.style.setProperty("--tilt-x", `${targetX.toFixed(2)}deg`);
            item.style.setProperty("--tilt-y", `${targetY.toFixed(2)}deg`);
            frame = 0;
        }

        item.addEventListener("pointermove", (event) => {
            const bounds = item.getBoundingClientRect();
            const x = (event.clientX - bounds.left) / bounds.width - 0.5;
            const y = (event.clientY - bounds.top) / bounds.height - 0.5;
            targetX = y * -3.5;
            targetY = x * 4.5;
            if (!frame) frame = window.requestAnimationFrame(renderTilt);
        });

        item.addEventListener("pointerleave", () => {
            targetX = 0;
            targetY = 0;
            if (!frame) frame = window.requestAnimationFrame(renderTilt);
        });
    });
})();
