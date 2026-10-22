// Product detail page. The server has already written the product (window.__PRODUCT__) and its
// category neighbours (window.__RELATED__) into the page; this draws the gallery, buy box,
// specifications and related products, and keeps the cart in step as the quantity changes.
(() => {
  const P = window.__PRODUCT__;
  const RELATED = window.__RELATED__ || [];
  const root = document.getElementById("productRoot");
  if (!P || !root) return;

  const CART_KEY = "orderCart";
  const money = (n) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cell = (name) => (String(name).match(/\((\d{4,5})\)/) || [])[1] || "";

  // ---- the shared basket (same storage the store page and checkout use) -------------------------
  const readCart = () => { try { return JSON.parse(sessionStorage.getItem(CART_KEY) || "{}"); } catch { return {}; } };
  function writeCart(cart, addedName) {
    sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
    document.dispatchEvent(new CustomEvent("cart:changed"));
    if (addedName) document.dispatchEvent(new CustomEvent("cart:added", { detail: { name: addedName } }));
    // keep a logged-in customer's saved basket in step (silently ignored when logged out)
    fetch("/api/test-cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cart }) }).catch(() => {});
  }
  const lineFor = (p, qty) => ({ id: p.name, name: p.name, qty, unit: p.unit });

  // ---- spec table, read from the product name and Zoho's own fields -----------------------------
  function specRows(p) {
    const rows = [["Category", p.category]];
    if (/Plated/i.test(p.category)) rows.push(["Material", "Nickel-plated steel strip"]);
    else if (/Pure/i.test(p.category)) rows.push(["Material", "Pure nickel strip"]);
    else if (/Copper/i.test(p.category)) rows.push(["Material", "Tin-coated copper"]);
    const type = (p.name.match(/\b(1P|2P|ZigZag)\b/i) || [])[1];
    if (type) rows.push(["Strip type", /^1P$/i.test(type) ? "1P (single strip)" : /^2P$/i.test(type) ? "2P (pre-formed, two cells)" : "Zig-zag"]);
    if (cell(p.name)) rows.push(["Suits cell", cell(p.name)]);
    const m = p.name.match(/(\d+(?:\.\d+)?)\s*x\s*0?(\.?\d+(?:\.\d+)?)/i);
    if (m) {
      rows.push(["Width", `${m[1]} mm`]);
      rows.push(["Thickness", `${m[2].startsWith(".") ? "0" + m[2] : m[2]} mm`]);
    }
    const cd = (p.name.match(/CD\s*([\d.]+)/i) || [])[1];
    if (cd) rows.push(["Cell distance (CD)", `${cd} mm`]);
    if (/without holder/i.test(p.name)) rows.push(["Holder", "Without holder"]);
    else if (/with holder/i.test(p.name)) rows.push(["Holder", "With holder"]);
    if (/without slit/i.test(p.name)) rows.push(["Slit", "Without slit"]);
    else if (/with slit/i.test(p.name)) rows.push(["Slit", "With slit"]);
    if (p.dimensions) rows.push(["Dimensions", p.dimensions.replace(/\r?\n/g, " · ")]);
    rows.push(["Minimum order", `${p.min} ${p.unit}`]);
    if (p.price) rows.push(["Price", `${money(p.price)} per ${p.unit}`]);
    if (p.sku) rows.push(["SKU", p.sku]);
    return rows;
  }

  function relatedCard(r) {
    const img = r.images[0];
    return `<a class="pp-rel" href="/product/${esc(r.slug)}">
      <span class="pp-rel-img">${img ? `<img src="${esc(img)}" alt="" loading="lazy" />` : ""}</span>
      <span class="pp-rel-name">${esc(r.name)}</span>
      <span class="pp-rel-price">${r.price ? `${money(r.price)} <small>/ ${esc(r.unit)}</small>` : ""}</span>
    </a>`;
  }

  // ---- page --------------------------------------------------------------------------------------
  const notify = /notify/i.test(P.availability);
  const onRequest = /request/i.test(P.availability);
  const imgs = P.images;
  const tags = [cell(P.name) && `${cell(P.name)} cells`, /Pure/i.test(P.category) ? "Pure nickel" : /Plated/i.test(P.category) ? "Nickel plated" : /Copper/i.test(P.category) ? "Tin-coated copper" : "", notify ? "Out of stock" : onRequest ? "On request" : "Available"].filter(Boolean);

  root.innerHTML = `
    <nav class="pp-crumbs" aria-label="Breadcrumb"><a href="/">Store</a> &rsaquo; <a href="/?category=${encodeURIComponent(P.category)}#catalog">${esc(P.category)}</a> &rsaquo; <span>${esc(P.name)}</span></nav>
    <div class="pp-grid">
      <div class="pp-gallery">
        <div class="pp-main-img">${imgs.length ? `<img id="ppImg" src="${esc(imgs[0])}" alt="${esc(P.name)}" /><button type="button" class="pp-zoom" id="ppZoom" aria-label="Zoom photo (full screen)" title="Zoom"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></svg></button>` : `<div class="pp-noimg">Photo coming soon</div>`}
          ${imgs.length > 1 ? `<button class="pp-nav pp-prev" type="button" aria-label="Previous photo">&lsaquo;</button><button class="pp-nav pp-next" type="button" aria-label="Next photo">&rsaquo;</button>` : ""}
        </div>
        ${imgs.length > 1 ? `<div class="pp-thumbs" id="ppThumbs">${imgs.map((s, i) => `<button type="button" class="${i ? "" : "is-on"}" data-i="${i}" aria-label="Photo ${i + 1}"><img src="${esc(s)}" alt="" /></button>`).join("")}</div>` : ""}
      </div>
      <div class="pp-info">
        <button type="button" class="wish-btn wish-lg" data-name="${esc(P.name)}" data-variant="${esc(P.variantId || "")}" aria-label="Save ${esc(P.name)} to favourites" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button>
        <div class="pp-cat">${esc(P.category)}</div>
        <h1 class="pp-title">${esc(P.name)}</h1>
        ${P.sku ? `<div class="pp-sku">SKU ${esc(P.sku)}</div>` : ""}
        <div class="pp-price">${P.price ? `${money(P.price)} <small>per ${esc(P.unit)}</small>` : "Price on request"}</div>
        <div class="pp-note">Minimum order ${P.min} ${esc(P.unit)}. GST is added at checkout, and shown in your cart before you pay. Shipping is added in the final invoice.</div>
        <div class="pp-tags">${tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>
        <div class="pp-buy" id="ppBuy"></div>
        <div class="pp-assure">
          <div><b>Manufacturer-direct</b>Made at our own unit</div>
          <div><b>GST invoice</b>Tax invoice with every order</div>
          <div><b>Secure payment</b>UPI, cards, net banking</div>
        </div>
      </div>
    </div>
    <section class="pp-sec"><h2>Specifications</h2>
      <table class="pp-spec">${specRows(P).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>
    </section>
    ${P.details.length ? `<section class="pp-sec"><h2>About this item</h2><ul class="pp-about">${P.details.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></section>` : ""}
    ${RELATED.length ? `<section class="pp-sec"><div class="pp-sec-head"><h2>More from ${esc(P.category)}</h2><a href="/?category=${encodeURIComponent(P.category)}#catalog">See all &rsaquo;</a></div><div class="pp-rel-grid">${RELATED.map(relatedCard).join("")}</div></section>` : ""}
    <div class="pp-sticky" id="ppSticky"></div>`;

  // ---- gallery ------------------------------------------------------------------------------------
  let gi = 0;
  const show = (i) => {
    gi = (i + imgs.length) % imgs.length;
    const img = document.getElementById("ppImg");
    if (img) img.src = imgs[gi];
    document.querySelectorAll("#ppThumbs button").forEach((b, n) => b.classList.toggle("is-on", n === gi));
  };
  root.querySelector(".pp-prev")?.addEventListener("click", () => show(gi - 1));
  root.querySelector(".pp-next")?.addEventListener("click", () => show(gi + 1));
  document.getElementById("ppThumbs")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-i]");
    if (b) show(Number(b.dataset.i));
  });
  document.addEventListener("keydown", (e) => {
    if (imgs.length < 2 || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "")) return;
    if (e.key === "ArrowLeft") show(gi - 1);
    if (e.key === "ArrowRight") show(gi + 1);
  });

  // ---- full-screen zoom: a pop-up with every photo, zoom in and out, drag to look around ------------
  let zoomEl = null;
  function openZoom(start) {
    if (zoomEl || !imgs.length) return;
    let idx = (start + imgs.length) % imgs.length;
    let scale = 1, tx = 0, ty = 0, drag = null;
    zoomEl = document.createElement("div");
    zoomEl.className = "zm-overlay";
    zoomEl.setAttribute("role", "dialog");
    zoomEl.setAttribute("aria-modal", "true");
    zoomEl.setAttribute("aria-label", "Zoomed photo of " + P.name);
    zoomEl.innerHTML = `
      <div class="zm-bar">
        <span class="zm-title">${esc(P.name)}</span>
        <span class="zm-count" id="zmCount"></span>
        <button type="button" class="zm-btn" id="zmOut" aria-label="Zoom out">&minus;</button>
        <button type="button" class="zm-btn" id="zmIn" aria-label="Zoom in">+</button>
        <button type="button" class="zm-btn" id="zmReset" aria-label="Reset zoom">Fit</button>
        <button type="button" class="zm-btn zm-close" id="zmClose" aria-label="Close">&times;</button>
      </div>
      <div class="zm-stage" id="zmStage"><img class="zm-img" id="zmImg" alt="${esc(P.name)}" draggable="false" /></div>
      ${imgs.length > 1 ? `<button type="button" class="zm-nav zm-prev" id="zmPrev" aria-label="Previous photo">&lsaquo;</button><button type="button" class="zm-nav zm-next" id="zmNext" aria-label="Next photo">&rsaquo;</button>` : ""}
      <div class="zm-hint">Scroll or pinch to zoom. Drag to move. Esc to close.</div>`;
    document.body.appendChild(zoomEl);
    document.body.classList.add("zm-open");
    const img = zoomEl.querySelector("#zmImg");
    const stage = zoomEl.querySelector("#zmStage");
    const paint = () => { img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`; stage.classList.toggle("is-zoomed", scale > 1); };
    const clamp = () => {
      const w = img.clientWidth * scale, h = img.clientHeight * scale;
      const mx = Math.max(0, (w - stage.clientWidth) / 2), my = Math.max(0, (h - stage.clientHeight) / 2);
      tx = Math.min(mx, Math.max(-mx, tx)); ty = Math.min(my, Math.max(-my, ty));
    };
    const setScale = (s) => { scale = Math.min(5, Math.max(1, s)); if (scale === 1) { tx = 0; ty = 0; } clamp(); paint(); };
    const go = (i) => {
      idx = (i + imgs.length) % imgs.length;
      img.src = imgs[idx];
      zoomEl.querySelector("#zmCount").textContent = imgs.length > 1 ? `${idx + 1} / ${imgs.length}` : "";
      scale = 1; tx = 0; ty = 0; paint();
    };
    go(idx);

    zoomEl.querySelector("#zmIn").addEventListener("click", () => setScale(scale * 1.5));
    zoomEl.querySelector("#zmOut").addEventListener("click", () => setScale(scale / 1.5));
    zoomEl.querySelector("#zmReset").addEventListener("click", () => setScale(1));
    zoomEl.querySelector("#zmClose").addEventListener("click", closeZoom);
    zoomEl.querySelector("#zmPrev")?.addEventListener("click", () => go(idx - 1));
    zoomEl.querySelector("#zmNext")?.addEventListener("click", () => go(idx + 1));
    stage.addEventListener("click", (e) => { if (e.target === stage) closeZoom(); });
    img.addEventListener("dblclick", () => setScale(scale > 1 ? 1 : 2.5));
    stage.addEventListener("wheel", (e) => { e.preventDefault(); setScale(scale * (e.deltaY < 0 ? 1.2 : 1 / 1.2)); }, { passive: false });

    // drag to move; two fingers to pinch
    const pts = new Map(); let pinch = 0;
    stage.addEventListener("pointerdown", (e) => {
      stage.setPointerCapture?.(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      drag = { x: e.clientX - tx, y: e.clientY - ty };
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    stage.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) setScale(scale * (d / pinch)); pinch = d; return;
      }
      if (scale > 1 && drag) { tx = e.clientX - drag.x; ty = e.clientY - drag.y; clamp(); paint(); }
    });
    const up = (e) => { pts.delete(e.pointerId); pinch = 0; drag = null; };
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);

    zoomEl.__key = (e) => {
      if (e.key === "Escape") closeZoom();
      else if (e.key === "ArrowLeft") go(idx - 1);
      else if (e.key === "ArrowRight") go(idx + 1);
      else if (e.key === "+" || e.key === "=") setScale(scale * 1.5);
      else if (e.key === "-") setScale(scale / 1.5);
      else return;
      e.preventDefault(); e.stopPropagation();
    };
    document.addEventListener("keydown", zoomEl.__key, true);
    zoomEl.querySelector("#zmClose").focus();
  }
  function closeZoom() {
    if (!zoomEl) return;
    document.removeEventListener("keydown", zoomEl.__key, true);
    zoomEl.remove(); zoomEl = null;
    document.body.classList.remove("zm-open");
    document.getElementById("ppZoom")?.focus({ preventScroll: true });
  }
  document.getElementById("ppZoom")?.addEventListener("click", (e) => { e.stopPropagation(); openZoom(gi); });
  document.getElementById("ppImg")?.addEventListener("click", () => openZoom(gi));

  // ---- buy box: Add once, then the quantity IS the cart (no separate update button) -------------
  const buy = document.getElementById("ppBuy");
  const sticky = document.getElementById("ppSticky");
  let qty = Math.max(P.min, Number((readCart()[P.name] || {}).qty) || P.min);

  function paintBuy() {
    const inCart = Boolean(readCart()[P.name]);
    const stepper = `<div class="pp-qty" role="group" aria-label="Quantity">
        <button type="button" data-q="-1" aria-label="Decrease quantity">&minus;</button>
        <span>${qty} ${esc(P.unit)}</span>
        <button type="button" data-q="1" aria-label="Increase quantity">+</button>
      </div>`;
    if (notify) {
      const link = `<button type="button" class="pp-btn pp-btn-yellow" data-request>Request now</button>`;
      buy.innerHTML = link;
      sticky.innerHTML = `<div class="pp-sticky-price">Available on request<small>Ask us for price and lead time</small></div>${link}`; // phones show only the sticky bar
      document.querySelectorAll("[data-request]").forEach((b) => b.addEventListener("click", () => {
        if (window.openProductRequest) window.openProductRequest({ name: P.name, sku: P.sku, unit: P.unit, minQty: P.min });
      }));
      return;
    }
    buy.innerHTML = `${stepper}
      ${inCart ? `<span class="pp-incart">&#10003; In your cart</span>` : `<button type="button" class="pp-btn pp-btn-yellow" id="ppAdd">Add to cart</button>`}
      <button type="button" class="pp-btn pp-btn-buy" id="ppBuyNow">${inCart ? "Checkout" : "Buy now"}</button>`;
    sticky.innerHTML = `<div class="pp-sticky-price">${P.price ? money(P.price * qty) : ""}<small>${esc(P.unit)} price ${P.price ? money(P.price) : ""}</small></div>
      ${stepper}
      ${inCart ? `<button type="button" class="pp-btn pp-btn-buy" data-go>Checkout</button>` : `<button type="button" class="pp-btn pp-btn-yellow" data-add>Add</button>`}`;
  }

  function add() { const c = readCart(); c[P.name] = lineFor(P, qty); writeCart(c, P.name); paintBuy(); }
  function go() { const c = readCart(); if (!c[P.name]) { c[P.name] = lineFor(P, qty); writeCart(c); } location.href = "/checkout.html"; }

  document.addEventListener("click", (e) => {
    const stepBtn = e.target.closest("#ppBuy [data-q], #ppSticky [data-q]");
    if (stepBtn) {
      const next = qty + Number(stepBtn.dataset.q);
      const c = readCart();
      if (c[P.name] && next < P.min) { delete c[P.name]; qty = P.min; writeCart(c); paintBuy(); return; } // below the minimum removes it
      qty = Math.max(P.min, next);
      if (c[P.name]) { c[P.name] = lineFor(P, qty); writeCart(c); } // live: the cart follows every tap
      paintBuy();
      return;
    }
    if (e.target.closest("#ppAdd, [data-add]")) { add(); return; }
    if (e.target.closest("#ppBuyNow, [data-go]")) { go(); }
  });
  document.addEventListener("cart:changed", () => {
    const line = readCart()[P.name];
    if (line) qty = Math.max(P.min, Number(line.qty) || qty);
    paintBuy();
  });

  paintBuy();
})();
