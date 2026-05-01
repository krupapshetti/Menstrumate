const doctorSignupForm = document.getElementById("doctorSignupForm");
const doctorSignupMessage = document.getElementById("doctorSignupMessage");

function showDoctorSignupMessage(message, isError = false) {
  doctorSignupMessage.className = `notice${isError ? " error" : ""}`;
  doctorSignupMessage.textContent = message;
}

async function doctorSignupApi(path, options = {}) {
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

document.getElementById("doctorOtpBtn").addEventListener("click", async () => {
  const email = document.getElementById("doctorEmail").value.trim();
  if (!email) {
    showDoctorSignupMessage("Enter your email before generating OTP.", true);
    return;
  }

  try {
    const data = await doctorSignupApi("/api/auth/request-otp", {
      method: "POST",
      body: JSON.stringify({ email, role: "doctor" })
    });
    showDoctorSignupMessage(`Your OTP is ${data.otp}. Enter it to complete doctor signup.`);
  } catch (err) {
    showDoctorSignupMessage(err.message, true);
  }
});

doctorSignupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = document.getElementById("doctorPassword").value;
  const confirmPassword = document.getElementById("doctorConfirmPassword").value;

  if (password !== confirmPassword) {
    showDoctorSignupMessage("Passwords do not match.", true);
    return;
  }

  try {
    const data = await doctorSignupApi("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        role: "doctor",
        name: document.getElementById("doctorName").value.trim(),
        email: document.getElementById("doctorEmail").value.trim(),
        otp: document.getElementById("doctorOtp").value.trim(),
        password,
        confirmPassword,
        specialization: document.getElementById("doctorSpecialization").value,
        specialty: document.getElementById("doctorSpecialization").value,
        experience: document.getElementById("doctorExperience").value.trim(),
        clinic: document.getElementById("doctorClinic").value.trim()
      })
    });

    showDoctorSignupMessage("Doctor account created. Please login to continue.");
    setTimeout(() => {
      window.location.href = "/?auth=login&role=doctor";
    }, 900);
  } catch (err) {
    showDoctorSignupMessage(err.message, true);
  }
});
