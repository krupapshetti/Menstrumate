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
  console.log("💾 setSession called - Token saved:", !!token);
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
        if (!email) {
          showMessage("authMessage", "Please enter your email first", true);
          return;
        }
        
        const data = await api("/api/auth/request-otp", {
          method: "POST",
          body: JSON.stringify({ email, role })
        });
        
        if (data.otp) {
          showMessage("authMessage", `✅ Your OTP is: ${data.otp}`, false);
        } else {
          showMessage("authMessage", `✅ OTP generated! Check your terminal for the code.`, false);
        }
      } catch (err) {
        showMessage("authMessage", err.message, true);
      }
    });
  }
  
  // ========== LOGIN/SIGNUP HANDLER WITH DEBUG ==========
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
    
    console.log("🚀 Sending request to:", `/api/auth/${isSignup ? "signup" : "login"}`);
    console.log("📦 Request body:", { ...body, password: "***" });
    
    try {
      const response = await fetch(`/api/auth/${isSignup ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      console.log("📥 Response status:", response.status);
      console.log("📥 Response data:", data);
      console.log("🔑 Token in response:", data.token ? "YES (length: " + data.token.length + ")" : "NO");
      
      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }
      
      if (!data.token) {
        console.error("❌ NO TOKEN in response!");
        showMessage("authMessage", "Server error: No token received", true);
        return;
      }
      
      // Save token directly
      localStorage.setItem("menstrumateToken", data.token);
      localStorage.setItem("menstrumateRole", role);
      state.token = data.token;
      state.role = role;
      state.account = data.account;
      
      console.log("✅ Token saved to localStorage:", localStorage.getItem("menstrumateToken") ? "YES" : "NO");
      console.log("✅ Role saved:", localStorage.getItem("menstrumateRole"));
      
      // Redirect
      if (role === "doctor") {
        console.log("➡️ Redirecting to doctor dashboard");
        window.location.href = "/doctor-dashboard.html";
      } else if (data.account?.isFirstLogin) {
        console.log("➡️ Redirecting to symptoms onboarding");
        window.location.href = "/symptoms.html?onboarding=1";
      } else {
        console.log("➡️ Redirecting to home/dashboard");
        window.location.href = "/";
      }
      
    } catch (err) {
      console.error("❌ Error:", err);
      showMessage("authMessage", err.message, true);
    }
  });
  console.log("Backend isFirstLogin:", state.account?.isFirstLogin);
}

async function renderApp() {
  console.log("📱 renderApp called, token exists:", !!state.token);
  
  if (!state.token) return renderLanding();
  if (!state.account) {
    try {
      console.log("📡 Fetching /api/me...");
      const data = await api("/api/auth/me");
      console.log("✅ Account data received:", data);
      state.account = data.account;
    } catch (err) {
      console.log("❌ Failed to fetch account:", err.message);
      return logout();
    }
  }
  
  console.log("👤 Account role:", state.account.role);
  
  if (state.account.role === "doctor") {
    window.location.href = "/doctor-dashboard.html";
    return;
  }
  const currentPath = window.location.pathname;

if (state.account.role === "doctor" && !currentPath.includes("doctor-dashboard.html")) {
  window.location.href = "/doctor-dashboard.html";
  return;
}

if (
  state.account.isFirstLogin &&
  !currentPath.includes("symptoms.html")
) {
  console.log("🚨 WOULD REDIRECT TO SYMPTOMS");
  // window.location.href = "/symptoms.html?onboarding=1";
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
    symptoms: renderSymptoms,  // ← CHANGE THIS LINE
    shop: renderShop,
    cart: renderCart,
    diet: renderDiet,
    yoga: renderYoga,
    doctors: renderDoctors,
    profile: renderProfile,
    education: renderEducation
  };
  
  if (loaders[state.view]) {
    await loaders[state.view]();
  } else {
    console.error(`Unknown view: ${state.view}`);
    await renderDashboard();
  }
}

// Keep this function for any external links that need to redirect to symptoms.html
async function renderSymptomsLink() {
  window.location.href = "/symptoms.html";
}

// ========== NEW: Complete Symptoms Function for SPA ==========
async function renderSymptoms() {
  setTitle("Log Symptoms", "Track your daily symptoms, pain levels, and share with your doctor.");
  const view = document.getElementById("view");
  
  // Get today's date
  const today = new Date().toISOString().slice(0, 10);
  
  try {
    // Fetch existing symptoms to check if already logged today
    const symptomData = await api(`/api/symptoms?_=${Date.now()}`).catch(() => ({ data: { symptoms: [] } }));
    const symptoms = symptomData?.data?.symptoms || symptomData?.symptoms || [];
    const todaySymptoms = symptoms.find(s => s.date === today);
    
    // Symptom options
    const symptomOptions = ["Cramps", "Bloating", "Headache", "Fatigue", "Mood swings", 
      "Breast tenderness", "Nausea", "Back pain", "Acne", "Food cravings"];
    
    view.innerHTML = `
      <div class="panel">
        <form id="symptomsForm" class="form-grid">
          <h3>${todaySymptoms ? "Update Today's Symptoms" : "Log Today's Symptoms"}</h3>
          <p class="muted">Date: ${today}</p>
          
          <label class="field full">
            <span>Symptoms (select all that apply)</span>
            <div class="symptom-checkboxes">
              ${symptomOptions.map(option => `
                <label>
                  <input type="checkbox" name="symptoms" value="${option}" 
                    ${todaySymptoms?.symptoms?.includes(option) ? 'checked' : ''}>
                  ${option}
                </label>
              `).join("")}
            </div>
          </label>
          
          <label class="field">
            <span>Pain Level (0-10)</span>
            <input type="range" id="painLevel" min="0" max="10" value="${todaySymptoms?.painLevel || 0}">
            <span id="painValueDisplay">${todaySymptoms?.painLevel || 0}</span>
          </label>
          
          <label class="field full">
            <span>Notes</span>
            <textarea id="notes" rows="3" placeholder="Additional notes...">${todaySymptoms?.notes || ''}</textarea>
          </label>
          
          <label class="field">
            <span>Share with doctor</span>
            <input type="checkbox" id="shareWithDoctor" ${todaySymptoms?.sharedWithDoctor ? 'checked' : ''}>
          </label>
          
          <div class="btn-row">
            <button type="submit" class="btn">${todaySymptoms ? "Update Symptoms" : "Save Symptoms"}</button>
            <button type="button" id="backToDashboardBtn" class="btn secondary">Back to Dashboard</button>
          </div>
          
          <div id="symptomsMessage"></div>
        </form>
      </div>
    `;
    
    // Pain level display
    const painSlider = document.getElementById("painLevel");
    const painDisplay = document.getElementById("painValueDisplay");
    painSlider.addEventListener("input", () => {
      painDisplay.textContent = painSlider.value;
    });
    
    // Handle form submission - simplified version
    document.getElementById("symptomsForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const selectedSymptoms = Array.from(document.querySelectorAll('input[name="symptoms"]:checked'))
        .map(cb => cb.value);
      
      const symptomDataToSave = {
        date: today,
        symptoms: selectedSymptoms,
        painLevel: parseInt(document.getElementById("painLevel").value),
        notes: document.getElementById("notes").value,
        sharedWithDoctor: document.getElementById("shareWithDoctor").checked
      };
      
      const messageBox = document.getElementById("symptomsMessage");
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      
      submitBtn.textContent = "Saving...";
      submitBtn.disabled = true;
      
      try {
        // If there's an existing symptom for today, delete it first
        if (todaySymptoms) {
          const symptomId = todaySymptoms.symptomId || todaySymptoms.id;
          try {
            await api(`/api/symptoms/${symptomId}`, {
              method: "DELETE"
            });
            console.log("Deleted existing symptom entry");
          } catch (deleteErr) {
            console.log("No existing entry to delete or delete failed:", deleteErr);
          }
        }
        
        // Always create new with POST
        await api("/api/symptoms", {
          method: "POST",
          body: JSON.stringify(symptomDataToSave)
        });
        
        messageBox.className = "notice";
        messageBox.textContent = "✅ Symptoms saved successfully!";
        
        // Set flag to notify dashboard to refresh
        localStorage.setItem('menstrumateSymptomsUpdated', Date.now().toString());
        
        // Redirect back to dashboard after 1.5 seconds
        setTimeout(() => {
          state.view = "dashboard";
          renderApp();
        }, 1500);
        
      } catch (err) {
        messageBox.className = "notice error";
        messageBox.textContent = `❌ Failed to save symptoms: ${err.message}`;
        console.error("Symptom save error:", err);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
    
    // Handle back button
    document.getElementById("backToDashboardBtn").addEventListener("click", () => {
      state.view = "dashboard";
      renderApp();
    });
    
  } catch (error) {
    console.error("Error loading symptoms:", error);
    view.innerHTML = `<div class="panel error">Failed to load symptoms page: ${error.message}</div>`;
  }
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
    state.view = "symptoms";
    renderSymptoms();
    close();
  });
  document.getElementById("skipCheckin").addEventListener("click", close);
  document.getElementById("dismissCheckin").addEventListener("click", close);
}

async function renderDashboard() {
  console.log("🔄 Rendering dashboard with fresh data...");
  setTitle("Dashboard", "Personalized predictions, insights, and live account data.");
  const view = document.getElementById("view");
  
  if (state.role === "doctor") {
    view.innerHTML = `<div class="panel"><h3>Doctor profile is active</h3><p class="muted">Users can now see your profile in their doctor list.</p></div>`;
    return;
  }
  
  // Check for symptom updates from localStorage
  const symptomsUpdated = localStorage.getItem('menstrumateSymptomsUpdated');
  if (symptomsUpdated) {
    console.log("🔄 Symptoms were just updated, clearing cache...");
    localStorage.removeItem('menstrumateSymptomsUpdated');
  }
  
  // Check for first login and redirect to symptoms
  if (state.account?.isFirstLogin) {
    console.log("🔄 First login detected, redirecting to symptoms onboarding");
    state.account.isFirstLogin = false;
    await renderSymptoms();
    return;
  }
  
  try {
    // Add cache-busting timestamp to ALL API calls
    const timestamp = Date.now();
    
    // First, get the user's current cycle data from the database
    const userData = await api(`/api/auth/me?_=${timestamp}`);
    if (userData.account) {
      state.account.cycleLength = userData.account.cycleLength;
      state.account.lastPeriod = userData.account.lastPeriod;
    }
    
    const [cycleData, notices, symptomData, analyticsData, insightData] = await Promise.all([
      api(`/api/cycle?_=${timestamp}`).catch(err => {
        console.error("Cycle API error:", err);
        return { insights: {}, cycle: [], expectedSymptoms: [], recommendedActions: [] };
      }),
      api(`/api/notifications?_=${timestamp}`).catch(err => {
        console.error("Notifications API error:", err);
        return { messages: [] };
      }),
      api(`/api/symptoms?_=${timestamp}`).catch(err => {
        console.error("Symptoms API error:", err);
        return { data: { symptoms: [] } };
      }),
      api(`/api/cycle/analytics/${state.account.id}?_=${timestamp}`).catch(err => {
        console.error("Analytics API error:", err);
        return { analytics: { painTrend: [], frequency: [] } };
      }),
      api("/api/cycle/insights", {
        method: "POST",
        body: JSON.stringify({})
      }).catch(err => {
        console.error("Insights API error:", err);
        return { insights: [] };
      })
    ]);
    
    console.log("✅ Dashboard data loaded successfully");
    console.log("📊 Cycle data:", cycleData);
    console.log("📊 User cycle length from account:", state.account.cycleLength);
    
    // Handle different response structures
    const symptoms = symptomData?.data?.symptoms || symptomData?.symptoms || [];
    const latestSymptom = symptoms.length > 0 ? symptoms[0] : null;
    
    // Safely access nested properties with defaults
    const insights = cycleData?.insights || { nextPeriod: 'N/A', ovulation: 'N/A', todayPhase: 'Unknown', predictionConfidence: 0, irregularCycle: false };
    const cycle = cycleData?.cycle || [];
    const analytics = analyticsData?.analytics || { painTrend: [], frequency: [] };
    const noticesMessages = notices?.messages || [];
    const expectedSymptoms = cycleData?.expectedSymptoms || [];
    const recommendedActions = cycleData?.recommendedActions || [];
    const insightList = insightData?.insights || [];
    
    // Get the last period date from cycle data or user account
    const lastPeriodDate = cycle[0]?.date || state.account.lastPeriod || '';
    
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
          ${expectedSymptoms.length ? renderFrequencyBadges(expectedSymptoms.map((symptom) => ({ symptom, count: "phase" }))) : '<p class="muted">No expected symptoms for this phase.</p>'}
        </div>
        <div class="panel">
          <h3>Recommended Actions</h3>
          ${recommendedActions.length ? recommendedActions.map((item) => `<p>${escapeHtml(item)}</p>`).join("") : '<p class="muted">No recommendations at this time.</p>'}
        </div>
      </div>
      
      <div class="panel flow-panel" style="margin-top:16px">
        <h3>Period Alert Setup</h3>
        <div id="cycleMessage" class="notice" style="display:none; margin-bottom:16px"></div>
        <form id="cycleForm" class="form-grid">
          <label class="field"><span>Last Period Start</span>
            <input id="cycleDate" type="date" value="${lastPeriodDate}" required>
          </label>
          <label class="field"><span>Cycle Length (days)</span>
            <input id="cycleLength" type="number" min="20" max="40" value="${state.account.cycleLength || 28}" required>
          </label>
          <div class="field"><span>&nbsp;</span><button class="btn" id="saveCycleBtn">Save Cycle Settings</button></div>
        </form>
      </div>
      
      <div class="panel reminders-panel" style="margin-top:16px">
        <h3>Smart Reminders</h3>
        ${noticesMessages.length ? noticesMessages.map((msg) => `<p>${escapeHtml(msg)}</p>`).join("") : '<p class="muted">No reminders at this time.</p>'}
      </div>
      
      <div class="panel" style="margin-top:16px">
        <h3>Today's Symptoms</h3>
        ${latestSymptom ? `
          <p class="muted">${escapeHtml(latestSymptom.date)}${latestSymptom.sharedWithDoctor ? " &middot; Shared with doctor" : " &middot; Private"}</p>
          <p><strong>${(latestSymptom.symptoms || []).map(escapeHtml).join(", ")}</strong></p>
          <p>Pain level: <strong>${escapeHtml(latestSymptom.painLevel)}/10</strong></p>
          ${latestSymptom.notes ? `<p>${escapeHtml(latestSymptom.notes)}</p>` : ""}
          <div class="btn-row">
            <button class="btn secondary" id="updateSymptomsBtn">Update Today's Symptoms</button>
            <button class="btn secondary" id="refreshDashboardBtn">Refresh Dashboard</button>
          </div>
        ` : `
          <p class="muted">No symptoms logged today.</p>
          <div class="btn-row">
            <button class="btn" id="logSymptomsBtn">Log Symptoms</button>
            <button class="btn secondary" id="refreshDashboardBtn">Refresh Dashboard</button>
          </div>
        `}
      </div>
      
      <div class="grid" style="margin-top:16px">
        <div class="panel">
          <h3>Pain Trend (Last 14 Days)</h3>
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
          ${insightList.length ? insightList.map((item) => `
            <article class="diet-day">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.message)}</span>
              <span class="muted">${escapeHtml(item.action)}</span>
            </article>
          `).join("") : '<p class="muted">No insights available yet. Log more symptoms for personalized insights.</p>'}
        </div>
      </div>
      
      <div class="panel calendar-panel" style="margin-top:16px">
        <h3>Cycle Calendar</h3>
        <div class="calendar">${Array.isArray(cycle) && cycle.length ? cycle.map((day) => `<div class="day ${day.phase}"><strong>Day ${day.day}</strong><br>${day.date}<br>${day.phase}</div>`).join("") : '<p>No cycle data available. Please set your last period date above.</p>'}</div>
      </div>
    `;
    
    // Handle cycle form submission with proper error handling and refresh
    const cycleForm = document.getElementById("cycleForm");
    const saveCycleBtn = document.getElementById("saveCycleBtn");
    const cycleDateInput = document.getElementById("cycleDate");
    const cycleLengthInput = document.getElementById("cycleLength");
    const cycleMessage = document.getElementById("cycleMessage");
    
    if (saveCycleBtn) {
      saveCycleBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        
        const lastPeriod = cycleDateInput.value;
        const cycleLength = parseInt(cycleLengthInput.value);
        
        if (!lastPeriod) {
          showMessage("cycleMessage", "Please select your last period date", true);
          return;
        }
        
        if (isNaN(cycleLength) || cycleLength < 20 || cycleLength > 40) {
          showMessage("cycleMessage", "Cycle length must be between 20 and 40 days", true);
          return;
        }
        
        // Show saving state
        const originalText = saveCycleBtn.textContent;
        saveCycleBtn.textContent = "Saving...";
        saveCycleBtn.disabled = true;
        
        if (cycleMessage) {
          cycleMessage.style.display = "block";
          cycleMessage.className = "notice";
          cycleMessage.textContent = "Saving cycle data...";
        }
        
        try {
          console.log("📝 Saving cycle data:", { lastPeriod, cycleLength });
          
          // Save to /api/cycle endpoint
          const cycleResponse = await api("/api/cycle", {
            method: "POST",
            body: JSON.stringify({
              lastPeriod: lastPeriod,
              cycleLength: cycleLength
            })
          });
          
          console.log("✅ Cycle save response:", cycleResponse);
          
          // Also update user profile with cycle length
          const profileResponse = await api("/api/profile", {
            method: "PATCH",
            body: JSON.stringify({
              cycleLength: cycleLength,
              lastPeriod: lastPeriod
            })
          }).catch(err => {
            console.log("Profile update not available, continuing...");
            return null;
          });
          
          if (cycleMessage) {
            cycleMessage.className = "notice";
            cycleMessage.textContent = "✅ Cycle settings saved successfully! Refreshing dashboard...";
          }
          
          // Update local state
          if (state.account) {
            state.account.cycleLength = cycleLength;
            state.account.lastPeriod = lastPeriod;
          }
          
          // Wait a moment then refresh the entire dashboard
          setTimeout(async () => {
            // Clear any cached data
            localStorage.removeItem('menstrumateCycleUpdated');
            localStorage.setItem('menstrumateCycleUpdated', Date.now().toString());
            
            // Force refresh the entire dashboard
            await renderDashboard();
          }, 1500);
          
        } catch (err) {
          console.error("❌ Failed to save cycle:", err);
          if (cycleMessage) {
            cycleMessage.className = "notice error";
            cycleMessage.textContent = `❌ Failed to save: ${err.message}`;
            cycleMessage.style.display = "block";
          }
          saveCycleBtn.textContent = originalText;
          saveCycleBtn.disabled = false;
          
          // Hide error after 3 seconds
          setTimeout(() => {
            if (cycleMessage) {
              cycleMessage.style.display = "none";
            }
          }, 3000);
        }
      });
    }
    
    // Handle symptom buttons
    const logSymptomsBtn = document.getElementById("logSymptomsBtn");
    if (logSymptomsBtn) {
      logSymptomsBtn.addEventListener("click", async () => {
        await renderSymptoms();
      });
    }
    
    const updateSymptomsBtn = document.getElementById("updateSymptomsBtn");
    if (updateSymptomsBtn) {
      updateSymptomsBtn.addEventListener("click", async () => {
        await renderSymptoms();
      });
    }
    
    // Manual refresh button
    const refreshBtn = document.getElementById("refreshDashboardBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        console.log("🔄 Manual refresh triggered");
        await renderDashboard();
      });
    }
    
    maybeShowDailyCheckin(latestSymptom);
    
  } catch (error) {
    console.error("Error rendering dashboard:", error);
    view.innerHTML = `<div class="panel error">Failed to load dashboard: ${error.message}</div>`;
  }
}

async function getProductsAndCart() {
  try {
    const [productResponse, cartResponse] = await Promise.all([
      api("/api/products").catch(err => {
        console.error("Products API failed:", err);
        return { data: { products: [], categories: [], recommendations: [] } };
      }),
      api("/api/cart").catch(err => {
        console.error("Cart API failed:", err);
        return { items: [], total: 0, itemCount: 0 };
      })
    ]);
    
    const productData = productResponse?.data || productResponse;
    const cartData = cartResponse;
    
    state.products = Array.isArray(productData?.products) ? productData.products : [];
    state.categories = Array.isArray(productData?.categories) ? productData.categories : [];
    
    if (cartData && Array.isArray(cartData.items)) {
      state.cart = cartData.items;
    } else if (cartData && Array.isArray(cartData)) {
      state.cart = cartData;
    } else {
      state.cart = [];
    }
    
    console.log("✅ Products loaded:", state.products.length);
    console.log("✅ Categories loaded:", state.categories);
    console.log("✅ Cart items loaded:", state.cart.length);
    
    return { products: state.products, cart: state.cart };
    
  } catch (error) {
    console.error("❌ Failed to load products/cart:", error);
    state.products = [];
    state.categories = [];
    state.cart = [];
    return { products: [], cart: [] };
  }
}

async function renderShop() {
  setTitle("Shop", "Products are loaded from the backend and added to your stored cart.");
  const view = document.getElementById("view");
  
  try {
    view.innerHTML = `<div class="panel">Loading shop...</div>`;
    
    const [productResponse, cartResponse] = await Promise.all([
      api("/api/products").catch(err => {
        console.error("Products API failed:", err);
        return { data: { products: [], categories: [], recommendations: [] } };
      }),
      api("/api/cart").catch(err => {
        console.error("Cart API failed:", err);
        return { items: [], total: 0, itemCount: 0 };
      })
    ]);
    
    const productData = productResponse?.data || productResponse;
    
    let cartItems = [];
    if (cartResponse && Array.isArray(cartResponse.items)) {
      cartItems = cartResponse.items;
    } else if (cartResponse && Array.isArray(cartResponse)) {
      cartItems = cartResponse;
    }
    
    state.products = Array.isArray(productData?.products) ? productData.products : [];
    state.categories = Array.isArray(productData?.categories) ? productData.categories : [];
    state.cart = cartItems;
    
    if (state.products.length === 0) {
      view.innerHTML = `
        <div class="panel">
          <h3>No products available</h3>
          <p>No products found in the database. Please check your seed data.</p>
          <button class="btn" onclick="renderShop()">Refresh</button>
        </div>
      `;
      return;
    }
    
    const safeCategories = Array.isArray(state.categories) && state.categories.length > 0 ? state.categories : [];
    const active = sessionStorage.getItem("category") || "All";
    
    let categoryOptions = ["All"];
    if (safeCategories.length > 0) {
      categoryOptions = ["All", ...safeCategories];
    }
    
    const products = active === "All" ? state.products : state.products.filter((product) => product?.category === active);
    
    const cartCount = state.cart.reduce((sum, item) => {
      const qty = item?.quantity || (item?.product?.quantity) || 0;
      return sum + qty;
    }, 0);
    
    const recommendations = productData?.recommendations || [];
    
    view.innerHTML = `
      ${recommendations.length > 0 ? `
        <div class="panel smart-shop-panel">
          <h3>Recommended for you</h3>
          <div class="symptom-badges">
            ${recommendations.map((product) => `<span>${escapeHtml(product.name)}</span>`).join("")}
          </div>
        </div>
      ` : ""}
      <div class="shop-tools">
        <select id="categorySelect">
          ${categoryOptions.map((cat) => `<option ${cat === active ? "selected" : ""}>${escapeHtml(cat)}</option>`).join("")}
        </select>
        <button class="btn secondary" id="goCart">Cart (${cartCount})</button>
      </div>
      <div class="grid shop-grid">
        ${products.map((product) => `
          <article class="product">
            <img src="${product.image || 'https://via.placeholder.com/200'}" alt="${escapeHtml(product.name)}">
            <div class="product-body">
              <p class="muted">${escapeHtml(product.category || 'Uncategorized')}</p>
              <h3>${escapeHtml(product.name)}</h3>
              <p class="muted small">${escapeHtml(product.description || '')}</p>
              <strong>${money(product.price)}</strong>
              <div style="margin-top:12px">
                <button class="btn add-cart-btn" data-add="${product.id}">Add to Cart</button>
              </div>
            </div>
          </article>
        `).join("")}
      </div>
    `;
    
    const categorySelect = document.getElementById("categorySelect");
    if (categorySelect) {
      categorySelect.addEventListener("change", (event) => {
        sessionStorage.setItem("category", event.target.value);
        renderShop();
      });
    }
    
    const goCartBtn = document.getElementById("goCart");
    if (goCartBtn) {
      goCartBtn.addEventListener("click", async () => {
        state.view = "cart";
        await renderApp();
      });
    }
    
    document.querySelectorAll("[data-add]").forEach((button) => {
      button.addEventListener("click", async () => {
        const originalText = button.textContent;
        const productId = button.dataset.add;
        
        button.classList.add("is-adding");
        button.textContent = "Adding...";
        button.disabled = true;
        
        try {
          await api("/api/cart/items", { 
            method: "POST", 
            body: JSON.stringify({ productId, quantity: 1 }) 
          });
          
          button.textContent = "Added!";
          setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove("is-adding");
            button.disabled = false;
          }, 1500);
          
          await getProductsAndCart();
          
          const updatedCartCount = state.cart.reduce((sum, item) => {
            const qty = item?.quantity || (item?.product?.quantity) || 0;
            return sum + qty;
          }, 0);
          const cartButton = document.getElementById("goCart");
          if (cartButton) {
            cartButton.textContent = `Cart (${updatedCartCount})`;
          }
          
        } catch (err) {
          console.error("Failed to add to cart:", err);
          button.textContent = "Failed";
          setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove("is-adding");
            button.disabled = false;
          }, 2000);
        }
      });
    });
    
  } catch (error) {
    console.error("❌ Error rendering shop:", error);
    view.innerHTML = `
      <div class="panel error">
        <h3>Failed to load shop</h3>
        <p>${escapeHtml(error.message)}</p>
        <button class="btn" onclick="renderShop()">Try Again</button>
      </div>
    `;
  }
}

async function renderCart() {
  setTitle("Cart", "Update quantities, remove items, and checkout with exact amount QR.");
  
  try {
    await getProductsAndCart();
    
    if (!state.cart || state.cart.length === 0) {
      document.getElementById("view").innerHTML = `
        <div class="panel">
          <h3>Your cart is empty</h3>
          <p>Start shopping to add items to your cart.</p>
          <button class="btn" onclick="renderShop()">Continue Shopping</button>
        </div>
      `;
      return;
    }
    
    const rows = state.cart
      .map((entry) => {
        const productId = entry.productId;
        const quantity = entry.quantity;
        let product = null;
        
        if (entry.product) {
          product = entry.product;
        } else {
          product = state.products.find((p) => p.id === productId);
        }
        
        if (!product) return null;
        return { 
          ...product, 
          quantity: quantity,
          id: product.id || productId
        };
      })
      .filter(item => item !== null);
    
    const total = rows.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    document.getElementById("view").innerHTML = `
      <section class="checkout cart-layout">
        <div class="cart-list">
          ${rows.map((item) => `
            <div class="cart-row">
              <img class="cart-thumb" src="${item.image || 'https://via.placeholder.com/100'}" alt="${escapeHtml(item.name)}">
              <div>
                <strong>${escapeHtml(item.name)}</strong><br>
                <span class="muted">${money(item.price)} each</span>
              </div>
              <div class="qty">
                <button class="icon-btn" data-dec="${item.id}">-</button>
                <strong>${item.quantity}</strong>
                <button class="icon-btn" data-inc="${item.id}">+</button>
              </div>
              <strong>${money(item.price * item.quantity)}</strong>
              <button class="btn secondary" data-remove="${item.id}">Remove</button>
            </div>
          `).join("")}
        </div>
        <aside class="panel cart-summary">
          <h3>Total</h3>
          <strong style="font-size:32px">${money(total)}</strong>
          <button class="btn" id="checkoutBtn" style="width:100%;margin-top:16px">Checkout</button>
          <div id="paymentBox"></div>
        </aside>
      </section>
    `;
    
    document.querySelectorAll("[data-inc]").forEach((button) => {
      button.addEventListener("click", async () => {
        const productId = button.dataset.inc;
        try {
          await api("/api/cart/items", { 
            method: "POST", 
            body: JSON.stringify({ productId, quantity: 1 }) 
          });
          await renderCart();
        } catch (err) {
          console.error("Failed to increment quantity:", err);
        }
      });
    });
    
    document.querySelectorAll("[data-dec]").forEach((button) => {
      button.addEventListener("click", async () => {
        const productId = button.dataset.dec;
        try {
          const cartResponse = await api("/api/cart");
          let cartItems = [];
          if (cartResponse && Array.isArray(cartResponse.items)) {
            cartItems = cartResponse.items;
          }
          
          const item = cartItems.find(i => i.productId === productId);
          
          if (item && item.quantity > 1) {
            const newQuantity = item.quantity - 1;
            await api(`/api/cart/items/${productId}`, { 
              method: "PATCH", 
              body: JSON.stringify({ quantity: newQuantity }) 
            });
          } else {
            await api(`/api/cart/items/${productId}`, { method: "DELETE" });
          }
          await renderCart();
        } catch (err) {
          console.error("Failed to decrement quantity:", err);
        }
      });
    });
    
    document.querySelectorAll("[data-remove]").forEach((button) => {
      button.addEventListener("click", async () => {
        const productId = button.dataset.remove;
        try {
          await api(`/api/cart/items/${productId}`, { method: "DELETE" });
          await renderCart();
        } catch (err) {
          console.error("Failed to remove item:", err);
        }
      });
    });
    
    const checkoutBtn = document.getElementById("checkoutBtn");
    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", async () => {
        try {
          const data = await api("/api/cart/checkout", { method: "POST", body: "{}" });
          state.payment = data.payment;
          document.getElementById("paymentBox").innerHTML = `
            <hr>
            <h3>Scan to Pay</h3>
            <img class="qr" src="${state.payment.qrCode}" alt="Payment QR">
            <p>Exact amount: <strong>${money(state.payment.amount)}</strong></p>
            <button class="btn teal" id="paidBtn">I Paid</button>
          `;
          const paidBtn = document.getElementById("paidBtn");
          if (paidBtn) {
            paidBtn.addEventListener("click", async () => {
              await api(`/api/cart/payments/${state.payment.id}/confirm`, { method: "POST", body: "{}" });
              state.payment = null;
              await renderCart();
            });
          }
        } catch (err) {
          document.getElementById("paymentBox").innerHTML = `<p class="error">Checkout failed: ${err.message}</p>`;
        }
      });
    }
    
  } catch (error) {
    console.error("Error rendering cart:", error);
    document.getElementById("view").innerHTML = `
      <div class="panel error">
        <h3>Failed to load cart</h3>
        <p>${escapeHtml(error.message)}</p>
        <button class="btn" onclick="renderCart()">Try Again</button>
      </div>
    `;
  }
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
  
  try {
    // Use direct /api/yoga endpoint
    const data = await api("/api/yoga");
    state.yoga = data.yoga || [];
    
    document.getElementById("view").innerHTML = `
      <div class="grid yoga-grid">
        ${state.yoga.length ? state.yoga.map((pose) => `
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
        `).join("") : '<p class="muted">No yoga poses available.</p>'}
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
    
  } catch (error) {
    console.error("Error loading yoga:", error);
    document.getElementById("view").innerHTML = `<div class="panel error">Failed to load yoga: ${error.message}</div>`;
  }
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
  
  try {
    // Use direct /api/doctors endpoint
    const data = await api("/api/doctors");
    const doctors = data.doctors || [];
    
    document.getElementById("view").innerHTML = `
      <div class="doctor-directory">
        ${doctors.length ? doctors.map((doctor) => `
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
    
  } catch (error) {
    console.error("Error loading doctors:", error);
    document.getElementById("view").innerHTML = `<div class="panel error">Failed to load doctors: ${error.message}</div>`;
  }
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
  setTitle("Education", "Menstruation info, health tips, and basic sex education.");
  
  try {
    // Use direct /api/education endpoint
    const data = await api("/api/education");
    const education = data.education || [];
    
    document.getElementById("view").innerHTML = `
      <div class="grid">
        ${education.length ? education.map((item) => `
          <article class="edu-card">
            <p class="muted">${escapeHtml(item.topic)}</p>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.body)}</p>
          </article>
        `).join("") : `
          <div class="panel">
            <p>Education content coming soon!</p>
          </div>
        `}
      </div>
    `;
    
  } catch (error) {
    console.error("Error loading education:", error);
    document.getElementById("view").innerHTML = `
      <div class="panel error">
        Failed to load education content: ${error.message}
      </div>
    `;
  }
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