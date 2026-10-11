// Shows the logged-in customer's name on the header account icon, on every page that isn't
// index.html (which drives the same icon from test-account.js, alongside its checkout modal).
// Clicking the icon always goes straight to the dedicated My Account page — this script only
// needs to know whether someone's logged in and what to call them, nothing else.
(() => {
  const navBtn = document.getElementById("testAcctBtn");
  if (!navBtn) return;
  const nameEl = document.getElementById("testAcctName");

  fetch("/api/test-auth/me")
    .then((r) => r.json())
    .then((session) => {
      navBtn.classList.toggle("is-logged-in", !!session.loggedIn);
      if (!session.loggedIn) return;
      navBtn.title = `Account (${session.mobile})`;
      return fetch("/api/test-account")
        .then((r) => r.json())
        .then((data) => {
          if (nameEl && data.profile?.firstName) nameEl.textContent = data.profile.firstName;
        });
    })
    .catch(() => {});
})();
