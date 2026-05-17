export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Only POST allowed" });
  }

  const { customerId } = req.body || {};
  if (!customerId) {
    return res.status(400).json({ success: false, message: "No customer ID" });
  }

  // 🎯 pick prize
  const prizes = ["SAVE10", "SHIPFREE", "SAVE20", null];
  const code = prizes[Math.floor(Math.random() * prizes.length)];

  if (!code) {
    return res.json({ success: true, code: null });
  }

  try {
    // 🛒 CREATE SHOPIFY DISCOUNT
    const response = await fetch(
      `https://oragon-2901.myshopify.com/admin/api/2024-10/discount_codes.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN
        },
        body: JSON.stringify({
          discount_code: {
            code: code
          }
        })
      }
    );

    const data = await response.json();

    return res.json({
      success: true,
      code,
      shopify: data
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Shopify API failed",
      error: err.message
    });
  }
}
