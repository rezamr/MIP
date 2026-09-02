import StartSessionPage from "./StartSession.js";
import AudioLabPage from "./AudioLab.js";
import ProfileLibraryPage from "./ProfileLibrary.js";
import AudioRecipeLibraryPage from "./AudioRecipeLibrary.js";
import CalibrationPage from "./Calibration.js";
import AudioHealthPage from "./AudioHealth.js";
import SessionsReportsPage from "./SessionsReports.js";
import SettingsPage from "./Settings.js";
const AggregatePage = { id: "aggregate", title: "Aggregate Workspace" };

export const PAGE_DEFINITIONS = Object.freeze({
  start: StartSessionPage,
  audio: AudioLabPage,
  profiles: ProfileLibraryPage,
  recipes: AudioRecipeLibraryPage,
  calibration: CalibrationPage,
  health: AudioHealthPage,
  reports: SessionsReportsPage,
  settings: SettingsPage,
  aggregate: AggregatePage,
});

export function pageDefinition(id) {
  return PAGE_DEFINITIONS[id] || PAGE_DEFINITIONS.start;
}

export function pageTitle(id) {
  return pageDefinition(id).title;
}

export default PAGE_DEFINITIONS;
