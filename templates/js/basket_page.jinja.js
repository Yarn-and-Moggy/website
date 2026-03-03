/**
 * basket_page.jinja.js
 * Full basket page — line items, qty adjusters, totals, remove confirmation.
 * Depends on: basket.jinja.js (loaded first via base template)
 */

const API_URL = "{{ data.api_url }}";

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

document.getElementById("remove-cancel-btn").addEventListener("click", hideRemoveModal);
document.getElementById("remove-modal-backdrop").addEventListener("click", hideRemoveModal);

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
    showBasketMessage("🙀 Couldn't verify stock right now, try again!", "error");
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
      <article class="basket-card">
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
            <p class="basket-card-price">£${(lineTotalPence / 100).toFixed(2)}</p>
          </div>
        </div>
      </article>
    `;
  });

  itemsContainer.innerHTML = html;

  // Update summary
  const subtotal = (subtotalPence / 100).toFixed(2);
  document.getElementById("summary-subtotal").textContent = `£${subtotal}`;
  document.getElementById("summary-total").textContent = `£${subtotal}`;
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", renderBasketPage);
