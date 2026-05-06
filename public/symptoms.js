const symptomsApp = document.getElementById("symptomsApp");
const symptomsToken = localStorage.getItem("menstrumateToken");
let currentUser = null;
let symptomOptions = [];
const onboardingMode = new URLSearchParams(window.location.search).get("onboarding") === "1";

function symptomsApi(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("menstrumateToken")}`, // ✅ dynamic
      ...(options.headers || {})
    }
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function initSymptoms() {
  if (!localStorage.getItem("menstrumateToken")){
    window.location.href = "/";
    return;
  }
  try {
    const me = await symptomsApi("/api/auth/me");
    if (me.account.role !== "user") {
      window.location.href = "/";
      return;
    }
    currentUser = me.account;
    const options = await symptomsApi("/api/symptom-options");
    symptomOptions = options.symptoms || [];
    renderSymptomsPage();
    showOnboardingMessage();
    await loadHistory();
  } catch {
    window.location.href = "/";
  }
}

function showOnboardingMessage() {
  if (!onboardingMode && !currentUser?.isFirstLogin) return;
  document.getElementById("symptomsForm")?.scrollIntoView({ behavior: "smooth", block: "center" });
  document.querySelector(".symptom-chip input")?.focus();
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" id="symptomOnboardingModal">
      <section class="appointment-modal">
        <button class="modal-close" id="closeSymptomOnboarding">x</button>
        <p class="landing-kicker">Welcome</p>
        <h2>Welcome to Menstrumate 💖</h2>
        <p class="muted">Let’s start by understanding how you feel today.</p>
        <button class="btn" id="startSymptomOnboarding">Start check-in</button>
      </section>
    </div>
  `);
  const close = () => {
    document.getElementById("symptomOnboardingModal")?.remove();
    document.querySelector(".symptom-chip input")?.focus();
  };
  document.getElementById("closeSymptomOnboarding").addEventListener("click", close);
  document.getElementById("startSymptomOnboarding").addEventListener("click", close);
}

function renderSymptomsPage() {
  symptomsApp.innerHTML = `
    <section class="symptoms-page">
      <div class="symptoms-shell">
        <header class="symptoms-header">
          <div>
            <p class="landing-kicker">Daily check-in</p>
            <h1>How are you feeling today?</h1>
            <p class="muted">Log symptoms once a day so your doctor can see trends clearly.</p>
          </div>
          <a class="btn secondary" href="/#dashboard">Back to app</a>
        </header>

        <section class="symptoms-layout">
          <form id="symptomsForm" class="symptom-card">
            <label class="field">
              <span>Date</span>
              <input id="symptomDate" type="date" value="${today()}" required>
            </label>

            <div class="symptom-options">
              ${symptomOptions.map((item) => `
                <label class="symptom-chip">
                  <input type="checkbox" value="${item}">
                  <span>${item}</span>
                </label>
              `).join("")}
            </div>

            <label class="field">
              <span>Other</span>
              <input id="otherSymptom" placeholder="Add another symptom">
            </label>

            <label class="field">
              <span>Pain level: <strong id="painValue">5</strong>/10</span>
              <input id="painLevel" type="range" min="1" max="10" value="5">
            </label>

            <label class="field">
              <span>Notes</span>
              <textarea id="symptomNotes" placeholder="Optional note for yourself or your doctor"></textarea>
            </label>

            <label class="share-toggle">
              <input id="shareWithDoctor" type="checkbox">
              <span>Share with doctor</span>
            </label>

            <button class="btn" type="submit">Save Today's Symptoms</button>
            <div id="symptomMessage"></div>
          </form>

          <aside class="symptom-card history-card">
            <h2>Previous entries</h2>
            <div id="symptomHistory" class="symptom-history"></div>
          </aside>
        </section>
      </div>
    </section>
  `;
  document.getElementById("painLevel").addEventListener("input", (event) => {
    document.getElementById("painValue").textContent = event.target.value;
  });
  document.getElementById("symptomsForm").addEventListener("submit", saveSymptoms);
}

async function saveSymptoms(event) {
  event.preventDefault();
  const checked = [...document.querySelectorAll(".symptom-chip input:checked")].map((input) => input.value);
  const other = document.getElementById("otherSymptom").value.trim();
  if (other) checked.push(other);
  const message = document.getElementById("symptomMessage");
  
  // Show loading state
  const submitBtn = document.querySelector('#symptomsForm button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Saving...";
  submitBtn.disabled = true;
  
  try {
    const response = await symptomsApi("/api/symptoms", {
      method: "POST",
      body: JSON.stringify({
        date: document.getElementById("symptomDate").value,
        symptoms: checked,
        painLevel: document.getElementById("painLevel").value,
        notes: document.getElementById("symptomNotes").value,
        sharedWithDoctor: document.getElementById("shareWithDoctor").checked
      })
    });
    
    console.log("✅ Symptoms saved successfully:", response);
    
    message.className = "notice";
    message.textContent = "✅ Symptoms saved successfully!";
    
    // 🔥 IMPORTANT: Set flag to notify dashboard to refresh
    localStorage.setItem('menstrumateSymptomsUpdated', Date.now().toString());
    localStorage.setItem('menstrumateSymptomsData', JSON.stringify({
      date: document.getElementById("symptomDate").value,
      symptoms: checked,
      painLevel: document.getElementById("painLevel").value,
      timestamp: Date.now()
    }));
    
    await loadHistory();
    
    if (onboardingMode || currentUser?.isFirstLogin) {
      try {
        await symptomsApi("/api/auth/complete-onboarding", {
          method: "PATCH"
        });
      } catch (err) {
        console.log("Onboarding completion note:", err.message);
      }
      
      // Show success message before redirect
      setTimeout(() => {
        window.location.href = "/#dashboard?refresh=true&symptoms=updated";
      }, 1500);
    } else {
      // Show success and redirect after 2 seconds
      setTimeout(() => {
        window.location.href = "/#dashboard?refresh=true";
      }, 2000);
    }
    
  } catch (err) {
    console.error("❌ Error saving symptoms:", err);
    message.className = "notice error";
    message.textContent = "❌ " + (err.message || "Failed to save symptoms");
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

async function loadHistory() {
  const data = await symptomsApi(`/api/symptoms/${currentUser.id}`);
  const box = document.getElementById("symptomHistory");
  box.innerHTML = data.symptoms.length ? data.symptoms.map((entry) => `
    <article class="symptom-entry ${Number(entry.painLevel) >= 7 ? "high-pain" : ""}">
      <div>
        <strong>${safe(entry.date)}</strong>
        <p>${entry.symptoms.map(safe).join(", ")}</p>
        ${entry.notes ? `<p class="muted">${safe(entry.notes)}</p>` : ""}
        <small class="muted">${entry.sharedWithDoctor ? "Shared with doctor" : "Private"}</small>
      </div>
      <span>${safe(entry.painLevel)}/10</span>
    </article>
  `).join("") : `<p class="muted">No symptom entries yet.</p>`;
}

initSymptoms();