// Dedicated "My Account" page: profile, order history and invoices in one place, reached
// from the header account icon. Uses the same TEMPORARY test-mode endpoints as the checkout
// flow in test-account.js (login/profile/orders are shared across both). Replace the login
// step with real MSG91 OTP once that's approved — everything else here stays the same.
(() => {
  const guestView = document.getElementById("acctGuestView");
  const dashboard = document.getElementById("acctDashboard");
  if (!guestView || !dashboard) return;

  const otpLoginBox = document.getElementById("acctOtpLogin");
  const avatar = document.getElementById("acctAvatar");
  const sidebarName = document.getElementById("acctSidebarName");
  const sidebarPhone = document.getElementById("acctSidebarPhone");
  const tabBtns = document.querySelectorAll(".acct-tab-btn");
  const panels = {
    dashboard: document.getElementById("acctPanelDashboard"),
    profile: document.getElementById("acctPanelProfile"),
    orders: document.getElementById("acctPanelOrders"),
    invoices: document.getElementById("acctPanelInvoices"),
    saved: document.getElementById("acctPanelSaved"),
  };
  const dashGreeting = document.getElementById("acctDashGreeting");
  const statTotal = document.getElementById("statTotal");
  const statPending = document.getElementById("statPending");
  const statConfirmed = document.getElementById("statConfirmed");
  const statInvoices = document.getElementById("statInvoices");
  const downloadOrdersBtn = document.getElementById("acctDownloadOrders");
  const logoutBtn = document.getElementById("acctLogoutBtn");
  const wizardOverlay = document.getElementById("acctWizardOverlay");
  const wizardRoot = document.getElementById("acctWizardRoot");
  const wizardClose = document.getElementById("acctWizardClose");
  const completeBanner = document.getElementById("acctCompleteBanner");
  const completeFill = document.getElementById("acctCompleteFill");
  const completeSub = document.getElementById("acctCompleteSub");
  const completeBtn = document.getElementById("acctCompleteBtn");
  const profileWizardRoot = document.getElementById("acctProfileWizard");
  const cartBanner = document.getElementById("acctCartBanner");
  const cartBannerText = document.getElementById("acctCartBannerText");
  let profileStatus = null;
  let editWizard = null;   // the "form" version in the Profile tab
  let signupWizard = null; // the step-by-step version in the overlay
  const ordersList = document.getElementById("acctOrdersList");
  const refreshBtn = document.getElementById("acctRefreshOrders");
  const invoicesList = document.getElementById("acctInvoicesList");
  const refreshInvoicesBtn = document.getElementById("acctRefreshInvoices");
  const orderFilters = document.getElementById("acctOrderFilters");

  let session = { loggedIn: false, mobile: "" };
  let profile = null;
  let ordersLoadedOnce = false;
  let invoicesLoadedOnce = false;
  let allOrders = [];
  let orderFilter = "active"; // active = confirmed + pending (everything but failed) — the default view

  const showGuest = () => { guestView.hidden = false; dashboard.hidden = true; };
  const showDashboard = () => { guestView.hidden = true; dashboard.hidden = false; };

  function switchTab(name) {
    if (!panels[name]) name = "dashboard";
    tabBtns.forEach((b) => b.classList.toggle("is-active", b.dataset.tab === name));
    Object.entries(panels).forEach(([key, el]) => { if (el) el.hidden = key !== name; });
    const url = new URL(location.href);
    url.searchParams.set("tab", name);
    history.replaceState(null, "", url);
    if ((name === "orders" || name === "dashboard") && !ordersLoadedOnce) loadOrders();
    if (name === "invoices" && !invoicesLoadedOnce) loadInvoices();
    if (name === "saved" && window.Wishlist) window.Wishlist.renderList(document.getElementById("acctSavedList"));
  }
  tabBtns.forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  document.querySelectorAll("[data-goto]").forEach((el) => {
    el.addEventListener("click", () => {
      if (el.dataset.filter) setOrderFilter(el.dataset.filter);
      switchTab(el.dataset.goto);
    });
  });

  function updateSidebar() {
    const name = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : session.mobile;
    sidebarName.textContent = name || session.mobile;
    sidebarPhone.textContent = session.mobile;
    avatar.textContent = (profile?.firstName || session.mobile || "?").charAt(0).toUpperCase();
    if (dashGreeting) dashGreeting.textContent = profile?.firstName ? `${profile.firstName}'s Dashboard` : "Your Dashboard";
  }

  async function loadSession() {
    try {
      session = await fetch("/api/test-auth/me").then((r) => r.json());
    } catch { session = { loggedIn: false }; }
    if (!session.loggedIn) { showGuest(); return; }
    await loadProfile();
    updateSidebar();
    showDashboard();
    mountProfileForm();
    const requestedTab = new URLSearchParams(location.search).get("tab");
    switchTab(requestedTab || "dashboard");
    if (profileStatus && !profileStatus.complete && new URLSearchParams(location.search).get("setup") === "1") openWizard();
  }

  async function loadProfile({ silent = false } = {}) {
    try {
      const data = await fetch("/api/test-account").then((r) => r.json());
      const next = data.profile || null;
      const nextStatus = data.status || null;
      if (silent && JSON.stringify([next, nextStatus]) === JSON.stringify([profile, profileStatus])) return;
      profile = next;
      profileStatus = nextStatus;
      updateSidebar();
      updateCompleteBanner();
      updateCartBanner();
      if (silent && editWizard) editWizard.reload();
    } catch { if (!silent) { profile = null; profileStatus = null; } }
  }

  // ---- first sign-up: a guided, step-by-step set-up -------------------------------------------
  // A basket that is waiting (kept on the server for logged-in customers) is one tap from checkout.
  async function updateCartBanner() {
    if (!cartBanner) return;
    try {
      const saved = await fetch("/api/test-cart").then((r) => r.json());
      const count = Object.keys(saved.cart || {}).length;
      cartBanner.hidden = count === 0;
      if (count) cartBannerText.textContent = `You have ${count} item${count === 1 ? "" : "s"} in your cart`;
    } catch { cartBanner.hidden = true; }
  }

  function updateCompleteBanner() {
    if (!completeBanner) return;
    const incomplete = profileStatus && !profileStatus.complete;
    completeBanner.hidden = !incomplete;
    if (incomplete) {
      completeFill.style.width = `${profileStatus.percent}%`;
      completeSub.textContent = `${profileStatus.percent}% done. You need a few more details before you can place an order.`;
    }
  }

  function openWizard() {
    wizardOverlay.hidden = false;
    document.body.classList.add("wiz-open");
    wizardRoot.replaceChildren();
    signupWizard = initProfileWizard(wizardRoot, {
      mode: "wizard",
      onSaved: async (p, st) => { profile = p; profileStatus = st; updateSidebar(); updateCompleteBanner(); if (editWizard) editWizard.reload({ force: true }); },
      onDone: async () => {
        closeWizard();
        await loadProfile();
        // Someone who added items before signing up goes straight on to their order.
        let hasItems = false;
        try {
          const saved = await fetch("/api/test-cart").then((r) => r.json());
          hasItems = Object.keys(saved.cart || {}).length > 0;
        } catch {}
        if (hasItems) { location.href = "checkout.html"; return; }
        switchTab("dashboard");
      },
    });
  }
  function closeWizard() {
    wizardOverlay.hidden = true;
    document.body.classList.remove("wiz-open");
  }
  wizardClose?.addEventListener("click", closeWizard);
  completeBtn?.addEventListener("click", openWizard);

  // Sign up and log in are one flow: a new number, or any profile that is still incomplete, is
  // walked through the set-up straight after the OTP.
  initOtpLogin(otpLoginBox, {
    buttonClass: "acct-btn-primary",
    onSuccess: async (data) => {
      session = { loggedIn: true, mobile: data.mobile };
      profile = data.profile || null;
      await loadProfile();
      showDashboard();
      mountProfileForm();
      const requestedTab = new URLSearchParams(location.search).get("tab");
      switchTab(requestedTab || "dashboard");
      if (profileStatus && !profileStatus.complete) openWizard();
    },
  });

  function mountProfileForm() {
    if (editWizard || !profileWizardRoot) return;
    editWizard = initProfileWizard(profileWizardRoot, {
      mode: "form",
      onSaved: async (p, st) => { profile = p; profileStatus = st; updateSidebar(); updateCompleteBanner(); },
    });
  }

  logoutBtn.addEventListener("click", async () => {
    await fetch("/api/test-auth/logout", { method: "POST" }).catch(() => {});
    session = { loggedIn: false, mobile: "" };
    profile = null;
    ordersLoadedOnce = false;
    invoicesLoadedOnce = false;
    allOrders = [];
    showGuest();
  });

  const fmtMoney = (n) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (d) => {
    try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
    catch { return d || ""; }
  };

  function matchesOrderFilter(order, filter) {
    if (filter === "all") return true;
    if (filter === "confirmed") return order.status === "confirmed";
    if (filter === "pending") return order.status === "awaiting_payment";
    if (filter === "failed") return order.status === "failed";
    return order.status !== "failed"; // "active" (default): confirmed + pending, hides failed
  }

  // Cards the customer has opened, so a background refresh doesn't snap them shut.
  const openOrderIds = (container) =>
    new Set([...container.querySelectorAll(".acct-order-card2.is-open")].map((c) => c.dataset.orderId));
  const reopenOrders = (container, ids) => {
    container.querySelectorAll(".acct-order-card2").forEach((c) => {
      if (ids.has(c.dataset.orderId)) c.querySelector(".acct-order-head2")?.click();
    });
  };
  let lastOrdersSig = "";

  async function loadOrders({ silent = false } = {}) {
    if (!silent) ordersList.innerHTML = "<p class='form-note'>Loading&hellip;</p>";
    try {
      const res = await fetch("/api/test-orders");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load orders");
      ordersLoadedOnce = true;
      const sig = JSON.stringify(data.orders || []);
      if (silent && sig === lastOrdersSig) return;
      lastOrdersSig = sig;
      const open = silent ? openOrderIds(ordersList) : new Set();
      allOrders = data.orders || [];
      renderOrders();
      reopenOrders(ordersList, open);
      updateDashboardStats();
    } catch (err) {
      if (!silent) ordersList.innerHTML = `<p class="acct-error">${err.message}</p>`;
    }
  }
  refreshBtn.addEventListener("click", () => loadOrders());

  function updateDashboardStats() {
    if (!statConfirmed) return;
    statPending.textContent = String(allOrders.filter((o) => o.status === "awaiting_payment").length);
    statConfirmed.textContent = String(allOrders.filter((o) => o.status === "confirmed").length);
    statInvoices.textContent = String(allOrders.filter((o) => o.zohoSalesOrderNumber).length);
  }

  function ordersToCsv(orders) {
    const header = ["Order Number", "Date", "Status", "Items", "Total"];
    const rows = orders.map((o) => [
      o.zohoSalesOrderNumber || o.id,
      fmtDate(o.placedAt),
      o.status,
      (o.items || []).map((it) => `${it.label || it.variantId} x${it.qty}`).join("; "),
      o.total != null ? o.total : "",
    ]);
    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
    return [header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
  }

  downloadOrdersBtn?.addEventListener("click", () => {
    const filtered = allOrders.filter((o) => matchesOrderFilter(o, orderFilter));
    const csv = ordersToCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arambhika-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  orderFilters?.querySelectorAll(".acct-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      orderFilter = chip.dataset.filter;
      orderFilters.querySelectorAll(".acct-chip").forEach((c) => c.classList.toggle("is-active", c === chip));
      renderOrders();
    });
  });

  function setOrderFilter(filter) {
    orderFilter = filter;
    orderFilters?.querySelectorAll(".acct-chip").forEach((c) => c.classList.toggle("is-active", c.dataset.filter === filter));
    renderOrders();
  }

  function renderOrders() {
    const filtered = allOrders.filter((o) => matchesOrderFilter(o, orderFilter));
    if (!allOrders.length) {
      ordersList.innerHTML = "<p class='form-note'>No orders yet &mdash; place your first order from the Store.</p>";
      return;
    }
    if (!filtered.length) {
      ordersList.innerHTML = "<p class='form-note'>No orders match this filter.</p>";
      return;
    }
    ordersList.innerHTML = "";
    filtered.forEach((o) => ordersList.appendChild(buildOrderCard(o)));
  }

  let lastInvoicesSig = "";
  async function loadInvoices({ silent = false } = {}) {
    if (!silent) invoicesList.innerHTML = "<p class='form-note'>Loading&hellip;</p>";
    try {
      const res = await fetch("/api/test-orders");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load transaction history");
      invoicesLoadedOnce = true;
      const withInvoice = (data.orders || []).filter((o) => o.zohoSalesOrderNumber);
      const sig = JSON.stringify(withInvoice);
      if (silent && sig === lastInvoicesSig) return;
      lastInvoicesSig = sig;
      const open = silent ? openOrderIds(invoicesList) : new Set();
      if (!withInvoice.length) {
        invoicesList.innerHTML = "<p class='form-note'>No completed transactions yet &mdash; this fills in once an order is paid for.</p>";
        return;
      }
      invoicesList.innerHTML = "";
      withInvoice.forEach((o) => invoicesList.appendChild(buildOrderCard(o)));
      reopenOrders(invoicesList, open);
    } catch (err) {
      if (!silent) invoicesList.innerHTML = `<p class="acct-error">${err.message}</p>`;
    }
  }
  refreshInvoicesBtn.addEventListener("click", () => loadInvoices());

  // A simple 4-stage progress tracker built from what Zoho actually reports for a sales
  // order: our own local status (confirmed once payment clears) plus Zoho's live
  // shipped_status once a live lookup has succeeded. Failed orders get their own notice
  // instead, since "placed → confirmed → shipped" doesn't apply to them.
  function buildOrderStepper(o) {
    if (o.status === "failed") {
      return `<div class="acct-stepper-fail">This order could not be completed${o.note ? `: ${o.note}` : "."}</div>`;
    }
    const shipped = String(o.live?.shippedStatus || "").toLowerCase();
    const steps = [
      { label: "Order Placed", done: true },
      { label: "Confirmed", done: o.status === "confirmed" },
      { label: "Shipped", done: ["shipped", "fulfilled", "delivered"].includes(shipped) },
      { label: "Delivered", done: shipped === "delivered" },
    ];
    let currentIndex = 0;
    steps.forEach((s, i) => { if (s.done) currentIndex = i; });
    const stepsHtml = steps
      .map((s, i) => `
        <div class="acct-step${i <= currentIndex ? " is-done" : ""}${i === currentIndex ? " is-current" : ""}">
          <span class="acct-step-dot"></span>
          <span class="acct-step-label">${s.label}</span>
        </div>
      `)
      .join('<span class="acct-step-line"></span>');
    return `<div class="acct-stepper">${stepsHtml}</div>`;
  }

  // Each order card opens on click to reveal its items, live status and invoice — only the
  // order number, date and status badge show until then.
  function buildOrderCard(o) {
    const card = document.createElement("div");
    card.className = "acct-order-card2";
    card.dataset.orderId = o.id;
    const live = o.live;
    const statusLabel = live?.status || o.status;
    const itemCount = (o.items || []).reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
    const itemLines = (o.items || []).map((it) => `<div class="acct-order-item">${it.label || it.variantId} &times; ${it.qty}</div>`).join("");

    const head = document.createElement("button");
    head.type = "button";
    head.className = "acct-order-head2";
    head.innerHTML = `
      <div>
        <div class="acct-order-number">${o.zohoSalesOrderNumber || o.id}</div>
        <div class="acct-order-date">${fmtDate(o.placedAt)} &middot; ${itemCount} item${itemCount === 1 ? "" : "s"}${o.total ? ` &middot; ${fmtMoney(o.total)}` : ""}</div>
      </div>
      <div class="acct-order-head-right">
        <span class="acct-order-status is-${o.status}">${statusLabel}</span>
        <svg class="acct-order-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </div>
    `;

    const body = document.createElement("div");
    body.className = "acct-order-body";
    body.hidden = true;
    body.innerHTML = `
      ${buildOrderStepper(o)}
      <div class="acct-order-items">${itemLines}</div>
      ${live ? `<div class="acct-order-note">Shipped: ${live.shippedStatus || "-"} &middot; Invoiced: ${live.invoicedStatus || "-"}${live.total ? ` &middot; Total: ${fmtMoney(live.total)}` : ""}</div>` : ""}
      ${o.note ? `<div class="acct-order-note">${o.note}</div>` : ""}
    `;

    head.addEventListener("click", () => {
      body.hidden = !body.hidden;
      card.classList.toggle("is-open", !body.hidden);
    });

    card.appendChild(head);
    card.appendChild(body);

    if (o.zohoSalesOrderNumber) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "acct-link-btn";
      btn.textContent = "View Invoice";
      const invoiceArea = document.createElement("div");
      invoiceArea.className = "acct-invoice-area";
      let loaded = false;
      btn.addEventListener("click", async () => {
        if (loaded) {
          const isOpen = invoiceArea.classList.toggle("is-open");
          btn.textContent = isOpen ? "Hide Invoice" : "View Invoice";
          return;
        }
        btn.textContent = "Loading…";
        try {
          const res = await fetch(`/api/test-orders/${o.id}/invoice`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Could not load invoice");
          invoiceArea.appendChild(renderInvoiceBlock(data));
          invoiceArea.classList.add("is-open");
          loaded = true;
          btn.textContent = "Hide Invoice";
        } catch (err) {
          invoiceArea.innerHTML = `<p class="acct-error">${err.message}</p>`;
          invoiceArea.classList.add("is-open");
          loaded = true;
          btn.textContent = "View Invoice";
        }
      });
      body.appendChild(btn);
      body.appendChild(invoiceArea);
    }
    return card;
  }

  function renderInvoiceBlock(data) {
    const wrap = document.createElement("div");
    wrap.className = "acct-invoice-block";
    if (!data.invoice) {
      wrap.innerHTML = `<p class="form-note">${data.message || "No invoice has been raised for this order yet."}</p>`;
      return wrap;
    }
    const inv = data.invoice;
    const ew = data.ewaybill;
    wrap.innerHTML = `
      <div class="acct-invoice-row"><span>Invoice No.</span><strong>${inv.invoice_number || "-"}</strong></div>
      <div class="acct-invoice-row"><span>Date</span><strong>${fmtDate(inv.date)}</strong></div>
      <div class="acct-invoice-row"><span>Status</span><strong>${inv.status || "-"}</strong></div>
      <div class="acct-invoice-row"><span>Total</span><strong>${inv.total != null ? fmtMoney(inv.total) : "-"}</strong></div>
      <div class="acct-invoice-row"><span>Balance Due</span><strong>${inv.balance != null ? fmtMoney(inv.balance) : "-"}</strong></div>
      ${inv.invoice_url ? `<a class="acct-invoice-download" href="${String(inv.invoice_url).trim()}" target="_blank" rel="noopener">Open / Download Invoice &rarr;</a>` : ""}
      ${ew
        ? `<div class="acct-invoice-row"><span>E-Way Bill No.</span><strong>${ew.ewaybill_number || "-"}</strong></div>
           <div class="acct-invoice-row"><span>E-Way Bill Status</span><strong>${ew.status || "-"}</strong></div>`
        : `<p class="form-note">No e-way bill generated for this invoice yet.</p>`}
    `;
    return wrap;
  }

  // Everything on this page refreshes itself every 30s while it is visible and logged in, so
  // changes made in Zoho (profile, order status, invoices) appear without a manual reload.
  async function refreshAll() {
    if (document.hidden || !session.loggedIn) return;
    await loadProfile({ silent: true });
    loadOrders({ silent: true });
    if (invoicesLoadedOnce) loadInvoices({ silent: true });
  }
  setInterval(refreshAll, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshAll(); });

  loadSession();
})();
