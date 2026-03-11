/**
 * product_detail.jinja.js
 * Single product page logic.
 * Depends on: basket.jinja.js (must be loaded first)
 */

const API_URL = "https://api.yarnandmoggy.co.uk";

let selectedVariantName = null;

function getBasketQty(productSlug, variantName = null) {
  const basket = typeof getBasket === "function" ? getBasket() : {};
  const itemKey = variantName ? `${productSlug}:${variantName}` : productSlug;
  return basket[itemKey]?.quantity ?? 0;
}

function isColour(str) {
  const s = new Option().style;
  s.color = str;
  return s.color !== "";
}

async function initProductPage() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get("product-id");

  if (!productId) {
    window.location.href = "/shop.html";
    return;
  }

  try {
    const response = await fetch(`${API_URL}/products/${productId}`);
    if (!response.ok) throw new Error("Product not found");
    renderProduct(await response.json());
  } catch (err) {
    document.getElementById("product-loading").innerHTML = `
      <p class="headline">Product Not Found</p>
      <a href="/shop.html" class="btn-primary">Back to Shop</a>
    `;
  }
}

function renderProduct(product) {
  document.getElementById("product-content").dataset.slug = product.slug;
  document.getElementById("breadcrumb-name").textContent = product.name;
  document.getElementById("product-name").textContent = product.name;
  document.getElementById("product-price").textContent =
    "£" + (product.price_pence / 100).toFixed(2);
  document.getElementById("product-description").innerHTML =
    product.description;

  // Images
  const mainImg = document.getElementById("main-product-image");
  const thumbStrip = document.getElementById("thumbnail-strip");
  const images = product.image_urls.map(transformImageUrl);

  mainImg.src = images[0];
  images.forEach((url, i) => {
    const thumb = document.createElement("img");
    thumb.src = url;
    thumb.className = i === 0 ? "active" : "";
    thumb.onclick = () => {
      mainImg.src = url;
      Array.from(thumbStrip.children).forEach((t) =>
        t.classList.remove("active"),
      );
      thumb.classList.add("active");
    };
    thumbStrip.appendChild(thumb);
  });

  // Variants
  if (product.variants && product.variants.length > 0) {
    document.getElementById("variant-section").style.display = "block";
    const picker = document.getElementById("variant-picker");
    let firstSelected = false;

    product.variants.forEach((v) => {
      const btn = document.createElement("button");
      btn.className = "variant-opt";
      btn.dataset.variant = v.name;

      const available = v.quantity - getBasketQty(product.slug, v.name);
      btn.disabled = available <= 0;

      const colour = v.name.split(" ")[0].toLowerCase();
      btn.innerHTML = isColour(colour)
        ? `<span class="colour-dot" style="background-color:${v.name.toLowerCase()}"></span><span>${v.name}</span>`
        : `<span>${v.name}</span>`;

      if (!firstSelected && available > 0) {
        btn.classList.add("selected");
        selectedVariantName = v.name;
        firstSelected = true;
        updateStockDisplay(v.quantity, product.slug, v.name);
      }

      btn.onclick = () => {
        Array.from(picker.children).forEach((b) =>
          b.classList.remove("selected"),
        );
        btn.classList.add("selected");
        selectedVariantName = btn.dataset.variant;
        document
          .getElementById("add-to-cart-btn")
          .classList.remove("needs-selection");
        updateStockDisplay(v.quantity, product.slug, v.name);
      };

      picker.appendChild(btn);
    });

    // Fallback: select first even if sold out
    if (!firstSelected) {
      const firstBtn = picker.querySelector(".variant-opt");
      if (firstBtn) {
        firstBtn.classList.add("selected");
        selectedVariantName = firstBtn.dataset.variant;
        updateStockDisplay(
          product.variants[0].quantity,
          product.slug,
          product.variants[0].name,
        );
      }
    }
  } else {
    updateStockDisplay(product.quantity, product.slug);
  }

  document.getElementById("add-to-cart-btn").addEventListener("click", (e) => {
    e.preventDefault();
    handleAdd(product);
  });

  document.getElementById("product-loading").style.display = "none";
  document.getElementById("product-content").style.display = "grid";

  // Listen for product removals
  document.addEventListener("basketItemRemoved", ({ detail }) => {
    // find the current variant's stock and refresh display
    const v = product.variants?.find((v) => v.name === detail.variantName);
    updateStockDisplay(
      v ? v.quantity : product.quantity,
      product.slug,
      detail.variantName ?? null,
    );
  });
}

function handleAdd(product) {
  if (product.variants?.length > 0 && !selectedVariantName) {
    const addBtn = document.getElementById("add-to-cart-btn");
    addBtn.classList.add("shudder", "needs-selection");
    setTimeout(() => addBtn.classList.remove("shudder"), 500);

    const firstVariant = document.querySelector(".variant-opt");
    if (firstVariant) {
      firstVariant.classList.add("picker-highlight");
      setTimeout(() => firstVariant.classList.remove("picker-highlight"), 1000);
    }
    showBasketMessage("Please pick a colour first! 🐾");
    return;
  }

  // Hand off to basket.jinja.js; refresh stock display via the onSuccess hook
  addToBasket(product, 1, selectedVariantName, (p, variantName) => {
    if (p.variants?.length > 0) {
      const v = p.variants.find((v) => v.name === variantName);
      if (v) updateStockDisplay(v.quantity, p.slug, v.name);
    } else {
      updateStockDisplay(p.quantity, p.slug);
    }
  });
}

function updateStockDisplay(actualQty, productSlug, variantName = null) {
  const status = document.getElementById("stock-status");
  const btn = document.getElementById("add-to-cart-btn");
  const inBasket = getBasketQty(productSlug, variantName);
  const available = Math.max(0, actualQty - inBasket);

  if (available > 0) {
    status.textContent =
      available < 5 ? `Low Stock: Only ${available} left!` : "In Stock";
    status.className = "stock-status-text in-stock";
    btn.disabled = false;
    btn.textContent = "Add to Basket";
  } else {
    status.textContent =
      actualQty > 0
        ? "All available stock is in your basket!"
        : "Currently Sold Out";
    status.className = "stock-status-text out-of-stock";
    btn.disabled = true;
    btn.textContent = actualQty > 0 ? "In Basket" : "Sold Out";
  }
}