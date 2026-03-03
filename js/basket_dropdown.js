const BUCKET_OVERRIDE = "http://localhost:4566";

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

function updateBasketUI() {
  const basket = getBasket();
  const badge = document.getElementById("basket-badge");
  const dropdownList = document.getElementById("basket-items-list");

  let totalQty = 0;
  let html = "";

  const entries = Object.entries(basket);

  if (entries.length === 0) {
    html = '<div class="empty-state">Your basket is empty 🐈</div>';
  } else {
    entries.forEach(([key, item]) => {
      totalQty += item.quantity;

      // Restore your image transformation logic
      const img =
        typeof transformImageUrl === "function"
          ? transformImageUrl(item.thumbnail_url)
          : item.thumbnail_url;

      const slug = key.split("::")[0];
      const variant = item.variantName || null;

      html += `
                <div class="mini-item">
                    <img src="${img}" alt="${item.name}">
                    <div class="mini-item-info">
                        <div class="mini-item-header">
                            <h4>${item.name}</h4>
                            <button class="remove-mini" onclick="removeFromBasket('${slug}', event, ${variant ? `'${variant}'` : "null"})">
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

  if (badge) {
    badge.textContent = totalQty;
    badge.style.display = totalQty > 0 ? "flex" : "none";
  }

  if (dropdownList) {
    dropdownList.innerHTML = html;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("basket-toggle");

  // Inject the dropdown HTML if it doesn't exist
  if (toggle && !document.getElementById("basket-dropdown")) {
    const dropdownHtml = `
      <div id="basket-dropdown" class="basket-dropdown">
        <div class="dropdown-header">Your Basket</div>
        <div id="basket-items-list" class="basket-items-list"></div>
        <div class="dropdown-footer">
          <a href="/basket.html" class="btn-checkout-mini">Checkout & View Full Basket</a>
        </div>
      </div>
    `;
    toggle.parentElement.insertAdjacentHTML("beforeend", dropdownHtml);
  }

  const dropdown = document.getElementById("basket-dropdown");

  // Toggle logic
  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    updateBasketUI();
    dropdown.classList.toggle("active");
  });

  // Close when clicking outside
  document.addEventListener("click", (e) => {
    if (!toggle.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove("active");
    }
  });

  // Initial UI sync
  updateBasketUI();
});