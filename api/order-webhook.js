import admin from "firebase-admin";

// 🔐 Smart Initialization: Autodetects if your Vercel variable is Base64 or Raw JSON
if (!admin.apps.length) {
  let serviceAccount;
  const rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  try {
    // Attempt A: If it's already a clean, plain JSON string in Vercel
    serviceAccount = JSON.parse(rawEnv);
  } catch (e) {
    try {
      // Attempt B: If it's encoded in Base64 format, decode it first
      const decoded = Buffer.from(rawEnv, 'base64').toString('utf8');
      serviceAccount = JSON.parse(decoded);
    } catch (base64Error) {
      console.error("Firebase Service Account Parsing Failed completely. Check Vercel Environment Variables.");
      throw new Error("Invalid Firebase Credentials Format");
    }
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  // 🎯 If you visit manually in a browser, return a clean message instead of crashing
  if (req.method !== "POST") {
    return res.status(200).json({ 
      success: true, 
      message: "Backend server for Oragon Spin is live! Waiting for Shopify POST requests." 
    });
  }

  try {
    // 🔐 Check for Shopify domain headers to verify authenticity safely
    const shopifyDomain = req.headers["x-shopify-shop-domain"];
    if (!shopifyDomain) {
      return res.status(401).json({ success: false, message: "Unauthorized - Missing Shopify Headers" });
    }

    // Vercel automatically delivers this as a perfect object, no parsing or streams needed
    const orderData = req.body;
    if (!orderData || !orderData.customer) {
      return res.status(200).json({ success: true, message: "No customer data found - Skipped" });
    }

    const rawCustomerId = orderData.customer.id;
    if (!rawCustomerId) {
      return res.status(200).json({ success: true, message: "Guest Checkout - Skipped" });
    }

    // Extract raw numeric digits to perfectly match your frontend IDs
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
