export const $ = (selector, root = document) => root.querySelector(selector);

export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[char]));

export const clone = (value) => {
  try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
};

export function asArray(value, keys = []) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const key of keys) if (Array.isArray(value[key])) return value[key];
  return [];
}

export function asObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

export function errorMessage(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return error?.error || error?.message || "The requested operation failed.";
}

export function dateText(value, includeTime = true) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(undefined, includeTime ? undefined : { dateStyle: "medium" });
}

export function numberText(value, digits = 2) {
  if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return "Not recorded";
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function valueText(value) {
  if (value === null || value === undefined || value === "") return "Not recorded";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    if (Array.isArray(value)) return value.map(valueText).join(", ");
    return Object.entries(value).map(([key, child]) => `${key}: ${valueText(child)}`).join("; ");
  }
  return String(value);
}

export function pill(value, fallback = "Unknown") {
  const text = value || fallback;
  const kind = /valid|verified|active|revealed|complete|running|on_time|ready/i.test(text)
    ? "valid"
    : /fail|abort|error|late|unknown|gated/i.test(text)
      ? "bad"
      : "neutral";
  return `<span class="pill ${kind}">${esc(text)}</span>`;
}

export function fieldRow(label, value, options = {}) {
  const content = options.html ? value : esc(valueText(value));
  return `<div class="review-row"><span>${esc(label)}</span><strong class="${options.mono ? "mono" : ""}">${content}</strong></div>`;
}

export function tableEmpty(columns, message = "No records available.") {
  return `<tr><td colspan="${columns}" class="empty">${esc(message)}</td></tr>`;
}

export function setButtonBusy(button, busy, label) {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = label || "Working...";
  } else {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    if (button.dataset.label) button.textContent = button.dataset.label;
  }
}

export function renderError(container, title, error, retry) {
  if (!container) return;
  container.innerHTML = `<div class="card error-card" role="alert"><h2>${esc(title)}</h2><p>${esc(errorMessage(error))}</p>${retry ? '<button class="button primary" id="retry">Try again</button>' : ""}</div>`;
  if (retry) $("#retry", container)?.addEventListener("click", retry);
}

export function humanize(value) {
  return String(value || "Unknown")
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function safeJson(value, fallback = null) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

export function safeHandler(handler, toast) {
  return (...args) => Promise.resolve(handler(...args)).catch((error) => toast(errorMessage(error)));
}
