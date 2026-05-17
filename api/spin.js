export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Only POST allowed" });
  }

  const { customerId } = req.body || {};

  if (!customerId) {
    return res.status(400).json({ success: false, message: "No customer ID" });
  }

  // 🎯 RANDOM PRIZE LOGIC
  const discounts = [
    { type: "percentage", value: 10 },
    { type: "percentage", value: 20 },
    { type: "free_shipping" },
    { type: "none" }
  ];

  const prize = discounts[Math.floor(Math.random() * discounts.length)];

  if (prize.type === "none") {
    return res.json({
      success: true,
      code: null,
      message: "Try again"
    });
  }

  // 🔥 Generate UNIQUE coupon code string safely
  const shortId = typeof customerId === 'string' ? customerId.slice(-4) : "USER";
  const code =
    "WIN-" +
    shortId +
    "-" +
    Math.random().toString(36).substring(2, 6).toUpperCase();

  // Shopify Admin API Configuration
  const SHOP = process.env.SHOPIFY_STORE; // e.g., "your-store.myshopify.com"
  
  // 💡 Fixed: Matches the secret environment key name you created in Vercel
  const TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN; 

  const API_VERSION = "2026-01";
  const baseHeaders = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": TOKEN
  };

  // Build the correct distinct price rule payload structure Shopify expects
  let priceRulePayload = { price_rule: {} };

  if (prize.type === "percentage") {
    priceRulePayload.price_rule = {
      title: `Spin ${prize.value}% Discount`,
      target_type: "line_item",
      target_selection: "all",
      allocation_method: "across",
      value_type: "percentage",
      value: `-${prize.value}.0`,
      customer_selection: "all",
      usage_limit: 1,
      starts_at: new Date().toISOString()
    };
  } else if (prize.type === "free_shipping") {
    priceRulePayload.price_rule = {
      title: "Spin Free Shipping",
      target_type: "shipping_line",
      target_selection: "all",
      allocation_method: "across",
      value_type: "percentage",
      value: "-100.0",
      customer_selection: "all",
      usage_limit: 1,
      starts_at: new Date().toISOString()
    };
  }

  try {
    // STEP 1: Post to the Price Rules collection endpoint
    const priceRuleUrl = `https://${SHOP}/admin/api/${API_VERSION}/price_rules.json`;
    const ruleResponse = await fetch(priceRuleUrl, {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify(priceRulePayload)
    });

    const ruleData = await ruleResponse.json();

    if (!ruleResponse.ok || !ruleData.price_rule) {
      return res.status(ruleResponse.status).json({
        success: false,
        message: "Failed to create Shopify Price Rule",
        details: ruleData
      });
    }

    const priceRuleId = ruleData.price_rule.id;

    // STEP 2: Use the newly returned ID to create the actual code string inside that rule
    const discountCodeUrl = `https://${SHOP}/admin/api/${API_VERSION}/price_rules/${priceRuleId}/discount_codes.json`;
    const codePayload = {
      discount_code: {
        code: code
      }
    };

    const codeResponse = await fetch(discountCodeUrl, {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify(codePayload)
    });

    const codeData = await codeResponse.json();

    if (!codeResponse.ok) {
      return res.status(codeResponse.status).json({
        success: false,
        message: "Failed to create Shopify Discount Code string",
        details: codeData
      });
    }

    // Success! Return the code string to your frontend wheel component
    return res.json({
      success: true,
      code: code,
      prizeInfo: prize
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}
