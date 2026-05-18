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
  ["community", "Community"],
  ["education", "Education"],
  ["games", "Games"],
  ["entertainment", "Entertainment"], // Add this line
  ["profile", "Profile"]
];


const communityState = {
  chats: [],
  groups: [],
  onlineUsers: [],
  messages: [],
  currentChat: null,
  activeTab: 'chats',
  unreadCounts: {},
  socket: null,
  isConnecting: false,
  call: {
    active: false,
    type: null,
    peerConnection: null,
    localStream: null,
    remoteStream: null,
    targetId: null,
    callerName: null,
    startTime: null,
    status: null,
    timeout: null
  },
  ringtone: null,
  voiceRecorder: {
    mediaRecorder: null,
    stream: null,
    chunks: [],
    startTime: null,
    stopButton: null,
    timerInterval: null
  }
};


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
      const response = await fetch(`/api/auth/${isSignup ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }
      
      if (!data.token) {
        showMessage("authMessage", "Server error: No token received", true);
        return;
      }
      
      localStorage.setItem("menstrumateToken", data.token);
      localStorage.setItem("menstrumateRole", role);
      state.token = data.token;
      state.role = role;
      state.account = data.account;
      
      if (role === "doctor") {
        showMessage("authMessage", "Redirecting to doctor dashboard...", false);
        setTimeout(() => {
          window.location.href = "/doctor-dashboard.html";
        }, 1500);
      } else if (data.account?.isFirstLogin) {
        window.location.href = "/symptoms.html?onboarding=1";
      } else {
        window.location.href = "/";
      }
    } catch (err) {
      showMessage("authMessage", err.message, true);
    }
  });
}

async function renderApp() {
  if (!state.token) return renderLanding();
  if (!state.account) {
    try {
      const data = await api("/api/auth/me");
      state.account = data.account;
    } catch (err) {
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
  document.getElementById("logoutBtn").addEventListener("click", () => {
  showLogoutConfirm();
});
  document.getElementById("refreshBtn").addEventListener("click", () => loadView());
  await loadView();
}

async function loadView() {
  const loaders = {
    dashboard: renderDashboard,
    symptoms: renderSymptoms,
    shop: renderShop,
    cart: renderCart,
    diet: renderDiet,
    yoga: renderYoga,
    doctors: renderDoctors,
    profile: renderProfile,
    community: renderCommunity,
    education: renderEducation,
    entertainment: renderEntertainment,
    games: renderGames
  };
  
  if (loaders[state.view]) {
    await loaders[state.view]();
  } else {
    console.error(`Unknown view: ${state.view}`);
    await renderDashboard();
  }
}


function showLogoutConfirm() {
  // Remove existing modal if any
  document.getElementById("logoutModal")?.remove();

  const modal = document.createElement("div");
  modal.id = "logoutModal";
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.6); z-index: 10000;
    display: flex; align-items: center; justify-content: center;
  `;
  
  modal.innerHTML = `
    <div style="
      background: white; border-radius: 16px; padding: 30px;
      max-width: 400px; width: 90%; text-align: center;
      animation: slideUp 0.3s ease;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    ">
      <div style="font-size: 48px; margin-bottom: 16px;">👋</div>
      <h3 style="margin: 0 0 8px 0;">Ready to leave?</h3>
      <p class="muted" style="margin-bottom: 24px;">Are you sure you want to log out?</p>
      <div style="display: flex; gap: 12px;">
        <button id="confirmLogoutBtn" style="
          flex: 1; padding: 12px; background: #e91e63; color: white;
          border: none; border-radius: 8px; cursor: pointer; font-size: 14px;
        ">Yes, Logout</button>
        <button id="cancelLogoutBtn" style="
          flex: 1; padding: 12px; background: #f5f5f5; color: #333;
          border: none; border-radius: 8px; cursor: pointer; font-size: 14px;
        ">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("confirmLogoutBtn").addEventListener("click", () => {
    modal.remove();
    logout();
  });

  document.getElementById("cancelLogoutBtn").addEventListener("click", () => {
    modal.remove();
  });

  // Close on background click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

async function renderSymptomsLink() {
  window.location.href = "/symptoms.html";
}

async function renderSymptoms() {
  setTitle("Log Symptoms", "Track your daily symptoms, pain levels, and share with your doctor.");
  const view = document.getElementById("view");
  const today = new Date().toISOString().slice(0, 10);
  
  try {
    const symptomData = await api(`/api/symptoms?_=${Date.now()}`).catch(() => ({ data: { symptoms: [] } }));
    const symptoms = symptomData?.data?.symptoms || symptomData?.symptoms || [];
    const todaySymptoms = symptoms.find(s => s.date === today);
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
            <textarea id="notes" rows="3">${todaySymptoms?.notes || ''}</textarea>
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
    
    const painSlider = document.getElementById("painLevel");
    const painDisplay = document.getElementById("painValueDisplay");
    painSlider.addEventListener("input", () => {
      painDisplay.textContent = painSlider.value;
    });
    
    document.getElementById("symptomsForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const selectedSymptoms = Array.from(document.querySelectorAll('input[name="symptoms"]:checked')).map(cb => cb.value);
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
        if (todaySymptoms) {
          const symptomId = todaySymptoms.symptomId || todaySymptoms.id;
          try {
            await api(`/api/symptoms/${symptomId}`, { method: "DELETE" });
          } catch (deleteErr) {}
        }
        
        await api("/api/symptoms", {
          method: "POST",
          body: JSON.stringify(symptomDataToSave)
        });
        
        messageBox.className = "notice";
        messageBox.textContent = "✅ Symptoms saved successfully!";
        localStorage.setItem('menstrumateSymptomsUpdated', Date.now().toString());
        setTimeout(() => {
          state.view = "dashboard";
          renderApp();
        }, 1500);
      } catch (err) {
        messageBox.className = "notice error";
        messageBox.textContent = `❌ Failed to save symptoms: ${err.message}`;
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
    
    document.getElementById("backToDashboardBtn").addEventListener("click", () => {
      state.view = "dashboard";
      renderApp();
    });
  } catch (error) {
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
  document.getElementById("checkinModal")?.remove();
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
  setTitle("Dashboard", "Personalized predictions, insights, and live account data.");
  const view = document.getElementById("view");
  
  if (state.role === "doctor") {
    view.innerHTML = `<div class="panel"><h3>Doctor profile is active</h3><p class="muted">Users can now see your profile in their doctor list.</p></div>`;
    return;
  }
  
  const symptomsUpdated = localStorage.getItem('menstrumateSymptomsUpdated');
  if (symptomsUpdated) localStorage.removeItem('menstrumateSymptomsUpdated');
  
  if (state.account?.isFirstLogin) {
    state.account.isFirstLogin = false;
    await renderSymptoms();
    return;
  }
  
  try {
    const timestamp = Date.now();
    const userData = await api(`/api/auth/me?_=${timestamp}`);
    if (userData.account) {
      state.account.cycleLength = userData.account.cycleLength;
      state.account.lastPeriod = userData.account.lastPeriod;
    }
    
    const [cycleData, notices, symptomData, analyticsData, insightData] = await Promise.all([
      api(`/api/cycle?_=${timestamp}`).catch(() => ({ insights: {}, cycle: [], expectedSymptoms: [], recommendedActions: [], history: [] })),
      api(`/api/notifications?_=${timestamp}`).catch(() => ({ messages: [] })),
      api(`/api/symptoms?_=${timestamp}`).catch(() => ({ data: { symptoms: [] } })),
      api(`/api/cycle/analytics/${state.account.id}?_=${timestamp}`).catch(() => ({ analytics: { painTrend: [], frequency: [] } })),
      api("/api/cycle/insights", { method: "POST", body: JSON.stringify({}) }).catch(() => ({ insights: [] }))
    ]);
    
    // Fetch enhanced data
    const enhancedData = await api("/api/cycle/enhanced-symptoms").catch(() => null);
    
    const symptoms = symptomData?.data?.symptoms || symptomData?.symptoms || [];
    const latestSymptom = symptoms[0] || null;
    const insights = cycleData?.insights || { nextPeriod: 'N/A', ovulation: 'N/A', todayPhase: 'Unknown', predictionConfidence: 0, irregularCycle: false };
    const cycle = cycleData?.cycle || [];
    const analytics = analyticsData?.analytics || { painTrend: [], frequency: [] };
    const noticesMessages = notices?.messages || [];
    const expectedSymptoms = cycleData?.expectedSymptoms || [];
    const recommendedActions = cycleData?.recommendedActions || [];
    const insightList = insightData?.insights || [];
    const lastPeriodDate = cycle[0]?.date || state.account.lastPeriod || '';
    const cycleHistory = cycleData?.history || [];
    
    view.innerHTML = `
      <div class="grid premium-metrics">
        <div class="panel metric glass-card"><span class="muted">Next Period</span><strong>${insights.nextPeriod}</strong></div>
        <div class="panel metric glass-card"><span class="muted">Ovulation</span><strong>${insights.ovulation}</strong></div>
        <div class="panel metric glass-card"><span class="muted">Today’s Phase</span><strong>${escapeHtml(insights.todayPhase)}</strong></div>
        <div class="panel metric glass-card"><span class="muted">Confidence</span><strong>${escapeHtml(insights.predictionConfidence)}%</strong></div>
      </div>
      ${insights.irregularCycle ? `<div class="notice error">⚠️ Irregular cycle pattern detected. Predictions may be less accurate.</div>` : ""}
      
      <div class="grid" style="margin-top:16px">
        <div class="panel"><h3>Expected Symptoms</h3>${expectedSymptoms.length ? renderFrequencyBadges(expectedSymptoms.map(s => ({ symptom: s, count: "phase" }))) : '<p class="muted">No expected symptoms for this phase.</p>'}</div>
        <div class="panel"><h3>Recommended Actions</h3>${recommendedActions.length ? recommendedActions.map(i => `<p>${escapeHtml(i)}</p>`).join("") : '<p class="muted">No recommendations at this time.</p>'}</div>
      </div>
      
      <!-- Period Alert Setup -->
      <div class="panel flow-panel" style="margin-top:16px">
        <h3>Period Alert Setup</h3>
        <div id="cycleMessage" class="notice" style="display:none; margin-bottom:16px"></div>
        <form id="cycleForm" class="form-grid">
          <label class="field">
            <span>Last Period Start</span>
            <input id="cycleDate" type="date" value="${lastPeriodDate}" required>
            <small class="muted" id="dateWarning" style="display:none; color:#e91e63;"></small>
          </label>
          <label class="field">
            <span>Cycle Length (days) – optional</span>
            <input id="cycleLength" type="number" min="20" max="45" placeholder="Auto‑calculated" value="${state.account.cycleLength || ''}">
            <small class="muted" id="cycleLengthPreview"></small>
          </label>
          <div class="field"><button class="btn" id="saveCycleBtn">Save Cycle Settings</button></div>
        </form>
      </div>
      
      <!-- Cycle History -->
      <div class="panel" style="margin-top:16px">
        <h3>Cycle History</h3>
        <div id="cycleHistoryList" class="cycle-history-list">
          ${cycleHistory.length ? `
            <table style="width:100%; border-collapse:collapse;">
              <thead>
                <tr><th>Start Date</th><th>Cycle Length</th><th>Recorded On</th></tr>
              </thead>
              <tbody>
                ${cycleHistory.slice().reverse().slice(0, 10).map(entry => `
                  <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:8px 4px;">${escapeHtml(entry.startDate)}</td>
                    <td style="padding:8px 4px;">${escapeHtml(entry.cycleLength)} days</td>
                    <td class="muted" style="padding:8px 4px;">${new Date(entry.recordedAt || entry.createdAt).toLocaleDateString()}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            ${cycleHistory.length > 10 ? `<p class="muted" style="margin-top:8px; text-align:center;">+ ${cycleHistory.length - 10} more cycles. View full history in Profile →</p>` : ''}
            <div style="margin-top:8px; text-align:right;">
              <a href="#profile" class="btn secondary" style="font-size:12px; padding:4px 12px;">View full history in Profile →</a>
            </div>
          ` : `<p class="muted">No past cycles recorded yet. Save your first period date above to start tracking.</p>`}
        </div>
      </div>
      
      <div class="panel reminders-panel" style="margin-top:16px">
        <h3>Smart Reminders</h3>
        ${noticesMessages.length ? noticesMessages.map(msg => `<p>${escapeHtml(msg)}</p>`).join("") : '<p class="muted">No reminders at this time.</p>'}
      </div>
      
      <div class="panel" style="margin-top:16px">
        <h3>Today's Symptoms</h3>
        ${latestSymptom ? `
          <p class="muted">${escapeHtml(latestSymptom.date)}${latestSymptom.sharedWithDoctor ? " · Shared with doctor" : " · Private"}</p>
          <p><strong>${(latestSymptom.symptoms || []).map(escapeHtml).join(", ")}</strong></p>
          <p>Pain level: <strong>${escapeHtml(latestSymptom.painLevel)}/10</strong></p>
          ${latestSymptom.notes ? `<p>${escapeHtml(latestSymptom.notes)}</p>` : ""}
          <div class="btn-row">
            <button class="btn secondary" id="updateSymptomsBtn">Update Symptoms</button>
            <button class="btn secondary" id="refreshDashboardBtn">⟳ Refresh</button>
          </div>
        ` : `
          <p class="muted">No symptoms logged today.</p>
          <div class="btn-row">
            <button class="btn" id="logSymptomsBtn">Log Symptoms</button>
            <button class="btn secondary" id="refreshDashboardBtn">⟳ Refresh</button>
          </div>
        `}
      </div>
      
      <div class="grid" style="margin-top:16px">
        <div class="panel"><h3>Pain Trend (Last 14 Days)</h3>${renderPainBars(analytics.painTrend)}</div>
        <div class="panel"><h3>Symptom Frequency</h3>${renderFrequencyBadges(analytics.frequency)}</div>
      </div>
      
      <div class="panel" style="margin-top:16px">
        <h3>AI Insights</h3>
        <div class="grid">${insightList.length ? insightList.slice(0, 6).map(item => `<article class="diet-day"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.message)}</span><span class="muted">${escapeHtml(item.action)}</span></article>`).join("") : '<p class="muted">No insights yet. Log more symptoms for personalized insights.</p>'}</div>
      </div>
      
      <div class="panel calendar-panel" style="margin-top:16px">
        <h3>Cycle Calendar</h3>
        <div class="calendar">${Array.isArray(cycle) && cycle.length ? cycle.slice(0, 35).map(day => `<div class="day ${day.phase}"><strong>Day ${day.day}</strong><br>${day.date}<br>${day.phase}</div>`).join("") : '<p>No cycle data. Set your last period date above.</p>'}</div>
      </div>
      
      <!-- Enhanced Features Section -->
      <div id="enhancedFeaturesContainer"></div>
    `;
    
    // ========== ENHANCED FEATURES DISPLAY ==========
    const enhancedContainer = document.getElementById("enhancedFeaturesContainer");
    if (enhancedData?.data && enhancedContainer) {
      const { phase, dayInCycle, enhancedSymptoms, symptomTrends, seasonalTrends } = enhancedData.data;
      
      let enhancedHtml = `
        <div class="panel" style="margin-top:16px">
          <h3>📊 Enhanced Symptom Predictions</h3>
          <p class="muted">Day ${dayInCycle} of ${phase} phase</p>
      `;
      
      // Personalized Symptoms Section
      if (enhancedSymptoms.personalized && enhancedSymptoms.personalized.length > 0) {
        enhancedHtml += `
          <div style="margin-top: 16px;">
            <h4>🎯 Based on your history</h4>
            <div class="symptom-badges">
              ${enhancedSymptoms.personalized.map(s => {
                const severityColor = s.severity?.color || "#9e9e9e";
                const severityLabel = s.severity?.level || "unknown";
                const severityIcon = severityLabel === "high" ? "🔴" : severityLabel === "medium" ? "🟠" : severityLabel === "low" ? "🟢" : severityLabel === "positive" ? "✨" : "⚪";
                return `
                  <div style="display: inline-block; margin: 4px; padding: 8px 12px; background: #f0f0f0; border-radius: 20px; border-left: 4px solid ${severityColor};">
                    <strong>${escapeHtml(s.symptom)}</strong>
                    <small style="margin-left: 8px;">${s.probability}% of cycles</small>
                    <span style="margin-left: 8px; font-size: 12px;">${severityIcon}</span>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        `;
      } else {
        enhancedHtml += `<div style="margin-top: 16px;"><p class="muted">📝 Log more cycles for personalized predictions</p></div>`;
      }
      
      // General Symptoms with Severity
      if (enhancedSymptoms.general && enhancedSymptoms.general.length > 0) {
        enhancedHtml += `
          <div style="margin-top: 16px;">
            <h4>📚 Common symptoms this phase</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;">
              ${enhancedSymptoms.general.map(symptom => `
                <div style="padding: 8px 12px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #ff9800;">
                  <strong>${escapeHtml(symptom)}</strong>
                  <div style="height: 4px; background: #e0e0e0; margin: 6px 0; border-radius: 2px;">
                    <div style="width: 60%; height: 100%; background: #ff9800; border-radius: 2px;"></div>
                  </div>
                  <small class="muted">May appear during this phase</small>
                </div>
              `).join("")}
            </div>
          </div>
        `;
      }
      
      // Confidence Level Section
      if (enhancedSymptoms.confidence) {
        const conf = enhancedSymptoms.confidence;
        enhancedHtml += `
          <div style="margin-top: 16px; padding: 12px; background: ${conf.color}20; border-radius: 8px;">
            <h4>Confidence Level: ${conf.percentage}%</h4>
            <div style="height: 8px; background: #e0e0e0; border-radius: 4px; margin: 8px 0;">
              <div style="width: ${conf.percentage}%; height: 100%; background: ${conf.color}; border-radius: 4px;"></div>
            </div>
            <p class="muted">${conf.message}</p>
            <details>
              <summary style="cursor: pointer; color: #666;">Why?</summary>
              <ul style="margin-top: 8px; padding-left: 20px;">
                ${conf.reasons.map(r => `<li>${r}</li>`).join("")}
              </ul>
            </details>
          </div>
        `;
      }
      
      // Preventive Actions Section
      if (enhancedSymptoms.preventiveActions && enhancedSymptoms.preventiveActions.length > 0) {
        enhancedHtml += `
          <div style="margin-top: 16px;">
            <h4>💡 Try these preventive actions</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 8px;">
              ${enhancedSymptoms.preventiveActions.map(action => `
                <div style="padding: 8px; background: #e3f2fd; border-radius: 8px;">
                  ✨ ${escapeHtml(action)}
                </div>
              `).join("")}
            </div>
          </div>
        `;
      }
      
      // Symptom Trends Section
      if (symptomTrends && symptomTrends.cycles && symptomTrends.cycles.length > 0) {
        enhancedHtml += `
          <div style="margin-top: 16px;">
            <h4>📈 Symptom Trends Over Cycles</h4>
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr>
                    <th style="text-align: left; padding: 8px;">Cycle</th>
                    <th style="text-align: left; padding: 8px;">Start Date</th>
                    <th style="text-align: left; padding: 8px;">Top Symptoms</th>
                    <th style="text-align: left; padding: 8px;">Logs</th>
                  </tr>
                </thead>
                <tbody>
                  ${symptomTrends.cycles.slice(-5).reverse().map(cycle => `
                    <tr style="border-bottom: 1px solid #e0e0e0;">
                      <td style="padding: 8px;">#${cycle.cycleNumber}</td>
                      <td style="padding: 8px;">${cycle.startDate}</td>
                      <td style="padding: 8px;">
                        ${cycle.symptoms.map(s => `
                          <span style="display: inline-block; margin: 2px 4px; padding: 2px 6px; background: #f0f0f0; border-radius: 12px; font-size: 12px;">
                            ${escapeHtml(s.name)} (${s.count})
                          </span>
                        `).join("")}
                      </td>
                      <td style="padding: 8px;">${cycle.symptomCount}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
      
      // Seasonal Trends Section
      if (seasonalTrends && seasonalTrends.seasons) {
        enhancedHtml += `
          <div style="margin-top: 16px;">
            <h4>🌤️ Seasonal Patterns</h4>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px;">
              ${Object.entries(seasonalTrends.seasons).map(([season, data]) => `
                <div style="padding: 12px; background: ${season === seasonalTrends.currentSeason ? '#e3f2fd' : '#f5f5f5'}; border-radius: 8px;">
                  <h4 style="margin: 0 0 8px 0;">${season === seasonalTrends.currentSeason ? '🔵 ' : ''}${season}</h4>
                  <p class="muted" style="margin: 4px 0;">Avg pain: <strong>${data.avgPain.toFixed(1)}/10</strong></p>
                  <p class="muted" style="margin: 4px 0;">Logs: ${data.symptomCount}</p>
                  ${data.symptoms && data.symptoms.length ? `
                    <div style="margin-top: 8px;">
                      <small>Top: ${data.symptoms.slice(0, 2).map(s => s.name).join(", ")}</small>
                    </div>
                  ` : ''}
                </div>
              `).join("")}
            </div>
            ${seasonalTrends.bestSeason ? `
              <div style="padding: 12px; background: #e8f5e9; border-radius: 8px; margin-top: 12px;">
                <p>🌟 <strong>Best season for you:</strong> ${seasonalTrends.bestSeason.name} (Avg pain: ${seasonalTrends.bestSeason.avgPain.toFixed(1)}/10)</p>
                <p>⚠️ <strong>Most challenging:</strong> ${seasonalTrends.worstSeason.name} (Avg pain: ${seasonalTrends.worstSeason.avgPain.toFixed(1)}/10)</p>
                ${seasonalTrends.insights && seasonalTrends.insights.length ? `<p>💡 ${seasonalTrends.insights[0]}</p>` : ''}
              </div>
            ` : ''}
          </div>
        `;
      }
      
      enhancedHtml += `</div>`;
      enhancedContainer.innerHTML = enhancedHtml;
    }
    
    // ========== IMPROVED SAVE HANDLER ==========
    const saveCycleBtn = document.getElementById("saveCycleBtn");
    const cycleDateInput = document.getElementById("cycleDate");
    const cycleLengthInput = document.getElementById("cycleLength");
    const cycleMessage = document.getElementById("cycleMessage");
    const cycleLengthPreview = document.getElementById("cycleLengthPreview");
    const dateWarning = document.getElementById("dateWarning");
    
    // Show auto-calculated length preview when date changes
    if (cycleDateInput && cycleLengthPreview && state.account.lastPeriod) {
      cycleDateInput.addEventListener("change", () => {
        const newDate = cycleDateInput.value;
        if (newDate && state.account.lastPeriod) {
          const diff = Math.round((new Date(newDate) - new Date(state.account.lastPeriod)) / (1000*3600*24));
          if (diff > 0 && diff <= 60) {
            cycleLengthPreview.innerHTML = `📊 Auto‑calculated length: <strong>${diff} days</strong> (if field left empty)`;
            if (diff < 20) {
              cycleLengthPreview.style.color = "#e91e63";
              if (dateWarning) {
                dateWarning.style.display = "inline";
                dateWarning.textContent = `⚠️ Only ${diff} days since last period. This is unusually short.`;
              }
            } else {
              cycleLengthPreview.style.color = "#666";
              if (dateWarning) dateWarning.style.display = "none";
            }
          } else if (diff < 0) {
            cycleLengthPreview.innerHTML = `❌ Cannot set date before previous period (${state.account.lastPeriod})`;
            cycleLengthPreview.style.color = "#e91e63";
          } else {
            cycleLengthPreview.innerHTML = "";
          }
        }
      });
    }
    
    if (saveCycleBtn) {
      saveCycleBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        
        const lastPeriod = cycleDateInput.value;
        let cycleLength = cycleLengthInput.value ? parseInt(cycleLengthInput.value) : null;
        
        if (!lastPeriod) {
          showMessage("cycleMessage", "Please select your last period date", true);
          return;
        }
        
        if (state.account.lastPeriod && lastPeriod <= state.account.lastPeriod) {
          showMessage("cycleMessage", "❌ Last period date must be AFTER your previous period", true);
          return;
        }
        
        if (cycleLength !== null && (isNaN(cycleLength) || cycleLength < 20 || cycleLength > 45)) {
          showMessage("cycleMessage", "Cycle length must be between 20 and 45 days if provided", true);
          return;
        }
        
        if (state.account.lastPeriod) {
          const diff = Math.round((new Date(lastPeriod) - new Date(state.account.lastPeriod)) / (1000*3600*24));
          if (diff > 0 && diff < 18) {
            const confirmed = confirm(`⚠️ Only ${diff} days since your last period (${state.account.lastPeriod}).\n\nThis is unusually short for a menstrual cycle.\n\nClick OK to save anyway, or Cancel to review.`);
            if (!confirmed) return;
          }
        }
        
        const originalText = saveCycleBtn.textContent;
        saveCycleBtn.textContent = "Saving...";
        saveCycleBtn.disabled = true;
        
        if (cycleMessage) {
          cycleMessage.style.display = "block";
          cycleMessage.className = "notice";
          cycleMessage.textContent = "Saving cycle data...";
        }
        
        async function saveCycle(force = false) {
          try {
            const payload = { lastPeriod };
            if (cycleLength !== null) payload.cycleLength = cycleLength;
            if (force) payload.force = true;
            
            const response = await fetch("/api/cycle", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${state.token}`
              },
              body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            if (response.status === 409 && data.requiresForce) {
              const userConfirmed = confirm(
                `${data.warning}\n\n${data.suggestion}\n\nClick OK to save anyway, or Cancel to keep your data.`
              );
              if (userConfirmed) {
                await saveCycle(true);
              } else {
                if (cycleMessage) {
                  cycleMessage.className = "notice error";
                  cycleMessage.textContent = "Save cancelled. Your data was not changed.";
                  cycleMessage.style.display = "block";
                  setTimeout(() => {
                    if (cycleMessage) cycleMessage.style.display = "none";
                  }, 3000);
                }
              }
              return;
            }
            
            if (!response.ok) throw new Error(data.error || "Request failed");
            
            await api("/api/profile", {
              method: "PATCH",
              body: JSON.stringify({ 
                cycleLength: data.data.user.cycleLength, 
                lastPeriod: data.data.user.lastPeriod 
              })
            }).catch(() => {});
            
            if (cycleMessage) {
              cycleMessage.className = "notice";
              cycleMessage.textContent = data.message || "✅ Cycle settings saved successfully! Refreshing dashboard...";
            }
            
            if (state.account) {
              state.account.cycleLength = data.data.user.cycleLength;
              state.account.lastPeriod = data.data.user.lastPeriod;
            }
            
            setTimeout(async () => {
              localStorage.setItem('menstrumateCycleUpdated', Date.now().toString());
              await renderDashboard();
            }, 1500);
            
          } catch (err) {
            if (cycleMessage) {
              cycleMessage.className = "notice error";
              cycleMessage.textContent = `❌ Failed to save: ${err.message}`;
              cycleMessage.style.display = "block";
            }
            saveCycleBtn.textContent = originalText;
            saveCycleBtn.disabled = false;
            setTimeout(() => {
              if (cycleMessage) cycleMessage.style.display = "none";
            }, 3000);
          }
        }
        
        await saveCycle();
      });
    }
    
    document.getElementById("logSymptomsBtn")?.addEventListener("click", async () => { await renderSymptoms(); });
    document.getElementById("updateSymptomsBtn")?.addEventListener("click", async () => { await renderSymptoms(); });
    document.getElementById("refreshDashboardBtn")?.addEventListener("click", async () => { await renderDashboard(); });
    
    maybeShowDailyCheckin(latestSymptom);
    
  } catch (error) {
    console.error("Dashboard error:", error);
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
    
    return { products: state.products, cart: state.cart };
  } catch (error) {
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
    const cartCount = state.cart.reduce((sum, item) => (sum + (item?.quantity || 0)), 0);
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
          await api("/api/cart/items", { method: "POST", body: JSON.stringify({ productId, quantity: 1 }) });
          button.textContent = "Added!";
          setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove("is-adding");
            button.disabled = false;
          }, 1500);
          
          await getProductsAndCart();
          const updatedCartCount = state.cart.reduce((sum, item) => (sum + (item?.quantity || 0)), 0);
          const cartButton = document.getElementById("goCart");
          if (cartButton) cartButton.textContent = `Cart (${updatedCartCount})`;
        } catch (err) {
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
    view.innerHTML = `<div class="panel error">Failed to load shop: ${error.message}</div>`;
  }
}

async function renderCart() {
  setTitle("Cart", "Update quantities, remove items, and checkout with exact amount QR.");
  
  try {
    await getProductsAndCart();
    
    if (!state.cart || state.cart.length === 0) {
      document.getElementById("view").innerHTML = `
        <div class="panel"><h3>Your cart is empty</h3><p>Start shopping to add items to your cart.</p><button class="btn" onclick="renderShop()">Continue Shopping</button></div>
      `;
      return;
    }
    
    const rows = state.cart.map((entry) => {
      const productId = entry.productId;
      const quantity = entry.quantity;
      let product = entry.product || state.products.find((p) => p.id === productId);
      if (!product) return null;
      return { ...product, quantity, id: product.id || productId };
    }).filter(item => item !== null);
    
    const total = rows.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    document.getElementById("view").innerHTML = `
      <section class="checkout cart-layout">
        <div class="cart-list">
          ${rows.map((item) => `
            <div class="cart-row">
              <img class="cart-thumb" src="${item.image || 'https://via.placeholder.com/100'}" alt="${escapeHtml(item.name)}">
              <div><strong>${escapeHtml(item.name)}</strong><br><span class="muted">${money(item.price)} each</span></div>
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
          await api("/api/cart/items", { method: "POST", body: JSON.stringify({ productId, quantity: 1 }) });
          await renderCart();
        } catch (err) { console.error("Failed to increment quantity:", err); }
      });
    });
    
    document.querySelectorAll("[data-dec]").forEach((button) => {
      button.addEventListener("click", async () => {
        const productId = button.dataset.dec;
        try {
          const cartResponse = await api("/api/cart");
          let cartItems = [];
          if (cartResponse && Array.isArray(cartResponse.items)) cartItems = cartResponse.items;
          const item = cartItems.find(i => i.productId === productId);
          if (item && item.quantity > 1) {
            await api(`/api/cart/items/${productId}`, { method: "PATCH", body: JSON.stringify({ quantity: item.quantity - 1 }) });
          } else {
            await api(`/api/cart/items/${productId}`, { method: "DELETE" });
          }
          await renderCart();
        } catch (err) { console.error("Failed to decrement quantity:", err); }
      });
    });
    
    document.querySelectorAll("[data-remove]").forEach((button) => {
      button.addEventListener("click", async () => {
        const productId = button.dataset.remove;
        try {
          await api(`/api/cart/items/${productId}`, { method: "DELETE" });
          await renderCart();
        } catch (err) { console.error("Failed to remove item:", err); }
      });
    });
    
    const checkoutBtn = document.getElementById("checkoutBtn");
    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", async () => {
        try {
          const data = await api("/api/cart/checkout", { method: "POST", body: "{}" });
          state.payment = data.payment;
          document.getElementById("paymentBox").innerHTML = `
            <hr><h3>Scan to Pay</h3><img class="qr" src="${state.payment.qrCode}" alt="Payment QR"><p>Exact amount: <strong>${money(state.payment.amount)}</strong></p>
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
    document.getElementById("view").innerHTML = `<div class="panel error">Failed to load cart: ${error.message}</div>`;
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
      const data = await api(`/api/appointments/slots/${doctorId}?date=${encodeURIComponent(document.getElementById("appointmentDate").value)}`);
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

// Add this function BEFORE renderEducation in your app.js
async function fetchWikipediaArticles() {
  const searchQueries = [
    // Cycle & Basics
    "Menstrual_cycle", "Menstruation", "Ovulation",
    // Pain & Symptoms
    "Dysmenorrhea", "Premenstrual_syndrome", "Premenstrual_dysphoric_disorder",
    "Menstrual_pain",
    // Health Conditions
    "Polycystic_ovary_syndrome", "Endometriosis", "Uterine_fibroid",
    "Ovarian_cyst", "Pelvic_inflammatory_disease", "Cervical_cancer",
    "Breast_cancer", "Osteoporosis",
    // Hormones & Science
    "Menopause", "Perimenopause", "Estrogen", "Progesterone",
    // Contraception & Fertility
    "Hormonal_contraception", "Fertility_awareness", "Intrauterine_device",
    // Nutrition
    "Nutrition_and_pregnancy", "Iron_deficiency", "Calcium_in_biology",
    "Vitamin_D_deficiency", "Magnesium_deficiency", "Omega-3_fatty_acid",
    "Dietary_supplement",
    // Women's Health
    "Women's_health", "Menstrual_hygiene", "Vaginal_health",
    "Pelvic_floor", "Menstrual_cup"
  ];
  
  const icons = {
    // Basics
    "Menstrual_cycle": "🩸", "Menstruation": "🩸", "Ovulation": "🌱",
    // Pain
    "Dysmenorrhea": "💆", "Premenstrual_syndrome": "😌", "Premenstrual_dysphoric_disorder": "🧠",
    "Menstrual_pain": "💆",
    // Conditions
    "Polycystic_ovary_syndrome": "🔬", "Endometriosis": "🏥", "Uterine_fibroid": "🩺",
    "Ovarian_cyst": "🔍", "Pelvic_inflammatory_disease": "⚠️", "Cervical_cancer": "🎗️",
    "Breast_cancer": "🎀", "Osteoporosis": "🦴",
    // Hormones
    "Menopause": "🔄", "Perimenopause": "⏳", "Estrogen": "⚖️", "Progesterone": "⚖️",
    // Contraception
    "Hormonal_contraception": "💊", "Fertility_awareness": "📅", "Intrauterine_device": "🔧",
    // Nutrition
    "Nutrition_and_pregnancy": "🤰", "Iron_deficiency": "🩸", "Calcium_in_biology": "🥛",
    "Vitamin_D_deficiency": "☀️", "Magnesium_deficiency": "💪", "Omega-3_fatty_acid": "🐟",
    "Dietary_supplement": "💊",
    // Women's Health
    "Women's_health": "👩‍⚕️", "Menstrual_hygiene": "🧼", "Vaginal_health": "🌸",
    "Pelvic_floor": "🧘‍♀️", "Menstrual_cup": "🥤"
  };
  
  const categories = {
    // Basics
    "Menstrual_cycle": "basics", "Menstruation": "basics", "Ovulation": "science",
    // Pain
    "Dysmenorrhea": "wellness", "Premenstrual_syndrome": "wellness", 
    "Premenstrual_dysphoric_disorder": "health", "Menstrual_pain": "wellness",
    // Conditions
    "Polycystic_ovary_syndrome": "health", "Endometriosis": "health", 
    "Uterine_fibroid": "health", "Ovarian_cyst": "health",
    "Pelvic_inflammatory_disease": "health", "Cervical_cancer": "health",
    "Breast_cancer": "health", "Osteoporosis": "health",
    // Hormones
    "Menopause": "science", "Perimenopause": "science", 
    "Estrogen": "science", "Progesterone": "science",
    // Contraception
    "Hormonal_contraception": "health", "Fertility_awareness": "science", 
    "Intrauterine_device": "health",
    // Nutrition
    "Nutrition_and_pregnancy": "nutrition", "Iron_deficiency": "nutrition",
    "Calcium_in_biology": "nutrition", "Vitamin_D_deficiency": "nutrition",
    "Magnesium_deficiency": "nutrition", "Omega-3_fatty_acid": "nutrition",
    "Dietary_supplement": "nutrition",
    // Women's Health
    "Women's_health": "basics", "Menstrual_hygiene": "basics", 
    "Vaginal_health": "health", "Pelvic_floor": "wellness", 
    "Menstrual_cup": "basics"
  };
  
  try {
    const articles = await Promise.all(
      searchQueries.map(async (query) => {
        try {
          // Get page summary
          const summaryRes = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${query}`
          );
          if (!summaryRes.ok) return null;
          const summary = await summaryRes.json();
          
          // Get full HTML content
          let body = summary.extract; // Default to summary
          
          try {
            const htmlRes = await fetch(
              `https://en.wikipedia.org/w/api.php?action=parse&page=${query}&prop=text&format=json&origin=*`
            );
            if (htmlRes.ok) {
              const htmlData = await htmlRes.json();
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = htmlData.parse.text['*'];
              
              // Remove unwanted elements
              tempDiv.querySelectorAll(
                '.infobox, .navbox, .mw-empty-elt, .reference, .reflist, .mw-editsection, .toc, table, .sidebar, .metadata, .shortdescription, style, script, .mw-references-wrap, .authority-control, .navbox-styles'
              ).forEach(el => el.remove());
              
              let text = tempDiv.textContent || tempDiv.innerText || '';
              text = text.replace(/\s+/g, ' ').trim();
              
              // Get first few paragraphs (avoid tables of contents etc)
              const paragraphs = text.split('. ');
              let meaningfulText = '';
              let count = 0;
              for (const p of paragraphs) {
                if (p.length > 50) { // Skip short fragments
                  meaningfulText += p + '. ';
                  count++;
                  if (count >= 8) break; // Get ~8 good paragraphs
                }
              }
              
              if (meaningfulText.length > 200) {
                body = meaningfulText.trim();
              }
            }
          } catch (e) {
            // Continue with summary if full content fails
          }
          
          return {
            id: query.toLowerCase().replace(/_/g, '-'),
            topic: summary.title,
            title: summary.title,
            body: body.length > 100 ? body : summary.extract,
            icon: icons[query] || "📖",
            readTime: `${Math.ceil((body.split(' ').length || 200) / 200)} min`,
            category: categories[query] || "basics",
            thumbnail: summary.thumbnail?.source
          };
        } catch {
          return null;
        }
      })
    );
    
    return articles.filter(a => a !== null && a.body && a.body.length > 100);
  } catch (err) {
    console.log("Wikipedia fetch failed:", err);
    return [];
  }
}

// UPDATED renderEducation function
async function renderEducation() {
  setTitle("Education Center", "Learn about menstrual health, wellness, and self-care");
  
  try {
    // Try fetching from Wikipedia first (free API, no key needed)
    let education = await fetchWikipediaArticles();
    
    // If Wikipedia fails, use hardcoded backup
    if (!education.length) {
      education = [
        {
          id: "cycle-basics",
          topic: "Menstrual Cycle",
          title: "Understanding Your Menstrual Cycle: A Complete Guide",
          body: "The menstrual cycle is a complex, natural process that prepares your body for pregnancy each month. A typical cycle lasts 28 days but can range from 21 to 35 days in adults and 21 to 45 days in teens. The cycle is controlled by hormones including estrogen, progesterone, FSH, and LH. Understanding your unique cycle helps you predict periods, recognize ovulation, and identify potential health issues early.",
          icon: "🩸",
          readTime: "8 min",
          category: "basics"
        },
        {
          id: "cycle-phases",
          topic: "Cycle Phases",
          title: "The Four Phases of Your Menstrual Cycle Explained",
          body: "Phase 1 - Menstruation (Days 1-5): The uterine lining sheds, causing bleeding. Estrogen and progesterone are at their lowest. Phase 2 - Follicular (Days 6-14): FSH stimulates follicles, estrogen rises, uterine lining thickens. Phase 3 - Ovulation (Day 14-16): LH surge triggers egg release. Phase 4 - Luteal (Days 15-28): Progesterone dominates, preparing for possible pregnancy. Each phase brings unique physical and emotional changes.",
          icon: "📊",
          readTime: "10 min",
          category: "basics"
        },
        {
          id: "pain-management",
          topic: "Pain Relief",
          title: "Comprehensive Guide to Managing Menstrual Pain & Cramps",
          body: "Menstrual cramps (dysmenorrhea) affect 50-90% of women. Primary remedies include: NSAIDs like ibuprofen (take at first sign of pain), heat therapy (heating pad at 104°F/40°C for 15-20 min), gentle exercise like yoga (child's pose, cat-cow), adequate hydration, magnesium supplements (300-400mg daily), omega-3 fatty acids, and acupuncture. For severe pain, consult a doctor about prescription options or underlying conditions like endometriosis.",
          icon: "💆",
          readTime: "12 min",
          category: "wellness"
        },
        {
          id: "diet-tips",
          topic: "Nutrition",
          title: "Optimal Nutrition Guide for Each Menstrual Phase",
          body: "Menstrual Phase: Focus on iron-rich foods (spinach, lentils, red meat, pumpkin seeds), vitamin C for absorption, and warm, cooked foods. Follicular Phase: Fermented foods (kimchi, yogurt), healthy fats (avocado, nuts), and complex carbs (quinoa, sweet potato). Ovulation Phase: High-fiber vegetables, antioxidants (berries), lean proteins. Luteal Phase: Complex carbs to combat cravings, magnesium-rich foods (dark chocolate 70%+, nuts, bananas), B vitamins, and calcium-rich foods to reduce PMS symptoms.",
          icon: "🥗",
          readTime: "15 min",
          category: "nutrition"
        },
        {
          id: "exercise-guide",
          topic: "Fitness",
          title: "Exercise Guide: Workout According to Your Cycle Phase",
          body: "Menstruation: Focus on restorative practices - gentle yoga, walking, stretching. Listen to your body and rest if needed. Follicular Phase: Energy peaks! Ideal for HIIT, strength training, running, and new fitness challenges. Ovulation: Testosterone peaks - excellent for PR attempts, competitive sports, and social workouts. Luteal Phase: Moderate exercise - swimming, pilates, hiking, cycling. Reduce intensity as period approaches. Track your performance to optimize training.",
          icon: "🏃‍♀️",
          readTime: "10 min",
          category: "wellness"
        },
        {
          id: "pms-relief",
          topic: "PMS Management",
          title: "Natural & Medical Solutions for PMS Relief",
          body: "PMS affects 75% of women with symptoms like mood swings, bloating, and fatigue. Natural remedies include: regular aerobic exercise (30 min daily), stress reduction techniques (meditation, deep breathing), sleep hygiene (7-9 hours), calcium supplements (1200mg daily), vitamin B6, evening primrose oil, and chasteberry. Dietary changes: reduce salt, caffeine, alcohol, and sugar 7-10 days before period. For PMDD (severe PMS affecting 3-8% of women), consult about SSRIs or hormonal treatments.",
          icon: "😌",
          readTime: "12 min",
          category: "wellness"
        },
        {
          id: "when-see-doctor",
          topic: "Medical Care",
          title: "When to See a Doctor: Key Warning Signs",
          body: "Consult a gynecologist if you experience: periods that suddenly stop for 3+ months (not pregnancy/breastfeeding related), pain so severe it prevents daily activities, bleeding that soaks through pad/tampon every 1-2 hours, cycles shorter than 21 or longer than 35 days consistently, severe PMS/PMDD affecting mental health, unusual discharge with odor, or postmenopausal bleeding. Early diagnosis of conditions like endometriosis, PCOS, or fibroids prevents complications.",
          icon: "👩‍⚕️",
          readTime: "8 min",
          category: "health"
        },
        {
          id: "hormone-balance",
          topic: "Endocrinology",
          title: "Hormones Through Your Cycle: Estrogen, Progesterone & More",
          body: "Estrogen peaks twice: before ovulation (dominates follicular phase) and mid-luteal phase. It boosts mood, energy, and libido. Progesterone rises after ovulation, promoting calm but also PMS symptoms. FSH stimulates egg development; LH triggers ovulation. Testosterone peaks at ovulation, increasing libido. Hormonal imbalances can cause irregular periods, acne, weight changes, mood disorders, and fertility issues. Blood tests on cycle day 3 and 21 can assess hormone levels accurately.",
          icon: "⚖️",
          readTime: "12 min",
          category: "science"
        },
        {
          id: "contraception",
          topic: "Birth Control",
          title: "Complete Guide to Contraception: Options, Effectiveness & Safety",
          body: "Barrier Methods: Male condoms (98% effective), female condoms (95%), diaphragms (88%). Hormonal: Combined pill (91% typical use), mini-pill (91%), patch (91%), vaginal ring (91%), implant (99.95%), IUD hormonal (99.8%), IUD copper (99.2%). Emergency: Plan B within 72 hours, Ella within 120 hours. Permanent: Tubal ligation, vasectomy. Fertility awareness methods (76-88% effective). Each method has unique benefits, side effects, and considerations - consult your doctor to find your best match.",
          icon: "💊",
          readTime: "15 min",
          category: "health"
        },
        {
          id: "mental-health",
          topic: "Mental Wellness",
          title: "Mental Health & Your Menstrual Cycle: Managing Mood Changes",
          body: "Hormonal fluctuations directly impact neurotransmitters like serotonin and dopamine. During the luteal phase, lower serotonin can cause depression, anxiety, irritability, and brain fog. PMDD (Premenstrual Dysphoric Disorder) is a severe form affecting 3-8% of women, diagnosed by tracking symptoms for 2+ cycles. Management includes: CBT therapy, SSRIs (continuous or luteal-phase only), lifestyle modifications (exercise, sleep, nutrition), and hormone treatments. Track mood daily to identify patterns and triggers.",
          icon: "🧠",
          readTime: "14 min",
          category: "wellness"
        },
        {
          id: "sleep-hygiene",
          topic: "Sleep Science",
          title: "How Your Menstrual Cycle Affects Sleep Quality",
          body: "Sleep patterns change throughout your cycle due to hormonal fluctuations. During the luteal phase, rising progesterone can increase sleepiness but also fragment sleep. PMS symptoms like cramps, anxiety, and night sweats disrupt sleep. Estrogen drops before menstruation, reducing REM sleep quality. Tips: maintain consistent sleep schedule, lower bedroom temperature to 65-68°F (18-20°C) during luteal phase, use blackout curtains, avoid screens 1-2 hours before bed, try magnesium supplements and chamomile tea before sleep.",
          icon: "😴",
          readTime: "10 min",
          category: "wellness"
        },
        {
          id: "fertility-awareness",
          topic: "Fertility",
          title: "Fertility Awareness: Understanding Your Fertile Window & Ovulation",
          body: "Your fertile window spans 6 days: 5 days before ovulation plus ovulation day. Sperm survive up to 5 days; the egg survives 12-24 hours. Signs of ovulation: clear, stretchy cervical mucus (egg-white consistency), basal body temperature rise (0.5-1°F) after ovulation, cervical position changes (higher, softer, more open), increased libido, and mild pelvic pain (mittelschmerz). Track using apps, OPKs (ovulation predictor kits), or fertility monitors. Understanding your fertile window helps with both conception and natural family planning.",
          icon: "🌱",
          readTime: "12 min",
          category: "science"
        },
        {
          id: "pcos-guide",
          topic: "PCOS",
          title: "Understanding PCOS: Symptoms, Diagnosis & Management",
          body: "Polycystic Ovary Syndrome (PCOS) affects 1 in 10 women of reproductive age. Key features: irregular periods, high androgens (acne, excess hair growth), polycystic ovaries on ultrasound. Diagnosis requires 2 of 3 criteria (Rotterdam criteria). Associated with insulin resistance, weight gain, and fertility challenges. Management: lifestyle modifications (low-glycemic diet, regular exercise), medications (metformin, birth control pills, anti-androgens), and fertility treatments if needed. Early diagnosis prevents long-term complications like diabetes and heart disease.",
          icon: "🔬",
          readTime: "14 min",
          category: "health"
        },
        {
          id: "endometriosis",
          topic: "Endometriosis",
          title: "Endometriosis: Beyond Normal Period Pain",
          body: "Endometriosis affects 1 in 10 women, where tissue similar to uterine lining grows outside the uterus. Symptoms: severe pelvic pain (especially during periods), pain during/after sex, heavy bleeding, fatigue, infertility. Average diagnosis takes 7-10 years. Diagnosis requires laparoscopy. Treatment options: pain management (NSAIDs, heat therapy), hormonal therapy (birth control, GnRH agonists), surgery (excision of lesions), and pelvic floor physical therapy. Diet changes (anti-inflammatory foods, gluten-free) may help some women manage symptoms.",
          icon: "🏥",
          readTime: "14 min",
          category: "health"
        },
        {
          id: "period-products",
          topic: "Products Guide",
          title: "Complete Guide to Period Products: Find Your Perfect Match",
          body: "Pads: disposable or reusable cloth, varying absorbencies. Tampons: applicator or non-applicator, organic cotton options available. Menstrual cups: medical-grade silicone, reusable 5-10 years, cost-effective and eco-friendly. Period underwear: absorbent, washable, great backup or light days. Menstrual discs: disposable or reusable, can be worn during sex. Period sponges: natural sea sponges, reusable 6-12 months. Consider factors: flow level, lifestyle, comfort, environmental impact, and cost. Many women use combinations of products for different days.",
          icon: "🛍️",
          readTime: "12 min",
          category: "basics"
        },
        {
          id: "first-period",
          topic: "Puberty",
          title: "First Period Guide: What to Expect & How to Prepare",
          body: "Menarche (first period) typically occurs between ages 10-15, average 12-13 years. Signs it's coming: breast development (2-3 years before), pubic hair growth, growth spurt, vaginal discharge (6-12 months before). First periods often irregular - this is normal for 2-3 years. What to prepare: period kit (pads, spare underwear, wipes, pain reliever), period tracker app, comfortable underwear. Discuss with trusted adult, learn about cycle tracking. Know that period color ranges from bright red to dark brown and length varies 2-7 days.",
          icon: "🌸",
          readTime: "10 min",
          category: "basics"
        },
        {
          id: "perimenopause",
          topic: "Perimenopause",
          title: "Understanding Perimenopause: The Transition Before Menopause",
          body: "Perimenopause begins 8-10 years before menopause, typically in 40s but can start in 30s. Signs: irregular periods, hot flashes, night sweats, sleep issues, mood changes, vaginal dryness, decreased libido, weight gain, brain fog. Hormonal shifts: estrogen fluctuates unpredictably, progesterone declines. Management: lifestyle adjustments (layered clothing, stress reduction), lubricants/moisturizers, hormone therapy (discuss risks/benefits), supplements (black cohosh, vitamin E, omega-3s). Bone density decreases during this time - ensure adequate calcium (1200mg) and vitamin D intake.",
          icon: "🔄",
          readTime: "14 min",
          category: "science"
        },
        {
          id: "yoga-therapy",
          topic: "Yoga Therapy",
          title: "Yoga for Menstrual Health: Poses for Each Phase",
          body: "Menstruation: restorative poses - Child's pose, Reclining Butterfly, gentle twists, avoid inversions. Follicular: energizing sequences - Sun Salutations, Warrior poses, backbends. Ovulation: challenging poses - Headstands, Arm balances, intense flow. Luteal: calming practice - Forward bends, Hip openers (Pigeon pose), supported Bridge pose. Beneficial poses for cramps: Cat-Cow, Reclining Hero, Legs-Up-The-Wall. Regular yoga practice (2-3 times/week) reduces PMS symptoms, improves mood, and decreases pain intensity. Combine with pranayama (breathing exercises) for maximum benefit.",
          icon: "🧘‍♀️",
          readTime: "12 min",
          category: "wellness"
        }
      ];
    }
    
    // Fetch YouTube videos
    let videos = [];
    try {
      const videoData = await api("/api/education/videos");
      videos = videoData.videos || [];
    } catch (err) {
      console.log("Could not load videos");
    }
    
    // REST OF YOUR EXISTING CODE REMAINS EXACTLY THE SAME
    // (categories, renderVideoSection, modal, styles, etc.)
    
    const categories = {
      basics: { title: "📚 Period Basics", items: [] },
      science: { title: "🔬 Science & Body", items: [] },
      wellness: { title: "💪 Wellness & Self-Care", items: [] },
      nutrition: { title: "🥗 Nutrition & Diet", items: [] },
      health: { title: "🏥 Health Conditions", items: [] }
    };
    
    education.forEach(item => {
      const cat = item.category || "basics";
      if (!categories[cat]) categories[cat] = { title: "📖 More Topics", items: [] };
      categories[cat].items.push(item);
    });
    
    document.getElementById("view").innerHTML = `
      <div class="education-container">
        <div class="education-hero" style="background: linear-gradient(135deg, #e91e63 0%, #f06292 100%); color: white; padding: 40px; border-radius: 16px; margin-bottom: 24px; text-align: center;">
          <h1 style="margin: 0 0 16px 0; font-size: 28px;">📖 Education Center</h1>
          <p style="margin: 0; opacity: 0.9; font-size: 16px;">Evidence-based knowledge about menstrual health, hormones, and overall wellness</p>
        </div>
        
        <div class="category-nav" style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 32px; justify-content: center;">
          <button class="category-btn active" data-category="all" style="background: #e91e63; color: white; border: none; padding: 8px 20px; border-radius: 25px; cursor: pointer; transition: all 0.3s; font-size: 14px;">All Topics</button>
          ${Object.entries(categories).map(([key, cat]) => `
            <button class="category-btn" data-category="${key}" style="background: #f5f5f5; color: #333; border: none; padding: 8px 20px; border-radius: 25px; cursor: pointer; transition: all 0.3s; font-size: 14px;">${cat.title}</button>
          `).join("")}
        </div>
        
        <div style="margin-bottom: 24px;">
          <input type="text" id="educationSearch" placeholder="🔍 Search articles..." style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; transition: border-color 0.3s;">
        </div>
        
        <div class="education-grid" id="educationGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px;">
          ${renderEducationCards(education)}
        </div>
        
        <div class="video-section" style="margin-top: 40px;">
          ${renderVideoSection(videos)}
        </div>
      </div>
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      .edu-card {
        background: white;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        transition: transform 0.2s, box-shadow 0.2s;
        cursor: pointer;
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      .edu-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      }
      .edu-card-header {
        background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%);
        padding: 20px;
        border-bottom: 3px solid #e91e63;
      }
      .edu-card-icon {
        font-size: 32px;
        margin-bottom: 12px;
      }
      .edu-card-topic {
        font-size: 12px;
        color: #e91e63;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 8px;
        font-weight: 600;
      }
      .edu-card-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 8px 0;
        line-height: 1.3;
      }
      .edu-card-body {
        padding: 20px;
        flex: 1;
      }
      .edu-card-body p {
        margin: 0 0 16px 0;
        line-height: 1.5;
        color: #666;
      }
      .edu-card-footer {
        padding: 12px 20px;
        border-top: 1px solid #f0f0f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .read-time {
        font-size: 12px;
        color: #999;
      }
      .read-more {
        color: #e91e63;
        font-size: 13px;
        font-weight: 500;
        text-decoration: none;
      }
      .category-btn.active {
        background: #e91e63 !important;
        color: white !important;
      }
      .category-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }
      .video-card {
        background: white;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        transition: transform 0.2s, box-shadow 0.2s;
        cursor: pointer;
      }
      .video-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      }
      .video-thumbnail-container {
        position: relative;
        padding-top: 56.25%;
        background: #f0f0f0;
      }
      .video-thumbnail {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .play-button-overlay {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 60px;
        height: 60px;
        background: rgba(233, 30, 99, 0.9);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 24px;
      }
      .video-info {
        padding: 16px;
      }
      .video-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 8px 0;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .video-channel {
        font-size: 13px;
        color: #666;
        margin-bottom: 4px;
      }
      .video-description {
        font-size: 13px;
        color: #888;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .video-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 20px;
      }
      #educationSearch:focus {
        outline: none;
        border-color: #e91e63;
      }
      @media (max-width: 768px) {
        .education-grid,
        .video-grid {
          grid-template-columns: 1fr !important;
        }
      }
    `;
    document.head.appendChild(style);
    
    function renderVideoSection(videos) {
      if (!videos.length) {
        return `
          <div class="featured-video" style="padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; color: white; text-align: center;">
            <h3 style="margin: 0 0 8px 0; font-size: 24px;">🎥 Educational Videos</h3>
            <p style="margin: 0; opacity: 0.9;">Watch experts explain women's health topics</p>
          </div>
        `;
      }
      
      return `
        <h2 style="margin-bottom: 20px; font-size: 24px;">🎥 Recommended Videos</h2>
        <div class="video-grid">
          ${videos.map(video => `
            <div class="video-card" onclick="window.open('https://www.youtube.com/watch?v=${video.id}', '_blank')">
              <div class="video-thumbnail-container">
                <img class="video-thumbnail" src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy">
                <div class="play-button-overlay">▶</div>
              </div>
              <div class="video-info">
                <h3 class="video-title">${escapeHtml(video.title)}</h3>
                <p class="video-channel">${escapeHtml(video.channelTitle)}</p>
                <p class="video-description">${escapeHtml(video.description)}</p>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    let modalOpen = false;
    
    function openArticleModal(item) {
      if (modalOpen) return;
      modalOpen = true;
      
      const modal = document.createElement('div');
      modal.className = 'education-modal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
      `;
      modal.innerHTML = `
        <div style="background: white; border-radius: 16px; max-width: 600px; width: 90%; max-height: 80vh; overflow: auto; animation: slideUp 0.3s ease;">
          <div style="padding: 24px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-size: 32px;">${item.icon || '📖'}</span>
              <span style="font-size: 12px; color: #e91e63; margin-left: 12px; text-transform: uppercase; font-weight: 600;">${escapeHtml(item.topic || item.title)}</span>
            </div>
            <button id="closeModalBtn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">✕</button>
          </div>
          <div style="padding: 24px;">
            <h2 style="margin: 0 0 16px 0;">${escapeHtml(item.title)}</h2>
            <div style="display: flex; gap: 16px; margin-bottom: 20px; color: #666; font-size: 13px;">
              <span>📖 ${item.readTime || '5 min'} read</span>
              <span>📅 Evidence-based</span>
            </div>
            <p style="line-height: 1.8; margin-bottom: 24px; color: #333; font-size: 16px;">${escapeHtml(item.body)}</p>
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
              <strong>💡 Key Takeaway</strong>
              <p style="margin: 8px 0 0 0; color: #666;">${getKeyTakeaway(item.title)}</p>
            </div>
          </div>
          <div style="padding: 16px 24px; border-top: 1px solid #f0f0f0; text-align: center; display: flex; gap: 12px; justify-content: center;">
            <button id="shareArticleBtn" style="background: #e91e63; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">📤 Share Article</button>
            <button onclick="window.print()" style="background: #f5f5f5; color: #333; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">🖨️ Print</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      modal.querySelector('#closeModalBtn').addEventListener('click', () => {
        modal.remove();
        modalOpen = false;
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
          modalOpen = false;
        }
      });
      
      const shareBtn = modal.querySelector('#shareArticleBtn');
      if (shareBtn) {
        shareBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(`${item.title}\n\n${item.body}\n\n— From Menstrumate Education`);
          showToast("Article copied to clipboard!", "success");
        });
      }
    }
    
    function getKeyTakeaway(title) {
      const takeaways = {
        "Understanding Your Menstrual Cycle: A Complete Guide": "Track your cycle to understand your body's patterns and predict symptoms.",
        "The Four Phases of Your Menstrual Cycle Explained": "Each phase brings different energy levels - plan activities accordingly.",
        "Comprehensive Guide to Managing Menstrual Pain & Cramps": "Heat therapy, NSAIDs, and gentle exercise are the most effective natural remedies.",
        "Optimal Nutrition Guide for Each Menstrual Phase": "Eating according to your cycle phase helps balance hormones and reduce symptoms.",
        "Exercise Guide: Workout According to Your Cycle Phase": "Match workout intensity to your cycle phase for optimal results.",
        "Natural & Medical Solutions for PMS Relief": "Lifestyle changes significantly reduce PMS - exercise, sleep, and diet are key.",
        "When to See a Doctor: Key Warning Signs": "Severe pain, heavy bleeding, or irregular cycles warrant medical evaluation.",
        "Hormones Through Your Cycle: Estrogen, Progesterone & More": "Understanding your hormones empowers you to work with your body.",
        "Complete Guide to Contraception: Options, Effectiveness & Safety": "Multiple options exist - find what works best for your body and lifestyle.",
        "Mental Health & Your Menstrual Cycle: Managing Mood Changes": "Track mood daily to identify patterns and seek help for severe symptoms.",
        "How Your Menstrual Cycle Affects Sleep Quality": "Good sleep hygiene becomes especially important during the luteal phase.",
        "Fertility Awareness: Understanding Your Fertile Window & Ovulation": "Knowing your fertile window helps with both conception and natural planning.",
        "Understanding PCOS: Symptoms, Diagnosis & Management": "PCOS is manageable with proper diet, exercise, and medical support.",
        "Endometriosis: Beyond Normal Period Pain": "Severe period pain isn't normal - seek diagnosis if pain disrupts your life.",
        "Complete Guide to Period Products: Find Your Perfect Match": "Experiment with different products to find your ideal combination.",
        "First Period Guide: What to Expect & How to Prepare": "Prepare a period kit and track your cycle from the very beginning.",
        "Understanding Perimenopause: The Transition Before Menopause": "Perimenopause can start in your 30s - know the signs early.",
        "Yoga for Menstrual Health: Poses for Each Phase": "Regular yoga practice significantly reduces menstrual pain and PMS symptoms."
      };
      return takeaways[title] || "Knowledge is power - understanding your body helps you make better health decisions.";
    }
    
    function showToast(message, type) {
      const toast = document.createElement('div');
      toast.textContent = message;
      toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4caf50' : '#e91e63'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10001;
        animation: fadeInOut 2s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    }
    
    if (!document.getElementById('edu-animations')) {
      const animationStyle = document.createElement('style');
      animationStyle.id = 'edu-animations';
      animationStyle.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(20px); }
          15% { opacity: 1; transform: translateY(0); }
          85% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(20px); }
        }
      `;
      document.head.appendChild(animationStyle);
    }
    
    const categoryBtns = document.querySelectorAll('.category-btn');
    const searchInput = document.getElementById('educationSearch');
    const grid = document.getElementById('educationGrid');
    
    function filterAndSearch() {
      const activeCategory = document.querySelector('.category-btn.active')?.dataset.category || 'all';
      const searchTerm = searchInput?.value.toLowerCase() || '';
      
      const filtered = education.filter(item => {
        const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
        const matchesSearch = searchTerm === '' || 
          item.title.toLowerCase().includes(searchTerm) ||
          (item.topic || '').toLowerCase().includes(searchTerm) ||
          item.body.toLowerCase().includes(searchTerm);
        return matchesCategory && matchesSearch;
      });
      
      if (grid) {
        grid.innerHTML = filtered.length ? renderEducationCards(filtered) : `
          <div style="grid-column: 1/-1; text-align: center; padding: 60px;">
            <p style="font-size: 48px; margin: 0 0 16px;">🔍</p>
            <h3>No articles found</h3>
            <p style="color: #666;">Try a different search term or category</p>
          </div>
        `;
        attachCardEvents();
      }
    }
    
    categoryBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        categoryBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterAndSearch();
      });
    });
    
    if (searchInput) {
      searchInput.addEventListener('input', filterAndSearch);
    }
    
    function attachCardEvents() {
      document.querySelectorAll('.edu-card').forEach((card) => {
        const title = card.dataset.title;
        const originalItem = education.find(e => e.title === title);
        if (originalItem) {
          card.addEventListener('click', () => openArticleModal(originalItem));
        }
      });
    }
    
    function renderEducationCards(items) {
      return items.map(item => `
        <div class="edu-card" data-title="${escapeHtml(item.title)}">
          <div class="edu-card-header">
            <div class="edu-card-icon">${item.icon || '📖'}</div>
            <div class="edu-card-topic">${escapeHtml(item.topic || item.title)}</div>
            <h3 class="edu-card-title">${escapeHtml(item.title)}</h3>
          </div>
          <div class="edu-card-body">
            <p>${escapeHtml(item.body.substring(0, 150))}...</p>
          </div>
          <div class="edu-card-footer">
            <span class="read-time">⏱️ ${item.readTime || '5 min'} read</span>
            <span class="read-more">Read more →</span>
          </div>
        </div>
      `).join("");
    }
    
    attachCardEvents();
    
  } catch (error) {
    console.error("Error loading education:", error);
    document.getElementById("view").innerHTML = `
      <div style="text-align: center; padding: 60px;">
        <h3>Unable to load education content</h3>
        <p style="color: #666;">${escapeHtml(error.message)}</p>
        <button onclick="location.reload()" style="background: #e91e63; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin-top: 16px;">Try Again</button>
      </div>
    `;
  }
}

// Helper function to escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Add this function to your app.js

async function renderEntertainment() {
  setTitle("Entertainment & Self-Care", "Relax, unwind, and take care of your mental wellness");
  
  try {
    document.getElementById("view").innerHTML = `
      <div class="entertainment-container">
        
        <!-- Mood Check-in -->
        <div class="panel" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 16px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 12px 0;">How are you feeling today?</h2>
          <div class="mood-buttons" style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px;">
            <button class="mood-btn" data-mood="happy" style="font-size: 32px; padding: 12px 16px; border-radius: 50%; border: 2px solid white; background: transparent; cursor: pointer;">😊</button>
            <button class="mood-btn" data-mood="calm" style="font-size: 32px; padding: 12px 16px; border-radius: 50%; border: 2px solid white; background: transparent; cursor: pointer;">😌</button>
            <button class="mood-btn" data-mood="tired" style="font-size: 32px; padding: 12px 16px; border-radius: 50%; border: 2px solid white; background: transparent; cursor: pointer;">😴</button>
            <button class="mood-btn" data-mood="anxious" style="font-size: 32px; padding: 12px 16px; border-radius: 50%; border: 2px solid white; background: transparent; cursor: pointer;">😰</button>
            <button class="mood-btn" data-mood="energetic" style="font-size: 32px; padding: 12px 16px; border-radius: 50%; border: 2px solid white; background: transparent; cursor: pointer;">⚡</button>
            <button class="mood-btn" data-mood="sad" style="font-size: 32px; padding: 12px 16px; border-radius: 50%; border: 2px solid white; background: transparent; cursor: pointer;">😢</button>
            <button class="mood-btn" data-mood="irritated" style="font-size: 32px; padding: 12px 16px; border-radius: 50%; border: 2px solid white; background: transparent; cursor: pointer;">😤</button>
          </div>
          <p id="moodMessage" style="margin-top: 12px; font-size: 14px; opacity: 0.9;"></p>
        </div>

        <!-- Quick Self-Care Activities -->
        <h2 style="margin-bottom: 16px;">🎯 Quick Self-Care Activities</h2>
        <div class="selfcare-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; margin-bottom: 32px;">
          <div class="selfcare-card" onclick="startBreathingExercise()" style="background: white; padding: 20px; border-radius: 12px; text-align: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 0.2s;">
            <div style="font-size: 40px; margin-bottom: 12px;">🫁</div>
            <h3>Breathing Exercise</h3>
            <p class="muted">5-min guided breathing</p>
          </div>
          
          <div class="selfcare-card" onclick="showAffirmations()" style="background: white; padding: 20px; border-radius: 12px; text-align: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 0.2s;">
            <div style="font-size: 40px; margin-bottom: 12px;">✨</div>
            <h3>Daily Affirmations</h3>
            <p class="muted">Positive self-talk</p>
          </div>
          
          <div class="selfcare-card" onclick="showJournalPrompt()" style="background: white; padding: 20px; border-radius: 12px; text-align: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 0.2s;">
            <div style="font-size: 40px; margin-bottom: 12px;">📝</div>
            <h3>Journal Prompt</h3>
            <p class="muted">5-min writing exercise</p>
          </div>
          
          <div class="selfcare-card" onclick="showStretchingRoutine()" style="background: white; padding: 20px; border-radius: 12px; text-align: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 0.2s;">
            <div style="font-size: 40px; margin-bottom: 12px;">🤸</div>
            <h3>Desk Stretches</h3>
            <p class="muted">3-min stretch break</p>
          </div>
        </div>

        <!-- Mood-Based Playlists -->
        <h2 style="margin-bottom: 16px;">🎵 Music for Your Mood</h2>
        <div class="music-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px;">
          <div class="music-card" onclick="window.open('https://www.youtube.com/results?search_query=relaxing+music+for+stress+relief', '_blank')" style="background: white; padding: 20px; border-radius: 12px; text-align: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 0.2s;">
            <div style="font-size: 40px; margin-bottom: 8px;">🎧</div>
            <h4>Relaxing Music</h4>
            <p class="muted">For calm & peace</p>
          </div>
          
          <div class="music-card" onclick="window.open('https://www.youtube.com/results?search_query=energetic+workout+music', '_blank')" style="background: white; padding: 20px; border-radius: 12px; text-align: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 0.2s;">
            <div style="font-size: 40px; margin-bottom: 8px;">⚡</div>
            <h4>Energy Boost</h4>
            <p class="muted">Get moving!</p>
          </div>
          
          <div class="music-card" onclick="window.open('https://www.youtube.com/results?search_query=meditation+music+sleep', '_blank')" style="background: white; padding: 20px; border-radius: 12px; text-align: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 0.2s;">
            <div style="font-size: 40px; margin-bottom: 8px;">🌙</div>
            <h4>Sleep Music</h4>
            <p class="muted">Better sleep</p>
          </div>
          
          <div class="music-card" onclick="window.open('https://www.youtube.com/results?search_query=happy+uplifting+songs', '_blank')" style="background: white; padding: 20px; border-radius: 12px; text-align: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 0.2s;">
            <div style="font-size: 40px; margin-bottom: 8px;">🎉</div>
            <h4>Happy Vibes</h4>
            <p class="muted">Instant mood lift</p>
          </div>
          
          <div class="music-card" onclick="window.open('https://www.youtube.com/results?search_query=lofi+study+music', '_blank')" style="background: white; padding: 20px; border-radius: 12px; text-align: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 0.2s;">
            <div style="font-size: 40px; margin-bottom: 8px;">📚</div>
            <h4>Focus Music</h4>
            <p class="muted">Study & work</p>
          </div>
        </div>

        <!-- Period Cramp Relief Corner -->
        <h2 style="margin-bottom: 16px;">🩹 Period Cramp Relief Corner</h2>
        <div class="cramp-relief-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin-bottom: 32px;">
          <div class="relief-card" style="background: linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%); padding: 24px; border-radius: 12px; color: #333;">
            <h3>🔥 DIY Heating Pad</h3>
            <p>Fill a sock with rice, microwave for 1-2 minutes. Place on your belly for instant relief.</p>
          </div>
          
          <div class="relief-card" style="background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%); padding: 24px; border-radius: 12px; color: #333;">
            <h3>☕ Cramp Relief Tea</h3>
            <p>Mix ginger, chamomile, and honey. Ginger reduces inflammation, chamomile relaxes muscles.</p>
          </div>
          
          <div class="relief-card" style="background: linear-gradient(135deg, #fad0c4 0%, #ffd1ff 100%); padding: 24px; border-radius: 12px; color: #333;">
            <h3>🧘 Child's Pose</h3>
            <p>Kneel on floor, fold forward, arms extended. Hold for 2-3 minutes. Opens lower back, relieves cramps.</p>
          </div>
          
          <div class="relief-card" style="background: linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%); padding: 24px; border-radius: 12px; color: #333;">
            <h3>💆 Self-Massage</h3>
            <p>Use essential oils (lavender, clary sage) to massage lower abdomen in circular motions.</p>
          </div>
        </div>

        <!-- Fun Section -->
        <h2 style="margin-bottom: 16px;">🎮 Fun & Games</h2>
        <div class="fun-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px;">
          <div class="fun-card" id="jokeCard" style="background: white; padding: 20px; border-radius: 12px; text-align: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 0.2s;">
            <div style="font-size: 40px; margin-bottom: 8px;">😂</div>
            <h4>Random Joke</h4>
            <p class="muted" id="jokeText">Click for a laugh!</p>
          </div>
          
          <div class="fun-card" id="factCard" style="background: white; padding: 20px; border-radius: 12px; text-align: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 0.2s;">
            <div style="font-size: 40px; margin-bottom: 8px;">🤯</div>
            <h4>Fun Fact</h4>
            <p class="muted" id="factText">Click to learn!</p>
          </div>
          
          <div class="fun-card" id="quoteCard" style="background: white; padding: 20px; border-radius: 12px; text-align: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 0.2s;">
            <div style="font-size: 40px; margin-bottom: 8px;">💬</div>
            <h4>Inspirational Quote</h4>
            <p class="muted" id="quoteText">Click for inspiration!</p>
          </div>
          
          <div class="fun-card" id="challengeCard" style="background: white; padding: 20px; border-radius: 12px; text-align: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 0.2s;">
            <div style="font-size: 40px; margin-bottom: 8px;">🎯</div>
            <h4>Daily Challenge</h4>
            <p class="muted" id="challengeText">Accept the challenge!</p>
          </div>
        </div>

        <!-- Entertainment Videos -->
        <h2 style="margin-bottom: 16px;">🎬 Light & Fun Videos</h2>
        <div class="fun-videos-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
          <div class="video-fun-card" onclick="window.open('https://www.youtube.com/results?search_query=funny+animal+videos', '_blank')" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); cursor: pointer;">
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; text-align: center; font-size: 40px;">🐱</div>
            <div style="padding: 16px;">
              <h4>Funny Animals</h4>
              <p class="muted">Instant mood booster</p>
            </div>
          </div>
          
          <div class="video-fun-card" onclick="window.open('https://www.youtube.com/results?search_query=comedy+stand+up+women', '_blank')" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); cursor: pointer;">
            <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 30px; text-align: center; font-size: 40px;">🎤</div>
            <div style="padding: 16px;">
              <h4>Stand-up Comedy</h4>
              <p class="muted">Laugh out loud</p>
            </div>
          </div>
          
          <div class="video-fun-card" onclick="window.open('https://www.youtube.com/results?search_query=cooking+recipes+quick+easy', '_blank')" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); cursor: pointer;">
            <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 30px; text-align: center; font-size: 40px;">👩‍🍳</div>
            <div style="padding: 16px;">
              <h4>Cooking Fun</h4>
              <p class="muted">Easy recipes</p>
            </div>
          </div>
          
          <div class="video-fun-card" onclick="window.open('https://www.youtube.com/results?search_query=diy+crafts+relaxing', '_blank')" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); cursor: pointer;">
            <div style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); padding: 30px; text-align: center; font-size: 40px;">🎨</div>
            <div style="padding: 16px;">
              <h4>DIY & Crafts</h4>
              <p class="muted">Creative relaxation</p>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add CSS styles
    const style = document.createElement('style');
    style.textContent = `
      .selfcare-card:hover, .music-card:hover, .fun-card:hover, .video-fun-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 4px 16px rgba(0,0,0,0.15) !important;
      }
      .mood-btn:hover {
        transform: scale(1.2);
        transition: transform 0.2s;
      }
      .mood-btn.selected {
        background: white !important;
        transform: scale(1.3);
      }
      .breathing-circle {
        width: 150px;
        height: 150px;
        border-radius: 50%;
        background: #e91e63;
        margin: 0 auto;
        transition: all 0.5s ease;
      }
      @media (max-width: 768px) {
        .selfcare-grid, .music-grid, .fun-grid, .cramp-relief-grid, .fun-videos-grid {
          grid-template-columns: 1fr !important;
        }
      }
    `;
    document.head.appendChild(style);

    // Mood buttons functionality
    document.querySelectorAll('.mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const mood = btn.dataset.mood;
        const messages = {
          happy: "Wonderful! Keep spreading those positive vibes! 🌟",
          calm: "Beautiful! Peace is a superpower. Enjoy this moment. 🧘‍♀️",
          tired: "Rest is productive! Be gentle with yourself today. 💤",
          anxious: "Take a deep breath. You've got this! Try the breathing exercise below. 🌬️",
          energetic: "Amazing! Channel that energy into something you love! ⚡",
          sad: "It's okay to not be okay. Be kind to yourself. Maybe a funny video? 💙",
          irritated: "That's valid! Try the stretching routine to release tension. 🧘"
        };
        document.getElementById('moodMessage').textContent = messages[mood] || "";
      });
    });

    // Joke functionality
    const jokes = [
      "Why did the period go to the party? Because it was a bloody good time! 🩸",
      "What's a uterus's favorite type of music? Heavy metal! 🎸",
      "Why don't ovaries tell secrets? Because they might leak! 🤫",
      "What did the tampon say to the pad? You go ahead, I'll catch up! 😄",
      "Why did the woman bring a ladder to her period? Because the flow was heavy! 🪜",
      "What's a period's favorite exercise? The cramp! 💪",
      "Why do hormones never get lost? They always follow their cycle! 🔄",
      "What did one ovary say to the other? We're egg-cellent together! 🥚"
    ];

    const facts = [
      "The uterus expands up to 500 times its normal size during pregnancy! 🤰",
      "Women have a better sense of smell than men, especially during ovulation! 👃",
      "The clitoris has over 8,000 nerve endings - double that of the penis! 🔬",
      "Women's hearts beat faster than men's hearts by about 8 beats per minute! ❤️",
      "The average woman uses about 11,000 tampons in her lifetime! 📊",
      "Women blink nearly twice as often as men! 👁️",
      "The first menstrual cup was invented in 1867! 📅",
      "Women have stronger immune systems than men! 🛡️"
    ];

    const quotes = [
      "\"Self-care is not selfish. You cannot serve from an empty vessel.\" - Eleanor Brown",
      "\"You are more powerful than you know; you are beautiful just as you are.\" - Melissa Etheridge",
      "\"A woman is the full circle. Within her is the power to create, nurture and transform.\" - Diane Mariechild",
      "\"Take care of your body. It's the only place you have to live.\" - Jim Rohn",
      "\"The most courageous act is still to think for yourself. Aloud.\" - Coco Chanel",
      "\"You yourself, as much as anybody in the entire universe, deserve your love and affection.\" - Buddha",
      "\"Life is not about waiting for the storm to pass. It's about learning to dance in the rain.\" - Vivian Greene",
      "\"Be kind to yourself. You're doing the best you can.\" - Unknown"
    ];

    const challenges = [
      "Drink 2 glasses of water right now! 💧",
      "Stand up and stretch for 2 minutes! 🧘",
      "Write down 3 things you're grateful for! ✍️",
      "Call or text someone you love! 📱",
      "Do 10 deep breaths right now! 🌬️",
      "Dance to your favorite song! 💃",
      "Look in the mirror and say 3 things you like about yourself! 🪞",
      "Step outside for 5 minutes of fresh air! 🌳"
    ];

    document.getElementById('jokeCard').addEventListener('click', () => {
      const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
      document.getElementById('jokeText').textContent = randomJoke;
    });

    document.getElementById('factCard').addEventListener('click', () => {
      const randomFact = facts[Math.floor(Math.random() * facts.length)];
      document.getElementById('factText').textContent = randomFact;
    });

    document.getElementById('quoteCard').addEventListener('click', () => {
      const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
      document.getElementById('quoteText').textContent = randomQuote;
    });

    document.getElementById('challengeCard').addEventListener('click', () => {
      const randomChallenge = challenges[Math.floor(Math.random() * challenges.length)];
      document.getElementById('challengeText').textContent = randomChallenge;
      showToast("Challenge accepted! 💪", "success");
    });

    // Initialize with random content
    setTimeout(() => {
      document.getElementById('jokeText').textContent = jokes[Math.floor(Math.random() * jokes.length)];
      document.getElementById('factText').textContent = facts[Math.floor(Math.random() * facts.length)];
      document.getElementById('quoteText').textContent = quotes[Math.floor(Math.random() * quotes.length)];
      document.getElementById('challengeText').textContent = challenges[Math.floor(Math.random() * challenges.length)];
    }, 500);

  } catch (error) {
    console.error("Error loading entertainment:", error);
    document.getElementById("view").innerHTML = `
      <div style="text-align: center; padding: 60px;">
        <h3>Unable to load entertainment</h3>
        <p style="color: #666;">${escapeHtml(error.message)}</p>
        <button onclick="location.reload()" style="background: #e91e63; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin-top: 16px;">Try Again</button>
      </div>
    `;
  }
}

// Breathing exercise function
function startBreathingExercise() {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7); display: flex; align-items: center;
    justify-content: center; z-index: 10000;
  `;
  modal.innerHTML = `
    <div style="background: white; border-radius: 16px; padding: 40px; text-align: center; max-width: 400px;">
      <h2>🫁 Breathing Exercise</h2>
      <div class="breathing-circle" id="breathingCircle" style="width: 150px; height: 150px; border-radius: 50%; background: #e91e63; margin: 30px auto; transition: all 0.1s ease;"></div>
      <p id="breathingText" style="font-size: 20px; font-weight: bold;">Breathe in...</p>
      <button onclick="this.closest('div').parentElement.remove()" style="margin-top: 20px; background: #f5f5f5; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">Close</button>
    </div>
  `;
  document.body.appendChild(modal);
  
  let phase = 0;
  const circle = modal.querySelector('#breathingCircle');
  const text = modal.querySelector('#breathingText');
  
  setInterval(() => {
    if (!document.body.contains(modal)) return;
    if (phase === 0) {
      circle.style.transform = 'scale(1.5)'; text.textContent = 'Breathe in...';
    } else if (phase === 2) {
      circle.style.transform = 'scale(1)'; text.textContent = 'Breathe out...';
    } else {
      text.textContent = 'Hold...';
    }
    phase = (phase + 1) % 4;
  }, 2000);
}

// Affirmations
function showAffirmations() {
  const affirmations = [
    "I am strong. I am capable. I am enough.",
    "My body is beautiful and deserving of love.",
    "I honor my body's needs and give it rest when necessary.",
    "I am in tune with my cycle and honor its phases.",
    "Every day, I am becoming a better version of myself.",
    "I deserve happiness, health, and peace.",
    "My period is a sign of my body's strength, not weakness."
  ];
  const aff = affirmations[Math.floor(Math.random() * affirmations.length)];
  alert("✨ " + aff);
  showToast("Affirmation shown! 💖", "success");
}

// Journal prompt
function showJournalPrompt() {
  const prompts = [
    "What does my body need most right now?",
    "What am I grateful for today?",
    "How can I be kinder to myself this week?",
    "What emotions am I holding onto right now?",
    "What's one thing I love about being a woman?"
  ];
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  alert("📝 Journal Prompt:\n\n" + prompt + "\n\nTake 5 minutes to write freely.");
  showToast("Happy journaling! ✍️", "success");
}

// Stretching routine
function showStretchingRoutine() {
  const stretches = [
    "1. Neck rolls: 5 each direction 🌀",
    "2. Shoulder shrugs: 10 times 🏋️",
    "3. Wrist circles: 10 each direction 🤲",
    "4. Seated twist: 30 seconds each side 🧘",
    "5. Forward fold: Hold for 1 minute 🙇‍♀️",
    "6. Cat-Cow stretch: 10 repetitions 🐱🐄"
  ];
  alert("🤸 Quick Desk Stretches:\n\n" + stretches.join("\n"));
  showToast("Stretch it out! 🤸", "success");
}

function showToast(message, type) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${type === 'success' ? '#4caf50' : '#e91e63'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 10001;
    animation: fadeInOut 2s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

/*-------GAMES SECTION-----------*/


// Add this function to your app.js

async function renderGames() {
  setTitle("Games & Fun", "Take a break with relaxing mini-games");
  
  try {
    document.getElementById("view").innerHTML = `
      <div class="games-container">
        
        <!-- Memory Card Game -->
        <div class="panel" style="margin-bottom: 24px;">
          <h2 style="display: flex; align-items: center; gap: 8px;">🧠 Memory Match</h2>
          <p class="muted">Find matching pairs!</p>
          <div id="memoryGame" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; max-width: 400px; margin: 16px auto;"></div>
          <div style="text-align: center; margin-top: 12px;">
            <span id="memoryScore" style="font-weight: bold;">Pairs found: 0/8</span>
            <span id="memoryMoves" style="margin-left: 16px; color: #666;">Moves: 0</span>
          </div>
          <button id="resetMemory" class="btn secondary" style="margin-top: 12px; display: block; margin-left: auto; margin-right: auto;">New Game 🔄</button>
        </div>

        <!-- Tic Tac Toe -->
        <div class="panel" style="margin-bottom: 24px;">
          <h2 style="display: flex; align-items: center; gap: 8px;">❌⭕ Tic Tac Toe</h2>
          <p class="muted">Play against a friend!</p>
          <div id="tttBoard" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; max-width: 300px; margin: 16px auto;"></div>
          <div style="text-align: center; margin-top: 12px;">
            <span id="tttStatus" style="font-weight: bold;">Player X's turn</span>
          </div>
          <button id="resetTTT" class="btn secondary" style="margin-top: 12px; display: block; margin-left: auto; margin-right: auto;">New Game 🔄</button>
        </div>

        <!-- Guess the Number -->
        <div class="panel" style="margin-bottom: 24px;">
          <h2 style="display: flex; align-items: center; gap: 8px;">🎯 Guess the Number</h2>
          <p class="muted">Guess a number between 1-100</p>
          <div style="text-align: center;">
            <input type="number" id="guessInput" min="1" max="100" placeholder="Enter guess" style="padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; width: 150px; text-align: center;">
            <button id="guessBtn" class="btn" style="margin-left: 8px;">Guess!</button>
          </div>
          <p id="guessHint" style="text-align: center; margin-top: 12px; font-weight: bold;"></p>
          <div style="text-align: center; margin-top: 8px;">
            <span id="guessAttempts" style="color: #666;">Attempts: 0</span>
          </div>
          <button id="resetGuess" class="btn secondary" style="margin-top: 12px; display: block; margin-left: auto; margin-right: auto;">New Game 🔄</button>
        </div>

        <!-- Rock Paper Scissors -->
        <div class="panel" style="margin-bottom: 24px;">
          <h2 style="display: flex; align-items: center; gap: 8px;">✊✋✌️ Rock Paper Scissors</h2>
          <p class="muted">Play against the computer!</p>
          <div style="display: flex; justify-content: center; gap: 16px; margin: 16px 0;">
            <button class="rps-btn" data-choice="rock" style="font-size: 40px; padding: 16px; border-radius: 12px; border: 2px solid #e0e0e0; background: white; cursor: pointer;">✊</button>
            <button class="rps-btn" data-choice="paper" style="font-size: 40px; padding: 16px; border-radius: 12px; border: 2px solid #e0e0e0; background: white; cursor: pointer;">✋</button>
            <button class="rps-btn" data-choice="scissors" style="font-size: 40px; padding: 16px; border-radius: 12px; border: 2px solid #e0e0e0; background: white; cursor: pointer;">✌️</button>
          </div>
          <div style="text-align: center; font-weight: bold;" id="rpsResult"></div>
          <div style="text-align: center; margin-top: 8px;">
            <span id="rpsScore" style="color: #666;">You: 0 | Computer: 0</span>
          </div>
          <button id="resetRPS" class="btn secondary" style="margin-top: 12px; display: block; margin-left: auto; margin-right: auto;">Reset Score 🔄</button>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      .memory-card {
        aspect-ratio: 1;
        background: linear-gradient(135deg, #e91e63, #f06292);
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        transition: transform 0.3s;
        user-select: none;
      }
      .memory-card:hover { transform: scale(1.05); }
      .memory-card.flipped { background: white; border: 2px solid #e91e63; }
      .memory-card.matched { background: #c8e6c9; border: 2px solid #4caf50; cursor: default; }
      .memory-card.matched:hover { transform: none; }
      .ttt-cell {
        aspect-ratio: 1;
        background: #f5f5f5;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 48px;
        font-weight: bold;
        transition: background 0.2s;
      }
      .ttt-cell:hover { background: #e0e0e0; }
      .ttt-cell.taken { cursor: default; }
      .rps-btn:hover { transform: scale(1.1); background: #f0f0f0; }
    `;
    document.head.appendChild(style);

    // ==================== MEMORY GAME ====================
    const emojis = ['🌟', '🎈', '🌈', '🎵', '🍀', '🌸', '🎨', '🔥'];
    let memoryCards = [...emojis, ...emojis];
    let flippedCards = [];
    let matchedPairs = 0;
    let memoryMoves = 0;
    let canFlip = true;

    function shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }

    function renderMemoryGame() {
      memoryCards = shuffle([...emojis, ...emojis]);
      flippedCards = [];
      matchedPairs = 0;
      memoryMoves = 0;
      canFlip = true;
      document.getElementById('memoryScore').textContent = 'Pairs found: 0/8';
      document.getElementById('memoryMoves').textContent = 'Moves: 0';

      document.getElementById('memoryGame').innerHTML = memoryCards.map((emoji, index) => `
        <div class="memory-card" data-index="${index}" data-emoji="${emoji}">❓</div>
      `).join('');

      document.querySelectorAll('.memory-card').forEach(card => {
        card.addEventListener('click', () => flipCard(card));
      });
    }

    function flipCard(card) {
      if (!canFlip || card.classList.contains('flipped') || card.classList.contains('matched')) return;
      if (flippedCards.length >= 2) return;

      card.textContent = card.dataset.emoji;
      card.classList.add('flipped');
      flippedCards.push(card);

      if (flippedCards.length === 2) {
        memoryMoves++;
        document.getElementById('memoryMoves').textContent = `Moves: ${memoryMoves}`;
        canFlip = false;

        if (flippedCards[0].dataset.emoji === flippedCards[1].dataset.emoji) {
          flippedCards.forEach(c => c.classList.add('matched'));
          matchedPairs++;
          document.getElementById('memoryScore').textContent = `Pairs found: ${matchedPairs}/8`;
          flippedCards = [];
          canFlip = true;

          if (matchedPairs === 8) {
            setTimeout(() => showToast('🎉 You won! Amazing memory!', 'success'), 300);
          }
        } else {
          setTimeout(() => {
            flippedCards.forEach(c => {
              c.textContent = '❓';
              c.classList.remove('flipped');
            });
            flippedCards = [];
            canFlip = true;
          }, 800);
        }
      }
    }

    document.getElementById('resetMemory').addEventListener('click', renderMemoryGame);
    renderMemoryGame();

    // ==================== TIC TAC TOE ====================
    let tttBoard = Array(9).fill('');
    let tttCurrentPlayer = 'X';
    let tttGameOver = false;

    function renderTTT() {
      tttBoard = Array(9).fill('');
      tttCurrentPlayer = 'X';
      tttGameOver = false;
      document.getElementById('tttStatus').textContent = "Player X's turn";
      
      document.getElementById('tttBoard').innerHTML = tttBoard.map((cell, index) => `
        <div class="ttt-cell" data-index="${index}">${cell}</div>
      `).join('');

      document.querySelectorAll('.ttt-cell').forEach(cell => {
        cell.addEventListener('click', () => tttClick(parseInt(cell.dataset.index)));
      });
    }

    function tttClick(index) {
      if (tttBoard[index] !== '' || tttGameOver) return;
      
      tttBoard[index] = tttCurrentPlayer;
      renderTTTBoard();

      if (checkTTTWin()) {
        document.getElementById('tttStatus').textContent = `Player ${tttCurrentPlayer} wins! 🎉`;
        tttGameOver = true;
        return;
      }

      if (tttBoard.every(cell => cell !== '')) {
        document.getElementById('tttStatus').textContent = "It's a draw! 🤝";
        tttGameOver = true;
        return;
      }

      tttCurrentPlayer = tttCurrentPlayer === 'X' ? 'O' : 'X';
      document.getElementById('tttStatus').textContent = `Player ${tttCurrentPlayer}'s turn`;
    }

    function renderTTTBoard() {
      const cells = document.querySelectorAll('.ttt-cell');
      cells.forEach((cell, i) => {
        cell.textContent = tttBoard[i];
        if (tttBoard[i] !== '') cell.classList.add('taken');
      });
    }

    function checkTTTWin() {
      const wins = [
        [0,1,2], [3,4,5], [6,7,8],
        [0,3,6], [1,4,7], [2,5,8],
        [0,4,8], [2,4,6]
      ];
      return wins.some(([a,b,c]) => 
        tttBoard[a] && tttBoard[a] === tttBoard[b] && tttBoard[a] === tttBoard[c]
      );
    }

    document.getElementById('resetTTT').addEventListener('click', renderTTT);
    renderTTT();

    // ==================== GUESS THE NUMBER ====================
    let secretNumber;
    let guessAttempts;

    function startGuessGame() {
      secretNumber = Math.floor(Math.random() * 100) + 1;
      guessAttempts = 0;
      document.getElementById('guessHint').textContent = '';
      document.getElementById('guessAttempts').textContent = 'Attempts: 0';
      document.getElementById('guessInput').value = '';
      document.getElementById('guessInput').disabled = false;
      document.getElementById('guessBtn').disabled = false;
    }

    document.getElementById('guessBtn').addEventListener('click', () => {
      const input = document.getElementById('guessInput');
      const guess = parseInt(input.value);
      
      if (isNaN(guess) || guess < 1 || guess > 100) {
        document.getElementById('guessHint').textContent = 'Please enter 1-100';
        return;
      }

      guessAttempts++;
      document.getElementById('guessAttempts').textContent = `Attempts: ${guessAttempts}`;

      if (guess === secretNumber) {
        document.getElementById('guessHint').textContent = `🎉 Correct! Found in ${guessAttempts} attempts!`;
        document.getElementById('guessInput').disabled = true;
        document.getElementById('guessBtn').disabled = true;
      } else if (guess < secretNumber) {
        document.getElementById('guessHint').textContent = '📈 Too low! Try higher';
      } else {
        document.getElementById('guessHint').textContent = '📉 Too high! Try lower';
      }
      
      input.value = '';
      input.focus();
    });

    document.getElementById('guessInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') document.getElementById('guessBtn').click();
    });

    document.getElementById('resetGuess').addEventListener('click', startGuessGame);
    startGuessGame();

    // ==================== ROCK PAPER SCISSORS ====================
    let rpsPlayerScore = 0;
    let rpsComputerScore = 0;
    const choices = ['rock', 'paper', 'scissors'];
    const emojiMap = { rock: '✊', paper: '✋', scissors: '✌️' };

    document.querySelectorAll('.rps-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const playerChoice = btn.dataset.choice;
        const computerChoice = choices[Math.floor(Math.random() * 3)];
        
        let result = '';
        if (playerChoice === computerChoice) {
          result = "It's a tie! 🤝";
        } else if (
          (playerChoice === 'rock' && computerChoice === 'scissors') ||
          (playerChoice === 'paper' && computerChoice === 'rock') ||
          (playerChoice === 'scissors' && computerChoice === 'paper')
        ) {
          result = 'You win! 🎉';
          rpsPlayerScore++;
        } else {
          result = 'Computer wins! 💻';
          rpsComputerScore++;
        }

        document.getElementById('rpsResult').textContent = 
          `You: ${emojiMap[playerChoice]} vs Computer: ${emojiMap[computerChoice]} - ${result}`;
        document.getElementById('rpsScore').textContent = 
          `You: ${rpsPlayerScore} | Computer: ${rpsComputerScore}`;
      });
    });

    document.getElementById('resetRPS').addEventListener('click', () => {
      rpsPlayerScore = 0;
      rpsComputerScore = 0;
      document.getElementById('rpsResult').textContent = '';
      document.getElementById('rpsScore').textContent = 'You: 0 | Computer: 0';
    });

  } catch (error) {
    console.error("Error loading games:", error);
    document.getElementById("view").innerHTML = `
      <div style="text-align: center; padding: 60px;">
        <h3>Unable to load games</h3>
        <p style="color: #666;">${escapeHtml(error.message)}</p>
        <button onclick="location.reload()" style="background: #e91e63; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin-top: 16px;">Try Again</button>
      </div>
    `;
  }
}



/*COmmunity section starts----------------------------------------------*/



// ==================== COMMUNITY STATE ====================

// ==================== COMMUNITY API FUNCTIONS ====================

async function communityAPI(path, options = {}) {
  return api(`/api/community${path}`, options);
}

// ==================== MAIN COMMUNITY RENDERER ====================

async function renderCommunity() {
  setTitle("Community", "Connect with others, chat, create groups, and share experiences");
  
  try {
    // Fetch initial data
    const [chatsData, groupsData, onlineData] = await Promise.all([
      communityAPI('/chats').catch((err) => {
        console.error('Failed to load chats:', err);
        return { chats: [] };
      }),
      communityAPI('/groups').catch((err) => {
        console.error('Failed to load groups:', err);
        return { groups: [] };
      }),
      communityAPI('/online-users').catch((err) => {
        console.error('Failed to load online users:', err);
        return { users: [] };
      })
    ]);
    
    communityState.chats = chatsData.chats || [];
    communityState.groups = groupsData.groups || [];
    communityState.onlineUsers = onlineData.users || [];
    
    document.getElementById("view").innerHTML = `
      <div class="community-container">
        <!-- Community Header -->
        <div class="community-header" style="
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 24px;
          border-radius: 16px;
          margin-bottom: 24px;
          color: white;
        ">
          <h2 style="margin: 0 0 8px 0; font-size: 24px;">👥 Community Space</h2>
          <p style="margin: 0; opacity: 0.9;">Connect with women who understand your journey</p>
        </div>

        <!-- Tab Navigation -->
        <div class="community-tabs" style="
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          background: #f5f5f5;
          padding: 4px;
          border-radius: 12px;
        ">
          <button class="community-tab active" data-tab="chats" style="
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.3s;
            background: #e91e63;
            color: white;
          ">
            💬 Chats
            ${getUnreadBadge()}
          </button>
          <button class="community-tab" data-tab="groups" style="
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.3s;
          ">
            👥 Groups
          </button>
          <button class="community-tab" data-tab="discover" style="
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.3s;
          ">
            🔍 Discover
          </button>
        </div>

        <!-- Content Area -->
        <div id="communityContent" style="min-height: 400px;">
          ${renderChatsList()}
        </div>

        <!-- Create Group Modal -->
        <div id="createGroupModal" class="modal-backdrop" style="display: none;">
          <div class="modal-content" style="
            background: white;
            border-radius: 16px;
            padding: 24px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
          ">
            <h3>Create New Group</h3>
            <form id="createGroupForm">
              <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px;">Group Name *</label>
                <input type="text" id="groupName" required style="
                  width: 100%;
                  padding: 12px;
                  border: 2px solid #e0e0e0;
                  border-radius: 8px;
                  font-size: 14px;
                " placeholder="Enter group name">
              </div>
              
              <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px;">Description</label>
                <textarea id="groupDescription" rows="3" style="
                  width: 100%;
                  padding: 12px;
                  border: 2px solid #e0e0e0;
                  border-radius: 8px;
                  font-size: 14px;
                " placeholder="What's this group about?"></textarea>
              </div>
              
              <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px;">Category</label>
                <select id="groupCategory" style="
                  width: 100%;
                  padding: 12px;
                  border: 2px solid #e0e0e0;
                  border-radius: 8px;
                  font-size: 14px;
                ">
                  <option value="general">General Support</option>
                  <option value="pcos">PCOS Support</option>
                  <option value="endometriosis">Endometriosis</option>
                  <option value="pregnancy">Pregnancy & TTC</option>
                  <option value="menopause">Menopause</option>
                  <option value="wellness">Wellness & Self-Care</option>
                  <option value="fitness">Fitness & Health</option>
                  <option value="mental-health">Mental Health</option>
                </select>
              </div>
              
              <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px;">Privacy</label>
                <select id="groupPrivacy" style="
                  width: 100%;
                  padding: 12px;
                  border: 2px solid #e0e0e0;
                  border-radius: 8px;
                  font-size: 14px;
                ">
                  <option value="public">Public - Anyone can join</option>
                  <option value="private">Private - Request to join</option>
                </select>
              </div>
              
              <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px;">Group Icon</label>
                <div class="icon-picker" style="display: flex; gap: 8px; flex-wrap: wrap;">
                  ${['🌸', '🌟', '💪', '🧘', '🩸', '🌺', '🦋', '🌈', '💖', '🔥'].map(icon => `
                    <button type="button" class="icon-option" data-icon="${icon}" style="
                      font-size: 24px;
                      padding: 8px;
                      border: 2px solid #e0e0e0;
                      border-radius: 50%;
                      background: white;
                      cursor: pointer;
                      transition: all 0.2s;
                    ">${icon}</button>
                  `).join('')}
                </div>
              </div>
              
              <div style="display: flex; gap: 12px;">
                <button type="submit" class="btn" style="flex: 1;">Create Group</button>
                <button type="button" class="btn secondary" onclick="closeCreateGroup()" style="flex: 1;">Cancel</button>
              </div>
              <div id="groupMessage" style="margin-top: 12px;"></div>
            </form>
          </div>
        </div>
      </div>
    `;

    injectCommunityStyles();
    attachCommunityEvents();
    initializeCommunitySocket();

  } catch (error) {
    console.error("Error rendering community:", error);
    document.getElementById("view").innerHTML = `
      <div style="text-align: center; padding: 60px;">
        <h3>Unable to load community</h3>
        <p style="color: #666;">${escapeHtml(error.message)}</p>
        <button onclick="renderCommunity()" class="btn">Try Again</button>
      </div>
    `;
  }
}

// ==================== RENDER FUNCTIONS ====================

function renderChatsList() {
  if (!communityState.chats.length) {
    return `
      <div style="text-align: center; padding: 40px;">
        <div style="font-size: 48px; margin-bottom: 16px;">💬</div>
        <h3>No conversations yet</h3>
        <p class="muted">Start chatting with other members!</p>
        <button class="btn" onclick="switchCommunityTab('discover')">Discover People</button>
      </div>
    `;
  }

  return `
    <div class="chats-list">
      ${communityState.chats.map(chat => `
        <div class="chat-item" data-chat-id="${chat.id}" data-chat-type="${chat.type}" onclick="openChat('${chat.id}', '${chat.type}', '${escapeHtml(chat.name)}')" style="
          display: flex;
          align-items: center;
          padding: 16px;
          background: white;
          border-radius: 12px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        ">
          <div class="chat-avatar" style="
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: ${chat.type === 'group' ? chat.color || '#764ba2' : '#667eea'};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            margin-right: 12px;
            color: white;
          ">
            ${chat.icon || (chat.type === 'group' ? '👥' : '👤')}
          </div>
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong>${escapeHtml(chat.name)}</strong>
              <span class="muted" style="font-size: 12px;">${formatTime(chat.lastMessageTime)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
              <span class="muted" style="font-size: 13px;">${escapeHtml(chat.lastMessage || 'No messages yet')}</span>
              ${chat.unreadCount ? `<span style="background: #e91e63; color: white; border-radius: 50%; min-width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; padding: 0 6px;">${chat.unreadCount}</span>` : ''}
            </div>
            ${chat.type === 'group' ? `<span class="muted" style="font-size: 11px;">${chat.memberCount || 0} members</span>` : ''}
          </div>
          ${chat.online ? '<span style="width: 10px; height: 10px; background: #4caf50; border-radius: 50%; margin-left: 8px;"></span>' : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function renderGroupsList() {
  return `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h3 style="margin: 0;">Your Groups</h3>
      <button class="btn" onclick="showCreateGroup()">+ Create Group</button>
    </div>
    
    ${communityState.groups.length ? `
      <div class="groups-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
        ${communityState.groups.map(group => `
          <div class="group-card" style="
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            transition: transform 0.2s;
          ">
            <div class="group-banner" style="
              height: 100px;
              background: linear-gradient(135deg, ${group.color || '#667eea'}, ${group.color2 || '#764ba2'});
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 40px;
            ">
              ${group.icon || '👥'}
            </div>
            <div style="padding: 16px;">
              <h4 style="margin: 0 0 8px 0;">${escapeHtml(group.name)}</h4>
              <p class="muted" style="font-size: 13px; margin-bottom: 12px;">${escapeHtml(group.description || 'No description')}</p>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="muted" style="font-size: 12px;">${group.memberCount || 0} members</span>
                <div>
                  ${group.isMember ? `
                    <button class="btn" onclick="openChat('${group.id}', 'group', '${escapeHtml(group.name)}')">Open Chat</button>
                  ` : `
                    <button class="btn" onclick="joinGroup('${group.id}')">${group.privacy === 'private' ? 'Request Join' : 'Join'}</button>
                  `}
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    ` : `
      <div style="text-align: center; padding: 40px;">
        <div style="font-size: 48px; margin-bottom: 16px;">👥</div>
        <h3>No groups yet</h3>
        <p class="muted">Create or join groups to connect with others</p>
      </div>
    `}
  `;
}

function renderDiscoverPeople() {
  return `
    <div class="discover-section">
      <div style="margin-bottom: 16px;">
        <input type="text" id="userSearch" placeholder="🔍 Search users by name or interests..." style="
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 14px;
        ">
      </div>
      
      <h4 style="margin-bottom: 12px;">🟢 Online Now (${communityState.onlineUsers.length})</h4>
      <div id="onlineUsersList" style="margin-bottom: 24px;">
        ${communityState.onlineUsers.length ? communityState.onlineUsers.map(user => renderUserCard(user)).join('') : `
          <p class="muted">No users online right now</p>
        `}
      </div>
      
      <h4 style="margin-bottom: 12px;">👥 Suggested for You</h4>
      <div id="suggestedUsers">
        <p class="muted">Loading suggestions...</p>
      </div>
    </div>
  `;
}

function renderUserCard(user) {
  return `
    <div class="user-card" style="
      display: flex;
      align-items: center;
      padding: 12px;
      background: white;
      border-radius: 12px;
      margin-bottom: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    ">
      <div style="
        width: 45px;
        height: 45px;
        border-radius: 50%;
        background: ${user.color || '#667eea'};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        margin-right: 12px;
        color: white;
      ">
        ${user.avatar || '👤'}
      </div>
      <div style="flex: 1;">
        <strong>${escapeHtml(user.name)}</strong>
        <div style="font-size: 12px; color: #666;">
          ${user.interests ? user.interests.map(i => `<span style="display: inline-block; background: #f0f0f0; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin: 2px;">${escapeHtml(i)}</span>`).join(' ') : ''}
        </div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn" onclick="startDirectChat('${user.id}', '${escapeHtml(user.name)}')" style="padding: 6px 12px; font-size: 12px;">
          💬 Chat
        </button>
      </div>
      ${user.online ? '<div style="width: 8px; height: 8px; background: #4caf50; border-radius: 50%; margin-left: 8px;"></div>' : ''}
    </div>
  `;
}

function renderChatInterface() {
  if (!communityState.currentChat) return '';
  
  const chat = communityState.currentChat;
  
  return `
    <div class="chat-interface" style="
      display: flex;
      flex-direction: column;
      height: 600px;
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    ">
      <div style="
        padding: 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        display: flex;
        align-items: center;
        gap: 12px;
      ">
        <button onclick="closeChat()" style="
          background: none;
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
        ">←</button>
        <div style="
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        ">
          ${chat.type === 'group' ? '👥' : '👤'}
        </div>
        <div style="flex: 1;">
          <strong style="font-size: 16px;">${escapeHtml(chat.name)}</strong>
          <div style="font-size: 12px; opacity: 0.9;">
            ${chat.type === 'group' ? `${chat.memberCount || 0} members` : (chat.online ? 'Online' : 'Offline')}
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button onclick="initiateCall('${chat.id}', 'audio')" style="
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
          ">📞</button>
          <button onclick="initiateCall('${chat.id}', 'video')" style="
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
          ">📹</button>
          ${chat.type === 'group' ? `
            <button onclick="showGroupInfo('${chat.id}')" style="
              background: rgba(255,255,255,0.2);
              border: none;
              color: white;
              width: 36px;
              height: 36px;
              border-radius: 50%;
              cursor: pointer;
              font-size: 16px;
            ">ℹ️</button>
          ` : ''}
        </div>
      </div>
      
      <div id="messagesContainer" style="
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        background: #f8f9fa;
        display: flex;
        flex-direction: column-reverse;
      ">
        <div id="messagesList">
          ${renderMessages(communityState.messages)}
        </div>
      </div>
      
      <div id="typingIndicator" style="
        padding: 4px 16px;
        font-size: 12px;
        color: #666;
        display: none;
      "></div>
      
      <div style="
        padding: 16px;
        background: white;
        border-top: 1px solid #e0e0e0;
        display: flex;
        gap: 8px;
      ">
        <button onclick="attachFile()" style="
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
        ">📎</button>
        <input id="messageInput" type="text" placeholder="Type a message..." style="
          flex: 1;
          padding: 12px;
          border: 2px solid #e0e0e0;
          border-radius: 24px;
          font-size: 14px;
          outline: none;
        " onkeypress="if(event.key==='Enter')sendMessage()">
        <button onclick="sendMessage()" style="
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          color: white;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 18px;
        ">➤</button>
        <button onclick="sendVoiceMessage()" style="
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
        ">🎤</button>
      </div>
    </div>
  `;
}

function renderMessages(messages) {
  if (!messages.length) {
    return `
      <div style="text-align: center; padding: 40px; color: #999;">
        <p>No messages yet</p>
        <p style="font-size: 13px;">Start the conversation!</p>
      </div>
    `;
  }
  
  return messages.map(msg => {
    const isMine = msg.senderId === state.account?.id;
    return `
      <div class="message ${isMine ? 'message-mine' : 'message-other'}" style="
        display: flex;
        flex-direction: ${isMine ? 'row-reverse' : 'row'};
        margin-bottom: 12px;
        align-items: flex-end;
        gap: 8px;
      ">
        ${!isMine ? `
          <div style="
            width: 30px;
            height: 30px;
            border-radius: 50%;
            background: ${msg.senderColor || '#764ba2'};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            color: white;
            flex-shrink: 0;
          ">
            ${msg.senderAvatar || '👤'}
          </div>
        ` : ''}
        <div style="max-width: 70%;">
          ${!isMine && communityState.currentChat?.type === 'group' ? `
            <div style="font-size: 11px; color: #666; margin-bottom: 2px;">
              ${escapeHtml(msg.senderName || 'Unknown')}
            </div>
          ` : ''}
          <div style="
            background: ${isMine ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white'};
            color: ${isMine ? 'white' : '#333'};
            padding: 10px 16px;
            border-radius: ${isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            word-wrap: break-word;
          ">
            ${renderMessageContent(msg)}
          </div>
          <div style="
            font-size: 10px;
            color: #999;
            margin-top: 2px;
            text-align: ${isMine ? 'right' : 'left'};
          ">
            ${formatTime(msg.timestamp)}
            ${isMine && msg.status ? ' • ' + (msg.status === 'sent' ? '✓' : '✓✓') : ''}
          </div>
        </div>
      </div>
    `;
  }).reverse().join('');
}

function renderMessageContent(msg) {
  switch (msg.type) {
    case 'text':
      return escapeHtml(msg.content);
    case 'image':
      return `<img src="${msg.content}" alt="Shared image" style="max-width: 200px; border-radius: 8px; cursor: pointer;" onclick="viewImage('${msg.content}')">`;
    case 'voice':
      return `<audio controls src="${msg.content}" style="max-width: 200px;" preload="none"></audio>`;
    case 'file':
      return `<a href="${msg.content}" target="_blank" style="color: inherit;">📎 ${msg.fileName || 'Download file'}</a>`;
    default:
      return escapeHtml(msg.content);
  }
}

// ==================== WEBSOCKET MANAGEMENT ====================

function initializeCommunitySocket() {
  if (communityState.socket?.readyState === WebSocket.OPEN) return;
  if (communityState.isConnecting) return;
  
  communityState.isConnecting = true;
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/community?token=${state.token}`;
  
  try {
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('✅ Community WebSocket connected');
      communityState.socket = socket;
      communityState.isConnecting = false;
      
      socket.send(JSON.stringify({
        type: 'auth',
        token: state.token,
        userId: state.account?.id
      }));
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSocketMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    socket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      communityState.isConnecting = false;
      showToast('Connection issue. Retrying...', 'warning');
    };
    
    socket.onclose = () => {
      console.log('WebSocket disconnected');
      communityState.socket = null;
      communityState.isConnecting = false;
      
      setTimeout(() => {
        if (state.token) initializeCommunitySocket();
      }, 5000);
    };
    
  } catch (error) {
    console.error('Failed to create WebSocket:', error);
    communityState.isConnecting = false;
  }
}

function handleSocketMessage(data) {
  console.log('📨 Socket message:', data.type);
  
  switch (data.type) {
    case 'new_message':
      if (communityState.currentChat?.id === data.chatId) {
        communityState.messages.push(data.message);
        updateMessagesUI();
        scrollToBottom();
      } else {
        communityState.unreadCounts[data.chatId] = 
          (communityState.unreadCounts[data.chatId] || 0) + 1;
        updateUnreadBadges();
      }
      playMessageSound();
      break;
      
    case 'typing':
      if (communityState.currentChat?.id === data.chatId) {
        showTypingIndicator(data.userId, data.userName);
      }
      break;
      
    case 'user_online':
      updateUserStatus(data.userId, true);
      break;
      
    case 'user_offline':
      updateUserStatus(data.userId, false);
      break;
      
    case 'call_request':
      handleIncomingCall(data);
      break;
      
    case 'call_accepted':
      handleCallAccepted(data);
      break;
      
    case 'call_rejected':
      handleCallRejected(data);
      break;
      
    case 'call_busy':
      showToast('User is on another call', 'warning');
      endCall();
      break;
      
    case 'call_ended':
      endCall();
      break;
      
    case 'webrtc_offer':
      handleWebRTCOffer(data);
      break;
      
    case 'webrtc_answer':
      handleWebRTCAnswer(data);
      break;
      
    case 'ice_candidate':
      handleICECandidate(data);
      break;
      
    case 'group_created':
    case 'user_joined_group':
      refreshCommunityData();
      break;
      
    default:
      console.log('Unknown message type:', data.type);
  }
}

// ==================== CHAT FUNCTIONS ====================

async function openChat(chatId, chatType, chatName) {
  communityState.currentChat = { id: chatId, type: chatType, name: chatName };
  communityState.unreadCounts[chatId] = 0;
  
  try {
    const data = await communityAPI(`/chats/${chatId}/messages`);
    communityState.messages = data.messages || [];
  } catch (error) {
    console.error('Failed to load messages:', error);
    communityState.messages = [];
  }
  
  const content = document.getElementById('communityContent');
  if (content) {
    content.innerHTML = renderChatInterface();
    scrollToBottom();
  }
  
  if (communityState.socket?.readyState === WebSocket.OPEN) {
    communityState.socket.send(JSON.stringify({
      type: 'mark_read',
      chatId: chatId,
      token: state.token,
      userId: state.account?.id
    }));
  }
}

function closeChat() {
  communityState.currentChat = null;
  communityState.messages = [];
  switchCommunityTab('chats');
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input?.value.trim();
  if (!content || !communityState.currentChat) return;
  
  input.value = '';
  
  const message = {
    id: Date.now().toString(),
    chatId: communityState.currentChat.id,
    senderId: state.account?.id,
    senderName: state.account?.name,
    content: content,
    type: 'text',
    timestamp: new Date().toISOString(),
    status: 'sending'
  };
  
  communityState.messages.push(message);
  updateMessagesUI();
  scrollToBottom();
  
  try {
    const apiResponse = await communityAPI('/messages', {
      method: 'POST',
      body: JSON.stringify({
        chatId: communityState.currentChat.id,
        content: content,
        type: 'text'
      })
    });
    
    message.id = apiResponse.messageId || message.id;
    message.status = 'sent';
    
    if (communityState.socket?.readyState === WebSocket.OPEN) {
      communityState.socket.send(JSON.stringify({
        type: 'send_message',
        message: {
          id: message.id,
          chatId: communityState.currentChat.id,
          senderId: state.account?.id,
          senderName: state.account?.name,
          content: content,
          type: 'text',
          timestamp: message.timestamp
        },
        token: state.token,
        userId: state.account?.id
      }));
    }
    
    updateMessagesUI();
    
  } catch (error) {
    console.error('Failed to send message:', error);
    message.status = 'failed';
    updateMessagesUI();
    showToast('Failed to send message', 'error');
  }
}

function updateMessagesUI() {
  const messagesList = document.getElementById('messagesList');
  if (messagesList) {
    messagesList.innerHTML = renderMessages(communityState.messages);
  }
}

function scrollToBottom() {
  setTimeout(() => {
    const container = document.getElementById('messagesContainer');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, 100);
}

function showTypingIndicator(userId, userName) {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) {
    indicator.style.display = 'block';
    indicator.textContent = `${escapeHtml(userName)} is typing...`;
    
    if (indicator.timeout) clearTimeout(indicator.timeout);
    indicator.timeout = setTimeout(() => {
      indicator.style.display = 'none';
    }, 3000);
  }
}

// ==================== VOICE MESSAGE FUNCTIONS ====================

async function sendVoiceMessage() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('Voice messages not supported in your browser', 'error');
    return;
  }
  
  if (communityState.voiceRecorder.mediaRecorder) {
    showToast('Already recording', 'warning');
    return;
  }
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const chunks = [];
    const startTime = Date.now();
    
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    
    // Create stop button
    const stopButton = document.createElement('button');
    stopButton.textContent = '⏹ Stop Recording (0:00)';
    stopButton.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: #e91e63;
      color: white;
      border: none;
      padding: 14px 28px;
      border-radius: 50px;
      cursor: pointer;
      z-index: 10001;
      font-size: 16px;
      font-weight: bold;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    
    // Timer update
    const timerInterval = setInterval(() => {
      if (!stopButton.isConnected) {
        clearInterval(timerInterval);
        return;
      }
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const seconds = elapsed % 60;
      stopButton.textContent = `⏹ Stop Recording (0:${seconds.toString().padStart(2, '0')})`;
    }, 1000);
    
    let isStopped = false;
    
    stopButton.onclick = () => {
      if (mediaRecorder.state === 'recording' && !isStopped) {
        isStopped = true;
        clearInterval(timerInterval);
        mediaRecorder.stop();
        stopButton.remove();
        showToast('Processing voice message...', 'info');
      }
    };
    
    document.body.appendChild(stopButton);
    
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop());
      
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', blob);
      
      try {
        const response = await fetch('/api/community/upload/voice', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${state.token}` },
          body: formData
        });
        
        if (!response.ok) throw new Error('Upload failed');
        
        const data = await response.json();
        
        if (communityState.currentChat) {
          await communityAPI('/messages', {
            method: 'POST',
            body: JSON.stringify({
              chatId: communityState.currentChat.id,
              content: data.url,
              type: 'voice'
            })
          });
          
          if (communityState.socket?.readyState === WebSocket.OPEN) {
            communityState.socket.send(JSON.stringify({
              type: 'send_message',
              message: {
                chatId: communityState.currentChat.id,
                content: data.url,
                type: 'voice',
                senderId: state.account?.id,
                senderName: state.account?.name,
                timestamp: new Date().toISOString()
              },
              token: state.token,
              userId: state.account?.id
            }));
          }
          
          showToast('Voice message sent!', 'success');
          refreshCommunityData();
        }
      } catch (error) {
        console.error('Voice message error:', error);
        showToast('Failed to send voice message', 'error');
      }
      
      communityState.voiceRecorder.mediaRecorder = null;
    };
    
    mediaRecorder.start(1000);
    communityState.voiceRecorder.mediaRecorder = mediaRecorder;
    communityState.voiceRecorder.stream = stream;
    
    setTimeout(() => {
      if (mediaRecorder.state === 'recording' && !isStopped) {
        isStopped = true;
        clearInterval(timerInterval);
        mediaRecorder.stop();
        stopButton.remove();
        showToast('Max recording time reached (60s)', 'info');
      }
    }, 60000);
    
  } catch (error) {
    console.error('Microphone error:', error);
    showToast('Could not access microphone', 'error');
  }
}

async function attachFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,.pdf,.doc,.docx';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    showToast('Uploading file...', 'info');
    
    try {
      const response = await fetch('/api/community/upload/file', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${state.token}` },
        body: formData
      });
      
      const data = await response.json();
      
      if (communityState.currentChat) {
        await communityAPI('/messages', {
          method: 'POST',
          body: JSON.stringify({
            chatId: communityState.currentChat.id,
            content: data.url,
            type: file.type.startsWith('image/') ? 'image' : 'file',
            fileName: file.name
          })
        });
        
        showToast('File sent', 'success');
        refreshCommunityData();
      }
    } catch (error) {
      showToast('Failed to upload file', 'error');
    }
  };
  
  input.click();
}

// ==================== CALL FUNCTIONS ====================

async function initiateCall(targetId, callType) {
  if (communityState.call.active) {
    showToast('Already in a call. End current call first.', 'warning');
    return;
  }
  
  if (!communityState.socket || communityState.socket.readyState !== WebSocket.OPEN) {
    showToast('Not connected. Please refresh the page.', 'error');
    return;
  }
  
  showToast(`Initiating ${callType === 'video' ? 'video' : 'audio'} call...`, 'info');
  
  communityState.call = {
    active: true,
    type: callType,
    peerConnection: null,
    localStream: null,
    remoteStream: null,
    targetId: targetId,
    callerName: null,
    startTime: null,
    status: 'ringing',
    timeout: null
  };
  
  communityState.socket.send(JSON.stringify({
    type: 'call_request',
    targetId: targetId,
    callType: callType,
    callerName: state.account?.name,
    callerId: state.account?.id,
    token: state.token
  }));
  
  saveCallLog(targetId, 'outgoing', 'missed', callType);
  showCallUI('outgoing', targetId, callType);
  
  communityState.call.timeout = setTimeout(() => {
    if (communityState.call.active && communityState.call.status === 'ringing') {
      endCall();
      showToast('Call not answered', 'info');
    }
  }, 30000);
}

function handleIncomingCall(data) {
  if (communityState.call.active) {
    communityState.socket?.send(JSON.stringify({
      type: 'call_busy',
      targetId: data.callerId,
      token: state.token
    }));
    return;
  }
  
  communityState.call = {
    active: true,
    type: data.callType,
    peerConnection: null,
    localStream: null,
    remoteStream: null,
    targetId: data.callerId,
    callerName: data.callerName,
    startTime: null,
    status: 'incoming',
    timeout: null
  };
  
  const modal = document.createElement('div');
  modal.id = 'incomingCallModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.9);
    z-index: 20000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 24px;
      padding: 32px;
      text-align: center;
      max-width: 350px;
      width: 90%;
    ">
      <div style="
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea, #764ba2);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
        font-size: 40px;
      ">
        ${data.callType === 'video' ? '📹' : '📞'}
      </div>
      <h2 style="margin: 0 0 8px 0;">${escapeHtml(data.callerName || 'Unknown')}</h2>
      <p style="color: #666; margin-bottom: 24px;">Incoming ${data.callType} call...</p>
      <div style="display: flex; gap: 16px; justify-content: center;">
        <button onclick="acceptCall()" style="
          background: #4caf50;
          color: white;
          border: none;
          padding: 12px 28px;
          border-radius: 50px;
          cursor: pointer;
          font-size: 16px;
          font-weight: bold;
        ">Accept</button>
        <button onclick="rejectCall()" style="
          background: #e91e63;
          color: white;
          border: none;
          padding: 12px 28px;
          border-radius: 50px;
          cursor: pointer;
          font-size: 16px;
          font-weight: bold;
        ">Reject</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  playRingtone('incoming');
}

async function acceptCall() {
  document.getElementById('incomingCallModal')?.remove();
  stopRingtone();
  
  if (!communityState.call.active || communityState.call.status !== 'incoming') {
    showToast('Call no longer available', 'error');
    return;
  }
  
  communityState.call.status = 'connected';
  communityState.call.startTime = Date.now();
  
  communityState.socket?.send(JSON.stringify({
    type: 'call_accepted',
    targetId: communityState.call.targetId,
    callType: communityState.call.type,
    token: state.token
  }));
  
  await startWebRTC(communityState.call.targetId, communityState.call.type);
  showCallUI('connected', communityState.call.targetId, communityState.call.type);
  saveCallLog(communityState.call.targetId, 'incoming', 'answered', communityState.call.type);
}

function rejectCall() {
  document.getElementById('incomingCallModal')?.remove();
  stopRingtone();
  
  communityState.socket?.send(JSON.stringify({
    type: 'call_rejected',
    targetId: communityState.call.targetId,
    token: state.token
  }));
  
  saveCallLog(communityState.call.targetId, 'incoming', 'rejected', communityState.call.type);
  endCall();
  showToast('Call rejected', 'info');
}

function handleCallAccepted(data) {
  if (communityState.call.active && communityState.call.status === 'ringing') {
    communityState.call.status = 'connected';
    communityState.call.startTime = Date.now();
    if (communityState.call.timeout) clearTimeout(communityState.call.timeout);
    
    const statusEl = document.getElementById('callStatus');
    if (statusEl) statusEl.textContent = 'Connected';
    
    startWebRTC(communityState.call.targetId, communityState.call.type);
    saveCallLog(communityState.call.targetId, 'outgoing', 'answered', communityState.call.type);
  }
}

function handleCallRejected(data) {
  showToast('Call was rejected', 'info');
  endCall();
}

async function startWebRTC(targetId, callType) {
  try {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
    
    const pc = new RTCPeerConnection(configuration);
    communityState.call.peerConnection = pc;
    
    const constraints = { audio: true };
    if (callType === 'video') constraints.video = true;
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    communityState.call.localStream = stream;
    
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        communityState.socket?.send(JSON.stringify({
          type: 'ice_candidate',
          targetId: targetId,
          candidate: event.candidate,
          token: state.token
        }));
      }
    };
    
    pc.ontrack = (event) => {
      communityState.call.remoteStream = event.streams[0];
      const remoteVideo = document.getElementById('remoteVideo');
      if (remoteVideo) {
        remoteVideo.srcObject = event.streams[0];
      }
    };
    
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
    };
    
    if (communityState.call.status === 'connected') {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      communityState.socket?.send(JSON.stringify({
        type: 'webrtc_offer',
        targetId: targetId,
        sdp: pc.localDescription,
        token: state.token
      }));
    }
    
    if (callType === 'video') {
      const localVideo = document.getElementById('localVideo');
      if (localVideo) {
        localVideo.srcObject = stream;
      }
    }
    
  } catch (error) {
    console.error('WebRTC error:', error);
    showToast('Failed to start call', 'error');
    endCall();
  }
}

async function handleWebRTCOffer(data) {
  if (!communityState.call.peerConnection) {
    const configuration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };
    communityState.call.peerConnection = new RTCPeerConnection(configuration);
    
    const constraints = { audio: true };
    if (communityState.call.type === 'video') constraints.video = true;
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    communityState.call.localStream = stream;
    stream.getTracks().forEach(track => {
      communityState.call.peerConnection.addTrack(track, stream);
    });
    
    communityState.call.peerConnection.ontrack = (event) => {
      communityState.call.remoteStream = event.streams[0];
      const remoteVideo = document.getElementById('remoteVideo');
      if (remoteVideo) {
        remoteVideo.srcObject = event.streams[0];
      }
    };
    
    communityState.call.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        communityState.socket?.send(JSON.stringify({
          type: 'ice_candidate',
          targetId: communityState.call.targetId,
          candidate: event.candidate,
          token: state.token
        }));
      }
    };
    
    if (communityState.call.type === 'video') {
      const localVideo = document.getElementById('localVideo');
      if (localVideo) {
        localVideo.srcObject = stream;
      }
    }
  }
  
  await communityState.call.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
  const answer = await communityState.call.peerConnection.createAnswer();
  await communityState.call.peerConnection.setLocalDescription(answer);
  
  communityState.socket?.send(JSON.stringify({
    type: 'webrtc_answer',
    targetId: communityState.call.targetId,
    sdp: communityState.call.peerConnection.localDescription,
    token: state.token
  }));
}

async function handleWebRTCAnswer(data) {
  if (communityState.call.peerConnection) {
    await communityState.call.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
  }
}

async function handleICECandidate(data) {
  if (communityState.call.peerConnection && data.candidate) {
    try {
      await communityState.call.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }
}

function endCall() {
  if (communityState.call.timeout) {
    clearTimeout(communityState.call.timeout);
  }
  
  if (communityState.socket?.readyState === WebSocket.OPEN && communityState.call.targetId) {
    communityState.socket.send(JSON.stringify({
      type: 'call_ended',
      targetId: communityState.call.targetId,
      duration: communityState.call.startTime ? Math.floor((Date.now() - communityState.call.startTime) / 1000) : 0,
      token: state.token
    }));
  }
  
  if (communityState.call.peerConnection) {
    communityState.call.peerConnection.close();
    communityState.call.peerConnection = null;
  }
  
  if (communityState.call.localStream) {
    communityState.call.localStream.getTracks().forEach(track => track.stop());
    communityState.call.localStream = null;
  }
  
  const callUI = document.getElementById('callUI');
  if (callUI) callUI.remove();
  
  const modal = document.getElementById('incomingCallModal');
  if (modal) modal.remove();
  
  stopRingtone();
  
  communityState.call = {
    active: false,
    type: null,
    peerConnection: null,
    localStream: null,
    remoteStream: null,
    targetId: null,
    callerName: null,
    startTime: null,
    status: null,
    timeout: null
  };
}

function showCallUI(direction, targetId, callType) {
  const existingUI = document.getElementById('callUI');
  if (existingUI) existingUI.remove();
  
  const callUI = document.createElement('div');
  callUI.id = 'callUI';
  callUI.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #1a1a2e;
    z-index: 20000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
  `;
  
  const targetName = direction === 'outgoing' ? 
    (communityState.currentChat?.name || 'User') : 
    (communityState.call.callerName || 'User');
  
  callUI.innerHTML = `
    <div style="text-align: center;">
      <div style="
        width: 120px;
        height: 120px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea, #764ba2);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 24px;
        font-size: 60px;
      ">
        ${callType === 'video' ? '📹' : '📞'}
      </div>
      <h2 style="margin: 0 0 8px 0;">${escapeHtml(targetName)}</h2>
      <p id="callStatus" style="color: #aaa; margin-bottom: 40px;">
        ${direction === 'outgoing' ? 'Ringing...' : 'Connected'}
      </p>
      <div style="display: flex; gap: 20px; justify-content: center;">
        ${callType === 'video' ? `
          <button onclick="toggleVideo()" style="
            width: 60px;
            height: 60px;
            border-radius: 50%;
            border: none;
            background: #333;
            color: white;
            font-size: 24px;
            cursor: pointer;
          ">📹</button>
        ` : ''}
        <button onclick="toggleMute()" style="
          width: 60px;
          height: 60px;
          border-radius: 50%;
          border: none;
          background: #333;
          color: white;
          font-size: 24px;
          cursor: pointer;
        ">🎤</button>
        <button onclick="endCall()" style="
          width: 60px;
          height: 60px;
          border-radius: 50%;
          border: none;
          background: #e91e63;
          color: white;
          font-size: 24px;
          cursor: pointer;
        ">📞</button>
      </div>
    </div>
    ${callType === 'video' ? `
      <video id="localVideo" autoplay muted style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 120px;
        height: 160px;
        border-radius: 12px;
        border: 2px solid white;
        object-fit: cover;
      "></video>
      <video id="remoteVideo" autoplay style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 80%;
        max-height: 80vh;
        border-radius: 12px;
        object-fit: cover;
      "></video>
    ` : ''}
  `;
  
  document.body.appendChild(callUI);
}

function toggleMute() {
  if (communityState.call.localStream) {
    const audioTracks = communityState.call.localStream.getAudioTracks();
    if (audioTracks.length) {
      const isMuted = !audioTracks[0].enabled;
      audioTracks.forEach(track => track.enabled = !isMuted);
      showToast(isMuted ? 'Microphone off' : 'Microphone on', 'info');
    }
  }
}

function toggleVideo() {
  if (communityState.call.localStream) {
    const videoTracks = communityState.call.localStream.getVideoTracks();
    if (videoTracks.length) {
      const isOff = !videoTracks[0].enabled;
      videoTracks.forEach(track => track.enabled = !isOff);
      showToast(isOff ? 'Camera off' : 'Camera on', 'info');
    }
  }
}

async function saveCallLog(targetId, direction, status, callType) {
  try {
    await fetch('/api/community/call-logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({
        targetId,
        direction,
        status,
        callType,
        duration: 0
      })
    });
  } catch (error) {
    console.error('Failed to save call log:', error);
  }
}

// ==================== GROUP FUNCTIONS ====================

function showCreateGroup() {
  const modal = document.getElementById('createGroupModal');
  if (modal) {
    modal.style.display = 'flex';
    setupGroupIconPicker();
    setupCreateGroupForm();
  }
}

function closeCreateGroup() {
  const modal = document.getElementById('createGroupModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function setupGroupIconPicker() {
  document.querySelectorAll('.icon-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.icon-option').forEach(b => {
        b.style.border = '2px solid #e0e0e0';
        b.style.transform = 'scale(1)';
        delete b.dataset.selected;
      });
      btn.style.border = '2px solid #e91e63';
      btn.style.transform = 'scale(1.2)';
      btn.dataset.selected = 'true';
    });
  });
}

function setupCreateGroupForm() {
  const form = document.getElementById('createGroupForm');
  if (!form) return;
  
  form.onsubmit = async (e) => {
    e.preventDefault();
    
    const selectedIcon = document.querySelector('.icon-option[data-selected="true"]')?.dataset.icon || '👥';
    const name = document.getElementById('groupName').value.trim();
    const description = document.getElementById('groupDescription').value.trim();
    const category = document.getElementById('groupCategory').value;
    const privacy = document.getElementById('groupPrivacy').value;
    
    if (!name) {
      showMessage('groupMessage', 'Please enter a group name', true);
      return;
    }
    
    try {
      await communityAPI('/groups', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          category,
          privacy,
          icon: selectedIcon
        })
      });
      
      showMessage('groupMessage', 'Group created successfully!', false);
      
      setTimeout(() => {
        closeCreateGroup();
        refreshCommunityData();
        switchCommunityTab('groups');
      }, 1500);
      
    } catch (error) {
      showMessage('groupMessage', error.message, true);
    }
  };
}

async function joinGroup(groupId) {
  try {
    await communityAPI(`/groups/${groupId}/join`, { method: 'POST' });
    showToast('Joined group successfully!', 'success');
    refreshCommunityData();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function showGroupInfo(groupId) {
  const group = communityState.groups.find(g => g.id === groupId);
  if (!group) return;
  
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.7);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 16px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3>${escapeHtml(group.name)}</h3>
        <button onclick="this.closest('.modal-backdrop').remove()" style="
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
        ">✕</button>
      </div>
      <p>${escapeHtml(group.description || 'No description')}</p>
      <div style="margin-top: 16px;">
        <h4>Members (${group.memberCount || 0})</h4>
        <div id="groupMembersList"><p>Loading members...</p></div>
      </div>
      <div style="margin-top: 20px;">
        <button class="btn secondary" onclick="leaveGroup('${groupId}')">Leave Group</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  loadGroupMembers(groupId);
}

async function loadGroupMembers(groupId) {
  try {
    const data = await communityAPI(`/groups/${groupId}/members`);
    const list = document.getElementById('groupMembersList');
    if (list) {
      list.innerHTML = data.members.map(member => `
        <div style="display: flex; align-items: center; padding: 8px; border-bottom: 1px solid #f0f0f0;">
          <div style="
            width: 35px;
            height: 35px;
            border-radius: 50%;
            background: #667eea;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
          ">${member.avatar || '👤'}</div>
          <div style="flex: 1;">
            <strong>${escapeHtml(member.name)}</strong>
            ${member.isAdmin ? '<span style="color: #e91e63;"> (Admin)</span>' : ''}
          </div>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Failed to load members:', error);
  }
}

async function leaveGroup(groupId) {
  if (!confirm('Are you sure you want to leave this group?')) return;
  
  try {
    await communityAPI(`/groups/${groupId}/leave`, { method: 'POST' });
    showToast('Left group', 'info');
    closeChat();
    refreshCommunityData();
    document.querySelector('.modal-backdrop')?.remove();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==================== DISCOVER FUNCTIONS ====================

async function searchUsers(query) {
  try {
    const data = await communityAPI(`/users/search?q=${encodeURIComponent(query)}`);
    const container = document.getElementById('suggestedUsers');
    if (container) {
      container.innerHTML = data.users.length ? 
        data.users.map(user => renderUserCard(user)).join('') :
        '<p class="muted">No users found</p>';
    }
  } catch (error) {
    console.error('Search failed:', error);
  }
}

async function startDirectChat(userId, userName) {
  try {
    const data = await communityAPI('/chats/direct', {
      method: 'POST',
      body: JSON.stringify({ targetUserId: userId })
    });
    openChat(data.chatId, 'direct', userName);
  } catch (error) {
    showToast('Failed to start chat', 'error');
  }
}

// ==================== UI HELPERS ====================

function switchCommunityTab(tab) {
  communityState.activeTab = tab;
  
  document.querySelectorAll('.community-tab').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle('active', isActive);
    btn.style.background = isActive ? '#e91e63' : '#f5f5f5';
    btn.style.color = isActive ? 'white' : '#333';
  });
  
  const content = document.getElementById('communityContent');
  if (!content) return;
  
  switch (tab) {
    case 'chats':
      content.innerHTML = renderChatsList();
      break;
    case 'groups':
      content.innerHTML = renderGroupsList();
      break;
    case 'discover':
      content.innerHTML = renderDiscoverPeople();
      loadSuggestedUsers();
      break;
  }
}

async function loadSuggestedUsers() {
  try {
    const data = await communityAPI('/users/suggested');
    const container = document.getElementById('suggestedUsers');
    if (container) {
      container.innerHTML = data.users.length ?
        data.users.map(user => renderUserCard(user)).join('') :
        '<p class="muted">No suggestions available</p>';
    }
  } catch (error) {
    console.error('Failed to load suggestions:', error);
  }
}

function getUnreadBadge() {
  const totalUnread = Object.values(communityState.unreadCounts)
    .reduce((sum, count) => sum + count, 0);
  
  return totalUnread > 0 ? 
    `<span style="background: #e91e63; color: white; border-radius: 10px; padding: 2px 8px; font-size: 11px; margin-left: 6px;">${totalUnread}</span>` : '';
}

function updateUnreadBadges() {
  const badge = document.querySelector('.community-tab.active .unread-count-badge');
  if (badge) {
    const totalUnread = Object.values(communityState.unreadCounts)
      .reduce((sum, count) => sum + count, 0);
    if (totalUnread > 0) {
      badge.textContent = totalUnread;
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }
  }
  
  const chatsList = document.getElementById('communityContent');
  if (chatsList && communityState.activeTab === 'chats') {
    chatsList.innerHTML = renderChatsList();
  }
}

function updateUserStatus(userId, isOnline) {
  communityState.chats = communityState.chats.map(chat => {
    if (chat.type === 'direct' && chat.userId === userId) {
      return { ...chat, online: isOnline };
    }
    return chat;
  });
  
  if (isOnline) {
    if (!communityState.onlineUsers.find(u => u.id === userId)) {
      communityState.onlineUsers.push({ id: userId, online: true });
    }
  } else {
    communityState.onlineUsers = communityState.onlineUsers.filter(u => u.id !== userId);
  }
  
  if (communityState.activeTab === 'chats') {
    const content = document.getElementById('communityContent');
    if (content) content.innerHTML = renderChatsList();
  }
}

async function refreshCommunityData() {
  try {
    const [chatsData, groupsData, onlineData] = await Promise.all([
      communityAPI('/chats').catch(() => ({ chats: [] })),
      communityAPI('/groups').catch(() => ({ groups: [] })),
      communityAPI('/online-users').catch(() => ({ users: [] }))
    ]);
    
    communityState.chats = chatsData.chats || [];
    communityState.groups = groupsData.groups || [];
    communityState.onlineUsers = onlineData.users || [];
    
    switchCommunityTab(communityState.activeTab);
  } catch (error) {
    console.error('Failed to refresh community data:', error);
  }
}

// ==================== UTILITY FUNCTIONS ====================

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function showToast(message, type = 'info') {
  const existingToast = document.querySelector('.custom-toast');
  if (existingToast) existingToast.remove();
  
  const toast = document.createElement('div');
  toast.className = 'custom-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'error' ? '#e91e63' : type === 'success' ? '#4caf50' : '#333'};
    color: white;
    padding: 12px 24px;
    border-radius: 50px;
    z-index: 30000;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 3000);
}

function showMessage(elementId, message, isError) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = message;
    element.style.color = isError ? '#e91e63' : '#4caf50';
    setTimeout(() => {
      element.textContent = '';
    }, 3000);
  }
}

function playMessageSound() {
  try {
    const audio = new Audio('/sounds/message.mp3');
    audio.volume = 0.3;
    audio.play().catch(() => {});
  } catch (e) {}
}

function playRingtone(type) {
  stopRingtone();
  try {
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0.5;
    
    if (type === 'incoming') {
      audio.src = 'https://www.soundjay.com/misc/sounds/ringtone-1.mp3';
    } else {
      audio.src = 'https://www.soundjay.com/misc/sounds/calling-1.mp3';
    }
    
    audio.play().catch(e => console.log('Audio play failed:', e));
    communityState.ringtone = audio;
  } catch (e) {}
}

function stopRingtone() {
  if (communityState.ringtone) {
    communityState.ringtone.pause();
    communityState.ringtone = null;
  }
}

function viewImage(url) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.9);
    z-index: 20000;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  `;
  modal.innerHTML = `<img src="${url}" style="max-width: 90%; max-height: 90%;">`;
  modal.onclick = () => modal.remove();
  document.body.appendChild(modal);
}

function injectCommunityStyles() {
  if (document.getElementById('community-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'community-styles';
  style.textContent = `
    .chat-item:hover, .user-card:hover, .group-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
    }
    .message-mine { animation: slideInRight 0.3s ease; }
    .message-other { animation: slideInLeft 0.3s ease; }
    @keyframes slideInRight {
      from { opacity: 0; transform: translateX(50px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideInLeft {
      from { opacity: 0; transform: translateX(-50px); }
      to { opacity: 1; transform: translateX(0); }
    }
    #messagesContainer::-webkit-scrollbar { width: 6px; }
    #messagesContainer::-webkit-scrollbar-track { background: #f1f1f1; }
    #messagesContainer::-webkit-scrollbar-thumb { background: #888; border-radius: 3px; }
    @media (max-width: 768px) {
      .groups-grid { grid-template-columns: 1fr !important; }
    }
  `;
  document.head.appendChild(style);
}

function attachCommunityEvents() {
  document.querySelectorAll('.community-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchCommunityTab(tab.dataset.tab);
    });
  });
  
  const searchInput = document.getElementById('userSearch');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => searchUsers(e.target.value), 300);
    });
  }
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (communityState.call.active) {
        endCall();
      } else if (communityState.currentChat) {
        closeChat();
      }
    }
  });
}

// ==================== INITIALIZATION ====================

if (state.token && !communityState.socket) {
  const originalRenderApp = renderApp;
  renderApp = async function() {
    await originalRenderApp();
    if (state.view === 'community') {
      initializeCommunitySocket();
    }
  };
}



/*COMMUNITY SEC ENDS-----------------------------*/





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