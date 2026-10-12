// Slide-over cart for the store page. Opens by itself when something is added (so the customer
// sees it landed), shows each line with its picture, price and a quantity stepper, and goes
// straight to checkout.html. Reads the same basket as the rest of the site (script.js getOrder /
// setOrder), so nothing else needs to know the drawer exists.
(() => {
  const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const catalogProducts = () =>
    (typeof cachedCatalog !== "undefined" ? cachedCatalog : []).flatMap((c) => c.products || []);
  const productFor = (name) => catalogProducts().find((p) => p.ProductCode === name);
  const unitPrice = (p) => Number(String(p?.Price ?? "").replace(/[^\d.]/g, "")) || 0;
  const minQty = (p) => Math.max(1, Number(p?.["Minimum Quantity"]) || 1);

  const root = document.createElement("div");
  root.className = "cd-root";
  root.innerHTML = `
    <div class="cd-backdrop" data-cd-close></div>
    <aside class="cd-panel" role="dialog" aria-modal="true" aria-label="Your cart" aria-hidden="true">
      <header class="cd-head">
        <h2 class="cd-title">Your cart <span class="cd-count" id="cdCount"></span></h2>
        <button type="button" class="cd-x" data-cd-close aria-label="Close cart">&times;</button>
      </header>
      <div class="cd-body" id="cdBody"></div>
      <footer class="cd-foot" id="cdFoot"></footer>
    </aside>`;
  document.body.appendChild(root);

  // Floating cart button (the mobile tab bar already has its own Quote tab)
  const fab = document.createElement("button");
  fab.type = "button";
  fab.className = "cd-fab";
  fab.setAttribute("aria-label", "Open cart");
  fab.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7h12l-1 13H7L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg><span class="cd-fab-badge" id="cdBadge">0</span>`;
  document.body.appendChild(fab);

  const panel = root.querySelector(".cd-panel");
  const body = root.querySelector("#cdBody");
  const foot = root.querySelector("#cdFoot");
  const countEl = root.querySelector("#cdCount");
  const badge = fab.querySelector("#cdBadge");
  let lastFocus = null;
  let highlight = "";

  function lines() {
    const order = getOrder();
    return Object.values(order).map((item) => {
      const p = productFor(item.name);
      const price = unitPrice(p);
      return { item, p, price, total: price * (Number(item.qty) || 0), min: minQty(p), image: (p?.Image_Link || [])[0] || "" };
    });
  }

  function render() {
    const all = lines();
    const qty = all.reduce((s, l) => s + (Number(l.item.qty) || 0), 0);
    const subtotal = all.reduce((s, l) => s + l.total, 0);
    countEl.textContent = all.length ? `(${all.length} item${all.length === 1 ? "" : "s"})` : "";
    badge.textContent = String(all.length);
    fab.classList.toggle("has-items", all.length > 0);

    if (!all.length) {
      body.innerHTML = `
        <div class="cd-empty">
          <div class="cd-empty-icon" aria-hidden="true">🛒</div>
          <h3>Your cart is empty</h3>
          <p>Add nickel strips or copper busbars and they will show up here.</p>
          <button type="button" class="cd-btn cd-btn-primary" data-cd-close>Browse products</button>
        </div>`;
      foot.innerHTML = "";
      return;
    }

    body.innerHTML = all.map(({ item, p, price, total, min, image }) => `
      <article class="cd-line${item.name === highlight ? " is-new" : ""}" data-id="${esc(item.id)}">
        <div class="cd-thumb">${image ? `<img src="${esc(image)}" alt="" loading="lazy" />` : ""}</div>
        <div class="cd-info">
          <div class="cd-name">${esc(item.name)}</div>
          <div class="cd-meta">${price ? `${money(price)} / ${esc(item.unit || p?.Unit || "KG")}` : "Price on request"}${min > 1 ? ` · min ${min}` : ""}</div>
          <div class="cd-row">
            <div class="cd-stepper" role="group" aria-label="Quantity">
              <button type="button" data-act="dec" aria-label="Decrease" ${Number(item.qty) <= min ? "disabled" : ""}>−</button>
              <span>${esc(item.qty)} ${esc(item.unit || "KG")}</span>
              <button type="button" data-act="inc" aria-label="Increase">+</button>
            </div>
            <div class="cd-line-total">${price ? money(total) : ""}</div>
          </div>
        </div>
        <button type="button" class="cd-remove" data-act="rm" aria-label="Remove ${esc(item.name)}">&times;</button>
      </article>`).join("");

    foot.innerHTML = `
      <div class="cd-sum"><span>Subtotal</span><strong>${subtotal ? money(subtotal) : "—"}</strong></div>
      <p class="cd-note">Shipping and taxes are shown on the payment page, before you pay.</p>
      <button type="button" class="cd-btn cd-btn-primary cd-checkout" id="cdCheckout">Checkout${subtotal ? ` · ${money(subtotal)}` : ""}</button>
      <button type="button" class="cd-btn cd-btn-ghost" data-cd-close>Continue shopping</button>
      <div class="cd-count-hint">${qty} unit${qty === 1 ? "" : "s"} in total</div>`;
    foot.querySelector("#cdCheckout").addEventListener("click", () => { location.href = "checkout.html"; });
  }

  function open() {
    lastFocus = document.activeElement;
    render();
    root.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    document.body.classList.add("cd-lock");
    // warm up the next page so Checkout feels instant
    if (!document.querySelector('link[rel="prefetch"][href="checkout.html"]')) {
      const l = document.createElement("link");
      l.rel = "prefetch";
      l.href = "checkout.html";
      document.head.appendChild(l);
    }
    setTimeout(() => panel.querySelector(".cd-x")?.focus({ preventScroll: true }), 60);
  }
  function close() {
    root.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    document.body.classList.remove("cd-lock");
    highlight = "";
    lastFocus?.focus?.({ preventScroll: true });
  }

  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-cd-close]")) { close(); return; }
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const line = btn.closest(".cd-line");
    const id = line?.dataset.id;
    const order = getOrder();
    const item = order[id];
    if (!item) return;
    const p = productFor(item.name);
    if (btn.dataset.act === "rm") delete order[id];
    else if (btn.dataset.act === "inc") item.qty = Number(item.qty) + 1;
    else if (btn.dataset.act === "dec") item.qty = Math.max(minQty(p), Number(item.qty) - 1);
    setOrder(order);
    render();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && root.classList.contains("is-open")) close(); });
  fab.addEventListener("click", open);

  // kept in step with every change anywhere on the page
  document.addEventListener("cart:changed", () => { render(); });
  document.addEventListener("cart:added", (e) => { highlight = e.detail?.name || ""; open(); });

  window.openCartDrawer = open;
  window.closeCartDrawer = close;
  render();
})();
