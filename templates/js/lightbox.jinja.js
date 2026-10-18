/**
 * lightbox.jinja.js
 * Shared fullscreen image lightbox.
 * openLightbox(url, caption) for a single image,
 * openLightboxSet(urls, index, { caption, onChange }) for a browsable set.
 */

let lightboxSet = null;

function setupLightbox() {
  if (document.getElementById("lightbox")) return;

  const lightbox = document.createElement("div");
  lightbox.id = "lightbox";
  lightbox.innerHTML = `
    <div class="lightbox-backdrop"></div>
    <p id="lightbox-counter"></p>
    <button class="lightbox-arrow prev" aria-label="Previous image">&#x2039;</button>
    <button class="lightbox-arrow next" aria-label="Next image">&#x203A;</button>
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
  lightbox
    .querySelector(".lightbox-arrow.prev")
    .addEventListener("click", () => stepLightbox(-1));
  lightbox
    .querySelector(".lightbox-arrow.next")
    .addEventListener("click", () => stepLightbox(1));

  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("active")) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") stepLightbox(-1);
    else if (e.key === "ArrowRight") stepLightbox(1);
  });

  // Swipe left/right to change image
  const img = document.getElementById("lightbox-img");
  let touchStartX = null;
  img.addEventListener(
    "touchstart",
    (e) => (touchStartX = e.touches[0].clientX),
    { passive: true },
  );
  img.addEventListener("touchend", (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(dx) > 50) stepLightbox(dx < 0 ? 1 : -1);
  });
}

function openLightbox(url, caption) {
  lightboxSet = null;
  const lightbox = document.getElementById("lightbox");
  lightbox.classList.remove("has-set");
  document.getElementById("lightbox-img").src = url;
  document.getElementById("lightbox-caption").textContent = caption;
  lightbox.classList.add("active");
  document.body.style.overflow = "hidden";
}

function openLightboxSet(urls, index, { caption = "", onChange = null } = {}) {
  openLightbox(urls[index], caption);
  if (urls.length < 2) return;
  lightboxSet = { urls, index, onChange };
  document.getElementById("lightbox").classList.add("has-set");
  showLightboxImage(index);
}

function stepLightbox(delta) {
  if (!lightboxSet) return;
  const next = lightboxSet.index + delta;
  if (next < 0 || next >= lightboxSet.urls.length) return;
  showLightboxImage(next);
  if (lightboxSet.onChange) lightboxSet.onChange(next);
}

function showLightboxImage(index) {
  const { urls } = lightboxSet;
  const lightbox = document.getElementById("lightbox");
  lightboxSet.index = index;
  document.getElementById("lightbox-img").src = urls[index];
  document.getElementById("lightbox-counter").textContent =
    `${index + 1} / ${urls.length}`;
  lightbox.querySelector(".lightbox-arrow.prev").disabled = index === 0;
  lightbox.querySelector(".lightbox-arrow.next").disabled =
    index === urls.length - 1;
}

function closeLightbox() {
  document.getElementById("lightbox").classList.remove("active");
  document.body.style.overflow = "";
}
