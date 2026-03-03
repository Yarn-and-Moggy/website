const API_URL = "https://tq2jf6n0wo.execute-api.localhost.localstack.cloud:4566/prod/";

let selectedVariantName = null;

/**
 * URL Transformer (Same as in shop for localhost)
 */
function transformImageUrl(originalUrl) {
  if (!BUCKET_OVERRIDE) return originalUrl;
  try {
    const urlObj = new URL(originalUrl);
    const bucketName = urlObj.hostname.split(".")[0];
    return `${BUCKET_OVERRIDE.replace(/\/$/, "")}/${bucketName}${urlObj.pathname}`;
  } catch (e) {
    return originalUrl;
  }
}

/**
 * Checks if a string is a valid CSS colour
 */
function iscolour(str) {
  const s = new Option().style;
  s.color = str;
  return s.color !== "";
}

/**
 * Helper to get current basket quantity for a specific product/variant
 */
function getBasketQty(productSlug, variantName = null) {
  // Use the pre-existing getBasket if available, otherwise fallback to global basket variable
  const currentBasket =
    typeof getBasket === "function"
      ? getBasket()
      : typeof basket !== "undefined"
        ? basket
        : {};
  const itemKey = variantName ? `${productSlug}:${variantName}` : productSlug;
  return currentBasket[itemKey]?.quantity ?? 0;
}

async function initProductPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get("product-id");

  if (!productId) {
    window.location.href = "/shop.html";
    return;
  }

  try {
    const response = await fetch(`${API_URL}/products/${productId}`);
    if (!response.ok) throw new Error("Product not found");
    const product = await response.json();

    renderProduct(product);
  } catch (err) {
    document.getElementById("product-loading").innerHTML = `
            <p class="headline">Product Not Found</p>
            <a href="/shop.html" class="btn-primary">Back to Shop</a>
        `;
  }
}

async function handleAdd(product) {
  if (typeof addToBasket !== "function") {
    console.error("Basket logic not loaded yet.");
    return;
  }

  // ASSERTION: If variants exist, one must be chosen
  if (product.variants && product.variants.length > 0 && !selectedVariantName) {
    const addBtn = document.getElementById("add-to-cart-btn");
    addBtn.classList.add("shudder");
    addBtn.classList.add("needs-selection");
    setTimeout(() => addBtn.classList.remove("shudder"), 500);

    const firstVariant = document.getElementsByClassName("variant-opt")[0];
    firstVariant.classList.add("picker-highlight");
    setTimeout(() => firstVariant.classList.remove("picker-highlight"), 1000);

    showBasketMessage("Please pick a colour first! 🐾");
    return;
  }

  // If we pass validation, add to the global basket
  addToBasket(product, 1, selectedVariantName);

  // Update display immediately after adding
  if (product.variants && product.variants.length > 0) {
    const v = product.variants.find((v) => v.name === selectedVariantName);
    updateStockDisplay(v.quantity, product.slug, v.name);
  } else {
    updateStockDisplay(product.quantity, product.slug);
  }
}

function renderProduct(product) {
  // Set slug for animation
  const content = document.getElementById("product-content");
  content.dataset.slug = product.slug;

  // Basic Info
  document.getElementById("breadcrumb-name").textContent = product.name;
  document.getElementById("product-name").textContent = product.name;
  document.getElementById("product-price").textContent =
    `£${(product.price_pence / 100).toFixed(2)}`;
  document.getElementById("product-description").innerHTML =
    product.description;

  // Add to basket button
  const addButton = document.getElementById("add-to-cart-btn");

  // Images
  const mainImg = document.getElementById("main-product-image");
  const thumbStrip = document.getElementById("thumbnail-strip");
  const transformedImages = product.image_urls.map(transformImageUrl);

  mainImg.src = transformedImages[0];
  transformedImages.forEach((url, i) => {
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
    const section = document.getElementById("variant-section");
    const picker = document.getElementById("variant-picker");
    section.style.display = "block";

    let firstVariant = true;

    product.variants.forEach((v) => {
      const btn = document.createElement("button");
      btn.className = "variant-opt";

      // Initial disabled state based on stock minus basket
      const inBasket = getBasketQty(product.slug, v.name);
      btn.disabled = v.quantity - inBasket <= 0;
      btn.dataset.variant = v.name;

      let innerHTML = `<span>${v.name}</span>`;
      const colour = v.name.split(" ")[0].toLowerCase();
      if (iscolour(colour)) {
        innerHTML =
          `<span class="colour-dot" style="background-color: ${v.name.toLowerCase()}"></span>` +
          innerHTML;
      }

      btn.innerHTML = innerHTML;
      if (firstVariant) {
        btn.classList.add("selected");
        selectedVariantName = v.name;
        firstVariant = false;
        updateStockDisplay(v.quantity, product.slug, v.name);
      }
      btn.onclick = () => {
        Array.from(picker.children).forEach((b) =>
          b.classList.remove("selected"),
        );
        btn.classList.add("selected");
        selectedVariantName = btn.dataset.variant;
        const addBtn = document.getElementById("add-to-cart-btn");
        addBtn.classList.remove("needs-selection");
        updateStockDisplay(v.quantity, product.slug, v.name);
      };
      picker.appendChild(btn);
    });
  } else {
    updateStockDisplay(product.quantity, product.slug);
  }

  // Show Content
  document.getElementById("product-loading").style.display = "none";
  document.getElementById("product-content").style.display = "grid";

  // Event listener for add to cart button
  addButton.addEventListener("click", (event) => {
    event.preventDefault();
    handleAdd(product);
  });
}

/**
 * Updates the stock status text and Add button state
 * subtracting what's already in the basket to show "Available to add"
 */
function updateStockDisplay(actualQty, productSlug, variantName = null) {
  const status = document.getElementById("stock-status");
  const btn = document.getElementById("add-to-cart-btn");

  const inBasket = getBasketQty(productSlug, variantName);
  const availableQty = Math.max(0, actualQty - inBasket);

  if (availableQty > 0) {
    status.textContent =
      availableQty < 5 ? `Low Stock: Only ${availableQty} left!` : "In Stock";
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