const API_URL = "https://tq2jf6n0wo.execute-api.localhost.localstack.cloud:4566/prod/";
const BUCKET_OVERRIDE = "http://localhost:4566";

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
 * Checks if a string is a valid CSS color
 */
function isColor(str) {
  const s = new Option().style;
  s.color = str;
  return s.color !== "";
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

function renderProduct(product) {
  // Basic Info
  document.getElementById("breadcrumb-name").textContent = product.name;
  document.getElementById("product-name").textContent = product.name;
  document.getElementById("product-price").textContent =
    `£${(product.price_pence / 100).toFixed(2)}`;
  document.getElementById("product-description").innerHTML =
    product.description;

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

    product.variants.forEach((v) => {
      const btn = document.createElement("button");
      btn.className = "variant-opt";
      btn.disabled = v.quantity <= 0;

      let innerHTML = `<span>${v.name}</span>`;
      if (isColor(v.name.toLowerCase())) {
        innerHTML =
          `<span class="color-dot" style="background-color: ${v.name.toLowerCase()}"></span>` +
          innerHTML;
      }

      btn.innerHTML = innerHTML;
      btn.onclick = () => {
        Array.from(picker.children).forEach((b) =>
          b.classList.remove("selected"),
        );
        btn.classList.add("selected");
        updateStockDisplay(v.quantity);
      };
      picker.appendChild(btn);
    });
  } else {
    updateStockDisplay(product.quantity);
  }

  // Show Content
  document.getElementById("product-loading").style.display = "none";
  document.getElementById("product-content").style.display = "grid";
}

function updateStockDisplay(qty) {
  const status = document.getElementById("stock-status");
  const btn = document.getElementById("add-to-cart-btn");

  if (qty > 0) {
    status.textContent = qty < 5 ? `Low Stock: Only ${qty} left!` : "In Stock";
    status.className = "stock-status-text in-stock";
    btn.disabled = false;
  } else {
    status.textContent = "Currently Sold Out";
    status.className = "stock-status-text out-of-stock";
    btn.disabled = true;
  }
}