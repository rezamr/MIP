import { esc } from "../core.js";

export function statusPill(value, fallback = "Unknown") {
  const text = value || fallback;
  const kind = /valid|verified|active|revealed|complete|running|on_time|ready/i.test(text)
    ? "valid"
    : /fail|abort|error|late|unknown|gated/i.test(text)
      ? "bad"
      : "neutral";
  return `<span class="pill ${kind}">${esc(text)}</span>`;
}

export default statusPill;
