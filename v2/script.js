const state = {
  currentStep: 1,
  answers: {
    timing: "",
    gender: "",
    birthYear: "",
    birthMonth: "",
    birthDay: "",
    birthDate: "",
    prefecture: "",
    name: "",
    phone: "",
    consent: false,
    bookingEmail: "",
    sheetRowIndex: "",
    sheetTimestamp: ""
  }
};

const steps = {
  1: {
    title: "いつごろから働きたいですか？",
    key: "timing",
    choices: [
      { label: "👍 1ヶ月以内", value: "1ヶ月以内" },
      { label: "✌️ 3ヶ月以内", value: "3ヶ月以内" },
      { label: "👋 6ヶ月以内", value: "6ヶ月以内" },
      { label: "決まっていない", value: "決まっていない" }
    ]
  },
  2: {
    title: "性別を選択してください",
    key: "gender",
    choices: ["男性", "女性", "その他"]
  }
};

const prefectures = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"
];

const lpContent = document.getElementById("lpContent");
const surveyOverlay = document.getElementById("surveyOverlay");
const surveyForm = document.getElementById("surveyForm");
const stepContainer = document.getElementById("stepContainer");
const step8Element = document.getElementById("step8");
const progressText = document.getElementById("progressText");
const landingPage = document.getElementById("landingPage");
const thanksPage = document.getElementById("thanksPage");
const thanksName = document.getElementById("thanksName");
const bookingPanel = document.getElementById("bookingPanel");
const bookingComplete = document.getElementById("bookingComplete");
const completeDate = document.getElementById("completeDate");
const completeMethod = document.getElementById("completeMethod");
const onlineLineCta = document.getElementById("onlineLineCta");
const googleCalendarButton = document.getElementById("googleCalendarButton");
const icsCalendarButton = document.getElementById("icsCalendarButton");
const lineChatButton = document.getElementById("lineChatButton");
const onlineLineButton = document.getElementById("onlineLineButton");

const SPREADSHEET_ENDPOINT = "https://project-alorn.vercel.app/api/submit";
const LINE_CHAT_URL = "https://liff.line.me/2008784499-92DR4hmy/landing?follow=%40872lluqj&lp=7hDJTd&liff_id=2008784499-92DR4hmy";
const ONLINE_MEETING_LINE_URL = "https://liff.line.me/2008784499-92DR4hmy/landing?follow=%40872lluqj&lp=r2hqpT&liff_id=2008784499-92DR4hmy";
const INTERVIEW_MINUTES = 15;

let pendingLeadSubmitPromise = null;
let completedInterview = { label: "", start: "", end: "" };
let isSubmittingFinal = false;

// ========== 設定 ==========
var SLOTS_URL = "https://reiwa-form-api.vercel.app/api/slots";

// ========== 状態 ==========
var allSlotsCache = null;
var quickSlotsCache = null;
var step8Selection = null;
var step8OtherDate = "";
var step8OtherTime = "";
var prefetchPromise = null;

function renderStep() {
  const isStep8 = state.currentStep === 8;
  stepContainer.hidden = isStep8;
  step8Element.classList.toggle("hidden", !isStep8);
  progressText.hidden = isStep8;

  if (isStep8) {
    fetchStep8Slots();
    return;
  }

  progressText.textContent = `STEP ${state.currentStep} / 7`;

  if (state.currentStep <= 2) {
    renderChoiceStep();
    return;
  }

  if (state.currentStep === 3) {
    renderBirthDateStep();
    return;
  }

  if (state.currentStep === 4) {
    renderPrefectureStep();
    return;
  }

  if (state.currentStep === 5) {
    renderNameStep();
    return;
  }

  if (state.currentStep === 6) {
    renderContactStep();
    return;
  }

  renderEmailStep();
}

function renderChoiceStep() {
  const step = steps[state.currentStep];
  const buttons = step.choices
    .map((choice) => {
      const value = typeof choice === "string" ? choice : choice.value;
      const label = typeof choice === "string" ? choice : choice.label;
      const selectedClass = state.answers[step.key] === value ? " is-selected" : "";
      return `<button class="choice-button${selectedClass}" type="button" data-choice="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
    })
    .join("");

  const back = state.currentStep > 1 ? '<button class="back-link" type="button" data-back>戻る</button>' : "";
  stepContainer.innerHTML = `<h1 class="step-title">${step.title}</h1><div class="question-buttons has-mascot">${buttons}</div>${back}${guideMascotMarkup("guideMascot")}`;

  stepContainer.querySelectorAll("[data-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      state.answers[step.key] = button.dataset.choice;
      button.classList.add("is-selected");
      window.setTimeout(() => goToStep(state.currentStep + 1), 180);
    });
  });

  bindBackLink();
  moveGuideMascot(stepContainer.querySelector("[data-choice]"));
}

function renderBirthDateStep() {
  const yearOptions = Array.from({ length: 13 }, (_, index) => 2005 - index)
    .map((year) => `<option value="${year}" ${String(year) === state.answers.birthYear ? "selected" : ""}>${year}年</option>`)
    .join("");
  const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1)
    .map((month) => `<option value="${month}" ${String(month) === state.answers.birthMonth ? "selected" : ""}>${month}月</option>`)
    .join("");
  const dayOptions = Array.from({ length: 31 }, (_, index) => index + 1)
    .map((day) => `<option value="${day}" ${String(day) === state.answers.birthDay ? "selected" : ""}>${day}日</option>`)
    .join("");

  stepContainer.innerHTML = `
    <h1 class="step-title">生年月日を入力してください</h1>
    <div class="field guide-field" data-guide="birthDate">
      <label>生年月日</label>
      <div class="triple-select">
        <select id="birthYear" name="birthYear"><option value="">年</option>${yearOptions}</select>
        <select id="birthMonth" name="birthMonth"><option value="">月</option>${monthOptions}</select>
        <select id="birthDay" name="birthDay"><option value="">日</option>${dayOptions}</select>
      </div>
    </div>
    <p class="error-text" id="birthDateError"></p>
    <div class="question-buttons has-mascot" data-guide="birthSubmit">
      <button class="primary-button" type="button" id="birthNext" disabled>次へ</button>
    </div>
    <button class="back-link" type="button" data-back>戻る</button>
    ${guideMascotMarkup("guideMascot")}
  `;

  const inputs = {
    year: document.getElementById("birthYear"),
    month: document.getElementById("birthMonth"),
    day: document.getElementById("birthDay")
  };
  const nextButton = document.getElementById("birthNext");
  const error = document.getElementById("birthDateError");

  const validate = () => {
    state.answers.birthYear = inputs.year.value;
    state.answers.birthMonth = inputs.month.value;
    state.answers.birthDay = inputs.day.value;
    state.answers.birthDate = formatBirthDate();
    const validDate = isValidSelectedBirthDate();
    const validAge = validDate && getAge(state.answers.birthDate) >= 21;
    nextButton.disabled = !(validDate && validAge);
    error.textContent = validDate && !validAge ? "21歳未満の方はお申し込みいただけません" : "";
    moveGuideMascot(getGuideElement(validDate && validAge ? "birthSubmit" : "birthDate"));
  };

  Object.values(inputs).forEach((input) => input.addEventListener("change", validate));
  nextButton.addEventListener("click", () => goToStep(4));
  bindBackLink();
  validate();
  inputs.year.focus();
}

function renderPrefectureStep() {
  stepContainer.innerHTML = `
    <h1 class="step-title">お住まいの都道府県を選択してください</h1>
    <div class="field guide-field" data-guide="prefecture">
      <label for="prefecture">都道府県</label>
      <select id="prefecture" name="prefecture">
        <option value="">選択してください</option>
        ${prefectures.map((prefecture) => `<option value="${prefecture}" ${state.answers.prefecture === prefecture ? "selected" : ""}>${prefecture}</option>`).join("")}
      </select>
    </div>
    <div class="question-buttons has-mascot" data-guide="prefectureSubmit">
      <button class="primary-button" type="button" id="prefectureNext" disabled>次へ</button>
    </div>
    <button class="back-link" type="button" data-back>戻る</button>
    ${guideMascotMarkup("guideMascot")}
  `;

  const select = document.getElementById("prefecture");
  const nextButton = document.getElementById("prefectureNext");
  const validate = () => {
    state.answers.prefecture = select.value;
    nextButton.disabled = !state.answers.prefecture;
    moveGuideMascot(getGuideElement(state.answers.prefecture ? "prefectureSubmit" : "prefecture"));
  };

  select.addEventListener("change", validate);
  nextButton.addEventListener("click", () => goToStep(5));
  bindBackLink();
  validate();
  select.focus();
}

function renderNameStep() {
  stepContainer.innerHTML = `
    <h1 class="step-title">お名前をカタカナで入力してください</h1>
    <div class="field guide-field" data-guide="name">
      <label for="name">氏名（カタカナ）</label>
      <input id="name" name="name" inputmode="kana" lang="ja" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="next" placeholder="ヤマダ タロウ" value="${escapeHtml(state.answers.name)}">
    </div>
    <p class="error-text" id="nameError"></p>
    <div class="question-buttons has-mascot" data-guide="nameSubmit">
      <button class="primary-button" type="button" id="nameNext" disabled>次へ</button>
    </div>
    <button class="back-link" type="button" data-back>戻る</button>
    ${guideMascotMarkup("guideMascot")}
  `;

  const input = document.getElementById("name");
  const nextButton = document.getElementById("nameNext");
  const error = document.getElementById("nameError");
  let isComposingName = false;

  const validate = (commitValue = false) => {
    if (isComposingName && !commitValue) return;
    state.answers.name = normalizeKatakanaName(input.value);
    if (commitValue) input.value = state.answers.name;
    const valid = isFullWidthKatakanaName(state.answers.name);
    nextButton.disabled = !valid;
    error.textContent = state.answers.name && !valid ? "全角カタカナで入力してください" : "";
    moveGuideMascot(getGuideElement(valid ? "nameSubmit" : "name"));
  };

  input.addEventListener("compositionstart", () => { isComposingName = true; });
  input.addEventListener("compositionend", () => { isComposingName = false; validate(true); });
  input.addEventListener("input", () => validate(false));
  input.addEventListener("blur", () => validate(true));
  nextButton.addEventListener("click", () => goToStep(6));
  bindBackLink();
  validate(true);
  input.focus();
}

function renderContactStep() {
  stepContainer.innerHTML = `
    <h1 class="step-title">連絡先を入力してください</h1>
    <div class="field guide-field" data-guide="phone">
      <label for="phone">電話番号</label>
      <input id="phone" name="phone" inputmode="tel" autocomplete="tel" maxlength="13" placeholder="090-1234-5678" value="${escapeHtml(state.answers.phone)}">
    </div>
    <p class="error-text" id="contactError"></p>
    <label class="consent guide-field" data-guide="consent">
      <input id="consent" type="checkbox" ${state.answers.consent ? "checked" : ""}>
      <span><a href="https://box-hr.co.jp/terms/" target="_blank" rel="noopener">利用規約</a> / プライバシーポリシーを読んで、サービス利用に同意する</span>
    </label>
    <div class="question-buttons has-mascot" data-guide="contactSubmit">
      <button class="primary-button" type="button" id="leadNext" disabled>面談予約へ進む</button>
    </div>
    <button class="back-link" type="button" data-back>戻る</button>
    ${guideMascotMarkup("guideMascot")}
  `;

  const phoneInput = document.getElementById("phone");
  const consentInput = document.getElementById("consent");
  const nextButton = document.getElementById("leadNext");

  const validate = () => {
    state.answers.phone = formatPhoneInput(phoneInput.value);
    phoneInput.value = state.answers.phone;
    state.answers.consent = consentInput.checked;
    const validPhone = isValidPhone(state.answers.phone);
    nextButton.disabled = !(validPhone && state.answers.consent);
    updateContactMascot(validPhone);
  };

  phoneInput.addEventListener("input", validate);
  consentInput.addEventListener("change", validate);
  nextButton.addEventListener("click", submitLeadAndContinue);
  bindBackLink();
  validate();
  phoneInput.focus();
}

function renderEmailStep() {
  stepContainer.innerHTML = `
    <h1 class="step-title">予約情報を受け取るメールアドレス</h1>
    <div class="field guide-field" data-guide="email">
      <label for="bookingEmailStep">メールアドレス</label>
      <input id="bookingEmailStep" name="bookingEmail" inputmode="email" autocomplete="email" placeholder="example@mail.com" value="${escapeHtml(state.answers.bookingEmail)}">
    </div>
    <p class="error-text" id="emailError"></p>
    <div class="question-buttons has-mascot" data-guide="emailSubmit">
      <button class="primary-button" type="button" id="emailNext" disabled>面談日時を選ぶ</button>
    </div>
    <button class="back-link" type="button" data-back>戻る</button>
    ${guideMascotMarkup("guideMascot")}
  `;

  const input = document.getElementById("bookingEmailStep");
  const nextButton = document.getElementById("emailNext");
  const error = document.getElementById("emailError");
  const validate = () => {
    state.answers.bookingEmail = input.value.trim();
    const valid = isValidEmail(state.answers.bookingEmail);
    nextButton.disabled = !valid;
    error.textContent = state.answers.bookingEmail && !valid ? "正しいメールアドレスを入力してください" : "";
    moveGuideMascot(getGuideElement(valid ? "emailSubmit" : "email"));
  };

  input.addEventListener("input", validate);
  nextButton.addEventListener("click", () => goToStep(8));
  bindBackLink();
  validate();
  input.focus();
}

function bindBackLink() {
  const back = stepContainer.querySelector("[data-back]");
  if (back) back.addEventListener("click", () => goToStep(state.currentStep - 1));
}

function goToStep(step) {
  state.currentStep = Math.max(1, Math.min(8, step));
  renderStep();
}

window.prevStep = function() {
  goToStep(state.currentStep - 1);
};

function onlyDigits(value) {
  return value.replace(/\D/g, "");
}

function guideMascotMarkup(id) {
  return `<span class="guide-mascot" id="${id}" aria-hidden="true"><img src="../assets/form-mascot.png" alt=""></span>`;
}

function getGuideElement(name) {
  const guide = stepContainer.querySelector(`[data-guide="${name}"]`);
  if (!guide) return null;
  return guide.querySelector("input, select, button") || guide;
}

function moveMascotInContainer(mascot, container, target) {
  if (!mascot || !container || !target) return;
  window.requestAnimationFrame(() => {
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const size = mascot.offsetWidth || 64;
    const left = targetRect.right - containerRect.left - size + 6;
    const top = targetRect.top - containerRect.top + (targetRect.height / 2) - (size / 2);
    mascot.style.left = `${Math.max(0, left)}px`;
    mascot.style.top = `${Math.max(0, top)}px`;
  });
}

function moveGuideMascot(target) {
  moveMascotInContainer(document.getElementById("guideMascot"), stepContainer, target);
}

function updateContactMascot(validPhone) {
  const nextTarget = !validPhone
    ? "phone"
    : !state.answers.consent
      ? "consent"
      : "contactSubmit";
  moveGuideMascot(getGuideElement(nextTarget));
}

function formatBirthDate() {
  if (!state.answers.birthYear || !state.answers.birthMonth || !state.answers.birthDay) return "";
  return [
    state.answers.birthYear,
    String(state.answers.birthMonth).padStart(2, "0"),
    String(state.answers.birthDay).padStart(2, "0")
  ].join("-");
}

function isValidSelectedBirthDate() {
  if (!state.answers.birthYear || !state.answers.birthMonth || !state.answers.birthDay) return false;
  const year = Number(state.answers.birthYear);
  const month = Number(state.answers.birthMonth);
  const day = Number(state.answers.birthDay);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function getAge(birthDate) {
  if (!birthDate) return 0;
  const [year, month, day] = birthDate.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  const birthdayPassed = today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!birthdayPassed) age -= 1;
  return age;
}

function toKatakana(value) {
  return value.replace(/[\u3041-\u3096]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 0x60)
  );
}

function normalizeKatakanaName(value) {
  return toKatakana(value)
    .replace(/[ 　]+/g, " ")
    .replace(/[^ァ-ヶー 　]/g, "")
    .trimStart();
}

function isFullWidthKatakanaName(value) {
  return /^[ァ-ヶー]+(?:[ 　][ァ-ヶー]+)*$/.test(value.trim());
}

function formatPhoneInput(value) {
  return onlyDigits(value).slice(0, 11);
}

function isValidPhone(value) {
  return /^\d{10,11}$/.test(onlyDigits(value));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name) || "";
}

function pushGtmEvent(eventName, details = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: eventName,
    lp_name: "sflp_reiwa_career",
    lp_version: "v2",
    ...details
  });
}

function buildSubmissionPayload(stage) {
  const isFinal = stage === "booking_completed";
  const sel = isFinal ? getStep8Selection() : { label: "", start: "", end: "" };

  return {
    action: isFinal ? "finalSubmit" : "firstSubmit",
    version: "v2",
    rowIndex: state.answers.sheetRowIndex,
    sheetTimestamp: state.answers.sheetTimestamp,
    workStart: state.answers.timing,
    jobType: [],
    condition: [],
    education: "",
    employmentStatus: "",
    fullName: state.answers.name,
    birthDate: state.answers.birthDate,
    gender: state.answers.gender,
    phone: state.answers.phone,
    email: isFinal ? state.answers.bookingEmail : "",
    prefecture: state.answers.prefecture,
    postalCode: "",
    residenceStatus: "",
    interviewMethod: "電話",
    interviewDateTime1: isFinal ? sel.label : "",
    interviewDateTime2: "",
    interviewDateTime3: "",
    interviewStart: isFinal ? sel.start : "",
    interviewEnd: isFinal ? sel.end : "",
    utmSource: getUrlParam("utm_source") || getUrlParam("source") || getUrlParam("channel"),
    utmContent: getUrlParam("utm_content") || getUrlParam("content") || getUrlParam("creative") || getUrlParam("cp"),
    pageUrl: location.href,
    lpStage: stage,
    consent: state.answers.consent ? "同意" : ""
  };
}

async function submitToSpreadsheet(stage) {
  const payload = buildSubmissionPayload(stage);
  const body = new URLSearchParams({ data: JSON.stringify(payload) });

  const response = await fetch(SPREADSHEET_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) throw new Error("Spreadsheet submit failed");

  const result = await response.json();
  if (result && result.rowIndex) state.answers.sheetRowIndex = String(result.rowIndex);
  if (result && result.sheetTimestamp) state.answers.sheetTimestamp = result.sheetTimestamp;
  return true;
}

async function submitLeadAndContinue() {
  const button = document.getElementById("leadNext");
  if (!button || button.disabled) return;

  button.disabled = true;
  button.textContent = "送信中...";

  pushGtmEvent("sflp_lead_submit", {
    work_start: state.answers.timing,
    gender: state.answers.gender,
    prefecture: state.answers.prefecture
  });

  pendingLeadSubmitPromise = submitToSpreadsheet("lead_submitted").catch((error) => {
    console.error("Lead submit failed", error);
    return false;
  });

  window.setTimeout(() => goToStep(7), 260);
}

// ========== プリフェッチ ==========
window.prefetchAllSlots = function() {
  if (allSlotsCache || prefetchPromise) return;
  prefetchPromise = fetch(SLOTS_URL + "?action=all_slots&days=14")
    .then(function(res) { return res.json(); })
    .then(function(json) {
      if (json.success && json.slots) {
        allSlotsCache = json.slots;
        if (state.currentStep === 8) renderStep8(allSlotsCache);
      }
      return json;
    })
    .catch(function() { prefetchPromise = null; });
};

// ========== Step8: 統合UI ==========
window.fetchStep8Slots = function() {
  var container = document.getElementById("step8Options");
  if (allSlotsCache) { renderStep8(allSlotsCache); return; }
  container.innerHTML = '<div class="quick-slots-loading">読み込み中…</div>';
  var promise = prefetchPromise || fetch(SLOTS_URL + "?action=all_slots&days=14").then(function(res) { return res.json(); });
  promise.then(function(json) {
    if (allSlotsCache) { renderStep8(allSlotsCache); return; }
    if (!json || !json.success || !json.slots || json.slots.length === 0) {
      container.innerHTML = '<div class="quick-slots-empty">直近の空き枠がありません。<br>「その他」から日程を選択してください。</div>';
      return;
    }
    allSlotsCache = json.slots;
    renderStep8(json.slots);
  }).catch(function() {
    container.innerHTML = '<div class="quick-slots-empty">空き枠の取得に失敗しました。<br>「その他」から日程を選択してください。</div>';
  });
};

window.renderStep8 = function(slots) {
  var container = document.getElementById("step8Options");
  if (!slots || slots.length === 0) {
    container.innerHTML = '<div class="quick-slots-empty">直近の空き枠がありません。<br>「その他」から日程を選択してください。</div>';
    return;
  }

  var seen = {};
  var quick = [];
  for (var i = 0; i < slots.length && quick.length < 3; i++) {
    if (!seen[slots[i].dateLabel]) { seen[slots[i].dateLabel] = true; quick.push(slots[i]); }
  }
  quickSlotsCache = quick;

  var html = "";
  html += '<label class="radio-option" onclick="selectStep8Option(\'now\', null)">' +
          '<span class="radio-circle"></span><span>今すぐ相談する</span></label>';
  quick.forEach(function(s, i) {
    html += '<label class="radio-option" onclick="selectStep8Option(\'quick\', ' + i + ')">' +
            '<span class="radio-circle"></span><span>' + escapeHtml(s.dateLabel + " " + s.timeLabel) + '</span></label>';
  });
  html += '<label class="radio-option" onclick="selectStep8Option(\'other\', null)">' +
          '<span class="radio-circle"></span><span>その他</span></label>';
  container.innerHTML = html;

  var dateSelect = document.getElementById("otherDate");
  var seenDates = {};
  var dateOptions = '<option value="">選択してください</option>';
  slots.forEach(function(s) {
    if (!seenDates[s.dateLabel]) {
      seenDates[s.dateLabel] = true;
      dateOptions += '<option value="' + escapeHtml(s.dateLabel) + '">' + escapeHtml(s.dateLabel) + '</option>';
    }
  });
  dateSelect.innerHTML = dateOptions;
};

window.selectStep8Option = function(type, index) {
  step8Selection = { type: type, index: index };
  var labels = document.querySelectorAll("#step8Options .radio-option");
  labels.forEach(function(l) { l.classList.remove("selected"); });
  var quickCount = quickSlotsCache ? quickSlotsCache.length : 0;
  var targetIndex = type === "now" ? 0 : (type === "quick" ? 1 + index : 1 + quickCount);
  if (labels[targetIndex]) labels[targetIndex].classList.add("selected");
  document.getElementById("otherSlotContainer").style.display = (type === "other") ? "block" : "none";
  updateStep8NextButton();
};

window.onOtherDateChange = function() {
  var date = document.getElementById("otherDate").value;
  step8OtherDate = date;
  var timeSelect = document.getElementById("otherTime");
  if (!date || !allSlotsCache) {
    timeSelect.innerHTML = '<option value="">選択してください</option>';
    timeSelect.disabled = true;
    step8OtherTime = "";
    updateStep8NextButton();
    return;
  }
  var times = allSlotsCache.filter(function(s) { return s.dateLabel === date; });
  var html = '<option value="">選択してください</option>';
  times.forEach(function(s) { html += '<option value="' + escapeHtml(s.timeLabel) + '">' + escapeHtml(s.timeLabel) + '</option>'; });
  timeSelect.innerHTML = html;
  timeSelect.disabled = false;
  step8OtherTime = "";
  updateStep8NextButton();
};

window.onOtherTimeChange = function() {
  step8OtherTime = document.getElementById("otherTime").value;
  updateStep8NextButton();
};

window.updateStep8NextButton = function() {
  var btn = document.getElementById("nextBtn8");
  if (!step8Selection) { btn.disabled = true; return; }
  if (step8Selection.type === "other") {
    btn.disabled = !(step8OtherDate && step8OtherTime);
  } else {
    btn.disabled = false;
  }
};

window.getStep8Selection = function() {
  if (!step8Selection) return { label: "", start: "", end: "" };
  if (step8Selection.type === "now") {
    if (allSlotsCache && allSlotsCache.length > 0) {
      var s = allSlotsCache[0];
      return { label: s.dateLabel + " " + s.timeLabel + "(今すぐ相談)", start: s.start, end: s.end };
    }
    return { label: "今すぐ相談する", start: "", end: "" };
  }
  if (step8Selection.type === "quick" && quickSlotsCache) {
    var qs = quickSlotsCache[step8Selection.index];
    return qs ? { label: qs.dateLabel + " " + qs.timeLabel, start: qs.start, end: qs.end } : { label: "", start: "", end: "" };
  }
  if (step8Selection.type === "other" && allSlotsCache) {
    for (var j = 0; j < allSlotsCache.length; j++) {
      var os = allSlotsCache[j];
      if (os.dateLabel === step8OtherDate && os.timeLabel === step8OtherTime) {
        return { label: os.dateLabel + " " + os.timeLabel, start: os.start, end: os.end };
      }
    }
    return { label: step8OtherDate + " " + step8OtherTime, start: "", end: "" };
  }
  return { label: "", start: "", end: "" };
};

window.submitForm = async function() {
  if (isSubmittingFinal) return false;
  var button = document.getElementById("nextBtn8");
  if (!button || button.disabled) return false;

  isSubmittingFinal = true;
  button.disabled = true;
  button.textContent = "送信中...";

  try {
    if (pendingLeadSubmitPromise) await pendingLeadSubmitPromise;
    await submitToSpreadsheet("booking_completed");
    completedInterview = getStep8Selection();
    pushGtmEvent("sflp_booking_complete", {
      booking_method: "電話",
      booking_datetime: completedInterview.label,
      booking_start: completedInterview.start
    });
    showThanksPage();
  } catch (error) {
    console.error("Booking submit failed", error);
    isSubmittingFinal = false;
    button.disabled = false;
    button.textContent = "次へ";
    alert("送信に失敗しました。時間をおいてもう一度お試しください。");
  }
  return false;
};

function showThanksPage() {
  surveyOverlay.style.display = "none";
  lpContent.classList.remove("is-blurred");
  document.body.classList.remove("modal-open");
  landingPage.hidden = true;
  thanksPage.hidden = false;
  thanksPage.classList.remove("booking-focus");
  thanksName.textContent = state.answers.name || "あなた";

  if (bookingPanel) bookingPanel.hidden = true;
  if (bookingComplete) bookingComplete.hidden = false;
  if (completeDate) completeDate.textContent = formatCompleteDate(completedInterview);
  if (completeMethod) completeMethod.textContent = "電話";
  if (onlineLineCta) onlineLineCta.hidden = true;

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatCompleteDate(interview) {
  if (!interview || !interview.label) return "-";
  return interview.label.replace("(今すぐ相談)", "");
}

function getCalendarDates() {
  const selection = completedInterview.label ? completedInterview : getStep8Selection();
  const start = selection.start ? new Date(selection.start) : new Date();
  const end = selection.end ? new Date(selection.end) : new Date(start.getTime() + INTERVIEW_MINUTES * 60 * 1000);
  return { start, end };
}

function formatCalendarDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    "T",
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    "00"
  ].join("");
}

function getCalendarEvent() {
  const dates = getCalendarDates();
  return {
    title: "れいわキャリア 無料面談",
    details: [
      "面談方法: 電話",
      completedInterview.label ? `予約日時: ${completedInterview.label}` : "",
      "担当アドバイザーとの無料面談です。",
      "当日は登録いただいた電話番号へご連絡します。"
    ].filter(Boolean).join("\n"),
    location: "電話",
    start: dates.start,
    end: dates.end
  };
}

function openGoogleCalendar() {
  const event = getCalendarEvent();
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${formatCalendarDate(event.start)}/${formatCalendarDate(event.end)}`,
    details: event.details,
    location: event.location,
    ctz: "Asia/Tokyo"
  });
  window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, "_blank", "noopener");
}

function formatIcsDate(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
    "T",
    String(date.getUTCHours()).padStart(2, "0"),
    String(date.getUTCMinutes()).padStart(2, "0"),
    "00Z"
  ].join("");
}

function escapeIcsText(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function downloadIcsCalendar() {
  const event = getCalendarEvent();
  const now = new Date();
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Reiwa Career//Landing Page v2//JA",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@reiwa-career.local`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART;TZID=Asia/Tokyo:${formatCalendarDate(event.start)}`,
    `DTEND;TZID=Asia/Tokyo:${formatCalendarDate(event.end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.details)}`,
    `LOCATION:${escapeIcsText(event.location)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "reiwa-career-interview.ics";
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(link.href);
  link.remove();
}

if (lineChatButton) {
  lineChatButton.addEventListener("click", () => {
    window.open(LINE_CHAT_URL, "_blank", "noopener");
  });
}

if (onlineLineButton) {
  onlineLineButton.addEventListener("click", () => {
    window.open(ONLINE_MEETING_LINE_URL, "_blank", "noopener");
  });
}

if (googleCalendarButton) {
  googleCalendarButton.addEventListener("click", openGoogleCalendar);
}

if (icsCalendarButton) {
  icsCalendarButton.addEventListener("click", downloadIcsCalendar);
}

surveyForm.addEventListener("submit", (event) => {
  event.preventDefault();
});

document.addEventListener("DOMContentLoaded", function() { prefetchAllSlots(); });

history.replaceState({ page: "lp" }, "", location.href);
history.pushState({ page: "survey" }, "", location.href);

lpContent.classList.add("is-blurred");
document.body.classList.add("modal-open");
renderStep();
