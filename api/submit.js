const crypto = require("crypto");
const { waitUntil } = require("@vercel/functions");

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1Vq0uK-w9M4EKft3l1TyzNz06yPrhtTTovH0Nb7inM1w";
const SHEET_NAME = (process.env.SHEET_NAME || "顧客データDB").trim();
const TOTAL_COLS = 17;
const TZ = "Asia/Tokyo";

// IS チーム転送先 (架電部隊が見るシート)
const IS_DEST_SS_ID = "1XrGfX7JMiGPpa2ICd1pWrkDrHvd4hFzZoIsdxzCvqas";
const IS_DEST_SHEET_NAME = "顧客データDB";

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
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || "";

  privateKey = privateKey.trim();
  if (privateKey.startsWith("{")) {
    privateKey = JSON.parse(privateKey).private_key || "";
  }
  if (
    (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))
  ) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, "\n").trim();

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

// ============================================================
// IS 転送先用ヘルパ (任意の spreadsheetId 対応版)
// ============================================================
async function sheetsValuesGet(accessToken, ssId, range) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssId}/values/${encodeURIComponent(range)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const text = await response.text();
  const result = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(result.error && result.error.message ? result.error.message : "Sheets values.get failed");
  }
  return result;
}

async function sheetsValuesUpdate(accessToken, ssId, range, rowValues) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ values: [rowValues] })
  });
  const text = await response.text();
  const result = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(result.error && result.error.message ? result.error.message : "Sheets values.update failed");
  }
  return result;
}

async function sheetsBatchUpdate(accessToken, ssId, requests) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssId}:batchUpdate`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ requests })
  });
  const text = await response.text();
  const result = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(result.error && result.error.message ? result.error.message : "Sheets batchUpdate failed");
  }
  return result;
}

async function getSheetIdByName(accessToken, ssId, sheetName) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssId}?fields=sheets(properties(sheetId,title))`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const text = await response.text();
  const result = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(result.error && result.error.message ? result.error.message : "spreadsheets.get failed");
  }
  const sheets = result.sheets || [];
  const found = sheets.find((s) => s.properties && s.properties.title === sheetName);
  return found && found.properties ? found.properties.sheetId : null;
}

// IS 転送先の A列で実データ最終行を特定
async function findLastDataRowInIS(accessToken) {
  const response = await sheetsValuesGet(accessToken, IS_DEST_SS_ID, `${IS_DEST_SHEET_NAME}!A:A`);
  const rows = response.values || [];
  let last = 1;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const cell = rows[i] && rows[i][0];
    if (cell !== undefined && cell !== null && String(cell).trim() !== "") {
      last = i + 1;
      break;
    }
  }
  return last;
}

// IS 転送先で電話番号 (J列) から既存行を逆順検索
async function findRowByPhoneInIS(accessToken, phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return -1;

  const lastDataRow = await findLastDataRowInIS(accessToken);
  if (lastDataRow <= 1) return -1;

  const startRow = Math.max(2, lastDataRow - 499);
  const response = await sheetsValuesGet(
    accessToken,
    IS_DEST_SS_ID,
    `${IS_DEST_SHEET_NAME}!J${startRow}:J${lastDataRow}`
  );
  const values = response.values || [];
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const cell = normalizePhone(values[i] && values[i][0]);
    if (cell === normalized) return startRow + i;
  }
  return -1;
}

// ============================================================
// IS チーム転送先シートへの転送 (1電話番号 = 1行)
//  - mode='insert' (firstSubmit 由来): 既存行があれば update 扱い、なければ末尾 insert
//  - mode='update' (finalSubmit 由来): 既存行の M:O だけ上書き、無ければ insert フォールバック
//  - J列(電話)空ならスキップ / try-catch で本体は止めない
// ============================================================
async function transferToIS(accessToken, data, options) {
  const mode = (options && options.mode) || "insert";
  try {
    const phone = String((data && data.phone) || "").trim();
    if (!phone) {
      console.log("[IS転送] J列(電話)空のためスキップ");
      return;
    }

    // update モード: 既存行を探して M:O 更新
    if (mode === "update") {
      const existingRow = await findRowByPhoneInIS(accessToken, phone);
      if (existingRow > 1) {
        await sheetsValuesUpdate(
          accessToken,
          IS_DEST_SS_ID,
          `${IS_DEST_SHEET_NAME}!M${existingRow}:O${existingRow}`,
          [
            data.interviewDateTime1 || "",
            data.interviewDateTime2 || "",
            data.interviewDateTime3 || ""
          ]
        );
        console.log(`[IS転送/update] 電話=${phone} → 行 ${existingRow} の M:O 更新`);
        return;
      }
      console.warn(`[IS転送/update] 電話=${phone} の既存行なし → insert にフォールバック`);
    }

    // insert モード: 既存行があれば update に切り替え (重複防止)
    if (mode === "insert") {
      const existingRow = await findRowByPhoneInIS(accessToken, phone);
      if (existingRow > 1) {
        const hasInterview =
          data.interviewDateTime1 || data.interviewDateTime2 || data.interviewDateTime3;
        if (hasInterview) {
          await sheetsValuesUpdate(
            accessToken,
            IS_DEST_SS_ID,
            `${IS_DEST_SHEET_NAME}!M${existingRow}:O${existingRow}`,
            [
              data.interviewDateTime1 || "",
              data.interviewDateTime2 || "",
              data.interviewDateTime3 || ""
            ]
          );
          console.log(
            `[IS転送/insert→merge] 電話=${phone} 既存行 ${existingRow} の M:O 更新 (重複insert回避)`
          );
        } else {
          console.log(
            `[IS転送/insert→merge] 電話=${phone} 既存行 ${existingRow} あり・面談日時なし → スキップ`
          );
        }
        return;
      }
    }

    // 末尾に 1 行 insertDimension (inheritFromBefore で書式継承)
    const lastDataRow = await findLastDataRowInIS(accessToken);
    const newRow = lastDataRow + 1;
    const sheetId = await getSheetIdByName(accessToken, IS_DEST_SS_ID, IS_DEST_SHEET_NAME);
    if (sheetId === undefined || sheetId === null) {
      throw new Error(`転送先タブ「${IS_DEST_SHEET_NAME}」が見つかりません`);
    }

    await sheetsBatchUpdate(accessToken, IS_DEST_SS_ID, [
      {
        insertDimension: {
          range: {
            sheetId,
            dimension: "ROWS",
            startIndex: lastDataRow, // 0-indexed: lastDataRow の直後に挿入
            endIndex: lastDataRow + 1
          },
          inheritFromBefore: true
        }
      }
    ]);

    await sheetsValuesUpdate(
      accessToken,
      IS_DEST_SS_ID,
      `${IS_DEST_SHEET_NAME}!A${newRow}:Q${newRow}`,
      buildRow(data)
    );

    console.log(`[IS転送/insert] 電話=${phone} → 行 ${newRow} (1行 insert, 書式継承)`);
  } catch (e) {
    console.error("[IS転送エラー]", (e && e.message) || e);
  }
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

async function findNextWritableRow(accessToken) {
  const response = await sheetsRequest(accessToken, `${SHEET_NAME}!A:A`);
  const rows = response.values || [];
  return Math.max(rows.length + 1, 2);
}

async function appendRow(accessToken, data) {
  const row = buildRow(data);
  const rowIndex = await findNextWritableRow(accessToken);

  await sheetsRequest(accessToken, `${SHEET_NAME}!A${rowIndex}:Q${rowIndex}`, {
    method: "PUT",
    params: {
      valueInputOption: "USER_ENTERED"
    },
    body: {
      values: [row]
    }
  });

  return {
    rowIndex,
    timestamp: row[COL.TIMESTAMP - 1]
  };
}

async function updateRow(accessToken, rowIndex, data) {
  let existingRow = [];
  let mergedData = data;
  let existingTimestamp = data.sheetTimestamp || "";

  if (!existingTimestamp) {
    existingRow = await getExistingRow(accessToken, rowIndex);
    mergedData = mergeExistingData(data, existingRow);
    existingTimestamp = existingRow[COL.TIMESTAMP - 1] || timestamp();
  }

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

function scheduleCalendarRegistration(data) {
  waitUntil(
    fetch("https://reiwa-form-api.vercel.app/api/calendar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://sflp.reiwa-career.com"
      },
      body: JSON.stringify({
        fullName: data.fullName || "",
        phone: data.phone || "",
        email: data.email || "",
        birthDate: data.birthDate || "",
        gender: data.gender || "",
        prefecture: data.prefecture || "",
        workStart: data.workStart || "",
        interviewDateTime1: data.interviewDateTime1 || "",
        interviewStart: data.interviewStart || "",
        interviewEnd: data.interviewEnd || "",
        version: data.version || "v2"
      })
    })
      .then(function(r) { return r.json(); })
      .then(function(j) { console.log("[calendar] result:", JSON.stringify(j)); })
      .catch(function(e) { console.error("[calendar] error:", e && e.message ? e.message : e); })
  );
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
    let rowIndex = Number(data.rowIndex || 0);
    let sheetTimestamp = data.sheetTimestamp || "";

    if (action === "finalSubmit") {
      if (rowIndex > 0) {
        await updateRow(accessToken, rowIndex, data);
        // IS 転送は waitUntil で保証付きバックグラウンド実行
        // (handler return 後も Vercel が最大60秒まで処理を保証)
        waitUntil(transferToIS(accessToken, data, { mode: "update" }));
      } else {
        rowIndex = await findRowByPhone(accessToken, data.phone);
        if (rowIndex > 0) {
          await updateRow(accessToken, rowIndex, data);
          waitUntil(transferToIS(accessToken, data, { mode: "update" }));
        } else {
          const appended = await appendRow(accessToken, data);
          rowIndex = appended.rowIndex;
          sheetTimestamp = appended.timestamp;
          waitUntil(transferToIS(accessToken, data, { mode: "insert" }));
        }
      }
      scheduleCalendarRegistration(data);
    } else {
      const appended = await appendRow(accessToken, data);
      rowIndex = appended.rowIndex;
      sheetTimestamp = appended.timestamp;
      // firstSubmit 由来 → IS 転送先に新規 insert (既存行があれば自動 merge)
      waitUntil(transferToIS(accessToken, data, { mode: "insert" }));
    }

    json(res, 200, { success: true, rowIndex, sheetTimestamp });
  } catch (error) {
    console.error(error);
    json(res, 500, { success: false, error: error.message });
  }
};
