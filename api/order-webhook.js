import { initializeApp, getApps, credential } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";

if (!getApps().length) {
  initializeApp({
    // Make sure your Firebase Service Account JSON variable is added in Vercel env
    credential: credential.cert(JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, 'base64').toString()))
  });
}
const db = getFirestore();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const hmac = req.headers["x-shopify-hmac-sha256"];
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  
  // Compute the hash validation
  const rawBody = await Buffer.from(req.body);
  const hash = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");

  if (hash !== hmac) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    // Parse JSON data safely from the verified stream buffer
    const orderData = JSON.parse(rawBody.toString('utf8'));
    const rawCustomerId = orderData.customer?.id;

    if (!rawCustomerId) {
      return res.status(200).json({ success: true, message: "Guest Checkout - Skipped" });
    }

    // 🔥 CRITICAL FIX: Extract ONLY the numbers so it matches your frontend variable exactly!
    const cleanCustomerId = String(rawCustomerId).replace(/\D/g, "");

    const userRef = db.collection("spinUsers").doc(cleanCustomerId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const currentBalance = userDoc.data().spinBalance || 0;
      await userRef.update({ spinBalance: currentBalance + 1 });
    } else {
      await userRef.set({ spinBalance: 1 });
    }

    return res.status(200).json({ success: true, message: `Spin credited successfully to document: ${cleanCustomerId}` });
  } catch (err) {
    console.error("Webhook Execution Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Turn off body parsing so we can read the raw cryptographic stream cleanly
export const config = {
  api: {
    bodyParser: false,
  },
};
