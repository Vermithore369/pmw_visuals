import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { signInWithGoogle, friendlyGoogleError } from "./google-auth.js";

const form = document.querySelector("#signupForm");
const msg = document.querySelector("#authMessage");
const submitButton = form.querySelector("button[type='submit']");
const submitLabel = submitButton.textContent;
const googleButton = document.querySelector("#googleSignIn");
const googleLabel = googleButton.innerHTML;

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

function friendlySignupError(error) {
  if (error.code === "auth/email-already-in-use") return "This email is already registered.";
  if (error.code === "auth/invalid-email") return "Please enter a valid email address.";
  if (error.code === "auth/weak-password") return "Password should be at least 6 characters.";
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
      button.setAttribute("aria-label", `${showPassword ? "Hide" : "Show"} ${input.id === "confirmPassword" ? "confirm password" : "password"}`);
    });
  });
}

bindPasswordToggles();

googleButton.addEventListener("click", async () => {
  const termsAccepted = document.querySelector("#termsAccepted");

  if (!termsAccepted.checked) {
    setMessage("Please agree to the terms and conditions.", "error");
    termsAccepted.focus();
    termsAccepted.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  setMessage("Creating account...");
  googleButton.disabled = true;
  googleButton.querySelector("span:last-child").textContent = "Creating account...";

  try {
    await signInWithGoogle();
    setMessage("Account created successfully.", "success");
    setTimeout(() => window.location.href = "account.html", 700);
  } catch (error) {
    setMessage(friendlyGoogleError(error), "error");
    googleButton.disabled = false;
    googleButton.innerHTML = googleLabel;
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.querySelector("#name").value.trim();
  const mobile = document.querySelector("#mobile").value.trim();
  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;
  const confirmPassword = document.querySelector("#confirmPassword").value;
  const termsAccepted = document.querySelector("#termsAccepted").checked;

  if (password !== confirmPassword) {
    setMessage("Passwords do not match.", "error");
    resetRecaptcha();
    return;
  }

  if (!termsAccepted) {
    setMessage("Please agree to the terms and conditions.", "error");
    resetRecaptcha();
    return;
  }

  if (!recaptchaToken()) {
    setMessage("Please complete the security check.", "error");
    return;
  }

  setMessage("Creating account...");
  submitButton.disabled = true;
  submitButton.textContent = "Creating account...";

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: name });
    await setDoc(doc(db, "users", userCredential.user.uid), {
      name,
      email,
      email_lower: email.toLowerCase(),
      role: "member",
      ...(mobile ? { mobile } : {}),
      createdAt: serverTimestamp()
    });
    setMessage("Account created successfully.", "success");
    setTimeout(() => window.location.href = "account.html", 700);
  } catch (error) {
    setMessage(friendlySignupError(error), "error");
    submitButton.disabled = false;
    submitButton.textContent = submitLabel;
    resetRecaptcha();
  }
});
