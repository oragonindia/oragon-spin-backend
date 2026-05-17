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
    return res.status(400).json({ success: false, message: "Missing customerId" });
  }

  // 🎯 RANDOM PRIZE CONFIGURATION
  const prizes = [
    { type: "percentage", baseCode: "SAVE10", value: 10 },
    { type: "percentage", baseCode: "SAVE20", value: 20 },
    { type: "free_shipping", baseCode: "SHIPFREE", value: 100 },
    { type: "none", baseCode: null, value: 0 }
  ];

  const prize = prizes[Math.floor(Math.random() * prizes.length)];

  if (!prize.baseCode) {
    return res.status(200).json({
      success: true,
      code: null,
      message: "Try again"
    });
  }

  // 🔥 GENERATE TOTALLY UNIQUE CODE (e.g., SHIPFREE-4829-X72R)
  const cleanCustomerId = String(customerId).replace(/\D/g, "");
  const shortId = cleanCustomerId ? cleanCustomerId.slice(-4) : "USER";
  const uniqueSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const uniqueDiscountCode = `${prize.baseCode}-${shortId}-${uniqueSuffix}`;

  try {
    const SHOPIFY_STORE = "oragon-2901.myshopify.com";
    const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;

    const baseHeaders = {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": ADMIN_TOKEN
    };

    // Base price rule template
    let priceRulePayload = {
      title: `SPIN_${uniqueDiscountCode}`,
      target_selection: "all",
      usage_limit: 1, 
      starts_at: new Date().toISOString(),
      customer_selection: "prerequisite",
      prerequisite_customer_ids: [parseInt(cleanCustomerId, 10)] 
    };

    // ⚡ CRITICAL FIX: Differentiate logic properties between standard discounts and shipping
    if (prize.type === "free_shipping") {
      priceRulePayload.target_type = "shipping_line";      // Targets shipping charges
      priceRulePayload.allocation_method = "each";        // Shopify requires "each" for shipping
      priceRulePayload.value_type = "percentage";
      priceRulePayload.value = "-100.0";                  // Must be exact decimal string format
    } else {
      priceRulePayload.target_type = "line_item";         // Targets cart item lines
      priceRulePayload.allocation_method = "across";      // Standard discount flow
      priceRulePayload.value_type = "percentage";
      priceRulePayload.value = `-${prize.value}.0`;       // Clean decimal conversion string
    }

    // STEP 1: Post Price Rule Configuration Group
    const ruleResponse = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2026-04/price_rules.json`,
      {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify({ price_rule: priceRulePayload })
      }
    );

    const ruleData = await ruleResponse.json();

    if (!ruleResponse.ok || !ruleData.price_rule) {
      return res.status(ruleResponse.status).json({
        success: false,
        message: "Shopify Price Rule Creation Failed",
        details: ruleData
      });
    }

    const priceRuleId = ruleData.price_rule.id;

    // STEP 2: Bind the Unique Code String to the Generated Price Rule ID
    const codeResponse = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2026-04/price_rules/${priceRuleId}/discount_codes.json`,
      {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify({
          discount_code: {
            code: uniqueDiscountCode
          }
        })
      }
    );

    const codeData = await codeResponse.json();

    if (!codeResponse.ok) {
      return res.status(codeResponse.status).json({
        success: false,
        message: "Shopify Discount Code Association Failed",
        details: codeData
      });
    }

    return res.status(200).json({
      success: true,
      code: uniqueDiscountCode
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Shopify API connection error exception caught"
    });
  }
}
