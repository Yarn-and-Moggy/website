// These will be populated by the Python build script
const API_URL = "https://tq2jf6n0wo.execute-api.localhost.localstack.cloud:4566/prod/";

let allProducts = [];

/**
 * Helper to get current basket quantity using the pre-existing getBasket function
 */
function getBasketQty(productSlug, variantName = null) {
  const currentBasket =
    typeof getBasket === "function"
      ? getBasket()
      : typeof basket !== "undefined"
        ? basket
        : {};
  const itemKey = variantName ? `${productSlug}:${variantName}` : productSlug;
  return currentBasket[itemKey]?.quantity ?? 0;
}

/**
 * Transforms S3 Virtual-Host style URLs to Localstack Path-style URLs
 */
function transformImageUrl(originalUrl) {
  if (!BUCKET_OVERRIDE) return originalUrl;
  try {
    const urlObj = new URL(originalUrl);
    const bucketName = urlObj.hostname.split(".")[0];
    return `${BUCKET_OVERRIDE.replace(/\/$/, "")}/${bucketName}${urlObj.pathname}`;
  } catch (e) {
    console.warn("URL Transformation failed", e);
    return originalUrl;
  }
}

/**
 * Renders a product card HTML string
 */
function createProductCard(product) {
  const imgUrl = transformImageUrl(product.thumbnail_url);
  const price = (product.price_pence / 100).toFixed(2);
  const productUrl = `/products.html?product-id=${product.slug}`;
  const hasVariants = product.variants && product.variants.length > 0;

  // Calculate stock status considering the basket
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
                    title="${v.name} ${isVarOutOfStock ? "(No more available)" : ""}"
                    style="background-color: ${colour};"
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

  return `
        <article class="shop-item" data-slug="${product.slug}" id="card-${product.slug}">
            <a href="${productUrl}" class="shop-item-link" style="text-decoration: none; color: inherit; display: block;">
                <div class="shop-img-container ${isOutOfStock ? "out-of-stock" : ""}">
                    <img src="${imgUrl}" alt="${product.name}" loading="lazy">
                    
                    ${
                      hasVariants
                        ? `
                        <div class="variant-popover" id="popover-${product.slug}">
                            <p>Pick a colour:</p>
                            <div class="variant-dots-grid">${variantHtml}</div>
                            <button class="close-popover" onclick="event.preventDefault(); toggleVariantPicker('${product.slug}', false)">✕</button>
                        </div>
                    `
                        : ""
                    }

                    ${isOutOfStock ? `<span class="stock-badge">${product.quantity > 0 ? "In Basket" : "Sold Out"}</span>` : ""}
                    
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
                    <p class="price">£${price}</p>
                </div>
            </a>
        </article>
    `;
}

function handleQuickAdd(slug) {
  const product = allProducts.find((p) => p.slug === slug);
  const card = document.getElementById(`card-${slug}`);
  if (!card) return;

  const popover = card.querySelector(`#popover-${slug}`);

  if (popover) {
    toggleVariantPicker(product.slug, true);
  } else {
    if (typeof addToBasket === "function") {
      addToBasket(product, 1);
      // Refresh the card to update stock badges
      refreshProductCard(slug);
    }
  }
}

function selectVariantAndAdd(slug, variantName) {
  const product = allProducts.find((p) => p.slug === slug);
  if (product && typeof addToBasket === "function") {
    addToBasket(product, 1, variantName);
    toggleVariantPicker(product.slug, false);
    // Refresh the card to update stock badges
    refreshProductCard(slug);
  }
}

/**
 * Re-renders a single card in place to update stock visibility
 */
function refreshProductCard(slug) {
  const product = allProducts.find((p) => p.slug === slug);
  const oldCard = document.getElementById(`card-${slug}`);
  if (product && oldCard) {
    const newHtml = createProductCard(product);
    oldCard.outerHTML = newHtml;
  }
}

function toggleVariantPicker(slug, show) {
  const popover = document.getElementById(`popover-${slug}`);
  if (popover) {
    popover.classList.toggle("visible", show);
  }
}

async function fetchProducts(grid, cursor = "") {
  const url = cursor
    ? `${API_URL}/products?cursor=${cursor}`
    : `${API_URL}/products`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    allProducts = [...allProducts, ...data.products];
    const html = data.products.map((p) => createProductCard(p)).join("");
    grid.insertAdjacentHTML("beforeend", html);
    grid.dataset.nextCursor = data.next_cursor || "";
    return data.next_cursor;
  } catch (err) {
    console.error("Failed to load products", err);
    return null;
  }
}

async function initShop() {
  const grid = document.getElementById("product-grid");
  const sentinel = document.getElementById("load-more-sentinel");
  const loading = document.getElementById("shop-loading");
  if (!grid || !sentinel) return;

  let currentCursor = await fetchProducts(grid);
  loading.style.display = "none";

  const observer = new IntersectionObserver(
    async (entries) => {
      if (entries[0].isIntersecting && grid.dataset.nextCursor) {
        currentCursor = await fetchProducts(grid, grid.dataset.nextCursor);
        if (!currentCursor) observer.unobserve(sentinel);
      }
    },
    { rootMargin: "200px" },
  );

  observer.observe(sentinel);
}