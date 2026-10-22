// Checkout page: account -> delivery details -> payment, on one screen with the order summary
// always visible. It reuses the store's basket (sessionStorage "orderCart", restored from the
// server for a logged-in customer) and the existing backend: OTP login, profile wizard,
// /api/test-checkout and /api/test-orders/:id/confirm-payment.
(() => {
  const $ = (id) => document.getElementById(id);
  const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CART_KEY = "orderCart";

  const readCart = () => { try { return JSON.parse(sessionStorage.getItem(CART_KEY) || "{}"); } catch { return {}; } };
  const writeCart = (c) => sessionStorage.setItem(CART_KEY, JSON.stringify(c));

  const state = {
    session: { loggedIn: false, mobile: "" },
    profile: null,
    status: null,
    products: [],
    paying: false,
    estimate: null,
    estimateKey: "",
    editing: false,
    wizardMounted: false,
  };

  // ---- data -------------------------------------------------------------------------------
  async function json(url, opts) {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }
  const post = (url, body) => json(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });

  async function loadCatalog() {
    const r = await json("/products.json");
    const cats = r.data?.categories || r.data?.data?.categories || (Array.isArray(r.data) ? r.data : []);
    state.products = cats.flatMap((c) => c.products || []);
  }
  const productFor = (name) => state.products.find((p) => p.ProductCode === name);
  const unitPrice = (p) => Number(String(p?.Price ?? "").replace(/[^\d.]/g, "")) || 0;

  function cartLines() {
    return Object.values(readCart()).map((item) => {
      const p = productFor(item.name);
      const price = unitPrice(p);
      return { item, p, price, total: price * (Number(item.qty) || 0), image: (p?.Image_Link || [])[0] || "" };
    });
  }
  const subtotal = () => cartLines().reduce((s, l) => s + l.total, 0);

  // A basket saved earlier can hold a product that was renamed or removed in Zoho. Renamed ones are matched by
  // their Zoho id; ones that are gone are taken out, with a note, instead of blocking payment.
  function reconcileCart() {
    const cart = readCart();
    const removed = [];
    let changed = false;
    for (const [key, item] of Object.entries(cart)) {
      let p = productFor(item.name);
      if (!p && item.variantId) p = state.products.find((x) => x.ZohoVariantId === item.variantId);
      if (!p) { delete cart[key]; removed.push(item.name); changed = true; continue; }
      if (p.ProductCode !== item.name || item.variantId !== p.ZohoVariantId) {
        delete cart[key];
        cart[p.ProductCode] = { ...item, id: p.ProductCode, name: p.ProductCode, variantId: p.ZohoVariantId || "" };
        changed = true;
      }
    }
    if (changed) { writeCart(cart); post("/api/test-cart", { cart }); }
    if (removed.length) {
      const note = document.createElement("div");
      note.className = "ck-banner";
      note.setAttribute("role", "status");
      note.textContent = removed.map((n) => `${n}`).join(", ") + (removed.length === 1 ? " is no longer available and was" : " are no longer available and were") + " removed from your cart.";
      $("ckLayout").before(note);
    }
  }

  async function loadAccount() {
    const me = await json("/api/test-auth/me");
    state.session = me.data?.loggedIn ? me.data : { loggedIn: false, mobile: "" };
    if (!state.session.loggedIn) return;
    const acc = await json("/api/test-account");
    state.profile = acc.data?.profile || null;
    state.status = acc.data?.status || null;
    // a basket saved on the server (another device, or before login) fills an empty one
    if (!Object.keys(readCart()).length) {
      const saved = await json("/api/test-cart");
      if (saved.data?.cart && Object.keys(saved.data.cart).length) writeCart(saved.data.cart);
    }
  }

  // GST, shipping and the total exactly as Zoho will charge them (needs the delivery address, so
  // it appears once the customer is signed in with their details saved).
  async function loadEstimate() {
    const ready = state.session.loggedIn && state.status?.complete && !state.editing;
    const items = [];
    for (const { item, p } of cartLines()) {
      if (!p?.ZohoVariantId) { state.estimate = null; return; }
      items.push({ variantId: p.ZohoVariantId, qty: Number(item.qty) || 1, label: item.name });
    }
    if (!items.length) { state.estimate = null; return; }
    const key = JSON.stringify([ready, items.map((i) => [i.variantId, i.qty]), ready ? [state.profile?.state, state.profile?.postalCode] : null]);
    if (key === state.estimateKey && state.estimate) return;
    state.estimateKey = key;
    const r = await post(ready ? "/api/checkout/estimate" : "/api/checkout/estimate-preview", { items });
    state.estimate = r.ok && r.data?.total ? r.data : null;
    renderSummary();
    renderPay();
  }
  // Subtotal is drawn by the caller; this is everything under it: taxable value, each tax, shipping, total.
  const money2 = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  function breakupHtml(e) {
    const rate = e.subtotal ? Math.round((e.tax / e.subtotal) * 10000) / 100 : 0;
    const taxLines = e.preview
      ? [{ name: `GST @ ${rate}%`, amount: e.tax }]
      : (e.taxes.length ? e.taxes : [{ name: "GST", amount: e.tax }]);
    return `
      ${e.discount ? `<div><span>Discount</span><span>-${money2(e.discount)}</span></div>` : ""}
      <div class="ck-muted"><span>Taxable value</span><span>${money2(e.subtotal - (e.discount || 0))}</span></div>
      ${taxLines.map((t) => `<div><span>${esc(t.name)}</span><span>${money2(t.amount)}</span></div>`).join("")}
      <div class="ck-total-final"><span>Total${e.preview ? " (estimate)" : ""}</span><strong>${money2(totalBeforeShipping(e))}</strong></div>
      <p class="ck-fine">Shipping is added in the final invoice. We deliver it ourselves.</p>
      ${e.preview ? `<p class="ck-fine">GST is split into CGST + SGST or IGST once your delivery address is saved. The rate stays the same.</p>` : ""}`;
  }
  // Zoho adds a token shipping charge only to get past its own shipping step; customers are shown the amount without it.
  const totalBeforeShipping = (e) => Math.max(0, Number(e.total || 0) - Number(e.shipping || 0));
  const payableTotal = () => (state.estimate?.total ? totalBeforeShipping(state.estimate) : subtotal());

  // ---- summary (right column) --------------------------------------------------------------
  function renderSummary() {
    const lines = cartLines();
    const total = subtotal();
    $("ckSummaryTotal").textContent = payableTotal() ? (state.estimate ? money2(payableTotal()) : money(payableTotal())) : "";
    $("ckSummaryBody").innerHTML = `
      <ul class="ck-lines">
        ${lines.map(({ item, price, total: t, image }) => `
          <li class="ck-line">
            <div class="ck-thumb">${image ? `<img src="${esc(image)}" alt="" loading="lazy" />` : ""}</div>
            <div class="ck-line-info">
              <div class="ck-line-name">${esc(item.name)}</div>
              <div class="ck-line-meta">${esc(item.qty)} ${esc(item.unit || "KG")}${price ? ` × ${money(price)}` : ""}</div>
            </div>
            <div class="ck-line-total">${price ? money(t) : ""}</div>
          </li>`).join("")}
      </ul>
      <div class="ck-totals">
        <div><span>Subtotal</span><strong>${total ? money(total) : "—"}</strong></div>
        ${state.estimate ? breakupHtml(state.estimate) : `
        <div class="ck-muted"><span>GST &amp; shipping</span><span>Calculating…</span></div>`}
      </div>
      <a class="ck-link" href="index.html#catalog">&larr; Edit cart / continue shopping</a>`;
  }

  // ---- step cards --------------------------------------------------------------------------
  const setState = (id, s) => { $(id).dataset.state = s; };

  function renderAccount() {
    const body = $("ckAccountBody");
    if (state.session.loggedIn) {
      const name = [state.profile?.firstName, state.profile?.lastName].filter(Boolean).join(" ");
      body.innerHTML = `
        <div class="ck-done-row">
          <span class="ck-tick" aria-hidden="true">✓</span>
          <div><strong>${esc(name || "Signed in")}</strong><div class="ck-muted">+91 ${esc(state.session.mobile)} · verified</div></div>
        </div>`;
      setState("ckStepAccount", "done");
      return;
    }
    setState("ckStepAccount", "current");
    body.innerHTML = `
      <p class="ck-lead">Enter your mobile number. New here? We will create your account with the same OTP.</p>
      <div id="ckLogin"></div>`;
    initOtpLogin($("ckLogin"), {
      buttonClass: "ck-btn ck-btn-primary",
      onSuccess: async () => { await loadAccount(); renderAll(); },
    });
  }

  function renderDelivery() {
    const body = $("ckDeliveryBody");
    if (!state.session.loggedIn) {
      setState("ckStepDelivery", "locked");
      body.innerHTML = `<p class="ck-muted">Sign in to add where the order should go.</p>`;
      state.wizardMounted = false;
      return;
    }
    const complete = Boolean(state.status?.complete);
    if (complete && !state.editing) {
      const p = state.profile || {};
      setState("ckStepDelivery", "done");
      state.wizardMounted = false;
      body.innerHTML = `
        <div class="ck-done-row">
          <span class="ck-tick" aria-hidden="true">✓</span>
          <div>
            <strong>${esc([p.firstName, p.lastName].filter(Boolean).join(" "))}</strong>
            <div class="ck-muted">${esc(p.email)}</div>
            <div class="ck-address">${esc(p.address)}<br>${esc(p.city)}, ${esc(p.state)} ${esc(p.postalCode)}</div>
            ${p.hasGst && p.gstin ? `<div class="ck-muted">GST: ${esc(p.gstin)}${p.gstLegalName ? ` · ${esc(p.gstLegalName)}` : ""}</div>` : ""}
          </div>
          <button type="button" class="ck-link ck-edit" id="ckEdit">Change</button>
        </div>`;
      $("ckEdit").addEventListener("click", () => { state.editing = true; renderDelivery(); renderPay(); });
      return;
    }
    setState("ckStepDelivery", "current");
    if (state.wizardMounted) return; // keep what the customer is typing
    state.wizardMounted = true;
    body.innerHTML = `<div id="ckWizard"></div>`;
    initProfileWizard($("ckWizard"), {
      mode: state.editing ? "form" : "wizard",
      onSaved: (p, st) => { state.profile = p; state.status = st; renderAccount(); renderPay(); },
      onDone: async () => {
        state.editing = false;
        state.wizardMounted = false;
        await loadAccount();
        renderAll();
      },
    });
    // an edit made from the one-page form ends with the save, not a "finish" screen
    if (state.editing) {
      $("ckWizard").addEventListener("click", (e) => {
        if (e.target.closest(".wiz-btn-primary")) {
          setTimeout(async () => {
            await loadAccount();
            if (state.status?.complete) { state.editing = false; state.wizardMounted = false; renderAll(); }
          }, 900);
        }
      });
    }
  }

  function renderPay() {
    const body = $("ckPayBody");
    const ready = state.session.loggedIn && state.status?.complete && !state.editing;
    if (!ready) {
      setState("ckStepPay", "locked");
      body.innerHTML = `<p class="ck-muted">${state.session.loggedIn ? "Finish your delivery details to pay." : "Sign in first."}</p>`;
      return;
    }
    setState("ckStepPay", "current");
    if (state.paying) return;
    const total = payableTotal();
    body.innerHTML = `
      <p class="ck-lead">You will pay on Zoho's secure payment page: UPI, cards or net banking. The total above includes GST. Shipping is added in the final invoice.</p>
      <div class="ck-banner" id="ckPayError" role="alert" hidden></div>
      <button type="button" class="ck-btn ck-btn-primary ck-pay" id="ckPayBtn">Pay securely</button>
      <p class="ck-fine">By paying you accept our <a href="terms.html">Terms</a> and <a href="refund-policy.html">Refund Policy</a>.</p>`;
    $("ckPayBtn").addEventListener("click", pay);
  }

  function renderAll() {
    const lines = cartLines();
    $("ckEmpty").hidden = lines.length > 0;
    $("ckLayout").hidden = lines.length === 0;
    if (!lines.length) return;
    renderSummary();
    renderAccount();
    renderDelivery();
    renderPay();
    loadEstimate().catch(() => {});
  }

  // ---- payment -----------------------------------------------------------------------------
  let payWindow = null;
  let pollTimer = null;
  const PENDING_KEY = "ckPending";
  const readPending = () => { try { const p = JSON.parse(localStorage.getItem(PENDING_KEY) || "null"); return p && Date.now() - p.at < 3 * 3600 * 1000 ? p : null; } catch { return null; } };
  const clearPending = () => { try { localStorage.removeItem(PENDING_KEY); } catch {} };

  async function pay() {
    const err = $("ckPayError");
    err.hidden = true;
    const items = [];
    for (const { item, p } of cartLines()) {
      if (!p?.ZohoVariantId) {
        err.textContent = `${item.name} can't be ordered online yet. Please remove it or contact us on WhatsApp.`;
        err.hidden = false;
        return;
      }
      items.push({ variantId: p.ZohoVariantId, qty: Number(item.qty) || 1, label: item.name });
    }
    const btn = $("ckPayBtn");
    btn.disabled = true;
    btn.textContent = "Preparing your order…";
    const r = await post("/api/test-checkout", { items });
    if (r.status === 401) { state.session = { loggedIn: false, mobile: "" }; renderAll(); return; }
    if (r.status === 400 && r.data.code === "PROFILE_INCOMPLETE") {
      state.status = r.data.status || state.status;
      state.wizardMounted = false;
      renderAll();
      return;
    }
    if (!r.ok) {
      btn.disabled = false;
      btn.textContent = "Try again";
      err.textContent = r.data.error || "We could not start the payment. Please try again.";
      err.hidden = false;
      return;
    }
    state.paying = true;
    // Same tab, not a pop-up: phones block or mishandle pop-ups, which left customers on a spinner.
    // The order is remembered so this page can confirm the payment when they come back.
    try { localStorage.setItem(PENDING_KEY, JSON.stringify({ orderId: r.data.orderId, paymentUrl: r.data.paymentUrl, total: r.data.total, at: Date.now() })); } catch {}
    showRedirecting(r.data);
    setTimeout(() => location.assign(r.data.paymentUrl), 700);
  }

  function showRedirecting({ paymentUrl, total }) {
    $("ckPayBody").innerHTML = `
      <div class="ck-waiting" aria-live="polite">
        <div class="ck-spinner" aria-hidden="true"></div>
        <h3>Taking you to the secure payment page</h3>
        <p class="ck-muted">You will pay ${total ? money(total) : "your order"} on Zoho's payment page (UPI, cards or net banking). Please do not close this page.</p>
        <a class="ck-btn ck-btn-primary" href="${esc(paymentUrl)}">Continue to payment</a>
        <p class="ck-fine">Not redirected in a few seconds? Tap the button above.</p>
      </div>`;
  }

  // Shown when the customer comes back from the payment page: we check with Zoho until the payment is confirmed.
  function showWaiting({ paymentUrl, total }) {
    $("ckPayBody").innerHTML = `
      <div class="ck-waiting" aria-live="polite">
        <div class="ck-spinner" aria-hidden="true"></div>
        <h3>Confirming your payment</h3>
        <p class="ck-muted">If you have paid${total ? ` (${money(total)})` : ""}, this page confirms your order automatically in a few seconds.</p>
        <a class="ck-btn ck-btn-primary" href="${esc(paymentUrl)}">Go to the payment page</a>
        <button type="button" class="ck-link" id="ckCancelPay">Cancel and start again</button>
      </div>`;
    $("ckCancelPay").addEventListener("click", () => {
      clearInterval(pollTimer);
      clearPending();
      state.paying = false;
      renderPay();
    });
  }

  function poll(orderId) {
    let tries = 0;
    clearInterval(pollTimer);
    const check = async () => {
      const r = await post(`/api/test-orders/${orderId}/confirm-payment`);
      if (r.data?.ok) {
        clearInterval(pollTimer);
        clearPending();
        done(r.data.salesOrderNumber);
      } else if (++tries >= 120) {
        clearInterval(pollTimer);
        state.paying = false;
        $("ckPayBody").insertAdjacentHTML("beforeend",
          `<p class="ck-muted">Still waiting. If you completed the payment, check <a href="account.html?tab=orders">My Orders</a> in a minute.</p>`);
      }
    };
    pollTimer = setInterval(check, 5000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
    check();
  }

  async function done(orderNumber) {
    clearInterval(pollTimer);
    clearPending();
    sessionStorage.removeItem(CART_KEY);
    post("/api/test-cart", { cart: {} });
    document.dispatchEvent(new CustomEvent("cart:changed"));
    $("ckLayout").hidden = true;
    $("ckEmpty").hidden = true;
    const el = $("ckDone");
    el.hidden = false;
    el.innerHTML = `
      <div class="ck-done-icon" aria-hidden="true">✓</div>
      <h2>Payment received</h2>
      <p class="ck-lead">Your order <strong>${esc(orderNumber)}</strong> is confirmed. We will keep you posted on dispatch.</p>
      <div class="ck-done-actions">
        <a class="ck-btn ck-btn-primary" href="account.html?tab=orders">View my orders</a>
        <a class="ck-btn ck-btn-ghost" href="index.html#catalog">Continue shopping</a>
      </div>`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- mobile: collapsible summary ---------------------------------------------------------
  $("ckSummaryToggle").addEventListener("click", () => {
    const open = $("ckSummaryToggle").getAttribute("aria-expanded") === "true";
    $("ckSummaryToggle").setAttribute("aria-expanded", String(!open));
    $("ckSummaryBody").classList.toggle("is-open", !open);
  });

  // ---- go ----------------------------------------------------------------------------------
  (async () => {
    // Paint the basket straight away from what is already in the browser, then fill in the rest.
    const hasItems = cartLines().length > 0;
    $("ckEmpty").hidden = hasItems;
    $("ckLayout").hidden = !hasItems;
    if (hasItems) {
      renderSummary();
      for (const id of ["ckAccountBody", "ckDeliveryBody", "ckPayBody"]) {
        $(id).innerHTML = '<div class="ck-skeleton"></div>';
      }
    }
    await Promise.all([loadCatalog(), loadAccount()]);
    // a basket that only lives on the server (new device) may have just arrived
    reconcileCart();
    renderAll();
    // coming back from the payment page: confirm the payment instead of showing the checkout again
    const pending = readPending();
    if (pending && state.session.loggedIn) {
      if (cartLines().length) {
        state.paying = true;
        showWaiting(pending);
      } else {
        $("ckEmpty").hidden = true;
        const el = $("ckDone");
        el.hidden = false;
        el.innerHTML = '<div class="ck-waiting" aria-live="polite"><div class="ck-spinner" aria-hidden="true"></div><h3>Confirming your payment</h3><p class="ck-muted">This takes a few seconds. You can also check <a href="account.html?tab=orders">My Orders</a>.</p></div>';
      }
      poll(pending.orderId);
    }
  })();
})();
