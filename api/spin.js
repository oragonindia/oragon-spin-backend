export default function handler(req, res) {

  // allow Shopify frontend calls
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

  // 🎯 SIMPLE SERVER-SIDE PRIZE LOGIC
  const prizes = [
    { code: "SAVE10" },
    { code: "SHIPFREE" },
    { code: "SAVE20" },
    { code: null }
  ];

  const prize = prizes[Math.floor(Math.random() * prizes.length)];

  return res.status(200).json({
    success: true,
    code: prize.code
  });
}
