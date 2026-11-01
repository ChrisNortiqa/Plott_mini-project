(() => {
  const $ = s => document.querySelector(s);
  function message(text, error = true) {
    const el = $("#message");
    if (el) {
      el.textContent = text;
      el.style.color = error ? "var(--red)" : "var(--green)";
    }
  }

  const roleSelect = $("#demoRole");
  const login = $("#loginForm");
  if (login) login.addEventListener("submit", e => {
    e.preventDefault();
    const email = $("#email").value.trim().toLowerCase() || "demo@plott.app";
    const role = roleSelect?.value || "Student";
    const name = email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || "Demo Student";
    // Demo session is stored locally in this browser; it does not authenticate against Supabase.
    localStorage.setItem("plottDemoSession", JSON.stringify({
      id: "plott-demo-user",
      email,
      full_name: name,
      role,
      theme: "light"
    }));
    location.href = "index.html";
  });

  const register = $("#registerForm");
  if (register) register.addEventListener("submit", e => {
    e.preventDefault();
    message("Online account registration will be available after Supabase is configured. You can use Sign in to enter demo mode.", true);
  });
})();