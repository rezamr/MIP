const { contextBridge, ipcRenderer } = require('electron');

const call = (channel, payload) => ipcRenderer.invoke(channel, payload);
contextBridge.exposeInMainWorld('mip', Object.freeze({
  getProfiles: () => call('profiles:list'),
  getAudioPresets: () => call('audio:presets'),
  quickRecipe: value => call('audio:quick', value),
  listSessions: () => call('sessions:list'),
  getSession: id => call('sessions:get', { id }),
  getEvents: id => call('sessions:events', { id }),
  verifySession: id => call('sessions:verify', { id }),
  getOutput: id => call('sessions:output', { id }),
  createSession: value => call('sessions:create', value),
  startSession: value => call('sessions:start', value),
  saveDraft: value => call('reports:draft', value),
  lockReport: value => call('reports:lock', value),
  reveal: value => call('sessions:reveal', value),
  backupNow: () => call('backup:create'),
  getSettings: () => call('settings:get'),
  exportSession: value => call('exports:session', value),
  importLegacy: value => call('legacy:import', value),
  audioHealth: value => call('audio:health', value),
  audioBlock: value => call('audio:block', value)
}));
