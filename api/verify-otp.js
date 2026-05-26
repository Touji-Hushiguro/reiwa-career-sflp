function json(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function setCors(req, res) {
  const origin = req.headers.origin || "";
  const allowedOrigins = [
    "https://sflp.reiwa-career.com",
    "http://sflp.reiwa-career.com",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "null"
  ];
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function normalizePhoneJP(phone) {
  let digits = String(phone || "").replace(/[-\s\u3000]/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  return `+81${digits}`;
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { success: false, error: "Method not allowed" });
    return;
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const verifySid = process.env.TWILIO_VERIFY_SID || process.env.TWILIO_VERIFY_SERVICE_SID;

    if (!accountSid || !authToken || !verifySid) {
      json(res, 500, { success: false, error: "Twilio environment variables are missing" });
      return;
    }

    const response = await fetch(`https://verify.twilio.com/v2/Services/${verifySid}/VerificationCheck`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        To: normalizePhoneJP(data.phone),
        Code: String(data.code || "").trim()
      })
    });
    const result = await response.json();

    if (!response.ok || result.status !== "approved") {
      json(res, 400, { success: false, verified: false, error: result.message || "SMS verify failed" });
      return;
    }

    json(res, 200, { success: true, verified: true });
  } catch (error) {
    json(res, 500, { success: false, verified: false, error: error.message });
  }
};
