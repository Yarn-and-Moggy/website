// These will be populated by the Python build script
const API_URL = "{{ data.api_url }}";
const BUCKET_OVERRIDE = "{{ data.bucket_url or '' }}";

let allProducts = [];

/**
 * Transforms S3 Virtual-Host style URLs to Localstack Path-style URLs if BUCKET_OVERRIDE is provided.
 * @param {string} originalUrl
 * @returns {string}
 */
function transformImageUrl(originalUrl) {
  if (!BUCKET_OVERRIDE) return originalUrl;

  try {
    const urlObj = new URL(originalUrl);
    // Extract bucket name from "bucket-name.s3.amazonaws.com"
    const bucketName = urlObj.hostname.split(".")[0];
    // Combine: base + bucket + path
    return `${BUCKET_OVERRIDE.replace(/\/$/, "")}/${bucketName}${urlObj.pathname}`;
  } catch (e) {
    console.warn("URL Transformation failed, falling back to original", e);
    return originalUrl;
  }
}

/**
 * Renders a product card HTML string with a hidden variant popover.
 * @param {Object} product - The ProductListing object from the API
 */
function createProductCard(product) {
  const imgUrl = transformImageUrl(product.thumbnail_url);
  const price = (product.price_pence / 100).toFixed(2);
  const isOutOfStock = !product.in_stock;
  const productUrl = `/products.html?product-id=${product.slug}`;
  const hasVariants = product.variants && product.variants.length > 0;

  // Generate variant dots for the popover if they exist
  let variantHtml = "";
  if (hasVariants) {
    variantHtml = product.variants
      .map((v) => {
        const isVarOutOfStock = v.quantity <= 0;
        // Extract colour from name (e.g., "Pink Wool" -> "pink") or fallback to gray
        const colour = v.name.split(" ")[0].toLowerCase();
        return `
                <button class="variant-dot ${isVarOutOfStock ? "disabled" : ""}" 
                        title="${v.name} ${isVarOutOfStock ? "(Sold Out)" : ""}"
                        style="background-color: ${colour};"
                        ${isVarOutOfStock ? "disabled" : ""}
                        onclick="event.preventDefault(); selectVariantAndAdd('${product.slug}', '${v.name}')">
                </button>
            `;
      })
      .join("");
  }

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

                    ${isOutOfStock ? '<span class="stock-badge">Sold Out</span>' : ""}
                    
                    <button class="quick-add" 
                            ${isOutOfStock ? "disabled" : ""} 
                            onclick="event.preventDefault(); handleQuickAdd('${product.slug}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentcolor" stroke-width="2.5">
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

/**
 * Logic for the Quick Add button
 */
async function handleQuickAdd(slug) {
  // 1. Find the product data from our global state/cached products
  const product = allProducts.find((p) => p.slug === slug);
  if (!product) return;

  const hasVariants = product.variants && product.variants.length > 0;

  if (hasVariants) {
    // Show popover instead of adding
    toggleVariantPicker(slug, true);
  } else {
    // Direct add
    if (typeof addToBasket === "function") {
      addToBasket(product, 1);
    }
  }
}

/**
 * Toggles the variant selector popover
 */
function toggleVariantPicker(slug, show) {
  const popover = document.getElementById(`popover-${slug}`);
  if (popover) {
    popover.classList.toggle("visible", show);
  } 
}

/**
 * Called when a specific variant dot is clicked inside the popover
 */
function selectVariantAndAdd(slug, variantName) {
  const product = allProducts.find((p) => p.slug === slug);
  if (product && typeof addToBasket === "function") {
    addToBasket(product, 1, variantName);
    toggleVariantPicker(product.slug, false);
  }
}
/**
 * Core function to fetch and append products to the grid
 */
async function fetchProducts(grid, cursor = "") {
  const url = cursor
    ? `${API_URL}/products?cursor=${cursor}`
    : `${API_URL}/products`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    // Add new products to our master list
    allProducts = [...allProducts, ...data.products];
    const html = data.products.map((p) => createProductCard(p)).join("");
    grid.insertAdjacentHTML("beforeend", html);

    // Update the cursor on the grid for the observer to read
    grid.dataset.nextCursor = data.next_cursor || "";
    return data.next_cursor;
  } catch (err) {
    console.error("Failed to load products", err);
    return null;
  }
}

/**
 * Initialise shop and set up observer for lazy loading
 */
async function initShop() {
  const grid = document.getElementById("product-grid");
  const sentinel = document.getElementById("load-more-sentinel");
  const loading = document.getElementById("shop-loading");
  if (!grid || !sentinel) return;

  let currentCursor = await fetchProducts(grid);

  loading.style.display = "none";

  const observer = new IntersectionObserver(
    async (entries) => {
      // Only trigger if we are intersecting AND we actually have a next page
      if (entries[0].isIntersecting && grid.dataset.nextCursor) {
        currentCursor = await fetchProducts(grid, grid.dataset.nextCursor);

        // If no more items, stop watching
        if (!currentCursor) {
          observer.unobserve(sentinel);
        }
      }
    },
    { rootMargin: "200px" },
  );

  observer.observe(sentinel);
}
