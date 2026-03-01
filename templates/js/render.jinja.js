// These will be populated by the Python build script
const API_URL = "{{ data.api_url }}";
const BUCKET_OVERRIDE = "{{ data.bucket_url or '' }}";

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
 * Renders a product card HTML string.
 * @param {Object} product - The ProductListing object from the API
 */
function createProductCard(product) {
  const imgUrl = transformImageUrl(product.thumbnail_url);
  const price = (product.price_pence / 100).toFixed(2);
  const isOutOfStock = !product.in_stock;
  const productUrl = `/products.html?product-id=${product.slug}`

  return `
        <article class="shop-item" data-slug="${product.slug}">
            <a href="${productUrl}" class="shop-item-link" style="text-decoration: none; color: inherit; display: block;">
                <div class="shop-img-container ${isOutOfStock ? "out-of-stock" : ""}">
                    <img src="${imgUrl}" alt="${product.name}" loading="lazy">
                    ${isOutOfStock ? '<span class="stock-badge">Sold Out</span>' : ""}
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

/**
 * Quick add button (does nothing at the moment)
 */
async function handleQuickAdd(slug) {
  console.log(`Adding ${slug} to basket...`);
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
  let nextCursor = grid.dataset.nextCursor;

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
