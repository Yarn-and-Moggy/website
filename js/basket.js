/**
 * Global Basket Management
 */
const BASKET_KEY = "yarn_and_moggy_basket";

// Initialise/Get basket from localStorage
function getBasket() {
  const saved = localStorage.getItem(BASKET_KEY);
  return saved ? JSON.parse(saved) : {};
}

// Save basket to localStorage and update UI
function saveBasket(basket) {
  localStorage.setItem(BASKET_KEY, JSON.stringify(basket));
  updateBasketBadge();
}

function triggerBasketAnimation() {
  // Cool animation at some point!!
  return;
}

// Add item to basket
function addToBasket(product, quantity = 1, variant = "") {
  const basket = getBasket();
  const key = (variant === "") ? product.slug : `${product.slug}::${variant}`;

  if (basket[key]) {
    basket[key].quantity += quantity;
  } else {
    basket[key] = { quantity: quantity };
  }

  saveBasket(basket);
  triggerBasketAnimation();
}

// Update the badge number in the header
function updateBasketBadge() {
  const basket = getBasket();
  const badge = document.getElementById("basket-badge");
  if (!badge) return;

  const totalItems = Object.values(basket).reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  if (totalItems > 0) {
    badge.textContent = totalItems;
    badge.style.display = "flex";
    // Add a little pop animation
    badge.classList.remove("badge-pop");
    void badge.offsetWidth; // trigger reflow
    badge.classList.add("badge-pop");
  } else {
    badge.style.display = "none";
  }
}

// Run on every page load
document.addEventListener("DOMContentLoaded", updateBasketBadge);