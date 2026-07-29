import { auth } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const form = document.querySelector("#loginForm");
const msg = document.querySelector("#authMessage");

function recaptchaToken() {
  if (!window.grecaptcha || typeof window.grecaptcha.getResponse !== "function") return "";
  return window.grecaptcha.getResponse();
}

function resetRecaptcha() {
  try {
    if (window.grecaptcha && typeof window.grecaptcha.reset === "function") window.grecaptcha.reset();
  } catch (_) {}
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!recaptchaToken()) {
    msg.textContent = "Please complete the reCAPTCHA before signing in.";
    msg.className = "pmw-message error";
    return;
  }

  msg.textContent = "Signing in...";
  msg.className = "pmw-message";

  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    msg.textContent = "Signed in successfully.";
    msg.className = "pmw-message success";
    setTimeout(() => window.location.href = "account.html", 600);
  } catch (error) {
    msg.textContent = "An error occurred. Please try again.";
    msg.className = "pmw-message error";
    resetRecaptcha();
  }
});
