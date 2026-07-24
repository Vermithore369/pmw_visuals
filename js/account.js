import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { isPremiumUser } from "./premium-access.js";

const nameEl = document.querySelector("#accountName");
const emailEl = document.querySelector("#accountEmail");
const planEl = document.querySelector("#accountPlan");
const msg = document.querySelector("#accountMessage");
const logoutBtn = document.querySelector("#logoutBtn");
const premiumAction = document.querySelector("#premiumAction");
const accountTierStat = document.querySelector("#accountTierStat");
const billingPortalBtn = document.querySelector("#billingPortalBtn");
const accountPlanSummary = document.querySelector("#accountPlanSummary");
const accountEmailSummary = document.querySelector("#accountEmailSummary");
const memberSince = document.querySelector("#memberSince");
const FUNCTIONS_BASE_URL =
  window.PMW_FUNCTIONS_BASE_URL || "https://us-central1-pmw-visuals-b14e8.cloudfunctions.net";

const setText = (element, value) => {
  if (element) {
    element.textContent = value;
  }
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const displayName = user.displayName || "PMW Member";
  const email = user.email || "No email available";
  const createdAt = user.metadata?.creationTime ? new Date(user.metadata.creationTime) : null;

  setText(nameEl, displayName);
  setText(emailEl, email);
  setText(accountEmailSummary, email);
  setText(
    memberSince,
    createdAt
      ? createdAt.toLocaleDateString(undefined, { month: "short", year: "numeric" })
      : "Today"
  );

  const isPremium = await isPremiumUser(user);
  const planName = isPremium ? "Premium Member" : "Free Member";
  const accountStatus = isPremium ? "Premium access active." : "Free account active.";

  setText(planEl, planName);
  setText(accountPlanSummary, planName);
  setText(msg, accountStatus);
  setText(accountTierStat, isPremium ? "Premium" : "Free");
  if (isPremium) {
    premiumAction.textContent = "Open Premium";
    premiumAction.href = "premium-wallpapers.html";
  } else {
    premiumAction.textContent = "Go Premium";
    premiumAction.href = "premium.html";
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

billingPortalBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  billingPortalBtn.disabled = true;
  billingPortalBtn.textContent = "Opening...";
  msg.textContent = "Opening secure Paddle billing portal...";

  try {
    const token = await user.getIdToken();
    const response = await fetch(`${FUNCTIONS_BASE_URL}/createPaddlePortalSession`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.url) {
      throw new Error(payload.error || "Unable to open billing portal.");
    }

    window.location.href = payload.url;
  } catch (error) {
    console.error(error);
    msg.textContent = error.message || "Unable to open billing portal.";
    billingPortalBtn.disabled = false;
    billingPortalBtn.textContent = "Manage Billing";
  }
});
