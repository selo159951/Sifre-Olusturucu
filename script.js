/**
 * @typedef {Object} StrengthResult
 * @property {number} score
 * @property {'Zayıf' | 'Orta' | 'Güçlü'} level
 * @property {string[]} reasons
 */

/**
 * @typedef {Object} TransformResult
 * @property {string} output
 * @property {number} score
 * @property {'Zayıf' | 'Orta' | 'Güçlü'} level
 * @property {string[]} reasons
 */

const BASE_MAP = Object.freeze({
  a: "4",
  b: "8",
  e: "3",
  g: "9",
  i: "!",
  l: "1",
  o: "0",
  s: "$",
  t: "7",
  z: "2"
});

const SPECIAL_SET = "!@#$%*?";

function normalizeInput(raw) {
  const trMap = {
    "\u00e7": "c",
    "\u00c7": "C",
    "\u011f": "g",
    "\u011e": "G",
    "\u0131": "i",
    "\u0130": "I",
    "\u00f6": "o",
    "\u00d6": "O",
    "\u015f": "s",
    "\u015e": "S",
    "\u00fc": "u",
    "\u00dc": "U"
  };

  return String(raw || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[\u00e7\u00c7\u011f\u011e\u0131\u0130\u00f6\u00d6\u015f\u015e\u00fc\u00dc]/g, (char) => trMap[char] || char);
}

function computeHash(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function deterministicDigit(seed) {
  const digits = "7349182650";
  const idx = computeHash(seed || "seed") % digits.length;
  return digits[idx];
}

function deterministicSpecial(seed) {
  const idx = (computeHash(seed || "seed") + 3) % SPECIAL_SET.length;
  return SPECIAL_SET[idx];
}

function isLetter(char) {
  return /[A-Za-z]/.test(char);
}

function isWordChar(char) {
  return /[A-Za-z0-9]/.test(char);
}

function injectCharacter(value, token, classRegex, maxLen) {
  if (classRegex.test(value)) {
    return value;
  }

  if (value.length < maxLen) {
    return value + token;
  }

  const chars = value.split("");

  for (let i = chars.length - 1; i >= 0; i -= 1) {
    if (/[A-Za-z]/.test(chars[i])) {
      chars[i] = token;
      return chars.join("");
    }
  }

  for (let i = chars.length - 1; i >= 0; i -= 1) {
    if (!classRegex.test(chars[i])) {
      chars[i] = token;
      return chars.join("");
    }
  }

  chars[chars.length - 1] = token;
  return chars.join("");
}

function ensureComplexity(value, seed, maxLen) {
  let output = value;

  output = injectCharacter(output, deterministicDigit(seed), /\d/, maxLen);
  output = injectCharacter(output, deterministicSpecial(seed), /[^A-Za-z0-9]/, maxLen);

  return output;
}

function repeatedPenalty(text) {
  if (!text) {
    return 0;
  }

  let penalty = 0;
  let run = 1;

  for (let i = 1; i < text.length; i += 1) {
    if (text[i] === text[i - 1]) {
      run += 1;
      if (run >= 3) {
        penalty += 6;
      }
    } else {
      run = 1;
    }
  }

  return Math.min(penalty, 24);
}

function differenceCount(a, b) {
  const max = Math.max(a.length, b.length);
  let count = 0;

  for (let i = 0; i < max; i += 1) {
    if ((a[i] || "") !== (b[i] || "")) {
      count += 1;
    }
  }

  return count;
}

/**
 * @param {string} output
 * @param {string} source
 * @returns {StrengthResult}
 */
function computeStrength(output, source) {
  if (!output) {
    return { score: 0, level: "Zayıf", reasons: ["Şifre giriniz."] };
  }

  const reasons = [];
  const positives = [];

  let score = 0;
  const len = output.length;

  const lengthScore = Math.min(35, Math.round((len / 12) * 35));
  score += lengthScore;

  if (len >= 10) {
    positives.push("Uzunluk iyi.");
  } else if (len >= 8) {
    positives.push("Uzunluk yeterli.");
  } else {
    reasons.push("Uzunluk kısa, 8+ karakter hedefleyin.");
  }

  const hasLower = /[a-z]/.test(output);
  const hasUpper = /[A-Z]/.test(output);
  const hasDigit = /\d/.test(output);
  const hasSpecial = /[^A-Za-z0-9]/.test(output);

  const variety = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
  score += variety * 12;

  if (hasLower && hasUpper) {
    score += 8;
  }

  if (variety >= 3) {
    positives.push("Karakter çeşitliliği iyi.");
  } else {
    reasons.push("Rakam ve sembol çeşidini artırmak faydalı.");
  }

  const normalizedSource = normalizeInput(source);
  const changed = differenceCount(normalizedSource, output);
  const ratio = normalizedSource.length ? changed / normalizedSource.length : 0;

  score += Math.min(10, Math.round(ratio * 12));

  if (ratio >= 0.45) {
    positives.push("Dönüşüm tahmini zorlaştırdı.");
  }

  const penalty = repeatedPenalty(output);
  score -= penalty;

  if (penalty > 0) {
    reasons.push("Tekrarlayan karakterler skoru düşürür.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let level = "Zayıf";
  if (score >= 70) {
    level = "Güçlü";
  } else if (score >= 40) {
    level = "Orta";
  }

  const merged = [...reasons, ...positives];
  const unique = [];
  for (let i = 0; i < merged.length; i += 1) {
    if (!unique.includes(merged[i])) {
      unique.push(merged[i]);
    }
  }

  if (unique.length === 0) {
    unique.push("Temel güç dengesi kuruldu.");
  }

  return { score, level, reasons: unique.slice(0, 2) };
}

/**
 * @param {string} raw
 * @returns {TransformResult}
 */
function transformPassword(raw) {
  const normalized = normalizeInput(raw);

  if (!normalized) {
    return { output: "", score: 0, level: "Zayıf", reasons: ["Şifre giriniz."] };
  }

  const inputLen = normalized.length;
  const maxLen = Math.min(inputLen + 3, Math.ceil(inputLen * 1.4) + 1);

  let output = "";

  for (let i = 0; i < normalized.length; i += 1) {
    const current = normalized[i];
    const lower = current.toLowerCase();
    const nextChar = normalized[i + 1] || "";
    const atWordEnd = i === normalized.length - 1 || !isWordChar(nextChar);

    let transformed = current;

    if (i === 0 && isLetter(current)) {
      transformed = current;
    } else if (lower === "m" && atWordEnd) {
      transformed = output.length + 2 <= maxLen ? "nn" : current;
    } else if (Object.prototype.hasOwnProperty.call(BASE_MAP, lower)) {
      transformed = BASE_MAP[lower];
    }

    if (output.length + transformed.length > maxLen) {
      const allowed = Math.max(0, maxLen - output.length);
      if (allowed === 0) {
        break;
      }
      transformed = transformed.slice(0, allowed);
    }

    output += transformed;

    if (output.length >= maxLen) {
      break;
    }
  }

  output = ensureComplexity(output, normalized, maxLen);

  const strength = computeStrength(output, normalized);
  return {
    output,
    score: strength.score,
    level: strength.level,
    reasons: strength.reasons
  };
}

function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fn(...args);
    }, wait);
  };
}

function getBadgeClass(level) {
  if (level === "Güçlü") {
    return "badge-guclu";
  }
  if (level === "Orta") {
    return "badge-orta";
  }
  return "badge-zayif";
}

let passwordOutputEl;
let strengthBadgeEl;
let strengthReasonsEl;
let copyBtnEl;
let toastEl;
let lastOutput = "";

/**
 * @param {TransformResult} result
 */
function renderResult(result) {
  if (!passwordOutputEl || !strengthBadgeEl || !strengthReasonsEl || !copyBtnEl) {
    return;
  }

  const { output, score, level, reasons } = result;

  passwordOutputEl.value = output;

  if (!output) {
    strengthBadgeEl.className = "badge badge-empty";
    strengthBadgeEl.textContent = "Hazır";
    strengthReasonsEl.textContent = "Şifre girince skor ve nedenler burada görünür.";
    copyBtnEl.disabled = true;
    lastOutput = "";
    return;
  }

  strengthBadgeEl.className = `badge ${getBadgeClass(level)}`;
  strengthBadgeEl.textContent = `${level} ${score}`;
  strengthReasonsEl.textContent = reasons.join(" ");
  copyBtnEl.disabled = false;

  if (output !== lastOutput) {
    passwordOutputEl.classList.remove("is-updated");
    void passwordOutputEl.offsetWidth;
    passwordOutputEl.classList.add("is-updated");
    lastOutput = output;
  }
}

function showToast(message, isError) {
  if (!toastEl) {
    return;
  }

  toastEl.textContent = message;
  toastEl.classList.toggle("error", Boolean(isError));
  toastEl.classList.add("show");

  if (showToast.timer) {
    clearTimeout(showToast.timer);
  }

  showToast.timer = setTimeout(() => {
    toastEl.classList.remove("show");
  }, 1800);
}

/**
 * @param {string} text
 * @returns {Promise<void>}
 */
async function copyOutput(text) {
  if (!text) {
    throw new Error("no-text");
  }

  if (typeof navigator !== "undefined" && navigator.clipboard && typeof window !== "undefined" && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === "undefined") {
    throw new Error("clipboard-unavailable");
  }

  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "");
  helper.style.position = "fixed";
  helper.style.left = "-9999px";
  helper.style.opacity = "0";

  document.body.appendChild(helper);
  helper.focus();
  helper.select();

  const ok = document.execCommand("copy");
  document.body.removeChild(helper);

  if (!ok) {
    throw new Error("copy-failed");
  }
}

function initUi() {
  const inputEl = document.getElementById("passwordInput");
  passwordOutputEl = document.getElementById("passwordOutput");
  strengthBadgeEl = document.getElementById("strengthBadge");
  strengthReasonsEl = document.getElementById("strengthReasons");
  copyBtnEl = document.getElementById("copyBtn");
  toastEl = document.getElementById("toast");

  if (!inputEl || !passwordOutputEl || !strengthBadgeEl || !strengthReasonsEl || !copyBtnEl) {
    return;
  }

  const update = debounce(() => {
    const result = transformPassword(inputEl.value);
    renderResult(result);
  }, 120);

  inputEl.addEventListener("input", update);

  copyBtnEl.addEventListener("click", async () => {
    try {
      await copyOutput(passwordOutputEl.value);
      showToast("Kopyalandı.", false);
    } catch (error) {
      showToast("Kopyalama başarısız. Elle seçip kopyalayın.", true);
    }
  });

  renderResult(transformPassword(""));
}

const exportTarget = typeof window !== "undefined" ? window : globalThis;
exportTarget.transformPassword = transformPassword;
exportTarget.computeStrength = computeStrength;
exportTarget.renderResult = renderResult;
exportTarget.copyOutput = copyOutput;

if (typeof document !== "undefined") {
  initUi();
}
