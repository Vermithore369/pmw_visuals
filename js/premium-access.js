import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const PREMIUM_PLANS = ["creative", "premium", "business", "starter", "pro", "advanced", "advance", "elite"];
const ACCESS_STATUSES = ["active", "trialing"];

function normalizePlan(value) {
  const plan = String(value || "").toLowerCase();
  return PREMIUM_PLANS.includes(plan) ? plan : "";
}

export async function getPremiumPlan(user) {
  if (!user) return false;

  try {
    const token = await user.getIdTokenResult(true);
    const claims = token.claims || {};
    const claimPlan = normalizePlan(claims.plan);
    if (claimPlan) return claimPlan;
    if (
      claims.premium === true ||
      claims.role === "premium"
    ) {
      return "premium";
    }
  } catch (error) {
    console.warn("Unable to read premium token claims.", error);
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.exists() ? snap.data() : {};
    const plan = normalizePlan(data.plan);
    if (plan) return plan;
    if (data.premium === true || data.role === "premium") return "premium";
  } catch (error) {
    console.warn("Unable to read premium account status.", error);
  }

  try {
    const email = String(user.email || "").toLowerCase();
    if (!email) return "";

    const customersSnap = await getDocs(query(
      collection(db, "paddleCustomers"),
      where("email_lower", "==", email),
      limit(1)
    ));
    if (customersSnap.empty) return "";

    const customer = customersSnap.docs[0].data();
    const customerId = customer.customer_id || customersSnap.docs[0].id;
    if (!customerId) return "";

    const subscriptionsSnap = await getDocs(query(
      collection(db, "paddleSubscriptions"),
      where("customer_id", "==", customerId),
      where("status", "in", ACCESS_STATUSES),
      limit(5)
    ));

    let plan = "";
    subscriptionsSnap.forEach((subDoc) => {
      if (!plan) plan = normalizePlan(subDoc.data().plan);
    });
    return plan || (subscriptionsSnap.empty ? "" : "premium");
  } catch (error) {
    console.warn("Unable to read Paddle premium mirror.", error);
    return "";
  }
}

export async function isPremiumUser(user) {
  return Boolean(await getPremiumPlan(user));
}
