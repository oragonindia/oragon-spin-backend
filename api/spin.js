export default async function handler(req, res) {

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Only POST allowed"
    });
  }

  const { customerId } = req.body || {};

  if (!customerId) {
    return res.status(400).json({
      success: false,
      message: "No customer ID"
    });
  }

  // 🎯 PRIZES
  const prizes = [
    "SAVE10",
    "SHIPFREE",
    "SAVE20",
    null
  ];

  const code = prizes[Math.floor(Math.random() * prizes.length)];

  // ❌ nothing won
  if (!code) {
    return res.status(200).json({
      success: true,
      code: null,
      message: "Try again"
    });
  }

  try {
    const SHOPIFY_STORE = "oragon-2901.myshopify.com";
    const TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;

    if (!TOKEN) {
      return res.status(500).json({
        success: false,
        message: "Missing Shopify token in Vercel env"
      });
    }

    // 🧠 STEP 1: CREATE PRICE RULE
    const priceRuleRes = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2024-10/price_rules.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": TOKEN
        },
        body: JSON.stringify({
          price_rule: {
            title: code,
            target_type: "line_item",
            target_selection: "all",
            allocation_method: "across",
            value_type: "percentage",
            value: "-10.0",
            customer_selection: "all",
            starts_at: new Date().toISOString()
          }
        })
      }
    );

    const priceRuleData = await priceRuleRes.json();

    if (!priceRuleData.price_rule?.id) {
      return res.status(500).json({
        success: false,
        message: "Failed to create price rule",
        error: priceRuleData
      });
    }

    const ruleId = priceRuleData.price_rule.id;

    // 🧠 STEP 2: CREATE DISCOUNT CODE
    const discountRes = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2024-10/price_rules/${ruleId}/discount_codes.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": TOKEN
        },
        body: JSON.stringify({
          discount_code: {
            code: code
          }
        })
      }
    );

    const discountData = await discountRes.json();

    return res.status(200).json({
      success: true,
      code: code,
      shopify: discountData
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
}
