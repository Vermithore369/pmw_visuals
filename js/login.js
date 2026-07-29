import { auth } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const form = document.querySelector("#loginForm");
const msg = document.querySelector("#authMessage");
const submitButton = form.querySelector("button[type='submit']");
const submitLabel = submitButton.textContent;

function recaptchaToken() {
  if (!window.grecaptcha || typeof window.grecaptcha.getResponse !== "function") return "";
  return window.grecaptcha.getResponse();
}

function resetRecaptcha() {
  try {
    if (window.grecaptcha && typeof window.grecaptcha.reset === "function") window.grecaptcha.reset();
  } catch (_) {}
}

function setMessage(text, type = "") {
  msg.textContent = text;
  msg.className = type ? `pmw-message ${type}` : "pmw-message";
}

function friendlyLoginError(error) {
  if (error.code === "auth/invalid-email") return "Please enter a valid email address.";
  if (["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password"].includes(error.code)) return "Incorrect email or password.";
  return "An error occurred. Please try again.";
}

function bindPasswordToggles() {
  document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    const input = document.querySelector(`#${button.dataset.togglePassword}`);
    if (!input) return;

    button.addEventListener("click", () => {
      const showPassword = input.type === "password";
      input.type = showPassword ? "text" : "password";
      button.textContent = showPassword ? "Hide" : "Show";
      button.setAttribute("aria-pressed", String(showPassword));
      button.setAttribute("aria-label", `${showPassword ? "Hide" : "Show"} password`);
    });
  });
}

bindPasswordToggles();

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!recaptchaToken()) {
    setMessage("Please complete the security check.", "error");
    return;
  }

  setMessage("Signing in...");
  submitButton.disabled = true;
  submitButton.textContent = "Signing in...";

  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    setMessage("Signed in successfully.", "success");
    setTimeout(() => window.location.href = "account.html", 600);
  } catch (error) {
    setMessage(friendlyLoginError(error), "error");
    submitButton.disabled = false;
    submitButton.textContent = submitLabel;
    resetRecaptcha();
  }
});
