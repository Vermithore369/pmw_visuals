import { auth, db } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

function displayNameFor(user) {
  if (user.displayName) return user.displayName;
  if (user.email) return user.email.split("@")[0];
  return "PMW Member";
}

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  const userRef = doc(db, "users", user.uid);
  const profile = await getDoc(userRef);

  if (!profile.exists()) {
    const email = user.email || "";

    await setDoc(userRef, {
      name: displayNameFor(user),
      email,
      email_lower: email.toLowerCase(),
      role: "member",
      createdAt: serverTimestamp()
    });
  }

  return result;
}

export function friendlyGoogleError(error) {
  if (error.code === "auth/popup-closed-by-user") return "Google sign-in was cancelled.";
  if (error.code === "auth/popup-blocked") return "Please allow pop-ups and try again.";
  if (error.code === "auth/account-exists-with-different-credential") {
    return "This email uses another sign-in method. Sign in with your password.";
  }
  if (error.code === "auth/unauthorized-domain") {
    return "Google sign-in is not available on this website address.";
  }
  return "An error occurred. Please try again.";
}
