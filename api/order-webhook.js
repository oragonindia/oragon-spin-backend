import admin from "firebase-admin";
import crypto from "crypto";

// 🔐 Initialize Firebase Admin safely using backend credentials
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, 'base64').toString())
    )
  });
}
const db = admin.firestore();

// Helper function to safely read the raw request stream from Shopify
async function getRawBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  // Only allow secure POST requests from Shopify
  if (req.method !== "POST") return res.status(405).end();

  try {
    const hmac = req.headers["x-shopify-hmac-sha256"];
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
    
    // 🎯 FIX: Read the incoming stream into a valid raw Buffer
    const rawBody = await getRawBody(req);
    
    const hash = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");

    // Security Check: Deny requests if the Shopify signature doesn't match
    if (hash !== hmac) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const orderData = JSON.parse(rawBody.toString('utf8'));
    const rawCustomerId = orderData.customer?.id;

    // Skip if it's a guest checkout with no registered customer account
    if (!rawCustomerId) {
      return res.status(200).json({ success: true, message: "Guest Checkout - Skipped" });
    }

    // Extract raw numeric digits to perfectly match your frontend IDs
    const cleanCustomerId = String(rawCustomerId).replace(/\D/g, "");

    const userRef = db.collection("spinUsers").doc(cleanCustomerId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const currentBalance = userDoc.data().spinBalance || 0;
      // Add +1 spin balance to returning buyer
      await userRef.update({ spinBalance: currentBalance + 1 });
    } else {
      // Create user entry with 1 balance if somehow missing from the pool
      await userRef.set({ spinBalance: 1 });
    }

    return res.status(200).json({ success: true, message: `Spin credited successfully to document: ${cleanCustomerId}` });
  } catch (err) {
    console.error("Webhook Execution Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Disable body parsing so the raw cryptographic buffer can be validated properly
export const config = {
  api: {
    bodyParser: false,
  },
};
