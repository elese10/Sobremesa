const cards = document.querySelectorAll(".hero-card");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (cards.length > 0 && !prefersReducedMotion.matches) {
    const movement = 9;
    const speed = 0.0014;
    function animateCards(time) {
        cards.forEach((card, index) => {
            const phase = (index / cards.length) * Math.PI * 2;
            const verticalPosition = Math.sin(time * speed + phase) * movement;

            card.style.setProperty("--float-y", `${verticalPosition}px`);
        });

        window.requestAnimationFrame(animateCards);
    }

    window.requestAnimationFrame(animateCards);
}