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
  const panels = { profile: document.getElementById("acctPanelProfile"), orders: document.getElementById("acctPanelOrders") };
  const logoutBtn = document.getElementById("acctLogoutBtn");
  const profileForm = document.getElementById("acctProfileForm");
  const profileError = document.getElementById("acctProfileError");
  const profileOk = document.getElementById("acctProfileOk");
  const profilePhone = document.getElementById("acctProfilePhone");
  const ordersList = document.getElementById("acctOrdersList");
  const refreshBtn = document.getElementById("acctRefreshOrders");

  let session = { loggedIn: false, mobile: "" };
  let profile = null;
  let ordersLoadedOnce = false;

  const showGuest = () => { guestView.hidden = false; dashboard.hidden = true; };
  const showDashboard = () => { guestView.hidden = true; dashboard.hidden = false; };

  function switchTab(name) {
    tabBtns.forEach((b) => b.classList.toggle("is-active", b.dataset.tab === name));
    Object.entries(panels).forEach(([key, el]) => { if (el) el.hidden = key !== name; });
    if (name === "orders" && !ordersLoadedOnce) loadOrders();
  }
  tabBtns.forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

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
  }

  async function loadSession() {
    try {
      session = await fetch("/api/test-auth/me").then((r) => r.json());
    } catch { session = { loggedIn: false }; }
    if (!session.loggedIn) { showGuest(); return; }
    await loadProfile();
    updateSidebar();
    showDashboard();
    switchTab("profile");
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
      switchTab("profile");
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
      profileOk.textContent = "Saved.";
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
    showGuest();
  });

  const fmtMoney = (n) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (d) => {
    try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
    catch { return d || ""; }
  };

  async function loadOrders() {
    ordersList.innerHTML = "<p class='form-note'>Loading&hellip;</p>";
    try {
      const res = await fetch("/api/test-orders");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load orders");
      ordersLoadedOnce = true;
      renderOrders(data.orders || []);
    } catch (err) {
      ordersList.innerHTML = `<p class="acct-error">${err.message}</p>`;
    }
  }
  refreshBtn.addEventListener("click", loadOrders);

  function renderOrders(orders) {
    if (!orders.length) {
      ordersList.innerHTML = "<p class='form-note'>No orders yet &mdash; place your first order from the Store.</p>";
      return;
    }
    ordersList.innerHTML = "";
    orders.forEach((o) => ordersList.appendChild(buildOrderCard(o)));
  }

  function buildOrderCard(o) {
    const card = document.createElement("div");
    card.className = "acct-order-card2";
    const live = o.live;
    const statusLabel = live?.status || o.status;
    const itemLines = (o.items || []).map((it) => `<div class="acct-order-item">${it.label || it.variantId} &times; ${it.qty}</div>`).join("");
    card.innerHTML = `
      <div class="acct-order-head2">
        <div>
          <div class="acct-order-number">${o.zohoSalesOrderNumber || o.id}</div>
          <div class="acct-order-date">${fmtDate(o.placedAt)}</div>
        </div>
        <span class="acct-order-status is-${o.status}">${statusLabel}</span>
      </div>
      <div class="acct-order-items">${itemLines}</div>
      ${live ? `<div class="acct-order-note">Shipped: ${live.shippedStatus || "-"} &middot; Invoiced: ${live.invoicedStatus || "-"}${live.total ? ` &middot; Total: ${fmtMoney(live.total)}` : ""}</div>` : ""}
      ${o.note ? `<div class="acct-order-note">${o.note}</div>` : ""}
    `;
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
      card.appendChild(btn);
      card.appendChild(invoiceArea);
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
      ${ew
        ? `<div class="acct-invoice-row"><span>E-Way Bill No.</span><strong>${ew.ewaybill_number || "-"}</strong></div>
           <div class="acct-invoice-row"><span>E-Way Bill Status</span><strong>${ew.status || "-"}</strong></div>`
        : `<p class="form-note">No e-way bill generated for this invoice yet.</p>`}
    `;
    return wrap;
  }

  loadSession();
})();
