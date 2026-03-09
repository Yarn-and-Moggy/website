/**
 * basket.jinja.js
 * Unified basket management + dropdown UI.
 * Merges: basket.js + basket_dropdown.js
 *
 * Public API:
 *   getBasket()
 *   addToBasket(product, quantity, variantName, onSuccess)
 *   removeFromBasket(slug, event, variantName, onSuccess)
 *   clearItemFromBasket(slug, variantName, onSuccess)
 *   updateBasketBadge()
 *   updateBasketUI()
 *   showBasketMessage(text, type)
 *   triggerBasketAnimation(sourceElement)
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const BASKET_KEY = "yarn_and_moggy_basket";
const BUCKET_OVERRIDE = "";

// ─── IMAGE URL TRANSFORM ──────────────────────────────────────────────────────

function transformImageUrl(originalUrl) {
  if (!originalUrl) return "";
  if (!BUCKET_OVERRIDE) return originalUrl;
  try {
    const urlObj = new URL(originalUrl);
    const bucketName = urlObj.hostname.split(".")[0];
    return `${BUCKET_OVERRIDE.replace(/\/$/, "")}/${bucketName}${urlObj.pathname}`;
  } catch (e) {
    return originalUrl;
  }
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────

function getBasket() {
  try {
    const saved = localStorage.getItem(BASKET_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    console.error("Basket parsing failed", e);
    return {};
  }
}

function saveBasket(basket) {
  localStorage.setItem(BASKET_KEY, JSON.stringify(basket));
}

// ─── BADGE ────────────────────────────────────────────────────────────────────

function updateBasketBadge() {
  const basket = getBasket();
  const badge = document.getElementById("basket-badge");
  if (!badge) return;

  const totalCount = Object.values(basket).reduce(
    (sum, item) =>
      sum + (typeof item?.quantity === "number" ? item.quantity : 0),
    0,
  );

  if (totalCount > 0) {
    badge.textContent = totalCount;
    badge.style.display = "flex";
    badge.classList.remove("badge-pop");
    void badge.offsetWidth; // force reflow to re-trigger animation
    badge.classList.add("badge-pop");
  } else {
    badge.style.display = "none";
  }
}

// ─── DROPDOWN UI ─────────────────────────────────────────────────────────────

function updateBasketUI() {
  const basket = getBasket();
  const dropdownList = document.getElementById("basket-items-list");
  let totalQty = 0;
  let html = "";

  const entries = Object.entries(basket);

  if (entries.length === 0) {
    html = '<div class="empty-state">Your basket is empty 🐈</div>';
  } else {
    entries.forEach(([key, item]) => {
      totalQty += item.quantity;
      const img = transformImageUrl(item.thumbnail_url);
      // Key format is "slug:variantName" (single colon)
      const slug = key.split(":")[0];
      const variant = item.variantName || null;

      html += `
        <div class="mini-item">
          <img src="${img}" alt="${item.name}">
          <div class="mini-item-info">
            <div class="mini-item-header">
              <h4>${item.name}</h4>
              <button class="remove-mini"
                onclick="removeFromBasket('${slug}', event, ${variant ? `'${variant}'` : "null"})">
                ✕
              </button>
            </div>
            <p>${item.quantity} × £${(item.price_pence / 100).toFixed(2)}</p>
            ${item.variantName ? `<small>${item.variantName}</small>` : ""}
          </div>
        </div>
      `;
    });
  }

  if (dropdownList) {
    dropdownList.innerHTML = html;
  }

  // Also keep the badge in sync
  updateBasketBadge();
}

// ─── TOAST MESSAGES ───────────────────────────────────────────────────────────

function showBasketMessage(text, type = "success") {
  let container = document.getElementById("basket-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "basket-toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `basket-toast ${type}`;
  toast.innerText = text;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

// ─── CORE BASKET OPERATIONS ───────────────────────────────────────────────────

/**
 * Add an item to the basket.
 * @param {object}   product      - Product object (must have slug, name, price_pence, thumbnail_url, quantity, variants)
 * @param {number}   quantity     - How many to add (default 1)
 * @param {string}   variantName  - Variant name, or null for non-variant products
 * @param {Function} onSuccess    - Optional callback fired after a successful add.
 *                                  Receives (product, variantName) so callers can refresh their UI.
 * @returns {boolean} true if added, false if blocked by stock validation
 */
function addToBasket(
  product,
  quantity = 1,
  variantName = null,
  onSuccess = null,
) {
  const basket = getBasket();
  const itemKey = variantName ? `${product.slug}:${variantName}` : product.slug;

  // Determine available stock
  let availableStock = 0;
  if (variantName) {
    const variant = product.variants?.find((v) => v.name === variantName);
    availableStock = variant ? variant.quantity : 0;
  } else {
    availableStock = product.quantity || 0;
  }

  const currentBasketCount = basket[itemKey]?.quantity ?? 0;
  const requestedTotal = currentBasketCount + quantity;

  // Stock validation
  if (requestedTotal > availableStock) {
    const message =
      availableStock === 0
        ? "🙀 Sorry, this item is sold out!"
        : `🙀 Sorry, we only have ${availableStock} in stock. You already have ${currentBasketCount} in your basket.`;

    showBasketMessage(message, "error");

    const btn =
      document.querySelector(`[data-slug="${product.slug}"] .quick-add`) ||
      document.getElementById("add-to-cart-btn");
    if (btn) {
      btn.classList.add("shudder");
      setTimeout(() => btn.classList.remove("shudder"), 500);
    }
    return false;
  }

  // Commit to basket
  basket[itemKey] = {
    quantity: requestedTotal,
    name: product.name,
    variantName: variantName,
    price_pence: product.price_pence,
    thumbnail_url: product.thumbnail_url,
  };

  saveBasket(basket);

  updateBasketBadge();

  showBasketMessage(
    variantName
      ? `😻 Added ${variantName} ${product.name}!`
      : `😻 Added ${product.name}!`,
  );

  // Fire the success callback so callers (shop, product detail) can refresh their own UI
  if (typeof onSuccess === "function") {
    onSuccess(product, variantName);
  }

  return true;
}

/**
 * Remove an item from the basket (full line removal regardless of quantity).
 * @param {string}   slug        - Product slug
 * @param {Event}    event       - Optional click event (used for animated removal of the mini-item DOM node)
 * @param {string}   variantName - Variant name or null
 * @param {Function} onSuccess   - Optional callback fired after successful removal. Receives (slug, variantName).
 */
function removeFromBasket(
  slug,
  event = null,
  variantName = null,
  onSuccess = null,
) {
  const basket = getBasket();
  // NOTE: key uses single colon ":" to match addToBasket
  const itemKey = variantName ? `${slug}:${variantName}` : slug;

  if (!basket[itemKey]) return;

  delete basket[itemKey];

  // If we have a DOM element to animate out, do that then commit
  if (event?.target) {
    const itemElement = event.target.closest(".mini-item");
    if (itemElement) {
      Object.assign(itemElement.style, {
        opacity: "0",
        transform: "translateX(10px)",
        transition: "all 0.2s ease",
      });

      setTimeout(() => {
        itemElement.remove();
        saveBasket(basket);
        updateBasketBadge();
        if (Object.keys(basket).length === 0) updateBasketUI();
        if (typeof onSuccess === "function") onSuccess(slug, variantName);
        document.dispatchEvent(
          new CustomEvent("basketItemRemoved", {
            detail: { slug, variantName },
          }),
        );
      }, 200);
      return;
    }
  }

  saveBasket(basket);
  updateBasketUI();

  if (typeof onSuccess === "function") {
    onSuccess(slug, variantName);
  }
}

/**
 * Convenience alias for removing an entire line item.
 */
function clearItemFromBasket(
  productSlug,
  variantName = null,
  onSuccess = null,
) {
  return removeFromBasket(productSlug, null, variantName, onSuccess);
}

// ─── DROPDOWN INIT ────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // Inject dropdown HTML if not already in the template
  const toggle = document.getElementById("basket-toggle");
  if (toggle && !document.getElementById("basket-dropdown")) {
    toggle.parentElement.insertAdjacentHTML(
      "beforeend",
      `<div id="basket-dropdown" class="basket-dropdown">
        <div class="dropdown-header">Your Basket</div>
        <div id="basket-items-list" class="basket-items-list"></div>
        <div class="dropdown-footer">
          <a href="/basket.html" class="btn-checkout-mini">Checkout &amp; View Full Basket</a>
        </div>
      </div>`,
    );
  }

  // On basket page do not drop down the basket
  const main = document.getElementsByTagName("main")[0];
  if (main.classList.contains("page-basket")) {
    updateBasketUI();
    return;
  }

  const dropdown = document.getElementById("basket-dropdown");

  if (toggle && dropdown) {
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      updateBasketUI();
      dropdown.classList.toggle("active");
    });

    document.addEventListener("click", (e) => {
      if (!toggle.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove("active");
      }
    });
  }

  // Sync badge & dropdown on every page load
  updateBasketUI();
});