const doctorApp = document.getElementById("doctorApp");
const token = localStorage.getItem("menstrumateToken");

const doctorState = {
  account: null,
  summary: null,
  patients: [],
  alerts: [],
  conditions: [],
  selectedPatient: null,
  appointments: [],
  doctorInsights: null,
  chats: [],
  activeChat: null,
  isLoading: false,
  loadPromise: null,
  chatPollTimer: null,
  typingTimer: null
};

function doctorApi(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status}) while loading ${path}`);
    return data;
  });
}

function safe(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDate(value) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function riskClass(level) {
  return `risk ${String(level || "low").toLowerCase()}`;
}

function patientInitials(patient = {}) {
  return String(patient.name || "P")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "P";
}

function chatHasUnread(chat) {
  const message = chat.lastMessage;
  if (!message) return false;
  return message.receiverId === doctorState.account?.id && (!message.seenAt || message.status !== "seen");
}

function doctorNotifications() {
  const alerts = doctorState.alerts.map((alert) => ({
    type: "Alert",
    id: `alert_${alert.id || alert.patientId}`,
    patientId: alert.patientId,
    patientName: alert.patientName,
    message: alert.message,
    level: alert.riskLevel,
    timestamp: alert.createdAt,
    unread: true
  }));
  const messages = doctorState.chats
    .filter((chat) => chat.lastMessage)
    .map((chat) => ({
      type: "Message",
      id: `message_${chat.chatId}`,
      userId: chat.userId,
      patientName: chat.patient?.name,
      message: chat.lastMessage?.message || chat.lastMessage?.text,
      timestamp: chat.updatedAt || chat.lastMessage?.timestamp,
      unread: chatHasUnread(chat)
    }));
  return { alerts, messages };
}

function notificationCount() {
  const notifications = doctorNotifications();
  return notifications.alerts.length + notifications.messages.filter((item) => item.unread).length;
}

function patientAppointments(patientId) {
  return doctorState.appointments.filter((item) => item.patientId === patientId);
}

function patientActivityStatus(patient) {
  const inactive = patient.risk?.noActivity || patient.riskReasons?.includes("No activity for over 30 days");
  return inactive ? "Inactive" : "Active";
}

function maxCount(items, key = "count") {
  return Math.max(1, ...items.map((item) => Number(item[key] || 0)));
}

function appointmentStatusAnalytics() {
  return Object.entries(doctorState.appointments.reduce((counts, item) => {
    const status = item.status || "unknown";
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {})).map(([status, count]) => ({ status, count }));
}

function activityAnalytics() {
  const active = doctorState.summary?.activePatients || 0;
  const inactive = Math.max(0, (doctorState.summary?.totalPatients || 0) - active);
  return [
    { label: "Active", count: active },
    { label: "Inactive", count: inactive }
  ].filter((item) => item.count > 0);
}

function aiInsightItems() {
  const insights = [];
  const highPainCount = doctorState.doctorInsights?.highPainAlerts?.length || 0;
  const inactiveCount = doctorState.doctorInsights?.inactiveUsers?.length || 0;
  const irregularPatients = (doctorState.doctorInsights?.highRiskPatients || [])
    .filter((patient) => (patient.riskReasons || []).some((reason) => String(reason).toLowerCase().includes("irregular")));
  const repeatedSymptoms = (doctorState.doctorInsights?.frequentSymptoms || []).filter((item) => Number(item.count) > 1);
  if (highPainCount) insights.push({ title: "Repeated pain spikes", detail: `${highPainCount} shared high-pain alert${highPainCount === 1 ? "" : "s"} detected.` });
  if (inactiveCount) insights.push({ title: "Inactivity detection", detail: `${inactiveCount} patient${inactiveCount === 1 ? "" : "s"} flagged for inactivity.` });
  if (irregularPatients.length) insights.push({ title: "Irregular cycle patterns", detail: `${irregularPatients.length} high-risk patient${irregularPatients.length === 1 ? "" : "s"} include irregular cycle reasons.` });
  if (repeatedSymptoms.length) insights.push({ title: "Repeated symptom frequency", detail: `${repeatedSymptoms.length} repeated shared symptom pattern${repeatedSymptoms.length === 1 ? "" : "s"} available.` });
  return insights;
}

function logoutDoctor() {
  doctorApi("/api/doctor/status", {
    method: "POST",
    body: JSON.stringify({ isOnline: false })
  }).catch(() => {});
  localStorage.removeItem("menstrumateToken");
  localStorage.removeItem("menstrumateRole");
  window.location.href = "/";
}

async function initDoctorDashboard() {
  if (!token) {
    window.location.href = "/";
    return;
  }

  try {
    const me = await doctorApi("/api/me");
    if (me.account.role !== "doctor") {
      window.location.href = "/";
      return;
    }
    doctorState.account = me.account;
    renderShell();
    await loadPatients();
  } catch {
    logoutDoctor();
  }
}

function renderShell() {
  doctorApp.innerHTML = `
    <section class="doctor-shell">
      <aside class="doctor-sidebar">
        <div class="brand">Menstrumate</div>
        <div class="doctor-profile-summary">
          <p class="doctor-kicker">Doctor Dashboard</p>
          <strong>${safe(doctorState.account.name)}</strong>
          <span>${safe(doctorState.account.specialty || "Gynecology")}</span>
        </div>
        <nav class="doctor-nav" aria-label="Doctor dashboard sections">
          <a href="#overview">Overview</a>
          <a href="#today">Today's Patients</a>
          <a href="#messages">Messages</a>
          <a href="#patients">Patients</a>
          <a href="#alerts">Alerts</a>
        </nav>
        <button class="btn secondary" id="doctorLogout">Logout</button>
      </aside>
      <section class="doctor-main">
        <header class="doctor-top">
          <div>
            <h1>Patient Monitoring</h1>
            <p>Live patient risk, cycle, symptom, and follow-up data from backend storage.</p>
          </div>
          <div class="doctor-top-actions">
            <div class="doctor-notification-hub">
              <button class="doctor-notification-bell" id="doctorNotificationBell" aria-label="Open dashboard notifications" aria-expanded="false">
                <span>!</span>
                <strong id="doctorNotificationBadge" hidden>0</strong>
              </button>
              <div class="doctor-notification-menu" id="doctorNotificationMenu" role="dialog" aria-label="Dashboard notifications" hidden>
                <div class="doctor-notification-head">
                  <strong>Notifications</strong>
                  <span id="doctorNotificationMeta"></span>
                </div>
                <div id="doctorNotificationList"></div>
              </div>
            </div>
            <button class="btn" id="refreshPatients" type="button">Refresh</button>
          </div>
        </header>
        <section id="doctorContent" aria-live="polite"></section>
      </section>
    </section>
    <div id="patientModal" class="modal-backdrop" hidden></div>
  `;
  document.getElementById("doctorLogout").addEventListener("click", logoutDoctor);
  document.getElementById("refreshPatients").addEventListener("click", () => loadPatients().catch(() => updateRefreshState()));
  setupDoctorNotificationBell();
}

async function loadPatients() {
  if (doctorState.loadPromise) return doctorState.loadPromise;
  doctorState.isLoading = true;
  renderDashboardLoading();
  updateRefreshState();
  doctorState.loadPromise = Promise.all([
    doctorApi("/api/patients"),
    doctorApi("/api/doctor/chats"),
    doctorApi(`/api/appointments/doctor/${doctorState.account.id}`),
    doctorApi("/api/doctor/insights")
  ]).then(([data, chatData, appointmentData, doctorInsights]) => {
    doctorState.summary = data.summary;
    doctorState.patients = data.patients;
    doctorState.alerts = data.alerts;
    doctorState.conditions = data.conditions;
    doctorState.chats = chatData.chats;
    doctorState.appointments = appointmentData.appointments;
    doctorState.doctorInsights = doctorInsights;
    renderDashboardContent();
  }).finally(() => {
    doctorState.isLoading = false;
    doctorState.loadPromise = null;
    updateRefreshState();
  });
  return doctorState.loadPromise;
}

function updateRefreshState() {
  const button = document.getElementById("refreshPatients");
  if (!button) return;
  button.disabled = doctorState.isLoading;
  button.classList.toggle("is-loading", doctorState.isLoading);
  button.textContent = doctorState.isLoading ? "Refreshing..." : "Refresh";
}

function renderDashboardLoading() {
  const content = document.getElementById("doctorContent");
  if (!content || doctorState.summary) return;
  content.innerHTML = `
    <section id="overview" class="doctor-summary dashboard-loading" aria-label="Loading dashboard">
      ${Array.from({ length: 4 }).map(() => `<article class="doctor-card metric-card skeleton-card"><span></span><strong></strong><small></small></article>`).join("")}
    </section>
    <section class="doctor-card skeleton-panel"></section>
    <section class="doctor-card skeleton-panel"></section>
    <section class="doctor-card skeleton-panel wide"></section>
  `;
}

function renderDashboardContent() {
  const summary = doctorState.summary;
  document.getElementById("doctorContent").innerHTML = `
    <section id="overview" class="doctor-summary">
      <article class="doctor-card metric-card"><span>Total Patients</span><strong>${summary.totalPatients}</strong><small>All monitored profiles</small></article>
      <article class="doctor-card metric-card"><span>Active Patients</span><strong>${summary.activePatients}</strong><small>Recent activity window</small></article>
      <article class="doctor-card metric-card high"><span>High Risk Patients</span><strong>${summary.highRiskPatients}</strong><small>Needs attention</small></article>
      <article class="doctor-card metric-card"><span>New Patients</span><strong>${summary.newPatients}</strong><small>Joined this week</small></article>
    </section>

    <section id="alerts" class="doctor-card alerts-panel">
      <div class="section-row">
        <div>
          <h2>Alerts</h2>
          <p>Generated from severe symptoms, inactivity, and irregular cycle rules.</p>
        </div>
      </div>
      <div class="alerts-list">
        ${doctorState.alerts.length ? doctorState.alerts.map((alert) => `
          <button class="alert-item ${alert.riskLevel.toLowerCase()}" data-patient="${alert.patientId}">
            <span class="${riskClass(alert.riskLevel)}">${safe(alert.riskLevel)}</span>
            <span class="alert-copy">
              <strong>${safe(alert.patientName)}</strong>
              <span>${safe(alert.message)}</span>
              <time>${formatDate(alert.createdAt)}</time>
            </span>
          </button>
        `).join("") : `<p class="empty-state">No patient alerts right now.</p>`}
      </div>
    </section>

    <section class="doctor-card insights-panel">
      <div class="section-row">
        <div>
          <h2>Doctor Insights</h2>
          <p>Shared symptom trends, high pain alerts, and inactive patient signals.</p>
        </div>
      </div>
      <div class="grid">
        <article class="detail-panel">
          <h3>High-risk Patients</h3>
          ${doctorState.doctorInsights.highRiskPatients.length ? doctorState.doctorInsights.highRiskPatients.slice(0, 5).map((patient) => `<p><strong>${safe(patient.name)}</strong><br><span class="muted">${safe(patient.riskReasons.join(", "))}</span></p>`).join("") : `<p class="empty-state">No high-risk patients.</p>`}
        </article>
        <article class="detail-panel">
          <h3>High Pain Alerts</h3>
          ${doctorState.doctorInsights.highPainAlerts.length ? doctorState.doctorInsights.highPainAlerts.slice(0, 5).map((alert) => `<p><strong>${safe(alert.patientName)}</strong> ${safe(alert.painLevel)}/10<br><span class="muted">${safe(alert.date)}</span></p>`).join("") : `<p class="empty-state">No shared high pain alerts.</p>`}
        </article>
        <article class="detail-panel">
          <h3>Frequent Symptoms</h3>
          ${doctorState.doctorInsights.frequentSymptoms.length ? `<div class="symptom-badges">${doctorState.doctorInsights.frequentSymptoms.slice(0, 8).map((item) => `<span>${safe(item.symptom)} &middot; ${safe(item.patientName)}</span>`).join("")}</div>` : `<p class="empty-state">No shared symptom trends yet.</p>`}
        </article>
      </div>
    </section>

    <section class="doctor-card analytics-panel">
      <div class="section-row">
        <div>
          <h2>Analytics & AI Insights</h2>
          <p>Insight patterns from current patient, symptom, and appointment records.</p>
        </div>
      </div>
      <div class="analytics-grid">
        <article class="detail-panel analytics-card">
          <h3>Symptom Frequency</h3>
          ${doctorState.doctorInsights.frequentSymptoms.length ? `
            <div class="analytics-bars">
              ${doctorState.doctorInsights.frequentSymptoms.slice(0, 6).map((item) => `
                <div class="analytics-bar-row">
                  <span>${safe(item.symptom)}</span>
                  <div><i style="width:${Math.max(8, (Number(item.count || 0) / maxCount(doctorState.doctorInsights.frequentSymptoms)) * 100)}%"></i></div>
                  <strong>${safe(item.count)}</strong>
                </div>
              `).join("")}
            </div>
          ` : `<p class="empty-state">No shared symptom frequency data yet.</p>`}
        </article>
        <article class="detail-panel analytics-card">
          <h3>Pain Alerts</h3>
          ${doctorState.doctorInsights.highPainAlerts.length ? `
            <div class="analytics-list">
              ${doctorState.doctorInsights.highPainAlerts.slice(0, 6).map((item) => `
                <p><strong>${safe(item.patientName)}</strong><span>${safe(item.painLevel)}/10</span><small>${safe(item.date)}</small></p>
              `).join("")}
            </div>
          ` : `<p class="empty-state">No shared pain alert trend data yet.</p>`}
        </article>
        <article class="detail-panel analytics-card">
          <h3>Activity Trend</h3>
          ${activityAnalytics().length ? `
            <div class="analytics-bars">
              ${activityAnalytics().map((item) => `
                <div class="analytics-bar-row">
                  <span>${safe(item.label)}</span>
                  <div><i style="width:${Math.max(8, (Number(item.count || 0) / maxCount(activityAnalytics())) * 100)}%"></i></div>
                  <strong>${safe(item.count)}</strong>
                </div>
              `).join("")}
            </div>
          ` : `<p class="empty-state">No activity analytics available yet.</p>`}
        </article>
        <article class="detail-panel analytics-card">
          <h3>Appointment Analytics</h3>
          ${appointmentStatusAnalytics().length ? `
            <div class="analytics-bars">
              ${appointmentStatusAnalytics().map((item) => `
                <div class="analytics-bar-row">
                  <span>${safe(item.status)}</span>
                  <div><i style="width:${Math.max(8, (Number(item.count || 0) / maxCount(appointmentStatusAnalytics())) * 100)}%"></i></div>
                  <strong>${safe(item.count)}</strong>
                </div>
              `).join("")}
            </div>
          ` : `<p class="empty-state">No appointment analytics available yet.</p>`}
        </article>
        <article class="detail-panel analytics-card">
          <h3>Follow-up Analytics</h3>
          <p class="empty-state">No follow-up analytics available yet.</p>
        </article>
        <article class="detail-panel analytics-card ai-card">
          <h3>AI Insights</h3>
          ${aiInsightItems().length ? `
            <div class="analytics-list">
              ${aiInsightItems().map((item) => `
                <p><strong>${safe(item.title)}</strong><small>${safe(item.detail)}</small></p>
              `).join("")}
            </div>
          ` : `<p class="empty-state">Insufficient backend insight data for AI insights.</p>`}
        </article>
      </div>
    </section>

    <section id="today" class="doctor-card today-panel">
      <div class="section-row">
        <div>
          <h2>Today's Patients</h2>
          <p>Your scheduled appointments for today.</p>
        </div>
      </div>
      <div class="appointment-list">
        ${todayAppointments().length ? todayAppointments().map((item) => `
          <article class="appointment-row">
            <strong>${safe(item.time)}</strong>
            <span>${safe(item.patient?.name || "Patient")}</span>
            <small>${safe(item.status)}</small>
            <button class="btn secondary" data-cancel-appt="${safe(item.appointmentId)}" type="button">Cancel</button>
          </article>
        `).join("") : `<p class="empty-state">No appointments scheduled today.</p>`}
      </div>
    </section>

    <section id="messages" class="doctor-card doctor-messages-panel">
      <div class="section-row">
        <div>
          <h2>Patient Messages</h2>
          <p>Reply to conversations started by patients.</p>
        </div>
      </div>
      <div class="doctor-chat-layout">
        <div class="doctor-chat-list" id="doctorChatList"></div>
        <div class="doctor-chat-window" id="doctorChatWindow">
          <div class="empty-chat">
            <h3>Select a conversation</h3>
            <p>Patients who message you will appear here.</p>
          </div>
        </div>
      </div>
    </section>

    <section id="patients" class="doctor-card patients-panel">
      <div class="section-row">
        <div>
          <h2>Patients</h2>
          <p>Search, filter, and inspect patient details.</p>
        </div>
      </div>
      <div class="patient-tools">
        <input id="patientSearch" placeholder="Search by name or email">
        <select id="conditionFilter">
          <option value="">All conditions</option>
          ${doctorState.conditions.map((condition) => `<option value="${safe(condition)}">${safe(condition)}</option>`).join("")}
        </select>
        <select id="riskFilter">
          <option value="">All risks</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
      </div>
      <div class="patient-table-wrap">
        <table class="patient-table">
          <thead>
                <tr>
                  <th>Patient</th>
                  <th>Condition</th>
                  <th>Status</th>
                  <th>Last Activity</th>
                  <th>Risk</th>
                  <th></th>
            </tr>
          </thead>
          <tbody id="patientRows"></tbody>
        </table>
      </div>
    </section>
  `;

  ["patientSearch", "conditionFilter", "riskFilter"].forEach((id) => {
    document.getElementById(id).addEventListener("input", renderPatientRows);
  });

  document.querySelectorAll("[data-patient]").forEach((button) => {
    button.addEventListener("click", () => openPatient(button.dataset.patient));
  });
  document.querySelectorAll("[data-cancel-appt]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      await doctorApi(`/api/appointments/${button.dataset.cancelAppt}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" })
      }).then(loadPatients).catch(() => {
        button.disabled = false;
      });
    });
  });

  renderPatientRows();
  renderDoctorChatList();
  renderDoctorNotificationPanel();
}

function setupDoctorNotificationBell() {
  const bell = document.getElementById("doctorNotificationBell");
  const menu = document.getElementById("doctorNotificationMenu");
  if (!bell || !menu) return;
  bell.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = menu.hidden;
    menu.hidden = !willOpen;
    bell.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) renderDoctorNotificationPanel();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".doctor-notification-hub")) {
      menu.hidden = true;
      bell.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    menu.hidden = true;
    bell.setAttribute("aria-expanded", "false");
    if (!document.getElementById("patientModal")?.hidden) closePatientModal();
  });
}

function renderDoctorNotificationPanel() {
  const badge = document.getElementById("doctorNotificationBadge");
  const list = document.getElementById("doctorNotificationList");
  const meta = document.getElementById("doctorNotificationMeta");
  if (!badge || !list || !meta) return;
  const notifications = doctorNotifications();
  const count = notificationCount();
  badge.hidden = count === 0;
  badge.textContent = count;
  meta.textContent = count ? `${count} active` : "All clear";
  const hasNotifications = notifications.alerts.length || notifications.messages.length;
  list.innerHTML = hasNotifications ? `
    ${notifications.alerts.length ? `
      <section class="doctor-notification-group">
        <h4>Alerts</h4>
        ${notifications.alerts.map((item) => `
          <button class="doctor-notification-item alert ${String(item.level || "low").toLowerCase()}" data-patient="${safe(item.patientId)}" aria-label="Open alert for ${safe(item.patientName)}">
            <span class="${riskClass(item.level)}">${safe(item.level)}</span>
            <span>
              <strong>${safe(item.patientName)}</strong>
              <small>${safe(item.message)}</small>
              <time>${formatDate(item.timestamp)}</time>
            </span>
          </button>
        `).join("")}
      </section>
    ` : ""}
    ${notifications.messages.length ? `
      <section class="doctor-notification-group">
        <h4>Messages</h4>
        ${notifications.messages.map((item) => `
          <button class="doctor-notification-item message ${item.unread ? "unread" : ""}" data-open-chat="${safe(item.userId)}" aria-label="Open message from ${safe(item.patientName || "patient")}">
            <span class="doctor-avatar small">${safe(patientInitials({ name: item.patientName }))}</span>
            <span>
              <strong>${safe(item.patientName || "Patient")}</strong>
              <small>${safe(item.message || "No message text")}</small>
              <time>${formatDate(item.timestamp)}</time>
            </span>
          </button>
        `).join("")}
      </section>
    ` : ""}
  ` : `<p class="empty-state">No notifications right now.</p>`;

  list.querySelectorAll("[data-patient]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("doctorNotificationMenu").hidden = true;
      openPatient(button.dataset.patient);
    });
  });
  list.querySelectorAll("[data-open-chat]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("doctorNotificationMenu").hidden = true;
      openDoctorChat(button.dataset.openChat);
    });
  });
}

function todayAppointments() {
  const date = new Date().toISOString().slice(0, 10);
  return doctorState.appointments.filter((item) => item.date === date && item.status === "scheduled");
}

function renderDoctorChatList() {
  const list = document.getElementById("doctorChatList");
  if (!list) return;
  list.innerHTML = doctorState.chats.length ? doctorState.chats.map((chat) => `
    <button class="doctor-chat-contact ${doctorState.activeChat?.chatId === chat.chatId ? "active" : ""} ${chatHasUnread(chat) ? "unread" : ""}" data-open-chat="${chat.userId}" aria-label="Open conversation with ${safe(chat.patient.name)}">
      <span class="doctor-avatar small">${safe(patientInitials(chat.patient))}</span>
      <span>
        <strong>${safe(chat.patient.name)}</strong>
        <small>${safe(chat.lastMessage?.message || chat.lastMessage?.text || "No message text")}</small>
      </span>
      <time>${formatDate(chat.updatedAt)}</time>
    </button>
  `).join("") : `<p class="empty-state">No patient messages yet.</p>`;

  document.querySelectorAll("[data-open-chat]").forEach((button) => {
    button.addEventListener("click", () => openDoctorChat(button.dataset.openChat));
  });
  renderDoctorNotificationPanel();
}

async function openDoctorChat(userId) {
  const data = await doctorApi(`/api/chat/${encodeURIComponent(doctorState.account.id)}?userId=${encodeURIComponent(userId)}`);
  doctorState.activeChat = data.chat;
  renderDoctorChatList();
  renderDoctorChatWindow();
  await markDoctorChatSeen();
  startDoctorChatPolling(userId);
}

function startDoctorChatPolling(userId) {
  clearInterval(doctorState.chatPollTimer);
  doctorState.chatPollTimer = setInterval(async () => {
    if (!doctorState.activeChat) return;
    const data = await doctorApi(`/api/chat/${encodeURIComponent(doctorState.account.id)}?userId=${encodeURIComponent(userId)}`).catch(() => null);
    if (!data) return;
    doctorState.activeChat = data.chat;
    renderDoctorChatWindow();
    await markDoctorChatSeen();
  }, 4000);
}

async function markDoctorChatSeen() {
  if (!doctorState.activeChat) return;
  const seenAt = new Date().toISOString();
  const updated = await doctorApi("/api/chat/seen", {
    method: "POST",
    body: JSON.stringify({ userId: doctorState.activeChat.userId })
  }).then(() => true).catch(() => false);
  if (updated) {
    doctorState.chats = doctorState.chats.map((chat) => {
      if (chat.userId !== doctorState.activeChat.userId || !chat.lastMessage || chat.lastMessage.receiverId !== doctorState.account.id) return chat;
      return { ...chat, lastMessage: { ...chat.lastMessage, status: "seen", seenAt } };
    });
  }
  renderDoctorNotificationPanel();
}

function renderDoctorChatWindow() {
  const box = document.getElementById("doctorChatWindow");
  const chat = doctorState.activeChat;
  if (!box || !chat) return;
  box.innerHTML = `
    <header class="chat-header compact">
      <span class="doctor-avatar small">${safe(patientInitials(chat.patient))}</span>
      <div>
        <h3>${safe(chat.patient.name)}</h3>
        <p>${safe(chat.patient.email)} <span id="doctorTypingStatus"></span></p>
      </div>
      <span class="risk low">Chat</span>
    </header>
    <div class="chat-messages doctor-inline" id="doctorInlineMessages">
      ${(chat.messages || []).length ? chat.messages.map((item) => {
        const mine = item.senderId === doctorState.account.id;
        return `
          <div class="chat-bubble-row ${mine ? "mine" : "theirs"}">
            <div class="chat-bubble">
              <p>${safe(item.message || item.text)}</p>
              <time>${formatDate(item.timestamp)}${mine ? ` · ${safe(item.status || "delivered")}` : ""}</time>
            </div>
          </div>
        `;
      }).join("") : `<div class="empty-chat"><h3>No messages yet</h3></div>`}
    </div>
    <form class="chat-compose" id="doctorReplyForm">
      <input id="doctorReplyInput" placeholder="Reply to patient..." autocomplete="off" required>
      <button class="btn">Send</button>
    </form>
  `;
  const messages = document.getElementById("doctorInlineMessages");
  const typing = chat.typing || {};
  const patientTyping = Object.entries(typing).some(([id, value]) => id !== doctorState.account.id && value);
  const typingStatus = document.getElementById("doctorTypingStatus");
  if (typingStatus) typingStatus.textContent = patientTyping ? " · typing..." : "";
  messages.scrollTop = messages.scrollHeight;
  document.getElementById("doctorReplyForm").addEventListener("submit", sendDoctorReply);
  document.getElementById("doctorReplyInput").addEventListener("input", sendDoctorTyping);
}

function sendDoctorTyping() {
  if (!doctorState.activeChat) return;
  doctorApi("/api/chat/typing", {
    method: "POST",
    body: JSON.stringify({ userId: doctorState.activeChat.userId, isTyping: true })
  }).catch(() => {});
  clearTimeout(doctorState.typingTimer);
  doctorState.typingTimer = setTimeout(() => {
    doctorApi("/api/chat/typing", {
      method: "POST",
      body: JSON.stringify({ userId: doctorState.activeChat.userId, isTyping: false })
    }).catch(() => {});
  }, 1200);
}

async function sendDoctorReply(event) {
  event.preventDefault();
  const input = document.getElementById("doctorReplyInput");
  const text = input.value.trim();
  if (!text || !doctorState.activeChat) return;
  const data = await doctorApi("/api/chat/send", {
    method: "POST",
    body: JSON.stringify({
      senderId: doctorState.account.id,
      receiverId: doctorState.activeChat.userId,
      message: text,
      timestamp: new Date().toISOString()
    })
  });
  doctorState.activeChat = data.chat;
  input.value = "";
  await doctorApi("/api/chat/typing", {
    method: "POST",
    body: JSON.stringify({ userId: data.chat.userId, isTyping: false })
  }).catch(() => {});
  await loadPatients();
  doctorState.activeChat = data.chat;
  renderDoctorChatWindow();
}

function filteredPatients() {
  const query = document.getElementById("patientSearch")?.value.toLowerCase() || "";
  const condition = document.getElementById("conditionFilter")?.value || "";
  const risk = document.getElementById("riskFilter")?.value || "";
  return doctorState.patients.filter((patient) => {
    const matchesSearch = patient.name.toLowerCase().includes(query) || patient.email.toLowerCase().includes(query);
    const matchesCondition = !condition || patient.condition === condition;
    const matchesRisk = !risk || patient.riskLevel === risk;
    return matchesSearch && matchesCondition && matchesRisk;
  });
}

function renderPatientRows() {
  const rows = filteredPatients();
  document.getElementById("patientRows").innerHTML = rows.length ? rows.map((patient) => `
    <tr class="${patientActivityStatus(patient).toLowerCase()}">
      <td>
        <div class="patient-cell-main">
          <span class="doctor-avatar small">${safe(patientInitials(patient))}</span>
          <span><strong>${safe(patient.name)}</strong><small>${safe(patient.email)}</small></span>
        </div>
      </td>
      <td><span class="condition-pill">${safe(patient.condition)}</span></td>
      <td><span class="status-dot ${patientActivityStatus(patient).toLowerCase()}">${safe(patientActivityStatus(patient))}</span></td>
      <td><time>${formatDate(patient.lastActivity)}</time></td>
      <td><span class="${riskClass(patient.riskLevel)}">${safe(patient.riskLevel)}</span></td>
      <td><button class="btn secondary" data-view-patient="${patient.id}" type="button" aria-label="View details for ${safe(patient.name)}">View Details</button></td>
    </tr>
  `).join("") : `
    <tr><td colspan="6" class="empty-row"><p class="empty-state">No matching patients.</p></td></tr>
  `;

  document.querySelectorAll("[data-view-patient]").forEach((button) => {
    button.addEventListener("click", () => openPatient(button.dataset.viewPatient));
  });
}

async function openPatient(patientId) {
  const [data, sharedData] = await Promise.all([
    doctorApi(`/api/patient/${patientId}`),
    doctorApi("/api/symptoms/shared")
  ]);
  const sharedSymptomHistory = (sharedData.symptoms || []).filter((entry) => entry.userId === patientId);
  const frequentSymptoms = frequentSymptomBadges(sharedSymptomHistory);
  doctorState.selectedPatient = {
    ...data.patient,
    appointments: patientAppointments(patientId),
    symptomHistory: sharedSymptomHistory,
    symptomInsights: {
      ...(data.patient.symptomInsights || {}),
      frequentSymptoms,
      highPainEntries: sharedSymptomHistory.filter((entry) => Number(entry.painLevel) > 7),
      averagePain: sharedSymptomHistory.length
        ? Number((sharedSymptomHistory.reduce((sum, entry) => sum + Number(entry.painLevel || 0), 0) / sharedSymptomHistory.length).toFixed(1))
        : 0
    }
  };
  renderPatientModal(doctorState.selectedPatient);
}

function frequentSymptomBadges(entries) {
  const counts = entries.reduce((result, entry) => {
    (entry.symptoms || []).forEach((symptom) => {
      result[symptom] = (result[symptom] || 0) + 1;
    });
    return result;
  }, {});
  return Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([symptom, count]) => ({ symptom, count }));
}

function renderPatientModal(patient) {
  const modal = document.getElementById("patientModal");
  modal.hidden = false;
  modal.innerHTML = `
    <section class="patient-modal">
      <button class="modal-close" id="closePatient" type="button" aria-label="Close patient details">x</button>
      <div class="patient-modal-head ${patient.risk.level.toLowerCase()}">
        <div>
          <p class="doctor-kicker">Patient Details</p>
          <h2>${safe(patient.name)}</h2>
          <p>${safe(patient.email)} &middot; ${safe(patient.profileType)}</p>
          <div class="patient-modal-meta">
            <span>${safe(patient.condition)}</span>
            <span>${safe(patientActivityStatus(patient))}</span>
            <span>Last active ${formatDate(patient.lastActivity)}</span>
          </div>
        </div>
        <span class="${riskClass(patient.risk.level)}">${safe(patient.risk.level)} Risk</span>
      </div>

      <div class="patient-overview-strip">
        <article>
          <span>Risk Level</span>
          <strong>${safe(patient.risk.level)}</strong>
        </article>
        <article>
          <span>Shared Symptom Logs</span>
          <strong>${safe(patient.symptomHistory?.length || 0)}</strong>
        </article>
        <article>
          <span>Appointments</span>
          <strong>${safe(patient.appointments?.length || 0)}</strong>
        </article>
        <article>
          <span>Follow-ups</span>
          <strong>${safe(patient.followUps?.length || 0)}</strong>
        </article>
      </div>

      <div class="detail-grid">
        <article class="detail-panel">
          <h3>Symptoms</h3>
          <p>${safe(patient.symptoms)}</p>
        </article>
        <article class="detail-panel">
          <h3>Cycle Data</h3>
          <p>Last period: <strong>${safe(patient.cycle.lastPeriod)}</strong></p>
          <p>Cycle length: <strong>${safe(patient.cycle.cycleLength)} days</strong></p>
          <p>Next period: <strong>${safe(patient.cycle.insights.nextPeriod)}</strong></p>
        </article>
        <article class="detail-panel risk-panel">
          <h3>Risk Detection</h3>
          ${patient.risk.reasons.length ? patient.risk.reasons.map((reason) => `<p class="risk-reason">${safe(reason)}</p>`).join("") : `<p class="empty-state">No risk flags detected.</p>`}
          ${patient.risk.noActivity ? `<p><strong>Inactive days:</strong> ${safe(patient.risk.inactiveDays)}</p>` : ""}
          ${patient.symptomInsights?.highPainEntries?.length ? `<p><strong>High pain logs:</strong> ${patient.symptomInsights.highPainEntries.length}</p>` : ""}
          ${patient.symptomInsights?.frequentSymptoms?.length ? `<p><strong>Frequent:</strong></p><div class="symptom-badges">${patient.symptomInsights.frequentSymptoms.map((item) => `<span>${safe(item.symptom)} (${safe(item.count)})</span>`).join("")}</div>` : ""}
        </article>
      </div>

      <div class="detail-grid two patient-care-grid">
        <article class="detail-panel">
          <h3>Appointments</h3>
          <div class="patient-appointment-list">
            ${patient.appointments?.length ? patient.appointments.map((item) => `
              <article class="patient-mini-row">
                <strong>${safe(item.date)} ${safe(item.time)}</strong>
                <span>${safe(item.status)}</span>
              </article>
            `).join("") : `<p class="empty-state">No appointments available.</p>`}
          </div>
        </article>
        <article class="detail-panel">
          <h3>Follow-up Indicators</h3>
          <div class="patient-appointment-list">
            ${patient.followUps?.length ? patient.followUps.slice().reverse().map((item) => `
              <article class="patient-mini-row">
                <strong>${safe(item.followUpDate || item.date || "Follow-up")}</strong>
                <span>${safe(item.status || item.recommendationId || "Scheduled")}</span>
              </article>
            `).join("") : `<p class="empty-state">No follow-ups recorded.</p>`}
          </div>
        </article>
      </div>

      <div class="detail-grid two">
        <article class="detail-panel">
          <h3>Patient Symptoms</h3>
          <div class="symptom-history compact">
            ${patient.symptomHistory?.length ? patient.symptomHistory.map((entry) => `
              <article class="symptom-entry ${Number(entry.painLevel) > 7 ? "high-pain" : ""}">
                <div>
                  <strong>${safe(entry.date)}</strong>
                  <p>${(entry.symptoms || []).map(safe).join(", ")}</p>
                  ${entry.notes ? `<p class="muted">${safe(entry.notes)}</p>` : ""}
                </div>
                <span>${safe(entry.painLevel)}/10</span>
              </article>
            `).join("") : `<p class="empty-state">No symptom logs yet.</p>`}
          </div>
        </article>
        <article class="detail-panel">
          <h3>Pain Trend</h3>
          <p>Average pain: <strong>${safe(patient.symptomInsights?.averagePain || 0)}/10</strong></p>
          <div class="pain-bars">
            ${(patient.symptomHistory || []).slice(0, 7).reverse().map((entry) => `
              <div class="pain-bar" style="height:${Number(entry.painLevel) * 10}%"><span>${safe(entry.painLevel)}</span></div>
            `).join("") || `<p class="empty-state">No trend data yet.</p>`}
          </div>
        </article>
      </div>

      <div class="detail-grid two">
        <article class="detail-panel">
          <h3>Activity Logs</h3>
          <div class="timeline">
            ${patient.activityLogs.length ? patient.activityLogs.slice().reverse().map((log) => `
              <div><strong>${safe(log.type)}</strong><span>${safe(log.detail)}</span><small>${formatDate(log.createdAt)}</small></div>
            `).join("") : `<p class="empty-state">No activity logs yet.</p>`}
          </div>
        </article>
        <article class="detail-panel">
          <h3>Doctor Actions</h3>
          <form id="messageForm" class="stack-form">
            <label class="field"><span>Send Message</span><textarea id="doctorMessage" required></textarea></label>
            <button class="btn">Save Message</button>
          </form>
          <form id="recommendationForm" class="stack-form">
            <label class="field"><span>Add Recommendation</span><textarea id="doctorRecommendation" required></textarea></label>
            <label class="field"><span>Follow-up Date</span><input id="followUpDate" type="date"></label>
            <button class="btn teal">Save Recommendation</button>
          </form>
        </article>
      </div>

      <div class="detail-grid two">
        <article class="detail-panel">
          <h3>Messages</h3>
          ${patient.messages.length ? patient.messages.slice().reverse().map((item) => `<p class="patient-note-row">${safe(item.message)}<small>${formatDate(item.createdAt)}</small></p>`).join("") : `<p class="empty-state">No messages sent.</p>`}
        </article>
        <article class="detail-panel">
          <h3>Recommendations</h3>
          ${patient.recommendations.length ? patient.recommendations.slice().reverse().map((item) => `<p class="patient-note-row">${safe(item.recommendation)}${item.followUpDate ? `<strong>Follow-up: ${safe(item.followUpDate)}</strong>` : ""}<small>${formatDate(item.createdAt)}</small></p>`).join("") : `<p class="empty-state">No recommendations added.</p>`}
        </article>
      </div>
    </section>
  `;

  document.getElementById("closePatient").addEventListener("click", closePatientModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closePatientModal();
  }, { once: true });
  document.getElementById("messageForm").addEventListener("submit", saveMessage);
  document.getElementById("recommendationForm").addEventListener("submit", saveRecommendation);
}

function closePatientModal() {
  const modal = document.getElementById("patientModal");
  modal.hidden = true;
  modal.innerHTML = "";
}

async function saveMessage(event) {
  event.preventDefault();
  await doctorApi("/api/patient/message", {
    method: "POST",
    body: JSON.stringify({
      patientId: doctorState.selectedPatient.id,
      message: document.getElementById("doctorMessage").value
    })
  });
  await openPatient(doctorState.selectedPatient.id);
  await loadPatients();
}

async function saveRecommendation(event) {
  event.preventDefault();
  await doctorApi("/api/patient/recommendation", {
    method: "POST",
    body: JSON.stringify({
      patientId: doctorState.selectedPatient.id,
      recommendation: document.getElementById("doctorRecommendation").value,
      followUpDate: document.getElementById("followUpDate").value
    })
  });
  await openPatient(doctorState.selectedPatient.id);
  await loadPatients();
}

initDoctorDashboard();

window.addEventListener("beforeunload", () => {
  if (!token) return;
  fetch("/api/doctor/status", {
    method: "POST",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ isOnline: false })
  }).catch(() => {});
});
