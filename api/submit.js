const crypto = require("crypto");

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1Vq0uK-w9M4EKft3l1TyzNz06yPrhtTTovH0Nb7inM1w";
const SHEET_NAME = process.env.SHEET_NAME || "顧客データDB";
const TOTAL_COLS = 17;
const TZ = "Asia/Tokyo";

const COL = {
  TIMESTAMP: 1,
  UTM_SOURCE: 16,
  UTM_CONTENT: 17
};

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
    "https://touji-hushiguro.github.io",
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function parsePayload(rawBody, contentType = "") {
  if (contentType.includes("application/json")) {
    return JSON.parse(rawBody || "{}");
  }

  const params = new URLSearchParams(rawBody || "");
  const data = params.get("data");
  if (data) {
    return JSON.parse(data);
  }

  return Object.fromEntries(params.entries());
}

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Google service account environment variables are missing");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };
  const unsignedJwt = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsignedJwt)
    .sign(privateKey, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsignedJwt}.${signature}`
    })
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error_description || result.error || "Google auth failed");
  }

  return result.access_token;
}

function normalizePhone(phone) {
  return String(phone || "").replace(/[-\s\u3000]/g, "").trim();
}

function timestamp() {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date());
}

function stringifyList(value) {
  return Array.isArray(value) ? value.join(", ") : (value || "");
}

function buildRow(data, existingTimestamp = "") {
  return [
    existingTimestamp || timestamp(),
    data.workStart || "",
    stringifyList(data.jobType),
    stringifyList(data.condition),
    data.education || data.postalCode || "",
    data.employmentStatus || data.residenceStatus || "",
    data.fullName || "",
    data.birthDate || "",
    data.gender || "",
    data.phone || "",
    data.email || "",
    data.prefecture || "",
    data.interviewDateTime1 || "",
    data.interviewDateTime2 || "",
    data.interviewDateTime3 || "",
    data.utmSource || "",
    data.utmContent || ""
  ];
}

async function sheetsRequest(accessToken, range, options = {}) {
  const params = options.params ? `?${new URLSearchParams(options.params)}` : "";
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}${options.suffix || ""}${params}`;
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  const result = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(result.error && result.error.message ? result.error.message : "Google Sheets request failed");
  }

  return result;
}

async function findRowByPhone(accessToken, phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return -1;

  const response = await sheetsRequest(accessToken, `${SHEET_NAME}!J:J`);
  const rows = response.values || [];
  for (let index = rows.length - 1; index >= 1; index -= 1) {
    if (normalizePhone(rows[index][0]) === normalized) {
      return index + 1;
    }
  }

  return -1;
}

async function getExistingRow(accessToken, rowIndex) {
  const response = await sheetsRequest(accessToken, `${SHEET_NAME}!A${rowIndex}:Q${rowIndex}`);
  return (response.values && response.values[0]) || [];
}

function mergeExistingData(data, existingRow) {
  return {
    ...data,
    utmSource: data.utmSource || existingRow[COL.UTM_SOURCE - 1] || "",
    utmContent: data.utmContent || existingRow[COL.UTM_CONTENT - 1] || ""
  };
}

async function appendRow(accessToken, data) {
  await sheetsRequest(accessToken, `${SHEET_NAME}!A:Q`, {
    method: "POST",
    suffix: ":append",
    params: {
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS"
    },
    body: {
      values: [buildRow(data)]
    }
  });
}

async function updateRow(accessToken, rowIndex, data) {
  const existingRow = await getExistingRow(accessToken, rowIndex);
  const mergedData = mergeExistingData(data, existingRow);
  const existingTimestamp = existingRow[COL.TIMESTAMP - 1] || timestamp();

  await sheetsRequest(accessToken, `${SHEET_NAME}!A${rowIndex}:Q${rowIndex}`, {
    method: "PUT",
    params: {
      valueInputOption: "USER_ENTERED"
    },
    body: {
      values: [buildRow(mergedData, existingTimestamp).slice(0, TOTAL_COLS)]
    }
  });
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
    const rawBody = await readBody(req);
    const data = parsePayload(rawBody, req.headers["content-type"] || "");
    const action = data.action || "firstSubmit";
    const accessToken = await getAccessToken();

    if (action === "finalSubmit") {
      const rowIndex = await findRowByPhone(accessToken, data.phone);
      if (rowIndex > 0) {
        await updateRow(accessToken, rowIndex, data);
      } else {
        await appendRow(accessToken, data);
      }
    } else {
      await appendRow(accessToken, data);
    }

    json(res, 200, { success: true });
  } catch (error) {
    console.error(error);
    json(res, 500, { success: false, error: error.message });
  }
};
