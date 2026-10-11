// Dedicated "My Account" page: profile, order history and invoices in one place, reached
// from the header account icon. Uses the same TEMPORARY test-mode endpoints as the checkout
// flow in test-account.js (login/profile/orders are shared across both). Replace the login
// step with real MSG91 OTP once that's approved — everything else here stays the same.
(() => {
  const guestView = document.getElementById("acctGuestView");
  const dashboard = document.getElementById("acctDashboard");
  if (!guestView || !dashboard) return;

  const loginMobile = document.getElementById("acctLoginMobile");
  const loginBtn = document.getElementById("acctLoginBtn");
  const loginError = document.getElementById("acctLoginError");
  const avatar = document.getElementById("acctAvatar");
  const sidebarName = document.getElementById("acctSidebarName");
  const sidebarPhone = document.getElementById("acctSidebarPhone");
  const tabBtns = document.querySelectorAll(".acct-tab-btn");
  const panels = {
    dashboard: document.getElementById("acctPanelDashboard"),
    profile: document.getElementById("acctPanelProfile"),
    orders: document.getElementById("acctPanelOrders"),
    invoices: document.getElementById("acctPanelInvoices"),
  };
  const dashGreeting = document.getElementById("acctDashGreeting");
  const statTotal = document.getElementById("statTotal");
  const statPending = document.getElementById("statPending");
  const statConfirmed = document.getElementById("statConfirmed");
  const statInvoices = document.getElementById("statInvoices");
  const downloadOrdersBtn = document.getElementById("acctDownloadOrders");
  const logoutBtn = document.getElementById("acctLogoutBtn");
  const profileForm = document.getElementById("acctProfileForm");
  const profileError = document.getElementById("acctProfileError");
  const profileOk = document.getElementById("acctProfileOk");
  const profilePhone = document.getElementById("acctProfilePhone");
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
  }
  tabBtns.forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  document.querySelectorAll("[data-goto]").forEach((el) => {
    el.addEventListener("click", () => switchTab(el.dataset.goto));
  });

  function fillProfileForm(p) {
    if (!p) return;
    for (const [key, value] of Object.entries(p)) {
      const field = profileForm.elements[key];
      if (field) field.value = value;
    }
  }

  function updateSidebar() {
    const name = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : session.mobile;
    sidebarName.textContent = name || session.mobile;
    sidebarPhone.textContent = session.mobile;
    avatar.textContent = (profile?.firstName || session.mobile || "?").charAt(0).toUpperCase();
    profilePhone.value = session.mobile;
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
    const requestedTab = new URLSearchParams(location.search).get("tab");
    switchTab(requestedTab || "dashboard");
  }

  async function loadProfile() {
    try {
      const data = await fetch("/api/test-account").then((r) => r.json());
      profile = data.profile || null;
      if (profile) fillProfileForm(profile);
    } catch { profile = null; }
  }

  async function doLogin() {
    const mobile = loginMobile.value.replace(/\D/g, "").slice(-10);
    loginError.textContent = "";
    loginBtn.disabled = true;
    try {
      const res = await fetch("/api/test-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not log in");
      session = { loggedIn: true, mobile: data.mobile };
      profile = data.profile || null;
      if (profile) fillProfileForm(profile);
      updateSidebar();
      showDashboard();
      const requestedTab = new URLSearchParams(location.search).get("tab");
      switchTab(requestedTab || "dashboard");
    } catch (err) {
      loginError.textContent = err.message;
    } finally {
      loginBtn.disabled = false;
    }
  }
  loginBtn.addEventListener("click", doLogin);
  loginMobile.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });

  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    profileError.textContent = "";
    profileOk.textContent = "";
    const fd = new FormData(profileForm);
    const body = Object.fromEntries(fd.entries());
    try {
      const res = await fetch("/api/test-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save profile");
      profile = data.profile;
      const results = data.zoho || [];
      const failed = results.filter((r) => r.status === "error");
      profileOk.textContent = results.some((r) => r.status === "updated")
        ? "Saved and synced with your customer record."
        : "Saved.";
      if (failed.length) profileError.textContent = "Saved here, but syncing to our records failed. We'll retry on your next save.";
      updateSidebar();
    } catch (err) {
      profileError.textContent = err.message;
    }
  });

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

  async function loadOrders() {
    ordersList.innerHTML = "<p class='form-note'>Loading&hellip;</p>";
    try {
      const res = await fetch("/api/test-orders");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load orders");
      ordersLoadedOnce = true;
      allOrders = data.orders || [];
      renderOrders();
      updateDashboardStats();
    } catch (err) {
      ordersList.innerHTML = `<p class="acct-error">${err.message}</p>`;
    }
  }
  refreshBtn.addEventListener("click", loadOrders);

  function updateDashboardStats() {
    if (!statTotal) return;
    statTotal.textContent = String(allOrders.length);
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

  async function loadInvoices() {
    invoicesList.innerHTML = "<p class='form-note'>Loading&hellip;</p>";
    try {
      const res = await fetch("/api/test-orders");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load transaction history");
      invoicesLoadedOnce = true;
      const withInvoice = (data.orders || []).filter((o) => o.zohoSalesOrderNumber);
      if (!withInvoice.length) {
        invoicesList.innerHTML = "<p class='form-note'>No completed transactions yet &mdash; this fills in once an order is paid for.</p>";
        return;
      }
      invoicesList.innerHTML = "";
      withInvoice.forEach((o) => invoicesList.appendChild(buildOrderCard(o)));
    } catch (err) {
      invoicesList.innerHTML = `<p class="acct-error">${err.message}</p>`;
    }
  }
  refreshInvoicesBtn.addEventListener("click", loadInvoices);

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

  loadSession();
})();
