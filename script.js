const state = {
  currentStep: 1,
  answers: {
    timing: "",
    jobTypes: [],
    gender: "",
    birthYear: "",
    birthMonth: "",
    birthDay: "",
    birthDate: "",
    name: "",
    prefecture: "",
    email: "",
    phone: "",
    otpCode: "",
    otpSent: false,
    otpVerified: false,
    consent: false,
    sheetRowIndex: "",
    sheetTimestamp: "",
    bookingMethod: "",
    bookingDate: "",
    bookingDateIso: "",
    bookingHour: "",
    bookingMinute: "",
    bookingTime: "",
    bookingEmail: ""
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
const progressText = document.getElementById("progressText");
const landingPage = document.getElementById("landingPage");
const thanksPage = document.getElementById("thanksPage");
const thanksName = document.getElementById("thanksName");
const methodGrid = document.getElementById("methodGrid");
const dateGrid = document.getElementById("dateGrid");
const timeGrid = document.getElementById("timeGrid");
const bookingPanel = document.getElementById("bookingPanel");
const bookingComplete = document.getElementById("bookingComplete");
const bookingEmail = document.getElementById("bookingEmail");
const bookingSubmit = document.getElementById("bookingSubmit");
const completeDate = document.getElementById("completeDate");
const completeMethod = document.getElementById("completeMethod");
const moreDatesButton = document.getElementById("moreDatesButton");
const googleCalendarButton = document.getElementById("googleCalendarButton");
const icsCalendarButton = document.getElementById("icsCalendarButton");
const lineChatButton = document.getElementById("lineChatButton");
const bookingHours = Array.from({ length: 11 }, (_, index) => String(index + 10).padStart(2, "0"));
const bookingMinutes = ["00", "15", "30", "45"];
const BUSINESS_START_HOUR = 10;
const BUSINESS_END_HOUR = 20;
const SPREADSHEET_ENDPOINT = "https://project-alorn.vercel.app/api/submit";
const API_BASE = SPREADSHEET_ENDPOINT.replace(/\/api\/submit$/, "");
const LINE_CHAT_URL = "https://liff.line.me/2008784499-92DR4hmy/landing?follow=%40872lluqj&lp=7hDJTd&liff_id=2008784499-92DR4hmy";
let allBookingDates = [];
let datesExpanded = false;

function renderStep() {
  progressText.textContent = `STEP ${state.currentStep} / 6`;

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

  renderContactStep();
}

function renderChoiceStep() {
  const step = steps[state.currentStep];
  const buttons = step.choices
    .map((choice) => {
      const value = typeof choice === "string" ? choice : choice.value;
      const label = typeof choice === "string" ? choice : choice.label;
      const isSelected = step.multiple
        ? state.answers[step.key].includes(value)
        : state.answers[step.key] === value;
      const selectedClass = isSelected ? " is-selected" : "";
      return `<button class="choice-button${selectedClass}" type="button" data-choice="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
    })
    .join("");

  const multipleNote = step.multiple ? '<p class="note center-note">複数選択可</p>' : "";
  const nextButton = step.multiple ? '<button class="primary-button" type="button" id="multiNext" disabled>次へ</button>' : "";
  const back = state.currentStep > 1 ? '<button class="back-link" type="button" data-back>戻る</button>' : "";
  stepContainer.innerHTML = `<h1 class="step-title">${step.title}</h1>${multipleNote}<div class="question-buttons has-mascot">${buttons}${nextButton}</div>${back}${guideMascotMarkup("guideMascot")}`;

  stepContainer.querySelectorAll("[data-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      if (step.multiple) {
        toggleMultiChoice(step.key, button.dataset.choice);
        button.classList.toggle("is-selected");
        updateMultiNextButton(step.key);
        updateChoiceMascot(step);
      } else {
        state.answers[step.key] = button.dataset.choice;
        button.classList.add("is-selected");
        window.setTimeout(() => goToStep(state.currentStep + 1), 180);
      }
    });
  });

  if (step.multiple) {
    const multiNext = document.getElementById("multiNext");
    multiNext.addEventListener("click", () => goToStep(state.currentStep + 1));
    updateMultiNextButton(step.key);
  }

  bindBackLink();
  updateChoiceMascot(step);
}

function toggleMultiChoice(key, choice) {
  if (state.answers[key].includes(choice)) {
    state.answers[key] = state.answers[key].filter((item) => item !== choice);
  } else {
    state.answers[key] = [...state.answers[key], choice];
  }
}

function updateMultiNextButton(key) {
  const multiNext = document.getElementById("multiNext");
  if (multiNext) {
    multiNext.disabled = state.answers[key].length === 0;
  }
}

function renderZipStep() {
  stepContainer.innerHTML = `
    <h1 class="step-title">お住まいの郵便番号</h1>
    <div class="field guide-field" data-guide="zip">
      <label for="zip">お住まいの郵便番号</label>
      <input id="zip" name="zip" inputmode="numeric" autocomplete="postal-code" maxlength="7" placeholder="例: 1234567" value="${escapeHtml(state.answers.zip)}">
    </div>
    <p class="note">※ 郵便番号を入れていただくことで、お住まいの地域に合わせた求人をご紹介しやすくなります</p>
    <p class="error-text" id="zipError"></p>
    <div class="question-buttons has-mascot" data-guide="zipSubmit">
      <button class="primary-button" type="button" id="zipNext" disabled>残り2ステップ</button>
    </div>
    <button class="back-link" type="button" data-back>戻る</button>
    ${guideMascotMarkup("guideMascot")}
  `;

  const zipInput = document.getElementById("zip");
  const nextButton = document.getElementById("zipNext");
  const error = document.getElementById("zipError");

  const validate = () => {
    state.answers.zip = onlyDigits(zipInput.value).slice(0, 7);
    zipInput.value = state.answers.zip;
    const valid = /^\d{7}$/.test(state.answers.zip);
    nextButton.disabled = !valid;
    error.textContent = state.answers.zip && !valid ? "7桁の数字で入力してください" : "";
    moveGuideMascot(getGuideElement(valid ? "zipSubmit" : "zip"));
  };

  zipInput.addEventListener("input", validate);
  nextButton.addEventListener("click", () => goToStep(5));
  bindBackLink();
  validate();
  zipInput.focus();
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
      <label for="name">氏名</label>
      <input id="name" name="name" autocomplete="name" placeholder="ヤマダ タロウ" value="${escapeHtml(state.answers.name)}">
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
  const validate = () => {
    state.answers.name = normalizeKatakanaName(input.value);
    input.value = state.answers.name;
    const valid = isFullWidthKatakanaName(state.answers.name);
    nextButton.disabled = !valid;
    error.textContent = state.answers.name && !valid ? "全角カタカナで入力してください" : "";
    moveGuideMascot(getGuideElement(valid ? "nameSubmit" : "name"));
  };

  input.addEventListener("input", validate);
  nextButton.addEventListener("click", () => goToStep(6));
  bindBackLink();
  validate();
  input.focus();
}

function renderProfileStep() {
  stepContainer.innerHTML = `
    <h1 class="step-title">プロフィールを教えてください</h1>
    <div class="field guide-field" data-guide="birthDate">
      <label for="birthDate">生年月日</label>
      <input id="birthDate" name="birthDate" inputmode="numeric" autocomplete="bday" maxlength="8" placeholder="例: 19900602" value="${escapeHtml(state.answers.birthDate)}">
    </div>
    <div class="field guide-field" data-guide="name">
      <label for="name">お名前</label>
      <input id="name" name="name" autocomplete="name" placeholder="例: 山田太郎" value="${escapeHtml(state.answers.name)}">
    </div>
    <div class="field guide-field" data-guide="kana">
      <label for="kana">フリガナ（カタカナ）</label>
      <input id="kana" name="kana" placeholder="例: ヤマダタロウ" value="${escapeHtml(state.answers.kana)}">
    </div>
    <div class="field guide-field" data-guide="residency">
      <label for="residency">在留資格など、該当するものをお選びください</label>
      <select id="residency" name="residency">
        ${residencyOptions.map((option, index) => `<option value="${index === 0 ? "" : option}" ${state.answers.residency === option ? "selected" : ""}>${option}</option>`).join("")}
      </select>
    </div>
    <p class="error-text" id="profileError"></p>
    <div class="question-buttons has-mascot" data-guide="profileSubmit">
      <button class="primary-button" type="button" id="profileNext" disabled>残り1ステップ</button>
    </div>
    <button class="back-link" type="button" data-back>戻る</button>
    ${guideMascotMarkup("guideMascot")}
  `;

  const inputs = {
    birthDate: document.getElementById("birthDate"),
    name: document.getElementById("name"),
    kana: document.getElementById("kana"),
    residency: document.getElementById("residency")
  };
  const nextButton = document.getElementById("profileNext");
  const error = document.getElementById("profileError");

  const validate = () => {
    state.answers.birthDate = onlyDigits(inputs.birthDate.value).slice(0, 8);
    inputs.birthDate.value = state.answers.birthDate;
    state.answers.name = inputs.name.value.trim();
    state.answers.kana = toKatakana(inputs.kana.value.trim());
    inputs.kana.value = state.answers.kana;
    state.answers.residency = inputs.residency.value;

    const validBirthDate = isValidBirthDate(state.answers.birthDate);
    const valid = validBirthDate && state.answers.name && state.answers.kana && state.answers.residency;
    nextButton.disabled = !valid;
    error.textContent = state.answers.birthDate && !validBirthDate ? "生年月日は19900602のように8桁で入力してください" : "";
    updateProfileMascot(validBirthDate);
  };

  Object.values(inputs).forEach((input) => input.addEventListener("input", validate));
  inputs.residency.addEventListener("change", validate);
  nextButton.addEventListener("click", () => goToStep(6));
  bindBackLink();
  validate();
  inputs.birthDate.focus();
}

function renderPhoneStep() {
  stepContainer.innerHTML = `
    <h1 class="step-title">電話番号</h1>
    <div class="field guide-field" data-guide="phone">
      <label for="phone">電話番号</label>
      <input id="phone" name="phone" inputmode="tel" autocomplete="tel" maxlength="11" placeholder="例: 09012345678" value="${escapeHtml(state.answers.phone)}">
    </div>
    <p class="error-text" id="phoneError">正しい電話番号を入力してください</p>
    <label class="consent guide-field" data-guide="consent">
      <input id="consent" type="checkbox" ${state.answers.consent ? "checked" : ""}>
      <span><a href="https://box-hr.co.jp/terms/" target="_blank" rel="noopener">利用規約</a> / プライバシーポリシーを読んで、サービス利用に同意する</span>
    </label>
    <div class="question-buttons has-mascot" data-guide="phoneSubmit">
      <button class="primary-button" type="submit" id="submitButton" disabled>無料で求人を見てみる</button>
    </div>
    <button class="back-link" type="button" data-back>戻る</button>
    ${guideMascotMarkup("guideMascot")}
  `;

  const phoneInput = document.getElementById("phone");
  const consentInput = document.getElementById("consent");
  const submitButton = document.getElementById("submitButton");
  const error = document.getElementById("phoneError");

  const validate = () => {
    state.answers.phone = onlyDigits(phoneInput.value).slice(0, 11);
    phoneInput.value = state.answers.phone;
    state.answers.consent = consentInput.checked;
    const validPhone = /^\d{10,11}$/.test(state.answers.phone);
    submitButton.disabled = !(validPhone && state.answers.consent);
    error.style.visibility = state.answers.phone && !validPhone ? "visible" : "hidden";
    updatePhoneMascot(validPhone);
  };

  phoneInput.addEventListener("input", validate);
  consentInput.addEventListener("change", validate);
  bindBackLink();
  validate();
  phoneInput.focus();
}

function renderContactStep() {
  stepContainer.innerHTML = `
    <h1 class="step-title">連絡先を入力してください</h1>
    <div class="field guide-field" data-guide="email">
      <label for="email">メールアドレス</label>
      <input id="email" name="email" inputmode="email" autocomplete="email" placeholder="example@mail.com" value="${escapeHtml(state.answers.email)}">
    </div>
    <div class="field guide-field" data-guide="phone">
      <label for="phone">電話番号</label>
      <input id="phone" name="phone" inputmode="tel" autocomplete="tel" maxlength="13" placeholder="090-1234-5678" value="${escapeHtml(state.answers.phone)}">
    </div>
    <div class="question-buttons has-mascot" data-guide="otpSend">
      <button class="primary-button" type="button" id="sendOtpButton" disabled>${state.answers.otpSent ? "認証コードを再送信" : "認証コードを送信"}</button>
    </div>
    <div class="field guide-field" data-guide="otp" ${state.answers.otpSent ? "" : "hidden"}>
      <label for="otpCode">6桁の認証コード</label>
      <input id="otpCode" name="otpCode" inputmode="numeric" maxlength="6" placeholder="123456" value="${escapeHtml(state.answers.otpCode)}">
    </div>
    <div class="question-buttons has-mascot" data-guide="otpVerify" ${state.answers.otpSent ? "" : "hidden"}>
      <button class="primary-button" type="button" id="verifyOtpButton" disabled>${state.answers.otpVerified ? "認証済み" : "認証する"}</button>
    </div>
    <p class="error-text" id="contactError"></p>
    <label class="consent guide-field" data-guide="consent">
      <input id="consent" type="checkbox" ${state.answers.consent ? "checked" : ""}>
      <span><a href="https://box-hr.co.jp/terms/" target="_blank" rel="noopener">利用規約</a> / プライバシーポリシーを読んで、サービス利用に同意する</span>
    </label>
    <div class="question-buttons has-mascot" data-guide="contactSubmit">
      <button class="primary-button" type="button" id="submitButton" disabled>面談予約へ進む</button>
    </div>
    <button class="back-link" type="button" data-back>戻る</button>
    ${guideMascotMarkup("guideMascot")}
  `;

  const emailInput = document.getElementById("email");
  const phoneInput = document.getElementById("phone");
  const otpInput = document.getElementById("otpCode");
  const consentInput = document.getElementById("consent");
  const sendOtpButton = document.getElementById("sendOtpButton");
  const verifyOtpButton = document.getElementById("verifyOtpButton");
  const submitButton = document.getElementById("submitButton");
  const error = document.getElementById("contactError");

  const validate = () => {
    state.answers.email = emailInput.value.trim();
    state.answers.phone = formatPhoneInput(phoneInput.value);
    phoneInput.value = state.answers.phone;
    state.answers.otpCode = otpInput ? onlyDigits(otpInput.value).slice(0, 6) : "";
    if (otpInput) otpInput.value = state.answers.otpCode;
    state.answers.consent = consentInput.checked;

    const validEmail = isValidEmail(state.answers.email);
    const validPhone = isValidPhone(state.answers.phone);
    const validOtp = /^\d{6}$/.test(state.answers.otpCode);
    sendOtpButton.disabled = !(validEmail && validPhone) || state.answers.otpVerified;
    verifyOtpButton.disabled = !(state.answers.otpSent && validOtp) || state.answers.otpVerified;
    submitButton.disabled = !(validEmail && validPhone && state.answers.otpVerified && state.answers.consent);
    updateContactMascot(validEmail, validPhone, validOtp);
  };

  emailInput.addEventListener("input", () => {
    state.answers.otpSent = false;
    state.answers.otpVerified = false;
    validate();
  });
  phoneInput.addEventListener("input", () => {
    state.answers.otpSent = false;
    state.answers.otpVerified = false;
    validate();
  });
  if (otpInput) otpInput.addEventListener("input", validate);
  consentInput.addEventListener("change", validate);
  sendOtpButton.addEventListener("click", async () => {
    const sent = await sendOtpCode(sendOtpButton, error);
    if (sent) renderContactStep();
  });
  verifyOtpButton.addEventListener("click", async () => {
    await verifyOtpCode(verifyOtpButton, error);
    validate();
  });
  submitButton.addEventListener("click", submitLeadAndShowThanks);
  bindBackLink();
  validate();
  emailInput.focus();
}

function bindBackLink() {
  const back = stepContainer.querySelector("[data-back]");
  if (back) {
    back.addEventListener("click", () => goToStep(state.currentStep - 1));
  }
}

function goToStep(step) {
  state.currentStep = Math.max(1, Math.min(6, step));
  renderStep();
}

function onlyDigits(value) {
  return value.replace(/\D/g, "");
}

function guideMascotMarkup(id) {
  return `<span class="guide-mascot" id="${id}" aria-hidden="true"><img src="assets/form-mascot.png" alt=""></span>`;
}

function getGuideElement(name) {
  const guide = stepContainer.querySelector(`[data-guide="${name}"]`);
  if (!guide) {
    return null;
  }
  return guide.querySelector("input, select, button") || guide;
}

function moveMascotInContainer(mascot, container, target) {
  if (!mascot || !container || !target) {
    return;
  }

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

function updateChoiceMascot(step) {
  const selected = step.multiple ? state.answers[step.key].length > 0 : false;
  const target = selected
    ? document.getElementById("multiNext")
    : stepContainer.querySelector("[data-choice]");
  moveGuideMascot(target);
}

function updateProfileMascot(validBirthDate) {
  const nextTarget = !validBirthDate
    ? "birthDate"
    : !state.answers.name
      ? "name"
      : !state.answers.kana
        ? "kana"
        : !state.answers.residency
          ? "residency"
          : "profileSubmit";
  moveGuideMascot(getGuideElement(nextTarget));
}

function updatePhoneMascot(validPhone) {
  const nextTarget = !validPhone
    ? "phone"
    : !state.answers.consent
      ? "consent"
      : "phoneSubmit";
  moveGuideMascot(getGuideElement(nextTarget));
}

function updateContactMascot(validEmail, validPhone, validOtp) {
  const nextTarget = !validEmail
    ? "email"
    : !validPhone
      ? "phone"
      : !state.answers.otpSent
        ? "otpSend"
        : !state.answers.otpVerified
          ? (validOtp ? "otpVerify" : "otp")
          : !state.answers.consent
            ? "consent"
            : "contactSubmit";
  moveGuideMascot(getGuideElement(nextTarget));
}

function isValidBirthDate(value) {
  if (!/^\d{8}$/.test(value)) {
    return false;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  if (year < 1950 || year > 2010 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function formatBirthDate() {
  if (!state.answers.birthYear || !state.answers.birthMonth || !state.answers.birthDay) {
    return "";
  }
  return [
    state.answers.birthYear,
    String(state.answers.birthMonth).padStart(2, "0"),
    String(state.answers.birthDay).padStart(2, "0")
  ].join("-");
}

function isValidSelectedBirthDate() {
  if (!state.answers.birthYear || !state.answers.birthMonth || !state.answers.birthDay) {
    return false;
  }
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

function getMergedFullName() {
  return state.answers.name;
}

function formatPhoneInput(value) {
  return onlyDigits(value).slice(0, 11);
}

function isValidPhone(value) {
  return /^\d{10,11}$/.test(onlyDigits(value));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

function getInterviewLabel() {
  if (!state.answers.bookingDate || !state.answers.bookingTime) {
    return "";
  }
  return `${state.answers.bookingDate} ${state.answers.bookingTime}`;
}

function getInterviewStartEnd() {
  if (!state.answers.bookingDateIso || !state.answers.bookingTime) {
    return { start: "", end: "" };
  }
  const start = getBookingStartDate();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

function pushGtmEvent(eventName, details = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: eventName,
    lp_name: "sflp_reiwa_career",
    ...details
  });
}

function buildSubmissionPayload(stage) {
  const isFinal = stage === "booking_completed";
  const interview = getInterviewStartEnd();
  const conditionValues = [
    isFinal && state.answers.bookingMethod ? `面談方法: ${state.answers.bookingMethod}` : ""
  ].filter(Boolean);

  return {
    action: isFinal ? "finalSubmit" : "firstSubmit",
    rowIndex: state.answers.sheetRowIndex,
    sheetTimestamp: state.answers.sheetTimestamp,
    workStart: state.answers.timing,
    jobType: state.answers.jobTypes,
    condition: conditionValues,
    education: "",
    employmentStatus: "",
    fullName: getMergedFullName(),
    birthDate: state.answers.birthDate,
    gender: state.answers.gender,
    phone: state.answers.phone,
    email: state.answers.email || state.answers.bookingEmail,
    prefecture: state.answers.prefecture,
    postalCode: "",
    residenceStatus: "",
    interviewMethod: state.answers.bookingMethod,
    interviewDateTime1: isFinal ? getInterviewLabel() : "",
    interviewDateTime2: "",
    interviewDateTime3: "",
    interviewStart: isFinal ? interview.start : "",
    interviewEnd: isFinal ? interview.end : "",
    utmSource: getUrlParam("utm_source") || getUrlParam("source") || getUrlParam("channel"),
    utmContent: getUrlParam("utm_content") || getUrlParam("content") || getUrlParam("creative") || getUrlParam("cp"),
    pageUrl: location.href,
    lpStage: stage,
    consent: state.answers.consent ? "同意" : ""
  };
}

async function submitToSpreadsheet(stage) {
  if (!SPREADSHEET_ENDPOINT) {
    return true;
  }

  const payload = buildSubmissionPayload(stage);
  const body = new URLSearchParams({
    data: JSON.stringify(payload)
  });

  const response = await fetch(SPREADSHEET_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error("Spreadsheet submit failed");
  }

  const result = await response.json();
  if (result && result.rowIndex) {
    state.answers.sheetRowIndex = String(result.rowIndex);
  }
  if (result && result.sheetTimestamp) {
    state.answers.sheetTimestamp = result.sheetTimestamp;
  }

  return true;
}

async function sendOtpCode(button, errorElement) {
  button.disabled = true;
  button.textContent = "送信中...";
  errorElement.textContent = "";

  try {
    const response = await fetch(`${API_BASE}/api/send-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ phone: state.answers.phone })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || "SMS送信に失敗しました");
    }
    state.answers.otpSent = true;
    state.answers.otpVerified = false;
    return true;
  } catch (error) {
    errorElement.textContent = "認証コードを送信できませんでした。設定を確認してください。";
    state.answers.otpSent = false;
    return false;
  } finally {
    button.disabled = false;
    button.textContent = state.answers.otpSent ? "認証コードを再送信" : "認証コードを送信";
  }
}

async function verifyOtpCode(button, errorElement) {
  button.disabled = true;
  button.textContent = "認証中...";
  errorElement.textContent = "";

  try {
    const response = await fetch(`${API_BASE}/api/verify-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        phone: state.answers.phone,
        code: state.answers.otpCode
      })
    });
    const result = await response.json();
    if (!response.ok || !result.success || !result.verified) {
      throw new Error(result.error || "SMS認証に失敗しました");
    }
    state.answers.otpVerified = true;
    button.textContent = "認証済み";
  } catch (error) {
    errorElement.textContent = "認証コードが正しくありません";
    state.answers.otpVerified = false;
    button.textContent = "認証する";
  } finally {
    button.disabled = false;
  }
}

async function submitLeadAndShowThanks() {
  const submitButton = document.getElementById("submitButton");
  if (!submitButton || submitButton.disabled) return;

  submitButton.disabled = true;
  submitButton.textContent = "送信中...";

  try {
    await submitToSpreadsheet("lead_submitted");
    pushGtmEvent("sflp_lead_submit", {
      work_start: state.answers.timing,
      gender: state.answers.gender,
      prefecture: state.answers.prefecture
    });
    finishSurvey();
  } catch (error) {
    submitButton.disabled = false;
    submitButton.textContent = "面談予約へ進む";
    alert("送信に失敗しました。時間をおいてもう一度お試しください。");
  }
}

function finishSurvey() {
  surveyOverlay.style.display = "none";
  lpContent.classList.remove("is-blurred");
  document.body.classList.remove("modal-open");
  landingPage.hidden = true;
  thanksPage.hidden = false;
  thanksName.textContent = state.answers.name || "あなた";
  thanksPage.classList.add("booking-focus");
  renderBookingOptions();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderBookingOptions() {
  allBookingDates = getBookingDates();
  datesExpanded = false;
  if (!state.answers.bookingEmail && state.answers.email) {
    state.answers.bookingEmail = state.answers.email;
    bookingEmail.value = state.answers.email;
  }
  renderDateOptions();
  renderTimeOptions();
  if (!document.getElementById("bookingGuideMascot")) {
    bookingPanel.insertAdjacentHTML("beforeend", guideMascotMarkup("bookingGuideMascot"));
  }

  methodGrid.querySelectorAll("[data-method]").forEach((button) => {
    button.addEventListener("click", () => {
      state.answers.bookingMethod = button.dataset.method;
      methodGrid.querySelectorAll(".booking-option").forEach((item) => item.classList.remove("is-selected"));
      button.classList.add("is-selected");
      showBookingCard("date");
      updateBookingMascot();
    });
  });

  moreDatesButton.addEventListener("click", () => {
    datesExpanded = !datesExpanded;
    renderDateOptions();
    updateBookingMascot();
  });

  bookingEmail.addEventListener("input", () => {
    state.answers.bookingEmail = bookingEmail.value.trim();
    updateBookingState();
  });
  bookingSubmit.addEventListener("click", confirmBooking);
  googleCalendarButton.addEventListener("click", openGoogleCalendar);
  icsCalendarButton.addEventListener("click", downloadIcsCalendar);
  updateBookingState();
  updateBookingMascot();
}

function renderDateOptions() {
  const visibleDates = datesExpanded ? allBookingDates : allBookingDates.slice(0, 2);
  dateGrid.innerHTML = visibleDates
    .map((date) => {
      const selectedClass = state.answers.bookingDate === date.value ? " is-selected" : "";
      return `<button class="date-option${selectedClass}" type="button" data-date="${date.value}" data-date-iso="${date.iso}">${date.label}<small>${date.weekday}</small></button>`;
    })
    .join("");

  moreDatesButton.innerHTML = datesExpanded ? '日付を閉じる <span>▲</span>' : 'その他の日付 <span>▼</span>';

  dateGrid.querySelectorAll("[data-date]").forEach((button) => {
    button.addEventListener("click", () => {
      state.answers.bookingDate = button.dataset.date;
      state.answers.bookingDateIso = button.dataset.dateIso;
      resetBookingTime();
      dateGrid.querySelectorAll(".date-option").forEach((item) => item.classList.remove("is-selected"));
      button.classList.add("is-selected");
      showBookingCard("time");
      renderTimeOptions();
      updateBookingState();
      updateBookingMascot();
    });
  });
}

function renderTimeOptions() {
  const availableHours = getAvailableHoursForSelectedDate();
  const availableMinutes = getAvailableMinutesForSelectedHour();
  timeGrid.innerHTML = `
    <label class="time-select-wrap">
      <span>時間</span>
      <select id="bookingHour">
        <option value="">選択</option>
        ${availableHours.map((hour) => `<option value="${hour}" ${state.answers.bookingHour === hour ? "selected" : ""}>${Number(hour)}時</option>`).join("")}
      </select>
    </label>
    <label class="time-select-wrap">
      <span>分</span>
      <select id="bookingMinute" ${state.answers.bookingHour ? "" : "disabled"}>
        <option value="">選択</option>
        ${availableMinutes.map((minute) => `<option value="${minute}" ${state.answers.bookingMinute === minute ? "selected" : ""}>${minute}分</option>`).join("")}
      </select>
    </label>
  `;

  const hourSelect = document.getElementById("bookingHour");
  const minuteSelect = document.getElementById("bookingMinute");
  const updateTime = () => {
    const previousHour = state.answers.bookingHour;
    state.answers.bookingHour = hourSelect.value;
    state.answers.bookingMinute = previousHour === state.answers.bookingHour ? minuteSelect.value : "";
    state.answers.bookingTime = state.answers.bookingHour && state.answers.bookingMinute
      ? `${state.answers.bookingHour}:${state.answers.bookingMinute}〜`
      : "";
    if (previousHour !== state.answers.bookingHour) {
      renderTimeOptions();
      return;
    }
    if (state.answers.bookingTime) {
      showBookingCard("email");
    }
    updateBookingState();
    updateBookingMascot();
  };

  hourSelect.addEventListener("change", updateTime);
  minuteSelect.addEventListener("change", updateTime);
}

function resetBookingTime() {
  state.answers.bookingHour = "";
  state.answers.bookingMinute = "";
  state.answers.bookingTime = "";
}

function parseIsoDateOnly(iso) {
  if (!iso) {
    return null;
  }
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isSameCalendarDate(dateA, dateB) {
  return dateA && dateB &&
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate();
}

function getNextBookableMinuteInfo() {
  const now = new Date();
  const next = new Date(now.getTime());
  next.setSeconds(0, 0);
  const remainder = next.getMinutes() % 15;
  if (remainder !== 0) {
    next.setMinutes(next.getMinutes() + (15 - remainder));
  }
  if (remainder === 0) {
    next.setMinutes(next.getMinutes() + 15);
  }
  return next;
}

function hasAvailableSlotOnDate(date) {
  const now = new Date();
  if (!isSameCalendarDate(date, now)) {
    return true;
  }
  const next = getNextBookableMinuteInfo();
  return next.getHours() < BUSINESS_END_HOUR;
}

function getAvailableHoursForSelectedDate() {
  const selectedDate = parseIsoDateOnly(state.answers.bookingDateIso);
  if (!selectedDate) {
    return bookingHours;
  }
  const now = new Date();
  const next = getNextBookableMinuteInfo();
  return bookingHours.filter((hour) => {
    const numericHour = Number(hour);
    if (numericHour >= BUSINESS_END_HOUR) {
      return false;
    }
    return !isSameCalendarDate(selectedDate, now) || numericHour >= next.getHours();
  });
}

function getAvailableMinutesForSelectedHour() {
  if (!state.answers.bookingHour) {
    return [];
  }
  const selectedDate = parseIsoDateOnly(state.answers.bookingDateIso);
  const selectedHour = Number(state.answers.bookingHour);
  const now = new Date();
  const next = getNextBookableMinuteInfo();

  return bookingMinutes.filter((minute) => {
    if (selectedHour >= BUSINESS_END_HOUR) {
      return false;
    }
    if (!isSameCalendarDate(selectedDate, now)) {
      return true;
    }
    const numericMinute = Number(minute);
    return selectedHour > next.getHours() || (selectedHour === next.getHours() && numericMinute >= next.getMinutes());
  });
}

function getBookingDates() {
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const dates = [];
  const today = new Date();

  for (let offset = 0; dates.length < 6; offset += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    if (!hasAvailableSlotOnDate(date)) {
      continue;
    }
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = weekdays[date.getDay()];
    const visibleIndex = dates.length;
    dates.push({
      value: `${month}/${day}(${weekday})`,
      iso: `${date.getFullYear()}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      label: offset === 0 ? "今日" : offset === 1 ? "明日" : `${month}/${day}`,
      weekday: visibleIndex < 2 ? `(${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")})` : `(${weekday})`
    });
  }

  return dates;
}

function showBookingCard(cardName) {
  const card = document.querySelector(`[data-booking-card="${cardName}"]`);
  if (card) {
    card.classList.add("is-visible");
  }
}

function updateBookingState() {
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.answers.bookingEmail);
  bookingSubmit.disabled = !(state.answers.bookingMethod && state.answers.bookingDate && state.answers.bookingTime && validEmail);
  updateBookingMascot();
}

function updateBookingMascot() {
  if (!bookingPanel || bookingPanel.hidden) {
    return;
  }
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.answers.bookingEmail);
  const target = !state.answers.bookingMethod
    ? methodGrid.querySelector("[data-method]")
    : !state.answers.bookingDate
      ? dateGrid.querySelector(".date-option")
      : !state.answers.bookingHour
        ? document.getElementById("bookingHour")
        : !state.answers.bookingMinute
          ? document.getElementById("bookingMinute")
          : !validEmail
            ? bookingEmail
            : bookingSubmit;
  moveMascotInContainer(document.getElementById("bookingGuideMascot"), bookingPanel, target);
}

async function confirmBooking() {
  if (bookingSubmit.disabled) {
    return;
  }
  bookingSubmit.disabled = true;
  bookingSubmit.textContent = "送信中...";

  try {
    await submitToSpreadsheet("booking_completed");
    pushGtmEvent("sflp_booking_complete", {
      booking_method: state.answers.bookingMethod,
      booking_datetime: getInterviewLabel(),
      booking_start: getInterviewStartEnd().start
    });
  } catch (error) {
    bookingSubmit.disabled = false;
    bookingSubmit.textContent = "予約をする";
    alert("送信に失敗しました。時間をおいてもう一度お試しください。");
    return;
  }

  bookingPanel.hidden = true;
  bookingComplete.hidden = false;
  completeDate.textContent = `${state.answers.bookingDateIso} ${state.answers.bookingTime.replace("〜", "")}`;
  completeMethod.textContent = state.answers.bookingMethod;
  thanksPage.classList.remove("booking-focus");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getBookingStartDate() {
  const [year, month, day] = state.answers.bookingDateIso.split("-").map(Number);
  const [hour, minute] = state.answers.bookingTime.replace("〜", "").split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute || 0, 0);
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
  const start = getBookingStartDate();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const method = state.answers.bookingMethod || "未選択";
  const label = `${state.answers.bookingDate || ""} ${state.answers.bookingTime || ""}`.trim();
  return {
    title: "れいわキャリア 無料面談",
    details: [
      `面談方法: ${method}`,
      label ? `予約日時: ${label}` : "",
      "担当アドバイザーとの無料面談です。",
      "当日は登録いただいた電話番号、またはオンライン面談にてご案内します。"
    ].filter(Boolean).join("\n"),
    location: method === "オンライン" ? "オンライン" : "電話",
    start,
    end
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
    "PRODID:-//Reiwa Career//Landing Page//JA",
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

surveyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.currentStep === 6 && state.answers.otpVerified) {
    submitLeadAndShowThanks();
  }
});

history.replaceState({ page: "lp" }, "", location.href);
history.pushState({ page: "survey" }, "", location.href);

lpContent.classList.add("is-blurred");
document.body.classList.add("modal-open");
renderStep();
