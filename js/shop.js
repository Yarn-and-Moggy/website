/**
 * shop.jinja.js
 * Product grid rendering + quick-add logic.
 * Depends on: basket.jinja.js (must be loaded first)
 */

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const API_URL = "https://api.yarnandmoggy.co.uk";

// Map colour names to hexcodes
const COLOURMAP = {
  pistachio: "#2dbb90",
  strawberry: "#fc95b0",
}

// Products without a category are treated as this by the API
const DEFAULT_CATEGORY = "cat-toys";

// Keep in sync with .product-grid transitions in styles_shop.css
const GRID_FADE_MS = 250;
const GRID_RESIZE_MS = 500;
// Cards past this index all share the last delay, so long pages don't crawl in
const MAX_STAGGER = 8;

// ─── STATE ────────────────────────────────────────────────────────────────────

let allProducts = [];

// Only set when there's more than one category, otherwise products are unfiltered
let activeCategory = null;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * cat-toys -> Cat Toys
 */
function titleCase(slug) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

/**
 * How many of a given product/variant are already in the basket?
 */
function getBasketQty(productSlug, variantName = null) {
  const basket = typeof getBasket === "function" ? getBasket() : {};
  const itemKey = variantName ? `${productSlug}:${variantName}` : productSlug;
  return basket[itemKey]?.quantity ?? 0;
}

// ─── CARD RENDERING ───────────────────────────────────────────────────────────

function createProductCard(product, index = 0) {
  const imgUrl = transformImageUrl(product.thumbnail_url);
  const price = (product.price_pence / 100).toFixed(2);
  const productUrl = `/products.html?product-id=${product.slug}`;
  const hasVariants = product.variants && product.variants.length > 0;
  const tagline = product.tagline || null;

  let totalAvailable = 0;
  let variantHtml = "";

  if (hasVariants) {
    variantHtml = product.variants
      .map((v) => {
        const inBasket = getBasketQty(product.slug, v.name);
        const available = Math.max(0, v.quantity - inBasket);
        totalAvailable += available;

        const isVarOutOfStock = available <= 0;
        const colour = v.name.split(" ")[0].toLowerCase();

        return `
          <button class="variant-dot ${isVarOutOfStock ? "disabled" : ""}"
                  title="${v.name}${isVarOutOfStock ? " (No more available)" : ""}"
                  style="background-color: ${COLOURMAP[colour] || colour};"
                  ${isVarOutOfStock ? "disabled" : ""}
                  onclick="event.preventDefault(); selectVariantAndAdd('${product.slug}', '${v.name}')">
          </button>
        `;
      })
      .join("");
  } else {
    const inBasket = getBasketQty(product.slug);
    totalAvailable = Math.max(0, product.quantity - inBasket);
  }

  const isOutOfStock = totalAvailable <= 0;
  const isLastOne = totalAvailable === 1;

  return `
    <article class="shop-item" data-slug="${product.slug}" id="card-${product.slug}"
             style="--stagger: ${Math.min(index, MAX_STAGGER)};">
      <a href="${productUrl}" class="shop-item-link" style="text-decoration: none; color: inherit; display: block;">
        <div class="shop-img-container ${isOutOfStock ? "out-of-stock" : ""}">
          <img src="${imgUrl}" alt="${product.name}" loading="lazy"
               onload="this.classList.add('loaded')" onerror="this.classList.add('loaded')">

          ${hasVariants ? `
            <div class="variant-popover" id="popover-${product.slug}">
              <p>Pick a colour:</p>
              <div class="variant-dots-grid">${variantHtml}</div>
              <button class="close-popover"
                onclick="event.preventDefault(); toggleVariantPicker('${product.slug}', false)">&#x2715;</button>
            </div>
          ` : ""}

          ${isOutOfStock ? `
            <span class="stock-badge">${product.quantity > 0 ? "In Basket" : "Sold Out"}</span>
          ` : isLastOne ? `
            <span class="stock-badge last-one">Last one!</span>
          ` : ""}

          <button class="quick-add"
                  ${isOutOfStock ? "disabled" : ""}
                  onclick="event.preventDefault(); handleQuickAdd('${product.slug}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>
        <div class="shop-item-info">
          <h3>${product.name}</h3>
          ${tagline ? `<h4>${tagline}</h4>` : ""}
          <p class="price">&pound;${price}</p>
        </div>
      </a>
    </article>
  `;
}

/**
 * Re-renders a single card in place.
 * This is the onSuccess hook target — pass it directly to addToBasket.
 * Mutates the elements
 */
function refreshProductCard(slug) {
  const product = allProducts.find((p) => p.slug === slug);
  const card = document.getElementById(`card-${slug}`);
  if (!product || !card) return;

  // Recalculate availability
  const hasVariants = product.variants?.length > 0;
  let totalAvailable = 0;

  if (hasVariants) {
    // Update each variant dot's disabled state
    product.variants.forEach((v) => {
      const inBasket = getBasketQty(product.slug, v.name);
      const available = Math.max(0, v.quantity - inBasket);
      totalAvailable += available;

      const dot = card.querySelector(`[title^="${v.name}"]`);
      if (dot) {
        dot.disabled = available <= 0;
        dot.classList.toggle("disabled", available <= 0);
        dot.title = `${v.name}${available <= 0 ? " (No more available)" : ""}`;
      }
    });
  } else {
    const inBasket = getBasketQty(product.slug);
    totalAvailable = Math.max(0, product.quantity - inBasket);
  }

  const isOutOfStock = totalAvailable <= 0;
  const isLastOne = totalAvailable === 1;
  const imgContainer = card.querySelector(".shop-img-container");
  const badge = card.querySelector(".stock-badge");
  const quickAdd = card.querySelector(".quick-add");

  imgContainer?.classList.toggle("out-of-stock", isOutOfStock);
  quickAdd && (quickAdd.disabled = isOutOfStock);

  // Update or insert/remove the stock badge
  if (isOutOfStock) {
    if (!badge) {
      const span = document.createElement("span");
      span.className = "stock-badge";
      span.textContent = product.quantity > 0 ? "In Basket" : "Sold Out";
      imgContainer?.appendChild(span);
    } else {
      badge.classList.remove("last-one");
      badge.textContent = product.quantity > 0 ? "In Basket" : "Sold Out";
    }
  } else if (isLastOne) {
    if (!badge) {
      const span = document.createElement("span");
      span.className = "stock-badge last-one";
      span.textContent = "Last one!";
      imgContainer?.appendChild(span);
    } else {
      badge.className = "stock-badge last-one";
      badge.textContent = "Last one!";
    }
  } else if (badge) {
    badge.remove();
  }
}

// ─── QUICK ADD INTERACTIONS ───────────────────────────────────────────────────

function handleQuickAdd(slug) {
  const product = allProducts.find((p) => p.slug === slug);
  if (!product) return;

  const card = document.getElementById(`card-${slug}`);
  const popover = card?.querySelector(`#popover-${slug}`);

  if (popover) {
    // Has variants — show the colour picker popover
    toggleVariantPicker(product.slug, true);
  } else {
    // No variants — add directly, refresh card on success
    addToBasket(product, 1, null, (p) => refreshProductCard(p.slug));
  }
}

function selectVariantAndAdd(slug, variantName) {
  const product = allProducts.find((p) => p.slug === slug);
  if (!product) return;

  addToBasket(product, 1, variantName, (p) => {
    toggleVariantPicker(p.slug, false);
    refreshProductCard(p.slug);
  });
}

function toggleVariantPicker(slug, show) {
  const popover = document.getElementById(`popover-${slug}`);
  if (popover) popover.classList.toggle("visible", show);
}

// ─── DATA FETCHING + INFINITE SCROLL ─────────────────────────────────────────

/**
 * Fetch one page of products for the active category. Returns null on failure
 */
async function requestProducts(cursor = "") {
  const params = new URLSearchParams();
  if (activeCategory) params.set("category", activeCategory);
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();
  const url = query ? `${API_URL}/products?${query}` : `${API_URL}/products`;

  try {
    const response = await fetch(url);
    return await response.json();
  } catch (err) {
    console.error("Failed to load products", err);
    return null;
  }
}

function renderProducts(grid, data, replace = false) {
  const products = data?.products ?? [];
  if (replace) {
    grid.innerHTML = "";
    allProducts = [];
  }
  allProducts = [...allProducts, ...products];
  grid.insertAdjacentHTML("beforeend", products.map(createProductCard).join(""));
  grid.dataset.nextCursor = data?.next_cursor || "";
}

async function fetchProducts(grid, cursor = "") {
  // Category may change while this request is in flight
  const requestedCategory = activeCategory;
  const data = await requestProducts(cursor);
  if (requestedCategory === activeCategory) renderProducts(grid, data);
}

/**
 * Smooth scroll so "The Collection" sits at the top, below the nav when it's sticky.
 * Resolves once the scroll has finished.
 */
function scrollToCollection(maxScroll) {
  const header = document.getElementById("shop-header");
  if (!header) return Promise.resolve();

  const nav = document.getElementById("header-nav");
  const navOffset =
    nav && getComputedStyle(nav).position === "sticky" ? nav.offsetHeight : 0;
  const target = Math.max(
    0,
    Math.min(header.getBoundingClientRect().top + window.scrollY - navOffset - 16, maxScroll)
  );
  if (Math.abs(window.scrollY - target) < 2) return Promise.resolve();

  if (prefersReducedMotion()) {
    window.scrollTo({ top: target });
    return Promise.resolve();
  }

  window.scrollTo({ top: target, behavior: "smooth" });
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(fallback);
      window.removeEventListener("scrollend", done);
      resolve();
    };
    // Older Safari has no scrollend
    const fallback = setTimeout(done, 1000);
    window.addEventListener("scrollend", done);
  });
}

async function fetchCategories() {
  try {
    const response = await fetch(`${API_URL}/categories`);
    const data = await response.json();
    return data.categories || [];
  } catch (err) {
    console.error("Failed to load categories", err);
    return [];
  }
}

/**
 * Pick the starting category: ?category= if valid, else the default, else the first
 */
function getInitialCategory(categories) {
  const slugs = categories.map((c) => c.category);
  const requested = new URLSearchParams(location.search).get("category");
  if (requested && slugs.includes(requested)) return requested;
  if (slugs.includes(DEFAULT_CATEGORY)) return DEFAULT_CATEGORY;
  return slugs[0];
}

/**
 * Only shown when there's more than one category
 */
function renderCategoryPills(categories) {
  const container = document.getElementById("category-pills");
  if (!container || categories.length < 2) return;

  activeCategory = getInitialCategory(categories);
  // Default first, so newer categories come after it (the 2nd pill gets the "New!" sticker)
  const ordered = [
    ...categories.filter((c) => c.category === DEFAULT_CATEGORY),
    ...categories.filter((c) => c.category !== DEFAULT_CATEGORY),
  ];
  container.innerHTML = ordered
    .map(({ category }) => {
      const isActive = category === activeCategory;
      return `
        <button class="category-pill ${isActive ? "active" : ""}"
                data-category="${category}"
                aria-pressed="${isActive}">
          ${titleCase(category)}
        </button>
      `;
    })
    .join("");
  container.hidden = false;
}

async function selectCategory(category, grid, sentinel, observer) {
  if (category === activeCategory) return;
  activeCategory = category;

  document.querySelectorAll(".category-pill").forEach((pill) => {
    const isActive = pill.dataset.category === category;
    pill.classList.toggle("active", isActive);
    pill.setAttribute("aria-pressed", isActive);
  });

  const url = new URL(location.href);
  url.searchParams.set("category", category);
  history.replaceState(null, "", url);

  // Pause infinite scroll so the swap can't trigger a page load mid-transition
  observer.unobserve(sentinel);

  // Hold the grid's height while it's swapped so the page doesn't jump
  grid.classList.remove("is-resizing");
  const heldHeight = grid.offsetHeight;
  grid.style.minHeight = `${heldHeight}px`;
  grid.classList.add("is-switching");

  // Fade out and fetch at the same time, continue once both are done
  const [data] = await Promise.all([
    requestProducts(),
    wait(prefersReducedMotion() ? 0 : GRID_FADE_MS),
  ]);
  if (category !== activeCategory) return;

  renderProducts(grid, data, true);
  grid.classList.remove("is-switching");
  await nextFrame();

  // Measure how tall the page will be once the height is released, so the
  // scroll never overshoots and jumps back when the grid shrinks
  grid.style.minHeight = "";
  const newHeight = grid.offsetHeight;
  grid.style.minHeight = `${heldHeight}px`;
  const shrinkBy = Math.max(0, heldHeight - newHeight);
  const maxScroll =
    document.documentElement.scrollHeight - shrinkBy - window.innerHeight;

  // Ease down to the new height rather than snapping, so content below
  // doesn't jump up when switching to a category with fewer products
  if (shrinkBy > 0) {
    grid.classList.add("is-resizing");
    grid.style.minHeight = `${newHeight}px`;
  }

  await Promise.all([
    scrollToCollection(maxScroll),
    wait(shrinkBy > 0 && !prefersReducedMotion() ? GRID_RESIZE_MS : 0),
  ]);
  if (category !== activeCategory) return;

  grid.classList.remove("is-resizing");
  grid.style.minHeight = "";
  observer.observe(sentinel);
}

async function initShop() {
  const grid = document.getElementById("product-grid");
  const sentinel = document.getElementById("load-more-sentinel");
  const loading = document.getElementById("shop-loading");
  if (!grid || !sentinel) return;

  renderCategoryPills(await fetchCategories());
  await fetchProducts(grid);
  if (loading) loading.style.display = "none";

  const shopHeader = document.getElementById("shop-header");
  if (shopHeader) shopHeader.classList.add("visible");

  const observer = new IntersectionObserver(
    async (entries) => {
      if (entries[0].isIntersecting && grid.dataset.nextCursor) {
        await fetchProducts(grid, grid.dataset.nextCursor);
        if (!grid.dataset.nextCursor) observer.unobserve(sentinel);
      }
    },
    { rootMargin: "200px" }
  );

  observer.observe(sentinel);

  document.getElementById("category-pills")?.addEventListener("click", (e) => {
    const pill = e.target.closest(".category-pill");
    if (pill) selectCategory(pill.dataset.category, grid, sentinel, observer);
  });
}

// listen for basket changes
document.addEventListener("basketItemRemoved", ({ detail }) => {
  refreshProductCard(detail.slug);
});