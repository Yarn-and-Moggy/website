/**
 * Global Basket Management
 */
const BASKET_KEY = "yarn_and_moggy_basket";

// Initialise/Get basket from localStorage
function getBasket() {
  const saved = localStorage.getItem(BASKET_KEY);
  try {
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    console.error("Basket parsing failed", e);
    return {};
  }
}

// Save basket to localStorage and update UI
function saveBasket(basket) {
  localStorage.setItem(BASKET_KEY, JSON.stringify(basket));
}

/**
 * FLYING ANIMATION
 * Creates a "ghost" of the product image that flies to the basket
 * @param {HTMLElement} sourceElement - The image or container to fly from
 */
function triggerBasketAnimation(sourceElement) {
  const badge = document.getElementById("basket-badge");
  if (!badge || !sourceElement) return;

  // Get coordinates and ensure they are valid
  const sourceRect = sourceElement.getBoundingClientRect();
  const badgeRect = badge.getBoundingClientRect();

  // Find the actual image source
  let imgSrc = "";
  const imgEl =
    sourceElement.tagName === "IMG"
      ? sourceElement
      : sourceElement.querySelector("img");

  if (imgEl && imgEl.src) {
    imgSrc = imgEl.src;
  } else {
    // Fallback: Check computed background image
    const bg = window.getComputedStyle(sourceElement).backgroundImage;
    if (bg && bg !== "none") {
      imgSrc = bg.replace(/url\(['"]?(.*?)['"]?\)/i, "$1");
    }
  }

  // Create the "Ghost" element
  const ghost = document.createElement("div");

  // Initial Styles (Matching the source exactly)
  Object.assign(ghost.style, {
    position: "fixed",
    top: `${sourceRect.top}px`,
    left: `${sourceRect.left}px`,
    width: `${sourceRect.width}px`,
    height: `${sourceRect.height}px`,
    margin: "0",
    padding: "0",
    zIndex: "10000",
    pointerEvents: "none",
    transition: "all 0.8s cubic-bezier(0.45, 0.05, 0.55, 0.95)",
    backgroundSize: "cover",
    backgroundPosition: "center",
    borderRadius: window.getComputedStyle(sourceElement).borderRadius || "12px",
    boxShadow: "0 5px 15px rgba(0,0,0,0.2)",
    opacity: "1",
  });

  if (imgSrc) {
    ghost.style.backgroundImage = `url(${imgSrc})`;
  } else {
    ghost.style.backgroundColor = "var(--pastel-pink, #ef9fa9)";
  }

  document.body.appendChild(ghost);

  // Trigger the flight
  // We use two frames to ensure the browser has rendered the initial state
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      Object.assign(ghost.style, {
        top: `${badgeRect.top + badgeRect.height / 2}px`,
        left: `${badgeRect.left + badgeRect.width / 2}px`,
        width: "20px",
        height: "20px",
        opacity: "0.2",
        transform: "translate(-50%, -50%) rotate(720deg) scale(0.1)",
      });
    });
  });

  // Clean up and pop the badge
  setTimeout(() => {
    ghost.remove();

    // Badge "Pop" effect
    updateBasketBadge();

    // Highlight badge briefly
    const originalColor = badge.style.backgroundColor;
    badge.style.backgroundColor = "var(--accent-pink, #e55381)";
    badge.style.transform = "scale(1.4)";

    setTimeout(() => {
      badge.style.backgroundColor = originalColor;
      badge.style.transform = "";
    }, 300);
  }, 850);
}

// Add item to basket
function addToBasket(product, quantity = 1, variantName = null) {
  let basket = getBasket();
  const itemKey = variantName
    ? `${product.slug}::${variantName}`
    : product.slug;

  // Determine available stock for this specific choice
  let availableStock = 0;
  if (variantName) {
    const variant = product.variants?.find((v) => v.name === variantName);
    availableStock = variant ? variant.quantity : 0;
  } else {
    availableStock = product.quantity || 0;
  }

  // Check current basket count to see how many we already have
  const currentBasketCount = basket[itemKey] ? basket[itemKey].quantity : 0;
  const requestedTotal = currentBasketCount + quantity;

  // Validation Assertion
  if (requestedTotal > availableStock) {
    const message =
      availableStock === 0
        ? "🙀 Sorry, this item is sold out!"
        : `🙀 Sorry, we only have ${availableStock} in stock. You already have ${currentBasketCount} in your basket.`;

    showBasketMessage(message, "error");

    // Trigger the shudder on the relevant button if it exists
    const btn =
      document.querySelector(`[data-slug="${product.slug}"] .quick-add`) ||
      document.getElementById("add-to-cart-btn");
    if (btn) {
      btn.classList.add("shudder");
      setTimeout(() => btn.classList.remove("shudder"), 500);
    }
    return false;
  }

  // If validation passes, update the basket
  basket[itemKey] = {
    quantity: requestedTotal,
    // store metadata for the basket UI
    name: product.name,
    variantName: variantName,
    price_pence: product.price_pence,
    thumbnail_url: product.thumbnail_url,
  };

  saveBasket(basket);

  // UI Feedback
  const productCard = document.querySelector(`[data-slug="${product.slug}"]`);
  if (productCard) {
    triggerBasketAnimation(productCard);
  }

  showBasketMessage(
    variantName
      ? `😻 Added ${variantName} ${product.name}!`
      : `😻 Added ${product.name}!`,
  );
  return true;
}

/**
 * Helper to show a temporary message to the user
 */
function showBasketMessage(text, type = "success") {
  // Check for existing toast container or create one
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

// Update the badge number in the header
function updateBasketBadge() {
  const basket = getBasket();
  const badge = document.getElementById("basket-badge");
  if (!badge) return;

  const basketItems = Object.values(basket);

  // Sum up the quantities
  let totalCount = 0;
  for (const item of basketItems) {
    // We check for .quantity because your data looks like: {"quantity": 2, "name": "..."}
    if (item && typeof item.quantity === "number") {
      totalCount += item.quantity;
    }
  }

  if (totalCount > 0) {
    badge.textContent = totalCount;
    badge.style.display = "flex";

    // Trigger the pop animation by resetting the class
    badge.classList.remove("badge-pop");
    void badge.offsetWidth; // This "magic" line forces the browser to notice the change
    badge.classList.add("badge-pop");
  } else {
    badge.style.display = "none";
  }
}

// Run on every page load
document.addEventListener("DOMContentLoaded", updateBasketBadge);