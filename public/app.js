const app = document.getElementById("app");

const state = {
  token: localStorage.getItem("menstrumateToken"),
  role: localStorage.getItem("menstrumateRole") || "user",
  account: null,
  view: "dashboard",
  products: [],
  categories: [],
  cart: [],
  payment: null,
  yoga: [],
  yogaTimers: {}
};

const navItems = [
  ["dashboard", "Dashboard"],
  ["symptoms", "Symptoms"],
  ["shop", "Shop"],
  ["cart", "Cart"],
  ["diet", "AI Diet Plan"],
  ["yoga", "Yoga"],
  ["doctors", "Doctors"],
  ["profile", "Profile"],
  ["education", "Education"]
];

const hashView = window.location.hash.replace("#", "");
if (navItems.some(([id]) => id === hashView)) {
  state.view = hashView;
}

function api(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  });
}

function money(value) {
  return `INR ${Number(value || 0).toFixed(0)}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setSession(token, role, account) {
  state.token = token;
  state.role = role;
  state.account = account;
  localStorage.setItem("menstrumateToken", token);
  localStorage.setItem("menstrumateRole", role);
}

function logout() {
  state.token = null;
  state.account = null;
  localStorage.removeItem("menstrumateToken");
  localStorage.removeItem("menstrumateRole");
  renderLanding();
}

function showMessage(id, message, isError = false) {
  const box = document.getElementById(id);
  if (!box) return;
  box.className = `notice${isError ? " error" : ""}`;
  box.textContent = message;
}

function renderLanding() {
  app.innerHTML = `
    <section class="landing minimal-landing page">
      <nav class="landing-nav">
        <div class="landing-logo">Menstru<span>Mate</span></div>
        <div class="landing-nav-actions">
          <button class="nav-login" id="loginTopBtn">Login</button>
          <button class="nav-signup" id="signupTopBtn">Sign Up</button>
        </div>
      </nav>

      <div class="landing-ambient landing-ambient-one"></div>
      <div class="landing-ambient landing-ambient-two"></div>

      <div class="landing-hero-content">
        <div class="landing-badge">Smart Wellness Companion</div>
        <h1>Menstrumate</h1>
        <div class="title-accent"></div>
        <p class="landing-subtitle">Your personal menstrual wellness companion</p>
        <p class="landing-copy">Track your cycle, understand your body, and move through every phase with calm, personalized care.</p>
        <div class="landing-actions">
          <button class="btn landing-primary" id="getStartedBtn">Get Started</button>
          <button class="btn secondary landing-secondary" id="loginEntryBtn">Login</button>
        </div>
      </div>
    </section>
  `;
  document.getElementById("getStartedBtn").addEventListener("click", () => {
    renderAuth("signup", "user");
  });
  document.getElementById("loginEntryBtn").addEventListener("click", () => {
    window.location.href = "/select-role.html";
  });
  document.getElementById("loginTopBtn").addEventListener("click", () => {
    window.location.href = "/select-role.html";
  });
  document.getElementById("signupTopBtn").addEventListener("click", () => {
    renderAuth("signup", "user");
  });
}

function renderAuth(mode, role) {
  const isSignup = mode === "signup";
  const roleLabel = role === "doctor" ? "Doctor" : "User";
  app.innerHTML = `
    <section class="auth-wrap page">
      <div class="auth-card">
        <button class="btn ghost" id="backHome">Back</button>
        <p class="landing-kicker">${isSignup ? "Create account" : "Welcome back"}</p>
        <h1>${isSignup ? "Create" : "Login to"} ${roleLabel} Account</h1>
        <form id="authForm" class="form-grid">
          ${isSignup ? `
            <label class="field"><span>Name</span><input id="name" required></label>
          ` : ""}
          <label class="field"><span>Email</span><input id="email" type="email" required></label>
          ${isSignup ? `
            <label class="field"><span>OTP</span><input id="otp" required></label>
            <label class="field"><span>Password</span><input id="password" type="password" minlength="6" required></label>
            <label class="field"><span>Confirm Password</span><input id="confirmPassword" type="password" minlength="6" required></label>
            ${role === "doctor" ? `
              <label class="field"><span>Specialty</span><input id="specialty" value="Gynecology"></label>
              <label class="field"><span>Clinic</span><input id="clinic" value="Menstrumate Clinic"></label>
            ` : `
              <label class="field"><span>Cycle Length</span><input id="cycleLength" type="number" min="20" max="40" value="28"></label>
              <label class="field"><span>Last Period Date</span><input id="lastPeriod" type="date" required></label>
            `}
          ` : `
            <label class="field"><span>Password</span><input id="password" type="password" required></label>
          `}
          <div class="field full btn-row">
            ${isSignup ? `<button class="btn secondary" type="button" id="otpBtn">Generate OTP</button>` : ""}
            <button class="btn" type="submit">${isSignup ? "Complete Signup" : "Login"}</button>
          </div>
        </form>
        <div id="authMessage"></div>
      </div>
    </section>
  `;
  document.getElementById("backHome").addEventListener("click", () => {
    if (!isSignup) window.location.href = "/select-role.html";
    else renderLanding();
  });
  const dateInput = document.getElementById("lastPeriod");
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  const otpBtn = document.getElementById("otpBtn");
  if (otpBtn) {
    otpBtn.addEventListener("click", async () => {
      try {
        const email = document.getElementById("email").value;
        const data = await api("/api/auth/request-otp", {
          method: "POST",
          body: JSON.stringify({ email, role })
        });
        showMessage("authMessage", `Your OTP is ${data.otp}. Enter it to finish signup.`);
      } catch (err) {
        showMessage("authMessage", err.message, true);
      }
    });
  }
  document.getElementById("authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = {
      role,
      email: document.getElementById("email").value,
      password: document.getElementById("password").value
    };
    if (isSignup) {
      Object.assign(body, {
        name: document.getElementById("name").value,
        otp: document.getElementById("otp").value,
        confirmPassword: document.getElementById("confirmPassword").value,
        specialty: document.getElementById("specialty")?.value,
        clinic: document.getElementById("clinic")?.value,
        cycleLength: document.getElementById("cycleLength")?.value,
        lastPeriod: document.getElementById("lastPeriod")?.value
      });
    }
    try {
      const data = await api(`/api/auth/${isSignup ? "signup" : "login"}`, {
        method: "POST",
        body: JSON.stringify(body)
      });
      setSession(data.token, role, data.account);
      if (role === "doctor") {
        window.location.href = "/doctor-dashboard.html";
        return;
      }
      state.view = role === "doctor" ? "doctors" : "dashboard";
      await renderApp();
    } catch (err) {
      showMessage("authMessage", err.message, true);
    }
  });
}

async function renderApp() {
  if (!state.token) return renderLanding();
  if (!state.account) {
    try {
      const data = await api("/api/me");
      state.account = data.account;
    } catch {
      return logout();
    }
  }
  if (state.account.role === "doctor") {
    window.location.href = "/doctor-dashboard.html";
    return;
  }
  app.innerHTML = `
    <section class="shell page">
      <aside class="sidebar">
        <div class="brand">Menstrumate</div>
        <div class="muted">${escapeHtml(state.account.name)} (${state.role})</div>
        <hr>
        ${navItems.map(([id, label]) => `<button class="nav-btn ${state.view === id ? "active" : ""}" data-view="${id}">${label}</button>`).join("")}
        <button class="nav-btn" id="logoutBtn">Logout</button>
      </aside>
      <section class="content">
        <div class="topbar">
          <div class="section-title" id="title"></div>
          <button class="btn secondary" id="refreshBtn">Refresh</button>
        </div>
        <div id="view"></div>
      </section>
    </section>
  `;
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.view = button.dataset.view;
      history.replaceState(null, "", `#${state.view}`);
      await renderApp();
    });
  });
  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("refreshBtn").addEventListener("click", () => loadView());
  await loadView();
}

async function loadView() {
  const loaders = {
    dashboard: renderDashboard,
    symptoms: renderSymptomsLink,
    shop: renderShop,
    cart: renderCart,
    diet: renderDiet,
    yoga: renderYoga,
    doctors: renderDoctors,
    profile: renderProfile,
    education: renderEducation
  };
  await loaders[state.view]();
}

async function renderSymptomsLink() {
  window.location.href = "/symptoms.html";
}

function setTitle(title, subtitle) {
  document.getElementById("title").innerHTML = `<h2>${title}</h2><p>${subtitle}</p>`;
}

function renderPainBars(trend = []) {
  return trend.length ? `
    <div class="pain-bars mini">
      ${trend.slice(-14).map((entry) => `<div class="pain-bar ${Number(entry.painLevel) > 8 ? "danger" : ""}" style="height:${Math.max(8, Number(entry.painLevel) * 10)}%"><span>${escapeHtml(entry.painLevel)}</span></div>`).join("")}
    </div>
  ` : `<p class="muted">No pain trend yet.</p>`;
}

function renderFrequencyBadges(frequency = []) {
  return frequency.length ? `
    <div class="symptom-badges">
      ${frequency.slice(0, 8).map((item) => `<span>${escapeHtml(item.symptom)} (${escapeHtml(item.count)})</span>`).join("")}
    </div>
  ` : `<p class="muted">No symptom frequency yet.</p>`;
}

function maybeShowDailyCheckin(latestSymptom) {
  const todayText = new Date().toISOString().slice(0, 10);
  const dismissed = localStorage.getItem(`menstrumateCheckin:${todayText}`);
  if (latestSymptom?.date === todayText || dismissed) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" id="checkinModal">
      <section class="appointment-modal">
        <button class="modal-close" id="dismissCheckin">x</button>
        <p class="landing-kicker">Daily check-in</p>
        <h2>How are you feeling today?</h2>
        <p class="muted">A quick symptom log keeps predictions and recommendations personal.</p>
        <div class="btn-row">
          <button class="btn" id="goCheckin">Log symptoms</button>
          <button class="btn secondary" id="skipCheckin">Later</button>
        </div>
      </section>
    </div>
  `);
  const close = () => {
    localStorage.setItem(`menstrumateCheckin:${todayText}`, "dismissed");
    document.getElementById("checkinModal")?.remove();
  };
  document.getElementById("goCheckin").addEventListener("click", () => {
    window.location.href = "/symptoms.html";
  });
  document.getElementById("skipCheckin").addEventListener("click", close);
  document.getElementById("dismissCheckin").addEventListener("click", close);
}

async function renderDashboard() {
  setTitle("Dashboard", "Personalized predictions, insights, and live account data.");
  const view = document.getElementById("view");
  if (state.role === "doctor") {
    view.innerHTML = `<div class="panel"><h3>Doctor profile is active</h3><p class="muted">Users can now see your profile in their doctor list.</p></div>`;
    return;
  }
  const [cycleData, notices, symptomData, analyticsData, insightData] = await Promise.all([
    api("/api/cycle"),
    api("/api/notifications"),
    api(`/api/symptoms/${state.account.id}`),
    api(`/api/analytics/${state.account.id}`),
    api("/api/insights", { method: "POST", body: "{}" })
  ]);
  const { insights, cycle } = cycleData;
  const latestSymptom = symptomData.symptoms?.[0];
  const analytics = analyticsData.analytics;
  view.innerHTML = `
    <div class="grid premium-metrics">
      <div class="panel metric glass-card"><span class="muted">Next Period</span><strong>${insights.nextPeriod}</strong></div>
      <div class="panel metric glass-card"><span class="muted">Ovulation</span><strong>${insights.ovulation}</strong></div>
      <div class="panel metric glass-card"><span class="muted">Today’s Phase</span><strong>${escapeHtml(insights.todayPhase)}</strong></div>
      <div class="panel metric glass-card"><span class="muted">Confidence</span><strong>${escapeHtml(insights.predictionConfidence)}%</strong></div>
    </div>
    ${insights.irregularCycle ? `<div class="notice error">Irregular cycle pattern detected. Prediction confidence is adjusted from your past cycle history.</div>` : ""}
    <div class="grid" style="margin-top:16px">
      <div class="panel">
        <h3>Expected Symptoms</h3>
        ${renderFrequencyBadges((cycleData.expectedSymptoms || []).map((symptom) => ({ symptom, count: "phase" })))}
      </div>
      <div class="panel">
        <h3>Recommended Actions</h3>
        ${(cycleData.recommendedActions || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
      </div>
    </div>
    <div class="panel flow-panel" style="margin-top:16px">
      <h3>Period Alert Setup</h3>
      <form id="cycleForm" class="form-grid">
        <label class="field"><span>Last Period Start</span><input id="cycleDate" type="date" value="${cycle[0].date}" required></label>
        <label class="field"><span>Cycle Length</span><input id="cycleLength" type="number" min="20" max="40" value="${cycle.length}" required></label>
        <div class="field"><span>&nbsp;</span><button class="btn">Save Cycle</button></div>
      </form>
    </div>
    <div class="panel reminders-panel" style="margin-top:16px">
      <h3>Smart Reminders</h3>
      ${notices.messages.map((msg) => `<p>${escapeHtml(msg)}</p>`).join("")}
    </div>
    <div class="panel" style="margin-top:16px">
      <h3>Today's Symptoms</h3>
      ${latestSymptom ? `
        <p class="muted">${escapeHtml(latestSymptom.date)}${latestSymptom.sharedWithDoctor ? " &middot; Shared with doctor" : " &middot; Private"}</p>
        <p><strong>${(latestSymptom.symptoms || []).map(escapeHtml).join(", ")}</strong></p>
        <p>Pain level: <strong>${escapeHtml(latestSymptom.painLevel)}/10</strong></p>
        ${latestSymptom.notes ? `<p>${escapeHtml(latestSymptom.notes)}</p>` : ""}
      ` : `<p class="muted">No symptoms logged yet.</p>`}
    </div>
    <div class="grid" style="margin-top:16px">
      <div class="panel">
        <h3>Pain Trend</h3>
        ${renderPainBars(analytics.painTrend)}
      </div>
      <div class="panel">
        <h3>Symptom Frequency</h3>
        ${renderFrequencyBadges(analytics.frequency)}
      </div>
    </div>
    <div class="panel" style="margin-top:16px">
      <h3>AI Insights</h3>
      <div class="grid">
        ${insightData.insights.map((item) => `
          <article class="diet-day">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.message)}</span>
            <span class="muted">${escapeHtml(item.action)}</span>
          </article>
        `).join("")}
      </div>
    </div>
    <div class="panel calendar-panel" style="margin-top:16px">
      <h3>Cycle Calendar</h3>
      <div class="calendar">${cycle.map((day) => `<div class="day ${day.phase}"><strong>Day ${day.day}</strong><br>${day.date}<br>${day.phase}</div>`).join("")}</div>
    </div>
  `;
  document.getElementById("cycleForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await api("/api/cycle", {
      method: "POST",
      body: JSON.stringify({
        lastPeriod: document.getElementById("cycleDate").value,
        cycleLength: document.getElementById("cycleLength").value
      })
    });
    await renderDashboard();
  });
  maybeShowDailyCheckin(latestSymptom);
}

async function getProductsAndCart() {
  const [productData, cartData] = await Promise.all([api("/api/products"), api("/api/cart")]);
  state.products = productData.products;
  state.categories = productData.categories;
  state.cart = cartData.items;
}

async function renderShop() {
  setTitle("Shop", "Products are loaded from the backend and added to your stored cart.");
  const [productData, cartData] = await Promise.all([api("/api/products"), api("/api/cart")]);
  state.products = productData.products;
  state.categories = productData.categories;
  state.cart = cartData.items;
  const active = sessionStorage.getItem("category") || "All";
  const products = active === "All" ? state.products : state.products.filter((product) => product.category === active);
  document.getElementById("view").innerHTML = `
    ${productData.recommendations?.length ? `
      <div class="panel smart-shop-panel">
        <h3>Recommended for your recent symptoms</h3>
        <div class="symptom-badges">${productData.recommendations.map((product) => `<span>${escapeHtml(product.name)}</span>`).join("")}</div>
      </div>
    ` : ""}
    <div class="shop-tools">
      <select id="categorySelect">
        ${["All", ...state.categories].map((cat) => `<option ${cat === active ? "selected" : ""}>${cat}</option>`).join("")}
      </select>
      <button class="btn secondary" id="goCart">Cart (${state.cart.reduce((sum, item) => sum + item.quantity, 0)})</button>
    </div>
    <div class="grid shop-grid">
      ${products.map((product) => `
        <article class="product">
          <img src="${product.image}" alt="${escapeHtml(product.name)}">
          <div class="product-body">
            <p class="muted">${escapeHtml(product.category)}</p>
            <h3>${escapeHtml(product.name)}</h3>
            <strong>${money(product.price)}</strong>
            <div style="margin-top:12px"><button class="btn add-cart-btn" data-add="${product.id}">Add to Cart</button></div>
          </div>
        </article>
      `).join("")}
    </div>
  `;
  document.getElementById("categorySelect").addEventListener("change", (event) => {
    sessionStorage.setItem("category", event.target.value);
    renderShop();
  });
  document.getElementById("goCart").addEventListener("click", async () => {
    state.view = "cart";
    await renderApp();
  });
  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.classList.add("is-adding");
      button.textContent = "Added";
      await api("/api/cart/items", { method: "POST", body: JSON.stringify({ productId: button.dataset.add, quantity: 1 }) });
      await renderShop();
    });
  });
}

async function renderCart() {
  setTitle("Cart", "Update quantities, remove items, and checkout with exact amount QR.");
  await getProductsAndCart();
  const rows = state.cart.map((entry) => ({ ...state.products.find((product) => product.id === entry.productId), quantity: entry.quantity }));
  const total = rows.reduce((sum, item) => sum + item.price * item.quantity, 0);
  document.getElementById("view").innerHTML = `
    <section class="checkout cart-layout">
      <div class="cart-list">
        ${rows.length ? rows.map((item) => `
          <div class="cart-row">
            <img class="cart-thumb" src="${item.image}" alt="${escapeHtml(item.name)}">
            <div><strong>${escapeHtml(item.name)}</strong><br><span class="muted">${money(item.price)} each</span></div>
            <div class="qty">
              <button class="icon-btn" data-dec="${item.id}">-</button>
              <strong>${item.quantity}</strong>
              <button class="icon-btn" data-inc="${item.id}">+</button>
            </div>
            <strong>${money(item.price * item.quantity)}</strong>
            <button class="btn secondary" data-remove="${item.id}">Remove</button>
          </div>
        `).join("") : `<div class="panel">Your cart is empty.</div>`}
      </div>
      <aside class="panel cart-summary">
        <h3>Total</h3>
        <strong style="font-size:32px">${money(total)}</strong>
        <button class="btn" id="checkoutBtn" ${rows.length ? "" : "disabled"} style="width:100%;margin-top:16px">Checkout</button>
        <div id="paymentBox"></div>
      </aside>
    </section>
  `;
  document.querySelectorAll("[data-inc], [data-dec]").forEach((button) => {
    button.addEventListener("click", async () => {
      const productId = button.dataset.inc || button.dataset.dec;
      const item = state.cart.find((entry) => entry.productId === productId);
      const quantity = item.quantity + (button.dataset.inc ? 1 : -1);
      await api(`/api/cart/items/${productId}`, { method: "PATCH", body: JSON.stringify({ quantity }) });
      await renderCart();
    });
  });
  document.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/api/cart/items/${button.dataset.remove}`, { method: "DELETE" });
      await renderCart();
    });
  });
  document.getElementById("checkoutBtn").addEventListener("click", async () => {
    const data = await api("/api/checkout", { method: "POST", body: "{}" });
    state.payment = data.payment;
    document.getElementById("paymentBox").innerHTML = `
      <hr>
      <h3>Scan to Pay</h3>
      <img class="qr" src="${state.payment.qrCode}" alt="Payment QR">
      <p>Exact amount: <strong>${money(state.payment.amount)}</strong></p>
      <button class="btn teal" id="paidBtn">I Paid</button>
    `;
    document.getElementById("paidBtn").addEventListener("click", async () => {
      await api(`/api/payments/${state.payment.id}/confirm`, { method: "POST", body: "{}" });
      state.payment = null;
      await renderCart();
    });
  });
}

async function renderDiet() {
  setTitle("AI Diet Plan", "Rule-based seven day plan based on your symptoms.");
  document.getElementById("view").innerHTML = `
    <div class="panel">
      <form id="dietForm" class="form-grid">
        <label class="field full"><span>Symptoms</span><textarea id="symptoms" placeholder="bloating, cramps, weakness"></textarea></label>
        <button class="btn">Generate 7-Day Plan</button>
      </form>
    </div>
    <div id="dietResult" class="grid" style="margin-top:16px"></div>
  `;
  document.getElementById("dietForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = await api("/api/diet-plan", {
      method: "POST",
      body: JSON.stringify({ symptoms: document.getElementById("symptoms").value })
    });
    document.getElementById("dietResult").innerHTML = data.plan.map((day) => `
      <div class="diet-day">
        <strong>Day ${day.day} - ${day.protein}</strong>
        <span>Breakfast: ${escapeHtml(day.breakfast)}</span>
        <span>Lunch: ${escapeHtml(day.lunch)}</span>
        <span>Snack: ${escapeHtml(day.snack)}</span>
        <span>Dinner: ${escapeHtml(day.dinner)}</span>
      </div>
    `).join("");
  });
}

async function renderYoga() {
  setTitle("Yoga + Exercise", "Guided poses with real visuals, instructions, and start-stop timers.");
  const data = await api("/api/yoga");
  state.yoga = data.yoga;
  document.getElementById("view").innerHTML = `
    <div class="grid yoga-grid">
      ${data.yoga.map((pose) => `
        <article class="yoga-card">
          <button class="yoga-media-btn" data-open-pose="${pose.id}">
            <img class="yoga-photo" src="${pose.image}" alt="${escapeHtml(pose.name)}">
            <span>View Guide</span>
          </button>
          <h3>${escapeHtml(pose.name)}</h3>
          <p class="muted">${escapeHtml(pose.instructions)}</p>
          <strong data-timer-id="${pose.id}">${pose.duration}s</strong>
          <div class="btn-row" style="margin-top:12px">
            <button class="btn" data-start="${pose.id}" data-duration="${pose.duration}">Start</button>
            <button class="btn secondary" data-stop="${pose.id}">Stop</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;
  document.querySelectorAll("[data-start]").forEach((button) => {
    button.addEventListener("click", () => startTimer(button.dataset.start, Number(button.dataset.duration)));
  });
  document.querySelectorAll("[data-stop]").forEach((button) => {
    button.addEventListener("click", () => stopTimer(button.dataset.stop));
  });
  document.querySelectorAll("[data-open-pose]").forEach((button) => {
    button.addEventListener("click", () => openYogaDetail(button.dataset.openPose));
  });
}

function startTimer(id, duration) {
  stopTimer(id);
  let remaining = duration;
  updateTimerText(id, `${remaining}s`);
  state.yogaTimers[id] = setInterval(() => {
    remaining -= 1;
    updateTimerText(id, remaining > 0 ? `${remaining}s` : "Done");
    if (remaining <= 0) stopTimer(id);
  }, 1000);
}

function stopTimer(id) {
  if (state.yogaTimers[id]) clearInterval(state.yogaTimers[id]);
  delete state.yogaTimers[id];
}

function updateTimerText(id, text) {
  document.querySelectorAll(`[data-timer-id="${id}"]`).forEach((node) => {
    node.textContent = text;
  });
}

function openYogaDetail(id) {
  const pose = state.yoga.find((item) => item.id === id);
  if (!pose) return;
  const steps = [
    "Settle into the pose with slow breathing.",
    pose.instructions,
    "Hold softly and release tension with each exhale."
  ];
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop yoga-modal-backdrop" id="yogaModal">
      <section class="yoga-detail-modal">
        <button class="modal-close" id="closeYoga">x</button>
        <div class="yoga-detail-image animated-yoga-guide">
          <div class="figure ${escapeHtml(pose.animation || "wave")}"></div>
        </div>
        <div class="yoga-detail-body">
          <p class="muted">Guided movement</p>
          <h2>${escapeHtml(pose.name)}</h2>
          <ol class="yoga-steps" id="yogaSteps">
            ${steps.map((step, index) => `<li class="${index === 0 ? "active" : ""}">${escapeHtml(step)}</li>`).join("")}
          </ol>
          <div class="yoga-timer-display" data-timer-id="${pose.id}">${pose.duration}s</div>
          <div class="btn-row">
            <button class="btn" id="detailStart">Start Flow</button>
            <button class="btn secondary" id="detailStop">Stop</button>
          </div>
        </div>
      </section>
    </div>
  `);
  document.getElementById("closeYoga").addEventListener("click", closeYogaDetail);
  document.getElementById("yogaModal").addEventListener("click", (event) => {
    if (event.target.id === "yogaModal") closeYogaDetail();
  });
  document.getElementById("detailStart").addEventListener("click", () => {
    startTimer(pose.id, Number(pose.duration));
    startYogaStepFlow(steps.length, Number(pose.duration));
  });
  document.getElementById("detailStop").addEventListener("click", () => stopTimer(pose.id));
}

function closeYogaDetail() {
  document.getElementById("yogaModal")?.remove();
}

function startYogaStepFlow(totalSteps, duration) {
  const nodes = [...document.querySelectorAll("#yogaSteps li")];
  if (!nodes.length) return;
  let index = 0;
  const stepDuration = Math.max(2, Math.floor(duration / totalSteps));
  const mark = () => {
    nodes.forEach((node, nodeIndex) => node.classList.toggle("active", nodeIndex === index));
    index = Math.min(index + 1, totalSteps - 1);
  };
  mark();
  const interval = setInterval(() => {
    if (!document.getElementById("yogaModal")) return clearInterval(interval);
    mark();
    if (index === totalSteps - 1) clearInterval(interval);
  }, stepDuration * 1000);
}

async function renderDoctors() {
  setTitle("Doctors", "Choose a doctor and start a private saved chat.");
  const data = await api("/api/doctors");
  document.getElementById("view").innerHTML = `
    <div class="doctor-directory">
      ${data.doctors.length ? data.doctors.map((doctor) => `
        <article class="doctor-profile-card">
          <div class="doctor-avatar">${escapeHtml(doctor.initials || "DR")}</div>
          <div class="doctor-profile-body">
            <p class="muted">Menstrumate Doctor</p>
            <span class="status-badge ${doctor.isOnline ? "online" : "offline"}">${doctor.isOnline ? "Online" : "Offline"}</span>
            <h3>${escapeHtml(doctor.name)}</h3>
            <p><strong>${escapeHtml(doctor.specialty || "Gynecology")}</strong></p>
            <p class="muted">${escapeHtml(doctor.clinic || "Clinic not added")}</p>
            <p class="doctor-email">${escapeHtml(doctor.email)}</p>
          </div>
          <div class="btn-row">
            <button class="btn doctor-chat-btn" data-chat-doctor="${doctor.id}">Chat</button>
            <button class="btn secondary" data-book-doctor="${doctor.id}" data-doctor-name="${escapeHtml(doctor.name)}">Schedule Appointment</button>
          </div>
        </article>
      `).join("") : `<div class="panel">No doctors have signed up yet. Create a doctor account from the landing page to populate this list.</div>`}
    </div>
  `;
  document.querySelectorAll("[data-chat-doctor]").forEach((button) => {
    button.addEventListener("click", () => {
      window.location.href = `/chat.html?doctorId=${encodeURIComponent(button.dataset.chatDoctor)}`;
    });
  });
  document.querySelectorAll("[data-book-doctor]").forEach((button) => {
    button.addEventListener("click", () => openAppointmentModal(button.dataset.bookDoctor, button.dataset.doctorName));
  });
}

function openAppointmentModal(doctorId, doctorName) {
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" id="appointmentModal">
      <section class="appointment-modal">
        <button class="modal-close" id="closeAppointment">x</button>
        <p class="landing-kicker">Appointment</p>
        <h2>Schedule with ${doctorName}</h2>
        <form id="appointmentForm" class="stack-form">
          <label class="field"><span>Date</span><input id="appointmentDate" type="date" required></label>
          <label class="field"><span>Time slot</span><select id="appointmentTime" required></select></label>
          <button class="btn">Confirm Booking</button>
          <div id="appointmentMessage"></div>
        </form>
      </section>
    </div>
  `);
  document.getElementById("appointmentDate").value = new Date().toISOString().slice(0, 10);
  const loadSlots = async () => {
    const select = document.getElementById("appointmentTime");
    select.innerHTML = `<option value="">Loading...</option>`;
    try {
      const data = await api(`/api/appointment-slots/${doctorId}?date=${encodeURIComponent(document.getElementById("appointmentDate").value)}`);
      select.innerHTML = data.slots.map((slot) => `<option value="${slot.time}" ${slot.available ? "" : "disabled"}>${slot.time}${slot.available ? "" : " - booked"}</option>`).join("");
    } catch (err) {
      select.innerHTML = `<option value="">Slots unavailable</option>`;
    }
  };
  document.getElementById("closeAppointment").addEventListener("click", closeAppointmentModal);
  document.getElementById("appointmentDate").addEventListener("change", loadSlots);
  document.getElementById("appointmentModal").addEventListener("click", (event) => {
    if (event.target.id === "appointmentModal") closeAppointmentModal();
  });
  document.getElementById("appointmentForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.getElementById("appointmentMessage");
    try {
      await api("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          doctorId,
          date: document.getElementById("appointmentDate").value,
          time: document.getElementById("appointmentTime").value
        })
      });
      message.className = "notice";
      message.textContent = "Appointment scheduled.";
    } catch (err) {
      message.className = "notice error";
      message.textContent = err.message;
    }
  });
  loadSlots();
}

function closeAppointmentModal() {
  document.getElementById("appointmentModal")?.remove();
}

async function renderEducation() {
  setTitle("Education", "Menstruation info, health tips, and basic sex education from the API.");
  const data = await api("/api/education");
  document.getElementById("view").innerHTML = `
    <div class="grid">
      ${data.education.map((item) => `
        <article class="edu-card">
          <p class="muted">${escapeHtml(item.topic)}</p>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.body)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

async function renderProfile() {
  setTitle("Profile + History", "Cycle history, symptom trends, and generated wellness reports.");
  const [data, appointmentData] = await Promise.all([
    api("/api/profile/history"),
    api(`/api/appointments/user/${state.account.id}`)
  ]);
  document.getElementById("view").innerHTML = `
    <div class="grid">
      <section class="panel">
        <h3>Cycle History</h3>
        <div class="timeline">
          ${data.cycleHistory.length ? data.cycleHistory.slice().reverse().map((item) => `
            <div><strong>${escapeHtml(item.startDate)}</strong><br><span>${escapeHtml(item.cycleLength || "Calculated")} day cycle</span></div>
          `).join("") : `<p class="muted">No cycle history yet.</p>`}
        </div>
      </section>
      <section class="panel">
        <h3>Symptom Trends</h3>
        ${renderFrequencyBadges(data.symptomAnalytics.frequency)}
        ${renderPainBars(data.symptomAnalytics.painTrend)}
      </section>
      <section class="panel">
        <h3>Appointments</h3>
        <div class="appointment-list">
          ${appointmentData.appointments.length ? appointmentData.appointments.map((item) => `
            <article class="appointment-row">
              <strong>${escapeHtml(item.date)} ${escapeHtml(item.time)}</strong>
              <span>${escapeHtml(item.doctor?.name || "Doctor")}</span>
              <small>${escapeHtml(item.status)}</small>
              ${item.status === "scheduled" ? `<button class="btn secondary" data-cancel-user-appt="${escapeHtml(item.appointmentId)}">Cancel</button>` : ""}
            </article>
          `).join("") : `<p class="muted">No appointments yet.</p>`}
        </div>
      </section>
    </div>
    <section class="panel" style="margin-top:16px">
      <h3>Reports</h3>
      <div class="grid">
        ${data.reports.map((item) => `
          <article class="diet-day">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.message)}</span>
            <span class="muted">${escapeHtml(item.action)}</span>
          </article>
        `).join("")}
      </div>
    </section>
  `;
  document.querySelectorAll("[data-cancel-user-appt]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/api/appointments/${button.dataset.cancelUserAppt}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" })
      });
      await renderProfile();
    });
  });
}

const entryParams = new URLSearchParams(window.location.search);
const entryMode = entryParams.get("auth");
const entryRole = entryParams.get("role");

if (!state.token && ["login", "signup"].includes(entryMode) && ["user", "doctor"].includes(entryRole)) {
  renderAuth(entryMode, entryRole);
} else if (state.token) {
  renderApp();
} else {
  renderLanding();
}
