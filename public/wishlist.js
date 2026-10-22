// Favourites (wish list): a heart on every product, a Favourites button in the header, a slide-over
// list, and the same list on the customer's dashboard. Saved products live on the server against the
// customer's mobile number, so the hearts are red again whenever they log in, on any device.
//
//   Wishlist.paint()            colour every heart from the saved list
//   Wishlist.toggle(name, id)   save or remove (asks to sign in first when needed)
//   Wishlist.open()             the slide-over list
//   Wishlist.renderList(el)     the same list inside any container (used by the dashboard)
(() => {
  const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const slugify = (v) => String(v || "").toLowerCase().trim().replace(/\s+/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';

  const state = { loggedIn: false, loaded: false, items: new Map(), catalog: null };
  let panel = null;
  const lists = new Set(); // containers showing the list, redrawn when it changes

  async function json(url, opts) {
    const res = await fetch(url, opts);
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  }
  const send = (body) => json("/api/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  // ---- the saved list ----------------------------------------------------------------------
  const has = (name) => state.items.has(name);
  function setItems(items) {
    state.items.clear();
    (items || []).forEach((it) => state.items.set(it.name, it));
  }
  async function refresh() {
    const r = await json("/api/wishlist");
    if (r.ok) setItems(r.data.items);
    else if (r.status === 401) { state.loggedIn = false; state.items.clear(); }
    state.loaded = true;
    changed();
  }
  async function init() {
    try {
      const me = await json("/api/test-auth/me");
      state.loggedIn = !!(me.data?.loggedIn || me.data?.data?.loggedIn);
    } catch { state.loggedIn = false; }
    if (state.loggedIn) await refresh(); else { state.loaded = true; changed(); }
  }

  function changed() {
    paint();
    const n = state.items.size;
    document.querySelectorAll("#headerWishBadge").forEach((b) => { b.textContent = String(n); b.hidden = n === 0; });
    document.querySelectorAll("#headerWish").forEach((b) => b.classList.toggle("has-items", n > 0));
    lists.forEach((el) => { if (el.isConnected) draw(el); else lists.delete(el); });
    document.dispatchEvent(new CustomEvent("wishlist:changed"));
  }

  // ---- hearts ------------------------------------------------------------------------------
  function paint() {
    document.querySelectorAll(".wish-btn[data-name]").forEach((b) => {
      const on = has(b.dataset.name);
      b.classList.toggle("is-saved", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.title = on ? "Saved to favourites. Tap to remove" : "Save to favourites";
    });
  }
  const heartHtml = (name, variantId, extra = "") =>
    `<button type="button" class="wish-btn ${extra}" data-name="${esc(name)}" data-variant="${esc(variantId || "")}" aria-label="Save ${esc(name)} to favourites" aria-pressed="false">${HEART}</button>`;

  async function toggle(name, variantId) {
    if (!name) return;
    if (!state.loggedIn) {
      signIn("Log in to save products", "Your favourites are saved to your account, so they are there whenever you log in.", async () => {
        await refresh();
        if (!has(name)) await toggle(name, variantId); // the product they tapped is saved right after logging in
      });
      return;
    }
    const saved = !has(name);
    if (saved) state.items.set(name, { name, variantId: variantId || "", addedAt: new Date().toISOString() }); else state.items.delete(name);
    changed();
    const r = await send({ name, variantId, saved });
    if (r.status === 401) { state.loggedIn = false; state.items.clear(); changed(); return toggle(name, variantId); }
    if (r.ok) setItems(r.data.items); else { if (saved) state.items.delete(name); else state.items.set(name, { name, variantId }); }
    changed();
    toast(saved ? "Saved to favourites" : "Removed from favourites");
  }

  // Removing is always a removal, never a toggle: a product renamed in Zoho is listed under its new name
  // but saved under its old one, and toggling by the new name would have saved it again instead.
  async function unsave(name, variantId) {
    if (!name || !state.loggedIn) return;
    const before = new Map(state.items);
    state.items.delete(name);
    changed();
    const r = await send({ name, variantId, saved: false });
    if (r.ok) setItems(r.data.items); else { state.items = before; }
    changed();
    toast(r.ok ? "Removed from favourites" : "Could not remove it. Please try again.");
  }

  function signIn(title, hint, onSuccess) {
    if (typeof window.openSignIn === "function") {
      window.openSignIn({ title, hint, onSuccess: async () => { state.loggedIn = true; await onSuccess(); } });
    } else {
      location.href = "/account.html";
    }
  }

  // ---- catalogue, cart ---------------------------------------------------------------------
  async function catalog() {
    if (typeof cachedCatalog !== "undefined" && cachedCatalog.length) return cachedCatalog.flatMap((c) => c.products || []);
    if (state.catalog) return state.catalog;
    const r = await json("/products.json");
    const cats = r.data?.categories || [];
    state.catalog = cats.flatMap((c) => c.products || []);
    return state.catalog;
  }
  const cartRead = () => { try { return JSON.parse(sessionStorage.getItem("orderCart") || "{}"); } catch { return {}; } };
  function cartWrite(order) {
    if (typeof setOrder === "function") { setOrder(order); return; }
    sessionStorage.setItem("orderCart", JSON.stringify(order));
    document.dispatchEvent(new CustomEvent("cart:changed"));
    fetch("/api/test-cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cart: order }) }).catch(() => {});
  }
  const priceOf = (p) => Number(String(p?.Price ?? "").replace(/[^\d.]/g, "")) || 0;
  const minOf = (p) => Number(p?.["Minimum Quantity"]) || 1;
  const orderable = (p) => p && p.ZohoVariantId && String(p.Availability || "Now").toLowerCase() === "now";

  function addToCart(p) {
    const order = cartRead();
    const name = p.ProductCode;
    order[name] = { id: name, name, qty: Math.max(minOf(p), Number(order[name]?.qty) || 0), unit: p.Unit || "KG", variantId: p.ZohoVariantId || "" };
    cartWrite(order);
    toast("Added to cart");
  }

  // ---- list view (slide-over and dashboard) ------------------------------------------------
  async function draw(el) {
    const products = await catalog();
    const rows = [...state.items.values()];
    if (!state.loggedIn) {
      el.innerHTML = `<div class="wl-empty"><p><b>Log in to see your favourites</b></p><p>Tap the heart on any product to save it. Your list is kept on your account.</p><button type="button" class="wl-btn wl-btn-primary" data-wl-login>Log in</button></div>`;
      return;
    }
    if (!rows.length) {
      el.innerHTML = `<div class="wl-empty"><p><b>No favourites yet</b></p><p>Tap the heart on any product to save it here, then add it to your cart whenever you are ready.</p><a class="wl-btn wl-btn-primary" href="/#catalog">Browse products</a></div>`;
      return;
    }
    const inCart = cartRead();
    el.innerHTML = rows.map((it) => {
      const p = products.find((x) => x.ProductCode === it.name) || products.find((x) => it.variantId && x.ZohoVariantId === it.variantId);
      if (!p) {
        return `<article class="wl-row is-gone"><div class="wl-info"><div class="wl-name">${esc(it.name)}</div><div class="wl-meta">No longer in the store</div></div><button type="button" class="wl-remove" data-wl-remove="${esc(it.name)}" data-variant="${esc(it.variantId || "")}" aria-label="Remove ${esc(it.name)}">${HEART}</button></article>`;
      }
      const img = (Array.isArray(p.Image_Link) ? p.Image_Link[0] : p.Image_Link) || "";
      const thumb = /^\/zimg\//.test(img) ? `${img}?w=200` : img;
      const price = priceOf(p);
      const ok = orderable(p);
      const inCartNow = Boolean(inCart[p.ProductCode]);
      return `<article class="wl-row">
        <a class="wl-thumb" href="/product/${esc(slugify(p.ProductCode))}">${thumb ? `<img src="${esc(thumb)}" alt="" width="200" height="200" loading="lazy" />` : ""}</a>
        <div class="wl-info">
          <a class="wl-name" href="/product/${esc(slugify(p.ProductCode))}">${esc(p.ProductCode)}</a>
          <div class="wl-meta">${price ? `${money(price)} / ${esc(p.Unit || "KG")}` : "Price on request"}${minOf(p) > 1 ? ` · min ${minOf(p)}` : ""}</div>
          <div class="wl-actions">
            ${ok
              ? `<button type="button" class="wl-btn wl-btn-primary" data-wl-add="${esc(p.ProductCode)}">${inCartNow ? "In cart · add more" : "Add to cart"}</button>`
              : `<button type="button" class="wl-btn wl-btn-ghost" data-wl-request="${esc(p.ProductCode)}">Request now</button>`}
          </div>
        </div>
        <button type="button" class="wl-remove" data-wl-remove="${esc(it.name)}" data-variant="${esc(it.variantId || p.ZohoVariantId || "")}" aria-label="Remove ${esc(p.ProductCode)} from favourites" title="Remove">${HEART}</button>
      </article>`;
    }).join("");
  }

  function renderList(el) {
    if (!el) return;
    lists.add(el);
    draw(el);
  }

  // clicks inside any list
  document.addEventListener("click", async (e) => {
    const heart = e.target.closest?.(".wish-btn[data-name]");
    if (heart) { e.preventDefault(); e.stopPropagation(); toggle(heart.dataset.name, heart.dataset.variant); return; }
    const remove = e.target.closest?.("[data-wl-remove]");
    if (remove) { unsave(remove.dataset.wlRemove, remove.dataset.variant); return; }
    const add = e.target.closest?.("[data-wl-add]");
    if (add) {
      const p = (await catalog()).find((x) => x.ProductCode === add.dataset.wlAdd);
      if (p) { addToCart(p); lists.forEach((el) => el.isConnected && draw(el)); }
      return;
    }
    const req = e.target.closest?.("[data-wl-request]");
    if (req) {
      const p = (await catalog()).find((x) => x.ProductCode === req.dataset.wlRequest);
      if (p && typeof window.openProductRequest === "function") { close(); window.openProductRequest({ name: p.ProductCode, sku: p.SKU, unit: p.Unit, minQty: minOf(p) }); }
      return;
    }
    if (e.target.closest?.("[data-wl-login]")) { signIn("Log in to see your favourites", "Your favourites are saved to your account.", async () => { await refresh(); }); return; }
    if (e.target.closest?.("#headerWish")) { e.preventDefault(); open(); return; }
    if (e.target.closest?.("[data-wl-close]")) close();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  // ---- slide-over --------------------------------------------------------------------------
  function open() {
    if (panel) return;
    panel = document.createElement("div");
    panel.className = "wl-overlay";
    panel.innerHTML = `<aside class="wl-panel" role="dialog" aria-modal="true" aria-label="Favourites">
      <header class="wl-head"><h3>Favourites <span class="wl-count"></span></h3><button type="button" class="wl-x" data-wl-close aria-label="Close">&times;</button></header>
      <div class="wl-body" id="wlBody"></div>
      <footer class="wl-foot"><a class="wl-btn wl-btn-ghost" href="/account.html?tab=saved">Open in my dashboard</a></footer>
    </aside>`;
    document.body.appendChild(panel);
    document.body.classList.add("wl-open");
    panel.addEventListener("click", (e) => { if (e.target === panel) close(); });
    const body = panel.querySelector("#wlBody");
    renderList(body);
    const sync = () => { const c = panel?.querySelector(".wl-count"); if (c) c.textContent = state.items.size ? `(${state.items.size})` : ""; };
    sync();
    panel.__sync = sync;
    document.addEventListener("wishlist:changed", sync);
  }
  function close() {
    if (!panel) return;
    document.removeEventListener("wishlist:changed", panel.__sync);
    panel.remove();
    panel = null;
    document.body.classList.remove("wl-open");
  }

  // ---- small confirmation ------------------------------------------------------------------
  let toastTimer;
  function toast(text) {
    let t = document.getElementById("wlToast");
    if (!t) { t = document.createElement("div"); t.id = "wlToast"; t.className = "wl-toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  // hearts drawn after the page loads (the product grid is built by script.js) are coloured too
  let paintTimer;
  new MutationObserver(() => { clearTimeout(paintTimer); paintTimer = setTimeout(paint, 60); }).observe(document.documentElement, { childList: true, subtree: true });

  window.Wishlist = { paint, toggle, open, close, renderList, refresh, has, heartHtml, init };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
