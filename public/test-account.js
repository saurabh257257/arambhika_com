// TEMPORARY test-mode login + checkout UI. Loads after script.js, reusing its cart helpers
// (getOrder, clearOrder, renderOrderList, cachedCatalog) as plain globals — classic scripts
// in one page share a global scope. Replace once real MSG91 OTP login is wired up.
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
    orders: document.getElementById("testStepOrders"),
  };
  const mobileInput = document.getElementById("testMobileInput");
  const loginBtn = document.getElementById("testLoginBtn");
  const loginError = document.getElementById("testLoginError");
  const accountMobile = document.getElementById("testAccountMobile");
  const profileForm = document.getElementById("testProfileForm");
  const profileError = document.getElementById("testProfileError");
  const profileOk = document.getElementById("testProfileOk");
  const myOrdersBtn = document.getElementById("testMyOrdersBtn");
  const logoutBtn = document.getElementById("testLogoutBtn");
  const backBtn = document.getElementById("testBackToAccount");
  const ordersList = document.getElementById("testOrdersList");
  const closeBtn = document.getElementById("testAcctClose");

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
  function setProceedDisabled(disabled) {
    proceedButtons.forEach(({ btn }) => { btn.disabled = disabled; });
  }

  function updateHeaderAndProceed() {
    navBtn.classList.toggle("is-logged-in", session.loggedIn);
    navBtn.title = session.loggedIn ? `Account (${session.mobile})` : "Account";
    if (!session.loggedIn) {
      setProceedDisabled(false);
      setProceedNote("Log in to proceed with your order.");
    } else if (!profile) {
      setProceedDisabled(false);
      setProceedNote("Add your delivery address to proceed.");
    } else {
      setProceedDisabled(false);
      setProceedNote(`Logged in as ${session.mobile}.`);
    }
  }

  async function loadSession() {
    try {
      session = await fetch("/api/test-auth/me").then((r) => r.json());
    } catch { session = { loggedIn: false }; }
    if (session.loggedIn) await loadProfile();
    updateHeaderAndProceed();
  }

  async function loadProfile() {
    try {
      const data = await fetch("/api/test-account").then((r) => r.json());
      profile = data.profile || null;
      if (profile) fillProfileForm(profile);
    } catch { profile = null; }
  }

  function fillProfileForm(p) {
    if (!profileForm) return;
    for (const [key, value] of Object.entries(p)) {
      const field = profileForm.elements[key];
      if (field) field.value = value;
    }
  }

  navBtn.addEventListener("click", () => {
    if (session.loggedIn) {
      accountMobile.textContent = session.mobile;
      openModal("account");
    } else {
      loginError.textContent = "";
      openModal("login");
    }
  });

  loginBtn.addEventListener("click", async () => {
    const mobile = mobileInput.value.replace(/\D/g, "").slice(-10);
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
      await loadProfile();
      updateHeaderAndProceed();

      if (resumeProceedAfterLogin) {
        resumeProceedAfterLogin = false;
        continueProceed();
      } else {
        accountMobile.textContent = session.mobile;
        showStep("account");
      }
    } catch (err) {
      loginError.textContent = err.message;
    } finally {
      loginBtn.disabled = false;
    }
  });

  profileForm?.addEventListener("submit", async (e) => {
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
      updateHeaderAndProceed();

      if (resumeProceedAfterProfile) {
        resumeProceedAfterProfile = false;
        continueProceed();
      }
    } catch (err) {
      profileError.textContent = err.message;
    }
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

  const fmtMoney = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

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
  function onProceedClick() {
    const order = typeof getOrder === "function" ? getOrder() : {};
    if (!Object.keys(order).length) {
      setProceedNote("Add at least one item to your quote first.");
      return;
    }
    if (!session.loggedIn) {
      resumeProceedAfterLogin = true;
      loginError.textContent = "";
      openModal("login");
      return;
    }
    if (!profile) {
      resumeProceedAfterProfile = true;
      accountMobile.textContent = session.mobile;
      openModal("account");
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
    setProceedNote("Placing your order…");
    try {
      const res = await fetch("/api/test-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not place your order");
      if (typeof clearOrder === "function") clearOrder();
      setProceedNote(`Order placed: ${data.salesOrderNumber}`);
    } catch (err) {
      setProceedNote(err.message);
    } finally {
      setProceedDisabled(false);
    }
  }

  loadSession();
})();
