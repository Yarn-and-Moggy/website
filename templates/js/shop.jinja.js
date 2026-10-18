/**
 * shop.jinja.js
 * Product grid rendering + quick-add logic.
 * Depends on: basket.jinja.js (must be loaded first)
 */

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const API_URL = "{{ data.api_url }}";

// Map colour names to hexcodes
const COLOURMAP = {
  pistachio: "#2dbb90",
  strawberry: "#fc95b0",
}

// Products without a category are treated as this by the API
const DEFAULT_CATEGORY = "cat-toys";

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

/**
 * How many of a given product/variant are already in the basket?
 */
function getBasketQty(productSlug, variantName = null) {
  const basket = typeof getBasket === "function" ? getBasket() : {};
  const itemKey = variantName ? `${productSlug}:${variantName}` : productSlug;
  return basket[itemKey]?.quantity ?? 0;
}

// ─── CARD RENDERING ───────────────────────────────────────────────────────────

function createProductCard(product) {
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
    <article class="shop-item" data-slug="${product.slug}" id="card-${product.slug}">
      <a href="${productUrl}" class="shop-item-link" style="text-decoration: none; color: inherit; display: block;">
        <div class="shop-img-container ${isOutOfStock ? "out-of-stock" : ""}">
          <img src="${imgUrl}" alt="${product.name}" loading="lazy">

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

async function fetchProducts(grid, cursor = "") {
  const params = new URLSearchParams();
  if (activeCategory) params.set("category", activeCategory);
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();
  const url = query ? `${API_URL}/products?${query}` : `${API_URL}/products`;

  // Category may change while this request is in flight
  const requestedCategory = activeCategory;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (requestedCategory !== activeCategory) return;

    allProducts = [...allProducts, ...data.products];
    grid.insertAdjacentHTML(
      "beforeend",
      data.products.map(createProductCard).join("")
    );
    grid.dataset.nextCursor = data.next_cursor || "";
  } catch (err) {
    console.error("Failed to load products", err);
    if (requestedCategory === activeCategory) grid.dataset.nextCursor = "";
  }
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
  container.innerHTML = categories
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

  grid.innerHTML = "";
  grid.dataset.nextCursor = "";
  allProducts = [];

  await fetchProducts(grid);
  // The previous category may have run out of pages and stopped observing
  if (category === activeCategory) observer.observe(sentinel);
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
