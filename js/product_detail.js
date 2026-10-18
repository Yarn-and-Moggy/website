/**
 * product_detail.jinja.js
 * Single product page logic.
 * Depends on: basket.jinja.js (must be loaded first)
 */

const API_URL = "https://api.yarnandmoggy.co.uk";

// Map colour names to hexcodes
const COLOURMAP = {
  pistachio: "#2dbb90",
  strawberry: "#fc95b0",
};

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
    const product = await response.json();
    renderProduct(product);
    injectProductSchema(product);
  } catch (err) {
    document.getElementById("product-loading").innerHTML = `
      <p class="headline">Product Not Found</p>
      <a href="/shop.html" class="btn-shop">Back to Shop</a>
    `;
  }
}

function injectProductSchema(product) {
  // Add schema.org tags to head
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.slug,
    description: product.description,
    image: product.image_urls,
    url: `https://yarnandmoggy.co.uk/product.html?product-id=${product.slug}`,
    brand: {
      "@type": "Brand",
      name: "Yarn & Moggy",
    },
    offers: {
      "@type": "Offer",
      price: (product.price_pence / 100).toFixed(2),
      priceCurrency: "GBP",
      availability: product.in_stock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `https://yarnandmoggy.co.uk/product.html?product-id=${product.slug}`,
    },
  };

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}

function renderProduct(product) {
  document.getElementById("product-content").dataset.slug = product.slug;
  document.getElementById("breadcrumb-name").textContent = product.name;
  document.getElementById("product-name").textContent = product.name;
  document.getElementById("product-price").textContent =
    "£" + (product.price_pence / 100).toFixed(2);

  // Description - use extended_description if available, fall back to legacy description
  const extDesc = product.extended_description;
  const hasExtended =
    extDesc &&
    (extDesc.simple_description || extDesc.tagline || extDesc.product_info);

  if (hasExtended) {
    let descHtml = "";
    if (extDesc.tagline) {
      descHtml += `<p class="product-tagline">${extDesc.tagline}</p>`;
    }
    if (extDesc.simple_description) {
      descHtml += `<p class="product-simple-description">${extDesc.simple_description}</p>`;
    }
    if (extDesc.product_info) {
      const info = extDesc.product_info;
      descHtml += `<dl class="product-info-list">`;
      if (info.dimensions) {
        descHtml += `<dt>Dimensions</dt><dd>${info.dimensions}</dd>`;
      }
      if (info.additional_features) {
        descHtml += `<dt>Features</dt><dd>${info.additional_features}</dd>`;
      }
      descHtml += `</dl>`;
    }
    document.getElementById("product-description").innerHTML = descHtml;
  } else {
    document.getElementById("product-description").innerHTML =
      product.description;
  }

  // Images
  initGallery(product.image_urls.map(transformImageUrl), product.name);

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
      btn.innerHTML = `<span class="colour-dot" style="background-color: ${COLOURMAP[colour] || colour};"></span><span>${v.name}</span>`;

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

function initGallery(images, altText) {
  const track = document.getElementById("gallery-track");
  const thumbStrip = document.getElementById("thumbnail-strip");
  const dots = document.getElementById("gallery-dots");
  const counter = document.getElementById("gallery-counter");
  const prevBtn = document.getElementById("gallery-prev");
  const nextBtn = document.getElementById("gallery-next");
  let current = 0;

  setupLightbox();

  images.forEach((url, i) => {
    const slide = document.createElement("img");
    slide.className = "gallery-slide";
    slide.src = url;
    slide.alt = `${altText} – image ${i + 1}`;
    if (i > 0) slide.loading = "lazy";
    slide.onclick = () =>
      openLightboxSet(images, i, { caption: altText, onChange: goTo });
    track.appendChild(slide);

    const thumb = document.createElement("button");
    thumb.className = "thumb";
    thumb.setAttribute("aria-label", `Show image ${i + 1}`);
    thumb.innerHTML = `<img src="${url}" alt="" loading="lazy">`;
    thumb.onclick = () => goTo(i);
    thumbStrip.appendChild(thumb);

    const dot = document.createElement("button");
    dot.className = "gallery-dot";
    dot.setAttribute("aria-label", `Show image ${i + 1}`);
    dot.onclick = () => goTo(i);
    dots.appendChild(dot);
  });

  if (images.length < 2) {
    [prevBtn, nextBtn, counter, dots, thumbStrip].forEach(
      (el) => (el.style.display = "none"),
    );
    return;
  }

  function goTo(i) {
    i = Math.max(0, Math.min(images.length - 1, i));
    track.scrollTo({ left: i * track.clientWidth });
    updateUI(i);
  }

  function updateUI(i) {
    if (i === current && counter.textContent) return;
    current = i;
    Array.from(thumbStrip.children).forEach((t, j) =>
      t.classList.toggle("active", j === i),
    );
    Array.from(dots.children).forEach((d, j) =>
      d.classList.toggle("active", j === i),
    );
    counter.textContent = `${i + 1} / ${images.length}`;
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === images.length - 1;
    const activeThumb = thumbStrip.children[i];
    thumbStrip.scrollTo({
      left:
        activeThumb.offsetLeft -
        thumbStrip.offsetLeft -
        (thumbStrip.clientWidth - activeThumb.offsetWidth) / 2,
    });
  }

  prevBtn.onclick = () => goTo(current - 1);
  nextBtn.onclick = () => goTo(current + 1);

  // Swiping (native scroll-snap) drives the active index
  let ticking = false;
  track.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateUI(Math.round(track.scrollLeft / track.clientWidth));
      ticking = false;
    });
  });

  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") goTo(current - 1);
    else if (e.key === "ArrowRight") goTo(current + 1);
    else return;
    e.preventDefault();
  });

  updateUI(0);
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