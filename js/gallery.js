/**
 * gallery.jinja.js
 * Fetches gallery items from API and renders polaroid cards.
 * Infinite scroll via IntersectionObserver.
 */

const API_URL = "https://staging-api.yarnandmoggy.co.uk";

const EMOJIS = ["🐾", "😻", "🧶", "🐟", "✨", "💕", "🐱", "🌿", "🎀", "😼", "🐭", "🪄"];
const TILTS = [-6, -4, -3, -2, 2, 3, 4, 5, 6, -5];

let nextCursor = null;
let loading = false;
let allLoaded = false;

document.addEventListener("DOMContentLoaded", () => {
  loadGallery();
  setupInfiniteScroll();
});

async function loadGallery() {
  if (loading || allLoaded) return;
  loading = true;

  const url = nextCursor
    ? `${API_URL}/gallery?cursor=${encodeURIComponent(nextCursor)}`
    : `${API_URL}/gallery`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch gallery");
    const data = await response.json();

    renderItems(data.items);

    nextCursor = data.next_cursor || null;
    if (!nextCursor) {
      allLoaded = true;
      document.getElementById("gallery-loading").style.display = "none";
      document.getElementById("gallery-end").style.display = "flex";
    }
  } catch (err) {
    console.error("Gallery load error:", err);
    document.getElementById("gallery-loading").style.display = "none";
  } finally {
    loading = false;
  }
}

function renderItems(items) {
  const grid = document.getElementById("gallery-grid");

  items.forEach((item, index) => {
    const tilt = TILTS[Math.floor(Math.random() * TILTS.length)];
    const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    const delay = (index % 8) * 60;

    const card = document.createElement("div");
    card.className = "polaroid";
    card.style.setProperty("--tilt", `${tilt}deg`);
    card.style.animationDelay = `${delay}ms`;

    card.innerHTML = `
      <div class="polaroid-img-wrap">
        <img
          src="${item.url}"
          alt="${item.caption}"
          loading="lazy"
          class="polaroid-img"
        />
        <span class="polaroid-emoji">${emoji}</span>
      </div>
      <p class="polaroid-caption">${item.caption}</p>
    `;

    // Slight hover re-randomise tilt for life
    card.addEventListener("mouseenter", () => {
      const newTilt = TILTS[Math.floor(Math.random() * TILTS.length)];
      card.style.setProperty("--tilt", `${newTilt}deg`);
    });

    grid.appendChild(card);
  });
}

function setupInfiniteScroll() {
  const sentinel = document.getElementById("gallery-sentinel");
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !allLoaded) {
      loadGallery();
    }
  }, { rootMargin: "200px" });

  observer.observe(sentinel);
}