export const REPORT_TABS = Object.freeze([
  ["overview", "Overview"],
  ["timeline", "Timeline"],
  ["machine", "Machine Output"],
  ["raw", "Raw Report"],
  ["analysis", "Analysis"],
  ["audio", "Audio & Configuration"],
  ["export", "Files / Export"],
  ["integrity", "Integrity"],
]);

export function renderReportTabs(active = "overview") {
  return REPORT_TABS
    .map(([id, label]) => `<button data-tab="${id}" class="${id === active ? "active" : ""}">${label}</button>`)
    .join("");
}

export default REPORT_TABS;
