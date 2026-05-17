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

  // 🔥 Generate UNIQUE coupon code
  const code =
    "WIN-" +
    customerId.slice(-4) +
    "-" +
    Math.random().toString(36).substring(2, 6).toUpperCase();

  // Shopify Admin API
  const SHOP = process.env.SHOPIFY_STORE;
  const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

  const url = `https://${SHOP}/admin/api/2026-01/discount_codes.json`;

  let discountPayload = {};

  if (prize.type === "percentage") {
    discountPayload = {
      price_rule: {
        title: "Spin Discount",
        target_type: "line_item",
        target_selection: "all",
        allocation_method: "across",
        value_type: "percentage",
        value: `-${prize.value}`,
        customer_selection: "prerequisite",
        usage_limit: 1
      },
      discount_code: {
        code
      }
    };
  }

  if (prize.type === "free_shipping") {
    discountPayload = {
      price_rule: {
        title: "Spin Free Shipping",
        target_type: "shipping_line",
        target_selection: "all",
        allocation_method: "across",
        value_type: "percentage",
        value: "-100",
        customer_selection: "all",
        usage_limit: 1
      },
      discount_code: {
        code
      }
    };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": TOKEN
      },
      body: JSON.stringify(discountPayload)
    });

    const data = await response.json();

    return res.json({
      success: true,
      code,
      shopify: data
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}
