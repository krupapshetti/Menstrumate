const app = document.getElementById("app");

const state = {
  token: localStorage.getItem("menstrumateToken"),
  role: localStorage.getItem("menstrumateRole") || "user",
  account: null,
  view: "dashboard",
  products: [],
  categories: [],
  recommendations: [],
  cart: [],
  payment: null,
  yoga: [],
  yogaTimers: {},
  communityTimer: null,
  communityRoom: localStorage.getItem("menstrumateCommunityRoom") || "General Chat",
  ambientAudio: null,
  notificationTimer: null
};

const navItems = [
  ["dashboard", "Dashboard"],
  ["symptoms", "Symptoms"],
  ["shop", "Shop"],
  ["cart", "Cart"],
  ["diet", "AI Diet Plan"],
  ["yoga", "Yoga"],
  ["doctors", "Doctors"],
  ["entertainment", "Entertainment"],
  ["community", "Community"],
  ["profile", "Profile"],
  ["education", "Education"]
];

const hashView = window.location.hash.replace("#", "");
if (navItems.some(([id]) => id === hashView)) {
  state.view = hashView;
} else if (["/cart", "/checkout", "/cart.html", "/checkout.html"].includes(window.location.pathname)) {
  state.view = "cart";
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

function cartStorageKey() {
  return `menstrumateCart:${state.account?.id || "guest"}`;
}

function normalizeCartItems(items = [], products = state.products) {
  const merged = new Map();
  items.forEach((entry) => {
    const productId = entry.productId || entry.id;
    const product = products.find((item) => item.id === productId) || entry;
    if (!productId || !product?.name) return;
    const existing = merged.get(productId);
    merged.set(productId, {
      productId,
      id: productId,
      name: product.name,
      price: Number(product.price) || 0,
      image: product.image || "",
      category: product.category || "",
      quantity: Math.max(1, Number(entry.quantity) || 1) + (existing?.quantity || 0)
    });
  });
  return [...merged.values()];
}

function saveLocalCart(items) {
  localStorage.setItem(cartStorageKey(), JSON.stringify(normalizeCartItems(items)));
}

function getLocalCart() {
  try {
    return normalizeCartItems(JSON.parse(localStorage.getItem(cartStorageKey()) || "[]"));
  } catch (err) {
    localStorage.removeItem(cartStorageKey());
    return [];
  }
}

function clearLocalCart() {
  localStorage.removeItem(cartStorageKey());
}

function setSession(token, role, account) {
  state.token = token;
  state.role = role;
  state.account = account;
  localStorage.setItem("menstrumateToken", token);
  localStorage.setItem("menstrumateRole", role);
}

function logout() {
  stopCommunityPolling();
  stopNotificationPolling();
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

function notificationStorageKey() {
  return `menstrumateNotifications:${state.account?.id || "guest"}`;
}

function readStoredNotifications() {
  try {
    return JSON.parse(localStorage.getItem(notificationStorageKey()) || "[]");
  } catch (err) {
    localStorage.removeItem(notificationStorageKey());
    return [];
  }
}

function saveStoredNotifications(items) {
  localStorage.setItem(notificationStorageKey(), JSON.stringify(items.slice(0, 40)));
}

function notificationCategory(message) {
  const text = String(message || "").toLowerCase();
  if (text.includes("community") || text.includes("replied") || text.includes("post")) return "Community";
  if (text.includes("cycle") || text.includes("period") || text.includes("pain") || text.includes("ovulation")) return "Health";
  if (text.includes("water") || text.includes("hydrate") || text.includes("stretch") || text.includes("exercise")) return "Reminder";
  return "Wellness";
}

function notificationIcon(category) {
  return {
    Health: "H",
    Wellness: "W",
    Community: "C",
    Reminder: "R"
  }[category] || "N";
}

function addInAppNotification(message, category = notificationCategory(message), options = {}) {
  const text = String(message || "").trim();
  if (!text) return null;
  const items = readStoredNotifications();
  const today = new Date().toISOString().slice(0, 10);
  const fingerprint = `${today}:${category}:${text}`;
  if (items.some((item) => item.fingerprint === fingerprint)) return null;
  const notification = {
    id: `note_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    fingerprint,
    message: text,
    category,
    read: false,
    createdAt: new Date().toISOString()
  };
  saveStoredNotifications([notification, ...items]);
  updateNotificationBell();
  if (options.toast !== false) showNotificationToast(notification);
  return notification;
}

async function refreshSmartNotifications(options = {}) {
  if (!state.token || !state.account) return;
  try {
    const data = await api("/api/notifications");
    (data.messages || []).forEach((message) => addInAppNotification(message, notificationCategory(message), options));
  } catch (err) {
    // Notification refresh should never block the current page.
  }
  addLocalReminderNotifications(options);
  renderNotificationDropdown();
}

function addLocalReminderNotifications(options = {}) {
  const hour = new Date().getHours();
  if (hour >= 10 && hour <= 19) {
    addInAppNotification("Hydration reminder: take a few sips of water.", "Reminder", options);
  }
  if (hour >= 15 && hour <= 21) {
    addInAppNotification("Take a short stretch break.", "Wellness", options);
  }
  let moods = [];
  try {
    moods = JSON.parse(localStorage.getItem("menstrumateMoodHistory") || "[]");
  } catch {
    localStorage.removeItem("menstrumateMoodHistory");
  }
  const latestMood = moods[moods.length - 1];
  if (latestMood && ["Sad", "Angry", "Tired", "Stressed"].includes(latestMood.mood)) {
    addInAppNotification(`Mood check-in noted: ${latestMood.mood}. Try one gentle self-care action.`, "Wellness", options);
  }
  addInAppNotification("Check your community space for supportive replies and interactions.", "Community", { toast: false });
}

function updateNotificationBell() {
  const count = readStoredNotifications().filter((item) => !item.read).length;
  const badge = document.getElementById("notificationBadge");
  if (!badge) return;
  badge.textContent = count > 9 ? "9+" : String(count);
  badge.hidden = count === 0;
}

function renderNotificationDropdown() {
  const list = document.getElementById("notificationList");
  if (!list) return;
  const items = readStoredNotifications();
  list.innerHTML = items.length ? items.slice(0, 10).map((item) => `
    <article class="notification-menu-item ${item.read ? "read" : "unread"}">
      <span class="notification-category ${escapeHtml(item.category)}">${notificationIcon(item.category)}</span>
      <div>
        <strong>${escapeHtml(item.category)}</strong>
        <p>${escapeHtml(item.message)}</p>
        <small>${new Date(item.createdAt).toLocaleString()}</small>
      </div>
      ${item.read ? "" : `<button class="mark-read-btn" data-read-note="${escapeHtml(item.id)}">Read</button>`}
    </article>
  `).join("") : `<p class="muted">No notifications yet.</p>`;
  document.querySelectorAll("[data-read-note]").forEach((button) => {
    button.addEventListener("click", () => markNotificationRead(button.dataset.readNote));
  });
  updateNotificationBell();
}

function markNotificationRead(id) {
  const items = readStoredNotifications().map((item) => item.id === id ? { ...item, read: true } : item);
  saveStoredNotifications(items);
  renderNotificationDropdown();
}

function markAllNotificationsRead() {
  saveStoredNotifications(readStoredNotifications().map((item) => ({ ...item, read: true })));
  renderNotificationDropdown();
}

function showNotificationToast(notification) {
  let stack = document.getElementById("toastStack");
  if (!stack) {
    document.body.insertAdjacentHTML("beforeend", `<div class="toast-stack" id="toastStack"></div>`);
    stack = document.getElementById("toastStack");
  }
  const toastId = `toast_${notification.id}`;
  stack.insertAdjacentHTML("beforeend", `
    <article class="app-toast ${escapeHtml(notification.category)}" id="${toastId}">
      <span class="notification-category ${escapeHtml(notification.category)}">${notificationIcon(notification.category)}</span>
      <div>
        <strong>${escapeHtml(notification.category)}</strong>
        <p>${escapeHtml(notification.message)}</p>
      </div>
      <button class="toast-close" data-toast-close="${toastId}">x</button>
    </article>
  `);
  const toast = document.getElementById(toastId);
  toast.querySelector("[data-toast-close]").addEventListener("click", () => toast.remove());
  setTimeout(() => toast?.classList.add("is-hiding"), 4600);
  setTimeout(() => toast?.remove(), 5200);
}

function maybeShowUnreadToastOnce() {
  const key = `menstrumateToastSeen:${state.account?.id}:${new Date().toISOString().slice(0, 10)}`;
  if (sessionStorage.getItem(key)) return;
  const firstUnread = readStoredNotifications().find((item) => !item.read);
  if (!firstUnread) return;
  sessionStorage.setItem(key, "shown");
  showNotificationToast(firstUnread);
}

function setupNotificationBell() {
  const bell = document.getElementById("notificationBell");
  const menu = document.getElementById("notificationMenu");
  if (!bell || !menu) return;
  bell.addEventListener("click", (event) => {
    event.stopPropagation();
    menu.hidden = !menu.hidden;
    renderNotificationDropdown();
    if (!menu.hidden) {
      setTimeout(() => {
        document.addEventListener("click", (clickEvent) => {
          if (!clickEvent.target.closest(".notification-hub")) menu.hidden = true;
        }, { once: true });
      }, 0);
    }
  });
  document.getElementById("markAllRead").addEventListener("click", markAllNotificationsRead);
  updateNotificationBell();
}

function startNotificationPolling() {
  stopNotificationPolling();
  state.notificationTimer = setInterval(() => {
    refreshSmartNotifications({ toast: true });
  }, 90000);
}

function stopNotificationPolling() {
  if (state.notificationTimer) clearInterval(state.notificationTimer);
  state.notificationTimer = null;
}

function renderLanding() {
  app.innerHTML = `
    <section class="landing minimal-landing page">
      <div class="landing-ambient landing-ambient-one"></div>
      <div class="landing-ambient landing-ambient-two"></div>

      <div class="landing-hero-content">
        <h1>Menstrumate</h1>
        <div class="title-accent"></div>
        <p class="landing-subtitle">Your personal menstrual wellness companion</p>
        <p class="landing-copy">Track cycles, symptoms, care, and doctor support in one calm wellness space.</p>
        <div class="landing-actions">
          <button class="btn landing-primary" id="getStartedBtn">Get Started</button>
          <button class="btn secondary landing-secondary" id="loginEntryBtn">Login</button>
        </div>
      </div>
    </section>
  `;
  document.getElementById("getStartedBtn").addEventListener("click", () => {
    window.location.href = "/select-role.html";
  });
  document.getElementById("loginEntryBtn").addEventListener("click", () => {
    window.location.href = "/select-role.html?mode=login";
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
      if (isSignup || data.account?.isFirstLogin) {
        window.location.href = "/symptoms.html?onboarding=1";
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
  if (state.account.isFirstLogin && !window.location.pathname.endsWith("/symptoms.html")) {
    window.location.href = "/symptoms.html?onboarding=1";
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
          <div class="topbar-actions">
            <div class="notification-hub">
              <button class="notification-bell" id="notificationBell" aria-label="Open notifications">
                <span aria-hidden="true">&#128276;</span>
                <strong id="notificationBadge" hidden>0</strong>
              </button>
              <div class="notification-menu" id="notificationMenu" hidden>
                <div class="notification-menu-head">
                  <strong>Notifications</strong>
                  <button class="mark-read-btn" id="markAllRead">Mark all read</button>
                </div>
                <div id="notificationList"></div>
              </div>
            </div>
            <button class="btn secondary" id="refreshBtn">Refresh</button>
          </div>
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
  document.getElementById("refreshBtn").addEventListener("click", async () => {
    await refreshSmartNotifications({ toast: true });
    await loadView();
  });
  setupNotificationBell();
  await refreshSmartNotifications({ toast: false });
  maybeShowUnreadToastOnce();
  startNotificationPolling();
  await loadView();
}

async function loadView() {
  if (state.view !== "community") stopCommunityPolling();
  if (state.view !== "entertainment") stopAmbientSound();
  const loaders = {
    dashboard: renderDashboard,
    symptoms: renderSymptomsLink,
    shop: renderShop,
    cart: renderCart,
    diet: renderDiet,
    yoga: renderYoga,
    doctors: renderDoctors,
    notifications: renderNotifications,
    entertainment: renderEntertainment,
    community: renderCommunity,
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
  state.recommendations = productData.recommendations || [];
  let backendCart = normalizeCartItems(cartData.items, state.products);
  const localCart = normalizeCartItems(getLocalCart(), state.products);
  if (!backendCart.length && localCart.length) {
    for (const item of localCart) {
      await api("/api/cart/items", {
        method: "POST",
        body: JSON.stringify({ productId: item.productId, quantity: item.quantity })
      });
    }
    const restored = await api("/api/cart");
    backendCart = normalizeCartItems(restored.items, state.products);
  }
  state.cart = backendCart;
  saveLocalCart(state.cart);
}

async function renderShop() {
  setTitle("Shop", "Products are loaded from the backend and added to your stored cart.");
  await getProductsAndCart();
  const active = sessionStorage.getItem("category") || "All";
  const products = active === "All" ? state.products : state.products.filter((product) => product.category === active);
  document.getElementById("view").innerHTML = `
    ${state.recommendations?.length ? `
      <div class="panel smart-shop-panel">
        <h3>Recommended for your recent symptoms</h3>
        <div class="symptom-badges">${state.recommendations.map((product) => `<span>${escapeHtml(product.name)}</span>`).join("")}</div>
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
      const product = state.products.find((item) => item.id === button.dataset.add);
      if (product) {
        state.cart = normalizeCartItems([...state.cart, { ...product, productId: product.id, quantity: 1 }], state.products);
        saveLocalCart(state.cart);
      }
      const data = await api("/api/cart/items", { method: "POST", body: JSON.stringify({ productId: button.dataset.add, quantity: 1 }) });
      state.cart = normalizeCartItems(data.items, state.products);
      saveLocalCart(state.cart);
      await renderShop();
    });
  });
}

async function renderCart() {
  setTitle("Cart", "Update quantities, remove items, and checkout with exact amount QR.");
  await getProductsAndCart();
  const rows = normalizeCartItems(state.cart, state.products);
  state.cart = rows;
  saveLocalCart(state.cart);
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
        <p class="muted">Your checkout will use these exact saved cart items.</p>
      </aside>
    </section>
    <div id="paymentBox"></div>
  `;
  document.querySelectorAll("[data-inc], [data-dec]").forEach((button) => {
    button.addEventListener("click", async () => {
      const productId = button.dataset.inc || button.dataset.dec;
      const item = state.cart.find((entry) => entry.productId === productId);
      const quantity = item.quantity + (button.dataset.inc ? 1 : -1);
      const data = await api(`/api/cart/items/${productId}`, { method: "PATCH", body: JSON.stringify({ quantity }) });
      state.cart = normalizeCartItems(data.items, state.products);
      saveLocalCart(state.cart);
      await renderCart();
    });
  });
  document.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", async () => {
      const data = await api(`/api/cart/items/${button.dataset.remove}`, { method: "DELETE" });
      state.cart = normalizeCartItems(data.items, state.products);
      saveLocalCart(state.cart);
      await renderCart();
    });
  });
  document.getElementById("checkoutBtn").addEventListener("click", async () => {
    const data = await api("/api/checkout", { method: "POST", body: "{}" });
    state.payment = data.payment;
    document.getElementById("paymentBox").innerHTML = `
      <div class="modal-backdrop" id="paymentModal">
        <section class="payment-modal">
          <button class="modal-close" id="closePayment">x</button>
          <p class="landing-kicker">Simulated QR Payment</p>
          <h2>Scan to Pay</h2>
          <img class="qr" src="${state.payment.qrCode}" alt="Payment QR">
          <p>Exact amount: <strong>${money(state.payment.amount)}</strong></p>
          <div class="checkout-items">
            ${state.payment.items.map((item) => `<span>${escapeHtml(item.name)} x ${escapeHtml(item.quantity)}</span>`).join("")}
          </div>
          <div class="btn-row">
            <button class="btn teal" id="paidBtn">I Paid</button>
            <button class="btn secondary" id="cancelPayment">Cancel</button>
          </div>
          <div id="paymentMessage"></div>
        </section>
      </div>
    `;
    document.getElementById("closePayment").addEventListener("click", closePaymentModal);
    document.getElementById("cancelPayment").addEventListener("click", closePaymentModal);
    document.getElementById("paidBtn").addEventListener("click", async () => {
      const button = document.getElementById("paidBtn");
      button.disabled = true;
      showMessage("paymentMessage", "Confirming payment...");
      await api(`/api/payments/${state.payment.id}/confirm`, { method: "POST", body: "{}" });
      state.cart = [];
      clearLocalCart();
      state.payment = null;
      closePaymentModal();
      state.view = "dashboard";
      history.replaceState(null, "", "#dashboard");
      await renderApp();
    });
  });
}

function closePaymentModal() {
  document.getElementById("paymentModal")?.remove();
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
  const groups = data.education.reduce((result, item) => {
    result[item.topic] = [...(result[item.topic] || []), item];
    return result;
  }, {});
  document.getElementById("view").innerHTML = `
    <div class="education-sections">
      ${Object.entries(groups).map(([topic, items]) => `
        <section class="panel education-topic">
          <div class="section-row">
            <h3>${escapeHtml(topic)}</h3>
            <span class="soft-pill">${items.length} guide${items.length === 1 ? "" : "s"}</span>
          </div>
          <div class="grid">
            ${items.map((item) => `
              <article class="edu-card">
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(item.body)}</p>
              </article>
            `).join("")}
          </div>
        </section>
      `).join("")}
    </div>
  `;
}

async function renderNotifications() {
  setTitle("Notifications", "Structured reminders generated from your current cycle and symptoms.");
  const data = await api("/api/notifications");
  document.getElementById("view").innerHTML = `
    <section class="panel notification-center">
      <h3>Wellness reminders</h3>
      <div class="notification-list">
        ${data.messages.map((message, index) => `
          <article class="notification-item">
            <span class="notification-dot"></span>
            <div>
              <strong>${index === 0 ? "Priority" : "Reminder"}</strong>
              <p>${escapeHtml(message)}</p>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

async function renderEntertainment() {
  setTitle("Entertainment", "Calming tools, comfort content, and light movement for stress relief.");
  const [data, yogaData] = await Promise.all([api("/api/entertainment"), api("/api/yoga")]);
  const quotes = [
    "Slow is still progress.",
    "You can be gentle and still be strong.",
    "Rest is a valid response to a hard day.",
    "Your body is asking for care, not perfection."
  ];
  const selfCare = ["Drink water", "Stretch for two minutes", "Watch something relaxing", "Take a short walk", "Make ginger tea", "Dim your screen"];
  const comfortContent = [
    { type: "Playlist", title: "Soft lofi focus", body: "Low tempo beats for study stress and PMS days." },
    { type: "Playlist", title: "Rainy evening calm", body: "Gentle rain textures and soft piano." },
    { type: "Movie", title: "Comfort watch", body: "Pick a familiar light movie or show with low emotional load." },
    { type: "Video", title: "Motivation reset", body: "A short guided reset or cozy routine video." }
  ];
  document.getElementById("view").innerHTML = `
    <section class="panel relaxation-panel">
      <div>
        <p class="landing-kicker">Relaxation Mode</p>
        <h3>Breathe with the circle</h3>
        <p id="relaxQuote">${escapeHtml(quotes[Math.floor(Math.random() * quotes.length)])}</p>
        <div class="btn-row">
          <button class="btn secondary" data-sound="rain">Rain</button>
          <button class="btn secondary" data-sound="lofi">Lofi</button>
          <button class="btn secondary" data-sound="soft">Soft tone</button>
          <button class="btn ghost" id="stopAmbient">Stop</button>
        </div>
      </div>
      <div class="breathing-orb" aria-label="Breathing animation"><span></span></div>
    </section>

    <section class="panel suggestion-panel">
      <div class="section-row">
        <div>
          <h3>Self-care suggestion</h3>
          <p class="muted" id="selfCareText">${escapeHtml(selfCare[0])}</p>
        </div>
        <button class="btn" id="randomCareBtn">New Suggestion</button>
      </div>
      <div class="grid entertainment-grid">
        ${data.activities.map((activity) => `
          <article class="panel entertainment-card">
            <p class="landing-kicker">${escapeHtml(activity.type)}</p>
            <h3>${escapeHtml(activity.title)}</h3>
            <p>${escapeHtml(activity.body)}</p>
            <button class="btn secondary" data-activity="${escapeHtml(activity.id)}">Mark Done</button>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="grid comfort-grid">
      ${comfortContent.map((item) => `
        <article class="panel comfort-card">
          <p class="landing-kicker">${escapeHtml(item.type)}</p>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.body)}</p>
        </article>
      `).join("")}
    </section>

    <section class="panel exercise-preview">
      <div class="section-row">
        <h3>Gentle movement visuals</h3>
        <span class="soft-pill">${yogaData.yoga.length} guided options</span>
      </div>
      <div class="grid entertainment-grid">
        ${yogaData.yoga.slice(0, 4).map((pose) => `
          <article class="exercise-mini-card">
            <img src="${pose.image}" alt="${escapeHtml(pose.name)}">
            <div>
              <strong>${escapeHtml(pose.name)}</strong>
              <p>${escapeHtml(pose.instructions)}</p>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
  document.getElementById("randomCareBtn").addEventListener("click", () => {
    document.getElementById("selfCareText").textContent = selfCare[Math.floor(Math.random() * selfCare.length)];
    document.getElementById("relaxQuote").textContent = quotes[Math.floor(Math.random() * quotes.length)];
  });
  document.querySelectorAll("[data-sound]").forEach((button) => {
    button.addEventListener("click", () => startAmbientSound(button.dataset.sound));
  });
  document.getElementById("stopAmbient").addEventListener("click", stopAmbientSound);
  document.querySelectorAll("[data-activity]").forEach((button) => {
    button.addEventListener("click", () => {
      button.textContent = "Done";
      button.disabled = true;
      button.closest(".entertainment-card")?.classList.add("is-complete");
    });
  });
}

function startAmbientSound(kind) {
  stopAmbientSound();
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const gain = context.createGain();
  const oscillator = context.createOscillator();
  const frequencies = { rain: 180, lofi: 130, soft: 220 };
  oscillator.type = kind === "rain" ? "sine" : "triangle";
  oscillator.frequency.value = frequencies[kind] || 160;
  gain.gain.value = 0.025;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  state.ambientAudio = { context, oscillator };
}

function stopAmbientSound() {
  if (!state.ambientAudio) return;
  state.ambientAudio.oscillator.stop();
  state.ambientAudio.context.close();
  state.ambientAudio = null;
}

async function renderCommunity() {
  setTitle("Community", "Anonymous support posts, mood check-ins, and live rooms.");
  const moodOptions = ["Happy", "Sad", "Angry", "Tired", "Stressed"];
  const rooms = ["PMS Support", "PCOS Support", "Study Stress", "General Chat"];
  if (!rooms.includes(state.communityRoom)) state.communityRoom = "General Chat";
  const stats = [
    "120 users tracked cramps today",
    "87 users feeling stressed",
    "43 users chose rest today",
    "64 users shared support this week"
  ];
  document.getElementById("view").innerHTML = `
    <section class="community-page">
      <div class="community-main">
        <section class="panel community-post-composer">
          <p class="landing-kicker">Anonymous post</p>
          <form id="communityPostForm">
            <textarea id="communityPostInput" placeholder="Share what you are feeling. Your name will stay anonymous." maxlength="800" required></textarea>
            <div class="btn-row">
              <select id="postMood">
                <option value="">Mood tag</option>
                ${moodOptions.map((mood) => `<option>${mood}</option>`).join("")}
              </select>
              <button class="btn">Post anonymously</button>
            </div>
          </form>
          <div id="communityPostNotice"></div>
        </section>

        <section class="community-feed" id="communityFeed"></section>
      </div>

      <aside class="community-side">
        <section class="panel mood-panel">
          <h3>Daily mood check-in</h3>
          <div class="mood-picker">
            ${moodOptions.map((mood) => `<button class="mood-btn" data-mood="${mood}">${mood}</button>`).join("")}
          </div>
          <div id="moodSummary"></div>
        </section>

        <section class="panel alone-panel">
          <h3>You're not alone</h3>
          <div class="support-stats">${stats.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
        </section>

        <section class="panel community-room">
          <div class="room-tabs">
            ${rooms.map((room) => `<button class="room-tab ${room === state.communityRoom ? "active" : ""}" data-room="${escapeHtml(room)}">${escapeHtml(room)}</button>`).join("")}
          </div>
          <div class="community-messages" id="communityMessages"></div>
          <form id="communityForm" class="community-form">
            <input id="communityInput" placeholder="Message ${escapeHtml(state.communityRoom)}..." maxlength="500" required>
            <button class="btn">Send</button>
          </form>
          <div id="communityNotice"></div>
        </section>
      </aside>
    </section>
  `;
  document.getElementById("communityPostForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.getElementById("communityPostInput");
    try {
      await api("/api/community/posts", {
        method: "POST",
        body: JSON.stringify({ body: input.value, mood: document.getElementById("postMood").value })
      });
      input.value = "";
      await loadCommunityPosts();
    } catch (err) {
      showMessage("communityPostNotice", err.message, true);
    }
  });
  document.querySelectorAll("[data-mood]").forEach((button) => {
    button.addEventListener("click", () => saveMood(button.dataset.mood));
  });
  document.querySelectorAll("[data-room]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.communityRoom = button.dataset.room;
      localStorage.setItem("menstrumateCommunityRoom", state.communityRoom);
      document.querySelectorAll("[data-room]").forEach((node) => node.classList.toggle("active", node.dataset.room === state.communityRoom));
      document.getElementById("communityInput").placeholder = `Message ${state.communityRoom}...`;
      await loadCommunityMessages();
    });
  });
  document.getElementById("communityForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.getElementById("communityInput");
    try {
      await api("/api/community/messages", {
        method: "POST",
        body: JSON.stringify({ message: input.value, room: state.communityRoom })
      });
      input.value = "";
      await loadCommunityMessages();
    } catch (err) {
      showMessage("communityNotice", err.message, true);
    }
  });
  renderMoodSummary();
  await loadCommunityPosts();
  await loadCommunityMessages();
  startCommunityPolling();
}

async function loadCommunityPosts() {
  const data = await api("/api/community/posts");
  const feed = document.getElementById("communityFeed");
  if (!feed) return;
  feed.innerHTML = data.posts.length ? data.posts.map((post) => `
    <article class="panel community-post-card" data-post-card="${escapeHtml(post.id)}">
      <div class="post-topline">
        <strong>${escapeHtml(post.anonymousName)}</strong>
        <span>${post.mood ? escapeHtml(post.mood) : "Sharing"}</span>
      </div>
      <p>${escapeHtml(post.body)}</p>
      <small>${new Date(post.createdAt).toLocaleString()}</small>
      <div class="post-actions">
        <button class="btn secondary" data-react-post="${escapeHtml(post.id)}">&#10084; ${post.reacted ? "Loved" : "Like"} (${post.reactionCount})</button>
      </div>
      <div class="post-comments">
        ${post.comments.map((comment) => `
          <div class="post-comment">
            <strong>${escapeHtml(comment.anonymousName)}</strong>
            <span>${escapeHtml(comment.body)}</span>
          </div>
        `).join("")}
      </div>
      <form class="comment-form" data-comment-form="${escapeHtml(post.id)}">
        <input placeholder="Reply anonymously..." maxlength="500" required>
        <button class="btn ghost">Reply</button>
      </form>
    </article>
  `).join("") : `<section class="panel"><p class="muted">No posts yet. Share anonymously to start the feed.</p></section>`;
  document.querySelectorAll("[data-react-post]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/api/community/posts/${button.dataset.reactPost}/react`, { method: "POST", body: "{}" });
      addInAppNotification("Community reaction updated.", "Community", { toast: true });
      await loadCommunityPosts();
    });
  });
  document.querySelectorAll("[data-comment-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = form.querySelector("input");
      await api(`/api/community/posts/${form.dataset.commentForm}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: input.value })
      });
      addInAppNotification("Someone replied to a community post.", "Community", { toast: true });
      await loadCommunityPosts();
    });
  });
}

function saveMood(mood) {
  const today = new Date().toISOString().slice(0, 10);
  const history = JSON.parse(localStorage.getItem("menstrumateMoodHistory") || "[]").filter((entry) => entry.date !== today);
  history.push({ date: today, mood });
  localStorage.setItem("menstrumateMoodHistory", JSON.stringify(history.slice(-14)));
  renderMoodSummary();
  addInAppNotification(`Mood check-in saved: ${mood}. A gentle wellness reminder is ready for you.`, "Wellness", { toast: true });
}

function renderMoodSummary() {
  const box = document.getElementById("moodSummary");
  if (!box) return;
  const history = JSON.parse(localStorage.getItem("menstrumateMoodHistory") || "[]");
  const counts = history.reduce((result, entry) => {
    result[entry.mood] = (result[entry.mood] || 0) + 1;
    return result;
  }, {});
  box.innerHTML = history.length ? `
    <p class="muted">Last ${history.length} check-in${history.length === 1 ? "" : "s"}</p>
    <div class="mood-bars">
      ${Object.entries(counts).map(([mood, count]) => `<span style="height:${Math.max(18, count * 18)}px" title="${escapeHtml(mood)}">${escapeHtml(mood.slice(0, 1))}</span>`).join("")}
    </div>
  ` : `<p class="muted">Choose a mood to start your trend.</p>`;
}

async function loadCommunityMessages() {
  const data = await api(`/api/community/messages?room=${encodeURIComponent(state.communityRoom)}`);
  const box = document.getElementById("communityMessages");
  if (!box) return;
  box.innerHTML = data.messages.length ? data.messages.map((message) => `
    <article class="community-message ${message.userId === state.account.id ? "mine" : ""}">
      <strong>${escapeHtml(message.name)} <span>${escapeHtml(message.role)}</span></strong>
      <p>${escapeHtml(message.message)}</p>
      <small>${new Date(message.createdAt).toLocaleString()}</small>
    </article>
  `).join("") : `<p class="muted">No messages yet. Start the room with a kind note.</p>`;
  box.scrollTop = box.scrollHeight;
}

function startCommunityPolling() {
  stopCommunityPolling();
  state.communityTimer = setInterval(() => {
    if (state.view === "community") loadCommunityMessages().catch(() => {});
  }, 5000);
}

function stopCommunityPolling() {
  if (state.communityTimer) clearInterval(state.communityTimer);
  state.communityTimer = null;
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
