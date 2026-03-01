/**
 * Global Basket Management
 */
const BASKET_KEY = 'yarn_and_moggy_basket';

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
  return
}

// Add item to basket
function addToBasket(slug, quantity = 1) {
    const basket = getBasket();
    
    if (basket[slug]) {
        basket[slug].quantity += quantity;
    } else {
        basket[slug] = { quantity: quantity };
    }
    
    saveBasket(basket);
    triggerBasketAnimation();
}

// Update the badge number in the header
function updateBasketBadge() {
    const basket = getBasket();
    const badge = document.getElementById('basket-badge');
    if (!badge) return;

    const totalItems = Object.values(basket).reduce((sum, item) => sum + item.quantity, 0);

    if (totalItems > 0) {
        badge.textContent = totalItems;
        badge.style.display = 'flex';
        // Add a little pop animation
        badge.classList.remove('badge-pop');
        void badge.offsetWidth; // trigger reflow
        badge.classList.add('badge-pop');
    } else {
        badge.style.display = 'none';
    }
}

// Run on every page load
document.addEventListener('DOMContentLoaded', updateBasketBadge);