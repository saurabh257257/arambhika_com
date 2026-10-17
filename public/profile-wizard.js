// Profile set-up used in two places:
//   mode "wizard": step-by-step first sign-up (progress bar, 4 steps, saves as you go)
//   mode "form":   the same fields on one page, for editing later from My Account
//
//   const w = initProfileWizard(rootEl, { mode, onDone(profile, status), onSaved(profile, status, zoho) })
//   w.reload()  re-reads the profile from the server (skipped while the customer is typing)
//
// Steps: 1 Verify mobile (done by the OTP login)  2 Your details  3 Delivery address  4 GST.
// The server decides what is required; this file only mirrors it so errors show early.
(() => {
  const STEP_ORDER = ["mobile", "details", "address", "gst"];
  const STEP_LABELS = { mobile: "Verify mobile", details: "Your details", address: "Delivery address", gst: "GST" };

  let statesPromise = null;
  const loadStates = () => {
    if (!statesPromise) {
      statesPromise = fetch("/api/meta/states").then((r) => r.json()).then((d) => d.states || []).catch(() => []);
    }
    return statesPromise;
  };

  async function api(path, body) {
    const res = await fetch(path, body === undefined ? {} : {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  const el = (tag, attrs = {}, ...kids) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v == null) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null) node.append(kid.nodeType ? kid : document.createTextNode(kid));
    return node;
  };

  const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function initProfileWizard(root, { mode = "wizard", onDone, onSaved } = {}) {
    if (!root) return null;
    root.classList.add("wiz-root");

    let states = [];
    let profile = {};
    let status = { percent: 25, steps: [], complete: false };
    let current = "details";
    let finished = false;
    let busy = false;
    let gstCheck = null; // last result of the "Verify" button
    const draft = {};    // what the customer has typed but not saved yet

    const value = (key) => (draft[key] !== undefined ? draft[key] : profile[key] ?? "");

    function firstUnfinished() {
      const next = (status.steps || []).find((s) => !s.done);
      return next ? next.id : "gst";
    }

    // ---- shared pieces ----------------------------------------------------------------------
    function field(label, key, opts = {}) {
      const id = `wiz-${key}`;
      const input = el("input", {
        id, name: key, type: opts.type || "text", autocomplete: opts.autocomplete || "off",
        inputmode: opts.inputmode, maxlength: opts.maxlength, placeholder: opts.placeholder || "",
        class: "wiz-input",
      });
      input.value = value(key);
      if (opts.disabled) input.disabled = true;
      input.addEventListener("input", () => {
        draft[key] = opts.upper ? input.value.toUpperCase() : input.value;
        if (opts.upper) input.value = draft[key];
        if (opts.digitsOnly) { draft[key] = input.value.replace(/\D/g, ""); input.value = draft[key]; }
        clearError(key);
      });
      return el("div", { class: `wiz-field${opts.span ? " wiz-span" : ""}`, "data-field": key },
        el("label", { for: id }, label, opts.required ? el("span", { class: "wiz-req", text: " *" }) : null),
        input,
        el("div", { class: "wiz-err", "data-err": key }),
        opts.hint ? el("div", { class: "wiz-hint", text: opts.hint }) : null);
    }

    function stateSelect() {
      const select = el("select", { id: "wiz-state", name: "state", class: "wiz-input", autocomplete: "address-level1" },
        el("option", { value: "", text: "Select your state" }),
        states.map((s) => el("option", { value: s.name, text: s.name })));
      select.value = value("state");
      select.addEventListener("change", () => { draft.state = select.value; clearError("state"); });
      return el("div", { class: "wiz-field", "data-field": "state" },
        el("label", { for: "wiz-state" }, "State", el("span", { class: "wiz-req", text: " *" })),
        select,
        el("div", { class: "wiz-err", "data-err": "state" }));
    }

    const detailsFields = () => [
      el("div", { class: "wiz-grid" },
        field("First name", "firstName", { required: true, autocomplete: "given-name" }),
        field("Last name", "lastName", { required: true, autocomplete: "family-name" }),
        field("Email", "email", { required: true, type: "email", autocomplete: "email", span: true, hint: "Order updates and invoices are sent here." }),
        field("Mobile number", "phone", { disabled: true, span: true, hint: "Verified by OTP." })),
    ];

    const addressFields = () => [
      el("div", { class: "wiz-grid" },
        field("Shipping address", "address", { required: true, span: true, autocomplete: "street-address", placeholder: "House / building, street, area" }),
        stateSelect(),
        field("City", "city", { required: true, autocomplete: "address-level2" }),
        field("PIN code", "postalCode", { required: true, inputmode: "numeric", maxlength: 6, digitsOnly: true, autocomplete: "postal-code" })),
    ];

    function gstFields() {
      const has = value("hasGst") === true;
      const box = el("input", { type: "checkbox", id: "wiz-hasGst", class: "wiz-check" });
      box.checked = has;
      const detail = el("div", { class: "wiz-gst-detail" });
      const render = () => {
        detail.replaceChildren();
        if (!box.checked) return;
        const gstin = field("GST number (GSTIN)", "gstin", { upper: true, maxlength: 15, placeholder: "15-character GST number", span: true });
        const verifyBtn = el("button", { type: "button", class: "wiz-btn wiz-btn-ghost", text: "Verify" });
        const result = el("div", { class: "wiz-gst-result", "aria-live": "polite" });
        const paint = (r) => {
          result.className = "wiz-gst-result";
          result.replaceChildren();
          if (!r) {
            if (profile.gstin && profile.gstVerified && value("gstin") === profile.gstin) {
              r = { ok: true, verified: profile.gstVerified, legalName: profile.gstLegalName, tradeName: profile.gstTradeName };
            } else return;
          }
          if (r.ok) {
            result.classList.add("is-ok");
            result.append(el("strong", { text: r.verified === "verified" ? "✓ Verified" : "✓ Number is valid" }));
            if (r.legalName) result.append(el("div", { text: `${r.legalName}${r.tradeName && r.tradeName !== r.legalName ? ` (${r.tradeName})` : ""}` }));
            if (r.state) result.append(el("div", { class: "wiz-hint", text: `Registered in ${r.state}` }));
            if (r.message && r.verified !== "verified") result.append(el("div", { class: "wiz-hint", text: r.message }));
            if (r.stateMismatch) result.append(el("div", { class: "wiz-hint", text: "This GST registration is in a different state from your delivery address. That is fine." }));
          } else {
            result.classList.add("is-bad");
            result.append(el("strong", { text: r.message || "Could not verify this number." }));
          }
        };
        verifyBtn.addEventListener("click", async () => {
          const number = String(value("gstin") || "").trim();
          if (!GSTIN_RE.test(number)) { showError("gstin", "Enter the 15-character GST number first."); return; }
          verifyBtn.disabled = true;
          verifyBtn.textContent = "Checking…";
          const r = await api("/api/test-gst/verify", { gstin: number });
          verifyBtn.disabled = false;
          verifyBtn.textContent = "Verify";
          gstCheck = r.data;
          paint(r.data);
        });
        const row = el("div", { class: "wiz-gst-row" }, gstin, verifyBtn);
        detail.append(row, result);
        paint(gstCheck);
      };
      box.addEventListener("change", () => { draft.hasGst = box.checked; clearError("gstin"); render(); });
      render();
      return [
        el("label", { class: "wiz-checkrow", for: "wiz-hasGst" }, box,
          el("span", {}, el("strong", { text: "I have a GST number" }),
            el("span", { class: "wiz-hint", text: "Tick this to get business (GST) invoices. Leave it unticked if you buy as an individual." }))),
        detail,
      ];
    }

    // ---- errors and validation --------------------------------------------------------------
    function showError(key, message) {
      const holder = root.querySelector(`[data-err="${key}"]`);
      if (holder) { holder.textContent = message; holder.parentElement?.classList.add("has-error"); }
      else setBanner(message);
    }
    function clearError(key) {
      const holder = root.querySelector(`[data-err="${key}"]`);
      if (holder) { holder.textContent = ""; holder.parentElement?.classList.remove("has-error"); }
    }
    function setBanner(message, kind = "error") {
      const b = root.querySelector(".wiz-banner");
      if (!b) return;
      b.textContent = message || "";
      b.className = `wiz-banner${message ? ` is-${kind}` : ""}`;
    }

    function validate(stepIds) {
      let ok = true;
      const need = (key, message) => { if (!String(value(key) ?? "").trim()) { showError(key, message); ok = false; } };
      if (stepIds.includes("details")) {
        need("firstName", "Please enter your first name.");
        need("lastName", "Please enter your last name.");
        if (!String(value("email")).trim()) { showError("email", "Please enter your email."); ok = false; }
        else if (!EMAIL_RE.test(String(value("email")).trim())) { showError("email", "That email address does not look right."); ok = false; }
      }
      if (stepIds.includes("address")) {
        need("address", "Please enter your shipping address.");
        need("state", "Please choose your state.");
        need("city", "Please enter your city.");
        if (!String(value("postalCode")).trim()) { showError("postalCode", "Please enter your PIN code."); ok = false; }
        else if (!/^[1-9]\d{5}$/.test(String(value("postalCode")).trim())) { showError("postalCode", "PIN code is 6 digits."); ok = false; }
      }
      if (stepIds.includes("gst") && value("hasGst") === true) {
        const g = String(value("gstin") || "").trim();
        if (!g) { showError("gstin", "Enter your GST number, or untick the box."); ok = false; }
        else if (!GSTIN_RE.test(g)) { showError("gstin", "A GST number has 15 characters, for example 27AAAAA0000A1Z5."); ok = false; }
      }
      return ok;
    }

    const bodyFor = (stepIds) => {
      const body = {};
      const keys = [];
      if (stepIds.includes("details")) keys.push("firstName", "lastName", "email");
      if (stepIds.includes("address")) keys.push("address", "state", "city", "postalCode");
      for (const k of keys) body[k] = String(value(k) ?? "").trim();
      // firstName is required by the server on every save
      if (body.firstName === undefined) body.firstName = String(value("firstName") || profile.firstName || "").trim();
      if (stepIds.includes("gst")) {
        body.hasGst = value("hasGst") === true;
        if (body.hasGst) body.gstin = String(value("gstin") || "").trim();
      }
      return body;
    }

    async function save(stepIds) {
      if (busy) return false;
      setBanner("");
      if (!validate(stepIds)) return false;
      busy = true;
      paintButtons();
      const r = await api("/api/test-account", bodyFor(stepIds));
      busy = false;
      if (!r.ok) {
        if (r.data.field) showError(r.data.field, r.data.error);
        else setBanner(r.data.error || "We could not save that. Please try again.");
        paintButtons();
        return false;
      }
      profile = r.data.profile || profile;
      status = r.data.status || status;
      for (const k of Object.keys(draft)) delete draft[k];
      if (typeof onSaved === "function") onSaved(profile, status, r.data.zoho || []);
      return true;
    }

    // ---- rendering --------------------------------------------------------------------------
    function header() {
      const pct = Math.max(25, status.percent || 25);
      return el("div", { class: "wiz-head" },
        el("div", { class: "wiz-head-row" },
          el("div", { class: "wiz-title", text: mode === "wizard" ? "Set up your account" : "Your profile" }),
          el("div", { class: "wiz-pct", text: `${pct}% complete` })),
        el("div", { class: "wiz-bar", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": pct },
          el("div", { class: "wiz-bar-fill", style: `width:${pct}%` })));
    }

    function stepper() {
      const doneMap = Object.fromEntries((status.steps || []).map((s) => [s.id, s.done]));
      return el("ol", { class: "wiz-steps" }, STEP_ORDER.map((id, i) => {
        const isDone = id === "mobile" ? true : Boolean(doneMap[id]);
        const isCurrent = !finished && id === current;
        return el("li", { class: `wiz-step${isDone ? " is-done" : ""}${isCurrent ? " is-current" : ""}` },
          el("span", { class: "wiz-dot", text: isDone ? "✓" : String(i + 1) }),
          el("span", { class: "wiz-step-label", text: STEP_LABELS[id] }));
      }));
    }

    function render() {
      root.replaceChildren();
      root.append(header());
      if (mode === "wizard" && !finished) root.append(stepper());
      root.append(el("div", { class: "wiz-banner", role: "alert" }));

      if (finished) {
        root.append(el("div", { class: "wiz-done" },
          el("div", { class: "wiz-done-icon", text: "✓" }),
          el("h3", { text: `You're all set${profile.firstName ? `, ${profile.firstName}` : ""}!` }),
          el("p", { text: "Your details are saved. You can place orders now." }),
          el("button", { type: "button", class: "wiz-btn wiz-btn-primary", text: "Continue", onclick: () => onDone && onDone(profile, status) })));
        return;
      }

      const form = el("form", { class: "wiz-form", novalidate: true });
      form.addEventListener("submit", (e) => { e.preventDefault(); primary(); });
      const sections = mode === "form" ? ["details", "address", "gst"] : [current];
      for (const id of sections) {
        const title = { details: "Your details", address: "Delivery address", gst: "GST details" }[id];
        const lead = {
          details: "Tell us who the order is for.",
          address: "Where should we deliver your orders?",
          gst: "Buying for a business? Add your GST number for tax invoices.",
        }[id];
        form.append(el("section", { class: "wiz-section" },
          el("h3", { class: "wiz-section-title", text: title }),
          el("p", { class: "wiz-lead", text: lead }),
          id === "details" ? detailsFields() : id === "address" ? addressFields() : gstFields()));
      }
      form.append(el("div", { class: "wiz-actions" }));
      root.append(form);
      paintButtons();
      const firstInput = form.querySelector("input:not([disabled]), select");
      if (firstInput && mode === "wizard") setTimeout(() => firstInput.focus({ preventScroll: true }), 50);
    }

    function paintButtons() {
      const actions = root.querySelector(".wiz-actions");
      if (!actions) return;
      actions.replaceChildren();
      if (mode === "form") {
        actions.append(el("button", { type: "submit", class: "wiz-btn wiz-btn-primary", disabled: busy, text: busy ? "Saving…" : "Save changes" }));
        return;
      }
      const idx = STEP_ORDER.indexOf(current);
      if (idx > 1) actions.append(el("button", { type: "button", class: "wiz-btn wiz-btn-ghost", text: "Back", onclick: () => go(STEP_ORDER[idx - 1]) }));
      const last = current === "gst";
      actions.append(el("button", { type: "submit", class: "wiz-btn wiz-btn-primary", disabled: busy,
        text: busy ? "Saving…" : last ? "Finish" : "Continue" }));
    }

    function go(step) { current = step; render(); }

    async function primary() {
      if (mode === "form") {
        const ok = await save(["details", "address", "gst"]);
        if (ok) { setBanner("Saved. Your details are up to date.", "ok"); paintButtons(); }
        return;
      }
      if (!(await save([current]))) return;
      const idx = STEP_ORDER.indexOf(current);
      if (current === "gst") { finished = true; render(); return; }
      go(STEP_ORDER[idx + 1]);
    }

    // ---- loading ----------------------------------------------------------------------------
    async function reload({ force = false } = {}) {
      // Do not redraw under someone who is typing.
      if (!force && root.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if (!force && Object.keys(draft).length) return;
      const r = await api("/api/test-account");
      if (!r.ok) return;
      const before = JSON.stringify([profile, status]);
      profile = { ...(r.data.profile || {}), phone: (r.data.profile && r.data.profile.phone) || profile.phone };
      status = r.data.status || status;
      if (JSON.stringify([profile, status]) !== before) {
        if (mode === "wizard" && !finished) current = firstUnfinished();
        render();
      }
    }

    (async () => {
      states = await loadStates();
      const r = await api("/api/test-account");
      profile = (r.ok && r.data.profile) || {};
      status = (r.ok && r.data.status) || status;
      const me = await fetch("/api/test-auth/me").then((x) => x.json()).catch(() => ({}));
      if (me.mobile) profile.phone = me.mobile;
      current = firstUnfinished();
      // A wizard opened for an already finished profile just shows the last step.
      if (mode === "wizard" && status.complete && status.percent === 100) finished = false;
      render();
    })();

    return { reload, setMode: undefined, get status() { return status; }, get profile() { return profile; } };
  }

  window.initProfileWizard = initProfileWizard;
})();
