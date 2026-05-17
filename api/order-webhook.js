import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";

// Initialize Firebase Admin (Only once)
if (!getApps().length) {
  initializeApp({
    credential: Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, 'base64').toString() // safe setup
  });
}
const db = getFirestore();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // 🔐 SECURITY check: Make sure this request actually came from your Shopify store
  const hmac = req.headers["x-shopify-hmac-sha256"];
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  const hash = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(req.body), "utf8")
    .digest("base64");

  if (hash !== hmac) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const orderData = req.body;
    const customerId = orderData.customer?.id;

    // If there's no customer account tied to the checkout order, skip it
    if (!customerId) return res.status(200).json({ success: true, message: "Guest checkout" });

    const userRef = db.collection("spinUsers").doc(String(customerId));
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const currentBalance = userDoc.data().spinBalance || 0;
      // ➕ Add 1 spin credit to their existing account balance
      await userRef.update({ spinBalance: currentBalance + 1 });
    } else {
      // Fallback fallback if account data didn't exist prior
      await userRef.set({ spinBalance: 1 });
    }

    return res.status(200).json({ success: true, message: "Spin credit granted!" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
