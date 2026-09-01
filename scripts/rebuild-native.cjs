const { spawnSync } = require('node:child_process');
const electron = process.argv[2] === 'electron';
const args = ['rebuild', 'better-sqlite3', '--build-from-source'];
// Electron publishes its Node/V8 headers from a separate distribution URL;
// without it node-gyp incorrectly asks nodejs.org for a non-existent
// `node-v<electron-version>` archive on Windows.
if (electron) args.push('--runtime=electron', '--target=36.9.5', '--dist-url=https://electronjs.org/headers');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, args, { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
