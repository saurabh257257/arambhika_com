// Mobile-number + OTP sign up / log in, shared by the My Account page and the checkout modal.
//   initOtpLogin(containerEl, { buttonClass, onSuccess(data) })
// onSuccess receives the server's verify response: { mobile, profile, cart, isNew }.
(() => {
  function initOtpLogin(root, { buttonClass = "button", onSuccess } = {}) {
    if (!root) return;
    root.innerHTML = `
      <div data-otp-step="mobile">
        <label>Mobile Number
          <input type="tel" data-otp-mobile maxlength="10" inputmode="numeric" autocomplete="tel-national" placeholder="10-digit mobile number" />
        </label>
        <button type="button" class="${buttonClass} otp-wide" data-otp-send>Send OTP</button>
      </div>
      <div data-otp-step="code" hidden>
        <p class="form-note">We sent a code to <strong data-otp-sent-to></strong>
          <button type="button" class="otp-link" data-otp-change>Change</button></p>
        <label>One-time password
          <input type="text" class="otp-code-input" data-otp-code inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="------" />
        </label>
        <button type="button" class="${buttonClass} otp-wide" data-otp-verify>Verify &amp; continue</button>
        <p class="form-note"><button type="button" class="otp-link" data-otp-resend disabled>Resend OTP</button></p>
      </div>
      <p class="acct-error" data-otp-error></p>
    `;
    const $ = (sel) => root.querySelector(sel);
    const stepMobile = $('[data-otp-step="mobile"]');
    const stepCode = $('[data-otp-step="code"]');
    const mobileInput = $("[data-otp-mobile]");
    const sendBtn = $("[data-otp-send]");
    const codeInput = $("[data-otp-code]");
    const verifyBtn = $("[data-otp-verify]");
    const resendBtn = $("[data-otp-resend]");
    const changeBtn = $("[data-otp-change]");
    const sentTo = $("[data-otp-sent-to]");
    const errorEl = $("[data-otp-error]");

    let otpLength = 6;
    let mobile = "";
    let resendTimer = null;
    let verifying = false;

    fetch("/api/test-auth/config").then((r) => r.json()).then((c) => {
      if (c.otpLength) otpLength = c.otpLength;
      codeInput.maxLength = otpLength;
      codeInput.placeholder = "-".repeat(otpLength);
    }).catch(() => {});

    const setError = (msg) => { errorEl.textContent = msg || ""; };
    const digits = (v) => String(v || "").replace(/\D/g, "");

    async function post(path, body) {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      return data;
    }

    function startResendCountdown(seconds = 30) {
      clearInterval(resendTimer);
      let left = seconds;
      resendBtn.disabled = true;
      resendBtn.textContent = `Resend OTP in ${left}s`;
      resendTimer = setInterval(() => {
        left -= 1;
        if (left <= 0) {
          clearInterval(resendTimer);
          resendBtn.disabled = false;
          resendBtn.textContent = "Resend OTP";
        } else {
          resendBtn.textContent = `Resend OTP in ${left}s`;
        }
      }, 1000);
    }

    async function sendOtp({ resend = false } = {}) {
      setError("");
      mobile = digits(mobileInput.value).slice(-10);
      if (!/^[6-9]\d{9}$/.test(mobile)) { setError("Please enter a valid 10-digit mobile number."); return; }
      sendBtn.disabled = true;
      resendBtn.disabled = true;
      try {
        const data = await post("/api/test-auth/send-otp", { mobile, resend });
        if (data.testMode) { await verify(""); return; } // test build: no OTP to type
        sentTo.textContent = `+91 ${mobile}`;
        stepMobile.hidden = true;
        stepCode.hidden = false;
        codeInput.value = "";
        codeInput.focus();
        startResendCountdown();
      } catch (err) {
        setError(err.message);
        if (resend) { resendBtn.disabled = false; }
      } finally {
        sendBtn.disabled = false;
      }
    }

    async function verify(code) {
      if (verifying) return;
      verifying = true;
      setError("");
      verifyBtn.disabled = true;
      try {
        const data = await post("/api/test-auth/verify-otp", { mobile, otp: code });
        clearInterval(resendTimer);
        if (typeof onSuccess === "function") await onSuccess(data);
        reset();
      } catch (err) {
        setError(err.message);
        codeInput.select();
      } finally {
        verifying = false;
        verifyBtn.disabled = false;
      }
    }

    function reset() {
      clearInterval(resendTimer);
      stepCode.hidden = true;
      stepMobile.hidden = false;
      codeInput.value = "";
      setError("");
    }

    sendBtn.addEventListener("click", () => sendOtp());
    mobileInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendOtp(); });
    mobileInput.addEventListener("input", () => { mobileInput.value = digits(mobileInput.value).slice(0, 10); });
    resendBtn.addEventListener("click", () => sendOtp({ resend: true }));
    changeBtn.addEventListener("click", () => { reset(); mobileInput.focus(); });
    verifyBtn.addEventListener("click", () => {
      const code = digits(codeInput.value);
      if (code.length !== otpLength) { setError(`Enter the ${otpLength}-digit OTP.`); return; }
      verify(code);
    });
    codeInput.addEventListener("input", () => {
      codeInput.value = digits(codeInput.value).slice(0, otpLength);
      if (codeInput.value.length === otpLength) verify(codeInput.value); // submits itself when complete
    });
    codeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") verifyBtn.click(); });
  }

  window.initOtpLogin = initOtpLogin;
})();
