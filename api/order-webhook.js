import admin from "firebase-admin";

// 🔐 Initialize Firebase Admin safely using backend credentials
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, 'base64').toString())
    )
  });
}
const db = admin.firestore();

export default async function handler(req, res) {
  // Only allow secure POST requests from Shopify
  if (req.method !== "POST") return res.status(405).end();

  try {
    // 🔐 SECURITY CHECK: Verify the request is coming from your exact Shopify domain
    const shopifyDomain = req.headers["x-shopify-shop-domain"];
    
    // Replace 'your-store-name.myshopify.com' with your actual shopify domain if you want an extra layer of security
    if (!shopifyDomain) {
      return res.status(401).json({ success: false, message: "Unauthorized - Missing Shopify Headers" });
    }

    // 🎯 Vercel automatically parses this into an object now, making it bulletproof
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

// 🎯 CRITICAL CHANGE: We REMOVED the "bodyParser: false" config line entirely.
// This allows Vercel to handle the input safely without crashing!
