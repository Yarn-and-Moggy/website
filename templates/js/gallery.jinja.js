/**
 * gallery.jinja.js
 * Fetches gallery items from API and renders polaroid cards.
 * Infinite scroll via IntersectionObserver.
 */

const API_URL = "{{ data.api_url }}";

const EMOJIS = [
  "🐾",
  "😻",
  "🧶",
  "🐟",
  "✨",
  "💕",
  "🐱",
  "🌿",
  "🎀",
  "😼",
  "🐭",
  "🪄",
];
const TILTS = [-6, -4, -3, -2, 2, 3, 4, 5, 6, -5];

let nextCursor = null;
let loading = false;
let allLoaded = false;

document.addEventListener("DOMContentLoaded", () => {
  loadGallery();
  setupInfiniteScroll();
  setupLightbox();
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
    const corners = [
      { bottom: "8px", right: "8px", left: "auto", top: "auto" },
      { bottom: "8px", left: "8px", right: "auto", top: "auto" },
      { top: "8px", right: "8px", left: "auto", bottom: "auto" },
      { top: "8px", left: "8px", right: "auto", bottom: "auto" },
    ];
    const corner = corners[Math.floor(Math.random() * corners.length)];
    const cornerStyle = Object.entries(corner)
      .map(([k, v]) => `${k}:${v}`)
      .join(";");

    card.innerHTML = `
      <div class="polaroid-img-wrap">
        <img src="${item.url}" alt="${item.caption}" loading="lazy" class="polaroid-img" />
      </div>
      <span class="polaroid-emoji" style="${cornerStyle}">${emoji}</span>
      <p class="polaroid-caption">${item.caption}</p>
    `;

    card.style.cursor = "zoom-in";
    card.addEventListener("click", () => openLightbox(item.url, item.caption));

    card.addEventListener("animationend", () => {
      card.style.animation = "none";
      // Force reflow so transform is recalculated cleanly
      card.getBoundingClientRect();
    });

    grid.appendChild(card);
  });
}

function setupInfiniteScroll() {
  const sentinel = document.getElementById("gallery-sentinel");
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && !allLoaded) {
        loadGallery();
      }
    },
    { rootMargin: "200px" },
  );

  observer.observe(sentinel);
}

function setupLightbox() {
  const lightbox = document.createElement("div");
  lightbox.id = "lightbox";
  lightbox.innerHTML = `
    <div class="lightbox-backdrop"></div>
    <div class="lightbox-content">
      <img id="lightbox-img" src="" alt="" />
      <p id="lightbox-caption"></p>
      <button class="lightbox-close">&#x2715;</button>
    </div>
  `;
  document.body.appendChild(lightbox);

  lightbox
    .querySelector(".lightbox-backdrop")
    .addEventListener("click", closeLightbox);
  lightbox
    .querySelector(".lightbox-close")
    .addEventListener("click", closeLightbox);
  document.addEventListener(
    "keydown",
    (e) => e.key === "Escape" && closeLightbox(),
  );
}

function openLightbox(url, caption) {
  const lightbox = document.getElementById("lightbox");
  document.getElementById("lightbox-img").src = url;
  document.getElementById("lightbox-caption").textContent = caption;
  lightbox.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  document.getElementById("lightbox").classList.remove("active");
  document.body.style.overflow = "";
}
