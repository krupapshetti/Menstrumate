const signupParams = new URLSearchParams(window.location.search);
const signupRole = String(signupParams.get("role") || "user").toLowerCase() === "doctor" ? "doctor" : "user";
const signupMessage = document.getElementById("signupMessage");
const signupForm = document.getElementById("signupForm");

function showSignupMessage(message, isError = false) {
  signupMessage.className = `notice${isError ? " error" : ""}`;
  signupMessage.textContent = message;
}

async function signupApi(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function configureSignupPage() {
  const isDoctor = signupRole === "doctor";
  const specialization = document.getElementById("specialization");
  const clinic = document.getElementById("clinic");

  document.documentElement.dataset.signupRole = signupRole;
  signupForm.classList.toggle("doctor-signup-form", isDoctor);
  signupForm.classList.toggle("user-signup-form", !isDoctor);
  document.getElementById("signupKicker").textContent = isDoctor ? "Doctor registration" : "User registration";
  document.getElementById("signupTitle").textContent = isDoctor ? "Create Doctor Account" : "Create User Account";
  document.getElementById("signupSubtitle").textContent = isDoctor
    ? "Register to manage patients, chats, shared symptoms, and appointments."
    : "Create your account, then start with today’s symptom check-in.";

  document.querySelectorAll(".doctor-only").forEach((node) => {
    node.hidden = !isDoctor;
    node.setAttribute("aria-hidden", String(!isDoctor));
  });
  specialization.required = isDoctor;
  specialization.disabled = !isDoctor;
  clinic.required = isDoctor;
  clinic.disabled = !isDoctor;

  if (!isDoctor) {
    specialization.value = "";
    clinic.value = "";
  }
}

document.getElementById("otpBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  if (!email) {
    showSignupMessage("Enter your email before generating OTP.", true);
    return;
  }

  try {
    const data = await signupApi("/api/auth/request-otp", {
      method: "POST",
      body: JSON.stringify({ email, role: signupRole })
    });
    showSignupMessage(`Your OTP is ${data.otp}. Enter it to complete signup.`);
  } catch (err) {
    showSignupMessage(err.message, true);
  }
});

document.getElementById("signupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (password !== confirmPassword) {
    showSignupMessage("Passwords do not match.", true);
    return;
  }

  try {
    const data = await signupApi("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        role: signupRole,
        name: document.getElementById("name").value.trim(),
        email: document.getElementById("email").value.trim(),
        password,
        confirmPassword,
        otp: document.getElementById("otp").value.trim(),
        specialization: signupRole === "doctor" ? document.getElementById("specialization").value : "",
        specialty: signupRole === "doctor" ? document.getElementById("specialization").value : "",
        clinic: signupRole === "doctor" ? document.getElementById("clinic").value.trim() : ""
      })
    });

    if (signupRole === "doctor") {
      showSignupMessage("Doctor account created. Please login to continue.");
      setTimeout(() => {
        window.location.href = "/?auth=login&role=doctor";
      }, 900);
      return;
    }

    localStorage.setItem("menstrumateToken", data.token);
    localStorage.setItem("menstrumateRole", signupRole);
    window.location.href = "/symptoms.html?onboarding=1";
  } catch (err) {
    showSignupMessage(err.message, true);
  }
});

configureSignupPage();
