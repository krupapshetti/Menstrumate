const chatApp = document.getElementById("chatApp");
const chatToken = localStorage.getItem("menstrumateToken");
const params = new URLSearchParams(window.location.search);
const doctorId = params.get("doctorId");

const chatState = {
  account: null,
  chat: null,
  pollTimer: null,
  typingTimer: null
};

function chatApi(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${chatToken}`,
      ...(options.headers || {})
    }
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status}) while loading ${path}`);
    return data;
  });
}

function chatSafe(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function chatTime(value) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function failChat(message) {
  chatApp.innerHTML = `
    <section class="auth-wrap page">
      <div class="auth-card">
        <h1>Chat unavailable</h1>
        <p class="muted">${chatSafe(message)}</p>
        <button class="btn" id="backToApp">Back to Menstrumate</button>
      </div>
    </section>
  `;
  document.getElementById("backToApp").addEventListener("click", () => {
    window.location.href = "/";
  });
}

async function initChat() {
  if (!chatToken) return failChat("Please login as a user to chat with a doctor.");
  if (!doctorId) return failChat("Doctor was not selected.");

  try {
    const me = await chatApi("/api/auth/me");  // ← CHANGED HERE
    if (me.account.role !== "user") {
      return failChat("Doctor replies are available inside the Doctor Dashboard.");
    }
    chatState.account = me.account;
    const data = await chatApi(`/api/chat/${encodeURIComponent(doctorId)}`);
    if (!data.chat?.doctor) {
      return failChat("Doctor record could not be loaded. Please return to Doctors and choose again.");
    }
    chatState.chat = data.chat;
    renderChat();
    await markSeen();
    startPolling();
  } catch (err) {
    failChat(err.message);
  }
}

function renderChat() {
  const doctor = chatState.chat.doctor;
  chatApp.innerHTML = `
    <section class="chat-page">
      <aside class="chat-profile">
        <button class="btn ghost" id="backDoctors">Back</button>
        <div class="chat-avatar">${chatSafe(doctor.initials || "DR")}</div>
        <h1>${chatSafe(doctor.name)}</h1>
        <p>${chatSafe(doctor.specialty || "Gynecology")}</p>
        <p class="muted">${chatSafe(doctor.clinic || "Clinic not added")}</p>
        <div class="chat-profile-note">
          <strong>Private chat</strong>
          <span>Messages are saved securely in your Menstrumate backend storage.</span>
        </div>
      </aside>
      <section class="chat-panel">
        <header class="chat-header">
          <div>
            <h2>${chatSafe(doctor.name)}</h2>
            <p>${chatSafe(doctor.specialty || "Doctor")} <span id="typingStatus"></span></p>
          </div>
          <button class="btn secondary" id="refreshChat">Refresh</button>
        </header>
        <div class="chat-messages" id="chatMessages"></div>
        <form class="chat-compose" id="chatForm">
          <input id="chatInput" placeholder="Type your message..." autocomplete="off" required>
          <button class="btn">Send</button>
        </form>
      </section>
    </section>
  `;
  document.getElementById("backDoctors").addEventListener("click", () => {
    window.location.href = "/#doctors";
  });
  document.getElementById("refreshChat").addEventListener("click", refreshChat);
  document.getElementById("chatForm").addEventListener("submit", sendChat);
  document.getElementById("chatInput").addEventListener("input", sendTyping);
  renderMessages();
}

function renderMessages() {
  const box = document.getElementById("chatMessages");
  const messages = chatState.chat.messages || [];
  box.innerHTML = messages.length ? messages.map((item) => {
    const mine = item.senderId === chatState.account.id;
    const text = item.message || item.text || "";
    return `
      <div class="chat-bubble-row ${mine ? "mine" : "theirs"}">
        <div class="chat-bubble">
          <p>${chatSafe(text)}</p>
          <time>${chatTime(item.timestamp)}${mine ? ` · ${chatSafe(item.status || "delivered")}` : ""}</time>
        </div>
      </div>
    `;
  }).join("") : `
    <div class="empty-chat">
      <h3>No messages yet</h3>
      <p>Start the conversation with your doctor.</p>
    </div>
  `;
  const typing = chatState.chat.typing || {};
  const otherTyping = Object.entries(typing).some(([id, value]) => id !== chatState.account.id && value);
  const typingStatus = document.getElementById("typingStatus");
  if (typingStatus) typingStatus.textContent = otherTyping ? " · typing..." : "";
  box.scrollTop = box.scrollHeight;
}

async function refreshChat() {
  try {
    const data = await chatApi(`/api/chat/${encodeURIComponent(doctorId)}`);
    chatState.chat = data.chat;
    renderMessages();
    await markSeen();
  } catch (err) {
    failChat(err.message);
  }
}

function startPolling() {
  clearInterval(chatState.pollTimer);
  chatState.pollTimer = setInterval(refreshChat, 4000);
}

async function markSeen() {
  if (!chatState.chat) return;
  await chatApi("/api/chat/seen", {
    method: "POST",
    body: JSON.stringify({ doctorId })
  }).catch(() => {});
}

function sendTyping() {
  chatApi("/api/chat/typing", {
    method: "POST",
    body: JSON.stringify({ doctorId, isTyping: true })
  }).catch(() => {});
  clearTimeout(chatState.typingTimer);
  chatState.typingTimer = setTimeout(() => {
    chatApi("/api/chat/typing", {
      method: "POST",
      body: JSON.stringify({ doctorId, isTyping: false })
    }).catch(() => {});
  }, 1200);
}

async function sendChat(event) {
  event.preventDefault();
  const input = document.getElementById("chatInput");
  const message = input.value.trim();
  if (!message) return;
  try {
    const data = await chatApi("/api/chat/send", {
      method: "POST",
      body: JSON.stringify({
        senderId: chatState.account.id,
        receiverId: doctorId,
        message,
        timestamp: new Date().toISOString()
      })
    });
    chatState.chat = data.chat;
    input.value = "";
    await chatApi("/api/chat/typing", {
      method: "POST",
      body: JSON.stringify({ doctorId, isTyping: false })
    }).catch(() => {});
    renderMessages();
  } catch (err) {
    failChat(err.message);
  }
}

initChat();
