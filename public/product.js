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
        <div class="pp-main-img">${imgs.length ? `<img id="ppImg" src="${esc(imgs[0])}" alt="${esc(P.name)}" />` : `<div class="pp-noimg">Photo coming soon</div>`}
          ${imgs.length > 1 ? `<button class="pp-nav pp-prev" type="button" aria-label="Previous photo">&lsaquo;</button><button class="pp-nav pp-next" type="button" aria-label="Next photo">&rsaquo;</button>` : ""}
        </div>
        ${imgs.length > 1 ? `<div class="pp-thumbs" id="ppThumbs">${imgs.map((s, i) => `<button type="button" class="${i ? "" : "is-on"}" data-i="${i}" aria-label="Photo ${i + 1}"><img src="${esc(s)}" alt="" /></button>`).join("")}</div>` : ""}
      </div>
      <div class="pp-info">
        <div class="pp-cat">${esc(P.category)}</div>
        <h1 class="pp-title">${esc(P.name)}</h1>
        ${P.sku ? `<div class="pp-sku">SKU ${esc(P.sku)}</div>` : ""}
        <div class="pp-price">${P.price ? `${money(P.price)} <small>per ${esc(P.unit)}</small>` : "Price on request"}</div>
        <div class="pp-note">Minimum order ${P.min} ${esc(P.unit)}. Shipping and tax are shown before you pay.</div>
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
      const link = `<a class="pp-btn pp-btn-yellow" href="https://wa.me/919315545821?text=${encodeURIComponent(`Hi, please notify me when ${P.name} is back in stock.`)}" target="_blank" rel="noopener">Notify me on WhatsApp</a>`;
      buy.innerHTML = link;
      sticky.innerHTML = `<div class="pp-sticky-price">Out of stock<small>We can tell you when it is back</small></div>${link}`; // phones show only the sticky bar
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
