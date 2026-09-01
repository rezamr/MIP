import { api } from "../api.js";

/*
 * Renderer-facing session API.  All methods preserve the same bridge/fetch
 * fallback as the legacy UI while keeping report and evidence access in one
 * auditable service boundary.
 */
export class SessionService {
  list(filters = {}) {
    if (window.mip?.listSessions) return window.mip.listSessions(filters);
    // The compatibility HTTP server exposes a read-only collection route;
    // filtering remains an in-memory UI concern outside Electron.
    return api("/api/sessions");
  }

  get(id) { return api(`/api/sessions/${encodeURIComponent(id)}`); }
  events(id) { return api(`/api/sessions/${encodeURIComponent(id)}/events`); }
  verify(id) { return api(`/api/sessions/${encodeURIComponent(id)}/verify`); }
  report(id) { return api(`/api/sessions/${encodeURIComponent(id)}/report`); }
  output(id, options = {}) {
    if (window.mip?.getOutput) return window.mip.getOutput({ id, ...options });
    const query = new URLSearchParams(
      Object.entries(options).filter(([, value]) => value !== undefined && value !== null),
    ).toString();
    return api(`/api/sessions/${encodeURIComponent(id)}/output${query ? `?${query}` : ""}`);
  }
  analysis(id) { return window.mip?.getAnalysis?.({ id }) ?? null; }
  annotations(id) { return window.mip?.getLateAnnotations?.({ id }) ?? []; }
  addAnnotation(id, kind, annotation) { return window.mip?.addLateAnnotation?.({ id, kind, annotation }); }
  export(id) { return window.mip?.exportSession?.({ id }); }

  create(payload) { return api("/api/sessions", { method: "POST", body: payload }); }
  start(id, payload = {}) { return api(`/api/sessions/${encodeURIComponent(id)}/start`, { method: "POST", body: payload }); }
  saveDraft(id, report) { return api(`/api/sessions/${encodeURIComponent(id)}/draft`, { method: "POST", body: { report } }); }
  lockReport(id, report) { return api(`/api/sessions/${encodeURIComponent(id)}/lock-report`, { method: "POST", body: { report } }); }
  reveal(id) { return api(`/api/sessions/${encodeURIComponent(id)}/reveal`, { method: "POST", body: {} }); }
}

export const sessionService = new SessionService();
export default SessionService;
