/**
 * order_success.jinja.js
 * Handles the success page after Stripe checkout.
 * - Validates we arrived from Stripe (session_id in URL)
 * - Clears basket if not already cleared
 * - Fetches order from API and renders items
 */

const API_URL = "https://api.yarnandmoggy.co.uk";

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");

  // Not from Stripe — bounce them
  if (!sessionId) {
    window.location.href = "/shop.html";
    return;
  }

  // Clear basket if not already done for this session
  const basketCleared = localStorage.getItem("basket_cleared");
  if (basketCleared !== "true") {
    localStorage.removeItem("yarn_and_moggy_basket");
    localStorage.setItem("basket_cleared", "true");
    localStorage.setItem("yarn_and_moggy_session", sessionId);
    updateBasketBadge();
  }

  // Fetch order from API
  try {
    const response = await fetch(`${API_URL}/orders/${sessionId}`);

    if (!response.ok) throw new Error("Order not found");

    const order = await response.json();
    renderOrder(order);

  } catch (err) {
    show("success-error");
  } finally {
    hide("success-loading");
  }
});

function renderOrder(order) {
  const container = document.getElementById("order-items");
  const entries = Object.entries(order.basket);
  let html = "";

  entries.forEach(([sku, item]) => {
    const variant = item.variant_name ? `<span class="order-item-variant">${item.variant_name}</span>` : "";
    const img = item.thumbnail_url
      ? `<img src="${item.thumbnail_url}" alt="${item.name}">`
      : "";

    html += `
      <div class="order-item">
        <div class="order-item-img">${img}</div>
        <div class="order-item-info">
          <p class="order-item-name">${item.name}${variant}</p>
          <p class="order-item-qty">Qty: ${item.quantity}</p>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  show("success-content");
}

function show(id) {
  document.getElementById(id).style.display = "block";
}

function hide(id) {
  document.getElementById(id).style.display = "none";
}