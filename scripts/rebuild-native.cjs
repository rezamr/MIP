const { spawnSync } = require('node:child_process');
const electron = process.argv[2] === 'electron';
const args = ['rebuild', 'better-sqlite3', '--build-from-source'];
if (electron) args.push('--runtime=electron', '--target=36.9.5');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, args, { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
