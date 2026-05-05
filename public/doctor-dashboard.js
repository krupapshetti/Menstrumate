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
    
    // Set doctor online status
    await doctorApi("/api/doctor/status", {
      method: "POST",
      body: JSON.stringify({ isOnline: true })
    });
    
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
        <p class="doctor-kicker">Doctor Dashboard</p>
        <strong>${safe(doctorState.account.name)}</strong>
        <span>${safe(doctorState.account.specialty || "Gynecology")}</span>
        <nav class="doctor-nav">
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
          <button class="btn" id="refreshPatients">Refresh</button>
        </header>
        <section id="doctorContent"></section>
      </section>
    </section>
    <div id="patientModal" class="modal-backdrop" hidden></div>
  `;
  document.getElementById("doctorLogout").addEventListener("click", logoutDoctor);
  document.getElementById("refreshPatients").addEventListener("click", loadPatients);
}

async function loadPatients() {
  const [data, chatData, appointmentData, doctorInsights] = await Promise.all([
    doctorApi("/api/patients"),
    doctorApi("/api/doctor/chats"),
    doctorApi(`/api/appointments/doctor/${doctorState.account.id}`),
    doctorApi("/api/doctor/insights")
  ]);
  doctorState.summary = data.summary;
  doctorState.patients = data.patients;
  doctorState.alerts = data.alerts;
  doctorState.conditions = data.conditions;
  doctorState.chats = chatData.chats;
  doctorState.appointments = appointmentData.appointments;
  doctorState.doctorInsights = doctorInsights;
  renderDashboardContent();
}

function renderDashboardContent() {
  const summary = doctorState.summary;
  document.getElementById("doctorContent").innerHTML = `
    <section id="overview" class="doctor-summary">
      <article class="doctor-card metric-card"><span>Total Patients</span><strong>${summary.totalPatients}</strong></article>
      <article class="doctor-card metric-card"><span>Active Patients</span><strong>${summary.activePatients}</strong></article>
      <article class="doctor-card metric-card high"><span>High Risk Patients</span><strong>${summary.highRiskPatients}</strong></article>
      <article class="doctor-card metric-card"><span>New Patients</span><strong>${summary.newPatients}</strong></article>
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
            <strong>${safe(alert.patientName)}</strong>
            <span>${safe(alert.message)}</span>
          </button>
        `).join("") : `<p class="muted">No patient alerts right now.</p>`}
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
          ${doctorState.doctorInsights.highRiskPatients.length ? doctorState.doctorInsights.highRiskPatients.slice(0, 5).map((patient) => `<p><strong>${safe(patient.name)}</strong><br><span class="muted">${safe(patient.riskReasons.join(", "))}</span></p>`).join("") : `<p class="muted">No high-risk patients.</p>`}
        </article>
        <article class="detail-panel">
          <h3>High Pain Alerts</h3>
          ${doctorState.doctorInsights.highPainAlerts.length ? doctorState.doctorInsights.highPainAlerts.slice(0, 5).map((alert) => `<p><strong>${safe(alert.patientName)}</strong> ${safe(alert.painLevel)}/10<br><span class="muted">${safe(alert.date)}</span></p>`).join("") : `<p class="muted">No shared high pain alerts.</p>`}
        </article>
        <article class="detail-panel">
          <h3>Frequent Symptoms</h3>
          ${doctorState.doctorInsights.frequentSymptoms.length ? `<div class="symptom-badges">${doctorState.doctorInsights.frequentSymptoms.slice(0, 8).map((item) => `<span>${safe(item.symptom)} · ${safe(item.patientName)}</span>`).join("")}</div>` : `<p class="muted">No shared symptom trends yet.</p>`}
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
            <button class="btn secondary" data-cancel-appt="${safe(item.appointmentId)}">Cancel</button>
          </article>
        `).join("") : `<p class="muted">No appointments scheduled today.</p>`}
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

    <section id="patients" class="doctor-card">
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
              <th>Name</th>
              <th>Email</th>
              <th>Condition</th>
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
      await doctorApi(`/api/appointments/${button.dataset.cancelAppt}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" })
      });
      await loadPatients();
    });
  });

  renderPatientRows();
  renderDoctorChatList();
}

function todayAppointments() {
  const date = new Date().toISOString().slice(0, 10);
  return doctorState.appointments.filter((item) => item.date === date && item.status === "scheduled");
}

function renderDoctorChatList() {
  const list = document.getElementById("doctorChatList");
  if (!list) return;
  list.innerHTML = doctorState.chats.length ? doctorState.chats.map((chat) => `
    <button class="doctor-chat-contact ${doctorState.activeChat?.chatId === chat.chatId ? "active" : ""}" data-open-chat="${chat.userId}">
      <span class="doctor-avatar small">${safe((chat.patient.name || "P").slice(0, 1).toUpperCase())}</span>
      <span>
        <strong>${safe(chat.patient.name)}</strong>
        <small>${safe(chat.lastMessage?.message || chat.lastMessage?.text || "No message text")}</small>
      </span>
      <time>${formatDate(chat.updatedAt)}</time>
    </button>
  `).join("") : `<p class="muted">No patient messages yet.</p>`;

  document.querySelectorAll("[data-open-chat]").forEach((button) => {
    button.addEventListener("click", () => openDoctorChat(button.dataset.openChat));
  });
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
  await doctorApi("/api/chat/seen", {
    method: "POST",
    body: JSON.stringify({ 
      doctorId: doctorState.account.id,
      userId: doctorState.activeChat.userId 
    })
  }).catch(() => {});
}

function renderDoctorChatWindow() {
  const box = document.getElementById("doctorChatWindow");
  const chat = doctorState.activeChat;
  if (!box || !chat) return;
  box.innerHTML = `
    <header class="chat-header compact">
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
    <tr>
      <td><strong>${safe(patient.name)}</strong>电子
      <td>${safe(patient.email)}</td>
      <td>${safe(patient.condition)}</td>
      <td>${formatDate(patient.lastActivity)}</td>
      <td><span class="${riskClass(patient.riskLevel)}">${safe(patient.riskLevel)}</span></td>
      <td><button class="btn secondary" data-view-patient="${patient.id}">View Details</button></td>
    </tr>
  `).join("") : `
    <tr><td colspan="6" class="empty-row">No matching patients.</td></tr>
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
      <button class="modal-close" id="closePatient">x</button>
      <div class="patient-modal-head ${patient.risk.level.toLowerCase()}">
        <div>
          <p class="doctor-kicker">Patient Details</p>
          <h2>${safe(patient.name)}</h2>
          <p>${safe(patient.email)} &middot; ${safe(patient.profileType)}</p>
        </div>
        <span class="${riskClass(patient.risk.level)}">${safe(patient.risk.level)} Risk</span>
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
          ${patient.risk.reasons.length ? patient.risk.reasons.map((reason) => `<p>${safe(reason)}</p>`).join("") : `<p>No risk flags detected.</p>`}
          ${patient.symptomInsights?.highPainEntries?.length ? `<p><strong>High pain logs:</strong> ${patient.symptomInsights.highPainEntries.length}</p>` : ""}
          ${patient.symptomInsights?.frequentSymptoms?.length ? `<p><strong>Frequent:</strong></p><div class="symptom-badges">${patient.symptomInsights.frequentSymptoms.map((item) => `<span>${safe(item.symptom)} (${safe(item.count)})</span>`).join("")}</div>` : ""}
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
            `).join("") : `<p class="muted">No symptom logs yet.</p>`}
          </div>
        </article>
        <article class="detail-panel">
          <h3>Pain Trend</h3>
          <p>Average pain: <strong>${safe(patient.symptomInsights?.averagePain || 0)}/10</strong></p>
          <div class="pain-bars">
            ${(patient.symptomHistory || []).slice(0, 7).reverse().map((entry) => `
              <div class="pain-bar" style="height:${Number(entry.painLevel) * 10}%"><span>${safe(entry.painLevel)}</span></div>
            `).join("") || `<p class="muted">No trend data yet.</p>`}
          </div>
        </article>
      </div>

      <div class="detail-grid two">
        <article class="detail-panel">
          <h3>Activity Logs</h3>
          <div class="timeline">
            ${patient.activityLogs.length ? patient.activityLogs.slice().reverse().map((log) => `
              <div><strong>${safe(log.type)}</strong><br><span>${safe(log.detail)}</span><small>${formatDate(log.createdAt)}</small></div>
            `).join("") : `<p class="muted">No activity logs yet.</p>`}
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
          ${patient.messages.length ? patient.messages.slice().reverse().map((item) => `<p>${safe(item.message)}<br><small>${formatDate(item.createdAt)}</small></p>`).join("") : `<p class="muted">No messages sent.</p>`}
        </article>
        <article class="detail-panel">
          <h3>Recommendations</h3>
          ${patient.recommendations.length ? patient.recommendations.slice().reverse().map((item) => `<p>${safe(item.recommendation)}${item.followUpDate ? `<br><strong>Follow-up:</strong> ${safe(item.followUpDate)}` : ""}<br><small>${formatDate(item.createdAt)}</small></p>`).join("") : `<p class="muted">No recommendations added.</p>`}
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