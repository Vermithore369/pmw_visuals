import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const form = document.querySelector("#signupForm");
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

  const name = document.querySelector("#name").value.trim();
  const mobile = document.querySelector("#mobile").value.trim();
  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;
  const confirmPassword = document.querySelector("#confirmPassword").value;
  const termsAccepted = document.querySelector("#termsAccepted").checked;

  if (password !== confirmPassword) {
    msg.textContent = "Please make sure both password fields match.";
    msg.className = "pmw-message error";
    resetRecaptcha();
    return;
  }

  if (!termsAccepted) {
    msg.textContent = "Please agree to the terms and conditions before creating your account.";
    msg.className = "pmw-message error";
    resetRecaptcha();
    return;
  }

  if (!recaptchaToken()) {
    msg.textContent = "Please complete the reCAPTCHA before creating your account.";
    msg.className = "pmw-message error";
    return;
  }

  msg.textContent = "Creating your account...";
  msg.className = "pmw-message";

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
    msg.textContent = "Account created. Redirecting...";
    msg.className = "pmw-message success";
    setTimeout(() => window.location.href = "account.html", 700);
  } catch (error) {
    msg.textContent = error.message.replace("Firebase: ", "");
    msg.className = "pmw-message error";
    resetRecaptcha();
  }
});
