// Login (MSG91 OTP, see otp-login.js) + checkout UI. Loads after script.js, reusing its cart helpers
// (getOrder, clearOrder, renderOrderList, cachedCatalog) as plain globals — classic scripts
// in one page share a global scope.
//
// Order flow: one "Proceed" button (desktop panel + mobile sheet). Clicking it:
//   - not logged in      -> opens the login step
//   - logged in, no profile saved -> opens the account/profile step
//   - logged in, profile saved    -> places the order immediately
// Each step remembers to resume straight into the next one, so the customer only clicks
// Proceed once and is walked through whatever's missing.
(() => {
  const modal = document.getElementById("testAcctModal");
  const navBtn = document.getElementById("testAcctBtn");
  if (!modal || !navBtn) return;

  const steps = {
    login: document.getElementById("testStepLogin"),
    account: document.getElementById("testStepAccount"),
    wizard: document.getElementById("testStepWizard"),
    orders: document.getElementById("testStepOrders"),
  };
  const otpLoginBox = document.getElementById("testOtpLogin");
  const accountMobile = document.getElementById("testAccountMobile");
  const wizardRoot = document.getElementById("testWizardRoot");
  const myOrdersBtn = document.getElementById("testMyOrdersBtn");
  const logoutBtn = document.getElementById("testLogoutBtn");
  const backBtn = document.getElementById("testBackToAccount");
  const ordersList = document.getElementById("testOrdersList");
  const closeBtn = document.getElementById("testAcctClose");
  const nameEl = document.getElementById("testAcctName");

  // What the sign-up wizard still needs from this customer comes from the server (profileStatus),
  // so the rule lives in one place. Order is blocked until it says "complete".
  let profileStatus = null;
  const profileIsComplete = () => Boolean(profileStatus?.complete);

  // Desktop panel + mobile sheet share the same logic, driven off two independent note targets.
  const proceedButtons = [
    { btn: document.getElementById("orderProceedBtn"), note: document.getElementById("orderProceedNote") },
    { btn: document.getElementById("mobileOrderProceedBtn"), note: document.getElementById("mobileOrderProceedNote") },
  ].filter((x) => x.btn);

  let session = { loggedIn: false, mobile: "" };
  let profile = null;
  let resumeProceedAfterLogin = false;
  let resumeProceedAfterProfile = false;

  const showStep = (name) => {
    Object.entries(steps).forEach(([key, el]) => { if (el) el.hidden = key !== name; });
  };
  const openModal = (step) => { showStep(step); modal.hidden = false; };
  const closeModal = () => { modal.hidden = true; };
  closeBtn?.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  function setProceedNote(text) {
    proceedButtons.forEach(({ note }) => { if (note) note.textContent = text; });
  }

  // After checkout, the note area becomes a small mini-UI: a link to Zoho's real payment
  // page, a status line, and a button to check back once payment is done (there's no webhook
  // wired up here, so confirmation is "check again" rather than automatic).
  function showPaymentStep(orderId, paymentUrl, total, statusText) {
    proceedButtons.forEach(({ note }) => {
      if (!note) return;
      note.textContent = "";
      if (total) {
        const amountLine = document.createElement("div");
        amountLine.textContent = `Total: ₹${Number(total).toLocaleString("en-IN")}`;
        note.appendChild(amountLine);
      }
      if (statusText) {
        const statusLine = document.createElement("div");
        statusLine.textContent = statusText;
        note.appendChild(statusLine);
      }
      const actions = document.createElement("div");
      const payLink = document.createElement("a");
      payLink.href = paymentUrl;
      payLink.target = "_blank";
      payLink.rel = "noopener";
      payLink.className = "acct-link-btn";
      payLink.textContent = "Pay Now";
      payLink.style.marginRight = "10px";
      const confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = "acct-link-btn";
      confirmBtn.textContent = "I've paid — check order";
      confirmBtn.addEventListener("click", () => confirmPayment(orderId, paymentUrl, total));
      actions.appendChild(payLink);
      actions.appendChild(confirmBtn);
      note.appendChild(actions);
    });
  }

  // Once the payment tab is open, keep checking in the background (every 5s, and straight away
  // when the customer comes back to this tab) so the confirmation appears on this same screen
  // without having to press anything.
  let payPoll = null;
  // Zoho sends the customer to a status page on commerce.zoho.in that 404s for API-driven stores
  // (the real page lives on the store's own domain). The payment still goes through and this page
  // confirms it, so once it does we close that tab instead of leaving the customer on the 404.
  let payWindow = null;
  function closePayWindow() {
    try { if (payWindow && !payWindow.closed) payWindow.close(); } catch {}
    payWindow = null;
  }
  function stopPaymentPolling() { if (payPoll) { clearInterval(payPoll.timer); payPoll = null; } }
  function startPaymentPolling(orderId) {
    stopPaymentPolling();
    let tries = 0;
    const check = async () => {
      if (!payPoll || payPoll.busy) return;
      payPoll.busy = true;
      try {
        const res = await fetch(`/api/test-orders/${orderId}/confirm-payment`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (data.ok) {
          stopPaymentPolling();
          closePayWindow();
          if (typeof clearOrder === "function") clearOrder();
          setProceedNote(`Payment received. Order ${data.salesOrderNumber} is confirmed.`);
          return;
        }
      } catch {}
      if (payPoll) payPoll.busy = false;
      if (++tries >= 120) stopPaymentPolling(); // gives up after ~10 minutes; the button still works
    };
    payPoll = { timer: setInterval(check, 5000), busy: false, check };
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && payPoll) payPoll.check(); });

  async function confirmPayment(orderId, paymentUrl, total) {
    setProceedNote("Checking with Zoho…");
    try {
      const res = await fetch(`/api/test-orders/${orderId}/confirm-payment`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        stopPaymentPolling();
        closePayWindow();
        if (typeof clearOrder === "function") clearOrder();
        setProceedNote(`Payment received. Order ${data.salesOrderNumber} is confirmed.`);
      } else {
        showPaymentStep(orderId, paymentUrl, total, data.message || data.error || "Not confirmed yet — pay first, then check again.");
      }
    } catch (err) {
      showPaymentStep(orderId, paymentUrl, total, err.message);
    }
  }
  function setProceedDisabled(disabled) {
    proceedButtons.forEach(({ btn }) => { btn.disabled = disabled; });
  }

  function updateHeaderAndProceed() {
    navBtn.classList.toggle("is-logged-in", session.loggedIn);
    navBtn.title = session.loggedIn ? `Account (${session.mobile})` : "Account";
    if (nameEl) nameEl.textContent = session.loggedIn && profile?.firstName ? profile.firstName : "";
    const subNav = document.getElementById("acctSubNav");
    if (subNav) subNav.hidden = !session.loggedIn;
    if (!session.loggedIn) {
      setProceedDisabled(false);
      setProceedNote("Log in to proceed with your order.");
    } else if (!profileIsComplete()) {
      setProceedDisabled(false);
      setProceedNote(`Complete your profile (${profileStatus?.percent ?? 25}%) to place your order.`);
    } else {
      setProceedDisabled(false);
      setProceedNote(`Logged in as ${profile.firstName || session.mobile}.`);
    }
  }

  async function loadSession() {
    try {
      session = await fetch("/api/test-auth/me").then((r) => r.json());
    } catch { session = { loggedIn: false }; }
    if (session.loggedIn) {
      await loadProfile();
      await restoreCartAfterLogin();
    }
    updateHeaderAndProceed();
  }

  // ---- Cart persistence for a logged-in customer (survives closing the browser) ----
  let restoringCart = false;
  window.onCartChanged = (cart) => {
    if (session.loggedIn && !restoringCart) syncCartToServer(cart);
  };

  async function syncCartToServer(cart) {
    try {
      await fetch("/api/test-cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart }),
      });
    } catch {}
  }

  // Items added before logging in (this session) win; otherwise restore what was saved last time.
  async function restoreCartAfterLogin(serverCartGiven) {
    const localCart = typeof getOrder === "function" ? getOrder() : {};
    if (Object.keys(localCart).length) {
      syncCartToServer(localCart);
      return;
    }
    let serverCart = serverCartGiven;
    if (!serverCart) {
      try { serverCart = await fetch("/api/test-cart").then((r) => r.json()).then((d) => d.cart); } catch { serverCart = {}; }
    }
    if (serverCart && Object.keys(serverCart).length && typeof setOrder === "function") {
      restoringCart = true;
      setOrder(serverCart);
      restoringCart = false;
      if (typeof renderOrderList === "function") renderOrderList();
    }
  }

  async function loadProfile() {
    try {
      const data = await fetch("/api/test-account").then((r) => r.json());
      profile = data.profile || null;
      profileStatus = data.status || null;
    } catch { profile = null; profileStatus = null; }
  }

  // The same step-by-step set-up as My Account, inside the checkout popup. When it finishes the
  // order carries straight on, so the customer only ever clicks Proceed once.
  let wizardStarted = false;
  function openWizard() {
    wizardRoot.replaceChildren();
    wizardStarted = true;
    initProfileWizard(wizardRoot, {
      mode: "wizard",
      onSaved: (p, st) => { profile = p; profileStatus = st; updateHeaderAndProceed(); },
      onDone: async (p, st) => {
        profile = p;
        profileStatus = st;
        updateHeaderAndProceed();
        closeModal();
        if (resumeProceedAfterProfile) {
          resumeProceedAfterProfile = false;
          continueProceed();
        }
      },
    });
    openModal("wizard");
  }

  // Clicking the header icon directly (not via the Proceed/checkout flow) now goes to the
  // dedicated My Account page, which handles its own login + shows profile/orders/invoices
  // together. The modal below stays only for the in-checkout login/profile steps.
  navBtn.addEventListener("click", () => {
    window.location.href = "account.html";
  });

  initOtpLogin(otpLoginBox, {
    buttonClass: "button",
    onSuccess: async (data) => {
      session = { loggedIn: true, mobile: data.mobile };
      profile = data.profile || null;
      await loadProfile();
      await restoreCartAfterLogin(data.cart);
      updateHeaderAndProceed();

      if (!profileIsComplete()) {
        // First sign-up (or an unfinished profile): guided set-up, then straight on to the order
        // if there was one waiting.
        resumeProceedAfterProfile = resumeProceedAfterLogin || Object.keys(typeof getOrder === "function" ? getOrder() : {}).length > 0;
        resumeProceedAfterLogin = false;
        openWizard();
      } else if (resumeProceedAfterLogin) {
        resumeProceedAfterLogin = false;
        continueProceed();
      } else {
        accountMobile.textContent = session.mobile;
        showStep("account");
      }
    },
  });

  myOrdersBtn.addEventListener("click", loadOrders);
  backBtn.addEventListener("click", () => { accountMobile.textContent = session.mobile; showStep("account"); });

  logoutBtn.addEventListener("click", async () => {
    await fetch("/api/test-auth/logout", { method: "POST" }).catch(() => {});
    session = { loggedIn: false, mobile: "" };
    profile = null;
    updateHeaderAndProceed();
    closeModal();
  });

  const fmtMoney = (n) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  async function loadOrders() {
    ordersList.innerHTML = "<p class='form-note'>Loading…</p>";
    showStep("orders");
    try {
      const res = await fetch("/api/test-orders");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load orders");
      renderOrders(data.orders || []);
    } catch (err) {
      ordersList.innerHTML = `<p class="acct-error">${err.message}</p>`;
    }
  }

  function renderOrders(orders) {
    if (!orders.length) {
      ordersList.innerHTML = "<p class='form-note'>No orders yet.</p>";
      return;
    }
    ordersList.innerHTML = orders.map((o) => {
      const itemLines = o.items.map((it) => `<div>${it.label || it.variantId} &times; ${it.qty}</div>`).join("");
      const live = o.live;
      const statusLabel = live?.status || o.status;
      return `
        <div class="acct-order-card">
          <div class="acct-order-head">
            <span>${o.zohoSalesOrderNumber || o.id}</span>
            <span class="acct-order-status is-${o.status}">${statusLabel}</span>
          </div>
          ${itemLines}
          ${live ? `<div class="acct-order-note">Shipped: ${live.shippedStatus || "-"} &middot; Invoiced: ${live.invoicedStatus || "-"}${live.total ? ` &middot; Total: ${fmtMoney(live.total)}` : ""}</div>` : ""}
          ${o.note ? `<div class="acct-order-note">${o.note}</div>` : ""}
        </div>`;
    }).join("");
  }

  // ---- The single "Proceed" entry point ----
  // Resolves once the login check on page load has finished. Without waiting for it, a quick
  // click on Proceed could run before we knew the customer was already logged in and ask them
  // to log in again.
  let sessionReady = Promise.resolve();

  async function onProceedClick() {
    await sessionReady;
    const order = typeof getOrder === "function" ? getOrder() : {};
    if (!Object.keys(order).length) {
      setProceedNote("Add at least one item to your quote first.");
      return;
    }
    if (!session.loggedIn) {
      resumeProceedAfterLogin = true;
      openModal("login");
      return;
    }
    if (!profileIsComplete()) {
      resumeProceedAfterProfile = true;
      openWizard();
      return;
    }
    continueProceed();
  }
  proceedButtons.forEach(({ btn }) => btn.addEventListener("click", onProceedClick));

  async function continueProceed() {
    const order = typeof getOrder === "function" ? getOrder() : {};
    const entries = Object.values(order);
    if (!entries.length) {
      setProceedNote("Add at least one item to your quote first.");
      return;
    }

    const catalogProducts = (typeof cachedCatalog !== "undefined" ? cachedCatalog : []).flatMap((c) => c.products);
    const items = [];
    for (const it of entries) {
      const product = catalogProducts.find((p) => p.ProductCode === it.name);
      if (!product?.ZohoVariantId) {
        setProceedNote(`${it.name} can't be ordered online yet.`);
        return;
      }
      items.push({ variantId: product.ZohoVariantId, qty: Number(it.qty) || 1, label: it.name });
    }

    setProceedDisabled(true);
    setProceedNote("Preparing your order…");
    try {
      const res = await fetch("/api/test-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        // The login really has lapsed (expired or logged out elsewhere): ask once, then carry on.
        session = { loggedIn: false, mobile: "" };
        updateHeaderAndProceed();
        resumeProceedAfterLogin = true;
        openModal("login");
        return;
      }
      if (res.status === 400 && data.code === "PROFILE_INCOMPLETE") {
        profileStatus = data.status || profileStatus;
        resumeProceedAfterProfile = true;
        updateHeaderAndProceed();
        openWizard();
        return;
      }
      if (!res.ok) throw new Error(data.error || "Could not place your order");
      // Opens Zoho's real payment page automatically; the customer also gets a "Pay Now" link
      // in case the popup was blocked.
      payWindow = window.open(data.paymentUrl, "_blank");
      showPaymentStep(data.orderId, data.paymentUrl, data.total, "A payment tab has opened. Complete payment there; this page confirms your order automatically.");
      startPaymentPolling(data.orderId);
    } catch (err) {
      setProceedNote(err.message);
    } finally {
      setProceedDisabled(false);
    }
  }

  sessionReady = loadSession();
  if (new URLSearchParams(location.search).get("checkout") === "1") {
    sessionReady.then(() => {
      history.replaceState(null, "", location.pathname);
      if (session.loggedIn && typeof getOrder === "function" && Object.keys(getOrder()).length) onProceedClick();
    });
  }
})();
