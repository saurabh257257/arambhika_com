const categoryFilters = document.querySelector("#categoryFilters");
const catalogGrid = document.querySelector("#catalogGrid");
const globalSearch = document.querySelector("#globalSearch");
const searchSuggestions = document.querySelector("#searchSuggestions");
const orderList = document.querySelector("#orderList");
const mobileOrderList = document.querySelector("#mobileOrderList");
const mobileFab = document.querySelector("#mobileFab");
const mobileSheet = document.querySelector("#mobileSheet");
const mobileSheetClose = document.querySelector("#mobileSheetClose");

const ORDER_KEY = "orderCart";
const PRODUCT_QUERY_KEY = "product";
const WHATSAPP_NUMBER = "919315545821";

const normalizeProductCode = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const toDomToken = (value) =>
  normalizeProductCode(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildProductPageLink = (productCode) => {
  const code = String(productCode || "").trim();
  if (!code) return "#catalog";
  return `?${PRODUCT_QUERY_KEY}=${encodeURIComponent(code)}#catalog`;
};

const getRequestedProductCode = () => {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = String(params.get(PRODUCT_QUERY_KEY) || "").trim();
  if (fromQuery) return fromQuery;
  const rawHash = (window.location.hash || "").replace(/^#/, "");
  if (rawHash.startsWith("product-")) {
    return decodeURIComponent(rawHash.slice("product-".length));
  }
  return "";
};

const getOrder = () => {
  const raw = sessionStorage.getItem(ORDER_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const setOrder = (order) => {
  sessionStorage.setItem(ORDER_KEY, JSON.stringify(order));
  // Lets test-account.js sync the cart to a logged-in customer's profile without this file
  // needing to know anything about login state.
  if (typeof window.onCartChanged === "function") window.onCartChanged(order);
  document.dispatchEvent(new CustomEvent("cart:changed"));
};

const normalizeCatalogData = (data) => {
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  return categories.map((cat) => {
    const fallbackName =
      cat.Category ||
      (Array.isArray(cat.products) && cat.products[0] && cat.products[0].Category) ||
      "Category";
    return {
      name: cat.name || fallbackName,
      Image: cat.Image || "",
      products: (cat.products || []).map((product) => {
        const availabilityRaw = String(product.Availability || "Now").trim().toLowerCase();
        const availability =
          availabilityRaw === "on request" ? "On Request"
          : availabilityRaw === "notify" ? "Notify"
          : "Now";
        return {
          Category: product.Category || fallbackName,
          ProductCode: product.ProductCode || "",
          Image_Link: Array.isArray(product.Image_Link)
            ? product.Image_Link
            : product.Image_Link
              ? [product.Image_Link]
              : [],
          Price: product.Price || "",
          Availability: availability,
          Unit: product.Unit || "KG",
          "Minimum Quantity": Number(product["Minimum Quantity"] || 1),
          Product_Dimensions: String(product.Product_Dimensions || "").trim(),
          SKU: product.SKU || "",
          ZohoVariantId: product.ZohoVariantId || "",
          Additional_Details: Array.isArray(product.Additional_Details)
            ? product.Additional_Details
            : product.Additional_Details
              ? String(product.Additional_Details)
                  .split(/\r?\n/)
                  .map((line) => line.trim())
                  .filter(Boolean)
              : []
        };
      })
    };
  });
};

let currentCategoryFilter = "all";
let currentSearchTerm = "";
let productIndex = [];
let cachedCatalog = [];
let cachedSiteConfig = {};
let pendingProductCode = getRequestedProductCode();
let highlightResetTimer = null;

const renderFilters = (categories) => {
  if (!categoryFilters) return;
  categoryFilters.innerHTML = "";
  categories.forEach((cat) => {
    // same rule the grid uses: placeholder products with a one-character code are not shown
    const products = (cat.products || []).filter((p) => p && p.ProductCode && p.ProductCode.trim().length > 1);
    if (!products.length) return;
    const withImage = products.find((p) => (Array.isArray(p.Image_Link) ? p.Image_Link[0] : p.Image_Link));
    const productSrc = withImage ? (Array.isArray(withImage.Image_Link) ? withImage.Image_Link[0] : withImage.Image_Link) : "";
    const imageSrc = cat.Image || productSrc; // the category's own picture first, then a product photo
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat-tile filter-btn";
    btn.dataset.filter = cat.name;
    btn.innerHTML = `
      <span class="cat-tile-img">${imageSrc ? `<img src="${imageSrc}" alt="" loading="lazy" />` : `<i>${cat.name.trim().charAt(0).toUpperCase()}</i>`}</span>
      <span class="cat-tile-text"><b>${cat.name}</b></span>`;
    categoryFilters.appendChild(btn);
  });
  // tapping the active tile again shows everything
  categoryFilters.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentCategoryFilter = currentCategoryFilter === btn.dataset.filter ? "all" : btn.dataset.filter;
      setFilterButtonState(currentCategoryFilter);
      filterCatalog();
      const grid = document.querySelector("#catalogGrid");
      if (grid) grid.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  setFilterButtonState(currentCategoryFilter);
};

// "Shop by cell type": 18650, 21700, 32650 ... found in the product names themselves
const renderCellPills = (categories) => {
  const holder = document.querySelector("#cellPills");
  if (!holder) return;
  const counts = new Map();
  categories.forEach((c) => (c.products || []).forEach((p) => {
    const m = String(p.ProductCode || "").match(/\((\d{4,5})\)/);
    if (m) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
    if (/zig\s*zag/i.test(p.ProductCode || "")) counts.set("ZigZag", (counts.get("ZigZag") || 0) + 1);
  }));
  holder.innerHTML = "";
  if (!counts.size) return;
  const label = document.createElement("span");
  label.className = "cell-pills-label";
  label.textContent = "Shop by cell:";
  holder.appendChild(label);
  [...counts.keys()].sort().forEach((key) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "cell-pill";
    pill.dataset.cell = key;
    pill.innerHTML = `${key} <small>${counts.get(key)}</small>`;
    pill.addEventListener("click", () => {
      const next = currentCellFilter === key ? "" : key;
      currentCellFilter = next;
      holder.querySelectorAll(".cell-pill").forEach((b) => b.classList.toggle("active", b.dataset.cell === next));
      filterCatalog();
    });
    holder.appendChild(pill);
  });
};

let currentCellFilter = "";

// Each category shows a single row of products; "Show all" opens the rest. A search or a chosen
// category/size always shows everything that matches.
const expandedCats = new Set();
function applyRowLimit() {
  if (!catalogGrid) return;
  const narrowing = currentCategoryFilter !== "all" || !!currentSearchTerm || !!currentCellFilter;
  catalogGrid.querySelectorAll(".cat-block").forEach((block) => {
    const grid = block.querySelector(".cat-grid");
    const cards = [...block.querySelectorAll(".prod-card")].filter((c) => c.style.display !== "none");
    cards.forEach((c) => c.classList.remove("row-extra"));
    let more = block.querySelector(".cat-more");
    const cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(" ").length);
    const open = narrowing || expandedCats.has(block.dataset.category);
    const extra = cards.length - cols;
    if (extra <= 0 || narrowing) { if (more) more.remove(); return; }
    if (!open) cards.slice(cols).forEach((c) => c.classList.add("row-extra"));
    if (!more) {
      more = document.createElement("button");
      more.type = "button";
      more.className = "cat-more";
      more.addEventListener("click", () => {
        const k = block.dataset.category;
        if (expandedCats.has(k)) expandedCats.delete(k); else expandedCats.add(k);
        applyRowLimit();
      });
      block.querySelector(".cat-block-head").appendChild(more);
    }
    more.textContent = open ? "Show less ▴" : `Show all ${cards.length} products ▾`;
  });
}
let rowLimitTimer;
window.addEventListener("resize", () => { clearTimeout(rowLimitTimer); rowLimitTimer = setTimeout(applyRowLimit, 150); });

const filterCatalog = () => {
  if (!catalogGrid) return;
  const cards = catalogGrid.querySelectorAll(".prod-card");
  cards.forEach((card) => {
    const matchesCategory =
      currentCategoryFilter === "all" || card.dataset.category === currentCategoryFilter;
    const haystack = `${card.dataset.search || ""}`.toLowerCase();
    const matchesSearch = !currentSearchTerm || haystack.includes(currentSearchTerm);
    const matchesCell = !currentCellFilter || haystack.includes(currentCellFilter.toLowerCase());
    card.style.display = matchesCategory && matchesSearch && matchesCell ? "" : "none";
  });
  // a category block with nothing left in it disappears too
  let shown = 0;
  catalogGrid.querySelectorAll(".cat-block").forEach((block) => {
    const any = [...block.querySelectorAll(".prod-card")].some((c) => c.style.display !== "none");
    block.style.display = any ? "" : "none";
    if (any) shown += 1;
  });
  applyRowLimit();
  let empty = catalogGrid.querySelector(".catalog-empty");
  if (!shown) {
    if (!empty) {
      empty = document.createElement("p");
      empty.className = "catalog-empty form-note";
      empty.textContent = "No products match. Try a different size or clear the filter.";
      catalogGrid.appendChild(empty);
    }
  } else if (empty) {
    empty.remove();
  }
};

const setFilterButtonState = (filterValue) => {
  if (!categoryFilters) return;
  categoryFilters.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === filterValue);
  });
};

const focusProductByCode = (productCode, { smooth = true, updateUrl = true } = {}) => {
  if (!catalogGrid || !productCode) return false;
  const normalizedCode = normalizeProductCode(productCode);
  if (!normalizedCode) return false;

  const card = catalogGrid.querySelector(
    `.prod-card[data-product-code-key="${normalizedCode}"]`
  );
  if (!card) return false;

  currentCategoryFilter = "all";
  currentSearchTerm = "";
  if (globalSearch) globalSearch.value = "";
  document.body.classList.remove("search-active");
  setFilterButtonState("all");
  filterCatalog();

  const catalog = document.querySelector("#catalog");
  if (catalog) {
    catalog.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  }
  card.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });

  card.classList.add("is-highlighted");
  if (highlightResetTimer) window.clearTimeout(highlightResetTimer);
  highlightResetTimer = window.setTimeout(() => {
    card.classList.remove("is-highlighted");
  }, 1800);

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set(PRODUCT_QUERY_KEY, card.dataset.productCode || productCode);
    url.hash = "catalog";
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return true;
};

const placeholderImage = (label) => {
  const safe = encodeURIComponent(label || "Product");
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><rect width='100%' height='100%' fill='%23f3e9da'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Space Grotesk, Arial' font-size='36' fill='%23908a80'>${safe}</text></svg>`;
};

const createCarousel = (images, label) => {
  const wrapper = document.createElement("div");
  wrapper.className = "carousel";

  const safeImages = images && images.length ? images : [placeholderImage(label)];
  safeImages.forEach((src, index) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = label;
    img.loading = "lazy";
    img.className = index === 0 ? "active" : "";
    img.dataset.index = String(index);
    img.onerror = () => {
      img.onerror = null;
      img.src = placeholderImage(label);
    };
    wrapper.appendChild(img);
  });

  if (safeImages.length > 1) {
    const controls = document.createElement("div");
    controls.className = "carousel-controls";

    const prev = document.createElement("button");
    prev.className = "carousel-btn prev";
    prev.type = "button";
    prev.setAttribute("aria-label", "Previous image");
    prev.textContent = "‹";

    const next = document.createElement("button");
    next.className = "carousel-btn next";
    next.type = "button";
    next.setAttribute("aria-label", "Next image");
    next.textContent = "›";

    const dots = document.createElement("div");
    dots.className = "carousel-dots";
    safeImages.forEach((_, idx) => {
      const dot = document.createElement("span");
      dot.className = idx === 0 ? "carousel-dot active" : "carousel-dot";
      dots.appendChild(dot);
    });

    const updateActive = (direction) => {
      const imgs = wrapper.querySelectorAll("img");
      const currentIndex = Array.from(imgs).findIndex((img) =>
        img.classList.contains("active")
      );
      const nextIndex =
        currentIndex === -1
          ? 0
          : (currentIndex + direction + imgs.length) % imgs.length;
      imgs.forEach((img, idx) => img.classList.toggle("active", idx === nextIndex));
      dots.querySelectorAll(".carousel-dot").forEach((dot, idx) => {
        dot.classList.toggle("active", idx === nextIndex);
      });
    };

    prev.addEventListener("click", (event) => {
      event.stopPropagation();
      updateActive(-1);
    });
    next.addEventListener("click", (event) => {
      event.stopPropagation();
      updateActive(1);
    });

    controls.appendChild(prev);
    controls.appendChild(dots);
    controls.appendChild(next);
    wrapper.appendChild(controls);
  }

  wrapper.addEventListener("click", (event) => {
    const img = event.target.closest("img");
    if (!img) return;
    const allImgs = Array.from(wrapper.querySelectorAll("img"));
    openLightbox(allImgs, Number(img.dataset.index) || 0);
  });

  return wrapper;
};

const openLightbox = (images, startIndex) => {
  if (!images.length) return;

  const existing = document.querySelector(".lightbox");
  if (existing) existing.remove();

  const lightbox = document.createElement("div");
  lightbox.className = "lightbox";
  lightbox.setAttribute("role", "dialog");
  lightbox.setAttribute("aria-modal", "true");
  lightbox.innerHTML = `
    <div class="lightbox-inner">
      <button class="lightbox-close" type="button" aria-label="Close">×</button>
      <button class="lightbox-nav prev" type="button" aria-label="Previous image">‹</button>
      <img class="lightbox-image" alt="" />
      <button class="lightbox-nav next" type="button" aria-label="Next image">›</button>
    </div>
  `;

  const body = document.body;
  body.appendChild(lightbox);
  body.classList.add("lightbox-open");

  const imgEl = lightbox.querySelector(".lightbox-image");
  let index = startIndex;

  const render = () => {
    const src = images[index]?.src || images[0].src;
    imgEl.src = src;
    imgEl.alt = images[index]?.alt || "Product image";
  };

  const close = () => {
    lightbox.remove();
    body.classList.remove("lightbox-open");
    document.removeEventListener("keydown", handleKey);
  };

  const handleKey = (event) => {
    if (event.key === "Escape") close();
    if (event.key === "ArrowLeft") {
      index = (index - 1 + images.length) % images.length;
      render();
    }
    if (event.key === "ArrowRight") {
      index = (index + 1) % images.length;
      render();
    }
  };

  lightbox.querySelector(".lightbox-close").addEventListener("click", close);
  lightbox.querySelector(".lightbox-nav.prev").addEventListener("click", () => {
    index = (index - 1 + images.length) % images.length;
    render();
  });
  lightbox.querySelector(".lightbox-nav.next").addEventListener("click", () => {
    index = (index + 1) % images.length;
    render();
  });
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) close();
  });
  document.addEventListener("keydown", handleKey);

  render();
};

const renderOrderList = () => {
  const targets = [orderList, mobileOrderList].filter(Boolean);
  const order = getOrder();
  const entries = Object.values(order);
  targets.forEach((list) => {
    list.innerHTML = "";
    if (entries.length === 0) {
      list.innerHTML = "<p class='form-note'>Your cart is empty.</p>";
      return;
    }
    entries.forEach((item) => {
      const row = document.createElement("div");
      row.className = "panel-item";
      row.innerHTML = `
        <div class="panel-item-header">
          <div><strong>${item.name}</strong></div>
          <button class="remove-item" type="button" aria-label="Remove item">×</button>
        </div>
        <div>Qty: ${item.qty} ${item.unit}</div>
      `;
      row.querySelector(".remove-item").addEventListener("click", () => {
        removeFromOrder(item.id);
      });
      list.appendChild(row);
    });
  });
  updateActionCounts();
};

const addToOrder = (product, qty, { silent = false } = {}) => {
  const order = getOrder();
  const name = product.ProductCode || "";
  const unit = product.Unit || "KG";
  order[name] = { id: name, name, qty, unit };
  setOrder(order);
  renderOrderList();
  if (!silent) document.dispatchEvent(new CustomEvent("cart:added", { detail: { name } }));
  if (mobileFab) {
    mobileFab.classList.remove("is-shake");
    // trigger reflow to restart animation
    void mobileFab.offsetWidth;
    mobileFab.classList.add("is-shake");
  }
};

const removeFromOrder = (productId) => {
  const order = getOrder();
  if (!order[productId]) return;
  delete order[productId];
  setOrder(order);
  renderOrderList();
};

const clearOrder = () => {
  sessionStorage.removeItem(ORDER_KEY);
  renderOrderList();
  if (typeof window.onCartChanged === "function") window.onCartChanged({});
  document.dispatchEvent(new CustomEvent("cart:changed"));
};

const updateActionCounts = () => {
  const items = Object.values(getOrder());
  const orderCount = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  if (mobileFab) {
    mobileFab.textContent = `View Quote (${orderCount})`;
    mobileFab.classList.toggle("has-items", orderCount > 0);
  }
  const tabBadge = document.querySelector("#mobileTabBadge");
  if (tabBadge) {
    tabBadge.textContent = String(orderCount);
    tabBadge.hidden = orderCount === 0;
  }
};

const applySiteConfig = (config) => {
  if (!config) return;
  const brand = config.brand || {};
  const logo = document.getElementById("brandLogo");
  const mark = document.getElementById("brandMark");
  const brandName = document.getElementById("brandName");
  const brandTag = document.getElementById("brandTag");
  if (logo) {
    const logoSrc = brand.logo || "assets/logo.png";
    logo.src = logoSrc;
    if (mark) mark.classList.add("is-hidden");
    logo.onerror = () => {
      logo.onerror = null;
      logo.src = "assets/logo.png";
      if (mark) mark.classList.add("is-hidden");
    };
  }
  if (brandName && brand.name) {
    brandName.textContent = brand.name;
  }
  if (brandTag && brand.tagline) {
    brandTag.textContent = brand.tagline;
  }

  const navConfig = config.nav || {};
  const navHome = document.getElementById("navHome");
  const navCatalog = document.getElementById("navCatalog");
  const navCapabilities = document.getElementById("navCapabilities");
  const navAbout = document.getElementById("navAbout");
  if (navHome && navConfig.home) navHome.textContent = navConfig.home;
  if (navCatalog && navConfig.catalog) (navCatalog.querySelector(".nav-label") || navCatalog).textContent = navConfig.catalog;
  if (navCapabilities && navConfig.capabilities) navCapabilities.textContent = navConfig.capabilities;
  if (navAbout && navConfig.about) navAbout.textContent = navConfig.about;

  const topBar = config.topBar || {};
  if (Array.isArray(topBar.phones)) {
    const phoneEls = [
      { phone: document.getElementById("topPhone1"), wa: document.getElementById("topWa1") },
      { phone: document.getElementById("topPhone2"), wa: document.getElementById("topWa2") }
    ];
    phoneEls.forEach((els, idx) => {
      const data = topBar.phones[idx];
      if (!data) return;
      if (els.phone) {
        const svg = els.phone.querySelector("svg");
        els.phone.textContent = data.label || data.tel || "";
        if (svg) els.phone.appendChild(svg);
        if (data.tel) els.phone.href = `tel:${data.tel}`;
      }
      if (els.wa && data.whatsapp) {
        const svg = els.wa.querySelector("svg");
        els.wa.textContent = "";
        if (svg) els.wa.appendChild(svg);
        els.wa.href = `https://wa.me/${data.whatsapp}`;
      }
    });
  }

  const solutions = config.solutions || {};
  const solutionsEyebrow = document.getElementById("solutionsEyebrow");
  const solutionsTitle = document.getElementById("solutionsTitle");
  const solutionsSubtitle = document.getElementById("solutionsSubtitle");
  const solutionsCarousel = document.getElementById("solutionsCarousel");
  const solutionsNext = document.getElementById("solutionsNext");

  if (solutionsEyebrow && solutions.eyebrow) {
    solutionsEyebrow.textContent = solutions.eyebrow;
  }
  if (solutionsTitle && solutions.title) {
    solutionsTitle.textContent = solutions.title;
  }
  if (solutionsSubtitle && solutions.subtitle) {
    solutionsSubtitle.textContent = solutions.subtitle;
  }

  if (solutionsCarousel && Array.isArray(solutions.items)) {
    const items = solutions.items;
    const controls = solutionsCarousel.querySelector(".solutions-controls");
    solutionsCarousel.innerHTML = "";
    items.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = `solution-card${index === 0 ? " is-active" : ""}`;
      card.dataset.solution = item.id || `solution_${index}`;
      card.innerHTML = `
        <div class="solution-media">
          <img src="${item.image || ""}" alt="${item.title || "Solution"}" />
        </div>
        <div class="solution-copy">
          <h3>${item.title || ""}</h3>
          <p class="solution-tag">${item.tag || ""}</p>
          <p class="solution-line">${item.line || ""}</p>
        </div>
      `;
      const img = card.querySelector("img");
      if (img) {
        img.onerror = () => {
          img.onerror = null;
          img.src = placeholderImage(item.title || "Solution");
        };
      }
      solutionsCarousel.appendChild(card);
    });
    if (controls) solutionsCarousel.appendChild(controls);
  }

  if (solutionsNext) {
    solutionsNext.textContent = solutions.nextLabel || solutionsNext.textContent || "Next";
    const advanceSolutions = () => {
      const cards = document.querySelectorAll(".solution-card");
      if (!cards.length) return;
      const currentIndex = Array.from(cards).findIndex((card) =>
        card.classList.contains("is-active")
      );
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % cards.length;
      cards.forEach((card, index) => {
        card.classList.toggle("is-active", index === nextIndex);
      });
    };
    solutionsNext.addEventListener("click", advanceSolutions);
    setInterval(advanceSolutions, 2000);
  }

  const about = config.about || {};
  const aboutEyebrow = document.getElementById("aboutEyebrow");
  const aboutTitle = document.getElementById("aboutTitle");
  const aboutLead = document.getElementById("aboutLead");
  const aboutWhyTitle = document.getElementById("aboutWhyTitle");
  const aboutWhyList = document.getElementById("aboutWhyList");

  if (aboutEyebrow && about.eyebrow) aboutEyebrow.textContent = about.eyebrow;
  if (aboutTitle && about.title) aboutTitle.textContent = about.title;
  if (aboutLead && about.lead) aboutLead.textContent = about.lead;
  if (aboutWhyTitle && about.whyTitle) aboutWhyTitle.textContent = about.whyTitle;

  if (aboutWhyList && Array.isArray(about.whyItems)) {
    aboutWhyList.innerHTML = "";
    const mainItems = [];
    const subItems = [];
    about.whyItems.forEach((item) => {
      if (typeof item !== "string") return;
      if (item.trim().toLowerCase().startsWith("sub:")) {
        subItems.push(item.replace(/^sub:\s*/i, "").trim());
      } else {
        mainItems.push(item);
      }
    });
    mainItems.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      aboutWhyList.appendChild(li);
    });
    if (subItems.length) {
      const lastItem = aboutWhyList.lastElementChild;
      const subList = document.createElement("ul");
      subList.className = "about-sublist";
      subItems.forEach((sub) => {
        const li = document.createElement("li");
        li.textContent = sub;
        subList.appendChild(li);
      });
      if (lastItem) {
        lastItem.appendChild(subList);
      } else {
        aboutWhyList.appendChild(subList);
      }
    }
  }

  const capabilities = config.capabilities || {};
  const capEyebrow = document.getElementById("capEyebrow");
  const capTitle = document.getElementById("capTitle");
  const capLead = document.getElementById("capLead");
  const capList = document.getElementById("capList");
  if (capEyebrow && capabilities.eyebrow) capEyebrow.textContent = capabilities.eyebrow;
  if (capTitle && capabilities.title) capTitle.textContent = capabilities.title;
  if (capLead && capabilities.lead) capLead.textContent = capabilities.lead;

  const capItems = Array.isArray(capabilities.items) && capabilities.items.length
    ? capabilities.items
    : (Array.isArray(solutions.items) ? solutions.items : []);
  if (capList) {
    capList.innerHTML = "";
    if (!capItems.length) {
      capList.innerHTML = "<li class='cap-item'>No capability items configured.</li>";
      return;
    }
    capItems.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "cap-item";
      li.innerHTML = `
        <div class="cap-item-media">
          <img src="${item.image || ""}" alt="${item.title || "Capability"}" />
        </div>
        <div class="cap-item-content">
          <h3>${item.title || ""}</h3>
          <p class="cap-item-tag">${item.tag || ""}</p>
          <p class="cap-item-line">${item.line || ""}</p>
        </div>
      `;
      const img = li.querySelector("img");
      if (img) {
        img.onerror = () => {
          img.onerror = null;
          img.src = placeholderImage(item.title || `Capability ${index + 1}`);
        };
      }
      capList.appendChild(li);
    });
  }
};

const loadSiteConfig = async () => {
  try {
    const response = await fetch("site.json", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    cachedSiteConfig = data || {};
    applySiteConfig(data);
  } catch {
    // ignore config errors
  }
};

const createCard = (product, categoryName) => {
  const card = document.createElement("article");
  card.className = "prod-card";
  card.dataset.category = categoryName;

  const name = product.ProductCode || "";
  const sku = product.SKU || "";
  const dataId = toDomToken(name) || `product_${Math.random().toString(36).slice(2, 9)}`;
  card.id = `product-${dataId}`;
  card.dataset.productCode = name;
  card.dataset.productCodeKey = normalizeProductCode(name);
  const href = `/product/${toDomToken(normalizeProductCode(name))}`;
  card.dataset.productLink = href;

  const unit = product.Unit || "KG";
  const minQty = Number(product["Minimum Quantity"]) || 1;
  const availability = String(product.Availability || "Now").toLowerCase();
  const isNotify = availability === "notify";
  const isRequest = availability === "on request";
  const priceNumber = Number(String(product.Price || "").replace(/[^\d.]/g, "")) || 0;
  const images = Array.isArray(product.Image_Link) ? product.Image_Link : product.Image_Link ? [product.Image_Link] : [];
  const detailsList = Array.isArray(product.Additional_Details) ? product.Additional_Details : product.Additional_Details ? [product.Additional_Details] : [];

  card.innerHTML = `
    <a class="prod-link" href="${href}" aria-label="${name}">
      <span class="prod-img">${images[0] ? `<img src="${images[0]}" alt="${name}" loading="lazy" decoding="async" />` : ""}</span>
      ${isNotify ? '<span class="prod-flag prod-flag-req">Available on request</span>' : isRequest ? '<span class="prod-flag prod-flag-req">Available on request</span>' : ""}
      <span class="prod-name">${name}</span>
    </a>
    <div class="prod-price">${priceNumber ? `₹${priceNumber.toLocaleString("en-IN")}` : "Price on request"} <small>/ ${unit} · MOQ ${minQty}</small></div>
    <div class="prod-action"></div>`;

  card.dataset.search = [name, sku, categoryName, product.Product_Dimensions || "", detailsList.join(" ")].filter(Boolean).join(" ");

  // ADD turns into a stepper; once the item is in the cart every tap changes the cart straight away.
  const action = card.querySelector(".prod-action");
  const paint = () => {
    const line = getOrder()[name];
    if (isNotify) {
      action.innerHTML = '<button class="prod-btn prod-btn-ghost" type="button" data-notify>Request now</button>';
    } else if (line) {
      action.innerHTML = `<div class="prod-stepper" role="group" aria-label="Quantity">
          <button type="button" data-step="-1" aria-label="Decrease quantity">&minus;</button>
          <span>${line.qty} ${unit}</span>
          <button type="button" data-step="1" aria-label="Increase quantity">+</button>
        </div>`;
    } else {
      action.innerHTML = '<button class="prod-btn" type="button" data-add>ADD</button>';
    }
  };
  card.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-add],[data-step],[data-notify]");
    if (!btn) return;
    event.preventDefault();
    if (btn.hasAttribute("data-notify")) {
      const message = `Hi, ${name}${sku ? ` (${sku})` : ""} is available on request. Please share the price and lead time.`;
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
      return;
    }
    if (btn.hasAttribute("data-add")) {
      addToOrder(product, minQty);
      return;
    }
    const current = Number((getOrder()[name] || {}).qty) || minQty;
    const next = current + Number(btn.dataset.step);
    if (next < minQty) removeFromOrder(name);
    else addToOrder(product, next, { silent: true });
  });
  document.addEventListener("cart:changed", paint);
  paint();

  return card;
};

const renderCatalog = (categories) => {
  if (!catalogGrid) return;
  catalogGrid.innerHTML = "";
  productIndex = [];
  let cardCount = 0;
  // Within each category, available products come first.
  const availabilityRank = { Now: 0, "On Request": 1, Notify: 2 };
  categories.forEach((category) => {
    const products = [...(category.products || [])].filter((p) => p && p.ProductCode && p.ProductCode.trim().length > 1);
    products.sort((a, b) => (availabilityRank[a.Availability] ?? 0) - (availabilityRank[b.Availability] ?? 0));
    if (!products.length) return;
    const block = document.createElement("section");
    block.className = "cat-block";
    block.dataset.category = category.name;
    block.innerHTML = `<div class="cat-block-head"><h2>${category.name}</h2><span>${products.length} products</span></div><div class="cat-grid"></div>`;
    const grid = block.querySelector(".cat-grid");
    products.forEach((product) => {
      const card = createCard(product, category.name);
      grid.appendChild(card);
      const thumbImg = card.querySelector(".prod-img img");
      productIndex.push({
        code: card.dataset.productCode,
        id: card.id,
        key: card.dataset.productCodeKey,
        link: card.dataset.productLink,
        image: thumbImg ? thumbImg.getAttribute("src") : "",
        price: product.Price || "",
        unit: product.Unit || "",
        category: category.name || ""
      });
      cardCount += 1;
    });
    catalogGrid.appendChild(block);
  });
  if (cardCount === 0) {
    catalogGrid.innerHTML = "<p>No products found. Please try again shortly.</p>";
  }
  renderFilters(categories);
  renderCellPills(categories);

  // a few real product photos in the banner
  const thumbs = document.querySelector("#heroThumbs");
  if (thumbs && !thumbs.childElementCount) {
    const pics = [];
    categories.forEach((c) => {
      const p = (c.products || []).find((x) => (Array.isArray(x.Image_Link) ? x.Image_Link[0] : x.Image_Link));
      if (p) pics.push(Array.isArray(p.Image_Link) ? p.Image_Link[0] : p.Image_Link);
    });
    thumbs.innerHTML = pics.slice(0, 3).map((src) => `<img src="${src}" alt="" loading="lazy" />`).join("");
  }

  // /?category=Nickel%20Strip%20Plated  (used by the product page breadcrumb)
  const wanted = new URLSearchParams(window.location.search).get("category");
  if (wanted && categories.some((c) => c.name === wanted)) {
    currentCategoryFilter = wanted;
    setFilterButtonState(wanted);
  }
  filterCatalog();
  // an old shared link (/?product=Name#catalog) now lands on that product's own page
  if (pendingProductCode) {
    const key = normalizeProductCode(pendingProductCode);
    const hit = productIndex.find((p) => p.key === key);
    pendingProductCode = "";
    if (hit) window.location.replace(hit.link);
  }
};

const CATALOG_POLL_MS = 30000;
let lastCatalogJson = "";

const fetchCatalog = async () => {
  const response = await fetch("products.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("products.json not found");
  const text = await response.text();
  return { text, categories: normalizeCatalogData(JSON.parse(text)) };
};

const loadCatalog = async () => {
  if (!catalogGrid) return;
  try {
    const { text, categories } = await fetchCatalog();
    lastCatalogJson = text;
    cachedCatalog = categories;
    renderCatalog(categories);
  } catch (error) {
    catalogGrid.innerHTML = "<p>Unable to load catalog. Please try again shortly.</p>";
  }
};

// Picks up products switched on/off in Zoho without a reload, keeping the current filter and search.
const refreshCatalog = async () => {
  if (!catalogGrid) return;
  try {
    const { text, categories } = await fetchCatalog();
    if (text === lastCatalogJson) return;
    lastCatalogJson = text;
    cachedCatalog = categories;
    renderCatalog(categories);
    if (!categories.some((cat) => cat.name === currentCategoryFilter)) currentCategoryFilter = "all";
    setFilterButtonState(currentCategoryFilter);
    filterCatalog();
  } catch {
    // keep showing the last good catalog
  }
};

const populateCountrySelects = () => {
  const selects = document.querySelectorAll(".phone-row select");
  if (!selects.length) return;
  selects.forEach((select) => {
    select.innerHTML = "";
    const option = document.createElement("option");
    option.value = "+91";
    option.textContent = "🇮🇳 India (+91)";
    option.selected = true;
    select.appendChild(option);
  });
};

// Ordering now goes through login + the real checkout flow (see test-account.js),
// not a WhatsApp-form submission. WhatsApp remains available only as a contact channel
// (header phone/WhatsApp icons).

const openMobileSheet = () => {
  // the slide-over cart (cart-drawer.js) replaces the old quote sheet
  if (typeof window.openCartDrawer === "function") { window.openCartDrawer(); return; }
  if (!mobileSheet) return;
  mobileSheet.classList.add("is-open");
  mobileSheet.setAttribute("aria-hidden", "false");
};

if (mobileFab && mobileSheet) {
  mobileFab.addEventListener("click", openMobileSheet);
}

// The bottom tab bar's Quote tab (index.html only) opens the same cart sheet as the old
// floating "View Quote" pill it replaced there.
document.querySelector("#mobileTabQuote")?.addEventListener("click", openMobileSheet);

// Highlight whichever tab the visitor tapped (Account/WhatsApp navigate away, so they're
// left as tapped briefly without needing to track that).
const mobileTabs = document.querySelectorAll(".mobile-tab");
mobileTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    mobileTabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
  });
});
// Home and Store also reflect which section is actually in view while scrolling, since
// both stay on the page (unlike Account/WhatsApp, which navigate away).
const homeTab = document.querySelector('.mobile-tab[data-tab="home"]');
const storeTab = document.querySelector('.mobile-tab[data-tab="store"]');
const catalogSection = document.querySelector("#catalog");
if (homeTab && storeTab && catalogSection && "IntersectionObserver" in window) {
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        mobileTabs.forEach((t) => t.classList.remove("is-active"));
        (entry.target === catalogSection ? storeTab : homeTab).classList.add("is-active");
      });
    },
    { rootMargin: "-45% 0px -45% 0px" }
  );
  sectionObserver.observe(document.querySelector("#home"));
  sectionObserver.observe(catalogSection);
}

if (mobileSheetClose && mobileSheet) {
  mobileSheetClose.addEventListener("click", () => {
    mobileSheet.classList.remove("is-open");
    mobileSheet.setAttribute("aria-hidden", "true");
  });
}

if (mobileSheet) {
  mobileSheet.addEventListener("click", (event) => {
    if (event.target === mobileSheet) {
      mobileSheet.classList.remove("is-open");
      mobileSheet.setAttribute("aria-hidden", "true");
    }
  });
}

document.querySelectorAll("[data-clear]").forEach((btn) => {
  btn.addEventListener("click", () => {
    clearOrder();
  });
});

const applyMobileFabVisibility = () => {
  const isMobile =
    window.matchMedia("(max-width: 900px)").matches ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  document.body.classList.toggle("is-mobile", isMobile);
  if (mobileFab) {
    mobileFab.style.display = isMobile ? "inline-flex" : "none";
  }
};

loadCatalog();
window.setInterval(() => {
  if (!document.hidden) refreshCatalog();
}, CATALOG_POLL_MS);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshCatalog();
});
populateCountrySelects();
renderOrderList();
applyMobileFabVisibility();
window.addEventListener("resize", applyMobileFabVisibility);
loadSiteConfig();

const handleSearchInput = (value) => {
  currentSearchTerm = String(value || "").trim().toLowerCase();
  filterCatalog();
  if (currentSearchTerm) {
    const wasAlreadyActive = document.body.classList.contains("search-active");
    document.body.classList.add("search-active");
    // Scroll only once, when search first becomes active — not on every keystroke. On
    // mobile, repeating this on each keystroke fights the keyboard's own focus-scroll and
    // makes the sticky header (which holds the search box) jump and partly hide.
    if (!wasAlreadyActive) {
      const catalog = document.querySelector("#catalog");
      if (catalog) catalog.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } else {
    document.body.classList.remove("search-active");
  }
  renderSuggestions(currentSearchTerm);
};

if (globalSearch) {
  globalSearch.addEventListener("input", (event) => {
    handleSearchInput(event.target.value);
  });
  document.querySelector("#searchGo")?.addEventListener("click", () => {
    globalSearch.focus();
    handleSearchInput(globalSearch.value);
  });
}

const buildPdfPage = (className, innerHtml) => {
  const page = document.createElement("div");
  page.className = `pdf-page ${className || ""}`.trim();
  page.innerHTML = innerHtml;
  return page;
};

const getFooterTextBlocks = () => {
  const footer = document.querySelector(".site-footer");
  if (!footer) return [];
  const blocks = [];
  footer.querySelectorAll(".footer-grid > div").forEach((col) => {
    const text = col.innerText.trim();
    if (text) blocks.push(text);
  });
  return blocks;
};

const generatePdf = async () => {
  if (typeof window.jspdf === "undefined" || typeof window.html2canvas === "undefined") {
    alert("PDF libraries not loaded. Please refresh and try again.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "pt", "a4");
  const pdfRoot = document.createElement("div");
  pdfRoot.className = "pdf-root";

  const brand = cachedSiteConfig.brand || {};
  const about = cachedSiteConfig.about || {};
  const capabilities = cachedSiteConfig.capabilities || {};
  const capItems = Array.isArray(capabilities.items) && capabilities.items.length
    ? capabilities.items
    : (cachedSiteConfig.solutions && Array.isArray(cachedSiteConfig.solutions.items)
        ? cachedSiteConfig.solutions.items
        : []);

  const aboutPoints = Array.isArray(about.whyItems)
    ? about.whyItems.map((item) =>
        typeof item === "string" ? item.replace(/^sub:\s*/i, "").trim() : ""
      ).filter(Boolean)
    : [];
  const aboutList = aboutPoints.length
    ? `<ul class="pdf-about-list">${aboutPoints.map((item) => `<li>${item}</li>`).join("")}</ul>`
    : "";

  const cover = buildPdfPage("pdf-cover", `
    <div class="pdf-cover-header">
      <img class="pdf-logo" src="${brand.logo || "assets/logo.png"}" alt="Logo" />
      <h1>${brand.name || "Arambhika"}</h1>
      <p class="pdf-tagline">${brand.tagline || ""}</p>
      <p class="pdf-catalog-title">Company Catalog</p>
    </div>
    <div class="pdf-section">
      <h2>About Us</h2>
      <p class="pdf-lead">${about.title || ""}</p>
      <p>${about.lead || ""}</p>
      ${aboutList}
    </div>
  `);

  const capList = capItems
    .map(
      (item) => `
      <li class="pdf-cap-item">
        <img class="pdf-cap-image" src="${item.image || ""}" alt="${item.title || "Capability"}" />
        <div>
          <h3>${item.title || ""}</h3>
          <p class="pdf-tag">${item.tag || ""}</p>
          <p>${item.line || ""}</p>
        </div>
      </li>
    `
    )
    .join("");
  const capabilityPage = buildPdfPage("pdf-capabilities", `
    <div class="pdf-section">
      <h2>${capabilities.title || "Our Capabilities"}</h2>
      <p class="pdf-lead">${capabilities.lead || ""}</p>
      <ul class="pdf-list">${capList}</ul>
    </div>
  `);

  const catalogPages = [];
  const chunkSize = 6;
  cachedCatalog.forEach((category) => {
    const products = category.products || [];
    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
      const items = chunk.map((product) => {
        const image = Array.isArray(product.Image_Link) && product.Image_Link.length
          ? product.Image_Link[0]
          : "";
        const priceText = product.Price || "";
        const unit = product.Unit || "";
        const moq = product["Minimum Quantity"] || "";
        const dims = product.Product_Dimensions || "";
        const availability = product.Availability || "";
        const showUnit = priceText && !/per\s+/i.test(priceText) && !/\//.test(priceText);
        return `
          <div class="pdf-product">
            <img src="${image}" alt="${product.ProductCode || "Product"}" />
            <div>
              <h4>${product.ProductCode || ""}</h4>
              <p class="pdf-dim">${dims}</p>
              <p class="pdf-meta">Price: ${priceText}${showUnit ? `/${unit}` : ""}</p>
              <p class="pdf-meta">Min Qty: ${moq} ${unit}</p>
              <p class="pdf-meta">Availability: ${availability}</p>
            </div>
          </div>
        `;
      }).join("");
      catalogPages.push(
        buildPdfPage("pdf-catalog", `
          <div class="pdf-section">
            <h2>${category.name || "Catalog"}</h2>
            <div class="pdf-products">${items}</div>
          </div>
        `)
      );
    }
  });

  const footerBlocks = getFooterTextBlocks();
  const contactPage = buildPdfPage("pdf-contact", `
    <div class="pdf-section">
      <h2>Contact Us</h2>
      ${footerBlocks.map((block) => `<pre class="pdf-contact-block">${block}</pre>`).join("")}
    </div>
  `);

  [cover, capabilityPage, ...catalogPages, contactPage].forEach((page) =>
    pdfRoot.appendChild(page)
  );
  document.body.appendChild(pdfRoot);

  const pages = Array.from(pdfRoot.querySelectorAll(".pdf-page"));
  for (let i = 0; i < pages.length; i += 1) {
    const canvas = await window.html2canvas(pages[i], { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const imgProps = doc.getImageProperties(imgData);
    const pdfWidth = doc.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    if (i > 0) doc.addPage();
    doc.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
  }

  doc.save("catalog.pdf");
  pdfRoot.remove();
};


const renderSuggestions = (term) => {
  if (!searchSuggestions) return;
  searchSuggestions.innerHTML = "";
  if (!term) {
    searchSuggestions.classList.remove("is-visible");
    return;
  }
  const matches = productIndex
    .filter((item) => item.code.toLowerCase().includes(term))
    .slice(0, 8);
  if (!matches.length) {
    searchSuggestions.classList.remove("is-visible");
    return;
  }
  matches.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "suggestion-item";

    if (item.image) {
      const thumb = document.createElement("img");
      thumb.className = "suggestion-thumb";
      thumb.src = item.image;
      thumb.alt = "";
      thumb.loading = "lazy";
      btn.appendChild(thumb);
    }

    const textCol = document.createElement("span");
    textCol.className = "suggestion-text";

    const label = document.createElement("span");
    label.className = "suggestion-label";
    label.textContent = item.code;
    textCol.appendChild(label);

    if (item.category) {
      const category = document.createElement("span");
      category.className = "suggestion-category";
      category.textContent = item.category;
      textCol.appendChild(category);
    }

    btn.appendChild(textCol);

    if (item.price) {
      const showUnit = item.unit && !/per\s+/i.test(item.price) && !/\//.test(item.price);
      const price = document.createElement("span");
      price.className = "suggestion-price";
      price.textContent = `${item.price}${showUnit ? `/${item.unit}` : ""}`;
      btn.appendChild(price);
    }

    btn.addEventListener("click", () => {
      if (item.code) {
        window.location.href = item.link || `/product/${toDomToken(normalizeProductCode(item.code))}`;
      } else {
        const target = document.getElementById(item.id);
        if (target) {
          document.body.classList.add("search-active");
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
      searchSuggestions.classList.remove("is-visible");
    });
    searchSuggestions.appendChild(btn);
  });
  searchSuggestions.classList.add("is-visible");
};

document.addEventListener("click", (event) => {
  if (!searchSuggestions) return;
  if (!searchSuggestions.contains(event.target) && event.target !== globalSearch && !event.target.closest("#searchGo")) {
    searchSuggestions.classList.remove("is-visible");
  }
});

window.addEventListener("popstate", () => {
  const productCode = getRequestedProductCode();
  if (!productCode) return;
  if (!focusProductByCode(productCode, { smooth: false, updateUrl: false })) {
    pendingProductCode = productCode;
  }
});

window.addEventListener("hashchange", () => {
  const productCode = getRequestedProductCode();
  if (!productCode) return;
  if (!focusProductByCode(productCode, { smooth: false, updateUrl: false })) {
    pendingProductCode = productCode;
  }
});

/* ── Nav catalog dropdown ── */
// On mobile the nav links sit in a horizontally-scrollable strip (overflow-x: auto), which
// would otherwise clip this dropdown's open panel since it needs to escape that row's bounds.
// So the scroller's overflow is relaxed to visible for as long as a dropdown inside it is open.
const syncNavLinksOverflow = (navLinks) => {
  if (!navLinks) return;
  navLinks.classList.toggle("has-open-dropdown", !!navLinks.querySelector(".nav-dropdown.open"));
};
document.querySelectorAll(".nav-dropdown-toggle").forEach((toggle) => {
  const dropdown = toggle.closest(".nav-dropdown");
  const navLinks = toggle.closest(".nav-links");
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    dropdown.classList.toggle("open");
    syncNavLinksOverflow(navLinks);
  });
});
document.addEventListener("click", (event) => {
  document.querySelectorAll(".nav-dropdown.open").forEach((dropdown) => {
    if (!dropdown.contains(event.target)) {
      dropdown.classList.remove("open");
      syncNavLinksOverflow(dropdown.closest(".nav-links"));
    }
  });
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document.querySelectorAll(".nav-dropdown.open").forEach((d) => {
      d.classList.remove("open");
      syncNavLinksOverflow(d.closest(".nav-links"));
    });
  }
});

// Categories stay pinned under the header while the page scrolls: tell the CSS how tall the header is.
(() => {
  const header = document.querySelector(".site-header");
  if (!header || !window.ResizeObserver) return;
  const set = () => document.documentElement.style.setProperty("--hdr-h", header.getBoundingClientRect().height + "px");
  new ResizeObserver(set).observe(header);
  set();
})();

// Home blog section: three rows of guides, then a "Show more" button.
(() => {
  const grid = document.querySelector(".home-blog .blog-tiles");
  const btn = document.getElementById("blogShowMore");
  if (!grid || !btn) return;
  let open = false;
  const apply = () => {
    const tiles = [...grid.children].filter((el) => el.classList.contains("blog-tile"));
    tiles.forEach((t) => t.classList.remove("blog-extra"));
    const cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(" ").length);
    const limit = cols * 3;
    if (tiles.length <= limit) { btn.hidden = true; return; }
    btn.hidden = false;
    if (!open) tiles.slice(limit).forEach((t) => t.classList.add("blog-extra"));
    btn.innerHTML = open ? "Show fewer ▴" : "Show more guides (" + (tiles.length - limit) + ") ▾";
  };
  btn.addEventListener("click", () => { open = !open; apply(); });
  let timer;
  window.addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(apply, 150); });
  apply();
  window.addEventListener("load", apply);
})();
