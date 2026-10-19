// "Available on request" products: sign in, say how much you need (plus a note), then WhatsApp opens
// with all of it filled in. Used by the store page and the product page.
//   openProductRequest({ name, sku, unit, minQty })
(() => {
  const WHATSAPP = "919315545821";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let overlay;
  const close = () => { if (overlay) { overlay.remove(); overlay = null; document.body.classList.remove("rq-open"); } };

  function shell(title, bodyHtml) {
    close();
    overlay = document.createElement("div");
    overlay.className = "rq-overlay";
    overlay.innerHTML = `
      <div class="rq-card" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <button type="button" class="rq-x" aria-label="Close">&times;</button>
        <h3>${esc(title)}</h3>
        <div class="rq-body">${bodyHtml}</div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.classList.add("rq-open");
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    overlay.querySelector(".rq-x").addEventListener("click", close);
    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); }
    });
    return overlay.querySelector(".rq-body");
  }

  function loadOtpScript() {
    if (window.initOtpLogin) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/otp-login.js";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function showForm(product, session) {
    const unit = product.unit || "KG";
    const min = Number(product.minQty) || 1;
    const body = shell("Request this product", `
      <p class="rq-product">${esc(product.name)}${product.sku ? ` <small>(${esc(product.sku)})</small>` : ""}</p>
      <p class="rq-hint">This item is available on request. Tell us how much you need and we will reply on WhatsApp with price and lead time.</p>
      <label class="rq-label">Quantity needed (${esc(unit)})
        <input type="number" class="rq-input" id="rqQty" min="1" step="1" value="${min}" inputmode="numeric" />
      </label>
      <label class="rq-label">Note <span class="rq-opt">(optional)</span>
        <textarea class="rq-input" id="rqNote" rows="3" placeholder="Size, delivery city, timeline, anything we should know"></textarea>
      </label>
      <p class="rq-error" id="rqError" role="alert"></p>
      <button type="button" class="rq-btn" id="rqSend">Continue on WhatsApp</button>
      <p class="rq-foot">Signed in as ${esc(session.mobile || "your account")}</p>`);
    const qty = body.querySelector("#rqQty");
    qty.focus();
    body.querySelector("#rqSend").addEventListener("click", () => {
      const n = Number(qty.value);
      if (!Number.isFinite(n) || n < 1) { body.querySelector("#rqError").textContent = "Enter how much you need."; qty.focus(); return; }
      const note = body.querySelector("#rqNote").value.trim();
      const lines = [
        `Hi Arambhika, I would like to request: ${product.name}${product.sku ? ` (${product.sku})` : ""}.`,
        `Quantity: ${n} ${unit}`,
        note ? `Note: ${note}` : "",
        session.mobile ? `My mobile: ${session.mobile}` : "",
        "Please share the price and lead time.",
      ].filter(Boolean);
      window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener");
      close();
    });
  }

  async function showLogin(product) {
    const body = shell("Sign in to continue", `
      <p class="rq-hint">Please log in with your mobile number first. It takes a minute, and lets us match your request to your account.</p>
      <div id="rqLogin"></div>`);
    try { await loadOtpScript(); } catch { body.innerHTML = `<p class="rq-error">Could not load sign-in. Please refresh and try again.</p>`; return; }
    window.initOtpLogin(body.querySelector("#rqLogin"), {
      buttonClass: "rq-btn",
      onSuccess: async () => {
        const me = await fetch("/api/test-auth/me").then((r) => r.json()).catch(() => ({}));
        showForm(product, me.loggedIn ? me : (me.data || {}));
      },
    });
  }

  window.openProductRequest = async (product) => {
    let me = {};
    try { me = await fetch("/api/test-auth/me").then((r) => r.json()); } catch { /* treated as signed out */ }
    const session = me.loggedIn ? me : (me.data?.loggedIn ? me.data : null);
    if (session) showForm(product, session); else showLogin(product);
  };
})();
