/**
 * basket_page.jinja.js
 * Full basket page — line items, qty adjusters, totals, remove confirmation.
 * Depends on: basket.jinja.js (loaded first via base template)
 */

const API_URL = "{{ data.api_url }}";

// Configuration

let config = null;

async function fetchConfig() {
  const response = await fetch(`${API_URL}/config`);
  config = await response.json();
}

// ─── REMOVE CONFIRMATION MODAL ────────────────────────────────────────────────

let pendingRemove = null; // { slug, variantName, itemName }

function showRemoveModal(slug, variantName, itemName) {
  pendingRemove = { slug, variantName, itemName };
  document.getElementById("remove-modal-name").textContent = itemName;
  document.getElementById("remove-modal").style.display = "flex";
  document.getElementById("remove-modal-backdrop").style.display = "block";
}

function hideRemoveModal() {
  pendingRemove = null;
  document.getElementById("remove-modal").style.display = "none";
  document.getElementById("remove-modal-backdrop").style.display = "none";
}

document.getElementById("remove-confirm-btn").addEventListener("click", () => {
  if (!pendingRemove) return;
  const { slug, variantName } = pendingRemove;
  clearItemFromBasket(slug, variantName, () => renderBasketPage());
  hideRemoveModal();
});

document
  .getElementById("remove-cancel-btn")
  .addEventListener("click", hideRemoveModal);
document
  .getElementById("remove-modal-backdrop")
  .addEventListener("click", hideRemoveModal);

// ─── QUANTITY ADJUSTMENT ──────────────────────────────────────────────────────

/**
 * Decrement a line item by 1.
 * If it would hit 0, prompt for removal instead.
 */
function decrementItem(slug, variantName, currentQty, itemName) {
  if (currentQty <= 1) {
    showRemoveModal(slug, variantName, itemName);
    return;
  }

  // Build a minimal product-like object so we can use removeFromBasket
  // We just need to reduce by 1: easiest is to clear and re-add at qty-1
  const basket = getBasket();
  const itemKey = variantName ? `${slug}:${variantName}` : slug;
  const item = basket[itemKey];
  if (!item) return;

  basket[itemKey] = { ...item, quantity: currentQty - 1 };
  localStorage.setItem("yarn_and_moggy_basket", JSON.stringify(basket));

  renderBasketPage();
  updateBasketBadge();
}

/**
 * Increment a line item by 1.
 * Delegates to addToBasket for stock validation.
 * We need the full product from the API to validate stock properly.
 */
async function incrementItem(slug, variantName) {
  try {
    const response = await fetch(`${API_URL}/products/${slug}`);
    if (!response.ok) throw new Error();
    const product = await response.json();
    addToBasket(product, 1, variantName, () => renderBasketPage());
  } catch {
    showBasketMessage(
      "🙀 Couldn't verify stock right now, try again!",
      "error",
    );
  }
}

// ─── RENDER ───────────────────────────────────────────────────────────────────

function renderBasketPage() {
  const basket = getBasket();
  const entries = Object.entries(basket);

  const itemsContainer = document.getElementById("basket-page-items");
  const summary = document.getElementById("basket-summary");
  const emptyState = document.getElementById("basket-empty");
  const headline = document.getElementById("basket-headline");
  const content = document.getElementById("basket-page-content");

  if (entries.length === 0) {
    headline.textContent = "Your Basket";
    content.style.display = "none";
    emptyState.style.display = "flex";
    return;
  }

  // Has items
  emptyState.style.display = "none";
  content.style.display = "grid";
  summary.style.display = "block";

  const totalQty = entries.reduce((sum, [, item]) => sum + item.quantity, 0);
  headline.textContent = `${totalQty} ${totalQty === 1 ? "Item" : "Items"}`;

  let subtotalPence = 0;
  let html = "";

  entries.forEach(([key, item]) => {
    const slug = key.split(":")[0];
    const variant = item.variantName || null;
    const img = transformImageUrl(item.thumbnail_url);
    const lineTotalPence = item.price_pence * item.quantity;
    subtotalPence += lineTotalPence;

    const itemLabel = variant ? `${item.name} — ${variant}` : item.name;

    html += `
      <article class="basket-card" data-sku="${key}">
        <div class="basket-card-img">
          <img src="${img}" alt="${item.name}">
        </div>
        <div class="basket-card-info">
          <div class="basket-card-header">
            <div>
              <h3 class="basket-card-name">${item.name}</h3>
              ${variant ? `<p class="basket-card-variant">${variant}</p>` : ""}
            </div>
            <button class="basket-card-remove"
              onclick="showRemoveModal('${slug}', ${variant ? `'${variant}'` : "null"}, '${itemLabel}')">
              ✕
            </button>
          </div>

          <div class="basket-card-footer">
            <div class="qty-adjuster">
              <button class="qty-btn"
                onclick="decrementItem('${slug}', ${variant ? `'${variant}'` : "null"}, ${item.quantity}, '${itemLabel}')">
                −
              </button>
              <span class="qty-value">${item.quantity}</span>
              <button class="qty-btn"
                onclick="incrementItem('${slug}', ${variant ? `'${variant}'` : "null"})">
                +
              </button>
            </div>
      <p class="basket-card-price">
        <span class="price-each">£${(item.price_pence / 100).toFixed(2)} each</span>
        £${(lineTotalPence / 100).toFixed(2)}
      </p>
          </div>
        </div>
      </article>
    `;
  });

  itemsContainer.innerHTML = html;

  const shippingPence = config?.delivery?.price_pence ?? 355; // fallback just in case
  const shippingName = config?.delivery?.name ?? "Royal Mail Tracked 48";
  const totalPence = subtotalPence + shippingPence;

  document.getElementById("summary-shipping").textContent = `£${(shippingPence / 100).toFixed(2)}`;
  document.getElementById("summary-shipping-name").textContent = shippingName;
  document.getElementById("summary-total").textContent = `£${(totalPence / 100).toFixed(2)}`;

  // Update summary
  const subtotal = (subtotalPence / 100).toFixed(2);
  document.getElementById("summary-subtotal").textContent = `£${subtotal}`;
}

// Listen for checkout clicks
function showValidationErrors(errors) {
  // Clear any existing error states
  document.querySelectorAll(".basket-card-error").forEach(el => el.remove());
  document.querySelectorAll(".basket-card.has-error").forEach(el => el.classList.remove("has-error"));

  Object.entries(errors).forEach(([sku, message]) => {
    const slug = sku.split(":")[0];
    const card = document.querySelector(`[data-sku="${sku}"]`);
    if (!card) return;

    card.classList.add("has-error");
    const errorEl = document.createElement("p");
    errorEl.className = "basket-card-error";
    errorEl.textContent = message;
    card.querySelector(".basket-card-info").appendChild(errorEl);
  });

  showBasketMessage("🙀 Some items need attention before checkout", "error");
}

document.getElementById("checkout-btn").addEventListener("click", async () => {
  const basket = getBasket();
  
  if (Object.keys(basket).length === 0) return;

  const btn = document.getElementById("checkout-btn");
  btn.disabled = true;
  btn.querySelector("span").textContent = "Validating...";

  try {
    const response = await fetch(`${API_URL}/checkout/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yarn_and_moggy_basket: basket })
    });

    if (response.ok) {
      // Redirect to stripe url from response if valid
      const { valid, stripe_url } = await response.json();
      if (valid === true) {
        btn.querySelector("span").textContent = "Redirecting to Stripe...";
        localStorage.setItem("basket_cleared", "false");
        window.location.href = stripe_url;
      }
      return;
    }

    // Validation errors
    const { detail } = await response.json();
    showValidationErrors(detail);

  } catch (err) {
    showBasketMessage("🙀 Something went wrong, please try again", "error");
    btn.disabled = false;
    btn.querySelector("span").textContent = "Proceed to Checkout";
  } 
});

// ─── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  await fetchConfig();
  renderBasketPage();
});
